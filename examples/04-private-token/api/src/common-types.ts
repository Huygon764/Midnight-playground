import { PrivateToken, type TokenPrivateState } from "../../contract/src/index.js";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import type { DeployedContract, FoundContract } from "@midnight-ntwrk/midnight-js-contracts";
import type { ImpureCircuitId } from "@midnight-ntwrk/compact-js";

export type TokenCircuitKeys = ImpureCircuitId<PrivateToken.Contract<TokenPrivateState>>;

export const tokenPrivateStateKey = "tokenPrivateState";
export type PrivateStateId = typeof tokenPrivateStateKey;

export type TokenProviders = MidnightProviders<TokenCircuitKeys, PrivateStateId, TokenPrivateState>;

export type TokenContract = PrivateToken.Contract<TokenPrivateState>;

export type DeployedTokenContract =
  | DeployedContract<TokenContract>
  | FoundContract<TokenContract>;

export type TokenDerivedState = {
  readonly totalSupply: bigint;
  readonly owner: Uint8Array;
  readonly tokenName: string;
};
