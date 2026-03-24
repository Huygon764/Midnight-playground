# Example 05 - Payroll Lite

A privacy-preserving payroll system on Midnight using the commitment/nullifier pattern with `HistoricMerkleTree`. An employer commits salary amounts for employees; employees claim salaries without revealing who claims what amount to on-chain observers.

## Commitment / Nullifier Flow

The payroll system uses three core cryptographic primitives, each with a domain-separated hash:

1. **derivePublicKey(sk)** -- Derives a public key from a secret key.
   ```
   pubKey = hash("payroll:pk:" || sk)
   ```

2. **computeCommitment(pubKey, salary, period)** -- Creates a binding commitment tying a specific employee (by public key) to a salary amount for a given period.
   ```
   commitment = hash("payroll:commit:" || pubKey || salary || period)
   ```

3. **computeNullifier(sk, period)** -- Generates a unique nullifier per employee per period. This prevents double-claiming without revealing identity.
   ```
   nullifier = hash("payroll:null:" || sk || period)
   ```

### Flow

```
EMPLOYER                                      ON-CHAIN
  |                                             |
  |-- derivePublicKey(employerSk) ------------->| constructor: store employer pubkey
  |                                             | period = 1
  |                                             |
  |-- computeCommitment(empPubKey, sal, per) -->| commitSalary: insert into Merkle tree
  |   (for each employee)                       |
  |                                             |
  |                                             |
EMPLOYEE                                        |
  |                                             |
  |-- prove: I know sk where                    |
  |     pubKey = derivePublicKey(sk)             |
  |     commitment = computeCommitment(...)      |
  |     commitment is in Merkle tree             |
  |     nullifier = computeNullifier(sk, per)    |
  |     nullifier not in Set ------------------>| claimSalary: verify proof,
  |                                             |   insert nullifier, increment claimedAmount
  |                                             |
EMPLOYER                                        |
  |-- newPeriod() ----------------------------->| period++, resetHistory()
```

## HistoricMerkleTree vs MerkleTree

Midnight's Compact language provides two Merkle tree types:

- **MerkleTree**: A standard append-only Merkle tree. Once a leaf is inserted, it stays forever. The tree only tracks the current root.
- **HistoricMerkleTree**: Extends MerkleTree by maintaining a history of past roots. When a proof is submitted, `checkRoot()` verifies against any root in the history -- not just the latest one. This is critical for concurrent operations.

### Why HistoricMerkleTree here

In payroll, the employer inserts salary commitments one at a time. Each insertion changes the Merkle root. If employee A generates a proof against root R1, and then the employer inserts another commitment (changing the root to R2), employee A's proof would be invalid with a plain MerkleTree. HistoricMerkleTree solves this because `checkRoot(R1)` still returns true even after R2 exists.

## resetHistory() Strategy

The `newPeriod()` circuit calls `commitments.resetHistory()`. This clears the Merkle tree history, making all previous roots invalid. Any employee who generated a proof against a previous root but hasn't submitted it yet will have their proof rejected.

This enforces a **deadline mechanism**:

1. Employer commits salaries for period N
2. Employees must claim within period N
3. When the employer calls `newPeriod()`, the tree history resets
4. Unclaimed salaries from period N become unclaimable (their Merkle roots are gone)
5. The employer must re-commit salaries for period N+1

This design gives the employer control over pay cycles. It also means nullifiers are period-scoped: `computeNullifier(sk, period)` produces a different nullifier for each period, so an employee can claim once per period.

## Domain Separator Design

Each hash uses a distinct domain separator prefix to prevent cross-circuit collisions:

| Circuit | Prefix | Purpose |
|---------|--------|---------|
| `derivePublicKey` | `"payroll:pk:"` | Prevents a valid public key from being used as a commitment or nullifier |
| `computeCommitment` | `"payroll:commit:"` | Ensures commitments cannot collide with public keys or nullifiers |
| `computeNullifier` | `"payroll:null:"` | Ensures nullifiers occupy a separate hash domain |

Without domain separators, it would theoretically be possible to craft inputs that produce the same hash across different circuits, leading to potential exploits.

## Employer vs Employee Flow

### Employer

