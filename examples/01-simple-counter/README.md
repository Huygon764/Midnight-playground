# Example 1: Simple Counter

A basic Midnight smart contract demonstrating the Counter ADT and impure circuits.

## Concepts

### Counter ADT
Counter is a built-in Compact type that provides:
- `increment(n)` - increase value by n
- `decrement(n)` - decrease value by n
- `read()` - return the current value as `Uint<64>`
- `lessThan(threshold)` - check if value is below threshold

Counter defaults to 0 when declared as a ledger field.

### Impure Circuits
Circuits that read or write ledger state are **impure**. They generate ZK proofs when called on-chain.
All three circuits in this contract (`increment`, `decrement`, `read_counter`) are impure because they access `round`.

### Compile Output
Running `compact compile` produces:
- `contract/` - Generated TypeScript API mirroring the circuit logic
- `keys/` - Proving key (prover, local) + verifying key (verifier, on-chain)
- `zkir/` - ZK intermediate representation bytecode
- `compiler/` - Metadata (contract-info.json)

## Project Structure

```
01-simple-counter/
  contract/src/
    simple-counter.compact    -- Compact smart contract
    witnesses.ts              -- Empty (no witnesses needed)
    index.ts                  -- Re-exports generated API
    managed/                  -- Generated after compile
  test/
    simple-counter-simulator.ts  -- Test simulator
    simple-counter.test.ts       -- Unit tests (Vitest)
  cli/src/
    config.ts                 -- Network endpoints
    common-types.ts           -- TypeScript types
    api.ts                    -- Wallet, providers, contract API
    cli.ts                    -- Interactive CLI menu
    index.ts                  -- Entry point
```

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

The CLI will:
1. Create or restore a wallet
2. Wait for tNIGHT funds (use the Preprod faucet)
3. Register for DUST generation
4. Deploy or join a counter contract
5. Interact: increment, decrement, read counter value

## Flow: Compile -> Test -> Deploy -> Interact

1. **Compile**: `compact compile` generates TypeScript from `.compact` file
2. **Test offline**: Vitest runs the generated `index.js` which executes the same logic as the ZK circuit (different representation, same AST). Tests use fake state.
3. **Deploy on-chain**: Proof server generates ZK proof, verifying key is stored on-chain
4. **Interact**: Each circuit call runs locally, generates proof, balances DUST fee, signs, submits to node, node verifies proof, updates ledger
