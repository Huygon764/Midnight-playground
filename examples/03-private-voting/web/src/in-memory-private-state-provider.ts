import type { SigningKey } from "@midnight-ntwrk/compact-runtime";
import type { ContractAddress } from "@midnight-ntwrk/ledger-v7";
import { type PrivateStateId, type PrivateStateProvider } from "@midnight-ntwrk/midnight-js-types";

export const inMemoryPrivateStateProvider = <PSI extends PrivateStateId, PS = unknown>(): PrivateStateProvider<
  PSI,
  PS
> => {
  const record = new Map<PSI, PS>();
  const signingKeys = {} as Record<ContractAddress, SigningKey>;

  return {
    set(key: PSI, state: PS): Promise<void> {
      record.set(key, state);
      return Promise.resolve();
    },
    get(key: PSI): Promise<PS | null> {
      return Promise.resolve(record.get(key) ?? null);
    },
    remove(key: PSI): Promise<void> {
      record.delete(key);
      return Promise.resolve();
    },
    clear(): Promise<void> {
      record.clear();
      return Promise.resolve();
    },
    setSigningKey(contractAddress: ContractAddress, signingKey: SigningKey): Promise<void> {
      signingKeys[contractAddress] = signingKey;
      return Promise.resolve();
    },
    getSigningKey(contractAddress: ContractAddress): Promise<SigningKey | null> {
      return Promise.resolve(signingKeys[contractAddress] ?? null);
    },
    removeSigningKey(contractAddress: ContractAddress): Promise<void> {
      delete signingKeys[contractAddress];
      return Promise.resolve();
    },
    clearSigningKeys(): Promise<void> {
      Object.keys(signingKeys).forEach((k) => delete signingKeys[k as ContractAddress]);
      return Promise.resolve();
    },
  };
};
