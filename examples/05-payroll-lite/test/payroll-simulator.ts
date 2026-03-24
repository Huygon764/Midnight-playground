import {
  type CircuitContext,
  QueryContext,
  sampleContractAddress,
  createConstructorContext,
  CostModel,
  convertFieldToBytes,
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  type Ledger,
  ledger,
  pureCircuits,
} from "../contract/src/managed/payroll-lite/contract/index.js";
import { type PayrollPrivateState, witnesses } from "../contract/src/witnesses.js";

export class PayrollSimulator {
  readonly contract: Contract<PayrollPrivateState>;
  circuitContext: CircuitContext<PayrollPrivateState>;

  constructor(secretKey: Uint8Array, salary: bigint = 0n) {
    this.contract = new Contract<PayrollPrivateState>(witnesses);
    const {
      currentPrivateState,
      currentContractState,
      currentZswapLocalState,
    } = this.contract.initialState(
      createConstructorContext({ secretKey, salary }, "0".repeat(64))
    );
    this.circuitContext = {
      currentPrivateState,
      currentZswapLocalState,
      costModel: CostModel.initialCostModel(),
      currentQueryContext: new QueryContext(
        currentContractState.data,
        sampleContractAddress(),
      ),
    };
  }

  public switchUser(secretKey: Uint8Array, salary: bigint = 0n) {
    this.circuitContext.currentPrivateState = { secretKey, salary };
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public derivePublicKey(sk: Uint8Array): Uint8Array {
    return pureCircuits.derivePublicKey(sk);
  }

  public computeCommitment(pubKey: Uint8Array, salary: bigint, period: bigint): Uint8Array {
    const salaryBytes = convertFieldToBytes(32, salary, "test");
    const periodBytes = convertFieldToBytes(32, period, "test");
    return pureCircuits.computeCommitment(pubKey, salaryBytes, periodBytes);
  }

  public computeNullifier(sk: Uint8Array, period: bigint): Uint8Array {
    const periodBytes = convertFieldToBytes(32, period, "test");
    return pureCircuits.computeNullifier(sk, periodBytes);
  }

  public commitSalary(commitment: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits.commitSalary(
      this.circuitContext, commitment,
    ).context;
    return this.getLedger();
  }

  public claimSalary(): bigint {
    const result = this.contract.impureCircuits.claimSalary(this.circuitContext);
    this.circuitContext = result.context;
    return result.result;
  }

  public newPeriod(): Ledger {
    this.circuitContext = this.contract.impureCircuits.newPeriod(
      this.circuitContext,
    ).context;
    return this.getLedger();
  }

  public getPeriod(): bigint {
    return this.contract.impureCircuits.getPeriod(this.circuitContext).result;
  }
}
