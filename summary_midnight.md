# Midnight Blockchain — Toàn bộ kiến thức từ Docs + Thảo luận + Quiz

---

## I. Midnight là gì?

- Blockchain tập trung vào **privacy**, cho phép developer lập trình mức độ privacy ở cấp smart contract.
- Là **Cardano Partnerchain**, xây trên Polkadot SDK, kết nối Cardano qua bridge.
- Block time: 6 giây.
- Node dùng: sr25519 (block authorship), ed25519 (finality), ECDSA (consensus).

---

## II. Kiến trúc 3 lớp của mỗi DApp

### Lớp 1 — Public Ledger (on-chain)
- Dữ liệu public: ledger fields, verifying key, nullifier set, commitment tree root.
- Node chỉ verify proof, không chạy lại logic.

### Lớp 2 — ZK Circuit (proving/verifying)
- Logic contract compile thành arithmetic circuit.
- Proving key + circuit chạy local (proof server) → tạo proof.
- Verifying key lưu on-chain → node verify proof.
- Cầu nối giữa local và on-chain.

### Lớp 3 — Off-chain local (private)
- Secret data lưu trên máy user (LevelDB).
- Witness functions chạy local, cung cấp secret cho circuit.
- Proof server chạy ở đây.
- Private state không bao giờ lên chain.

**Flow tổng quát:** Circuit nhận input (witness secret + public data từ ledger) → xử lý logic local → tạo proof + public transcript → gửi lên chain → node verify bằng verifying key → valid thì update ledger.

---

## III. Token

### NIGHT
- Token gốc, transferable.
- Dùng cho governance, staking, sinh DUST.
- 1 NIGHT = 10^6 STAR.

### DUST
- Token phí, shielded, **không transferable**.
- Mọi transaction đều tốn DUST.
- Sinh tự động từ NIGHT holdings sau khi register.
- 1 DUST = 10^15 SPECK.
- Wallet SDK tự tính fee, không có gas auction như EVM.

### DUST Registration
- Cách 1: Lace Wallet UI → bấm generate DUST.
- Cách 2: Trong code → wallet.registerNightUtxosForDustGeneration(...).
- Phải register NIGHT UTXOs trước, chờ DUST > 0 rồi mới deploy/gọi contract.

---

## IV. UTXO Model

- Midnight dùng UTXO giống Bitcoin/Cardano (không dùng Account model như Ethereum).
- Mỗi "coin" là một Unspent Transaction Output.
- Khi gửi tiền: tiêu cả UTXO cũ → tạo UTXO mới (payment + change).
- UTXO cũ bị hủy bằng **nullifier** = hash(UTXO + secret) → đưa vào nullifier set → ngăn double-spend mà không tiết lộ UTXO nào bị tiêu.
- Ưu điểm: xử lý song song, privacy per-UTXO, state bounded.

### Hai loại token:
- **Ledger Token** (NIGHT/DUST): UTXO-based, privacy-native.
- **Contract Token**: account-based, ERC-20-like, viết Compact contract với Map balances.

### UTXO context:
- **Commitment** = output mới được tạo ra (hash(value + owner + randomness), lưu vào Merkle tree).
- **Nullifier** = đánh dấu output cũ đã bị tiêu (hash(UTXO + secret), lưu vào Set).

---

## V. Zero-Knowledge Proofs

- ZKP: chứng minh "tôi biết X" mà không tiết lộ X.
- Midnight dùng **ZK-SNARKs**: proof nhỏ (~128 bytes core), verify nhanh (~6ms), non-interactive.

### Pipeline:
1. Compact code → compiler → arithmetic circuit + proving key (pk) + verifying key (vk) + ZKIR.
2. Prover (proof server local) dùng pk + witness + circuit → tạo proof.
3. Verifier (node on-chain) dùng vk + public input + proof → accept/reject.

### Proving key vs Verifying key:
- **Proving key (pk)**: vài MB, lưu local trong keys/, dùng bởi proof server để tạo proof.
- **Verifying key (vk)**: vài KB, lưu on-chain dưới dạng vkHash lúc deploy, dùng bởi node để verify proof.
- Cả hai sinh ra cùng lúc từ cùng một circuit bởi compiler.

---

## VI. Mô hình lý thuyết

### Kachina
- Framework tách public state (on-chain) và private state (local).
- User gửi lệnh → code chạy local → tạo public transcript + private transcript → ZK proof → submit proof + public transcript → node verify → update ledger.
- Node không bao giờ thấy private state hay private transcript.

