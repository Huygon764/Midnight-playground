# Midnight Playground

A progressive collection of 5 example projects for learning **Compact smart contract language** on the **Midnight blockchain**, plus **PolyPay** — a privacy-preserving multisig wallet.

## PolyPay

| Project | Description | Components |
|---------|-------------|------------|
| [polypay](polypay/) | Private multisig wallet — signers identified by ZK commitments, anonymous approvals via nullifiers | Contract (15 circuits) + Token Contract + API + Web UI |

## Examples

| # | Name | Concepts | Components |
|---|------|----------|------------|
| 01 | [simple-counter](examples/01-simple-counter/) | Counter ADT, impure circuits, compile output | Contract + Test + CLI |
| 02 | [secret-counter](examples/02-secret-counter/) | Witness, persistentHash, owner authentication | Contract + Test + CLI |
| 03 | [private-voting](examples/03-private-voting/) | HistoricMerkleTree, commitment/nullifier, Set, disclose, domain separator | Contract + Test + CLI + Web |
| 04 | [private-token](examples/04-private-token/) | Contract token, Map balances, transfer with ZKP, Opaque type | Contract + Test + CLI + Web |
| 05 | [payroll-lite](examples/05-payroll-lite/) | Full commit/nullifier flow, resetHistory, employer/employee roles | Contract + Test + CLI + Web |

## Prerequisites

- [Compact compiler](https://docs.midnight.network/) v0.30.0
- Node.js >= 18
- Docker (for proof server)
- [Lace wallet](https://www.lace.io/) Chrome extension (for Web UI)

## Quick Start

```bash
# Enter any example
cd examples/01-simple-counter

# Install dependencies
npm install

# Compile contract
cd contract && npm run compact && cd ..

# Run unit tests (offline, no chain needed)
cd test && npx vitest run && cd ..
```

## On-Chain Deployment

```bash
# Start proof server (Docker required)
docker run -p 6300:6300 midnightntwrk/proof-server:8.0.3 -- midnight-proof-server -v

# Run CLI (fund wallet via https://faucet.preprod.midnight.network/)
cd cli && npm run cli
```

## Web UI (Examples 3-5)

```bash
cd web && npm install && npm run dev
# Open http://localhost:5173 with Lace wallet extension
```

## Architecture

Each example follows a 3-layer architecture:

```
On-chain (Public Ledger)     ZK Circuit (Prove/Verify)     Off-chain (Private)
-----------------------     -------------------------     -------------------
Ledger fields               Arithmetic circuit            Secret data (LevelDB)
Verifying key               Proving key + ZKIR            Witness functions
Nullifier set               Proof server (local)          Private state
Commitment tree root        Generated TypeScript API      User's secret key
```

## Compatibility

| Component | Examples | PolyPay |
|-----------|----------|---------|
| Compact Compiler | 0.30.0 | 0.30.0 |
| Compact Runtime | 0.15.0 | 0.15.0 |
| Proof Server | 8.0.3 | 8.0.3 |
| Midnight JS SDK | 3.0.0 | 4.0.2 |
| Network | Preprod | Preprod |

## Reference Repos

- [example-counter](https://github.com/midnightntwrk/example-counter)
- [example-bboard](https://github.com/midnightntwrk/example-bboard)
- [example-hello-world](https://github.com/midnightntwrk/example-hello-world)

## Test Results

All 45 tests pass across 5 examples:

| Example | Tests |
|---------|-------|
| 01-simple-counter | 7/7 |
| 02-secret-counter | 8/8 |
| 03-private-voting | 11/11 |
| 04-private-token | 8/8 |
| 05-payroll-lite | 11/11 |
