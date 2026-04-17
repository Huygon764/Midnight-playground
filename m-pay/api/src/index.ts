import { MPay } from "../../contract/src/index.js";
import { CompiledMPayContract } from "../../contract/src/index.js";
import { type ContractAddress } from "@midnight-ntwrk/compact-runtime";
import { type Logger } from "pino";
import {
  type MPayDerivedState,
  type MPayProviders,
  type DeployedMPayContract,
  type TransactionInfo,
  mPayPrivateStateKey,
} from "./common-types.js";
import * as utils from "./utils.js";
import * as crypto from "./crypto.js";
import { deployContract, findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { map, type Observable } from "rxjs";
import { type MPayPrivateState, createMPayPrivateState } from "../../contract/src/index.js";
// Convert bigint to 32-byte little-endian. Matches Compact's `x as Field as Bytes<32>`
// which uses compact-runtime's `convertFieldToBytes` (LSB at index 0, MSB at index 31).
function bigintToBytes32LE(value: bigint): Uint8Array {
  const bytes = new Uint8Array(32);
  let v = value;
  for (let i = 0; i < 32; i++) {
    bytes[i] = Number(v & 0xffn);
    v >>= 8n;
    if (v === 0n) break;
  }
  return bytes;
}

export interface DeployedMPayAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<MPayDerivedState>;

  // Setup
  initSigner: (commitment: Uint8Array) => Promise<void>;
  finalize: () => Promise<void>;

  // Deposit shielded tNIGHT
  deposit: (coin: { nonce: Uint8Array; color: Uint8Array; value: bigint }) => Promise<void>;

  // Propose (transfer is encrypted). Stores both coin + encryption public keys
  // so the full shielded address can be rebuilt when decrypting for display.
  proposeTransfer: (
    recipientCpk: Uint8Array,
    recipientEpk: Uint8Array,
    amount: bigint,
    vaultKey: CryptoKey,
  ) => Promise<void>;
  proposeAddSigner: (commitment: Uint8Array) => Promise<void>;
  proposeRemoveSigner: (commitment: Uint8Array) => Promise<void>;
  proposeSetThreshold: (newThreshold: bigint) => Promise<void>;

  // Approve
  approveTx: (txId: bigint) => Promise<void>;

  // Execute (transfer reads from witness)
  executeTransfer: (
    txId: bigint,
    coinKey: Uint8Array,
    recipientCpk: Uint8Array,
    amount: bigint,
  ) => Promise<void>;
  executeAddSigner: (txId: bigint) => Promise<void>;
  executeRemoveSigner: (txId: bigint) => Promise<void>;
  executeSetThreshold: (txId: bigint) => Promise<void>;

  // Read
  getTransactionList: () => Promise<TransactionInfo[]>;
  getSignerList: () => Promise<Uint8Array[]>;
  getEncryptedTransferData: (
    txId: bigint,
  ) => Promise<{ enc0: Uint8Array; enc1: Uint8Array; enc2: Uint8Array; enc3: Uint8Array } | null>;
  getVaultCoins: () => Promise<{ key: Uint8Array; value: bigint }[]>;
}

export class MPayAPI implements DeployedMPayAPI {
  private readonly providers: MPayProviders;

  private constructor(
    public readonly deployedContract: DeployedMPayContract,
    providers: MPayProviders,
    private readonly logger?: Logger,
  ) {
    this.providers = providers;
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    this.state$ = providers.publicDataProvider
      .contractStateObservable(this.deployedContractAddress, { type: "latest" })
      .pipe(
        map((contractState) => {
          const l = MPay.ledger(contractState.data);
          // Sum vault balance across all deposit slots
          let vaultBalance = 0n;
          try {
            const count = l.depositCounter;
            for (let i = 1n; i <= count; i++) {
              const key = bigintToBytes32LE(i);
              if (l.vaultCoin.member(key)) {
                vaultBalance += l.vaultCoin.lookup(key).value;
              }
            }
          } catch {
            // vaultCoin may not exist yet
          }
          return {
            signerCount: l.signerCount,
            threshold: l.threshold,
            finalized: l.finalized,
            txCounter: l.txCounter,
            vaultBalance,
          };
        }),
      );
  }

  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<MPayDerivedState>;

