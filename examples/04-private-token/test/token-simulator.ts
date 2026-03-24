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
} from "../contract/src/managed/private-token/contract/index.js";
import { type TokenPrivateState, witnesses } from "../contract/src/witnesses.js";

export class TokenSimulator {
  readonly contract: Contract<TokenPrivateState>;
  circuitContext: CircuitContext<TokenPrivateState>;

  constructor(secretKey: Uint8Array, tokenName: string) {
    this.contract = new Contract<TokenPrivateState>(witnesses);
    const {
      currentPrivateState,
      currentContractState,
      currentZswapLocalState,
    } = this.contract.initialState(
      createConstructorContext({ secretKey }, "0".repeat(64)),
      tokenName,
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

  public deriveAddress(sk: Uint8Array): Uint8Array {
    return pureCircuits.deriveAddress(sk);
  }

  public mint(to: Uint8Array, amount: bigint): Ledger {
    this.circuitContext = this.contract.impureCircuits.mint(
      this.circuitContext, to, amount,
    ).context;
    return this.getLedger();
  }

  public transfer(to: Uint8Array, amount: bigint): Ledger {
    this.circuitContext = this.contract.impureCircuits.transfer(
      this.circuitContext, to, amount,
    ).context;
    return this.getLedger();
  }

  public getBalance(addr: Uint8Array): bigint {
    return this.contract.impureCircuits.getBalance(
      this.circuitContext, addr,
    ).result;
  }

  public getTotalSupply(): bigint {
    return this.contract.impureCircuits.getTotalSupply(
      this.circuitContext,
    ).result;
  }
}
