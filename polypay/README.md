# PolyPay — Private Multisig Wallet on Midnight

A privacy-preserving multisig wallet built on the Midnight blockchain. Signers are identified by ZK commitments (hash of secret). Nobody on-chain knows which signer approved what.

## Features

- **Private signer identity** — signers prove membership via ZK proofs, not public keys
- **Multisig proposals** — propose transfers, signer changes, threshold updates
- **Anti double-approve** — nullifier pattern prevents same signer approving twice
- **Signer-only execute** — only registered signers can execute approved transactions
- **Web UI** — React + Vite with Lace wallet DApp Connector

## Architecture

```
polypay/
├── contract/   Compact smart contract (12 circuits)
├── api/        Shared PolyPayAPI class
├── web/        React + Vite + Lace DApp Connector
└── docs/       ADRs and design specs
```

## Contract Circuits (12)

**Setup:** constructor, initSigner, finalize
**Token:** mint
**Propose:** proposeTransfer, proposeAddSigner, proposeRemoveSigner, proposeSetThreshold
**Approve:** approveTx
**Execute:** executeTransfer, executeAddSigner, executeRemoveSigner, executeSetThreshold
**Pure:** deriveCommitment, computeNullifier

## Flow

```
SETUP PHASE
  1. Deploy(threshold)     — creates contract, deployer = first signer
  2. initSigner(commitment) — owner adds other signers (repeat)
  3. finalize()            — locks contract, clears owner

OPERATIONAL PHASE
  4. mint(amount)          — add tokens to vault (no auth needed)
  5. propose*(...)         — signer creates proposal, auto-approves (count=1)
  6. approveTx(txId)       — other signers approve (nullifier prevents double-vote)
  7. execute*(txId)        — signer executes when approvals >= threshold
```

## Transaction Types

| Type | Propose | Execute | Description |
|------|---------|---------|-------------|
| 0 | proposeTransfer(to, amount) | executeTransfer(txId) | Transfer from vault to recipient |
| 2 | proposeAddSigner(commitment) | executeAddSigner(txId) | Add new signer |
| 3 | proposeRemoveSigner(commitment) | executeRemoveSigner(txId) | Remove signer (keeps count >= threshold) |
| 4 | proposeSetThreshold(value) | executeSetThreshold(txId) | Change approval threshold |

## Prerequisites

- [Midnight Lace Wallet](https://chrome.google.com/webstore/detail/midnight-lace) browser extension
- tNight tokens on preprod network (get from faucet)
- DUST tokens (generated automatically from tNight)
- Docker running proof server on port 6300

## Quick Start

```bash
# Install dependencies
cd polypay
npm install

# Compile contract (generates ZK keys)
cd contract
npm run compact
npm run build

# Run web UI
cd ../web
npm run dev
```

Open http://localhost:5173 in a browser with Lace wallet installed.

## Dependencies

- Compact runtime: 0.14.0
- Midnight JS SDK: 3.0.0
- DApp Connector API: 4.0.1
- React: 19.x, Vite: 7.x, TypeScript: 5.x

## Limitations

- Deploy limited to 12 circuits max (Midnight tx size constraint)
- Mint is public (testnet design) — max 65535 per call
- Secret stored in localStorage — lost if cleared
- No off-chain coordination — signers share commitments manually
- No time-locks or expiration on proposals
- Balances are public on ledger (Map)

## Known Issues

See `docs/adr/` for architectural decisions and workarounds.
