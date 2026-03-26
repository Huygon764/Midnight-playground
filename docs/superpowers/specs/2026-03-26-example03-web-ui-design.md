# Example 03 - Private Voting Web UI Design

## Goal

Replace mock web UI in `examples/03-private-voting/web/` with a working on-chain implementation using the DApp Connector (Lace wallet) pattern from `references/example-bboard`.

## Architecture

Three-layer architecture following bboard pattern:

```
contract/     -> Compact contract + witnesses (already exists)
api/          -> Shared VotingAPI class (NEW package)
web/          -> React + Vite browser UI (REWRITE)
cli/          -> Existing CLI (REFACTOR to use api/)
```

### Layer 1: `api/` package (NEW)

Shared API between CLI and web. Follows `bboard-api` pattern exactly.

**Files:**
- `api/package.json`
- `api/tsconfig.json`, `api/tsconfig.build.json`
- `api/src/index.ts` - `VotingAPI` class
- `api/src/common-types.ts` - Shared types

**`VotingAPI` class:**
```typescript
export class VotingAPI implements DeployedVotingAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<VotingDerivedState>;

  static async deploy(providers, secretKey?, logger?): Promise<VotingAPI>;
  static async join(providers, contractAddress, secretKey?, logger?): Promise<VotingAPI>;

  async registerVoter(commitment: Uint8Array): Promise<void>;
  async castVote(vote: boolean): Promise<void>;
  async closeVoting(): Promise<void>;
}
```

**`VotingDerivedState`:**
```typescript
export type VotingDerivedState = {
  readonly yesVotes: bigint;
  readonly noVotes: bigint;
  readonly votingOpen: boolean;
};
```

**`state$` observable:**
- Uses `providers.publicDataProvider.contractStateObservable()` to watch ledger state
- Maps through `PrivateVoting.ledger()` to extract yesVotes, noVotes, votingOpen
- Private state (secretKey) is static, fetched once via `from(providers.privateStateProvider.get(...))`
- Combined with `combineLatest` (same pattern as bboard)

**Private state management:**
- `getPrivateState()` checks provider first, generates random 32 bytes if not found
- Same pattern as bboard's `BBoardAPI.getPrivateState()`

### Layer 2: `web/` package (REWRITE)

**Dependencies** (following bboard-ui):
- `react`, `react-dom` (^19)
- `@midnight-ntwrk/dapp-connector-api`
- `vite-plugin-wasm`, `vite-plugin-top-level-await`
- No MUI (keep current inline styling approach for simplicity)

**Vite config:**
- Copy bboard's vite.config.ts pattern exactly (wasm, topLevelAwait, onchain-runtime handling)
- Serve ZK keys from `public/keys/` and `public/zkir/` (symlinked or copied from contract managed output)

**Build script:**
```bash
tsc && vite build --mode preprod && cp -r ../contract/src/managed/private-voting/keys ./dist/keys && cp -r ../contract/src/managed/private-voting/zkir ./dist/zkir
```

**Provider initialization** (`src/providers.ts`):
Follow bboard's `initializeProviders()` exactly:
1. `connectToWallet()` - poll for `window.midnight[*]`, connect to Lace
2. `FetchZkConfigProvider` - fetch ZK keys from `window.location.origin`
3. `httpClientProofProvider` - from wallet config's `proverServerUri`
4. `indexerPublicDataProvider` - from wallet config's indexer URIs
5. `inMemoryPrivateStateProvider` - in-memory secret key storage
6. `walletProvider` - serialize/deserialize tx, call `connectedAPI.balanceUnsealedTransaction()`
7. `midnightProvider` - call `connectedAPI.submitTransaction()`

**`inMemoryPrivateStateProvider`** (`src/in-memory-private-state-provider.ts`):
- Copy from bboard verbatim (generic, reusable)

**React components** (`src/App.tsx` - single file, inline styles):
- `App` - top level, manages wallet connection + contract state
- `ConnectWallet` - connect to Lace, show address/status
- `DeployOrJoin` - deploy new contract or join by address
- `VotingPanel` - main voting UI:
  - Register voter (generate/input secret key, compute commitment)
  - Cast vote (yes/no buttons)
  - View results (yes count, no count, percentages, open/closed status)
  - Close voting

**State flow:**
```
ConnectWallet -> initializeProviders() -> VotingAPI.deploy()/join()
  -> state$ subscription -> React state -> UI render
```

**`globals.ts`:**
- `process.env.NODE_ENV` polyfill
- Buffer polyfill (from bboard)

### Layer 3: CLI refactor (MINIMAL)

Refactor `cli/src/api.ts` to import and use `VotingAPI` from `api/` package where possible. Keep CLI-specific wallet/provider setup. This is a follow-up task, not part of initial web implementation.

## Workspace Changes

**Root `package.json`** - add `"api"` to workspaces array.

**New `api/package.json`:**
```json
{
  "name": "@example/private-voting-api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts"
}
```

Note: No build step needed - web imports directly from source (like bboard's `../../../api/src/index`).

## ZK Key Serving

For `vite dev`:
- Symlink `web/public/keys/` -> `contract/src/managed/private-voting/keys/`
- Symlink `web/public/zkir/` -> `contract/src/managed/private-voting/zkir/`

For `vite build`:
- Build script copies keys/zkir to `dist/`

## Error Handling

- Wallet not found -> show "Install Midnight Lace wallet" message
- Wallet connection timeout -> show retry option
- Contract operations fail -> show error in UI, allow retry
- Network errors -> show status indicator

## What is NOT included

- No MUI or CSS framework (keep existing inline style approach)
- No CLI refactor in this phase
- No localStorage persistence (in-memory only, like bboard)
- No router (single page)
