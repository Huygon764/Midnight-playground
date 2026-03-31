# ADR-004: Token Metadata Strategy -- On-Chain vs Off-Chain

**Date:** 2026-03-31
**Status:** Accepted (temporary, will migrate to off-chain)
**Context:** Midnight Token Metadata Specification, PolyPay token contract

## Problem

Token metadata (name, symbol, description, image) needs to be stored and displayed. Two approaches are available on Midnight.

## Options

### Option A: On-chain (current implementation)

Store `tokenName` and `tokenSymbol` as `Opaque<"string">` in the token contract ledger. Set during constructor.

**Pros:**
- Simple, self-contained
- No external infrastructure needed
- Works for testing/demo

**Cons:**
- Contract doesn't use name/symbol in any logic -- purely metadata bloat
- Adds constructor parameters and ledger fields that serve no on-chain purpose
- Lace wallet and other DApps won't read metadata from contract ledger -- they use the metadata server
- Immutable after deploy (can't update name without redeploying)

### Option B: Off-chain metadata server (Midnight standard)

Submit a JSON metadata file to the Midnight metadata repository. DApps and wallets query via GraphQL API.

```json
{
  "type": "token",
  "subject": "<token-color-hex>",
  "contract_address": "<contract-address-hex>",
  "domain_separator": "polypay:token:",
  "shielded": false,
  "ticker": "POLY",
  "name": "PolyPay Token",
  "version": 1,
  "signatures": [{ "signature": "...", "public_key": "..." }],
  "decimals": 0
}
```

**Pros:**
- Follows Midnight ecosystem standard
- Lace wallet will display correct name/ticker/image
- Can update metadata without redeploying contract
- Contract stays minimal -- only logic, no metadata

**Cons:**
- Requires metadata server infrastructure (or access to Midnight's official server)
- Need to sign metadata with Schnorr/secp256k1
- More complex submission process (canonicalize JSON, sign, submit to repo)

## Decision

**Current (testing phase):** Keep name/symbol on-chain for convenience. The contract constructor takes `name` and `symbol` parameters. This works for testing without needing external infrastructure.

**Future (production):** Migrate to off-chain metadata:
1. Remove `tokenName`/`tokenSymbol` from contract -- constructor takes no args
2. After deploy, generate metadata JSON with contract address + token color
3. Sign and submit to Midnight metadata repository
4. UI reads metadata from GraphQL API instead of contract state

## Migration checklist (when ready)

- [ ] Remove `tokenName`/`tokenSymbol` from `token.compact`
- [ ] Update constructor to take no parameters
- [ ] Create metadata JSON generator script
- [ ] Implement Schnorr signing for metadata
- [ ] Submit to metadata server
- [ ] Update UI to query metadata server via GraphQL
- [ ] Determine official metadata server endpoint for testnet/mainnet (ask Midnight team)
