import { type Ledger, pureCircuits } from "./managed/private-voting/contract/index.js";
import { type WitnessContext, type MerkleTreePath } from "@midnight-ntwrk/compact-runtime";

export type VotingPrivateState = {
  readonly secretKey: Uint8Array;
};

export const createVotingPrivateState = (secretKey: Uint8Array): VotingPrivateState => ({
  secretKey,
});

export const witnesses = {
  localSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, VotingPrivateState>): [VotingPrivateState, Uint8Array] => [
    privateState,
    privateState.secretKey,
  ],

  voterMerklePath: ({
    ledger,
    privateState,
  }: WitnessContext<Ledger, VotingPrivateState>): [VotingPrivateState, MerkleTreePath<Uint8Array>] => {
    const commitment = pureCircuits.voterCommitment(privateState.secretKey);
    const path = ledger.voters.findPathForLeaf(commitment);
    if (path === undefined) {
      throw new Error("Voter commitment not found in tree");
    }
    return [privateState, path];
  },
};
