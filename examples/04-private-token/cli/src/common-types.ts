import { PrivateToken, type TokenPrivateState } from "@example/private-token-contract";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import type { DeployedContract, FoundContract } from "@midnight-ntwrk/midnight-js-contracts";
import type { ImpureCircuitId } from "@midnight-ntwrk/compact-js";

export type TokenCircuits = ImpureCircuitId<PrivateToken.Contract<TokenPrivateState>>;

export const TokenPrivateStateId = "tokenPrivateState";

export type TokenProviders = MidnightProviders<
  TokenCircuits,
  typeof TokenPrivateStateId,
  TokenPrivateState
>;

export type TokenContract = PrivateToken.Contract<TokenPrivateState>;

export type DeployedTokenContract =
  | DeployedContract<TokenContract>
  | FoundContract<TokenContract>;