  // Setup
  async initSigner(commitment: Uint8Array): Promise<void> {
    this.logger?.info("initSigner");
    await this.deployedContract.callTx.initSigner(commitment);
  }

  async finalize(): Promise<void> {
    this.logger?.info("finalize");
    await this.deployedContract.callTx.finalize();
  }

  // Deposit shielded coin
  async deposit(coin: { nonce: Uint8Array; color: Uint8Array; value: bigint }): Promise<void> {
    this.logger?.info({ value: coin.value }, "deposit");
    await this.deployedContract.callTx.deposit(coin);
  }

  // Propose — generic circuit, type-specific data in d0-d3.
  // For Transfer: d0-d3 are 4 x 32-byte ciphertext chunks (cpk + epk + amount).
  async proposeTransfer(
    recipientCpk: Uint8Array,
    recipientEpk: Uint8Array,
    amount: bigint,
    vaultKey: CryptoKey,
  ): Promise<void> {
    this.logger?.info("proposeTransfer");
    const { enc0, enc1, enc2, enc3 } = await crypto.encryptProposalData(
      vaultKey,
      recipientCpk,
      recipientEpk,
      amount,
    );
    await this.deployedContract.callTx.propose(0n, enc0, enc1, enc2, enc3);
  }

  async proposeAddSigner(commitment: Uint8Array): Promise<void> {
    this.logger?.info("proposeAddSigner");
    const empty = new Uint8Array(32);
    await this.deployedContract.callTx.propose(2n, commitment, empty, empty, empty);
  }

  async proposeRemoveSigner(commitment: Uint8Array): Promise<void> {
    this.logger?.info("proposeRemoveSigner");
    const empty = new Uint8Array(32);
    await this.deployedContract.callTx.propose(3n, commitment, empty, empty, empty);
  }

  async proposeSetThreshold(newThreshold: bigint): Promise<void> {
    this.logger?.info("proposeSetThreshold");
    const empty = new Uint8Array(32);
    // Pack threshold as Bytes<32> little-endian (LSB at byte 0). The circuit
    // reads `d0 as Field as Uint<8>`; Midnight Field decodes bytes LE so the
    // threshold byte MUST be at index 0 — putting it at byte 31 produces a
    // value around 2^248 which overflows Uint<8>.
    const d0 = new Uint8Array(32);
    d0[0] = Number(newThreshold);
    await this.deployedContract.callTx.propose(4n, d0, empty, empty, empty);
  }

  // Approve
  async approveTx(txId: bigint): Promise<void> {
    this.logger?.info({ txId }, "approveTx");
    await this.deployedContract.callTx.approveTx(txId);
  }

  // Execute — set witness then call circuit
  async executeTransfer(
    txId: bigint,
    coinKey: Uint8Array,
    recipientCpk: Uint8Array,
    amount: bigint,
  ): Promise<void> {
    this.logger?.info({ txId }, "executeTransfer");

    // Set private state for witness functions
    const currentState = await this.providers.privateStateProvider.get(mPayPrivateStateKey);
    if (!currentState) throw new Error("Private state not found");

    const updatedState: MPayPrivateState = {
      ...currentState,
      pendingTransferRecipient: recipientCpk,
      pendingTransferAmount: amount,
    };
    await this.providers.privateStateProvider.set(mPayPrivateStateKey, updatedState);

    await this.deployedContract.callTx.executeTransfer(txId, coinKey);

    // Clear pending transfer data
    const cleanState: MPayPrivateState = {
      ...currentState,
      pendingTransferRecipient: undefined,
      pendingTransferAmount: undefined,
    };
    await this.providers.privateStateProvider.set(mPayPrivateStateKey, cleanState);
  }

  async executeAddSigner(txId: bigint): Promise<void> {
    this.logger?.info({ txId }, "executeAddSigner");
    await this.deployedContract.callTx.executeAddSigner(txId);
  }

  async executeRemoveSigner(txId: bigint): Promise<void> {
    this.logger?.info({ txId }, "executeRemoveSigner");
    await this.deployedContract.callTx.executeRemoveSigner(txId);
  }

  async executeSetThreshold(txId: bigint): Promise<void> {
    this.logger?.info({ txId }, "executeSetThreshold");
    await this.deployedContract.callTx.executeSetThreshold(txId);
  }

