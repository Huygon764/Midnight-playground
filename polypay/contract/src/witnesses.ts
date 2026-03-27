import { type Ledger } from "./managed/polypay/contract/index.js";
import { type WitnessContext } from "@midnight-ntwrk/compact-runtime";

export type PolyPayPrivateState = {
  readonly secret: Uint8Array;
};

export const createPolyPayPrivateState = (secret: Uint8Array): PolyPayPrivateState => ({
  secret,
});

export const witnesses = {
  localSecret: ({
    privateState,
  }: WitnessContext<Ledger, PolyPayPrivateState>): [PolyPayPrivateState, Uint8Array] => [
    privateState,
    privateState.secret,
  ],
};
