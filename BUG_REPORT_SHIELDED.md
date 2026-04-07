# Bug Report: Shielded Kernel Operations Fail with Proof Server 400

## Summary

All shielded kernel operations (`receiveShielded`, `mintShieldedToken`, `sendShielded`) fail with HTTP 400 from the proof server. This happens even with a minimal contract that uses the exact pattern from the [Midnight standard library docs](https://docs.midnight.network/compact/standard-library/exports).

Unshielded operations (`receiveUnshielded`, `sendUnshielded`, `mintUnshieldedToken`) work fine with the same proof server.

## Environment

| Component | Version |
|-----------|---------|
| Compact Toolchain (`compact`) | 0.5.1 |
| Compact Compiler (`compactc`) | 0.30.0 |
| Proof Server | midnightntwrk/proof-server:8.0.3 |
| Ledger | 8.0.3 |
| Midnight.js SDK | 4.0.2 |
| Compact Runtime | 0.15.0 |
| Network | preprod |
| OS | macOS (Apple Silicon - docker use VMM) |

## Minimal Reproduce Contract

File: `polypay/contract/src/test-shielded.compact`

```compact
pragma language_version >= 0.20;

import CompactStandardLibrary;

witness localSecret(): Bytes<32>;

constructor() {
  const secret = localSecret();
}

export circuit receiveShieldedTokens(coin: ShieldedCoinInfo): [] {
  receiveShielded(disclose(coin));
}

export circuit mintShieldedToSelf(domainSep: Bytes<32>, value: Uint<64>, nonce: Bytes<32>): ShieldedCoinInfo {
  return mintShieldedToken(disclose(domainSep), disclose(value), disclose(nonce), right<ZswapCoinPublicKey, ContractAddress>(kernel.self()));
}
```

This is the exact pattern from the [Compact standard library documentation](https://docs.midnight.network/compact/standard-library/exports).

## Steps to Reproduce

### Prerequisites

- Node.js >= 20
- Compact Toolchain 0.5.1 (`compact --version`)
- Docker (for proof server)
- Lace wallet (Chrome extension, connected to preprod)
- tNIGHT from faucet + DUST generated

### 1. Clone and checkout branch

```bash
git clone git@github.com:Huygon764/Midnight-playground.git
cd Midnight-playground
git checkout feat/shielded-token-proof-server-bug
```

### 2. Start proof server

```bash
docker run -d --rm -p 6300:6300 midnightntwrk/proof-server:8.0.3
```

Verify: `curl http://localhost:6300/health` should return `{"status":"ok",...}`

### 3. Install and compile

```bash
cd polypay
npm install
cd contract
npm run compact    # Compiles polypay + token + test-shielded contracts
npm run build
```

### 4. Run test web page

```bash
cd ../web
npm run dev
```

### 5. Open test page

Navigate to: **http://localhost:5173/test-shielded.html**

### 6. Deploy and test

1. Click **"Connect + Deploy"** — connects Lace wallet and deploys the minimal test-shielded contract (only 2 circuits)
2. Click **"Test receiveShielded"** — calls `receiveShieldedTokens(coin)` with a native tNIGHT coin

### 7. Observe error

```
POST http://localhost:6300/prove 400 (Bad Request)

receiveShielded FAILED: Unexpected error submitting scoped transaction '<unnamed>':
Error: 'prove' returned an error: Error: Failed Proof Server response:
url="http://localhost:6300/prove", code="400", status="Bad Request"
```

## What Was Tested

| Variation | Result |
|-----------|--------|
| Minimal contract (1 circuit, zero ledger state) | **400 fail** |
| Full contract (9 circuits, complex Maps/Sets/Counters) | **400 fail** |
| Added witness to force larger proving key (per ADR-001) | **400 fail** |
| Compact Toolchain 0.5.0 | **400 fail** |
| Compact Toolchain 0.5.1 (latest) | **400 fail** |
| midnightntwrk/proof-server:8.0.3 | **400 fail** |
| midnight-proof-server:full (pre-baked ZK params, 979MB) | **400 fail** |
| meshsdk/midnight-proof-server:1.0.0 | **400 fail** |

## What DOES Work (same proof server, same environment)

- `mintUnshieldedToken(domain, amount, recipient)` — works
- `receiveUnshielded(color, amount)` — works
- `sendUnshielded(color, amount, recipient)` — works
- All non-token circuits (hash, nullifier, Map/Set/Counter operations) — work

## Expected Behavior

`receiveShielded(disclose(coin))` should generate a valid ZK proof via the proof server, matching the documented standard library API.

## Notes

- Compact 0.30.0 release notes mention fixes for shielded bugs (#107 NullifiersNEClaimedNullifiers, #110 AllCommitmentsSubsetCheckFailure, #117 Cannot mint shielded tokens in constructor) — updating to 0.30.0 did not resolve the issue
- Docker VMM setting on macOS was checked
- The proof server responds to `/health` correctly, and proves unshielded circuits without issue
