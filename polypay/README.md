# PolyPay — Private Multisig Wallet on Midnight

A privacy-preserving multisig wallet built on the **Midnight blockchain (Preprod network)**. Signers are identified by ZK commitments (hash of secret), not public keys. Nobody on-chain can tell which signer approved which transaction.

## Prerequisites

### Node.js

Node.js >= 20 required.

### Compact Compiler

Install the Midnight Compact compiler v0.30.0. Follow the [official guide](https://docs.midnight.network/getting-started/installation/).

### Docker Desktop (Proof Server)

The proof server runs in Docker and generates ZK proofs locally.

**Mac users: you MUST use Docker VMM, not Apple Virtualization framework.** The proof server will crash or hang under Apple Virtualization.

To switch:
1. Open Docker Desktop → Settings → General
2. Under "Virtual Machine Options", select **Docker VMM**
3. Apply & Restart Docker

Start the proof server:

```bash
docker run -p 6300:6300 midnightntwrk/proof-server:8.0.3 -- midnight-proof-server -v
```

Verify it's running: `curl http://127.0.0.1:6300/health` should respond.

### Midnight Lace Wallet

1. Install [Midnight Lace Wallet](https://chrome.google.com/webstore/detail/midnight-lace) Chrome extension
2. Create or restore a wallet
3. Switch network to **Preprod**
4. Configure proof server:
   - Open Lace → Settings → Proof Server
   - Set URI to `http://127.0.0.1:6300`
5. Get tNight tokens from the [faucet](https://faucet.preprod.midnight.network/)
6. Wait for DUST tokens to be generated automatically (takes ~1-2 minutes after receiving tNight)

## Setup & Run

```bash
# 1. Install dependencies
cd polypay
npm install

# 2. Compile both contracts (generates ZK proving/verifying keys)
cd contract
npm run compact
npm run build
cd ..

# 3. Start web UI (auto-copies ZK keys to web/public/)
cd web
npm run dev
```

Open http://localhost:5173 in Chrome with Lace wallet installed.

> **Note:** `npm run dev` automatically copies ZK keys from both contracts (`polypay` + `token`) into `web/public/keys/` and `web/public/zkir/`. No manual copy needed.

## Usage Guide

### 1. Connect Wallet

- Click "Connect Wallet" — Lace popup will ask to connect
- First connection: Lace asks you to sign a message to derive your signer secret
- Secret is saved to localStorage and reused on subsequent visits

### 2. Deploy Token

- Go to Token page → Deploy Token (creates the token contract)
- Mint tokens to your own address (you'll need these to deposit into the vault)

### 3. Deploy Multisig

> **Important:** You must deploy the token first (step 2) and copy its **token color** from the Token page. The multisig contract needs this color to know which token the vault holds.

This is a 3-phase process (see [ADR-003](docs/adr/003-multisig-setup-phase.md) for why):

1. **Deploy** — paste token color, set threshold → you become the first signer
2. **Init Signers** — add other signers by their commitment (they share it with you off-chain)
3. **Finalize** — locks the contract, clears deployer privilege

### 4. Deposit

- Any user can deposit native tokens into the vault
- No signer authentication needed for deposits

### 5. Propose → Approve → Execute

- **Propose**: any signer creates a proposal (auto-approves, count starts at 1)
- **Approve**: other signers approve (nullifier prevents double-vote)
- **Execute**: any signer triggers execution when approvals >= threshold

## Architecture

```
polypay/
├── contract/   Compact smart contracts (polypay.compact + token.compact)
├── api/        PolyPayAPI + TokenAPI
├── web/        React + Vite + Tailwind + Lace DApp Connector
└── docs/       ADRs and design specs
```

### polypay.compact (15 circuits)

| Category | Circuits |
|----------|----------|
| Setup | constructor, initSigner, finalize |
| Token | deposit |
| Propose | proposeTransfer, proposeAddSigner, proposeRemoveSigner, proposeSetThreshold |
| Approve | approveTx |
| Execute | executeTransfer, executeAddSigner, executeRemoveSigner, executeSetThreshold |
| Pure | deriveCommitment, computeNullifier |

### token.compact (3 circuits)

| Category | Circuits |
|----------|----------|
| Setup | constructor |
| Token | mint |
| Pure | deriveCommitment |

### Protocol Flow

```
SETUP PHASE
  1. Deploy(threshold, tokenColor) — creates contract, deployer = first signer
  2. initSigner(commitment)        — owner adds other signers (repeat)
  3. finalize()                    — locks contract, clears owner

TOKEN (separate token.compact contract)
  - mint(amount, to)               — mint tokens to a user address

OPERATIONAL PHASE
  4. deposit(amount)               — deposit native tokens into vault (no auth)
  5. propose*(...)                 — signer creates proposal, auto-approves (count=1)
  6. approveTx(txId)               — other signers approve (nullifier prevents double-vote)
  7. execute*(txId)                — signer executes when approvals >= threshold
```

### Transaction Types

| Type | Propose | Execute | Description |
|------|---------|---------|-------------|
| 0 | proposeTransfer(to, amount) | executeTransfer(txId) | Transfer from vault to recipient |
| 2 | proposeAddSigner(commitment) | executeAddSigner(txId) | Add new signer |
| 3 | proposeRemoveSigner(commitment) | executeRemoveSigner(txId) | Remove signer (keeps count >= threshold) |
| 4 | proposeSetThreshold(value) | executeSetThreshold(txId) | Change approval threshold |

### Privacy Model

| What's Private (ZK protected) | What's Public (on-chain) |
|-------------------------------|--------------------------|
| Signer identity (secret never leaves browser) | Signer commitments (hashes, not linked to identity) |
| Who approved which transaction (nullifiers are unlinkable) | Approval count per transaction |
| Signer's secret key | Transfer amounts and recipients |
| Which signer executed a transaction | Transaction types and statuses |
| | Threshold value |
| | Token vault balance |

## What's Done

### Features

- Full multisig lifecycle: deploy → init signers → finalize → propose → approve → execute
- 4 transaction types: transfer, add signer, remove signer, set threshold
- Separate token contract for minting
- Deposit native tokens into vault
- Web UI: dashboard, identity card, signer list, transaction list, token page
- Secret persistence in localStorage with auto-rejoin on reload
- Session persistence (contract address saved, reconnects automatically)

### Design Trade-offs

| What we built | What we excluded | Why |
|---------------|-----------------|-----|
| Full multisig (15 circuits) | Batch initSigner | Midnight circuit limit ~13 per deploy tx. Compact has no dynamic-length params. ([ADR-003](docs/adr/003-multisig-setup-phase.md)) |
| deposit (receiveUnshielded) | withdraw circuit | Removed to fit circuit limit after adding signer checks to execute circuits. ([ADR-001](docs/adr/001-witness-required-for-execute-circuits.md)) |
| Signer privacy via commitment/nullifier | Shielded transfers (hidden amounts) | Amount/recipient are public. Shielded token system is significantly more complex, out of MVP scope. |
| Execute requires signer proof | Anyone-can-execute | Compact compiler produces invalid proofs for witness-free circuits with complex cross-map writes. Adding witness fixed it and improved security. ([ADR-001](docs/adr/001-witness-required-for-execute-circuits.md)) |
| Secret from signData + localStorage | Deterministic derivation from wallet | BIP-340 Schnorr signatures are non-deterministic. HD seed is inaccessible from dApp connector. ([ADR-002](docs/adr/002-signer-secret-persistence.md)) |
| 3-phase setup (deploy/init/finalize) | Single-transaction deploy | Circuit limit + no variable-length constructor params in Compact. ([ADR-003](docs/adr/003-multisig-setup-phase.md)) |
| Token metadata on-chain (name, symbol) | Off-chain metadata server | No metadata server infra yet. On-chain works for testing. Will migrate later. ([ADR-004](docs/adr/004-token-metadata-strategy.md)) |
| Threshold public on ledger | Hidden threshold (hash + salt) | Threshold leaks via execution pattern regardless. Hiding adds salt-sharing complexity for no long-term privacy gain. ([ADR-005](docs/adr/005-threshold-privacy-analysis.md)) |

## What's Pending

- **Shielded transfers** — hide transfer amounts and recipients using shielded token system
- **Off-chain token metadata** — migrate from on-chain storage to Midnight metadata server ([ADR-004](docs/adr/004-token-metadata-strategy.md))
- **Export/import secret** — backup and restore signer identity across browsers
- **Unit tests** — contract-level tests (examples have tests, polypay does not yet)
- **Off-chain signer coordination** — channel for sharing commitments between signers
- **Withdraw circuit** — re-add if circuit count can be reduced elsewhere
- **localStorage namespace** — storage keys are global (`polypay:secret`), not scoped by network or wallet. Switching wallets or networks on the same browser will overwrite the previous session
- **Vault balance display** — `unshieldedBalancesObservable` (SDK) and direct GraphQL `contractAction.unshieldedBalances` both return `[]` for the contract address after `receiveUnshielded()`. Suspected SDK/indexer bug on Preprod. Vault balance currently shows "0" in the UI despite successful deposits. Workaround: pending upstream fix or alternative query method

## Dependencies

| Component | Version |
|-----------|---------|
| Compact Compiler | 0.30.0 |
| Compact Runtime | 0.15.0 |
| Midnight JS SDK | 4.0.2 |
| DApp Connector API | 4.0.1 |
| Proof Server | 8.0.3 |
| React | 19.x |
| Vite | 7.x |
| Tailwind CSS | 4.x |
| TypeScript | 5.x |
