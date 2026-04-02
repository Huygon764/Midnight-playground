# Midnight Blockchain — Complete Knowledge from Docs + Discussion + Quiz

---

## I. What is Midnight?

- A blockchain focused on **privacy**, allowing developers to program privacy at the smart contract level.
- A **Cardano Partnerchain**, built on Polkadot SDK, connected to Cardano via bridge.
- Block time: ~6 seconds (target).
- Node uses: sr25519 (block authorship), ed25519 (finality), ECDSA (consensus).

---

## II. 3-Layer Architecture of Each DApp

### Layer 1 — Public Ledger (on-chain)
- Public data: ledger fields, verifying key, nullifier set, commitment tree root.
- Node only verifies proof, never re-executes logic.

### Layer 2 — ZK Circuit (proving/verifying)
- Contract logic compiles into arithmetic circuit.
- Proving key + circuit runs locally (proof server) to create proof.
- Verifying key stored on-chain for node to verify proof.
- Bridge between local and on-chain.

### Layer 3 — Off-chain Local (private)
- Secret data stored on user's machine (LevelDB for CLI, localStorage for web).
- Witness functions run locally, providing secrets to circuits.
- Proof server runs here.
- Private state never goes on-chain.

**Overall flow:** Circuit receives input (witness secret + public data from ledger) -> processes logic locally -> creates proof + public transcript -> submits to chain -> node verifies with verifying key -> if valid, updates ledger.

---

## III. Tokens

### NIGHT
- Native token, transferable.
- Used for governance, staking, generating DUST.
- 1 NIGHT = 10^6 STAR.

### DUST
- Fee token, shielded, **not transferable**.
- Every transaction costs DUST.
- Generated automatically from NIGHT holdings after registration.
- 1 DUST = 10^15 SPECK.
- Wallet SDK calculates fees automatically, no gas auction like EVM.

### DUST Registration
- Option 1: Lace Wallet UI -> click generate DUST.
- Option 2: In code -> wallet.registerNightUtxosForDustGeneration(...).
- Must register NIGHT UTXOs first, wait for DUST > 0 before deploying/calling contracts.

---

## IV. UTXO Model

- Midnight uses UTXO like Bitcoin/Cardano (not Account model like Ethereum).
- Each "coin" is an Unspent Transaction Output.
- When sending: spend entire old UTXO -> create new UTXOs (payment + change).
- Old UTXO is invalidated by **nullifier** = hash(UTXO + secret) -> inserted into nullifier set -> prevents double-spend without revealing which UTXO was spent.
- Advantages: parallel processing, per-UTXO privacy, bounded state.

### Two token types:
- **Ledger Token** (NIGHT/DUST): UTXO-based, privacy-native.
- **Contract Token**: can be account-based (Map balances, ERC-20-like) or UTXO-based (Kernel mint into ledger UTXO system).

### UTXO context:
- **Commitment** = new output created (hash(value + owner + randomness), stored in Merkle tree).
- **Nullifier** = old output marked as spent (hash(UTXO + secret), stored in Set).

---

## V. Zero-Knowledge Proofs

- ZKP: prove "I know X" without revealing X.
- Midnight uses **ZK-SNARKs**: small proof (~128 bytes core), fast verification (~6ms), non-interactive.

### Pipeline:
1. Compact code -> compiler -> arithmetic circuit + proving key (pk) + verifying key (vk) + ZKIR.
2. Prover (local proof server) uses pk + witness + circuit -> creates proof.
3. Verifier (on-chain node) uses vk + public input + proof -> accept/reject.

### Proving key vs Verifying key:
- **Proving key (pk)**: several MB, stored locally in keys/, used by proof server to create proof.
- **Verifying key (vk)**: several KB, stored on-chain as vkHash at deploy time, used by node to verify proof.
- Both are generated simultaneously from the same circuit by the compiler.

---

## VI. Theoretical Models

