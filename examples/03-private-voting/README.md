# Example 3: Private Voting

A privacy-preserving voting system on Midnight using the commitment/nullifier pattern with HistoricMerkleTree.

## New Concepts

### Commitment/Nullifier Pattern
The core privacy pattern in Midnight:

- **Commitment** = "I created something": `hash("vote:commit:" + secretKey)` inserted into a MerkleTree. On-chain observers see the hash but cannot reverse it to learn who registered.
- **Nullifier** = "I consumed something": `hash("vote:null:" + secretKey)` inserted into a Set. Prevents double-voting while keeping the voter anonymous.

**Why two different hashes?** Domain separators (`"vote:commit:"` vs `"vote:null:"`) ensure you cannot derive one from the other. An observer cannot link a nullifier to a commitment.

### HistoricMerkleTree vs MerkleTree
- `MerkleTree<32, Bytes<32>>` - only stores the **current** root
- `HistoricMerkleTree<32, Bytes<32>>` - stores **all historical roots**

We use `HistoricMerkleTree` because:
1. Voter A registers (tree root = R1)
2. Voter B registers (tree root = R2)
3. Voter A votes - their proof was computed against R1, which is no longer current
4. With `MerkleTree`, `checkRoot(R1)` would fail
5. With `HistoricMerkleTree`, `checkRoot(R1)` succeeds because R1 is in history

### MerkleTreePath Verification
The witness provides a `MerkleTreePath<32, Bytes<32>>` which contains the leaf and sibling hashes. The circuit:
1. Calls `merkleTreePathRoot<32, Bytes<32>>(path)` to compute the root from the path
2. Calls `voters.checkRoot(disclose(root))` to verify the root exists in the tree's history

### Set ADT
`Set<Bytes<32>>` stores nullifiers. Operations:
- `member(elem)` - check if element exists
- `insert(elem)` - add element
- No ordering, no iteration needed - just membership checks

### disclose()
Required when writing witness-derived values to the ledger. The compiler enforces this to make privacy trade-offs explicit. In this contract:
- `disclose(commitment)` - the commitment hash is public (but cannot be reversed)
- `disclose(nullifier)` - the nullifier hash is public (prevents double-voting)
- `disclose(root)` - the merkle root is public (needed for verification)
- `disclose(vote)` - the vote choice is public (needed to count)

### Privacy Analysis
| What observers see | What they cannot see |
|---|---|
| Commitment hashes | Which secret key generated them |
| Nullifier hashes | Which voter they belong to |
| Vote counts (yes/no) | Which voter voted which way |
| Tree roots | The full tree contents |

## How to Run

### Compile contract
```bash
cd contract && npm run compact
```

### Run unit tests
```bash
cd test && npx vitest run
```

### Start proof server (requires Docker)
```bash
docker run -p 6300:6300 midnightntwrk/proof-server:8.0.3 -- midnight-proof-server -v
```

### Run CLI
```bash
cd cli && npm run cli
```

### Start Web UI
```bash
cd web && npm install && npm run dev
```
Open http://localhost:5173 - requires Lace wallet extension + proof server.
