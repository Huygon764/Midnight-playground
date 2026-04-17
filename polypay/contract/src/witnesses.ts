import { type Ledger } from "./managed/polypay/contract/index.js";
import { type Ledger as TokenLedger } from "./managed/token/contract/index.js";
import { type WitnessContext } from "@midnight-ntwrk/compact-runtime";

export type PolyPayPrivateState = {
  readonly secret: Uint8Array;
  readonly pendingTransferRecipient?: Uint8Array;
  readonly pendingTransferAmount?: bigint;
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

  transferRecipient: ({
    privateState,
  }: WitnessContext<Ledger, PolyPayPrivateState>): [PolyPayPrivateState, Uint8Array] => {
    if (!privateState.pendingTransferRecipient) {
      throw new Error("No pending transfer recipient set");
    }
    return [privateState, privateState.pendingTransferRecipient];
  },

  transferAmount: ({
    privateState,
  }: WitnessContext<Ledger, PolyPayPrivateState>): [PolyPayPrivateState, bigint] => {
    if (privateState.pendingTransferAmount === undefined) {
      throw new Error("No pending transfer amount set");
    }
    return [privateState, privateState.pendingTransferAmount];
  },
};

// Token contract
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