### Kachina
- Framework separating public state (on-chain) and private state (local).
- User sends command -> code runs locally -> creates public transcript + private transcript -> ZK proof -> submits proof + public transcript -> node verifies -> updates ledger.
- Node never sees private state or private transcript.

### Zswap
- Secure atomic swap based on Zcash Sapling.
- **Pedersen commitment**: C = v*G + r*H (homomorphic -- adding commitments = commitment of sum).
- **Aggregated randomness**: combines random factors to keep proof small when swapping multiple assets.

---

## VII. Compact — Smart Contract Language

### Characteristics:
- DSL resembling TypeScript, compiles into ZK circuit.
- Strongly statically typed.
- Bounded -- no while loops, recursion, or dynamic allocation.
- Only for loops with fixed iteration count.

### Primitive types:

| Compact            | TypeScript   | Description                         |
|--------------------|-------------|-------------------------------------|
| Boolean            | boolean     | true/false                          |
| Uint<n>            | bigint      | unsigned integer, n bits            |
| Uint<0..n>         | bigint      | bounded range 0 to n               |
| Field              | bigint      | prime field element (very large)    |
| Bytes<n>           | Uint8Array  | fixed-size byte array, n bytes     |
| Opaque<"string">   | string      | JS value, circuit only sees hash   |
| Opaque<"Uint8Array">| Uint8Array | JS value, circuit only sees hash   |
| [T, ...]           | tuple       | heterogeneous tuple                 |
| Vector<n, T>       | T[]         | homogeneous tuple                   |

### Opaque:
- "Opaque" -- circuit CANNOT read, compare, or process the inner value.
- Inside the circuit it exists only as a hash.
- Use when passing JS data into contract without needing logic processing.
- Need logic processing -> use Uint, Field, Bytes, Boolean instead.

### User-defined types:
- struct: like object, can be generic. E.g.: struct Pair<T> { first: T; second: T }
- enum: E.g.: enum State { VACANT, OCCUPIED }, access via State.VACANT
- contract: not fully implemented yet.

### Subtyping:
- Uint<0..5> is a subtype of Uint<0..100> is a subtype of Field.
- Tuple subtyping is element-wise.

### Circuit:
- = function, the main logic unit.
- **Pure circuit**: does not read/write ledger, does not call witness -> can be called off-chain.
- **Impure circuit**: reads/writes ledger or calls witness -> generates ZK proof when called.
- Exported at top-level = entry point of the contract.

### Statements:
- const (immutable), for (bounded loop), if/else, return, block { }.
- NO while, loop, or recursion.

### Module system:
- module M { export circuit f()... }, import M;
- Standard library: import CompactStandardLibrary;

### disclose():
- Required when writing private-derived values to the ledger.
- Compiler errors if missing.
- Values unrelated to private data (constants) don't need it.

---

## VIII. Ledger ADT — On-Chain Data Structures

Declaration: export ledger fieldName: ADTType;

### Cell<T> (implicit when using plain types)
- read(), write(value), resetToDefault().

### Counter
- increment(n), decrement(n), read(), lessThan(threshold).
- **Note:** n is Uint<16> -- max 65535 per call. This is a common gotcha.

### Set<T>
- insert(elem), member(elem), remove(elem), size(), isEmpty().
- Used for **nullifier set** -- only need to check presence, no need to hide elements.

### Map<K, V>
- insert(k, v), lookup(k), member(k), remove(k), size().
- **Note:** lookup() throws if key doesn't exist -- always check member() first.

### List<T>
- pushFront(v), popFront(), head(), length(), isEmpty().

### MerkleTree<n, T>
- Depth n (2 <= n <= 32), holds up to 2^n leaves.
- insert(item), checkRoot(root), isFull().
- TypeScript: findPathForLeaf(leaf), pathForLeaf(index, leaf), root(), firstFree().
- Only keeps the current root.
- Used for **commitment tree** -- prove membership without revealing which element.