### Zswap
- Atomic swap bảo mật dựa trên Zcash Sapling.
- **Pedersen commitment**: C = v·G + r·H (homomorphic — cộng commitment = commitment của tổng).
- **Aggregated randomness**: gộp random factors để giữ proof nhỏ khi swap nhiều asset.

---

## VII. Compact — Ngôn ngữ smart contract

### Đặc điểm:
- DSL giống TypeScript, compile thành ZK circuit.
- Strongly statically typed.
- Bounded — không có while loop, recursion, dynamic allocation.
- Chỉ có for loop với số lần lặp cố định.

### Primitive types:

| Compact            | TypeScript   | Mô tả                              |
|--------------------|-------------|-------------------------------------|
| Boolean            | boolean     | true/false                          |
| Uint<n>            | bigint      | unsigned integer n bits             |
| Uint<0..n>         | bigint      | bounded range 0 đến n              |
| Field              | bigint      | prime field element (rất lớn)       |
| Bytes<n>           | Uint8Array  | byte array cố định n bytes         |
| Opaque<"string">   | string      | giá trị JS, trong circuit chỉ là hash |
| Opaque<"Uint8Array">| Uint8Array | giá trị JS, trong circuit chỉ là hash |
| [T, ...]           | tuple       | heterogeneous tuple                 |
| Vector<n, T>       | T[]         | homogeneous tuple                   |

### Opaque:
- "Mờ đục" — circuit KHÔNG THỂ đọc, so sánh, hay xử lý giá trị bên trong.
- Trong circuit chỉ tồn tại dưới dạng hash.
- Dùng khi muốn truyền dữ liệu JS vào contract mà không cần xử lý logic.
- Cần xử lý logic → dùng Uint, Field, Bytes, Boolean.

### User-defined types:
- struct: giống object, có thể generic. VD: struct Pair<T> { first: T; second: T }
- enum: VD: enum State { VACANT, OCCUPIED }, truy cập State.VACANT
- contract: chưa implement xong.

### Subtyping:
- Uint<0..5> ⊂ Uint<0..100> ⊂ Field.
- Tuple subtyping theo từng element.

### Circuit:
- = function, đơn vị logic chính.
- **Pure circuit**: không đọc/ghi ledger, không gọi witness → gọi được ngoài chain.
- **Impure circuit**: đọc/ghi ledger hoặc gọi witness → tạo ZK proof khi gọi.
- Export ở top-level = entry point của contract.

### Statement:
- const (bất biến), for (bounded loop), if/else, return, block { }.
- KHÔNG có while, loop, recursion.

### Module system:
- module M { export circuit f()... }, import M;
- Standard library: import CompactStandardLibrary;

### disclose():
- Bắt buộc khi ghi giá trị derived từ private data vào ledger.
- Compiler báo lỗi nếu thiếu.
- Giá trị không liên quan private data (constant) → không cần.

---

## VIII. Ledger ADT — Cấu trúc dữ liệu on-chain

Khai báo: export ledger fieldName: ADTType;

### Cell<T> (implicit khi dùng type thường)
- read(), write(value), resetToDefault().

### Counter
- increment(n), decrement(n), read(), lessThan(threshold).

### Set<T>
- insert(elem), member(elem), remove(elem), size(), isEmpty().
- Dùng cho **nullifier set** — chỉ cần check có/không, không cần giấu phần tử.

### Map<K, V>
- insert(k, v), lookup(k), member(k), remove(k), size().

### List<T>
- pushFront(v), popFront(), head(), length(), isEmpty().

### MerkleTree<n, T>
- Depth n (2 ≤ n ≤ 32), chứa tối đa 2^n leaf.
- insert(item), checkRoot(root), isFull().
- TypeScript: findPathForLeaf(leaf), pathForLeaf(index, leaf), root(), firstFree().
- Chỉ giữ 1 root hiện tại.
- Dùng cho **commitment tree** — prove membership mà không tiết lộ phần tử nào.

### HistoricMerkleTree<n, T>
- Giống MerkleTree nhưng lưu TẤT CẢ root cũ.
- checkRoot(rt) chấp nhận bất kỳ root lịch sử nào.
- resetHistory() để dọn history (chỉ giữ root hiện tại).
- Nếu không gọi resetHistory(), history tích lũy mãi.
- Dùng khi cần **concurrent proof** — nhiều user prove cùng lúc dù tree đang thay đổi.

