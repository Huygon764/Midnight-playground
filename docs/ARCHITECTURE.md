# Architecture

## Repo structure

```
.
├── contract/   Compact smart contracts (mpay + token)
├── api/        MPayAPI + TokenAPI + AES-GCM proposal encryption
├── web/        React + Vite + Tailwind + Lace DApp Connector
└── docs/       ADRs + SHIELDED_TOKEN_STATUS
```

## Contracts

### mpay.compact (9 circuits)

| Category | Circuits |
|----------|----------|
| Setup | constructor, initSigner, finalize |
| Deposit | deposit |
| Propose | propose (generic, txType selects transfer/addSigner/removeSigner/setThreshold) |
| Approve | approveTx |
| Execute | executeTransfer, executeAddSigner, executeRemoveSigner, executeSetThreshold |
| Pure | deriveCommitment, computeNullifier |

17 ledger fields. `executeTransfer` reads 3 of them (signers.member, txStatuses.lookup, vaultCoin.lookup) to stay within Midnight's `fields + reads ≤ 20` budget when using `sendShielded`.

### token.compact (1 circuit)

| Category | Circuits |
|----------|----------|
| Setup | constructor |
| Token | mint (`mintShieldedToken` + `sendShielded` to recipient) |
| Pure | deriveCommitment |

## Transaction Types

| Type | Propose | Execute | Description |
|------|---------|---------|-------------|
| 0 | proposeTransfer(coin, encData) | executeTransfer(txId, coinKey) | Transfer from vault to recipient. Encrypts (cpk, epk, amount) under vault key. |
| 2 | proposeAddSigner(commitment) | executeAddSigner(txId) | Add new signer |
| 3 | proposeRemoveSigner(commitment) | executeRemoveSigner(txId) | Remove signer (keeps count >= threshold) |
| 4 | proposeSetThreshold(value) | executeSetThreshold(txId) | Change approval threshold |

## Privacy Model

| Private (ZK / encrypted) | Public (on-chain) |
|--------------------------|-------------------|
| Signer identity — secret never leaves browser | Signer commitments (hashes, not linked to wallet identity) |
| Who approved which transaction (nullifiers are unlinkable) | Approval count per transaction |
| Transfer recipient + amount (AES-GCM encrypted, signers with vault key decrypt) | Threshold value |
| Shielded coin ownership (Zswap) | Vault coin values (visible as coin value on-chain) |
| Deposit source (shielded UTXO unlinkable) | Transaction types and statuses |
| Which signer executed | Contract address |

## Encrypted proposal layout

Stored in `txData0-3` (4 × 32 bytes = 128 bytes). `txData0` is repurposed from the original `dataHash` slot — the circuit doesn't verify it for Transfer txs.

- Plaintext: `recipientCpk(32) + recipientEpk(32) + amount(16)` = 80 bytes
- AES-256-GCM ciphertext: 96 bytes + 12 IV = 108 bytes
- Spread across 4 chunks (enc0 carries IV + first 20 ct bytes; enc3 has 20 bytes padding)

On decryption, `TransactionsTab` rebuilds the full `mn_shield-addr_...` via the `ShieldedAddress` codec using both keys.

## Key Files

| File | Purpose |
|------|---------|
| `contract/src/mpay.compact` | Main multisig contract (9 circuits, 17 ledger fields) |
| `contract/src/token.compact` | Custom shielded token (`mintShieldedToken`) |
| `contract/src/witnesses.ts` | Witness functions (`localSecret`, `transferRecipient`, `transferAmount`) |
| `api/src/index.ts` | MPayAPI (deploy/join, propose/approve/execute) |
| `api/src/crypto.ts` | AES-256-GCM proposal encryption (4×32 ciphertext chunks) |
| `api/src/token-api.ts` | TokenAPI (deploy/mint/join) |
| `web/src/providers.ts` | DApp connector setup + zkConfigProvider Proxy (ADR-006) |
| `web/src/App.tsx` | Top-level routing, wallet connect, tx stage tracking |
| `web/src/components/` | UI: Deposit, Propose, Transactions, Setup, Dashboard |

## Further reading

- `docs/DESIGN_NOTES.md` — design trade-offs, UX features, backup keys, known limitations
- `docs/SHIELDED_TOKEN_STATUS.md` — shielded-ops investigation timeline (error 186, recipient notification)
- `docs/adr/` — ADRs with full context for each design decision