### HistoricMerkleTree<n, T>
- Like MerkleTree but stores ALL historical roots.
- checkRoot(rt) accepts any historical root.
- resetHistory() clears history (keeps only current root).
- If resetHistory() is never called, history accumulates indefinitely.
- Used when **concurrent proofs** are needed -- multiple users prove simultaneously while tree is changing.

### Kernel Functions (System Calls)
- self(): contract address.
- balance(tokenType): token balance.
- blockTimeGreaterThan/LessThan(time): check block time.
- mintShieldedToken/mintUnshieldedToken(domainSep, amount, recipient): create new tokens. Returns token color.
- receiveUnshielded(color, amount): receive tokens into contract.
- sendUnshielded(color, amount, recipient): send tokens from contract.
- checkpoint(): mark atomic unit.

### Set vs MerkleTree -- when to use which:
- Need to hide which element -> MerkleTree.
- Only need presence check -> Set.

---

## IX. Witness — Bridge Between Secret and Circuit

### Declaration (Compact file):
  witness localSecretKey(): Bytes<32>;

### Implementation (TypeScript file -- witnesses.ts):
  export const witnesses = {
    localSecretKey: ({ privateState }: WitnessContext<Ledger, PrivateState>)
      => [privateState, privateState.secretKey],
  };

### WitnessContext:
- Automatically injected by SDK when circuit calls witness (developer does not call directly).
- Contains: current ledger state (read-only) + private state from local storage + contract address.
- Function returns [updatedPrivateState, witnessValue].

### When is private state saved?
- At contract deploy or user's first interaction, DApp code sets initialPrivateState: { secretKey: ..., salary: ... }.
- Subsequent calls: SDK reads from local storage and passes via WitnessContext.

---

## X. Privacy Patterns — 5 Core Techniques

### 1. Hash & Commitment
- Store hash(data) instead of data on ledger.
- On-chain only sees 32 bytes, cannot determine input (one-way hash).
- persistentHash(data): simple hash, same input -> same output. Use when data is already unique.
- persistentCommit(data, randomness): hash + randomness. Same data + different random -> different output. Prevents correlation.
- Data unique -> persistentHash. Data may repeat -> persistentCommit.

### 2. Authentication via Hash
- Hash secret key -> derive public key -> compare with public key on-chain.
- User provides secretKey via witness -> circuit derives publicKey = hash(secretKey) -> matches on-chain value.

### 3. Merkle Tree Membership
- Prove "I have an element in the set" without revealing which element.
- Uses MerkleTreePath in witness (local, private).

### 4. Commitment/Nullifier Pattern
- Commitment = "created something": hash of secret data, inserted into MerkleTree.
- Nullifier = "consumed something": different hash from same data + different domain separator, inserted into Set.
- Prove: commitment exists in tree + nullifier not yet in Set.
- Prevents double-spend / double-claim.

### 5. Domain Separator
- Different prefix for hashes used for different purposes.
- E.g.: "polypay:commit:" vs "polypay:null:".
- Prevents deriving commitment from nullifier or vice versa.

---

## XI. Compilation Output — 4 Folders

### contract/
- index.js, index.d.ts, index.js.map.
- Generated TypeScript API that mirrors circuit logic exactly.
- Used for DApp integration and offline unit testing.

### keys/
- <circuit>.prover (proving key, several MB, used by proof server).
- <circuit>.verifier (verifying key, several KB, stored on-chain).

### zkir/
- <circuit>.zkir (text) + <circuit>.bzkir (binary).
- Intermediate bytecode, proof server reads to understand circuit structure.

### compiler/
- contract-info.json: metadata (version, circuit names...).

---

## XII. Development Workflow

### Phase 1 — Write & Test Offline (no faucet/node needed)
- Write .compact -> compile -> implement witnesses.ts -> unit test with Vitest/Jest.
- Call circuit via contract.circuits.myCircuit(context, args).
- Generated index.js runs the exact same ZK circuit logic (same AST, different representation).
- Test passes -> on-chain also passes (logic is identical).
- Only difference: test uses fake state, on-chain uses real state.

