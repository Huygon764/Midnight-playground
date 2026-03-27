export * as PolyPay from "./managed/polypay/contract/index.js";
export * from "./witnesses.js";

import { CompiledContract } from "@midnight-ntwrk/compact-js";
import * as PolyPayContract from "./managed/polypay/contract/index.js";
import { witnesses, type PolyPayPrivateState } from "./witnesses.js";

export const CompiledPolyPayContract = CompiledContract.make<
  PolyPayContract.Contract<PolyPayPrivateState>
>(
  "polypay",
  PolyPayContract.Contract<PolyPayPrivateState>,
).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets("./compiled/polypay"),
);
