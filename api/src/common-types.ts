import { MPay, type MPayPrivateState } from "../../contract/src/index.js";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import type { DeployedContract, FoundContract } from "@midnight-ntwrk/midnight-js-contracts";
import { type ProvableCircuitId } from "@midnight-ntwrk/compact-js";

export type MPayCircuitKeys = ProvableCircuitId<MPay.Contract<MPayPrivateState>>;

export const mPayPrivateStateKey = "mPayPrivateState";
export type PrivateStateId = typeof mPayPrivateStateKey;

export type MPayProviders = MidnightProviders<MPayCircuitKeys, PrivateStateId, MPayPrivateState>;

export type MPayContract = MPay.Contract<MPayPrivateState>;

export type DeployedMPayContract =
  | DeployedContract<MPayContract>
  | FoundContract<MPayContract>;

export type MPayDerivedState = {
  readonly signerCount: bigint;
  readonly threshold: bigint;
  readonly finalized: boolean;
  readonly owner: Uint8Array;
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