### Phase 2 — Deploy (requires Docker proof server + faucet)
- Start proof server (Docker, port 6300).
- **CLI flow:** utils.ts configures network, derives HD keys -> 3 sub-wallets (Shielded/Unshielded/Dust), creates 6 providers. deploy.ts: create wallet -> fund tNIGHT from faucet -> register DUST -> call deployContract() -> save contract address.
- **Web flow:** Lace DApp Connector handles wallet, keys, and signing. Providers are constructed from wallet config (indexerUri, proverServerUri). No HD key derivation needed -- Lace manages keys internally.

### Phase 3 — Interact (CLI or Web)
- CLI: findDeployedContract(providers, { contractAddress, ... }) -> contract.callTx.myCircuit(args).
- SDK automatic flow: run circuit locally -> proof server creates proof -> balance tx (DUST fee) -> submit -> wait for confirmation.
- Read state: publicDataProvider.queryContractState(address) -> ledger(state.data).
- Web: React + @midnight-ntwrk/dapp-connector-api -> window.midnight.mnLace -> wallet.connect('preprod').

### Phase 4 — Production
- Proof server must be local or on a server you control via encrypted channel.
- DUST sponsorship: employer pays fee for employee.

---

## XIII. 6 Required Providers

1. **privateStateProvider** -- read/write private state from local storage (LevelDB for CLI, in-memory for web).
2. **publicDataProvider** -- read on-chain state from Indexer GraphQL.
3. **zkConfigProvider** -- load pk/vk/zkir from compiled folder.
4. **proofProvider** -- communicate with proof server (localhost:6300).
5. **walletProvider** -- balance transaction (add DUST fee inputs/outputs) and sign. For web: Lace wallet handles both balancing and signing internally via `balanceUnsealedTransaction()`.
6. **midnightProvider** -- submit transaction to node RPC.

Remember by flow: privateState (get secret) -> zkConfig (load circuit) -> proof (create proof) -> publicData (read state) -> wallet (balance + sign) -> midnight (submit).

---

## XIV. Midnight vs EVM Comparison

| Aspect             | EVM (Ethereum)                | Midnight                          |
|--------------------|-------------------------------|-----------------------------------|
| Data               | Everything public             | Developer chooses public/private  |
| Execution          | Node re-executes logic        | Node only verifies proof          |
| Deploy             | Send bytecode on-chain        | Send verifying key on-chain       |
| Fee                | Gas (auction-based, variable) | DUST (fixed, no auction)          |
| State model        | Account (global balance)      | UTXO (discrete coins)            |
| Contract language  | Solidity/Vyper                | Compact                          |
| Testing            | Hardhat (local EVM)           | Vitest + generated index.js      |
| Wallet             | MetaMask                      | Lace (Chrome extension, beta)    |
| Secret data        | No native support             | Witness + private state + ZKP    |
| Deploy size limit  | ~24KB bytecode                | ~12-13 circuits per deploy tx    |

---

## XV. Contract Token

- Write a Compact contract defining token logic -> deploy -> contract manages supply, balances, transfers.
- Like ERC-20 but can combine with ZKP to hide balance, sender/recipient.

### Two approaches:
- **Map-based** (simple, ERC-20-like, flexible): Store balances in Map<Bytes<32>, Uint<64>>. Balances are public on ledger.
- **Kernel mint** (UTXO-based, privacy-native): Use `mintUnshieldedToken(domainSep, amount, recipient)` or `mintShieldedToken()`. Token lives in the UTXO system. Returns a `tokenColor` (Bytes<32>) that uniquely identifies the token type. Use `receiveUnshielded(color, amount)` / `sendUnshielded(color, amount, recipient)` for contract-held token transfers.

---

