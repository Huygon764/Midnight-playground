import {
  type CircuitContext,
  sampleContractAddress,
  createConstructorContext,
  createCircuitContext,
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  type Ledger,
  ledger,
} from "../contract/src/managed/simple-counter/contract/index.js";
import { type SimpleCounterPrivateState, witnesses } from "../contract/src/witnesses.js";

export class SimpleCounterSimulator {
  readonly contract: Contract<SimpleCounterPrivateState>;
  circuitContext: CircuitContext<SimpleCounterPrivateState>;

  constructor() {
    this.contract = new Contract<SimpleCounterPrivateState>(witnesses);
    const {
      currentPrivateState,
      currentContractState,
      currentZswapLocalState,
    } = this.contract.initialState(
      createConstructorContext({ privateCounter: 0 }, "0".repeat(64))
    );
    this.circuitContext = createCircuitContext(
      sampleContractAddress(),
      currentZswapLocalState,
      currentContractState,
      currentPrivateState
    );
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public getPrivateState(): SimpleCounterPrivateState {
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
}
