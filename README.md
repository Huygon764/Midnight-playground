# M-pay — Private Multisig Wallet on Midnight

A privacy-preserving multisig wallet built on the **Midnight blockchain (Preprod network)**. Signers are identified by ZK commitments (hash of a browser-local secret), not public keys. Nobody on-chain can tell which signer approved which transaction. Transfer recipient and amount are encrypted with a vault key shared among signers.

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

> **Recipient receives the coin only if they execute the transfer themselves.** `sendShielded` does not currently create coin ciphertexts for external wallets, so the recipient should be a signer who executes.

> **Important — back up your signer secret and vault key.** Browsers can lose state. See [docs/DESIGN_NOTES.md](docs/DESIGN_NOTES.md#back-up-your-keys).

## Known Limitations

- **Vault key must be shared out-of-band** — dApp generates one per multisig; deployer copies the hex and gives to co-signers. Per-signer encryption doesn't fit Midnight's circuit budget.
- **Partial-value transfers not supported** — Transfers spend a full vault coin. Deposit the exact amount you want to send.
- **Recipient must execute their own transfer** — `sendShielded` on Midnight currently doesn't notify external wallets. If the recipient isn't a signer, they won't see the coin after execute.
- **Token name invisible in Lace wallet** — Midnight has no on-chain token metadata standard. Lace shows custom tokens as "Shielded unnamed token (…)". The dApp labels it `MPAY`.
- **Browser-local state, no sync** — clearing localStorage or switching browser = new signer identity.
- **No on-chain unit tests** — tested end-to-end on preprod only.

Full context in [docs/DESIGN_NOTES.md](docs/DESIGN_NOTES.md#pending--known-limitations) and [docs/SHIELDED_TOKEN_STATUS.md](docs/SHIELDED_TOKEN_STATUS.md).

## Further reading

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — repo structure, contracts, transaction types, privacy model, key files
- [docs/DESIGN_NOTES.md](docs/DESIGN_NOTES.md) — design trade-offs, UX features, backup keys, known limitations
- [docs/SHIELDED_TOKEN_STATUS.md](docs/SHIELDED_TOKEN_STATUS.md) — shielded-ops investigation timeline (error 186, recipient notification)
- [docs/adr/](docs/adr/) — ADRs documenting individual design decisions

## Dependencies

| Component | Version |
|-----------|---------|
| Compact Compiler | 0.30.0 |
| Compact Runtime | 0.15.0 |
| Midnight JS SDK | 4.0.2 |
| DApp Connector API | 4.0.1 |
| Proof Server | 8.0.3 |
| Ledger | v8 |
| React | 19.x |
| Vite | 7.x |
| Tailwind CSS | 4.x |
| TypeScript | 5.x |
