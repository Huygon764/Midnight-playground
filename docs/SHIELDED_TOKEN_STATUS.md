# Shielded Token Integration — Status

## Overview

PolyPay is a private multisig wallet on Midnight blockchain. We upgraded from unshielded tokens (all data public on-chain) to shielded tokens (private deposits, private transfers via Zswap zero-knowledge protocol).

### Privacy comparison

| Aspect | Before (unshielded) | After (shielded) |
|--------|---------------------|-------------------|
| Deposit source | Public | Private (shielded UTXO) |
| Transfer recipient | Public | Private (encrypted proposal + Zswap) |
| Transfer amount | Public | Private (encrypted proposal + Zswap) |
| Who approved | Private (nullifier) | Private (nullifier) |
| Vault balance | Public | Public (acceptable for MVP) |

### Architecture

```
token.compact      — mintShieldedToken + sendShielded (mint to self, send to user)
polypay.compact    — receiveShielded (deposit) + sendShielded (transfer)
crypto.ts          — AES-256-GCM encrypt/decrypt proposal data (vault key)
witnesses.ts       — transferRecipient + transferAmount (private execute params)
```

### Designed flow

1. **Mint**: token.compact mints shielded tokens to user wallet
2. **Deposit**: user deposits shielded coin into polypay vault via `receiveShielded`
3. **Propose**: signer encrypts (recipient, amount) with vault key, stores hash + encrypted data on-chain
4. **Approve**: other signers approve via nullifier (anonymous voting)
5. **Execute**: signer decrypts proposal, sets witness, circuit calls `sendShielded` from vault to recipient

---

## Timeline

### 1. Proof server 400 on shielded ops (2026-04-14, resolved)

**Problem**: All shielded kernel operations (`receiveShielded`, `mintShieldedToken`, `sendShielded`) failed with HTTP 400 from the proof server. Unshielded equivalents worked fine.

**Root cause**: Vite dev server's SPA fallback returned `index.html` for missing system-circuit ZK key paths (`/keys/midnight/zswap/output.prover` etc.). `FetchZkConfigProvider` treated the HTML as key material, producing corrupted proving payload. Unshielded ops never trigger `midnight/zswap/*` lookups, so they were unaffected.

**Fix**: Wrap `FetchZkConfigProvider` with a `Proxy` that throws for any `circuitId` starting with `midnight/`, letting the SDK fall through to `undefined keyMaterial` and the proof server use its built-in system keys.

**Result**: Full shielded kernel flow confirmed end-to-end on preprod via `test-shielded.html` — `mintShieldedToSelf`, `mintShieldedToUser`, `receiveShieldedTokens` all pass.

**Details**: See `polypay/docs/adr/006-shielded-kernel-ops-zkconfig.md`.

### 2. Error 186 — EffectsCheckFailure on executeTransfer (2026-04-15 ~ 04-16, resolved)

#### What is error 186?

Error 186 is `EffectsCheckFailure` — a Midnight validator error (Substrate `InvalidTransaction::Custom(186)`). It means the ZK circuit transcript claims don't match the actual offer. For example, the circuit says "I'm receiving coin X back into my vault" but the on-chain offer doesn't have a matching coin commitment. The validator rejects the transaction as malformed.

Source: `midnightntwrk/midnight-node` → `ledger/src/versions/common/types.rs` → `MalformedError::EffectsCheckFailure => 186`.

#### Why we hit it

After the proof server fix, the full polypay flow (deploy → mint → deposit → propose → approve → execute) worked up to `executeTransfer`. The execute circuit calls `sendShielded(coin, recipient, amount)` to send tokens from vault to recipient. When `amount < coin.value`, Midnight creates a "change" output (leftover value). The contract must claim this change back into its vault using `vaultCoin.insertCoin(key, result.change.value, self)`.

This `insertCoin` call triggered error 186 every time — regardless of whether it was inside an `if` branch, outside the `if`, or preceded by `receiveShielded`.

#### How we investigated

We binary-searched `executeTransfer` by splitting it into 5 logical blocks:

