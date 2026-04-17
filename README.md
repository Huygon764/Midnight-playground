# M-pay — Private Multisig Wallet on Midnight

A privacy-preserving multisig wallet built on the **Midnight blockchain (Preprod network)**. Signers are identified by ZK commitments (hash of a local secret), not public keys. Nobody on-chain can tell which signer approved which transaction. Transfer recipient and amount are encrypted with a vault key shared among signers.

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

1. Install [Midnight Lace Wallet](https://chromewebstore.google.com/detail/lace/gafhhkghbfjjkeiendhlofajokpaflmk) Chrome extension
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
npm install

# 2. Compile contracts (generates ZK proving/verifying keys)
cd contract
npm run compact
npm run build
cd ..

# 3. Start web UI (auto-copies ZK keys to web/public/)
cd web
npm run dev
```

Open http://localhost:5173 in Chrome with Lace wallet installed.

> **Note:** `npm run dev` automatically copies ZK keys from `mpay` and `token` contracts into `web/public/keys/` and `web/public/zkir/`. No manual copy needed.

## Usage Guide

### 1. Connect Wallet

- Click "Connect Lace Wallet" — Lace popup asks to connect
- First connection: Lace asks you to sign a message to derive your signer secret
- Secret is saved to localStorage and auto-reconnects on future visits

### 2. Deploy or Reconnect Token

Go to the Token tab:

- **Deploy New** — creates a fresh shielded token contract (`mintShieldedToken`). You'll be shown a 32-byte `tokenColor` which identifies this token on-chain.
- **Reconnect Existing** — paste a previously deployed token contract address

Then mint tokens to any shielded address (paste `mn_shield-addr_...` or click "Use my shielded address").

> Midnight has no on-chain token metadata standard, so Lace wallet will show the token as "Shielded unnamed token (...)". The M-pay dApp labels it `MPAY`.

### 3. Setup Multisig

In the Setup tab:

- **Step 1: Deploy Shielded Token** — if you haven't deployed yet, the card routes you to the Token tab (skip this if you're joining an existing multisig)
- **Deploy Multisig** — paste the token color, set threshold, deploy. You become the first signer. The dApp generates a random **vault key** and stores it in localStorage. Share the hex vault key with co-signers out-of-band (copy from the dashboard card after deploy).
- **Join Existing** — paste the multisig contract address + import the vault key. The dApp checks you are a registered signer on-chain; otherwise join is rejected.

### 4. Add Signers + Finalize

Init-signers phase:

- Paste each co-signer's commitment (they generate it by connecting their own wallet and copy from Identity card)
- "Current Signers" card auto-refreshes after each add
- When `signerCount >= threshold`, click **Finalize** to lock the contract

### 5. Deposit

Deposit shielded MPAY from your wallet into the vault:

- Enter an amount (creates a new shielded coin with that value)
- The coin is sent into the vault keyed by a deposit counter
- After success the amount input clears automatically

### 6. Propose Transfer

- Paste recipient shielded address (`mn_shield-addr_...`) or click "Use my shielded address"
- Select a vault coin from the list (full-coin-spend, no partial amounts — Midnight budget constraint)
- Click Propose — dApp encrypts `(recipientCpk, recipientEpk, amount)` with the vault key and stores ciphertext in `txData0–3`

### 7. Approve + Execute

In the Transactions tab:

- Each tx shows type-specific details:
  - Transfer: recipient shielded address (decrypted) + amount, click to copy
  - Add/Remove signer: commitment hex, click to copy
  - Set threshold: new value
- Approvals column shows `approvals/threshold` (e.g. `2/3`)
- Signers click **Approve** (nullifier prevents double-vote) until count reaches threshold
- Once stamped **READY**, any signer can **Execute**

> **Recipient receives the coin only if they execute the transfer themselves.** `sendShielded` does not currently create coin ciphertexts for external wallets, so the recipient should be a signer who executes. See `docs/SHIELDED_TOKEN_STATUS.md`.

## Architecture

```
.
├── contract/   Compact smart contracts (mpay + token)
├── api/        MPayAPI + TokenAPI + AES-GCM proposal encryption
├── web/        React + Vite + Tailwind + Lace DApp Connector
└── docs/       ADRs + SHIELDED_TOKEN_STATUS
```

### mpay.compact (9 circuits)

| Category | Circuits |
|----------|----------|
| Setup | constructor, initSigner, finalize |
| Deposit | deposit |
| Propose | propose (generic, txType selects transfer/addSigner/removeSigner/setThreshold) |
| Approve | approveTx |
| Execute | executeTransfer, executeAddSigner, executeRemoveSigner, executeSetThreshold |
| Pure | deriveCommitment, computeNullifier |

### token.compact (1 circuit)

| Category | Circuits |
|----------|----------|
| Setup | constructor |
| Token | mint (`mintShieldedToken` + `sendShielded` to recipient) |
| Pure | deriveCommitment |

### Transaction Types

| Type | Propose | Execute | Description |
|------|---------|---------|-------------|
| 0 | proposeTransfer(coin, encData) | executeTransfer(txId, coinKey) | Transfer from vault to recipient. Encrypts (cpk, epk, amount) under vault key. |
| 2 | proposeAddSigner(commitment) | executeAddSigner(txId) | Add new signer |
| 3 | proposeRemoveSigner(commitment) | executeRemoveSigner(txId) | Remove signer (keeps count >= threshold) |
| 4 | proposeSetThreshold(value) | executeSetThreshold(txId) | Change approval threshold |

### Privacy Model

| Private (ZK / encrypted) | Public (on-chain) |
|--------------------------|-------------------|
| Signer identity — secret never leaves browser | Signer commitments (hashes, not linked to wallet identity) |
| Who approved which transaction (nullifiers are unlinkable) | Approval count per transaction |
| Transfer recipient + amount (AES-GCM encrypted, signers with vault key decrypt) | Threshold value |
| Shielded coin ownership (Zswap) | Vault coin values (visible as coin value on-chain) |
| Deposit source (shielded UTXO unlinkable) | Transaction types and statuses |
| Which signer executed | Contract address |

## Key Files

| File | Purpose |
|------|---------|
| `contract/src/mpay.compact` | Main multisig contract (9 circuits, 17 ledger fields) |
| `contract/src/token.compact` | Custom shielded token (`mintShieldedToken`) |
| `api/src/index.ts` | MPayAPI (deploy/join, propose/approve/execute) |
| `api/src/crypto.ts` | AES-256-GCM proposal encryption (4×32 ciphertext chunks) |
| `api/src/token-api.ts` | TokenAPI (deploy/mint/join) |
| `web/src/providers.ts` | DApp connector setup + zkConfigProvider Proxy (ADR-006) |
| `web/src/App.tsx` | Top-level routing, wallet connect, tx stage tracking |
| `web/src/components/` | UI: Deposit, Propose, Transactions, Setup, Dashboard |

## Design Trade-offs

| What we built | What we excluded | Why |
|---------------|------------------|-----|
| 9-circuit MPay + 1-circuit token | Separate proposeX for each tx type | Generic `propose(txType, d0-d3)` saved 3 circuits to stay under ~12 circuit deploy limit |
| Full-coin-spend executeTransfer | Partial-value transfers with change | `insertCoin`-on-change triggers Substrate error 186 above 15 ledger fields; MPay has 17 |
| 3-read executeTransfer | Hash verification of encrypted recipient | `fields + reads ≤ 20` when circuit uses `sendShielded` — removed hash check to fit budget |
| Vault key encryption (AES-GCM) for proposal data | Per-signer encryption (hybrid ECIES) | Per-signer needs 2 new ledger maps → pushes fields beyond executeTransfer budget |
| Recipient-as-executor model | Send coin ciphertexts to external wallets | `sendShielded` doesn't currently emit ciphertexts for external `ZswapCoinPublicKey` (Compact stdlib limitation) |
| On-dApp token name (`MPAY`) | On-chain name / symbol fields | Midnight has no metadata standard; Lace always shows "Shielded unnamed token (...)" for custom tokens |
| Vault key in localStorage, shared out-of-band | Threshold encryption / wallet-based decrypt | Wallet API doesn't expose decrypt; threshold crypto too heavy for hackathon |
| 3-phase setup (deploy → init → finalize) | Single-transaction deploy | Circuit limit + no variable-length constructor params |
| Secret from signData + localStorage | Deterministic wallet derivation | BIP-340 signatures non-deterministic; HD seed inaccessible ([ADR-002](docs/adr/002-signer-secret-persistence.md)) |
| Public threshold | Hidden threshold via hash+salt | Leaks anyway via approval/execution pattern ([ADR-005](docs/adr/005-threshold-privacy-analysis.md)) |

See `docs/adr/` for full context. `docs/SHIELDED_TOKEN_STATUS.md` has the shielded-ops investigation timeline (error 186, recipient notification, merged-propose attempt).

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

## Important — Back up your keys

MPay stores user-managed keys in browser `localStorage`. They are **not synced anywhere**. If you lose them (clear browser data, switch browsers, move to a new machine), you cannot recover them from the chain.

| Key | localStorage entry | Scope | Lost ⇒ |
|-----|-------------------|-------|--------|
| Signer secret | `mpay:secret` | Per browser | Your on-chain commitment is gone. Other signers must propose removing your old commitment and add your new one (derived from the new signed secret). |
| Vault key (AES-256-GCM) | `mpay:vault-key` | Per multisig | Encrypted proposal details (recipient + amount) become unreadable. Must be re-imported from a co-signer who still has it. |
| Multisig contract address | `mpay:contract` | Per multisig | Harmless — paste the address into "Join Existing" to reconnect. Cleared on Disconnect. |
| Token contract address | `mpay:token-contract` | Per token | Harmless — paste into Token tab "Reconnect Existing". |

**What to back up manually**:

1. **Signer secret** — IdentityCard in the Setup/Dashboard sidebar shows the 64-char hex. Copy and store somewhere safe (password manager, encrypted note). If this is lost and you weren't added under a new commitment, you permanently lose your signer role on that multisig.
2. **Vault key** — shown in the Dashboard card right after deploy and on subsequent visits. Copy the 64-char hex. Share it out-of-band with every co-signer. Each co-signer should also back up their own copy.

**What happens on Disconnect**:

The "Disconnect" button in the sidebar clears `mpay:contract` + `mpay:vault-key` but **keeps** `mpay:secret`. Next connect auto-restores your identity but requires re-joining a multisig (paste address + import vault key).

**Switching browsers / machines**:

A new browser generates a new secret on first connect (via wallet `signData`). That produces a **new commitment** — treated as a different signer by the multisig. Either:
- Copy `mpay:secret` from the old browser's localStorage before switching, or
- Have the existing signers propose/execute adding your new commitment on the new device.

## Pending / Known Limitations

- **Vault key sharing UX** — currently manual out-of-band. Per-signer encryption doesn't fit Midnight's field+read budget. Possible alternative: drop encryption (proposal details become public, like Safe).
- **Partial-value transfers** — not implemented. Would require ≤15 ledger fields + `insertCoin` on change; MPay has 17.
- **Recipient notification** — external wallets don't see coins sent by `sendShielded`. Workaround: recipient executes the transfer themselves. Fix is upstream (Midnight SDK / Compact stdlib).
- **Token metadata** — no name/symbol/decimals displayed in Lace. Midnight has no standard. Fix depends on wallet/chain changes.
- **localStorage namespace** — keys not scoped by network or wallet. Switching wallets on same browser overwrites state.
- **Contract-level unit tests** — MPay only tested end-to-end on preprod; no vitest suite.

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
