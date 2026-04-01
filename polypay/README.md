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
├── contract/   Compact smart contracts (polypay.compact + token.compact)
├── api/        PolyPayAPI + TokenAPI
├── web/        React + Vite + Tailwind + Lace DApp Connector
└── docs/       ADRs and design specs
```

## Contracts

### polypay.compact (15 circuits)

**Setup:** constructor, initSigner, finalize
**Token:** deposit
**Propose:** proposeTransfer, proposeAddSigner, proposeRemoveSigner, proposeSetThreshold
**Approve:** approveTx
**Execute:** executeTransfer, executeAddSigner, executeRemoveSigner, executeSetThreshold
**Pure:** deriveCommitment, computeNullifier

### token.compact (3 circuits)

**Setup:** constructor
**Token:** mint
**Pure:** deriveCommitment

## Flow

```
SETUP PHASE
  1. Deploy(threshold, tokenColor) — creates contract, deployer = first signer
  2. initSigner(commitment)        — owner adds other signers (repeat)
  3. finalize()                    — locks contract, clears owner

TOKEN (separate token.compact contract)
  - mint(amount, to)               — mint tokens to a user address

OPERATIONAL PHASE
  4. deposit(amount)               — deposit native tokens into vault (no auth needed)
  5. propose*(...)                 — signer creates proposal, auto-approves (count=1)
  6. approveTx(txId)               — other signers approve (nullifier prevents double-vote)
  7. execute*(txId)                — signer executes when approvals >= threshold
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

- Compact runtime: 0.15.0
- Midnight JS SDK: 4.0.2
- DApp Connector API: 4.0.1
- React: 19.x, Vite: 7.x, Tailwind: 4.x, TypeScript: 5.x

## Limitations

- Deploy limited to 13 circuits max (Midnight tx size constraint)
- Deposit is public (no auth needed) — uses receiveUnshielded
- Mint via token contract is public — uses mintUnshieldedToken
- Secret stored in localStorage — lost if cleared
- No off-chain coordination — signers share commitments manually
- No time-locks or expiration on proposals
- Transfer amounts and recipients are public on ledger
- Token vault balance is public (native token ledger)

## Known Issues

See `docs/adr/` for architectural decisions and workarounds.
