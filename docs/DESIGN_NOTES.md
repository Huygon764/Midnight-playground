# Design Notes

## Design Trade-offs

| What we built | What we excluded | Why |
|---------------|------------------|-----|
| 10-circuit MPay + 1-circuit token | Separate proposeX for each tx type | Generic `propose(txType, d0-d3)` saved 3 circuits to stay under ~12 circuit deploy limit |
| Full-coin-spend executeTransfer | Partial-value transfers with change | `insertCoin`-on-change triggers Substrate error 186 above 15 ledger fields; MPay has 17 |
| 3-read executeTransfer | Hash verification of encrypted recipient | `fields + reads ≤ 20` when circuit uses `sendShielded` — removed hash check to fit budget |
| Vault key encryption (AES-GCM) for proposal data | Per-signer encryption (hybrid ECIES) | Per-signer needs 2 new ledger maps → pushes fields beyond executeTransfer budget |
| Recipient-as-executor model | Send coin ciphertexts to external wallets | `sendShielded` doesn't currently emit ciphertexts for external `ZswapCoinPublicKey` (Compact stdlib limitation) |
| On-dApp token name (`MPAY`) | On-chain name / symbol fields | Midnight has no metadata standard; Lace always shows "Shielded unnamed token (...)" for custom tokens |
| Vault key in localStorage, shared out-of-band | Threshold encryption / wallet-based decrypt | Wallet API doesn't expose decrypt; threshold crypto too heavy for hackathon |
| 3-phase setup (deploy → init → finalize) | Single-transaction deploy | Circuit limit + no variable-length constructor params |
| Secret from signData + localStorage | Deterministic wallet derivation | BIP-340 signatures non-deterministic; HD seed inaccessible ([ADR-002](adr/002-signer-secret-persistence.md)) |
| Public threshold | Hidden threshold via hash+salt | Leaks anyway via approval/execution pattern ([ADR-005](adr/005-threshold-privacy-analysis.md)) |

See `adr/` for full context on each decision. `SHIELDED_TOKEN_STATUS.md` has the shielded-ops investigation timeline (error 186, recipient notification, merged-propose attempt).

## UX Features

- Custom confirm dialog (replaces browser `confirm()`)
- Toast notifications (success/error/info) with icon + auto-dismiss
- 3-stage progress bar during tx submission: proof gen → wallet (unlock + sign) → submit
- Wallet-may-be-locked hint after 5s stuck in wallet stage
- Auto-connect on page reload if secret exists
- Auto-refresh signer list after add/remove
- Inline remove signer (trash icon on each row) with confirm modal
- Coin selector on propose transfer (radio list of vault coins)
- Click-to-copy everywhere (contract address, vault key, recipient address, commitment)
- SVG favicon + MPay branding

## Back up your keys

MPay stores user-managed keys in browser `localStorage`. They are **not synced anywhere**. If you lose them (clear browser data, switch browsers, move to a new machine), you cannot recover them from the chain.

| Key | localStorage entry | Scope | Lost ⇒ |
|-----|-------------------|-------|--------|
| Signer secret | `mpay:secret` | Per browser | Your on-chain commitment is gone. Other signers must propose removing your old commitment and add your new one (derived from the new signed secret). |
| Vault key (AES-256-GCM) | `mpay:vault-key` | Per multisig | Encrypted proposal details (recipient + amount) become unreadable. Must be re-imported from a co-signer who still has it. |
| Multisig contract address | `mpay:contract` | Per multisig | Harmless — paste the address into "Join Existing" to reconnect. Cleared on Disconnect. |
| Token contract address | `mpay:token-contract` | Per token | Harmless — paste into Token tab "Reconnect Existing". |

### What to back up manually

1. **Signer secret** — IdentityCard in the Setup/Dashboard sidebar shows the 64-char hex. Copy and store somewhere safe (password manager, encrypted note). If this is lost and you weren't added under a new commitment, you permanently lose your signer role on that multisig.
2. **Vault key** — shown in the Dashboard card right after deploy and on subsequent visits. Copy the 64-char hex. Share it out-of-band with every co-signer. Each co-signer should also back up their own copy.

### What happens on Disconnect

The "Disconnect" button in the sidebar clears `mpay:contract` + `mpay:vault-key` but **keeps** `mpay:secret`. Next connect auto-restores your identity but requires re-joining a multisig (paste address + import vault key).

### Switching browsers / machines

A new browser generates a new secret on first connect (via wallet `signData`). That produces a **new commitment** — treated as a different signer by the multisig. Either:
- Copy `mpay:secret` from the old browser's localStorage before switching, or
- Have the existing signers propose/execute adding your new commitment on the new device.

## Pending / Known Limitations

- **Vault key sharing UX** — currently manual out-of-band. Per-signer encryption doesn't fit Midnight's field+read budget. Possible alternative: drop encryption (proposal details become public, like Safe).
- **Partial-value transfers** — not implemented. Would require ≤15 ledger fields + `insertCoin` on change; MPay has 17.
- **Recipient notification** — external wallets don't see coins sent by `sendShielded`. Workaround: recipient executes the transfer themselves. Fix is upstream (Midnight SDK / Compact stdlib).
- **Token metadata** — no name/symbol/decimals displayed in Lace. Midnight has no standard. Fix depends on wallet/chain changes.
- **Stale ready-stamp after threshold change** — `txStatuses[txId]` is stamped `ready (1)` at approval time, based on the threshold in effect at that moment. `executeSetThreshold` does NOT re-evaluate existing pending txs. So:
  - Lowering threshold: a pending tx with `approvals >= new threshold` stays `pending` on-chain until someone re-stamps it (see rescue path below).
  - Raising threshold: a tx already stamped `ready` stays executable even under the stricter new threshold — the stamp is not invalidated.
  - **Rescue path**: the contract exposes `stampReady(txId)` (open to anyone, no signer gate). It asserts the tx is pending and that `approvals >= current threshold`, then sets `status = 1`. The UI detects this state automatically and renders a "Stamp Ready" button (amber "NEEDS STAMP" badge) on affected rows; clicking it calls `stampReady` and the tx becomes executable. This avoids having to iterate pending txs inside `executeSetThreshold` — Compact can't loop over runtime-variable Map sizes anyway.
- **localStorage namespace** — keys not scoped by network or wallet. Switching wallets on same browser overwrites state.
- **Contract-level unit tests** — MPay only tested end-to-end on preprod; no vitest suite.
