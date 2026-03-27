export * as PrivateToken from "./managed/private-token/contract/index.js";
export * from "./witnesses.js";

import { CompiledContract } from "@midnight-ntwrk/compact-js";
import * as PrivateTokenContract from "./managed/private-token/contract/index.js";
import { witnesses, type TokenPrivateState } from "./witnesses.js";

export const CompiledTokenContract = CompiledContract.make<
  PrivateTokenContract.Contract<TokenPrivateState>
>(
  "private-token",
  PrivateTokenContract.Contract<TokenPrivateState>,
).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets("./compiled/private-token"),
);