### Kernel (hàm hệ thống)
- self(): contract address.
- balance(tokenType): số dư token.
- blockTimeGreaterThan/LessThan(time): kiểm tra thời gian block.
- mintShielded/mintUnshielded(domainSep, amount): tạo token mới.
- incUnshieldedInputs/Outputs(tokenType, amount): nhận/gửi token.
- checkpoint(): đánh dấu atomic unit.

### Set vs MerkleTree — khi nào dùng cái nào:
- Cần giấu phần tử nào → MerkleTree.
- Chỉ cần check có/không → Set.

---

## IX. Witness — Cầu nối secret ↔ circuit

### Khai báo (Compact file):
  witness localSecretKey(): Bytes<32>;

### Implement (TypeScript file — witnesses.ts):
  export const witnesses = {
    localSecretKey: ({ privateState }: WitnessContext<Ledger, PrivateState>)
      => [privateState, privateState.secretKey],
  };

### WitnessContext:
- Do SDK tự động inject khi circuit gọi witness (developer không gọi trực tiếp).
- Chứa: ledger state hiện tại (read-only) + private state từ LevelDB local + contract address.
- Hàm trả về [updatedPrivateState, witnessValue].

### Private state lưu vào LevelDB khi nào?
- Lúc deploy contract hoặc user tương tác lần đầu, DApp code gọi initialPrivateState: { secretKey: ..., salary: ... }.
- Các lần sau SDK tự đọc từ LevelDB và truyền qua WitnessContext.

---

## X. Privacy Patterns — 5 kỹ thuật chính

### 1. Hash & Commitment
- Lưu hash(data) thay vì data lên ledger.
- On-chain chỉ thấy 1 chuỗi 32 bytes, không biết input là gì (one-way hash).
- persistentHash(data): hash đơn giản, cùng input → cùng output. Dùng khi data đã unique.
- persistentCommit(data, randomness): hash + randomness. Cùng data + khác random → output khác. Ngăn correlation.
- Data unique → persistentHash. Data có thể trùng → persistentCommit.

### 2. Authentication qua hash
- Hash secret key → derive public key → so sánh với public key on-chain.
- Employee cung cấp secretKey qua witness → circuit derive publicKey = hash(secretKey) → so khớp.

### 3. Merkle Tree membership
- Prove "tôi có phần tử trong tập" mà không tiết lộ phần tử nào.
- Dùng MerkleTreePath trong witness (local, private).

### 4. Commitment/Nullifier pattern
- Commitment = "đã tạo": hash của dữ liệu bí mật, insert vào MerkleTree.
- Nullifier = "đã tiêu": hash khác từ cùng dữ liệu + domain separator khác, insert vào Set.
- Prove: commitment tồn tại trong tree + nullifier chưa tồn tại trong Set.
- Ngăn double-spend / double-claim.

### 5. Domain separator
- Prefix khác nhau cho hash dùng cho mục đích khác nhau.
- VD: "polypay:commit:" vs "polypay:null:".
- Ngăn suy ra commitment từ nullifier hay ngược lại.

---

## XI. Compilation Output — 4 folder

### contract/
- index.js, index.d.ts, index.js.map.
- Generated TypeScript API mirror chính xác logic circuit.
- Dùng cho DApp integration và unit test offline.

### keys/
- <circuit>.prover (proving key, vài MB, dùng bởi proof server).
- <circuit>.verifier (verifying key, vài KB, lưu on-chain).

### zkir/
- <circuit>.zkir (text) + <circuit>.bzkir (binary).
- Bytecode trung gian, proof server đọc để biết cấu trúc circuit.

### compiler/
- contract-info.json: metadata (version, circuit names...).

---

## XII. Development Workflow

### Phase 1 — Viết & Test offline (không cần faucet/node)
- Viết .compact → compile → implement witnesses.ts → unit test bằng Vitest/Jest.
- Gọi circuit qua contract.circuits.myCircuit(context, args).
- Generated index.js chạy chính xác logic ZK circuit (cùng AST, khác biểu diễn).
- Test pass → on-chain cũng pass (logic đồng nhất).
- Khác biệt duy nhất: test dùng state giả, on-chain dùng state thật.

### Phase 2 — Deploy (cần Docker proof server + faucet)
- Start proof server (Docker, port 6300).
- utils.ts: config mạng, derive HD keys → 3 sub-wallet (Shielded/Unshielded/Dust), tạo 6 providers.
- deploy.ts: tạo wallet → fund tNIGHT từ faucet → register DUST → gọi deployContract() → lưu contract address vào deployment.json.

