# ADR-002: Signer Secret Cannot Be Deterministically Derived from Wallet

**Date:** 2026-03-31
**Status:** Accepted
**Context:** Midnight Lace Wallet dApp Connector API 4.0.1, BIP-340 Schnorr Signatures

## Problem

Each MPay signer needs a 32-byte secret to derive their on-chain commitment via `deriveCommitment(secret)`. The secret must be consistent across sessions -- if the secret changes, the commitment changes, and the signer loses access to their multisig role.

We explored deriving the secret deterministically from the wallet so users never need to store it.

## Approaches Investigated

### 1. Sign a fixed message, hash the signature

```
signData("MPay Signer Identity", { encoding: "text", keyType: "unshielded" })
→ SHA-256(signature) → 32-byte secret
```

**Result: Non-deterministic.** BIP-340 Schnorr signatures use auxiliary randomness for side-channel protection. Same message + same private key = different signature each time. Confirmed by testing: reconnecting the same wallet produces a different secret.

### 2. HD wallet key derivation (`@midnight-ntwrk/wallet-sdk-hd`)

```
HDWallet.fromSeed(seed).selectAccount(0).deriveKeysAt(0) → deterministic key
```

**Result: Not possible from browser dApp.** The `wallet-sdk-hd` package requires the raw HD seed. The Lace wallet extension holds the seed internally and the dApp Connector API does not expose it. This is by design -- exposing seeds to dApps would be a critical security risk.

### 3. Use wallet public key as secret

The `verifyingKey` from `signData()` or `shieldedCoinPublicKey` from `getShieldedAddresses()` are deterministic. But they are **public** -- anyone who knows the public key could compute the secret and impersonate the signer.

## Decision

Generate the secret via `signData` on first connection, then **persist it in localStorage**. The secret is never cleared on disconnect -- only the contract address is cleared.

### Flow

| Event | Secret | Contract Address |
|-------|--------|-----------------|
| First connect | `signData` → SHA-256 → save to localStorage | - |
| Reload / reconnect | Load from localStorage | Load from localStorage → auto-rejoin |
| Disconnect | **Kept** | Cleared |
| Browser data cleared | Lost (sign again → new secret → new identity) | Lost |

### Why still use `signData` for initial generation?

Even though the signature is non-deterministic, using `signData` instead of `crypto.getRandomValues()` provides a UX benefit: the user explicitly authorizes identity creation through a wallet popup, making the action visible and intentional.

## Trade-offs

- User must not clear browser storage, or they lose their signer identity
- If identity is lost, other signers must propose removing the old commitment and adding the new one
- Future improvement: export/import secret functionality (already shown in UI via IdentityCard)
- If Midnight adds a `deriveAppKey(appId)` method to the connector API in the future, this decision should be revisited

## Addendum: Unified Secret Across Contracts (2026-04-01, revised 2026-04-17)

The same 32-byte secret is used for both the MPay and token contracts. Both contracts define `deriveCommitment(secret)` using `persistentHash`.

**Current state (2026-04-17):** both contracts use the **same domain separator** `"mpay:pk:"`. This means `deriveCommitment(secret)` produces the **same 32-byte commitment** on both chains — a signer's commitment on the token contract is identical to their commitment on the multisig. An on-chain observer can link actions across the two contracts by matching commitment values.

This is an accepted trade-off for the hackathon scope:

- Signer commitments aren't themselves linked to any wallet identity (the secret is browser-local, derived from `signData` output)
- The privacy gain from cross-contract separation is marginal — observers can often correlate actions via timing/amounts anyway
- Splitting into contract-specific commitments adds code without meaningful privacy benefit at this scale

**Future improvement:** if MPay adds more contracts or moves to production, use distinct domain separators per contract (e.g. `"mpay:multisig:pk:"` vs `"mpay:token:pk:"`) so commitments differ. This is a one-line change in each `deriveCommitment` circuit + re-deploy.