1. **Deploy** -- Creates the contract. The constructor stores `derivePublicKey(employerSk)` as the `employer` on the ledger and sets `period = 1`.
2. **Commit salary** -- For each employee, computes `computeCommitment(employeePubKey, salary, period)` and inserts it into the on-chain Merkle tree. Only the employer (verified by their secret key) can call this.
3. **New period** -- Increments the period counter and calls `resetHistory()`. This invalidates all previous Merkle proofs and prepares for the next pay cycle.
4. **View period** -- Reads the current period and total claimed amount from the ledger.

### Employee

1. **Join contract** -- Connects to an existing contract with their secret key and salary amount (stored locally in private state).
2. **Claim salary** -- The ZK circuit proves:
   - The employee knows a secret key `sk`
   - `derivePublicKey(sk)` yields a valid public key
   - A commitment for `(pubKey, salary, period)` exists in the Merkle tree
   - The nullifier `computeNullifier(sk, period)` has not been used yet
   - The salary amount matches the committed value
3. **View period** -- Reads the current period from the ledger.

## Privacy Analysis

### What on-chain observers CAN see

- The contract address and employer's public key
- The total number of salary commitments inserted (Merkle tree size)
- The total `claimedAmount` (sum of all claimed salaries)
- Each nullifier (but not who it belongs to)
- Each commitment (but not what salary or employee it encodes)
- The current period number
- When `newPeriod()` was called

### What on-chain observers CANNOT see

- Individual salary amounts (hidden inside commitments)
- Which employee claimed which amount (nullifiers are unlinkable to commitments)
- The mapping between employee public keys and commitments
- Employee secret keys
- Whether a specific employee has been paid (nullifiers reveal nothing about identity)
- The salary distribution across employees

### What the employer knows

- All employee public keys and salary amounts (they created the commitments)
- When claims happen (from on-chain nullifier insertions), but not which employee claimed unless they correlate timing

### What employees know

- Their own salary and secret key
- The contract address and current period
- Nothing about other employees' salaries or claims

## Limitations vs Full PolyPay

This example is a simplified demonstration. A production payroll system (PolyPay) would add:

- **Token transfers**: Actual tDUST/token payments, not just counters
- **Multi-employer**: Support for multiple organizations in one contract
- **Batch commitments**: Insert multiple salary commitments in one transaction
- **Timelock enforcement**: On-chain block-height based deadlines instead of manual `newPeriod()`
- **Salary updates**: Mechanisms for changing employee salaries across periods
- **Employee registration**: Formal onboarding flow with employer approval
- **Dispute resolution**: Mechanisms for handling incorrect salary commits
- **Event indexing**: Off-chain indexer for tracking claim history
- **Access control**: Role-based permissions beyond simple employer check

## How to Run

### Prerequisites

- Node.js >= 20
- Midnight proof server running on `http://127.0.0.1:6300`
- Access to Midnight preprod network
- Funded wallet seed (get testnet tokens from the faucet)

### Build the contract

```bash
cd contract
npm run compact
npm run build
```

### Run the CLI

```bash
cd cli
npm install
npm run cli
```

The CLI will:
1. Ask you to create or restore a wallet
2. Ask your role (employer or employee)
3. Present role-specific actions

### Employer workflow (CLI)

```
[1] Deploy contract     -- deploys and prints contract address + your secret/public key
[2] Commit salary       -- enter employee public key (hex) + amount
[3] New period          -- start next pay cycle (resets merkle history)
[4] View period         -- show current period and total claimed
```

### Employee workflow (CLI)

```
[1] Join contract       -- enter contract address, your secret key, and your salary
[2] Claim salary        -- generates ZK proof and claims
[3] View period         -- show current period
```

### Run the Web UI

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:5173`. Connect your Lace wallet, select your role, and interact with the contract.

### Full example (two terminals)

**Terminal 1 (Employer)**:
```
npm run cli
> [1] Create wallet
> [1] Employer
> [1] Deploy contract
  --> Note the contract address and your public key
> [2] Commit salary
  --> Enter employee's public key and salary amount
```

**Terminal 2 (Employee)**:
```
npm run cli
> [1] Create wallet
> [2] Employee
> [1] Join contract
  --> Enter contract address, your secret key, and your salary amount
> [2] Claim salary
  --> Generates ZK proof, claims salary
```
