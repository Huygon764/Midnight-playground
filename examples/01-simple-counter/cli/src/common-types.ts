import { SimpleCounter, type SimpleCounterPrivateState } from "@example/simple-counter-contract";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import type { DeployedContract, FoundContract } from "@midnight-ntwrk/midnight-js-contracts";
import type { ImpureCircuitId } from "@midnight-ntwrk/compact-js";

export type SimpleCounterCircuits = ImpureCircuitId<SimpleCounter.Contract<SimpleCounterPrivateState>>;

export const SimpleCounterPrivateStateId = "simpleCounterPrivateState";

export type SimpleCounterProviders = MidnightProviders<
  SimpleCounterCircuits,
  typeof SimpleCounterPrivateStateId,
  SimpleCounterPrivateState
>;

export type SimpleCounterContract = SimpleCounter.Contract<SimpleCounterPrivateState>;

export type DeployedSimpleCounterContract =
  | DeployedContract<SimpleCounterContract>
  | FoundContract<SimpleCounterContract>;
