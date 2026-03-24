import { type Ledger } from "./managed/private-token/contract/index.js";
import { type WitnessContext } from "@midnight-ntwrk/compact-runtime";

export type TokenPrivateState = {
  readonly secretKey: Uint8Array;
};

export const createTokenPrivateState = (secretKey: Uint8Array): TokenPrivateState => ({
  secretKey,
});

export const witnesses = {
  localSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, TokenPrivateState>): [TokenPrivateState, Uint8Array] => [
    privateState,
    privateState.secretKey,
  ],
};
