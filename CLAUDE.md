# CLAUDE.md

Project-specific context for Claude Code sessions.

## Project

**M-pay** — privacy-preserving multisig wallet on Midnight blockchain (Preprod). Signers identified by ZK commitments (hash of a browser-local secret). Transfer proposals are AES-256-GCM encrypted with a shared vault key.

Three workspaces under the repo root:
- `contract/` — Compact smart contracts (`mpay.compact` + `token.compact`) + generated `managed/`
- `api/` — `MPayAPI`, `TokenAPI`, proposal encryption (`crypto.ts`)
- `web/` — React + Vite + Tailwind + Lace DApp Connector

Detailed usage in `README.md`. ADRs for design history in `docs/adr/`. Shielded-ops investigation timeline in `docs/SHIELDED_TOKEN_STATUS.md`.

## Build commands

```bash
# From repo root
npm install
cd contract && npm run compact && npm run build && cd ..  # regenerates managed/
cd web && npm run dev  # auto-copies ZK keys from contract/src/managed/ into web/public/
```

Typecheck:
```bash
cd contract && npx tsc --noEmit
cd api && npx tsc --noEmit
cd web && npx tsc --noEmit
```

## Hard constraints — DO NOT break these

**Midnight platform limit: `fields + reads ≤ 20` when a circuit uses `sendShielded`.** Violation triggers Substrate error 186 (`EffectsCheckFailure`) at tx submission. `mpay.compact` has 17 ledger fields; `executeTransfer` uses 3 reads (signers.member, txStatuses.lookup, vaultCoin.lookup) and fits. Adding a read OR a field to this circuit will break it.

**`insertCoin`-on-change triggers 186 at ≥16 fields.** So partial-value transfers are NOT implemented — `executeTransfer` is full-coin-spend only (coin.value).

**`sendShielded` doesn't emit coin ciphertexts for external wallets** (upstream Compact stdlib limitation). Recipient only sees the coin if THEY submit the execute tx. Workaround: recipient-as-executor. If asked to "send to external wallet", remind user.

**Midnight has NO on-chain token metadata standard.** Lace wallet always shows custom tokens as "Shielded unnamed token (...)". The dApp labels the token `MPAY`. Do not attempt to add name/symbol fields to `token.compact`.

## Domain separators (contracts)

Both `mpay.compact` and `token.compact` currently use the same `"mpay:pk:"` domain separator for `deriveCommitment` — signer commitments are identical across contracts. Documented trade-off (see ADR-002). If splitting commitments is required, use `"mpay:multisig:pk:"` vs `"mpay:token:pk:"`.

## Encrypted proposal layout (`api/src/crypto.ts`)

- Plaintext: `recipientCpk(32) + recipientEpk(32) + amount(16)` = 80 bytes
- Ciphertext (AES-GCM): 96 bytes + 12 IV = 108 bytes
- Split across 4 × 32-byte chunks stored in `txData0-3` (`txData0` repurposed from unused `dataHash` field — circuit doesn't verify it for Transfer txs)

`TransactionsTab` rebuilds `mn_shield-addr_...` via `ShieldedAddress` codec using both keys.

## Key files for typical tasks

| Task | Files |
|------|-------|
| Modify circuit logic | `contract/src/mpay.compact`, `contract/src/token.compact` |
| Change witnesses | `contract/src/witnesses.ts` |
| API surface | `api/src/index.ts`, `api/src/common-types.ts` |
| Encryption | `api/src/crypto.ts` |
| Providers / DApp connector | `web/src/providers.ts` (ADR-006 Proxy fix) |
| App root | `web/src/App.tsx` |
| UI components | `web/src/components/*.tsx` |
| localStorage keys | `web/src/utils.ts` |
| Toast / Modal / Spinner | `web/src/components/ui.tsx` |

## Known UX limitations

- Users must back up signer secret + vault key (saved in `localStorage` only, no sync). See README "Important — Back up your keys".
- Per-signer encryption NOT implemented (needs 2 extra ledger maps → breaks `fields + reads` budget on `executeTransfer`). Vault-key sharing stays manual.

## When adding features

- Count fields and reads before touching `executeTransfer`.
- Before adding a `sendShielded` or `insertCoin` op, verify the budget with the current field count.
- `sendShielded` recipient notification is broken upstream — don't design flows that assume external wallets see the coin.
- For new proposal types, reuse the generic `propose(txType, d0-d3)` pattern. Splitting back into per-type propose circuits would push circuit count over deploy limit.

## Deliberate omissions

Things we chose NOT to do (and why):
- Partial-value transfers → `insertCoin`-on-change triggers 186 (ADR notes + SHIELDED_TOKEN_STATUS)
- Per-signer / threshold encryption → budget-constrained; vault-key shared manually
- On-chain token name / symbol → no standard exists on Midnight
- `withdraw` circuit → removed to stay under ~12-circuit deploy limit (ADR-001)
- Single-tx deploy with signer list → Compact has no variable-length constructor params; 3-phase setup instead (ADR-003)
- Hidden threshold → leaks via approval/execution pattern regardless (ADR-005)
