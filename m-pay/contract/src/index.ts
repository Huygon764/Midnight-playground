export * as MPay from "./managed/mpay/contract/index.js";
export * as Token from "./managed/token/contract/index.js";
export * from "./witnesses.js";

import { CompiledContract } from "@midnight-ntwrk/compact-js";
import * as MPayContract from "./managed/mpay/contract/index.js";
import * as TokenContract from "./managed/token/contract/index.js";
import {
  witnesses,
  tokenWitnesses,
  type MPayPrivateState,
  type TokenPrivateState,
} from "./witnesses.js";

export const CompiledMPayContract = CompiledContract.make<
  MPayContract.Contract<MPayPrivateState>
>(
  "mpay",
  MPayContract.Contract<MPayPrivateState>,
).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets("./compiled/mpay"),
);

export const CompiledTokenContract = CompiledContract.make<
  TokenContract.Contract<TokenPrivateState>
>(
  "token",
  TokenContract.Contract<TokenPrivateState>,
).pipe(
  CompiledContract.withWitnesses(tokenWitnesses),
  CompiledContract.withCompiledFileAssets("./compiled/token"),
);
