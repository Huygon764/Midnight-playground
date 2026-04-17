# ADR-006: Shielded Kernel Ops Require zkConfigProvider Workaround for System Circuits

**Date:** 2026-04-14
**Status:** Accepted
**Context:** Midnight Compact runtime 0.15.0, SDK 4.0.2, ledger-v8 8.0.3, proof-server 8.0.3, Vite dev server (browser)

## Problem

Every shielded kernel operation — `receiveShielded`, `mintShieldedToken`, `sendShielded` — failed with:

```
POST http://localhost:6300/prove -> 400 Bad Request
Response body: "bad input"
```

Unshielded equivalents (`receiveUnshielded`, `sendUnshielded`, `mintUnshieldedToken`) succeeded on the same stack. This looked like a platform bug limited to shielded kernel ops, and was initially filed as such.

Symptom was reproducible with:
- The exact minimal pattern from the Midnight docs (`receiveShielded(disclose(coin))`)
- 3 different proof server images (`midnightntwrk/proof-server:8.0.3`, `midnight-proof-server:full`, `meshsdk/midnight-proof-server:1.0.0`)
- Compact Toolchain 0.5.0 and 0.5.1
- With or without ADR-001 witness padding

## Investigation

The proof server response body just said `"bad input"` and the request took ~1s (too short for real proving) — meaning the server was rejecting at deserialization time, not during ZK proving.

The first useful clue came from patching `window.fetch` to log request/response details (the SDK's http-client-proof-provider discards the response body on non-2xx, only keeping `statusText`). Logging `/keys/*` GETs exposed this sequence during a shielded circuit call:

```
GET /keys/mintShieldedToSelf.prover           (200, 5.0 MB — real key)
GET /keys/midnight/zswap/output.prover        (200, 933 B — ???)
GET /keys/mintShieldedToSelf.verifier         (200, 2.1 KB)
GET /keys/midnight/zswap/output.verifier      (200, 933 B)
GET /zkir/mintShieldedToSelf.bzkir            (200, 544 B)
GET /zkir/midnight/zswap/output.bzkir         (200, 933 B)
```

Curling the `midnight/zswap/output` paths directly revealed the 933-byte response was literally `index.html`:

```
$ curl http://localhost:5173/keys/midnight/zswap/output.prover
<!DOCTYPE html>
<html class="dark" lang="en">
  <head>
    <script type="module">import { injectIntoGlobalHook } ...
```

## Root Cause

Shielded kernel circuits reference **system ZK circuits** — `midnight/zswap/output`, `midnight/zswap/spend`, `midnight/dust/spend` — in addition to the user's own circuit keys. These system circuits are not produced by `compactc`; they are built into the proof server.

The midnight-js SDK's `httpClientProvingProvider.prove(...)` path does:

1. Calls `zkConfigProvider.get("midnight/zswap/output")` to fetch the system circuit's proving material.
2. If the provider throws, wraps it in a try/catch and sets `keyMaterial = undefined`, letting the proof server fall back to its built-in keys.
3. Otherwise forwards whatever the provider returned as `keyMaterial` into `createProvingPayload(...)`.

In a browser + Vite dev server setup, step 1 fetches `http://localhost:5173/keys/midnight/zswap/output.prover`. The file does not exist in `public/keys/` because `compactc` only writes user-circuit keys. **Vite's SPA fallback returns `index.html` with HTTP 200** for any missing path. `FetchZkConfigProvider` reads the 933 bytes, wraps them in a `Uint8Array`, and feeds them to `createProverKey(...)` — which produces garbage `ProvingKeyMaterial`. That garbage is embedded in the proving payload, the proof server parses it as malformed input, and returns `400 "bad input"`.

Unshielded ops were unaffected because they never trigger the `midnight/zswap/*` lookup path.

### Why Node-based harnesses would have passed

`NodeZkConfigProvider` reads from disk. A missing system-circuit file would throw `ENOENT`, trigger the SDK's try/catch, and fall through to `undefined` → the proof server would use its built-in keys. Only browser + SPA-fallback dev servers turn a 404 into a corrupt key.

## Decision

Wrap `FetchZkConfigProvider` with a `Proxy` that **rejects** `getProverKey` / `getVerifierKey` / `getZKIR` for any `circuitId` that starts with `midnight/`. This simulates the correct "file not found" behavior for system circuits, the SDK falls through to `undefined keyMaterial`, and the proof server uses its built-in system keys.

```ts
// m-pay/web/src/providers.ts
const baseProvider = new FetchZkConfigProvider<MPayCircuitKeys>(baseUrl, fetch.bind(window));
const keyMaterialProvider = new Proxy(baseProvider, {
  get(target, prop, receiver) {
    if (prop === "getProverKey" || prop === "getVerifierKey" || prop === "getZKIR") {
      return (circuitId: string) => {
        if (circuitId.startsWith("midnight/")) {
          return Promise.reject(new Error(`system circuit ${circuitId} — use proof server built-in`));
        }
        return (Reflect.get(target, prop, receiver) as any).call(target, circuitId);
      };
    }
    return Reflect.get(target, prop, receiver);
  },
});
```

## Alternatives considered

- **Serve actual system keys from `public/keys/midnight/zswap/`**: the compact toolchain does not ship them; they live only inside the proof server image. Extracting and serving them adds a build step and risks version drift between the SDK and proof server.
- **Configure Vite to 404 instead of SPA-fallback for `/keys/*`**: possible (`appType: 'mpa'` or explicit middleware), but more fragile than fixing the provider directly and would silently break any future use of SPA routing under `/keys`.
- **Override `getKeyMaterial` in the proof provider**: the SDK already has the fallback logic; the issue is upstream at the zkConfig layer, so fixing it there is cleaner.

## Consequences

- Full shielded flow (`mintShieldedToken` / `receiveShielded` / `sendShielded`) works on preprod against the standard `midnightntwrk/proof-server:8.0.3` image.
- Client code never needs to ship or manage system circuit keys.
- This workaround is specific to browser-hosted dev servers with SPA fallback. A Node CLI using `NodeZkConfigProvider` does not need it.
- If a future SDK version builds the list of system circuit prefixes into `FetchZkConfigProvider` itself, this Proxy can be removed.

## Secondary findings (verified end-to-end in `test-shielded.compact`)

These are not decisions but were confirmed during the same investigation and contradict earlier assumptions worth recording:

1. **`insertCoin` is optional**: a circuit may `mintShieldedToken(..., right(kernel.self()))` and return without calling `vaultCoin.insertCoin(...)`. The output commitment alone is a valid tx. `insertCoin` is only needed when the contract will later spend that coin via `sendShielded` in a follow-up tx (it qualifies the coin into the contract's ledger-state `Map`).
2. **Prover key size matters for deploy**: a single circuit's prover key grows with the number and complexity of ops in its body (e.g. adding `insertCoin` grew `mintShieldedToSelf` from 5MB to 9.5MB). Deploy tx size/cost scales accordingly; stay under the tx ceiling noted in ADR-001.
3. **`ownPublicKey()` exists in the Compact standard library**: returns the caller's `ZswapCoinPublicKey` without passing it as a circuit argument. Enables patterns like `mintShieldedToken(..., left(ownPublicKey()))`.
4. **`result.private.result` exposes the circuit's JS return value** from `deployed.callTx.foo(...)`. Use it to capture fields like `.color` for a follow-up tx — for example, after `mintShieldedToUser`, use the returned color when constructing the `ShieldedCoinInfo` argument to `receiveShielded`.
