# Prompt cho Claude Code — Midnight Blockchain Examples

---

## Role

Bạn là Midnight blockchain developer. Bạn sẽ tạo 5 example project từ dễ đến khó để học Compact smart contract language trên Midnight. Mỗi example thêm concept mới, chuẩn bị cho việc build PolyPay (private payroll system).

---

## Bước 0 — Setup Reference Material

### Clone 3 repo example chính thức vào folder references/:

mkdir -p references
git clone https://github.com/midnightntwrk/example-hello-world.git references/example-hello-world
git clone https://github.com/midnightntwrk/example-counter.git references/example-counter
git clone https://github.com/midnightntwrk/example-bboard.git references/example-bboard

### Đọc thêm docs nếu cần (fetch URL):
- Compact language reference: https://docs.midnight.network/compact/reference/lang-ref
- Ledger ADT: https://docs.midnight.network/compact/data-types/ledger-adt
- JS implementation guide: https://docs.midnight.network/guides/use-compact-javascript-implementation
- Compact JS runtime guide: https://docs.midnight.network/guides/compact-javascript-runtime
- React wallet connector: https://docs.midnight.network/guides/react-wallet-connect
- Deploy guide: https://docs.midnight.network/guides/deploy-mn-app
- Interact guide: https://docs.midnight.network/guides/interact-with-mn-app

### Đọc file MIDNIGHT_KNOWLEDGE.md trong root folder — đây là tài liệu tổng hợp toàn bộ kiến thức Midnight. LUÔN tham khảo file này trước khi viết code.

---

## Quy tắc bắt buộc

1. KHÔNG đoán syntax Compact. Luôn tham khảo references/ repos và MIDNIGHT_KNOWLEDGE.md. Compact KHÔNG phải Solidity, KHÔNG phải Rust, KHÔNG phải TypeScript thông thường.

2. Trước khi viết bất kỳ .compact file nào, ĐỌC KỸ các file .compact trong references/ để hiểu syntax thật.

3. Check compiler version bằng: compact compile --version. Dùng pragma language_version tương thích.

4. Standard library: luôn import CompactStandardLibrary; khi cần dùng Counter, Set, Map, MerkleTree, persistentHash, v.v.

5. Mỗi example là 1 folder riêng trong examples/ folder.

6. Unit test pattern: tạo Contract instance với witnesses → tạo context giả (originalState, privateState, contractAddress, transactionContext) → gọi circuit → assert kết quả. Tham khảo references/example-bboard/contract/src/test/ cho pattern chính xác.

7. CLI pattern: tham khảo references/example-counter/counter-cli/ và references/example-bboard/bboard-cli/ cho cấu trúc, wallet setup, provider config, deploy, interact.

8. Web UI pattern: dùng Vite + React + TypeScript + @midnight-ntwrk/dapp-connector-api. Tham khảo React wallet connector guide ở link trên.

9. Khi compile contract, chạy: compact compile contract/src/<name>.compact contract/src/managed/<name>

