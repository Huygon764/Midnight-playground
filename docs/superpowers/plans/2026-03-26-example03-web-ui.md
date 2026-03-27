# Example 03 - Private Voting Web UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mock web UI in example-03 with working on-chain implementation using DApp Connector (Lace wallet), following the `references/example-bboard` pattern exactly.

**Architecture:** Three packages — `contract/` (existing), `api/` (new shared VotingAPI class), `web/` (rewritten React+Vite UI with DApp Connector). The `api/` package provides `VotingAPI` with `deploy()`, `join()`, `registerVoter()`, `castVote()`, `closeVoting()`, and `state$` observable. The `web/` package connects to Lace wallet, initializes providers, and renders a voting UI.

**Tech Stack:** React 19, Vite 7, TypeScript, RxJS, Midnight DApp Connector API 4.x, `@midnight-ntwrk/midnight-js-*` SDK packages.

**Reference:** `references/example-bboard/` — follow patterns from `api/src/index.ts`, `bboard-ui/src/contexts/BrowserDeployedBoardManager.ts`, `bboard-ui/src/in-memory-private-state-provider.ts`.

---

## File Structure

### New files to create:
- `examples/03-private-voting/api/package.json`
- `examples/03-private-voting/api/tsconfig.json`
- `examples/03-private-voting/api/src/index.ts` — VotingAPI class
- `examples/03-private-voting/api/src/common-types.ts` — shared types
- `examples/03-private-voting/api/src/utils.ts` — randomBytes helper
- `examples/03-private-voting/web/src/globals.ts` — Buffer/process polyfills
- `examples/03-private-voting/web/src/in-memory-private-state-provider.ts` — browser private state
- `examples/03-private-voting/web/src/providers.ts` — DApp Connector + provider init

### Files to rewrite:
- `examples/03-private-voting/web/package.json` — add dependencies
- `examples/03-private-voting/web/vite.config.ts` — wasm/topLevelAwait plugins
- `examples/03-private-voting/web/tsconfig.json` — update for new imports
- `examples/03-private-voting/web/src/main.tsx` — add globals import + network setup
- `examples/03-private-voting/web/src/App.tsx` — full rewrite with on-chain calls

### Files to modify:
- `examples/03-private-voting/package.json` — add `api` and `web` to workspaces
- `examples/03-private-voting/contract/src/index.ts` — add CompiledContract export

---

### Task 1: Update workspace and add `api/` package scaffold

**Files:**
- Modify: `examples/03-private-voting/package.json`
- Create: `examples/03-private-voting/api/package.json`
- Create: `examples/03-private-voting/api/tsconfig.json`

- [ ] **Step 1: Add `api` and `web` to workspaces in root package.json**

In `examples/03-private-voting/package.json`, change the `workspaces` array:
```json
"workspaces": [
  "contract",
  "test",
  "cli",
  "api",
  "web"
],
```

Also add these new dependencies to the root `dependencies`:
```json
"@midnight-ntwrk/dapp-connector-api": "4.0.1",
"@midnight-ntwrk/midnight-js-fetch-zk-config-provider": "3.0.0",
"@midnight-ntwrk/midnight-js-utils": "3.0.0",
"@midnight-ntwrk/compact-js": "3.0.0",
"buffer": "^6.0.3",
"rxjs": "^7.8.2",
"semver": "^7.7.4"
```

- [ ] **Step 2: Create `api/package.json`**

```json
{
  "name": "@example/private-voting-api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "dependencies": {
    "@example/private-voting-contract": "*"
  }
}
```

- [ ] **Step 3: Create `api/tsconfig.json`**

```json
{
  "include": ["src/**/*.ts"],
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "lib": ["ESNext"],
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "isolatedModules": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add examples/03-private-voting/package.json examples/03-private-voting/api/
git commit -m "feat(example-03): add api package scaffold and update workspaces"
```

---

### Task 2: Add CompiledContract export to contract package

**Files:**
- Modify: `examples/03-private-voting/contract/src/index.ts`

