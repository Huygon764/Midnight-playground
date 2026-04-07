---
name: Shielded kernel operations fail on proof server
description: receiveShielded, mintShieldedToken, sendShielded all return proof server 400 on every available proof server version - blocking all shielded token use
type: feedback
---

ALL shielded kernel operations fail with proof server HTTP 400 (Bad Request) on Midnight preprod. This blocks any use of shielded tokens in contracts.

**Operations tested and FAILED:**
- `receiveShielded(coin: ShieldedCoinInfo)` — even minimal circuit (just receiveShielded + counter increment) fails
- `mintShieldedToken(domain, amount, nonce, recipient)` — fails in token.compact mint circuit
- Adding `localSecret()` witness to force larger proving key does NOT help

**Proof servers tested (ALL fail):**
- `midnightntwrk/proof-server:8.0.3` (official, 133MB)
- `midnight-proof-server:full` (pre-baked params, 979MB)
- `meshsdk/midnight-proof-server:1.0.0` (195MB)

**Compiler versions tested:**
- Compact Toolchain 0.5.0 — fails
- Compact Toolchain 0.5.1 (compactc 0.30.0, latest) — still fails

**What DOES work:**
- `receiveUnshielded(color, amount)` — works fine
- `sendUnshielded(color, amount, recipient)` — works fine
- `mintUnshieldedToken(domain, amount, recipient)` — works fine
- All non-token circuits (propose, approve, execute signer ops) — work fine

**Environment:** Midnight preprod, Ledger 8.0.3, SDK 4.0.2, compact-runtime 0.15.0

**Why:** Unknown root cause. Compact 0.30.0 release notes mention fixes for shielded bugs (#107, #110, #117) but updating did not resolve. `insertCoin` (used in design spec) is NOT in the standard library docs. May be platform-level limitation on preprod.

**How to apply:** Use unshielded token operations only. Achieve privacy through encrypted proposals (AES-256-GCM vault key) + witness-based anonymous approval (nullifiers). Plan to report on https://forum.midnight.network when ready.