### Phase 3 — Interact (CLI hoặc Web)
- CLI: findDeployedContract(providers, { contractAddress, ... }) → contract.callTx.myCircuit(args).
- SDK tự động: chạy circuit local → proof server tạo proof → balance tx (DUST fee) → ký → submit → chờ confirm.
- Đọc state: publicDataProvider.queryContractState(address) → ledger(state.data).
- Web: React/Next.js + @midnight-ntwrk/dapp-connector-api → window.midnight.mnLace → wallet.connect('preprod').

### Phase 4 — Production
- Proof server luôn local hoặc server bạn kiểm soát qua encrypted channel.
- DUST sponsorship: employer trả fee cho employee.

---

## XIII. 6 Providers cần thiết

1. **privateStateProvider** — đọc/ghi private state từ LevelDB local.
2. **publicDataProvider** — đọc on-chain state từ Indexer GraphQL.
3. **zkConfigProvider** — load pk/vk/zkir từ folder compiled.
4. **proofProvider** — giao tiếp với proof server (localhost:6300).
5. **walletProvider** — balance transaction (tính DUST fee), ký transaction.
6. **midnightProvider** — submit transaction lên node RPC.

Cách nhớ theo flow: privateState (lấy secret) → zkConfig (load circuit) → proof (tạo proof) → publicData (đọc state) → wallet (ký + balance) → midnight (submit).

---

## XIV. So sánh Midnight vs EVM

| Tiêu chí          | EVM (Ethereum)                | Midnight                          |
|--------------------|-------------------------------|-----------------------------------|
| Data               | Mọi thứ public               | Developer chọn public/private     |
| Execution          | Node chạy lại logic           | Node chỉ verify proof             |
| Deploy             | Gửi bytecode on-chain         | Gửi verifying key on-chain        |
| Fee                | Gas (auction-based, biến động)| DUST (cố định, không auction)     |
| State model        | Account (global balance)      | UTXO (discrete coins)             |
| Contract language  | Solidity/Vyper                | Compact                           |
| Testing            | Hardhat (local EVM)           | Vitest + generated index.js       |
| Wallet             | MetaMask                      | Lace (Chrome extension, beta)     |
| Secret data        | Không hỗ trợ native           | Witness + private state + ZKP     |

---

## XV. Contract Token

- Viết Compact contract define logic cho token → deploy → contract quản lý supply, balances, transfer.
- Giống ERC-20 nhưng có thể kết hợp ZKP để giấu balance, giấu người gửi/nhận.
- Cách 1: Map-based (đơn giản, giống ERC-20, linh hoạt).
- Cách 2: Kernel mint — mintShielded/mintUnshielded → token sống trong UTXO system, privacy native.

---

## XVI. Proof Server

- Chạy trong Docker container (midnightntwrk/proof-server:8.0.3), port 6300.
- Nhận private data từ DApp, tạo ZK proof local, trả proof lại.
- KHÔNG mở kết nối mạng ra ngoài — chỉ lắng nghe request.
- Remote proof server tồn tại để tiện test, KHÔNG dùng cho production.
- Production: luôn local hoặc server bạn kiểm soát qua encrypted channel.

---

## XVII. Wallet — Lace

- Chrome extension, đang ở bản Beta.
- Tạo Cardano wallet trước → Settings → bật Beta features → thêm wallet Midnight.
- Có 2 tab: Cardano (addr_test1...) và Midnight (địa chỉ khác). Faucet chỉ nhận Midnight address.
- 3 sub-wallet: Shielded (private coins), Unshielded (NIGHT/tNIGHT), Dust (DUST fee).
- Faucet gửi tNIGHT vào unshielded address → shield được nếu muốn privacy.

### DApp Connector API (browser):
  const wallet = window.midnight.mnLace;
  const connectedApi = await wallet.connect('preprod');
  const addresses = await connectedApi.getShieldedAddresses();

- Package: @midnight-ntwrk/dapp-connector-api
- Next.js cần "use client" directive.

---

## XVIII. Compatibility Matrix (stable hiện tại)

| Component          | Version |
|--------------------|---------|
| Ledger             | 8.0.3   |
| Node               | 0.22.2  |
| Proof Server       | 8.0.3   |
| Compact Compiler   | 0.30.0  |
| Compact Runtime    | 0.15.0  |
| Indexer            | 4.0.0   |
| Midnight.js        | 4.0.1   |
| Wallet SDK Facade  | 3.0.0   |
| DApp Connector API | 4.0.1   |

