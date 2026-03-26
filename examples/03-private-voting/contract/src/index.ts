export * as PrivateVoting from "./managed/private-voting/contract/index.js";
export * from "./witnesses.js";

import { CompiledContract } from "@midnight-ntwrk/compact-js";
import * as PrivateVotingContract from "./managed/private-voting/contract/index.js";
import { witnesses, type VotingPrivateState } from "./witnesses.js";

export const CompiledVotingContract = CompiledContract.make<
  PrivateVotingContract.Contract<VotingPrivateState>
>(
  "private-voting",
  PrivateVotingContract.Contract<VotingPrivateState>,
).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets("./compiled/private-voting"),
);
