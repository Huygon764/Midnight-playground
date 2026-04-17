# M-pay

Privacy-preserving multisig wallet built on the **Midnight blockchain (Preprod)**. Signers are identified by ZK commitments (hash of a local secret); nobody on-chain can tell which signer approved which transaction. Transfer proposals are AES-GCM encrypted under a vault key shared among signers.

See [`m-pay/`](m-pay/) for the full project — contracts, API, Web UI, and detailed setup instructions.

## Quick Links

- [m-pay/README.md](m-pay/README.md) — setup, usage, architecture
- [docs/SHIELDED_TOKEN_STATUS.md](docs/SHIELDED_TOKEN_STATUS.md) — shielded-ops investigation timeline (error 186, recipient notification)
- [m-pay/docs/adr/](m-pay/docs/adr/) — ADRs documenting design decisions

## Prerequisites

- Compact compiler v0.30.0 — [install guide](https://docs.midnight.network/getting-started/installation/)
- Node.js >= 20
- Docker Desktop (for proof server)
- [Midnight Lace Wallet](https://chromewebstore.google.com/detail/lace/gafhhkghbfjjkeiendhlofajokpaflmk) Chrome extension

## Quick Start

```bash
# Start proof server
docker run -p 6300:6300 midnightntwrk/proof-server:8.0.3 -- midnight-proof-server -v

# Build & run M-pay
cd m-pay
npm install
cd contract && npm run compact && npm run build && cd ..
cd web && npm run dev
```

Open http://localhost:5173 with Lace wallet installed.

## Dependencies

| Component | Version |
|-----------|---------|
| Compact Compiler | 0.30.0 |
| Compact Runtime | 0.15.0 |
| Midnight JS SDK | 4.0.2 |
| Ledger | v8 |
| Proof Server | 8.0.3 |
| Network | Preprod |
