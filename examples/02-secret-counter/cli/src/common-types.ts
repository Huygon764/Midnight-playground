import { SecretCounter, type SecretCounterPrivateState } from "@example/secret-counter-contract";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import type { DeployedContract, FoundContract } from "@midnight-ntwrk/midnight-js-contracts";
import type { ImpureCircuitId } from "@midnight-ntwrk/compact-js";

export type SecretCounterCircuits = ImpureCircuitId<SecretCounter.Contract<SecretCounterPrivateState>>;

export const SecretCounterPrivateStateId = "secretCounterPrivateState";

export type SecretCounterProviders = MidnightProviders<
  SecretCounterCircuits,
  typeof SecretCounterPrivateStateId,
  SecretCounterPrivateState
>;

export type SecretCounterContract = SecretCounter.Contract<SecretCounterPrivateState>;

export type DeployedSecretCounterContract =
  | DeployedContract<SecretCounterContract>
  | FoundContract<SecretCounterContract>;
