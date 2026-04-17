import { PolyPay, type PolyPayPrivateState } from "../../contract/src/index.js";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import type { DeployedContract, FoundContract } from "@midnight-ntwrk/midnight-js-contracts";
import { type ProvableCircuitId } from "@midnight-ntwrk/compact-js";

export type PolyPayCircuitKeys = ProvableCircuitId<PolyPay.Contract<PolyPayPrivateState>>;

export const polyPayPrivateStateKey = "polyPayPrivateState";
export type PrivateStateId = typeof polyPayPrivateStateKey;

export type PolyPayProviders = MidnightProviders<PolyPayCircuitKeys, PrivateStateId, PolyPayPrivateState>;

export type PolyPayContract = PolyPay.Contract<PolyPayPrivateState>;

export type DeployedPolyPayContract =
  | DeployedContract<PolyPayContract>
  | FoundContract<PolyPayContract>;

export type PolyPayDerivedState = {
  readonly signerCount: bigint;
  readonly threshold: bigint;
  readonly finalized: boolean;
  readonly txCounter: bigint;
  readonly vaultBalance: bigint;
};

export type TransactionInfo = {
  readonly txId: bigint;
  readonly txType: bigint;
  readonly status: bigint;
  readonly approvals: bigint;
  readonly d0: Uint8Array;
};