## XVI. Proof Server

- Runs in Docker container (midnightntwrk/proof-server:8.0.3), port 6300.
- Receives private data from DApp, creates ZK proof locally, returns proof.
- Does NOT open network connections outward -- only listens for requests.
- Remote proof server exists for testing convenience, DO NOT use in production.
- Production: always local or on a server you control via encrypted channel.

---

## XVII. Wallet — Lace

- Chrome extension, currently in Beta.
- Create Cardano wallet first -> Settings -> enable Beta features -> add Midnight wallet.
- Has 2 tabs: Cardano (addr_test1...) and Midnight (different address). Faucet only accepts Midnight address.
- 3 sub-wallets: Shielded (private coins), Unshielded (NIGHT/tNIGHT), Dust (DUST fee).
- Faucet sends tNIGHT to unshielded address -> can shield for privacy if needed.

### DApp Connector API (browser):
  const wallet = window.midnight.mnLace;
  const connectedApi = await wallet.connect('preprod');
  const addresses = await connectedApi.getShieldedAddresses();

- Package: @midnight-ntwrk/dapp-connector-api
- Next.js requires "use client" directive.

---

## XVIII. Compatibility Matrix (Current Stable)

| Component          | Version |
|--------------------|---------|
| Ledger             | 8.0.3   |
| Node               | 0.22.2  |
| Proof Server       | 8.0.3   |
| Compact Compiler   | 0.30.0  |
| Compact Runtime    | 0.15.0  |
| Compact JS         | 2.5.0   |
| Indexer            | 4.0.0   |
| Midnight JS SDK    | 4.0.2   |
| Wallet SDK Facade  | 3.0.0   |
| DApp Connector API | 4.0.1   |

Two test environments:
- Preview: early testing, may be reset.
- Preprod: staging, more stable.

---

## XIX. PolyPay — Private Multisig Wallet

### What it is
A privacy-preserving multisig wallet where signers are identified by ZK commitments (hash of secret), not public keys. Nobody on-chain can tell which signer approved which transaction.

### Architecture
- **polypay.compact** (15 circuits): multisig logic -- setup, deposit, propose, approve, execute.
- **token.compact** (3 circuits): token minting via `mintUnshieldedToken()`.
- **Web UI**: React + Vite + Tailwind + Lace DApp Connector.

### Privacy Model

| Private (ZK protected) | Public (on-chain) |
|---|---|
| Signer identity (secret never leaves browser) | Signer commitments (hashes, not linked to identity) |
| Who approved which transaction (nullifiers are unlinkable) | Approval count per transaction |
| Which signer executed a transaction | Transfer amounts and recipients |
| | Threshold value, token vault balance |

### Ledger ADTs used:
- Set<Bytes<32>>: signer set + nullifier set (anti-double-approve).
- Map<Uint<64>, ...>: transaction queue (types, statuses, params).
- Counter: signer count, tx counter, approval counts.

### Flow:

**Setup Phase (3-phase, due to ~13 circuit deploy limit + no dynamic-length params):**
1. Deploy(threshold, tokenColor) -- deployer becomes first signer.
2. initSigner(commitment) -- owner adds other signers (repeat).
3. finalize() -- locks contract, clears owner privilege.

**Operational Phase:**
4. deposit(amount) -- anyone deposits native tokens into vault via receiveUnshielded().
5. propose*(params) -- signer creates proposal, auto-approves (count=1).
6. approveTx(txId) -- other signers approve (nullifier prevents double-vote).
7. execute*(txId) -- signer executes when approvals >= threshold.

### Key Design Decisions:
- **Execute circuits require witness** (ADR-001): Compact compiler produces invalid proofs for witness-free circuits with complex cross-map writes. Adding signer verification fixed it.
- **Secret in localStorage** (ADR-002): BIP-340 Schnorr signatures are non-deterministic, HD seed inaccessible from dApp connector. Secret derived once via signData, then persisted.
- **3-phase setup** (ADR-003): Circuit deploy limit ~13, Compact has no variable-length constructor params.
- **Threshold stays public** (ADR-005): Observable execution pattern leaks threshold regardless of on-chain hiding.
- **withdraw circuit removed**: Dropped to fit within circuit count limit after adding signer checks.

