import { PayrollLite } from "../../contract/src/index.js";
import { CompiledPayrollContract } from "../../contract/src/index.js";
import { type ContractAddress, convertFieldToBytes } from "@midnight-ntwrk/compact-runtime";
import { type Logger } from "pino";
import {
  type PayrollDerivedState,
  type PayrollProviders,
  type DeployedPayrollContract,
  payrollPrivateStateKey,
} from "./common-types.js";
import * as utils from "./utils.js";
import { deployContract, findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { map, type Observable } from "rxjs";
import { type PayrollPrivateState, createPayrollPrivateState } from "../../contract/src/index.js";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";

export interface DeployedPayrollAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<PayrollDerivedState>;
  commitSalary: (employeePubKey: Uint8Array, salary: bigint, period: bigint) => Promise<void>;
  claimSalary: () => Promise<void>;
  newPeriod: () => Promise<void>;
  derivePublicKey: () => Promise<Uint8Array>;
}

export class PayrollAPI implements DeployedPayrollAPI {
  private readonly providers: PayrollProviders;

  private constructor(
    public readonly deployedContract: DeployedPayrollContract,
    providers: PayrollProviders,
    private readonly logger?: Logger,
  ) {
    this.providers = providers;
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    this.state$ = providers.publicDataProvider
      .contractStateObservable(this.deployedContractAddress, { type: "latest" })
      .pipe(
        map((contractState) => {
          const ledgerState = PayrollLite.ledger(contractState.data);
          return {
            period: ledgerState.period,
            employer: ledgerState.employer,
            claimedAmount: ledgerState.claimedAmount,
          };
        }),
      );
  }

  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<PayrollDerivedState>;

  async commitSalary(employeePubKey: Uint8Array, salary: bigint, period: bigint): Promise<void> {
    this.logger?.info(`commitSalary: ${salary} for period ${period}`);
    const salaryBytes = convertFieldToBytes(32, salary, "payroll-api");
    const periodBytes = convertFieldToBytes(32, period, "payroll-api");
    const commitment = PayrollLite.pureCircuits.computeCommitment(employeePubKey, salaryBytes, periodBytes);
    await this.deployedContract.callTx.commitSalary(commitment);
  }

  async claimSalary(): Promise<void> {
    this.logger?.info("claimSalary");
    await this.deployedContract.callTx.claimSalary();
  }

  async newPeriod(): Promise<void> {
    this.logger?.info("newPeriod");
    await this.deployedContract.callTx.newPeriod();
  }

  async derivePublicKey(): Promise<Uint8Array> {
    const ps = await PayrollAPI.getPrivateState(this.providers);
    return PayrollLite.pureCircuits.derivePublicKey(ps.secretKey);
  }

  static async deploy(providers: PayrollProviders, logger?: Logger): Promise<PayrollAPI> {
    logger?.info("deployContract");
    const deployedContract = await deployContract(providers, {
      compiledContract: CompiledPayrollContract,
      privateStateId: payrollPrivateStateKey,
      initialPrivateState: await PayrollAPI.getPrivateState(providers),
    });
    logger?.info({ address: deployedContract.deployTxData.public.contractAddress }, "contractDeployed");
    return new PayrollAPI(deployedContract, providers, logger);
  }

  static async join(
    providers: PayrollProviders,
    contractAddress: ContractAddress,
    salary: bigint,
    logger?: Logger,
  ): Promise<PayrollAPI> {
    logger?.info({ contractAddress }, "joinContract");
    const existingPs = await providers.privateStateProvider.get(payrollPrivateStateKey);
    const ps = existingPs ?? createPayrollPrivateState(utils.randomBytes(32), salary);
    const deployedContract = await findDeployedContract(providers, {
      contractAddress,
      compiledContract: CompiledPayrollContract,
      privateStateId: payrollPrivateStateKey,
      initialPrivateState: ps,
    });
    logger?.info({ contractAddress }, "contractJoined");
    return new PayrollAPI(deployedContract, providers, logger);
  }

  private static async getPrivateState(providers: PayrollProviders): Promise<PayrollPrivateState> {
    const existing = await providers.privateStateProvider.get(payrollPrivateStateKey);
    return existing ?? createPayrollPrivateState(utils.randomBytes(32), 0n);
  }
}

export * from "./common-types.js";
export { utils };