10. Mọi dependencies @midnight-ntwrk/* phải dùng version tương thích. Tham khảo package.json trong references/ repos để lấy đúng version.

---

## Cấu trúc mỗi Example

examples/<NN>-<name>/
  contract/
    src/
      <name>.compact          -- smart contract
      witnesses.ts            -- witness implementation (nếu có)
      index.ts                -- re-export generated API
      managed/                -- generated sau khi compile (KHÔNG tạo tay)
    package.json              -- scripts: clean, compile, build
    tsconfig.json
  cli/
    src/
      config.ts               -- network endpoints, paths
      utils.ts                -- wallet, providers, helpers
      deploy.ts               -- deploy script
      cli.ts                  -- interactive CLI (menu)
      index.ts                -- entry point
    package.json              -- scripts: deploy, cli, start-proof-server
    tsconfig.json
  web/                        -- CHỈ cho example 3, 4, 5
    src/
      App.tsx                 -- main app
      components/
        ConnectWallet.tsx      -- Lace wallet connector
        <feature>.tsx          -- feature-specific components
      hooks/
        useContract.ts         -- contract interaction hook
      config.ts               -- network config
    package.json
    tsconfig.json
    vite.config.ts
    index.html
  test/
    <name>.test.ts            -- unit test offline (Vitest)
    vitest.config.ts
    package.json              -- scripts: test
    tsconfig.json
  README.md                   -- giải thích concept, flow, hướng dẫn chạy
  package.json                -- root workspace package.json

---

## 5 Examples chi tiết

---

### Example 1: simple-counter
Folder: examples/01-simple-counter/
Có: Contract + Test + CLI
Không có: Web UI

#### Concept mới:
- Ledger field cơ bản
- Counter ADT (increment, decrement, read)
- Impure circuit (export circuit)
- Compile output (contract/, keys/, zkir/, compiler/)
- Unit test offline với generated index.js
- CLI deploy + interact trên Preprod

#### Contract (simple-counter.compact):
- pragma language_version 0.22;
- import CompactStandardLibrary;
- export ledger round: Counter;
- export circuit increment(): [] { round.increment(1); }
- export circuit decrement(): [] { round.decrement(1); }
- export circuit read_counter(): Uint<64> { return round.read(); }

#### Witnesses: không có (witnesses.ts export empty object)

#### Unit test:
- Test increment: gọi circuit, assert round tăng 1
- Test decrement: gọi circuit, assert round giảm 1
- Test multiple increments: gọi 5 lần, assert round = 5

#### CLI:
- Menu: [1] Deploy [2] Increment [3] Decrement [4] Read counter [5] Exit
- Hiển thị DUST balance mỗi lần

#### README giải thích:
- Counter ADT là gì
- Compile output gồm những gì
- Flow từ compile → test → deploy → interact

---

### Example 2: secret-counter
Folder: examples/02-secret-counter/
Có: Contract + Test + CLI
Không có: Web UI

#### Concept mới:
- Witness function (localSecretKey)
- Authentication qua hash (derive publicKey từ secretKey)
- Owner-only access control
- Private state trong WitnessContext
- persistentHash

#### Contract (secret-counter.compact):
- export ledger round: Counter;
- export ledger owner: Bytes<32>;
- witness localSecretKey(): Bytes<32>;
- Constructor: set owner = disclose(publicKey(secretKey)) khi deploy
- Pure circuit publicKey(sk): tính persistentHash([pad(32,"sc:pk:"), sk])
- export circuit increment(): chỉ owner mới gọi được
  - sk = localSecretKey()
  - pk = publicKey(sk)
  - assert pk == owner "Not the owner"
  - round.increment(1)
- export circuit read_counter(): return round.read()

#### Witnesses (witnesses.ts):
- Type PrivateState = { secretKey: Uint8Array }
- localSecretKey: trả về [privateState, privateState.secretKey]

#### Unit test:
- Test owner increment: pass (đúng secret key)
- Test non-owner increment: fail (sai secret key → pk khác owner → assert fail)
- Test read: ai cũng đọc được

#### CLI:
- Lúc deploy: generate secret key, lưu vào private state
- Menu: [1] Deploy [2] Increment (cần secret key) [3] Read [4] Exit

#### README giải thích:
- Witness là gì, flow WitnessContext
- persistentHash dùng thế nào
- Owner authentication pattern
- So sánh với Ownable trong Solidity

---

### Example 3: private-voting
Folder: examples/03-private-voting/
Có: Contract + Test + CLI + Web UI

#### Concept mới:
- MerkleTree (voter registration)
- Commitment/Nullifier pattern (mỗi voter chỉ vote 1 lần)
- Set (nullifier set)
- disclose() cho kết quả vote
- Domain separator
- HistoricMerkleTree (concurrent voting)

#### Contract (private-voting.compact):
- export ledger voters: HistoricMerkleTree<32, Bytes<32>>;
- export ledger nullifiers: Set<Bytes<32>>;
- export ledger yesVotes: Counter;
- export ledger noVotes: Counter;
- export ledger votingOpen: Boolean;

- witness localSecretKey(): Bytes<32>;
- witness voterMerklePath(): ... (MerkleTreePath type, tham khảo bboard)

- Pure circuit voterCommitment(sk): persistentHash([pad(32,"vote:commit:"), sk])
- Pure circuit voterNullifier(sk): persistentHash([pad(32,"vote:null:"), sk])

- export circuit registerVoter(commitment: Bytes<32>): []
  - assert votingOpen == true
  - voters.insert(disclose(commitment))

- export circuit castVote(vote: Boolean): []
  - assert votingOpen == true
  - sk = localSecretKey()
  - commitment = voterCommitment(sk)
  - path = voterMerklePath()
  - (verify commitment trong voters tree bằng path)
  - nullifier = voterNullifier(sk)
  - assert !nullifiers.member(nullifier) "Already voted"
  - nullifiers.insert(disclose(nullifier))
  - if (disclose(vote)) { yesVotes.increment(1); }
  - else { noVotes.increment(1); }

- export circuit closeVoting(): []
  - votingOpen = disclose(false)

#### Unit test:
- Test register voter: commitment inserted vào tree
- Test cast vote yes: yesVotes tăng, nullifier inserted
- Test cast vote twice: fail (nullifier đã tồn tại)
- Test vote khi closed: fail
- Test non-registered voter: fail (commitment không trong tree)

#### CLI:
- Menu: [1] Deploy [2] Register voter [3] Cast vote (yes/no) [4] View results [5] Close voting [6] Exit

#### Web UI (React):
- ConnectWallet component (Lace)
- RegisterVoter page: input public key, register
- CastVote page: Yes/No buttons
- Results page: hiển thị yesVotes/noVotes
- Status: voting open/closed

#### README giải thích:
- Commitment/Nullifier pattern chi tiết
- Domain separator tại sao cần
- MerkleTree vs Set — khi nào dùng cái nào
- HistoricMerkleTree tại sao dùng ở đây
- Privacy analysis: observer biết gì, không biết gì

---

### Example 4: private-token
Folder: examples/04-private-token/
Có: Contract + Test + CLI + Web UI

#### Concept mới:
- Contract token (tạo token riêng)
- Map<Bytes<32>, Uint<64>> (balances)
- Kernel functions: mintUnshielded hoặc custom mint logic
- persistentCommit (randomness cho balance hiding) — nếu áp dụng được
- Transfer logic với ZKP
- Opaque type (token name/symbol)

#### Contract (private-token.compact):
- export ledger balances: Map<Bytes<32>, Uint<64>>;
- export ledger totalSupply: Counter;
- export ledger tokenName: Opaque<"string">;

- witness localSecretKey(): Bytes<32>;

- Pure circuit deriveAddress(sk): persistentHash([pad(32,"token:addr:"), sk])

- export circuit mint(to: Bytes<32>, amount: Uint<64>): []
  - balances.insert(disclose(to), disclose(amount) + current balance nếu có)
  - totalSupply.increment(amount)

- export circuit transfer(to: Bytes<32>, amount: Uint<64>): []
  - sk = localSecretKey()
  - from = deriveAddress(sk)
  - fromBalance = balances.lookup(from)
  - assert fromBalance >= amount "Insufficient balance"
  - balances.insert(disclose(from), disclose(fromBalance - amount))
  - toBalance = balances.lookup(to) nếu member, else 0
  - balances.insert(disclose(to), disclose(toBalance + amount))

- export circuit getBalance(addr: Bytes<32>): Uint<64>
  - return balances.lookup(addr)

LƯU Ý: Đây là simplified version. Balance vẫn public trên ledger (vì dùng Map trực tiếp).
README nên giải thích: muốn giấu balance thật sự thì cần commitment-based balance (phức tạp hơn nhiều, ngoài scope example này).

#### Unit test:
- Test mint: balance tăng, totalSupply tăng
- Test transfer: sender giảm, receiver tăng
- Test transfer insufficient: fail
- Test transfer wrong key: fail (derive sai address)

#### CLI:
- Menu: [1] Deploy [2] Mint [3] Transfer [4] Check balance [5] Exit

#### Web UI (React):
- ConnectWallet
- Mint page (admin only)
- Transfer page: input recipient address + amount
- Balance page: hiển thị balance của connected wallet
- TotalSupply display

#### README giải thích:
- Contract token vs Ledger token
- Map ADT operations
- Transfer flow với identity proof
- Limitation: balance public trong version này
- Hướng mở rộng: commitment-based balance cho full privacy

---

### Example 5: payroll-lite
Folder: examples/05-payroll-lite/
Có: Contract + Test + CLI + Web UI

#### Concept mới:
- HistoricMerkleTree + Set (commitment/nullifier full flow)
- Counter (payroll period)
- Kernel.blockTimeGreaterThan (deadline enforcement) — nếu testable
- Domain separator thực tế
- resetHistory() (dọn history đầu kỳ mới)
- Employer/Employee role separation
- Đây là tiền thân PolyPay

#### Contract (payroll-lite.compact):
- export ledger commitments: HistoricMerkleTree<32, Bytes<32>>;
- export ledger nullifiers: Set<Bytes<32>>;
- export ledger period: Counter;
- export ledger employer: Bytes<32>;

- witness localSecretKey(): Bytes<32>;
- witness salaryAmount(): Uint<64>;
- witness commitmentMerklePath(): ... (MerkleTreePath)

- Pure circuit derivePublicKey(sk): persistentHash([pad(32,"payroll:pk:"), sk])

- Pure circuit computeCommitment(pubKey, salary, periodNum):
    persistentHash([pad(32,"payroll:commit:"), pubKey, salary_as_bytes, periodNum_as_bytes])

- Pure circuit computeNullifier(sk, periodNum):
    persistentHash([pad(32,"payroll:null:"), sk, periodNum_as_bytes])

- Constructor: set employer = disclose(derivePublicKey(localSecretKey()))

- export circuit commitSalary(commitment: Bytes<32>): []
    - sk = localSecretKey()
    - assert derivePublicKey(sk) == employer "Not employer"
    - commitments.insert(disclose(commitment))

- export circuit claimSalary(): []
    - sk = localSecretKey()
    - salary = salaryAmount()
    - pubKey = derivePublicKey(sk)
    - currentPeriod = period.read()
    - commitment = computeCommitment(pubKey, salary, currentPeriod)
    - path = commitmentMerklePath()
    - (verify commitment trong commitments tree bằng path)
    - nullifier = computeNullifier(sk, currentPeriod)
    - assert !nullifiers.member(nullifier) "Already claimed"
    - nullifiers.insert(disclose(nullifier))
    - (transfer salary — simplified: disclose salary amount hoặc dùng Kernel nếu áp dụng được)

- export circuit newPeriod(): []
    - sk = localSecretKey()
    - assert derivePublicKey(sk) == employer "Not employer"
    - period.increment(1)
    - commitments.resetHistory()

- export circuit getPeriod(): Uint<64>
    - return period.read()

#### Witnesses (witnesses.ts):
- Type PayrollPrivateState = { secretKey: Uint8Array, salary: bigint }
- localSecretKey: trả về secretKey từ privateState
- salaryAmount: trả về salary từ privateState
- commitmentMerklePath: tìm path trong tree (tham khảo bboard witness pattern)

#### Unit test:
- Test employer commit salary: commitment inserted vào tree
- Test employee claim: nullifier inserted, salary output đúng
- Test employee claim twice: fail (nullifier exists)
- Test non-employee claim: fail (commitment không trong tree)
- Test non-employer commit: fail (not employer)
- Test new period: period tăng, history reset
- Test claim after period reset: old commitment vẫn valid (HistoricMerkleTree) — CHỈ nếu chưa resetHistory
- Test claim after resetHistory: old root invalid → fail

#### CLI:
- Employer mode: [1] Deploy [2] Commit salary [3] New period [4] View period [5] Exit
- Employee mode: [1] Join contract [2] Claim salary [3] View period [4] Exit
- Hỏi role lúc start: "Are you employer or employee?"

#### Web UI (React):
- ConnectWallet
- Role selector: Employer / Employee
- Employer view:
  - Commit salary form: employee public key + amount
  - New period button
  - Current period display
- Employee view:
  - Claim salary button
  - Current period display
  - Claim status (đã claim kỳ này chưa)

#### README giải thích:
- Full commitment/nullifier flow
- HistoricMerkleTree vs MerkleTree — tại sao dùng Historic
- resetHistory() strategy
- Domain separator design
- Employer vs Employee flow
- Privacy analysis: on-chain thấy gì, không thấy gì
- Limitations vs full PolyPay (DUST sponsorship, shielded transfer, multi-employer)
- Hướng mở rộng cho PolyPay

---

## Thứ tự thực hiện

Làm TỪNG example một, theo thứ tự 1 → 2 → 3 → 4 → 5.

Với mỗi example:
1. Đọc references/ repos và MIDNIGHT_KNOWLEDGE.md để hiểu pattern
2. Viết .compact file
3. Compile: compact compile contract/src/<name>.compact contract/src/managed/<name>
4. Nếu compile lỗi → đọc lại docs, sửa, compile lại cho đến khi pass
5. Viết witnesses.ts
6. Viết unit test, chạy: cd test && npm install && npm test
7. Nếu test lỗi → sửa contract hoặc test cho đến khi pass
8. Viết CLI (deploy.ts, cli.ts, utils.ts, config.ts)
9. Viết Web UI (chỉ example 3, 4, 5)
10. Viết README.md
11. Confirm tất cả hoạt động rồi mới qua example tiếp theo

---

## Hướng dẫn chạy (ghi vào mỗi README)

### Compile contract:
cd contract && npm install && npm run compile

### Chạy unit test:
cd test && npm install && npm test

### Start proof server (cần Docker):
docker run -p 6300:6300 midnightntwrk/proof-server:8.0.3 -- midnight-proof-server -v

### Deploy (cần proof server + faucet):
cd cli && npm install && npm run deploy

### Interact CLI:
cd cli && npm run cli

### Start Web UI (chỉ example 3, 4, 5):
cd web && npm install && npm run dev
-- Mở http://localhost:5173
-- Cần Lace wallet extension + proof server đang chạy

---

## Lưu ý quan trọng

- Compact syntax rất khác TypeScript. Đặc biệt: ledger operations, disclose(), witness declarations, for loop syntax, struct/enum syntax. LUÔN check references/.
- MerkleTreePath type và cách verify trong circuit: tham khảo example-bboard contract code.
- Nếu không chắc syntax nào đó, ĐỌC https://docs.midnight.network/compact/reference/lang-ref TRƯỚC khi viết.
- Nếu compile fail, ĐỌC error message cẩn thận, đối chiếu với docs, KHÔNG đoán fix.
- Generated files trong managed/ folder: KHÔNG tạo tay, KHÔNG sửa tay. Chỉ compile sinh ra.
- Web UI: focus vào functionality, không cần đẹp. Có thể dùng Tailwind hoặc CSS đơn giản.
