import { PrivateVoting, type VotingPrivateState } from "@example/private-voting-contract";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import type { DeployedContract, FoundContract } from "@midnight-ntwrk/midnight-js-contracts";
import type { ImpureCircuitId } from "@midnight-ntwrk/compact-js";

export type VotingCircuits = ImpureCircuitId<PrivateVoting.Contract<VotingPrivateState>>;

export const VotingPrivateStateId = "votingPrivateState";

export type VotingProviders = MidnightProviders<
  VotingCircuits,
  typeof VotingPrivateStateId,
  VotingPrivateState
>;

export type VotingContract = PrivateVoting.Contract<VotingPrivateState>;

export type DeployedVotingContract =
  | DeployedContract<VotingContract>
  | FoundContract<VotingContract>;
