# Shielded Token Integration — Status

## What we're building

PolyPay is a private multisig wallet on Midnight. We're upgrading from **unshielded tokens** (everything public on-chain) to **shielded tokens** (private deposits, private transfers).

### Privacy goal

| Aspect | Before (unshielded) | After (shielded) |
|--------|---------------------|-------------------|
| Deposit source | Public | **Private** (shielded UTXO unlinkable) |
| Transfer recipient | Public | **Private** (encrypted proposal + Zswap) |
| Transfer amount | Public | **Private** (encrypted proposal + Zswap) |
| Who approved | Private (nullifier) | Private (nullifier) |
| Vault balance | Public | Public (acceptable for MVP) |

### Architecture

```
token.compact          — mintShieldedToken + sendShielded (mint to self, send to user)
polypay.compact        — receiveShielded (deposit) + sendShielded (transfer)
crypto.ts              — AES-256-GCM encrypt/decrypt proposal data (vault key)
witnesses.ts           — transferRecipient + transferAmount (private execute params)
```

### End-to-end flow (designed)

1. **Mint**: token.compact mints shielded tokens to user wallet
2. **Deposit**: user deposits shielded coin into vault via `receiveShielded`
3. **Propose**: signer encrypts (recipient, amount) with vault key, stores hash + encrypted data on-chain
4. **Approve**: other signers approve via nullifier (anonymous)
5. **Execute**: signer decrypts proposal, sets witness (recipient, amount), circuit verifies hash match, calls `sendShielded` from vault

## What's done

- `polypay.compact`: converted to shielded ops — `receiveShielded` deposit, `sendShielded` execute, unified `propose()`, encrypted proposal storage (`txData0-3`)
- `token.compact`: converted to `mintShieldedToken` + `sendShielded`
- `crypto.ts`: AES-256-GCM encryption for proposal data (recipientCpk + amount)
- `witnesses.ts`: `transferRecipient()` + `transferAmount()` for private execute
- API: `proposeTransfer` encrypts with vault key, `executeTransfer` sets witness + passes coinKey
- Web UI: vault key management, encrypted proposal display, vault coin selection for execute
- `test-shielded.compact`: minimal reproduce contract (exact Midnight docs pattern)
- `TestShieldedPage.tsx`: standalone test page at `/test-shielded.html`

## Where it's stuck

**All shielded kernel operations fail with proof server HTTP 400.**

```
POST http://localhost:6300/prove -> 400 Bad Request
```

This affects: `receiveShielded`, `mintShieldedToken`, `sendShielded`.

Tested and confirmed as **platform limitation** (not our code):
- Minimal contract with only `receiveShielded` (exact docs pattern) — fails
- 3 different proof server images — all fail
- Compact Toolchain 0.5.0 and 0.5.1 — both fail
- See `BUG_REPORT_SHIELDED.md` for full details

Unshielded operations work fine on the same proof server.

## What to do next

### When shielded gets fixed (proof server update)

1. Recompile contracts (`npm run compact && npm run build`)
2. Test with `test-shielded.html` page first
3. If `receiveShielded` works, deploy full polypay contract
4. Test full flow: mint → deposit → propose → approve → execute

### If staying unshielded (fallback)

1. Switch back to `main` branch
2. Revert polypay.compact to unshielded ops (`receiveUnshielded`/`sendUnshielded`)
3. Keep encrypted proposals + vault key (still gives proposal privacy)
4. Keep anonymous approval via nullifiers
5. Trade-off: actual token transfer is public on-chain

### Bug report

- File: `BUG_REPORT_SHIELDED.md` — ready to post on https://forum.midnight.network
- Minimal reproduce: `polypay/contract/src/test-shielded.compact`
- Test page: `polypay/web/test-shielded.html`

## Key files

| File | Purpose |
|------|---------|
| `polypay/contract/src/polypay.compact` | Main contract (shielded version) |
| `polypay/contract/src/token.compact` | Token mint (shielded version) |
| `polypay/contract/src/test-shielded.compact` | Minimal bug reproduce |
| `polypay/contract/src/witnesses.ts` | Witness functions (localSecret + transfer params) |
| `polypay/api/src/crypto.ts` | AES-256-GCM proposal encryption |
| `polypay/api/src/index.ts` | PolyPayAPI with encrypted propose + witness execute |
| `polypay/web/src/TestShieldedPage.tsx` | Standalone shielded test page |
| `BUG_REPORT_SHIELDED.md` | Bug report for Midnight forum |
