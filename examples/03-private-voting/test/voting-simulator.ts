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
} from "../contract/src/managed/private-voting/contract/index.js";
import { type VotingPrivateState, witnesses } from "../contract/src/witnesses.js";

export class VotingSimulator {
  readonly contract: Contract<VotingPrivateState>;
  circuitContext: CircuitContext<VotingPrivateState>;

  constructor(secretKey: Uint8Array) {
    this.contract = new Contract<VotingPrivateState>(witnesses);
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

  public getPrivateState(): VotingPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  public computeCommitment(sk: Uint8Array): Uint8Array {
    return pureCircuits.voterCommitment(sk);
  }

  public computeNullifier(sk: Uint8Array): Uint8Array {
    return pureCircuits.voterNullifier(sk);
  }

  public registerVoter(commitment: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits.registerVoter(
      this.circuitContext,
      commitment,
    ).context;
    return this.getLedger();
  }

  public castVote(vote: boolean): Ledger {
    this.circuitContext = this.contract.impureCircuits.castVote(
      this.circuitContext,
      vote,
    ).context;
    return this.getLedger();
  }

  public getResults(): [bigint, bigint] {
    return this.contract.impureCircuits.getResults(
      this.circuitContext,
    ).result;
  }

  public closeVoting(): Ledger {
    this.circuitContext = this.contract.impureCircuits.closeVoting(
      this.circuitContext,
    ).context;
    return this.getLedger();
  }
}
