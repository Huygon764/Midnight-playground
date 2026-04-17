# ADR-003: Why Multisig Requires a Three-Phase Setup

**Date:** 2026-03-31 (updated 2026-04-17)
**Status:** Accepted
**Context:** Midnight Compact runtime 0.15.0, PolyPay contract (originally 12 impure circuits, now 9 after unifying propose variants)

## Problem

Ideally, deploying a multisig wallet would be a single transaction:

```
deploy(threshold, tokenColor, [commitment_A, commitment_B, commitment_C])
```

Instead, PolyPay requires three phases:

1. **Deploy** -- `constructor(threshold)` creates contract, adds deployer as first signer
2. **Init Signers** -- `initSigner(commitment)` called once per additional signer
3. **Finalize** -- `finalize()` locks the contract for operations

Why can't we do it in one step?

## Constraints

### 1. Midnight deploy transaction size limit (~12-13 circuits) (Based on testing)

**Note:** Midnight documentation does not officially document a circuit count limit per contract. This limit was discovered empirically -- deploying a contract with 13 impure circuits failed with a transaction submission error. Through trial and error, we determined the practical ceiling is ~12-13 circuits per deploy transaction.

Each impure circuit compiles to a proving key (~5MB) and verification key. All circuit keys must be included in the deploy transaction. The node rejects deploy transactions that exceed an undocumented size threshold.

PolyPay now has **9 impure circuits** -- reduced from the original 12 by unifying the four propose circuits into one generic `propose(txType, d0, d1, d2, d3)`:

| Category | Circuits |
|----------|----------|
| Setup | `constructor`, `initSigner`, `finalize` |
| Token | `deposit` |
| Propose | `propose` (generic, txType selects variant) |
| Approve | `approveTx` |
| Execute | `executeTransfer`, `executeAddSigner`, `executeRemoveSigner`, `executeSetThreshold` |

Adding a batch `initSigners(commitments[])` circuit would push past the limit. We already had to **remove the `withdraw` circuit** (see ADR-001) and **collapse four propose circuits into one** to stay under ~12.

### 2. Compact does not support variable-length constructor parameters

The constructor signature is:

```compact
constructor(initialThreshold: Uint<8>, color: Bytes<32>)
```

Compact circuit parameters must have fixed types known at compile time. There is no way to pass a dynamic-length list of commitments. Options would be:

- **Fixed-size vector** `Vector<N, Bytes<32>>` -- N must be a compile-time constant (e.g., max 5 signers). Reduces flexibility and wastes proof computation for unused slots.
- **Multiple parameters** `(c1: Bytes<32>, c2: Bytes<32>, ...)` -- hard-codes max signer count into the circuit, increases proving key size for every deploy regardless of actual signer count.

### 3. ZK proof size scales with circuit complexity

Each signer addition requires:
- Writing to the `signers` map
- Incrementing `signerCount`
- Verifying no duplicates

Batching N signer additions into one circuit multiplies the constraint count. A circuit that handles up to 10 signers would have 10x the constraints of a single `initSigner`, producing a proportionally larger proving key and slower proof generation -- even when adding just 1 signer.

## Decision

Keep the three-phase setup: deploy → initSigner (repeated) → finalize.

### Why `finalize` is necessary

The `finalize` circuit serves as a state transition gate:

- **Validates readiness** -- asserts `signerCount >= threshold`
- **Locks setup** -- sets `finalized = true`, all operational circuits require `assert(finalized == true)`
- **Clears owner** -- removes deployer's privileged role, preventing unilateral changes
- **Prevents re-initialization** -- `assert(finalized == false)` at entry

Without finalize, the deployer could keep adding/removing signers indefinitely, bypassing the multisig governance they're supposed to enable.

## Trade-offs

| Aspect | One-step deploy | Three-phase setup |
|--------|----------------|-------------------|
| UX | Single transaction | Multiple transactions (3+N) |
| Flexibility | Fixed max signers | Unlimited signers |
| Proof size | Large (handles max case) | Small (one signer per proof) |
| Circuit count | +1 circuit (may exceed limit) | Uses existing circuits |
| Security | Owner has no special phase | Owner controls setup, then locks |

## Future Considerations

- If Midnight raises the circuit limit or supports circuit lazy-loading, a batch `initSigners` could be reconsidered
- If Compact adds support for variable-length parameters, the constructor could accept a commitment list
- The setup phase is a one-time cost per vault -- operational phase has no overhead from this design
