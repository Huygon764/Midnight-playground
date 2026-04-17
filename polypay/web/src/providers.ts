import { type PolyPayCircuitKeys, type PolyPayProviders } from "../../api/src/index.js";
import { type PolyPayPrivateState } from "../../contract/src/index.js";
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
} from "@midnight-ntwrk/ledger-v8";
import { inMemoryPrivateStateProvider } from "./in-memory-private-state-provider.js";
import { type UnboundTransaction } from "@midnight-ntwrk/midnight-js-types";
import { MidnightBech32m, UnshieldedAddress } from "@midnight-ntwrk/wallet-sdk-address-format";
import semver from "semver";

const COMPATIBLE_CONNECTOR_API_VERSION = "4.x";

let cachedProviders: Promise<PolyPayProviders> | undefined;
let cachedConnectedAPI: ConnectedAPI | undefined;
let cachedUnshieldedAddress: Uint8Array | undefined;
let cachedUnshieldedAddressBech32m: string | undefined;
let cachedShieldedCoinPublicKey: string | undefined;
let cachedShieldedAddress: string | undefined;
let cachedIndexerUri: string | undefined;

// Subscribers get notified as a submitted circuit progresses through stages
// (proof gen → wallet interaction → network submit). "wallet" covers
// unlock + balance + sign as one atomic step (SDK can't split them).
type TxStage = "wallet" | "submitting";
type TxStageListener = (stage: TxStage) => void;
let txStageListener: TxStageListener | null = null;

export const setTxStageListener = (fn: TxStageListener | null): void => {
  txStageListener = fn;
};

export const getProviders = (): Promise<PolyPayProviders> => {
  return cachedProviders ?? (cachedProviders = initializeProviders());
};

export const getConnectedAPI = (): ConnectedAPI => {
  if (!cachedConnectedAPI) throw new Error("Wallet not connected");
  return cachedConnectedAPI;
};

export const getUnshieldedAddressBytes = (): Uint8Array => {
  if (!cachedUnshieldedAddress) throw new Error("Wallet not connected");
  return cachedUnshieldedAddress;
};

export const getShieldedCoinPublicKey = (): string => {
  if (!cachedShieldedCoinPublicKey) throw new Error("Wallet not connected");
  return cachedShieldedCoinPublicKey;
};

export const getShieldedAddress = (): string => {
  if (!cachedShieldedAddress) throw new Error("Wallet not connected");
  return cachedShieldedAddress;
};

export const getUnshieldedAddress = (): string => {
  if (!cachedUnshieldedAddressBech32m) throw new Error("Wallet not connected");
  return cachedUnshieldedAddressBech32m;
};

export const getIndexerUri = (): string => {
  if (!cachedIndexerUri) throw new Error("Wallet not connected");
  return cachedIndexerUri;
};

const initializeProviders = async (): Promise<PolyPayProviders> => {
  const networkId = (import.meta.env.VITE_NETWORK_ID ?? "preprod") as string;
  const connectedAPI = await connectToWallet(networkId);
  cachedConnectedAPI = connectedAPI;
  const zkConfigPath = window.location.origin;
  const baseProvider = new FetchZkConfigProvider<PolyPayCircuitKeys>(zkConfigPath, fetch.bind(window));
  // Wrapper: throw for system circuits (midnight/*) so http-client-proof-provider
  // passes undefined keyMaterial and the proof server uses its built-in system keys.
  // Without this, vite SPA fallback returns index.html for missing /keys/midnight/...
  // paths, which corrupts the proving payload.
  const keyMaterialProvider = new Proxy(baseProvider, {
    get(target, prop, receiver) {
      if (prop === "getProverKey" || prop === "getVerifierKey" || prop === "getZKIR") {
        return (circuitId: string) => {
          if (circuitId.startsWith("midnight/")) {
            return Promise.reject(new Error(`system circuit ${circuitId} — use proof server built-in`));
          }
          return (Reflect.get(target, prop, receiver) as any).call(target, circuitId);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
  const config = await connectedAPI.getConfiguration();
  cachedIndexerUri = config.indexerUri;
  const privateStateProvider = inMemoryPrivateStateProvider<string, PolyPayPrivateState>();
  const shieldedAddresses = await connectedAPI.getShieldedAddresses();
  cachedShieldedCoinPublicKey = shieldedAddresses.shieldedCoinPublicKey;
  // Combined bech32m shielded address (cpk + encryption pk). Preferred for UI
  // display — users paste and read these, not raw 32-byte cpk hex.
  cachedShieldedAddress = (shieldedAddresses as { shieldedAddress?: string }).shieldedAddress;

  const { unshieldedAddress } = await connectedAPI.getUnshieldedAddress();
  cachedUnshieldedAddressBech32m = unshieldedAddress;
  const parsed = MidnightBech32m.parse(unshieldedAddress);
  const decoded = parsed.decode(UnshieldedAddress, networkId);
  cachedUnshieldedAddress = new Uint8Array(decoded.data);

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
        // Wallet interaction starts — unlock (if locked), balance, then sign.
        // All happen inside this single call; consumers can show a timed
        // "wallet may be locked" hint if this stage doesn't progress quickly.
        txStageListener?.("wallet");
        const serializedTx = toHex(tx.serialize());
        const received = await connectedAPI.balanceUnsealedTransaction(serializedTx);
        return Transaction.deserialize<SignatureEnabled, Proof, Binding>(
          "signature",
          "proof",
          "binding",
          fromHex(received.tx),
        );
      },
    },
    midnightProvider: {
      submitTx: async (tx: FinalizedTransaction): Promise<TransactionId> => {
        txStageListener?.("submitting");
        await connectedAPI.submitTransaction(toHex(tx.serialize()));
        return tx.identifiers()[0];
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
