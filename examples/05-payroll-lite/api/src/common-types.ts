import { PayrollLite, type PayrollPrivateState } from "../../contract/src/index.js";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import type { DeployedContract, FoundContract } from "@midnight-ntwrk/midnight-js-contracts";
import type { ImpureCircuitId } from "@midnight-ntwrk/compact-js";

export type PayrollCircuitKeys = ImpureCircuitId<PayrollLite.Contract<PayrollPrivateState>>;

export const payrollPrivateStateKey = "payrollPrivateState";
export type PrivateStateId = typeof payrollPrivateStateKey;

export type PayrollProviders = MidnightProviders<PayrollCircuitKeys, PrivateStateId, PayrollPrivateState>;

export type PayrollContract = PayrollLite.Contract<PayrollPrivateState>;

export type DeployedPayrollContract =
  | DeployedContract<PayrollContract>
  | FoundContract<PayrollContract>;

export type PayrollDerivedState = {
  readonly period: bigint;
  readonly employer: Uint8Array;
  readonly claimedAmount: bigint;
};
