# ADR-005: Why Threshold Remains Public on Ledger

**Date:** 2026-04-01
**Status:** Accepted
**Context:** MPay multisig contract, Compact runtime 0.15.0

## Problem

The `threshold` value (number of approvals required to execute a transaction) is stored as a public ledger field. Could we hide it to improve privacy?

## Investigation

### Approach: Store hash instead of plaintext

Replace `export ledger threshold: Uint<8>` with `export ledger thresholdHash: Bytes<32>`.

```
thresholdHash = hash("mpay:threshold:" + threshold + salt)
```

Signers know the threshold off-chain. Execute circuits would take threshold as witness input, compute the hash, and verify it matches the on-chain hash.

**Problem 1: Brute-force.** Threshold range is tiny (1-255, practically 1-10). Without salt, an observer tries all 255 values and finds the match instantly. A salt is required.

**Problem 2: Salt coordination.** Every signer needs the salt to construct ZK proofs. The salt must be shared off-chain when signers join. If any signer leaks the salt, threshold is revealed via brute-force.

**Problem 3: Salt rotation on threshold change.** When `executeSetThreshold` changes the threshold, a new salt is needed. But the new salt cannot be communicated on-chain (that would leak it). All signers must coordinate off-chain to learn the new salt before they can approve/execute any further transactions.

### Even with perfect implementation, threshold leaks via execution pattern

**Leak source 1: Approval count is observable.**

Each `approveTx(txId)` call is a visible on-chain transaction. Even without a public approval counter, an observer counts how many `approveTx` calls target the same `txId`. The nullifier set (`txNullifiers`) also grows by one per approval.

**Leak source 2: Execution timing reveals threshold.**

When `executeTransfer(txId)` succeeds, the observer knows: approval count at that moment >= threshold. After a few transactions, the exact threshold is determined.

Example:
- Tx #1: 3 approveTx calls → execute succeeds → threshold <= 3
- Tx #2: 2 approveTx calls → execute succeeds → threshold <= 2
- Tx #3: 1 approveTx call → execute fails, 2nd approveTx → execute succeeds → threshold = 2

### Could we hide approval count too?

To prevent counting approvals, we would need:
- **Hidden nullifiers** — but nullifiers must be public in the Set to prevent double-voting
- **Hidden circuit calls** — Midnight does not support this; all transaction types are visible on-chain
- **Batched execution** — combine approve + execute in one circuit so observer cannot distinguish. But this changes the protocol significantly and still leaks when multiple signers approve before execution.

## Decision

Keep `threshold` as a public ledger field. The privacy gain from hiding it is minimal because:

1. **Threshold is leaked by observable behavior** — approval count and execution timing reveal the exact value after a few transactions, regardless of on-chain storage
2. **Significant complexity cost** — salt generation, off-chain salt sharing, salt rotation on threshold change, additional witness parameters
3. **Fragile privacy** — a single leaked salt (from any signer) breaks threshold privacy via brute-force
4. **Low sensitivity** — threshold is governance metadata, not financial data. Knowing "this vault requires 2-of-3" is far less sensitive than knowing transfer amounts or signer identities

## Trade-offs

| Aspect | Hide threshold | Keep public |
|--------|---------------|-------------|
| Privacy | Hides value until first tx executes | Visible immediately |
| Complexity | Salt sharing + rotation + extra witness | Simple Uint<8> comparison |
| Robustness | Breaks if any signer leaks salt | No shared secret needed |
| Long-term privacy | Leaked after a few executions anyway | Already public |
| Circuit count | No change | No change |

## Future Considerations

- If Midnight adds support for **private circuit dispatch** (hiding which circuit was called), approval counting becomes harder and threshold privacy becomes more viable
- If Midnight adds **homomorphic operations on private state**, approvals could be accumulated without revealing individual votes
- These are protocol-level changes outside MPay's control