### Data Location:

| Data                        | Location                      |
|-----------------------------|-------------------------------|
| Signer commitments          | On-chain (Set)                |
| Nullifiers                  | On-chain (Set)                |
| Transaction queue           | On-chain (Maps)               |
| Threshold, signer count     | On-chain (ledger fields)      |
| Token color                 | On-chain (ledger field)       |
| Signer secret key           | Local (localStorage)          |
| ZK proofs                   | On-chain (verified then discarded) |
| Verifying keys              | On-chain (permanent)          |
| Proving keys, ZKIR          | Local (proof server reads)    |

---

## XX. Known Limitations & Gotchas

1. **Deploy circuit limit**: ~12-13 impure circuits max per deploy transaction. Undocumented, discovered empirically. Exceeding causes transaction submission failure.
2. **Counter.increment() takes Uint<16>**: max 65535 per call.
3. **Map.lookup() throws if key doesn't exist**: always check member() first.
4. **`from` is a reserved keyword in Compact**: use `sender` instead.
5. **Addition of two Uint<64> values produces wider type**: cast with `as Uint<64>`.
6. **Witness-free circuits with complex cross-map writes produce invalid proofs**: always include a witness call (e.g., localSecret()) in circuits that write derived values across maps.
7. **MerkleTreePath verification**: use `merkleTreePathRoot<n, T>(path)` then `checkRoot(disclose(root))`.
8. **All witness-derived values used in ledger operations need disclose()**.
9. **DUST balance check first**: when a transaction fails with Wallet.Transacting error, check DUST balance before deep debugging.

---

## XXI. Quiz — Key Points to Remember

1. 3 layers: on-chain (public ledger) / ZK circuit (prove/verify) / local (private state + witness + proof server).
2. pk creates proof (local), vk verifies proof (on-chain). Both generated from same circuit.
3. NIGHT is transferable, generates DUST. DUST is not transferable, pays fees.
4. disclose() is mandatory when writing private-derived values to ledger.
5. MerkleTree: 1 current root. HistoricMerkleTree: stores all historical roots.
6. Witness: declared in Compact, implemented in TypeScript, SDK calls automatically via WitnessContext.
7. Commitment = "created" (MerkleTree). Nullifier = "consumed" (Set).
8. Compile output: contract/ (TS API), keys/ (pk+vk), zkir/ (bytecode), compiler/ (metadata).
9. 6 providers: privateState, publicData, zkConfig, proof, wallet, midnight.
10. callTx flow: circuit local -> proof server -> balance tx (DUST) -> sign -> submit -> node verify -> update ledger.
11. UTXO: commitment = new output, nullifier = old output spent.
12. Proof server: always local for production, never use remote.
13. Opaque: circuit only sees hash, cannot read/compare/process.
14. No while/recursion -- circuits must be bounded.
15. Ethereum deploys bytecode + node re-executes logic. Midnight deploys vk + node only verifies proof.
16. Unit tests run index.js (same logic as circuit, different representation). Fake state vs real state.
17. Lace wallet connects via window.midnight.mnLace + DApp Connector API.
18. Nullifier -> Set (presence check). Commitment -> MerkleTree (prove membership, hide position).
19. persistentHash (data unique). persistentCommit (data repeatable, needs randomness to prevent correlation).
20. Deploy limit: ~12-13 circuits max per deploy transaction (empirically discovered).
21. receiveUnshielded/sendUnshielded for contract-held token transfers. mintUnshieldedToken returns tokenColor.
22. Web DApps use Lace DApp Connector (no HD key derivation). CLI DApps derive HD keys directly.
