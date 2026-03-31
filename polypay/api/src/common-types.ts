import { PolyPay, Token, type PolyPayPrivateState, type TokenPrivateState } from "../../contract/src/index.js";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import type { DeployedContract, FoundContract } from "@midnight-ntwrk/midnight-js-contracts";
import type { ImpureCircuitId } from "@midnight-ntwrk/compact-js";

export type PolyPayCircuitKeys = ImpureCircuitId<PolyPay.Contract<PolyPayPrivateState>>;

export const polyPayPrivateStateKey = "polyPayPrivateState";
export type PrivateStateId = typeof polyPayPrivateStateKey;

export type PolyPayProviders = MidnightProviders<PolyPayCircuitKeys, PrivateStateId, PolyPayPrivateState>;

export type PolyPayContract = PolyPay.Contract<PolyPayPrivateState>;

export type DeployedPolyPayContract =
  | DeployedContract<PolyPayContract>
  | FoundContract<PolyPayContract>;

export type PolyPayDerivedState = {
  readonly tokenColor: Uint8Array;
  readonly signerCount: bigint;
  readonly threshold: bigint;
  readonly finalized: boolean;
  readonly txCounter: bigint;
};

export type TransactionInfo = {
  readonly txId: bigint;
  readonly txType: bigint;
  readonly status: bigint;
  readonly approvals: bigint;
};

// Token contract types
export type TokenCircuitKeys = ImpureCircuitId<Token.Contract<TokenPrivateState>>;

export const tokenPrivateStateKey = "tokenPrivateState";

export type TokenProviders = MidnightProviders<TokenCircuitKeys, typeof tokenPrivateStateKey, TokenPrivateState>;

export type TokenContract = Token.Contract<TokenPrivateState>;

export type DeployedTokenContract =
  | DeployedContract<TokenContract>
  | FoundContract<TokenContract>;
