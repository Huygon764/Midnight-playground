import { Ledger } from "./managed/secret-counter/contract/index.js";
import { WitnessContext } from "@midnight-ntwrk/compact-runtime";

export type SecretCounterPrivateState = {
  readonly secretKey: Uint8Array;
};

export const createSecretCounterPrivateState = (secretKey: Uint8Array): SecretCounterPrivateState => ({
  secretKey,
});

export const witnesses = {
  localSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, SecretCounterPrivateState>): [
    SecretCounterPrivateState,
    Uint8Array,
  ] => [privateState, privateState.secretKey],
};
