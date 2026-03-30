import { PolyPay } from "../../contract/src/index.js";
import { CompiledPolyPayContract } from "../../contract/src/index.js";
import { type ContractAddress } from "@midnight-ntwrk/compact-runtime";
import { type Logger } from "pino";
import {
  type PolyPayDerivedState,
  type PolyPayProviders,
  type DeployedPolyPayContract,
  type TransactionInfo,
  polyPayPrivateStateKey,
} from "./common-types.js";
import * as utils from "./utils.js";
import { deployContract, findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { map, type Observable } from "rxjs";
import { type PolyPayPrivateState, createPolyPayPrivateState } from "../../contract/src/index.js";

export interface DeployedPolyPayAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<PolyPayDerivedState>;

  // Setup
  initSigner: (commitment: Uint8Array) => Promise<void>;
  finalize: () => Promise<void>;

  // Token
  mint: (amount: bigint) => Promise<void>;

  // Propose
  proposeTransfer: (to: Uint8Array, amount: bigint) => Promise<void>;
  proposeAddSigner: (commitment: Uint8Array) => Promise<void>;
  proposeRemoveSigner: (commitment: Uint8Array) => Promise<void>;
  proposeSetThreshold: (newThreshold: bigint) => Promise<void>;

  // Approve
  approveTx: (txId: bigint) => Promise<void>;

  // Execute
  executeTransfer: (txId: bigint) => Promise<void>;
  executeAddSigner: (txId: bigint) => Promise<void>;
  executeRemoveSigner: (txId: bigint) => Promise<void>;
  executeSetThreshold: (txId: bigint) => Promise<void>;

  // Read
  deriveCommitment: () => Promise<Uint8Array>;
  getSecret: () => Promise<Uint8Array>;
  getTransactionList: () => Promise<TransactionInfo[]>;
  getSignerList: () => Promise<Uint8Array[]>;
}

export class PolyPayAPI implements DeployedPolyPayAPI {
  private readonly providers: PolyPayProviders;

  private constructor(
    public readonly deployedContract: DeployedPolyPayContract,
    providers: PolyPayProviders,
    private readonly logger?: Logger,
  ) {
    this.providers = providers;
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    this.state$ = providers.publicDataProvider
      .contractStateObservable(this.deployedContractAddress, { type: "latest" })
      .pipe(
        map((contractState) => {
          const l = PolyPay.ledger(contractState.data);
          return {
            totalSupply: l.totalSupply,
            signerCount: l.signerCount,
            threshold: l.threshold,
            finalized: l.finalized,
            txCounter: l.txCounter,
          };
        }),
      );
  }

  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<PolyPayDerivedState>;

  // Setup
  async initSigner(commitment: Uint8Array): Promise<void> {
    this.logger?.info("initSigner");
    await this.deployedContract.callTx.initSigner(commitment);
  }

  async finalize(): Promise<void> {
    this.logger?.info("finalize");
    await this.deployedContract.callTx.finalize();
  }

  // Token
  async mint(amount: bigint): Promise<void> {
    this.logger?.info({ amount }, "mint");
    await this.deployedContract.callTx.mint(amount);
  }

  // Propose
  async proposeTransfer(to: Uint8Array, amount: bigint): Promise<void> {
    this.logger?.info("proposeTransfer");
    await this.deployedContract.callTx.proposeTransfer(to, amount);
  }

  async proposeAddSigner(commitment: Uint8Array): Promise<void> {
    this.logger?.info("proposeAddSigner");
    await this.deployedContract.callTx.proposeAddSigner(commitment);
  }

  async proposeRemoveSigner(commitment: Uint8Array): Promise<void> {
    this.logger?.info("proposeRemoveSigner");
    await this.deployedContract.callTx.proposeRemoveSigner(commitment);
  }

  async proposeSetThreshold(newThreshold: bigint): Promise<void> {
    this.logger?.info("proposeSetThreshold");
    await this.deployedContract.callTx.proposeSetThreshold(newThreshold);
  }

  // Approve
  async approveTx(txId: bigint): Promise<void> {
    this.logger?.info({ txId }, "approveTx");
    await this.deployedContract.callTx.approveTx(txId);
  }

  // Execute
  async executeTransfer(txId: bigint): Promise<void> {
    this.logger?.info({ txId }, "executeTransfer");
    await this.deployedContract.callTx.executeTransfer(txId);
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
  async deriveCommitment(): Promise<Uint8Array> {
    const ps = await PolyPayAPI.getPrivateState(this.providers);
    return PolyPay.pureCircuits.deriveCommitment(ps.secret);
  }

  async getSecret(): Promise<Uint8Array> {
    const ps = await PolyPayAPI.getPrivateState(this.providers);
    return ps.secret;
  }

  async getTransactionList(): Promise<TransactionInfo[]> {
    const contractState = await this.providers.publicDataProvider.queryContractState(this.deployedContractAddress);
    if (!contractState) return [];
    const l = PolyPay.ledger(contractState.data);
    const txCount = l.txCounter;
    const txs: TransactionInfo[] = [];
    for (let i = 1n; i <= txCount; i++) {
      if (l.txTypes.member(i)) {
        txs.push({
          txId: i,
          txType: l.txTypes.lookup(i),
          status: l.txStatuses.member(i) ? l.txStatuses.lookup(i) : 0n,
          approvals: l.txApprovalCounts.member(i) ? l.txApprovalCounts.lookup(i).read() : 0n,
        });
      }
    }
    return txs;
  }

  async getSignerList(): Promise<Uint8Array[]> {
    const contractState = await this.providers.publicDataProvider.queryContractState(this.deployedContractAddress);
    if (!contractState) return [];
    const l = PolyPay.ledger(contractState.data);
    const signers: Uint8Array[] = [];
    for (const s of l.signers) {
      signers.push(s);
    }
    return signers;
  }

  // Deploy & Join
  static async deploy(providers: PolyPayProviders, threshold: bigint, logger?: Logger): Promise<PolyPayAPI> {
    logger?.info("deployContract");
    const deployedContract = await deployContract(providers, {
      compiledContract: CompiledPolyPayContract,
      privateStateId: polyPayPrivateStateKey,
      initialPrivateState: await PolyPayAPI.getPrivateState(providers),
      args: [threshold],
    });
    logger?.info({ address: deployedContract.deployTxData.public.contractAddress }, "contractDeployed");
    return new PolyPayAPI(deployedContract, providers, logger);
  }

  static async join(
    providers: PolyPayProviders,
    contractAddress: ContractAddress,
    logger?: Logger,
  ): Promise<PolyPayAPI> {
    logger?.info({ contractAddress }, "joinContract");
    const deployedContract = await findDeployedContract(providers, {
      contractAddress,
      compiledContract: CompiledPolyPayContract,
      privateStateId: polyPayPrivateStateKey,
      initialPrivateState: await PolyPayAPI.getPrivateState(providers),
    });
    logger?.info({ contractAddress }, "contractJoined");
    return new PolyPayAPI(deployedContract, providers, logger);
  }

  private static async getPrivateState(providers: PolyPayProviders): Promise<PolyPayPrivateState> {
    const existing = await providers.privateStateProvider.get(polyPayPrivateStateKey);
    return existing ?? createPolyPayPrivateState(utils.randomBytes(32));
  }
}

export * from "./common-types.js";
export { utils };
