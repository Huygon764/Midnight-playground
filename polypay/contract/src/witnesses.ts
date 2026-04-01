import { type Ledger } from "./managed/polypay/contract/index.js";
import { type Ledger as TokenLedger } from "./managed/token/contract/index.js";
import { type WitnessContext } from "@midnight-ntwrk/compact-runtime";

export type PolyPayPrivateState = {
  readonly secret: Uint8Array;
};

export const createPolyPayPrivateState = (secret: Uint8Array): PolyPayPrivateState => ({
  secret,
});

// Witness provides secret to ZK circuits without disclosing it on-chain.
// All impure circuits require this witness — see ADR-001 for why.
export const witnesses = {
  localSecret: ({
    privateState,
  }: WitnessContext<Ledger, PolyPayPrivateState>): [PolyPayPrivateState, Uint8Array] => [
    privateState,
    privateState.secret,
  ],
};

export type TokenPrivateState = {
  readonly secret: Uint8Array;
};

export const createTokenPrivateState = (secret: Uint8Array): TokenPrivateState => ({
  secret,
});

export const tokenWitnesses = {
  localSecret: ({
    privateState,
  }: WitnessContext<TokenLedger, TokenPrivateState>): [TokenPrivateState, Uint8Array] => [
    privateState,
    privateState.secret,
  ],
};
