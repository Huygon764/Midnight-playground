import { type PayrollCircuitKeys, type PayrollProviders } from "../../api/src/index.js";
import { type PayrollPrivateState } from "../../contract/src/index.js";
import { fromHex, toHex } from "@midnight-ntwrk/compact-runtime";
import {
  concatMap,
  filter,
  firstValueFrom,
  interval,
  map,
  take,
  throwError,
  timeout,
} from "rxjs";
import { type ConnectedAPI, type InitialAPI } from "@midnight-ntwrk/dapp-connector-api";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import {
  Binding,
  type FinalizedTransaction,
  Proof,
  SignatureEnabled,
  Transaction,
  type TransactionId,
} from "@midnight-ntwrk/ledger-v7";
import { inMemoryPrivateStateProvider } from "./in-memory-private-state-provider.js";
import { type UnboundTransaction } from "@midnight-ntwrk/midnight-js-types";
import semver from "semver";

const COMPATIBLE_CONNECTOR_API_VERSION = "4.x";

let cachedProviders: Promise<PayrollProviders> | undefined;

export const getProviders = (): Promise<PayrollProviders> => {
  return cachedProviders ?? (cachedProviders = initializeProviders());
};

const initializeProviders = async (): Promise<PayrollProviders> => {
  const networkId = (import.meta.env.VITE_NETWORK_ID ?? "preprod") as string;
  const connectedAPI = await connectToWallet(networkId);
  const zkConfigPath = window.location.origin;
  const keyMaterialProvider = new FetchZkConfigProvider<PayrollCircuitKeys>(zkConfigPath, fetch.bind(window));
  const config = await connectedAPI.getConfiguration();
  console.log("[providers] Wallet config:", JSON.stringify(config, null, 2));
  const privateStateProvider = inMemoryPrivateStateProvider<string, PayrollPrivateState>();
  const shieldedAddresses = await connectedAPI.getShieldedAddresses();

  if (!config.proverServerUri) {
    console.warn("[providers] proverServerUri is undefined! Proof generation will fail.");
  }

  return {
    privateStateProvider,
    zkConfigProvider: keyMaterialProvider,
    proofProvider: httpClientProofProvider(config.proverServerUri!, keyMaterialProvider),
    publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
    walletProvider: {
      getCoinPublicKey(): string {
        return shieldedAddresses.shieldedCoinPublicKey;
      },
      getEncryptionPublicKey(): string {
        return shieldedAddresses.shieldedEncryptionPublicKey;
      },
      balanceTx: async (tx: UnboundTransaction): Promise<FinalizedTransaction> => {
        try {
          console.log("[balanceTx] Sending tx to wallet for balancing...");
          const serializedTx = toHex(tx.serialize());
          const received = await connectedAPI.balanceUnsealedTransaction(serializedTx);
          console.log("[balanceTx] Wallet balanced tx successfully");
          return Transaction.deserialize<SignatureEnabled, Proof, Binding>(
            "signature",
            "proof",
            "binding",
            fromHex(received.tx),
          );
        } catch (e) {
          console.error("[balanceTx] FAILED:", e);
          throw e;
        }
      },
    },
    midnightProvider: {
      submitTx: async (tx: FinalizedTransaction): Promise<TransactionId> => {
        try {
          console.log("[submitTx] Submitting tx to network...");
          await connectedAPI.submitTransaction(toHex(tx.serialize()));
          const txId = tx.identifiers()[0];
          console.log("[submitTx] Submitted successfully, txId:", txId);
          return txId;
        } catch (e) {
          console.error("[submitTx] FAILED:", e);
          throw e;
        }
      },
    },
  };
};

const getFirstCompatibleWallet = (): InitialAPI | undefined => {
  if (!window.midnight) return undefined;
  return Object.values(window.midnight).find(
    (wallet): wallet is InitialAPI =>
      !!wallet &&
      typeof wallet === "object" &&
      "apiVersion" in wallet &&
      semver.satisfies(wallet.apiVersion, COMPATIBLE_CONNECTOR_API_VERSION),
  );
};

const connectToWallet = (networkId: string): Promise<ConnectedAPI> => {
  return firstValueFrom(
    interval(100).pipe(
      map(() => getFirstCompatibleWallet()),
      filter((w): w is InitialAPI => !!w),
      take(1),
      timeout({
        first: 1_000,
        with: () => throwError(() => new Error("Midnight Lace wallet not found. Extension installed?")),
      }),
      concatMap(async (initialAPI) => {
        const connectedAPI = await initialAPI.connect(networkId);
        await connectedAPI.getConnectionStatus();
        return connectedAPI;
      }),
      timeout({
        first: 5_000,
        with: () => throwError(() => new Error("Midnight Lace wallet failed to respond. Extension enabled?")),
      }),
    ),
  );
};