- **A**: Pre-shielded reads — `finalized`, `signers.member`, `txStatuses.lookup`
- **B**: Witness + hash check — `transferRecipient`, `transferAmount`, `persistentHash`, `txData0.lookup`
- **C**: Vault coin read — `vaultCoin.lookup` + balance check
- **D**: Shielded send — `sendShielded(coin, recipient, amount)` (mandatory)
- **E**: Post-shielded writes, split into 3 sub-blocks:
  - E1: Change handling — `if (result.change.is_some) { depositCounter.increment; vaultCoin.insertCoin }`
  - E2: `vaultCoin.remove(coinKey)`
  - E3: `txStatuses.insert(txId, 2)`

Each variant was compiled, deployed fresh on preprod, and tested end-to-end (deposit → propose → approve → execute):

| Step | Variant | What was kept | Result | What it proved |
|------|---------|--------------|--------|----------------|
| 1 | V1 | C + D only | pass | Core shielded send works without any extras |
| 2 | V2 | C + D + full E | **186** | Something in block E breaks it |
| 3 | V3a | C + D + E2 | pass | `vaultCoin.remove` is safe |
| 4 | V3b | V3a + E3 | pass | `txStatuses.insert` is safe |
| 5 | V3c | V3b + bind result | pass | Binding `sendShielded` result is safe |
| 6 | V3d | V3c + if-branch (counter + key, no insertCoin) | pass | Conditional state writes are safe |
| 7 | V3e | V3d + insertCoin inside if | **186** | `insertCoin` inside `if` triggers the bug |
| 8 | Fix1 | V3c + counter/key outside if, insertCoin inside if | **186** | Moving key derivation outside `if` doesn't help |
| 9 | Fix5 | V3c + unconditional insertCoin + assert change | **186** | Bug is not about `if` — insertCoin itself fails |
| 10 | V3f | Fix5 minus insertCoin | pass | Confirms insertCoin is the sole trigger |
| 11 | Fix6 | Fix5 + `receiveShielded(change)` before insertCoin | **186** | Adding `receiveShielded` before insertCoin doesn't help |
| 12 | **Option A** | C + D with `coin.value` (full spend, no change) | **pass** | Full-coin-spend avoids the bug entirely |

#### Root cause: Midnight platform limit on fields + reads

Further investigation revealed the 186 is NOT specific to `insertCoin` — it's a **combined limit on ledger field count + ledger reads** when a circuit uses `sendShielded`.

We binary-searched the field count using `test-shielded.compact` (adding dummy ledger fields while keeping the same δ circuit with 5 reads + sendShielded + insertCoin):

| Fields | Reads | insertCoin | Result |
|--------|-------|-----------|--------|
| 8 | 5 | yes | pass |
| 12 | 5 | yes | pass |
| 14 | 5 | yes | pass |
| 15 | 5 | yes | **pass** |
| 16 | 5 | yes | **186** |
| 17 | 5 | yes | 186 |

And when we restored auth checks (5 reads) in polypay without insertCoin:

| Fields | Reads | insertCoin | Result |
|--------|-------|-----------|--------|
| 17 | 1 | no | pass (V1) |
| 17 | 3 | no | **pass** (final working version) |
| 17 | 5 | no | **186** |

The pattern: **`fields + reads` must stay ≤ ~20 when the circuit uses `sendShielded`**.

- 17 fields + 3 reads = 20 → pass
- 17 fields + 5 reads = 22 → fail
- 15 fields + 5 reads = 20 → pass
- 16 fields + 5 reads = 21 → fail

For insertCoin-on-change specifically, the threshold is ≤15 fields (at 5 reads). This is because `insertCoin` adds shielded receive claims to the transcript, consuming additional budget.

#### Resolution

**Working version**: 3-read Option A at 17 fields.

```compact
export circuit executeTransfer(txId: Uint<64>, coinKey: Bytes<32>): [] {
  const secret = localSecret();
  const commitment = deriveCommitment(secret);
  assert(signers.member(disclose(commitment)), "Not a signer");        // read 1
  assert(txStatuses.lookup(disclose(txId)) == 1, "Tx not ready");      // read 2
  const recipientPk = transferRecipient();
  const coin = vaultCoin.lookup(disclose(coinKey));                     // read 3
  const recipient = left<ZswapCoinPublicKey, ContractAddress>(
    ZswapCoinPublicKey { bytes: disclose(recipientPk) }
  );
  sendShielded(coin, recipient, coin.value as Uint<128>);              // full coin spend
  vaultCoin.remove(disclose(coinKey));
  txStatuses.insert(disclose(txId), disclose(2 as Uint<8>));
}
```

