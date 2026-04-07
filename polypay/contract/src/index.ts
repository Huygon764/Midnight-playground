export * as PolyPay from "./managed/polypay/contract/index.js";
export * as Token from "./managed/token/contract/index.js";
export * as TestShielded from "./managed/test-shielded/contract/index.js";
export * from "./witnesses.js";

import { CompiledContract } from "@midnight-ntwrk/compact-js";
import * as PolyPayContract from "./managed/polypay/contract/index.js";
import * as TokenContract from "./managed/token/contract/index.js";
import * as TestShieldedContract from "./managed/test-shielded/contract/index.js";
import {
  witnesses,
  tokenWitnesses,
  type PolyPayPrivateState,
  type TokenPrivateState,
} from "./witnesses.js";

export const CompiledPolyPayContract = CompiledContract.make<
  PolyPayContract.Contract<PolyPayPrivateState>
>(
  "polypay",
  PolyPayContract.Contract<PolyPayPrivateState>,
).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets("./compiled/polypay"),
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

// Minimal test contract for shielded operations
type TestShieldedPrivateState = { readonly secret: Uint8Array };
const testShieldedWitnesses = {
  localSecret: ({ privateState }: { privateState: TestShieldedPrivateState }): [TestShieldedPrivateState, Uint8Array] => [
    privateState,
    privateState.secret,
  ],
};
export const CompiledTestShieldedContract = CompiledContract.make<
  TestShieldedContract.Contract<TestShieldedPrivateState>
>(
  "test-shielded",
  TestShieldedContract.Contract<TestShieldedPrivateState>,
).pipe(
  CompiledContract.withWitnesses(testShieldedWitnesses),
  CompiledContract.withCompiledFileAssets("./compiled/test-shielded"),
);
