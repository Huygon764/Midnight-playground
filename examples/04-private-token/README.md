# Example 4: Private Token

A token contract on Midnight using the Map ADT for balance storage and identity-based transfers via secret key witnesses.

## New Concepts

### Contract Token vs Ledger Token

Midnight has two distinct token types:

- **Ledger token (NIGHT/tNIGHT)** - the native token managed by the Midnight ledger. Used for gas fees, dust, and shielded transactions. Handled by the wallet SDK.
- **Contract token** - a custom token defined in a Compact smart contract. Balances are stored in the contract's ledger state (a `Map<Bytes<32>, Uint<64>>`). The Midnight network has no built-in awareness of these tokens; they exist purely as contract state.

This example implements a contract token. The NIGHT token is still needed to pay transaction fees, but the token balances themselves live in the contract's `balances` map.

### Map ADT Operations

`Map<Bytes<32>, Uint<64>>` stores address-to-balance mappings. Three key operations:

- `member(key)` - returns `true` if the key exists in the map. Used to check if an address has ever received tokens before inserting or looking up.
- `lookup(key)` - returns the value associated with the key. Fails if key does not exist, so always check `member()` first.
- `insert(key, value)` - inserts or updates a key-value pair. If the key already exists, the value is overwritten.

Pattern used in `mint` and `transfer`:
```
if (balances.member(disclose(to))) {
  const current = balances.lookup(disclose(to));
  balances.insert(disclose(to), disclose((current + amount) as Uint<64>));
} else {
  balances.insert(disclose(to), disclose(amount as Uint<64>));
}
```

### Transfer Flow with Identity Proof

Unlike ERC-20 where `msg.sender` identifies the caller, Midnight uses zero-knowledge proofs. The transfer circuit:

1. The witness `localSecretKey()` retrieves the caller's secret key from private state (never leaves the prover).
2. `deriveAddress(sk)` computes the sender's address: `persistentHash(["token:addr:", sk])`.
3. The circuit asserts the derived address has sufficient balance in the on-chain map.
4. Balances are updated: sender decremented, recipient incremented.

The secret key proves ownership of the sender address without revealing the key itself. An observer sees the transaction updating balances but the ZK proof guarantees only the legitimate key holder could authorize it.

### deriveAddress - Pure Circuit

`deriveAddress(sk)` is a **pure circuit** - it has no side effects and does not read or modify ledger state. It can be called off-chain without submitting a transaction:

```typescript
const address = PrivateToken.pureCircuits.deriveAddress(secretKey);
```

This is useful for deriving your address locally before interacting with the contract.

### Limitation: Balances Are Public

In this version, all balances are public on the ledger. Every `disclose()` call makes the value visible on-chain:

| What observers see | What they cannot see |
|---|---|
| All addresses and their balances | Which secret key controls an address |
| All transfer amounts | The secret key used to authorize a transfer |
| Total supply | Nothing else - balances are fully public |

A truly private token would use commitments to hide balances and amounts, similar to the commitment/nullifier pattern in Example 3. This example prioritizes simplicity to demonstrate the Map ADT and identity-based authorization.

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
