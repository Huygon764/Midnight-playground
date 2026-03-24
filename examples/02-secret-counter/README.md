# Example 2: Secret Counter

A Midnight smart contract with owner-only access control using witness functions and `persistentHash` authentication.

## New Concepts

### Witness Function
A witness is declared in Compact but implemented in TypeScript. It provides secret data (stored locally in LevelDB) to the ZK circuit without ever exposing it on-chain.

```compact
witness localSecretKey(): Bytes<32>;
```

The SDK automatically calls the witness implementation via `WitnessContext<Ledger, PrivateState>`, which provides:
- `ledger` - current on-chain state (read-only)
- `privateState` - local secret data from LevelDB
- `contractAddress` - the deployed contract address

The witness returns `[newPrivateState, witnessValue]`.

### Authentication via Hash
Instead of storing the secret key on-chain, we store a derived public key:
```compact
export circuit publicKey(sk: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>([pad(32, "sc:pk:"), sk]);
}
```

To prove ownership:
1. User provides `secretKey` via witness (local, never leaves their machine)
2. Circuit computes `publicKey(secretKey)` using `persistentHash`
3. Circuit asserts computed public key matches the `owner` stored on-chain

The ZK proof proves "I know the secret key that maps to this public key" without revealing the secret key.

### persistentHash
A deterministic hash function in Compact. Same input always produces same output. The `pad(32, "sc:pk:")` creates a domain separator to prevent cross-context hash collisions.

### Comparison with Solidity
| Feature | Solidity (Ownable) | Midnight (Secret Counter) |
|---------|-------------------|--------------------------|
| Owner stored as | Address (public) | Hash of secret key |
| Auth check | `msg.sender == owner` | ZK proof of secret key |
| Privacy | Everyone sees who owns it | No one knows the secret key |

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

### Run CLI (requires proof server + faucet)
```bash
cd cli && npm run cli
```