The `api/` package needs a pre-configured `CompiledContract` export (like bboard's `CompiledBBoardContractContract`).

- [ ] **Step 1: Update contract/src/index.ts**

Replace the current content of `examples/03-private-voting/contract/src/index.ts` with:

```typescript
export * as PrivateVoting from "./managed/private-voting/contract/index.js";
export * from "./witnesses.js";

import { CompiledContract } from "@midnight-ntwrk/compact-js";
import * as PrivateVotingContract from "./managed/private-voting/contract/index.js";
import { witnesses, type VotingPrivateState } from "./witnesses.js";

export const CompiledVotingContract = CompiledContract.make<
  PrivateVotingContract.Contract<VotingPrivateState>
>(
  "private-voting",
  PrivateVotingContract.Contract<VotingPrivateState>,
).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets("./compiled/private-voting"),
);
```

- [ ] **Step 2: Add `@midnight-ntwrk/compact-js` to contract dependencies if needed**

Check `contract/package.json` — if `@midnight-ntwrk/compact-js` is not listed, it's inherited from root. The root `package.json` was updated in Task 1 to include it. No action needed.

- [ ] **Step 3: Commit**

```bash
git add examples/03-private-voting/contract/src/index.ts
git commit -m "feat(example-03): add CompiledVotingContract export for api/web usage"
```

---

### Task 3: Implement `api/src/common-types.ts` and `api/src/utils.ts`

**Files:**
- Create: `examples/03-private-voting/api/src/common-types.ts`
- Create: `examples/03-private-voting/api/src/utils.ts`

- [ ] **Step 1: Create `api/src/common-types.ts`**

```typescript
import { type MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import { type FoundContract } from "@midnight-ntwrk/midnight-js-contracts";
import type { VotingPrivateState, Contract, Witnesses } from "../../contract/src/index.js";

export const votingPrivateStateKey = "votingPrivateState";
export type PrivateStateId = typeof votingPrivateStateKey;

export type VotingContract = Contract<VotingPrivateState, Witnesses<VotingPrivateState>>;

export type VotingCircuitKeys = Exclude<keyof VotingContract["impureCircuits"], number | symbol>;

export type VotingProviders = MidnightProviders<VotingCircuitKeys, PrivateStateId, VotingPrivateState>;

export type DeployedVotingContract = FoundContract<VotingContract>;

export type VotingDerivedState = {
  readonly yesVotes: bigint;
  readonly noVotes: bigint;
  readonly votingOpen: boolean;
};
```

- [ ] **Step 2: Create `api/src/utils.ts`**

```typescript
export const randomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
};
```

- [ ] **Step 3: Commit**

```bash
git add examples/03-private-voting/api/src/
git commit -m "feat(example-03): add api common types and utils"
```

---

### Task 4: Implement `api/src/index.ts` — VotingAPI class

**Files:**
- Create: `examples/03-private-voting/api/src/index.ts`

- [ ] **Step 1: Create `api/src/index.ts`**

```typescript
import { PrivateVoting } from "../../contract/src/index.js";
import { CompiledVotingContract } from "../../contract/src/index.js";
import { type ContractAddress } from "@midnight-ntwrk/compact-runtime";
import { type Logger } from "pino";
import {
  type VotingDerivedState,
  type VotingProviders,
  type DeployedVotingContract,
  votingPrivateStateKey,
} from "./common-types.js";
import * as utils from "./utils.js";
import { deployContract, findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { map, type Observable } from "rxjs";
import { type VotingPrivateState, createVotingPrivateState } from "../../contract/src/index.js";

export interface DeployedVotingAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<VotingDerivedState>;

  registerVoter: (commitment: Uint8Array) => Promise<void>;
  castVote: (vote: boolean) => Promise<void>;
  closeVoting: () => Promise<void>;
}

export class VotingAPI implements DeployedVotingAPI {
  private constructor(
    public readonly deployedContract: DeployedVotingContract,
    providers: VotingProviders,
    private readonly logger?: Logger,
  ) {
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    this.state$ = providers.publicDataProvider
      .contractStateObservable(this.deployedContractAddress, { type: "latest" })
      .pipe(
        map((contractState) => {
          const ledgerState = PrivateVoting.ledger(contractState.data);
          return {
            yesVotes: ledgerState.yesVotes,
            noVotes: ledgerState.noVotes,
            votingOpen: ledgerState.votingOpen,
          };
        }),
      );
  }

  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<VotingDerivedState>;

  async registerVoter(commitment: Uint8Array): Promise<void> {
    this.logger?.info("registerVoter");
    await this.deployedContract.callTx.registerVoter(commitment);
  }

  async castVote(vote: boolean): Promise<void> {
    this.logger?.info(`castVote: ${vote ? "YES" : "NO"}`);
    await this.deployedContract.callTx.castVote(vote);
  }

  async closeVoting(): Promise<void> {
    this.logger?.info("closeVoting");
    await this.deployedContract.callTx.closeVoting();
  }

  static async deploy(providers: VotingProviders, logger?: Logger): Promise<VotingAPI> {
    logger?.info("deployContract");
    const deployedContract = await deployContract(providers, {
      compiledContract: CompiledVotingContract,
      privateStateId: votingPrivateStateKey,
      initialPrivateState: await VotingAPI.getPrivateState(providers),
    });
    logger?.info({ address: deployedContract.deployTxData.public.contractAddress }, "contractDeployed");
    return new VotingAPI(deployedContract, providers, logger);
  }

  static async join(
    providers: VotingProviders,
    contractAddress: ContractAddress,
    logger?: Logger,
  ): Promise<VotingAPI> {
    logger?.info({ contractAddress }, "joinContract");
    const deployedContract = await findDeployedContract(providers, {
      contractAddress,
      compiledContract: CompiledVotingContract,
      privateStateId: votingPrivateStateKey,
      initialPrivateState: await VotingAPI.getPrivateState(providers),
    });
    logger?.info({ contractAddress }, "contractJoined");
    return new VotingAPI(deployedContract, providers, logger);
  }

  private static async getPrivateState(providers: VotingProviders): Promise<VotingPrivateState> {
    const existing = await providers.privateStateProvider.get(votingPrivateStateKey);
    return existing ?? createVotingPrivateState(utils.randomBytes(32));
  }
}

export * from "./common-types.js";
export { utils };
```

- [ ] **Step 2: Commit**

```bash
git add examples/03-private-voting/api/src/index.ts
git commit -m "feat(example-03): implement VotingAPI class with deploy, join, vote operations"
```

---

### Task 5: Rewrite `web/package.json` and `web/vite.config.ts`

**Files:**
- Modify: `examples/03-private-voting/web/package.json`
- Modify: `examples/03-private-voting/web/vite.config.ts`

- [ ] **Step 1: Rewrite `web/package.json`**

```json
{
  "name": "@example/private-voting-web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build --mode preprod && cp -r ../contract/src/managed/private-voting/keys ./dist/keys && cp -r ../contract/src/managed/private-voting/zkir ./dist/zkir",
    "preview": "vite preview"
  },
  "dependencies": {
    "@midnight-ntwrk/dapp-connector-api": "4.0.1",
    "@example/private-voting-api": "*",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@types/react": "^19.1.6",
    "@types/react-dom": "^19.1.6",
    "@vitejs/plugin-react": "^4.6.1",
    "typescript": "^5.9.3",
    "vite": "^7.0.0",
    "vite-plugin-wasm": "^3.4.1",
    "vite-plugin-top-level-await": "^1.5.0"
  }
}
```

- [ ] **Step 2: Rewrite `web/vite.config.ts`**

Copy the bboard pattern exactly:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  cacheDir: "./.vite",
  build: {
    target: "esnext",
    minify: false,
    rollupOptions: {
      output: {
        manualChunks: {
          wasm: ["@midnight-ntwrk/onchain-runtime-v2"],
        },
      },
    },
    commonjsOptions: {
      transformMixedEsModules: true,
      extensions: [".js", ".cjs"],
      ignoreDynamicRequires: true,
    },
  },
  plugins: [
    react(),
    wasm(),
    topLevelAwait({
      promiseExportName: "__tla",
      promiseImportName: (i) => `__tla_${i}`,
    }),
    {
      name: "wasm-module-resolver",
      resolveId(source, importer) {
        if (
          source === "@midnight-ntwrk/onchain-runtime-v2" &&
          importer &&
          importer.includes("@midnight-ntwrk/compact-runtime")
        ) {
          return { id: source, external: false, moduleSideEffects: true };
        }
        return null;
      },
    },
  ],
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext",
      supported: { "top-level-await": true },
      platform: "browser",
      format: "esm",
      loader: { ".wasm": "binary" },
    },
    include: ["@midnight-ntwrk/compact-runtime"],
    exclude: [
      "@midnight-ntwrk/onchain-runtime-v2",
      "@midnight-ntwrk/onchain-runtime-v2/midnight_onchain_runtime_wasm_bg.wasm",
      "@midnight-ntwrk/onchain-runtime-v2/midnight_onchain_runtime_wasm.js",
    ],
  },
  resolve: {
    extensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json", ".wasm"],
    mainFields: ["browser", "module", "main"],
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add examples/03-private-voting/web/package.json examples/03-private-voting/web/vite.config.ts
git commit -m "feat(example-03): update web package deps and vite config for blockchain integration"
```

---

### Task 6: Create browser support files

**Files:**
- Create: `examples/03-private-voting/web/src/globals.ts`
- Create: `examples/03-private-voting/web/src/in-memory-private-state-provider.ts`

- [ ] **Step 1: Create `web/src/globals.ts`**

```typescript
import { Buffer } from "buffer";

// @ts-expect-error - support third-party libraries that require NODE_ENV
globalThis.process = {
  env: {
    NODE_ENV: import.meta.env.MODE,
  },
};

globalThis.Buffer = Buffer;
```

- [ ] **Step 2: Create `web/src/in-memory-private-state-provider.ts`**

Copy from bboard verbatim:

```typescript
import type { SigningKey } from "@midnight-ntwrk/compact-runtime";
import type { ContractAddress } from "@midnight-ntwrk/ledger-v7";
import { type PrivateStateId, type PrivateStateProvider } from "@midnight-ntwrk/midnight-js-types";

export const inMemoryPrivateStateProvider = <PSI extends PrivateStateId, PS = unknown>(): PrivateStateProvider<
  PSI,
  PS
> => {
  const record = new Map<PSI, PS>();
  const signingKeys = {} as Record<ContractAddress, SigningKey>;

  return {
    set(key: PSI, state: PS): Promise<void> {
      record.set(key, state);
      return Promise.resolve();
    },
    get(key: PSI): Promise<PS | null> {
      return Promise.resolve(record.get(key) ?? null);
    },
    remove(key: PSI): Promise<void> {
      record.delete(key);
      return Promise.resolve();
    },
    clear(): Promise<void> {
      record.clear();
      return Promise.resolve();
    },
    setSigningKey(contractAddress: ContractAddress, signingKey: SigningKey): Promise<void> {
      signingKeys[contractAddress] = signingKey;
      return Promise.resolve();
    },
    getSigningKey(contractAddress: ContractAddress): Promise<SigningKey | null> {
      return Promise.resolve(signingKeys[contractAddress] ?? null);
    },
    removeSigningKey(contractAddress: ContractAddress): Promise<void> {
      delete signingKeys[contractAddress];
      return Promise.resolve();
    },
    clearSigningKeys(): Promise<void> {
      Object.keys(signingKeys).forEach((k) => delete signingKeys[k as ContractAddress]);
      return Promise.resolve();
    },
  };
};
```

- [ ] **Step 3: Commit**

```bash
git add examples/03-private-voting/web/src/globals.ts examples/03-private-voting/web/src/in-memory-private-state-provider.ts
git commit -m "feat(example-03): add browser globals polyfill and in-memory private state provider"
```

---

### Task 7: Implement `web/src/providers.ts` — DApp Connector + provider init

**Files:**
- Create: `examples/03-private-voting/web/src/providers.ts`

This is the critical file that wires up Lace wallet to Midnight providers. Follows `BrowserDeployedBoardManager.ts` pattern.

- [ ] **Step 1: Create `web/src/providers.ts`**

```typescript
import { type VotingCircuitKeys, type VotingProviders } from "../../api/src/index.js";
import { type VotingPrivateState } from "../../contract/src/index.js";
import { fromHex, toHex } from "@midnight-ntwrk/compact-runtime";
import {
  concatMap,
  filter,
  firstValueFrom,
  interval,
  map,
  take,
  tap,
  throwError,
  timeout,
} from "rxjs";
import { type ConnectedAPI, type InitialAPI } from "@midnight-ntwrk/dapp-connector-api";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import {
  Binding,
  FinalizedTransaction,
  Proof,
  SignatureEnabled,
  Transaction,
  TransactionId,
} from "@midnight-ntwrk/ledger-v7";
import { inMemoryPrivateStateProvider } from "./in-memory-private-state-provider.js";
import { type UnboundTransaction } from "@midnight-ntwrk/midnight-js-types";
import semver from "semver";

const COMPATIBLE_CONNECTOR_API_VERSION = "4.x";

let cachedProviders: Promise<VotingProviders> | undefined;

export const getProviders = (): Promise<VotingProviders> => {
  return cachedProviders ?? (cachedProviders = initializeProviders());
};

const initializeProviders = async (): Promise<VotingProviders> => {
  const networkId = import.meta.env.VITE_NETWORK_ID as string;
  const connectedAPI = await connectToWallet(networkId);
  const zkConfigPath = window.location.origin;
  const keyMaterialProvider = new FetchZkConfigProvider<VotingCircuitKeys>(zkConfigPath, fetch.bind(window));
  const config = await connectedAPI.getConfiguration();
  const privateStateProvider = inMemoryPrivateStateProvider<string, VotingPrivateState>();
  const shieldedAddresses = await connectedAPI.getShieldedAddresses();

  return {
    privateStateProvider,
    zkConfigProvider: keyMaterialProvider,
    proofProvider: httpClientProofProvider(config.proverServerUri!, keyMaterialProvider),
    publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
    walletProvider: {
      getCoinPublicKey(): string {
        return shieldedAddresses.shieldedCoinPublicKey;
      },
      getEncryptionPublicKey(): string {
        return shieldedAddresses.shieldedEncryptionPublicKey;
      },
      balanceTx: async (tx: UnboundTransaction): Promise<FinalizedTransaction> => {
        const serializedTx = toHex(tx.serialize());
        const received = await connectedAPI.balanceUnsealedTransaction(serializedTx);
        return Transaction.deserialize<SignatureEnabled, Proof, Binding>(
          "signature",
          "proof",
          "binding",
          fromHex(received.tx),
        );
      },
    },
    midnightProvider: {
      submitTx: async (tx: FinalizedTransaction): Promise<TransactionId> => {
        await connectedAPI.submitTransaction(toHex(tx.serialize()));
        return tx.identifiers()[0];
      },
    },
  };
};

const getFirstCompatibleWallet = (): InitialAPI | undefined => {
  if (!window.midnight) return undefined;
  return Object.values(window.midnight).find(
    (wallet): wallet is InitialAPI =>
      !!wallet &&
      typeof wallet === "object" &&
      "apiVersion" in wallet &&
      semver.satisfies(wallet.apiVersion, COMPATIBLE_CONNECTOR_API_VERSION),
  );
};

const connectToWallet = (networkId: string): Promise<ConnectedAPI> => {
  return firstValueFrom(
    interval(100).pipe(
      map(() => getFirstCompatibleWallet()),
      filter((w): w is InitialAPI => !!w),
      take(1),
      timeout({
        first: 1_000,
        with: () => throwError(() => new Error("Midnight Lace wallet not found. Extension installed?")),
      }),
      concatMap(async (initialAPI) => {
        const connectedAPI = await initialAPI.connect(networkId);
        await connectedAPI.getConnectionStatus();
        return connectedAPI;
      }),
      timeout({
        first: 5_000,
        with: () => throwError(() => new Error("Midnight Lace wallet failed to respond. Extension enabled?")),
      }),
    ),
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add examples/03-private-voting/web/src/providers.ts
git commit -m "feat(example-03): implement DApp Connector wallet connection and provider initialization"
```

---

### Task 8: Symlink ZK keys for dev server

**Files:**
- Create: `examples/03-private-voting/web/public/keys` (symlink)
- Create: `examples/03-private-voting/web/public/zkir` (symlink)

The `FetchZkConfigProvider` fetches ZK keys from `window.location.origin`. Vite serves `public/` at root.

- [ ] **Step 1: Create symlinks**

```bash
cd examples/03-private-voting/web
mkdir -p public
ln -sf ../../contract/src/managed/private-voting/keys public/keys
ln -sf ../../contract/src/managed/private-voting/zkir public/zkir
```

- [ ] **Step 2: Add symlinks to `.gitignore`**

Add to `examples/03-private-voting/web/.gitignore` (create if not exists):
```
public/keys
public/zkir
```

- [ ] **Step 3: Commit**

```bash
git add examples/03-private-voting/web/.gitignore
git commit -m "feat(example-03): symlink ZK keys for vite dev server"
```

---

### Task 9: Rewrite `web/src/main.tsx` and `web/tsconfig.json`

**Files:**
- Modify: `examples/03-private-voting/web/src/main.tsx`
- Modify: `examples/03-private-voting/web/tsconfig.json`

- [ ] **Step 1: Rewrite `web/src/main.tsx`**

```tsx
import "./globals";

import React from "react";
import ReactDOM from "react-dom/client";
import { setNetworkId, type NetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import App from "./App";
import "@midnight-ntwrk/dapp-connector-api";

const networkId = (import.meta.env.VITE_NETWORK_ID ?? "preprod") as NetworkId;
setNetworkId(networkId);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 2: Create `.env.preprod` file for Vite env vars**

Create `examples/03-private-voting/web/.env.preprod`:
```
VITE_NETWORK_ID=preprod
```

- [ ] **Step 3: Update `web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "esModuleInterop": true
  },
  "include": ["src", "../api/src", "../contract/src"]
}
```

- [ ] **Step 4: Commit**

```bash
git add examples/03-private-voting/web/src/main.tsx examples/03-private-voting/web/tsconfig.json examples/03-private-voting/web/.env.preprod
git commit -m "feat(example-03): update main.tsx with network setup and globals import"
```

---

### Task 10: Rewrite `web/src/App.tsx` — full on-chain voting UI

**Files:**
- Modify: `examples/03-private-voting/web/src/App.tsx`

- [ ] **Step 1: Rewrite `web/src/App.tsx`**

```tsx
import { useState, useEffect, useCallback } from "react";
import { type VotingDerivedState, VotingAPI, type DeployedVotingAPI } from "../../api/src/index.js";
import { PrivateVoting } from "../../contract/src/index.js";
import { getProviders } from "./providers.js";

type AppStatus = "disconnected" | "connecting" | "connected" | "deploying" | "ready" | "error";

export default function App() {
  const [status, setStatus] = useState<AppStatus>("disconnected");
  const [error, setError] = useState<string>("");
  const [api, setApi] = useState<DeployedVotingAPI | null>(null);
  const [votingState, setVotingState] = useState<VotingDerivedState | null>(null);
  const [contractAddress, setContractAddress] = useState("");
  const [joinAddress, setJoinAddress] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [txStatus, setTxStatus] = useState("");

  useEffect(() => {
    if (!api) return;
    const sub = api.state$.subscribe({
      next: (state) => setVotingState(state),
      error: (err) => setError(err.message),
    });
    return () => sub.unsubscribe();
  }, [api]);

  const connectAndDeploy = useCallback(async () => {
    try {
      setStatus("connecting");
      setError("");
      const providers = await getProviders();
      setStatus("deploying");
      const votingApi = await VotingAPI.deploy(providers);
      setApi(votingApi);
      setContractAddress(votingApi.deployedContractAddress);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }, []);

  const connectAndJoin = useCallback(async () => {
    if (!joinAddress.trim()) return;
    try {
      setStatus("connecting");
      setError("");
      const providers = await getProviders();
      setStatus("deploying");
      const votingApi = await VotingAPI.join(providers, joinAddress.trim());
      setApi(votingApi);
      setContractAddress(votingApi.deployedContractAddress);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }, [joinAddress]);

  const registerVoter = useCallback(async (secretKeyHex: string) => {
    if (!api) return;
    setIsWorking(true);
    setTxStatus("");
    try {
      const sk = hexToBytes(secretKeyHex);
      const commitment = PrivateVoting.pureCircuits.voterCommitment(sk);
      await api.registerVoter(commitment);
      setTxStatus("Voter registered successfully");
    } catch (e) {
      setTxStatus(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsWorking(false);
    }
  }, [api]);

  const castVote = useCallback(async (vote: boolean) => {
    if (!api) return;
    setIsWorking(true);
    setTxStatus("");
    try {
      await api.castVote(vote);
      setTxStatus(`Vote cast: ${vote ? "YES" : "NO"}`);
    } catch (e) {
      setTxStatus(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsWorking(false);
    }
  }, [api]);

  const closeVoting = useCallback(async () => {
    if (!api) return;
    setIsWorking(true);
    setTxStatus("");
    try {
      await api.closeVoting();
      setTxStatus("Voting closed");
    } catch (e) {
      setTxStatus(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsWorking(false);
    }
  }, [api]);

  if (status === "disconnected" || status === "error") {
    return <LandingPage
      status={status}
      error={error}
      joinAddress={joinAddress}
      onJoinAddressChange={setJoinAddress}
      onDeploy={connectAndDeploy}
      onJoin={connectAndJoin}
    />;
  }

  if (status === "connecting" || status === "deploying") {
    return (
      <div>
        <h1>Private Voting</h1>
        <div className="card">
          <div className="status connected">
            {status === "connecting" ? "Connecting to Lace wallet..." : "Setting up contract..."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>Private Voting</h1>
      <div className="status connected">Contract: {contractAddress}</div>

      {votingState && <Results state={votingState} />}

      {votingState?.votingOpen && (
        <>
          <RegisterVoterCard onRegister={registerVoter} disabled={isWorking} />
          <CastVoteCard onVote={castVote} disabled={isWorking} />
          <div className="card">
            <h2>Admin</h2>
            <button onClick={closeVoting} disabled={isWorking}>Close Voting</button>
          </div>
        </>
      )}

      {txStatus && <div className="card"><div className="status connected">{txStatus}</div></div>}
    </div>
  );
}

function LandingPage({
  status, error, joinAddress, onJoinAddressChange, onDeploy, onJoin,
}: {
  status: AppStatus;
  error: string;
  joinAddress: string;
  onJoinAddressChange: (v: string) => void;
  onDeploy: () => void;
  onJoin: () => void;
}) {
  return (
    <div>
      <h1>Private Voting</h1>
      <p>A privacy-preserving voting system on Midnight using commitment/nullifier pattern.</p>

      <div className="card">
        <h2>Deploy New Contract</h2>
        <button onClick={onDeploy}>Connect Wallet & Deploy</button>
      </div>

      <div className="card">
        <h2>Join Existing Contract</h2>
        <input
          placeholder="Contract address (hex)"
          value={joinAddress}
          onChange={(e) => onJoinAddressChange(e.target.value)}
        />
        <button onClick={onJoin} disabled={!joinAddress.trim()}>Connect Wallet & Join</button>
      </div>

      {error && <div className="card"><div className="status error">{error}</div></div>}
    </div>
  );
}

function RegisterVoterCard({ onRegister, disabled }: { onRegister: (sk: string) => void; disabled: boolean }) {
  const [secretKey, setSecretKey] = useState("");

  const generateKey = () => {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    setSecretKey(Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(""));
  };

  return (
    <div className="card">
      <h2>Register Voter</h2>
      <input
        placeholder="Voter secret key (hex)"
        value={secretKey}
        onChange={(e) => setSecretKey(e.target.value)}
      />
      <button onClick={generateKey}>Generate Key</button>
      <button onClick={() => onRegister(secretKey)} disabled={disabled || !secretKey}>Register</button>
    </div>
  );
}

function CastVoteCard({ onVote, disabled }: { onVote: (vote: boolean) => void; disabled: boolean }) {
  return (
    <div className="card">
      <h2>Cast Vote</h2>
      <button onClick={() => onVote(true)} disabled={disabled}>Vote YES</button>
      <button onClick={() => onVote(false)} disabled={disabled}>Vote NO</button>
    </div>
  );
}

function Results({ state }: { state: VotingDerivedState }) {
  const total = Number(state.yesVotes + state.noVotes);
  const yes = Number(state.yesVotes);
  const no = Number(state.noVotes);

  return (
    <div className="card">
      <h2>Results</h2>
      <div className="status connected">Status: {state.votingOpen ? "OPEN" : "CLOSED"}</div>
      <div className="results">
        <div className="result-box yes">
          <div className="count">{yes}</div>
          <div>YES</div>
          {total > 0 && <div>{((yes / total) * 100).toFixed(1)}%</div>}
        </div>
        <div className="result-box no">
          <div className="count">{no}</div>
          <div>NO</div>
          {total > 0 && <div>{((no / total) * 100).toFixed(1)}%</div>}
        </div>
      </div>
      <div>Total votes: {total}</div>
    </div>
  );
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
```

- [ ] **Step 2: Commit**

```bash
git add examples/03-private-voting/web/src/App.tsx
git commit -m "feat(example-03): rewrite App.tsx with full on-chain voting via DApp Connector"
```

---

### Task 11: Install dependencies and verify build

- [ ] **Step 1: Install dependencies**

```bash
cd examples/03-private-voting
npm install
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd examples/03-private-voting/web
npx tsc --noEmit
```

Expected: No errors (or only non-blocking warnings from skipLibCheck).

- [ ] **Step 3: Verify Vite dev server starts**

```bash
cd examples/03-private-voting/web
npx vite --mode preprod
```

Expected: Server starts at `http://localhost:5173`. Open in browser — should see the landing page with "Deploy New Contract" and "Join Existing Contract" cards. (Full functionality requires Lace wallet extension.)

- [ ] **Step 4: Commit any fixes needed**

```bash
git add -A examples/03-private-voting/
git commit -m "feat(example-03): install deps and fix any build issues"
```
