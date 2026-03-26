import { PrivateVoting, type VotingPrivateState } from "../../contract/src/index.js";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import type { DeployedContract, FoundContract } from "@midnight-ntwrk/midnight-js-contracts";
import type { ImpureCircuitId } from "@midnight-ntwrk/compact-js";

export type VotingCircuitKeys = ImpureCircuitId<PrivateVoting.Contract<VotingPrivateState>>;

export const votingPrivateStateKey = "votingPrivateState";
export type PrivateStateId = typeof votingPrivateStateKey;

export type VotingProviders = MidnightProviders<VotingCircuitKeys, PrivateStateId, VotingPrivateState>;

export type VotingContract = PrivateVoting.Contract<VotingPrivateState>;

export type DeployedVotingContract =
  | DeployedContract<VotingContract>
  | FoundContract<VotingContract>;

export type VotingDerivedState = {
  readonly yesVotes: bigint;
  readonly noVotes: bigint;
  readonly votingOpen: boolean;
};
