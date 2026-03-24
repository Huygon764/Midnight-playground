import { PayrollLite, type PayrollPrivateState } from "@example/payroll-lite-contract";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import type { DeployedContract, FoundContract } from "@midnight-ntwrk/midnight-js-contracts";
import type { ImpureCircuitId } from "@midnight-ntwrk/compact-js";

export type PayrollCircuits = ImpureCircuitId<PayrollLite.Contract<PayrollPrivateState>>;

export const PayrollPrivateStateId = "payrollPrivateState";

export type PayrollProviders = MidnightProviders<
  PayrollCircuits,
  typeof PayrollPrivateStateId,
  PayrollPrivateState
>;

export type PayrollContract = PayrollLite.Contract<PayrollPrivateState>;

export type DeployedPayrollContract =
  | DeployedContract<PayrollContract>
  | FoundContract<PayrollContract>;
