# ADR-004: Token Metadata Strategy -- No Standard Exists on Midnight

**Date:** 2026-03-31 (superseded 2026-04-17)
**Status:** Superseded — initial plan (on-chain metadata) was dropped after finding Midnight has no metadata standard at all
**Context:** Midnight ledger-v8 8.0.3, dapp-connector-api 4.0.1, Lace wallet

## Problem

Custom shielded tokens should display a name/symbol in the user's wallet. MPay's vault token should appear as "POLY" or similar, not as an unnamed hash.

## Original decision (2026-03-31) — dropped

The original ADR proposed storing `tokenName` and `tokenSymbol` as `Opaque<"string">` fields in the token contract ledger, set via constructor. Plan was to migrate to an off-chain Midnight metadata server once infrastructure was available.

## Actual state (2026-04-17)

After implementing the shielded token flow with `mintShieldedToken`, we investigated how Lace displays token names and found:

1. **No on-chain metadata standard exists on Midnight.** `ShieldedTokenType` is identified by a 32-byte `RawTokenType` hash derived from `rawTokenType(domain_separator, contract_address)`. There are no `name`/`symbol`/`decimals`/`metadata` fields anywhere in:
   - `@midnight-ntwrk/ledger-v8` types
   - `@midnight-ntwrk/compact-runtime`
   - `@midnight-ntwrk/dapp-connector-api`
2. **Lace wallet hardcodes an allowlist.** Only NIGHT and tDUST have display names. Every other shielded token falls back to `"Shielded unnamed token (<prefix…suffix>)"`. Lace does not read from any registry at runtime.
3. **No token-list registry exists.** An [official forum thread](https://forum.midnight.network/t/will-there-be-standard-token-naming-conventions-on-midnight/1045) asking about this is open with zero team replies.
4. **Compact stdlib offers no metadata primitive.** `mintShieldedToken(domain, amount, nonce, recipient)` takes a 32-byte `domain` used as hash pre-image; it cannot carry a display string and the domain is not recoverable from the resulting `tokenColor`.

## Decision

Do nothing on-chain. Display the token name (`POLY`) inside the MPay dApp UI only. Lace will always show "Shielded unnamed token (...)" for custom shielded tokens until Midnight ships a metadata standard.

- `token.compact` contains no `tokenName` / `tokenSymbol` fields
- Constructor takes no metadata arguments
- The dApp's UI hardcodes `POLY` as the display label for vault POLY tokens

## Why not implement a local registry?

Options we considered and rejected:

- **Bundle a token-list in the dApp**: keeps the name correct inside MPay but doesn't help users who check Lace. Also requires us to re-deploy dApp to update.

## Consequences

- Users see "POLY" in MPay and "Shielded unnamed token (...)" in Lace. Acceptable for hackathon; confusing for production.
- When Midnight ships a token metadata standard (forum thread, NMKR community, or otherwise), MPay should adopt it and re-visit this ADR.
- If the dApp ever supports multiple custom tokens, the hardcoded `POLY` label needs to become configurable per-token.

## References

- Forum: [Will there be standard token naming conventions on Midnight?](https://forum.midnight.network/t/will-there-be-standard-token-naming-conventions-on-midnight/1045)
- [Lace wallet | Midnight Docs](https://docs.midnight.network/develop/how-to/lace-wallet)
- Local: `@midnight-ntwrk/ledger-v8/ledger-v8.d.ts` (`ShieldedTokenType` definition, lines 39–62)
