export * as PayrollLite from "./managed/payroll-lite/contract/index.js";
export * from "./witnesses.js";

import { CompiledContract } from "@midnight-ntwrk/compact-js";
import * as PayrollLiteContract from "./managed/payroll-lite/contract/index.js";
import { witnesses, type PayrollPrivateState } from "./witnesses.js";

export const CompiledPayrollContract = CompiledContract.make<
  PayrollLiteContract.Contract<PayrollPrivateState>
>(
  "payroll-lite",
  PayrollLiteContract.Contract<PayrollPrivateState>,
).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets("./compiled/payroll-lite"),
);
