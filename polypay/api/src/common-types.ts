import { PolyPay, type PolyPayPrivateState } from "../../contract/src/index.js";
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
  readonly totalSupply: bigint;
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