  // Read
  async getTransactionList(): Promise<TransactionInfo[]> {
    const contractState = await this.providers.publicDataProvider.queryContractState(
      this.deployedContractAddress,
    );
    if (!contractState) return [];
    const l = MPay.ledger(contractState.data);
    const txCount = l.txCounter;
    const txs: TransactionInfo[] = [];
    for (let i = 1n; i <= txCount; i++) {
      if (l.txTypes.member(i)) {
        txs.push({
          txId: i,
          txType: l.txTypes.lookup(i),
          status: l.txStatuses.member(i) ? l.txStatuses.lookup(i) : 0n,
          approvals: l.txApprovalCounts.member(i) ? l.txApprovalCounts.lookup(i).read() : 0n,
          d0: l.txData0.member(i) ? l.txData0.lookup(i) : new Uint8Array(32),
        });
      }
    }
    return txs;
  }

  async getSignerList(): Promise<Uint8Array[]> {
    const contractState = await this.providers.publicDataProvider.queryContractState(
      this.deployedContractAddress,
    );
    if (!contractState) return [];
    const l = MPay.ledger(contractState.data);
    const signers: Uint8Array[] = [];
    for (const s of l.signers) {
      signers.push(s);
    }
    return signers;
  }

  async getEncryptedTransferData(
    txId: bigint,
  ): Promise<{ enc0: Uint8Array; enc1: Uint8Array; enc2: Uint8Array; enc3: Uint8Array } | null> {
    const contractState = await this.providers.publicDataProvider.queryContractState(
      this.deployedContractAddress,
    );
    if (!contractState) return null;
    const l = MPay.ledger(contractState.data);
    if (!l.txData0.member(txId)) return null;
    return {
      enc0: l.txData0.lookup(txId),
      enc1: l.txData1.lookup(txId),
      enc2: l.txData2.lookup(txId),
      enc3: l.txData3.lookup(txId),
    };
  }

  async getVaultCoins(): Promise<{ key: Uint8Array; value: bigint }[]> {
    const contractState = await this.providers.publicDataProvider.queryContractState(
      this.deployedContractAddress,
    );
    if (!contractState) return [];
    const l = MPay.ledger(contractState.data);
    const count = l.depositCounter;
    const coins: { key: Uint8Array; value: bigint }[] = [];
    for (let i = 1n; i <= count; i++) {
      const key = bigintToBytes32LE(i);
      try {
        if (l.vaultCoin.member(key)) {
          const coin = l.vaultCoin.lookup(key);
          coins.push({ key, value: coin.value });
        }
      } catch {
        // Coin may have been spent
      }
    }
    return coins;
  }

  // Deploy & Join
  static async deploy(
    providers: MPayProviders,
    threshold: bigint,
    tokenColor: Uint8Array,
    logger?: Logger,
  ): Promise<MPayAPI> {
    logger?.info("deployContract");
    const deployedContract = await deployContract(providers, {
      compiledContract: CompiledMPayContract,
      privateStateId: mPayPrivateStateKey,
      initialPrivateState: await MPayAPI.getPrivateState(providers),
      args: [threshold, tokenColor],
    });
    logger?.info(
      { address: deployedContract.deployTxData.public.contractAddress },
      "contractDeployed",
    );
    return new MPayAPI(deployedContract, providers, logger);
  }

  static async join(
    providers: MPayProviders,
    contractAddress: ContractAddress,
    logger?: Logger,
  ): Promise<MPayAPI> {
    logger?.info({ contractAddress }, "joinContract");
    const deployedContract = await findDeployedContract(providers, {
      contractAddress,
      compiledContract: CompiledMPayContract,
      privateStateId: mPayPrivateStateKey,
      initialPrivateState: await MPayAPI.getPrivateState(providers),
    });
    logger?.info({ contractAddress }, "contractJoined");
    return new MPayAPI(deployedContract, providers, logger);
  }

  private static async getPrivateState(
    providers: MPayProviders,
  ): Promise<MPayPrivateState> {
    const existing = await providers.privateStateProvider.get(mPayPrivateStateKey);
    return existing ?? createMPayPrivateState(utils.randomBytes(32));
  }
}

export * from "./common-types.js";
export * as crypto from "./crypto.js";
export { TokenAPI, type DeployedTokenAPI } from "./token-api.js";
export { utils };