**Trade-offs**:
- Full coin spend only — no partial transfers (user must deposit exact amounts)
- No `finalized` check — relies on `propose` enforcing it before stamp
- No hash check — relies on signer trust (approved signers won't cheat on recipient/amount)
- Coin selection in UI uses exact value match (`coin.value === amount`)

### 3. Recipient notification limitation (2026-04-16, workaround found)

#### What we observed

After resolving error 186, we tested sending a full coin to a different wallet address. The coin always appeared in the **caller's wallet** (the signer who submitted the execute tx), not the intended recipient — regardless of which `mn_shield-addr_...` address was entered.

#### Root cause

From [Compact Standard Library docs](https://docs.midnight.network/compact/standard-library/exports) under `sendShielded`:

> *"Note that this does not currently create coin ciphertexts, so sending to a user public key except for the current user will not lead to this user being informed of the coin they've been sent."*

A Midnight `ShieldedAddress` (`mn_shield-addr_...`) encodes two 32-byte keys:

| Key | Purpose |
|-----|---------|
| `coinPublicKey` | Cryptographic ownership — who can spend the coin |
| `encryptionPublicKey` | Notification — who can scan the chain and detect the coin |

`sendShielded` only accepts `coinPublicKey` via `ZswapCoinPublicKey { bytes: Bytes<32> }`. It does NOT accept or use the `encryptionPublicKey`. The commitment lands on-chain cryptographically owned by the recipient's coin key, but the ciphertext (used for wallet scanning) is tied to the submitting wallet's encryption context. The recipient's wallet never finds the coin.

#### Workaround: recipient executes the transfer

"Current user" = the wallet that submits the transaction. If the **recipient** submits the execute tx, the ciphertext is encrypted for them and they see the coin.

Flow for payroll:
1. HR/admin proposes transfer to employee's `mn_shield-addr_...`
2. Signers approve
3. **Employee (who is also a signer) executes the transfer themselves**
4. Token appears in employee's wallet

This requires the recipient to be a signer of the multisig. For a payroll model where employees are org members, this is a natural fit.

---

## Current status (2026-04-16)

`polypay/contract/src/polypay.compact` has a **working executeTransfer**: 3-read Option A with signer auth + stamp check + full coin spend. Tested end-to-end on preprod.

**What works**: deploy, mint, deposit, propose, approve, execute (3-read full-coin-spend), add/remove signer, set threshold, encrypted proposals, vault key management, coin selection by exact value.

**What does NOT work**: partial-value transfers (change handling requires ≤15 fields), sending to non-signer external wallets (recipient notification limitation).

---

## Options for future work

| Option | Approach | Privacy | Complexity |
|--------|----------|---------|------------|
| 1 | Recipient-as-executor model (current workaround) | Full privacy among signers | Low (already works) |
| 2 | Multi-denomination deposits + full-coin-spend | Needs UX for coin management | Medium |
| 3 | Use `sendUnshielded` for payouts | Recipient visible on-chain | Low |
| 4 | Hybrid: shielded vault, unshielded payout | Deposit private, payout public | Medium |
| 5 | Wait for Midnight to add coin ciphertexts | Full privacy to external users | None (blocked on upstream) |

---

## Key files

| File | Purpose |
|------|---------|
| `polypay/contract/src/polypay.compact` | Main contract (3-read Option A) |
| `polypay/contract/src/token.compact` | Token mint (shielded) |
| `polypay/contract/src/test-shielded.compact` | Bisect playground for 186 investigation |
| `polypay/contract/src/witnesses.ts` | Witness functions (localSecret + transfer params) |
| `polypay/api/src/crypto.ts` | AES-256-GCM proposal encryption |
| `polypay/api/src/index.ts` | PolyPayAPI with encrypted propose + witness execute |
| `polypay/web/src/TestShieldedPage.tsx` | Standalone shielded test page |
| `polypay/web/src/providers.ts` | zkConfigProvider Proxy workaround (ADR-006) |
| `polypay/docs/adr/006-shielded-kernel-ops-zkconfig.md` | Proof server 400 root-cause and fix |
| `docs/SHIELDED_TOKEN_STATUS.md` | This file |