Hai môi trường test:
- Preview: thử nghiệm sớm, có thể reset.
- Preprod: staging, ổn định hơn.

---

## XIX. PolyPay — Thiết kế sơ bộ

### Ledger ADT cần dùng:
- HistoricMerkleTree<32, Bytes<32>>: commitment tree (employer commit salary).
- Set<Bytes<32>>: nullifier set (ngăn employee claim 2 lần).
- Counter: payroll period tracker.
- Kernel.blockTimeGreaterThan/LessThan: enforce deadline claim lương.

### Flow:

**Bước 1 — Employer commit lương:**
- Employer biết publicKey của employee (đăng ký khi onboard) + salary + period.
- Tính commitment = persistentHash(publicKey + salary + period).
- Gọi circuit commitSalary(commitment) → insert vào HistoricMerkleTree on-chain.

**Bước 2 — Employee claim lương:**
- Employee cung cấp secretKey + salary + period qua witness (local).
- Circuit derive publicKey = persistentHash(secretKey).
- Circuit tính lại commitment = persistentHash(publicKey + salary + period).
- Prove commitment tồn tại trong HistoricMerkleTree (qua MerkleTreePath).
- Tính nullifier = persistentHash("polypay:null:" + employeeId + period + secretKey).
- Kiểm tra nullifier chưa tồn tại trong Set.
- Insert nullifier vào Set → transfer token → done.

**Bước 3 — Claim lần 2 → reject:**
- Cùng nullifier → đã tồn tại trong Set → assert fail → transaction fail.

### Data location:

| Data                        | Ở đâu                        |
|-----------------------------|-------------------------------|
| Commitment hash             | On-chain (HistoricMerkleTree) |
| Nullifier hash              | On-chain (Set)                |
| Payroll period              | On-chain (Counter)            |
| Salary, employeeId          | Local (LevelDB)               |
| Secret key                  | Local (LevelDB)               |
| Proof                       | On-chain (verify rồi bỏ)     |
| Verifying key               | On-chain (lưu vĩnh viễn)     |
| Proving key, ZKIR           | Local (proof server đọc)      |

### DUST sponsorship:
- Employer trả DUST fee cho employee.
- Employee không cần hold NIGHT/DUST.

### resetHistory():
- Gọi đầu mỗi kỳ lương mới để dọn Merkle tree history.
- Employee chưa claim trước reset → không claim được nữa (enforce deadline).

---

## XX. Quiz — Các điểm cần nhớ

1. 3 lớp: on-chain (public ledger) / ZK circuit (prove/verify) / local (private state + witness + proof server).
2. pk tạo proof (local), vk verify proof (on-chain). Cả hai sinh từ cùng circuit.
3. NIGHT transferable, sinh DUST. DUST không transferable, dùng trả fee.
4. disclose() bắt buộc khi ghi private-derived value lên ledger.
5. MerkleTree: 1 root hiện tại. HistoricMerkleTree: lưu tất cả root cũ.
6. Witness: khai báo ở Compact, implement ở TypeScript, SDK tự gọi qua WitnessContext.
7. Commitment = "đã tạo" (MerkleTree). Nullifier = "đã tiêu" (Set).
8. Compile output: contract/ (TS API), keys/ (pk+vk), zkir/ (bytecode), compiler/ (metadata).
9. 6 providers: privateState, publicData, zkConfig, proof, wallet, midnight.
10. callTx flow: circuit local → proof server → balance tx (DUST) → ký → submit → node verify → update ledger.
11. UTXO: commitment = output mới, nullifier = output cũ đã tiêu.
12. Proof server: luôn local cho production, không dùng remote.
13. Opaque: circuit chỉ thấy hash, không đọc/so sánh/xử lý được.
14. Không có while/recursion — circuit phải bounded.
15. Ethereum deploy bytecode + node chạy lại logic. Midnight deploy vk + node chỉ verify proof.
16. Unit test chạy index.js (cùng logic với circuit, khác biểu diễn). State giả vs state thật.
17. Lace wallet connect qua window.midnight.mnLace + DApp Connector API.
18. Nullifier → Set (check có/không). Commitment → MerkleTree (prove membership giấu vị trí).
19. persistentHash (data unique). persistentCommit (data trùng, cần randomness ngăn correlation).
20. PolyPay: employer commit bằng publicKey employee, employee prove bằng secretKey derive ra publicKey.
