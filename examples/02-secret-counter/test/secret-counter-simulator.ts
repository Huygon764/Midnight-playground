import {
  type CircuitContext,
  QueryContext,
  sampleContractAddress,
  createConstructorContext,
  CostModel,
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  type Ledger,
  ledger,
  pureCircuits,
} from "../contract/src/managed/secret-counter/contract/index.js";
import { type SecretCounterPrivateState, witnesses } from "../contract/src/witnesses.js";

export class SecretCounterSimulator {
  readonly contract: Contract<SecretCounterPrivateState>;
  circuitContext: CircuitContext<SecretCounterPrivateState>;

  constructor(secretKey: Uint8Array) {
    this.contract = new Contract<SecretCounterPrivateState>(witnesses);
    const {
      currentPrivateState,
      currentContractState,
      currentZswapLocalState,
    } = this.contract.initialState(
      createConstructorContext({ secretKey }, "0".repeat(64))
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

  public switchUser(secretKey: Uint8Array) {
    this.circuitContext.currentPrivateState = { secretKey };
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public getPrivateState(): SecretCounterPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  public increment(): Ledger {
    this.circuitContext = this.contract.impureCircuits.increment(
      this.circuitContext
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public decrement(): Ledger {
    this.circuitContext = this.contract.impureCircuits.decrement(
      this.circuitContext
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public readCounter(): bigint {
    return this.contract.impureCircuits.read_counter(
      this.circuitContext
    ).result;
  }

  public publicKey(): Uint8Array {
    return pureCircuits.publicKey(this.getPrivateState().secretKey);
  }
}
