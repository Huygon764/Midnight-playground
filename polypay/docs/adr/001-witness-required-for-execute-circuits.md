# ADR-001: Witness Required for Execute Circuits

**Date:** 2026-03-30
**Status:** Accepted
**Context:** Midnight Compact runtime 0.14.0, SDK 3.0.0

## Problem

All four execute circuits (`executeTransfer`, `executeAddSigner`, `executeRemoveSigner`, `executeSetThreshold`) failed at transaction submission with `SubmissionError: "Transaction submission failed"`. The node rejected the transaction with an empty cause. All other circuits (propose, approve, mint, initSigner, finalize) worked correctly.

## Investigation

Through systematic binary search (simplify circuit, deploy, test, add back):

| Test | Result |
|------|--------|
| Bare minimum: just `txStatuses.insert(txId, 1)` | WORKS |
| + full preamble (6 assertions, reads from 5 maps) | WORKS |
| + read 2 more maps (values unused) | WORKS |
| + read balances map (values unused) | WORKS |
| + compare 2 map-derived values (`vaultBal >= amount`) | WORKS |
| + `balances.insert(vaultAddr, f(vaultBal, amount))` | **FAILS** |
| Same as above but add `localSecret()` witness | **WORKS** |

## Root Cause

Witness-free circuits (no `localSecret()` call) that perform **write operations using values derived from map lookups** produce invalid proofs that the Midnight node rejects.

The Compact compiler generates a ~149KB proving key for witness-free circuits vs ~5MB for witness circuits. The smaller key appears insufficient for circuits with complex cross-map state operations (read value from Map A, write derived value to Map B).

Key evidence:
- `mint` (witness-free) works because its insert uses values from the **same** map + circuit parameters
- Execute circuits fail because they read from `txAmounts`/`txTargetSigners` and write to `balances`/`signers` (cross-map data flow)
- Adding `localSecret()` forces a larger proving key, resolving the issue

This is likely a bug or undocumented limitation in Compact runtime 0.14.0.

## Decision

Add signer verification (`localSecret` + `deriveCommitment` + `signers.member`) to all execute circuits. This:

1. **Fixes the proof generation issue** by forcing witness-based proving keys
2. **Improves security** — only registered signers can execute approved transactions
3. **Follows Midnight patterns** — all example contracts use witnesses for state-modifying circuits

## Trade-offs

- Execute circuits were originally callable by anyone (once threshold met). Now restricted to signers only. This is acceptable since signers have incentive to execute.
- Adding `deriveCommitment` (hash computation) to 4 circuits increased total deployment size. Required removing `withdraw` circuit to stay within Midnight's deploy transaction size limit (~12-13 circuits max).

## Circuit Count

Reduced from 13 to 12 impure circuits:

**Removed:** `withdraw` (personal transfer, not core to multisig)

**Modified (added signer check):**
- `executeTransfer`
- `executeAddSigner`
- `executeRemoveSigner`
- `executeSetThreshold`
