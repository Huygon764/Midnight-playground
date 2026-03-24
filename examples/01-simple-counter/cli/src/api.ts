import { type ContractAddress } from "@midnight-ntwrk/compact-runtime";
import { SimpleCounter, type SimpleCounterPrivateState, witnesses } from "@example/simple-counter-contract";
import * as ledger from "@midnight-ntwrk/ledger-v7";
import { unshieldedToken } from "@midnight-ntwrk/ledger-v7";
import { deployContract, findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { type FinalizedTxData, type MidnightProvider, type WalletProvider } from "@midnight-ntwrk/midnight-js-types";
import { WalletFacade } from "@midnight-ntwrk/wallet-sdk-facade";
import { DustWallet } from "@midnight-ntwrk/wallet-sdk-dust-wallet";
import { HDWallet, Roles, generateRandomSeed } from "@midnight-ntwrk/wallet-sdk-hd";
import { ShieldedWallet } from "@midnight-ntwrk/wallet-sdk-shielded";
import {
  createKeystore,
  InMemoryTransactionHistoryStorage,
  PublicKey,
  UnshieldedWallet,
  type UnshieldedKeystore,
} from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
import * as Rx from "rxjs";
import { WebSocket } from "ws";
import {
  type SimpleCounterCircuits,
  type SimpleCounterProviders,
  type DeployedSimpleCounterContract,
} from "./common-types.js";
import { type Config, contractConfig } from "./config.js";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { assertIsContractAddress, toHex } from "@midnight-ntwrk/midnight-js-utils";
import { getNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { CompiledContract } from "@midnight-ntwrk/compact-js";
import { Buffer } from "buffer";

// @ts-expect-error: Required for GraphQL subscriptions in Node.js
globalThis.WebSocket = WebSocket;

const compiledContract = CompiledContract.make("simple-counter", SimpleCounter.Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(contractConfig.zkConfigPath),
);

export interface WalletContext {
  wallet: WalletFacade;
  shieldedSecretKeys: ledger.ZswapSecretKeys;
  dustSecretKey: ledger.DustSecretKey;
  unshieldedKeystore: UnshieldedKeystore;
}

const formatBalance = (balance: bigint): string => balance.toLocaleString();

export const withStatus = async <T>(message: string, fn: () => Promise<T>): Promise<T> => {
  const frames = ["|", "/", "-", "\\"];
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r  ${frames[i++ % frames.length]} ${message}`);
  }, 120);
  try {
    const result = await fn();
    clearInterval(interval);
    process.stdout.write(`\r  + ${message}\n`);
    return result;
  } catch (e) {
    clearInterval(interval);
    process.stdout.write(`\r  x ${message}\n`);
    throw e;
  }
};

export const getCounterLedgerState = async (
  providers: SimpleCounterProviders,
  contractAddress: ContractAddress,
): Promise<bigint | null> => {
  assertIsContractAddress(contractAddress);
  const state = await providers.publicDataProvider
    .queryContractState(contractAddress)
    .then((contractState) =>
      contractState != null ? SimpleCounter.ledger(contractState.data).round : null,
    );
  return state;
};

export const deploy = async (
  providers: SimpleCounterProviders,
  privateState: SimpleCounterPrivateState,
): Promise<DeployedSimpleCounterContract> => {
  const counterContract = await deployContract(providers, {
    compiledContract,
    privateStateId: "simpleCounterPrivateState",
    initialPrivateState: privateState,
  });
  return counterContract;
};

export const joinContract = async (
  providers: SimpleCounterProviders,
  contractAddress: string,
): Promise<DeployedSimpleCounterContract> => {
  return await findDeployedContract(providers, {
    contractAddress,
    compiledContract,
    privateStateId: "simpleCounterPrivateState",
    initialPrivateState: { privateCounter: 0 },
  });
};

export const increment = async (contract: DeployedSimpleCounterContract): Promise<FinalizedTxData> => {
  const result = await contract.callTx.increment();
  return result.public;
};

export const decrement = async (contract: DeployedSimpleCounterContract): Promise<FinalizedTxData> => {
  const result = await contract.callTx.decrement();
  return result.public;
};

const signTransactionIntents = (
  tx: { intents?: Map<number, any> },
  signFn: (payload: Uint8Array) => ledger.Signature,
  proofMarker: "proof" | "pre-proof",
): void => {
  if (!tx.intents || tx.intents.size === 0) return;
  for (const segment of tx.intents.keys()) {
    const intent = tx.intents.get(segment);
    if (!intent) continue;
    const cloned = ledger.Intent.deserialize<ledger.SignatureEnabled, ledger.Proofish, ledger.PreBinding>(
      "signature",
      proofMarker,
      "pre-binding",
      intent.serialize(),
    );
    const sigData = cloned.signatureData(segment);
    const signature = signFn(sigData);
    if (cloned.fallibleUnshieldedOffer) {
      const sigs = cloned.fallibleUnshieldedOffer.inputs.map(
        (_: ledger.UtxoSpend, i: number) => cloned.fallibleUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.fallibleUnshieldedOffer = cloned.fallibleUnshieldedOffer.addSignatures(sigs);
    }
    if (cloned.guaranteedUnshieldedOffer) {
      const sigs = cloned.guaranteedUnshieldedOffer.inputs.map(
        (_: ledger.UtxoSpend, i: number) => cloned.guaranteedUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.guaranteedUnshieldedOffer = cloned.guaranteedUnshieldedOffer.addSignatures(sigs);
    }
    tx.intents.set(segment, cloned);
  }
};

export const createWalletAndMidnightProvider = async (
  ctx: WalletContext,
): Promise<WalletProvider & MidnightProvider> => {
  const state = await Rx.firstValueFrom(ctx.wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  return {
    getCoinPublicKey() {
      return state.shielded.coinPublicKey.toHexString();
    },
    getEncryptionPublicKey() {
      return state.shielded.encryptionPublicKey.toHexString();
    },
    async balanceTx(tx, ttl?) {
      const recipe = await ctx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: ctx.shieldedSecretKeys, dustSecretKey: ctx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      const signFn = (payload: Uint8Array) => ctx.unshieldedKeystore.signData(payload);
      signTransactionIntents(recipe.baseTransaction, signFn, "proof");
      if (recipe.balancingTransaction) {
        signTransactionIntents(recipe.balancingTransaction, signFn, "pre-proof");
      }
      return ctx.wallet.finalizeRecipe(recipe);
    },
    submitTx(tx) {
      return ctx.wallet.submitTransaction(tx) as any;
    },
  };
};

export const waitForSync = (wallet: WalletFacade) =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(5_000),
      Rx.filter((state) => state.isSynced),
    ),
  );

export const waitForFunds = (wallet: WalletFacade): Promise<bigint> =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(10_000),
      Rx.filter((state) => state.isSynced),
      Rx.map((s) => s.unshielded.balances[unshieldedToken().raw] ?? 0n),
      Rx.filter((balance) => balance > 0n),
    ),
  );

const buildShieldedConfig = ({ indexer, indexerWS, node, proofServer }: Config) => ({
  networkId: getNetworkId(),
  indexerClientConnection: { indexerHttpUrl: indexer, indexerWsUrl: indexerWS },
  provingServerUrl: new URL(proofServer),
  relayURL: new URL(node.replace(/^http/, "ws")),
});

const buildUnshieldedConfig = ({ indexer, indexerWS }: Config) => ({
  networkId: getNetworkId(),
  indexerClientConnection: { indexerHttpUrl: indexer, indexerWsUrl: indexerWS },
  txHistoryStorage: new InMemoryTransactionHistoryStorage(),
});

const buildDustConfig = ({ indexer, indexerWS, node, proofServer }: Config) => ({
  networkId: getNetworkId(),
  costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 },
  indexerClientConnection: { indexerHttpUrl: indexer, indexerWsUrl: indexerWS },
  provingServerUrl: new URL(proofServer),
  relayURL: new URL(node.replace(/^http/, "ws")),
});

const deriveKeysFromSeed = (seed: string) => {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, "hex"));
  if (hdWallet.type !== "seedOk") {
    throw new Error("Failed to initialize HDWallet from seed");
  }
  const derivationResult = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);
  if (derivationResult.type !== "keysDerived") {
    throw new Error("Failed to derive keys");
  }
  hdWallet.hdWallet.clear();
  return derivationResult.keys;
};

const registerForDustGeneration = async (
  wallet: WalletFacade,
  unshieldedKeystore: UnshieldedKeystore,
): Promise<void> => {
  const state = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  if (state.dust.availableCoins.length > 0) {
    const dustBal = state.dust.walletBalance(new Date());
    console.log(`  + Dust tokens already available (${formatBalance(dustBal)} DUST)`);
    return;
  }
  const nightUtxos = state.unshielded.availableCoins.filter(
    (coin: any) => coin.meta?.registeredForDustGeneration !== true,
  );
  if (nightUtxos.length === 0) {
    await withStatus("Waiting for dust tokens to generate", () =>
      Rx.firstValueFrom(
        wallet.state().pipe(
          Rx.throttleTime(5_000),
          Rx.filter((s) => s.isSynced),
          Rx.filter((s) => s.dust.walletBalance(new Date()) > 0n),
        ),
      ),
    );
    return;
  }
  await withStatus(`Registering ${nightUtxos.length} NIGHT UTXO(s) for dust generation`, async () => {
    const recipe = await wallet.registerNightUtxosForDustGeneration(
      nightUtxos,
      unshieldedKeystore.getPublicKey(),
      (payload) => unshieldedKeystore.signData(payload),
    );
    const finalized = await wallet.finalizeRecipe(recipe);
    await wallet.submitTransaction(finalized);
  });
  await withStatus("Waiting for dust tokens to generate", () =>
    Rx.firstValueFrom(
      wallet.state().pipe(
        Rx.throttleTime(5_000),
        Rx.filter((s) => s.isSynced),
        Rx.filter((s) => s.dust.walletBalance(new Date()) > 0n),
      ),
    ),
  );
};

export const buildWalletAndWaitForFunds = async (config: Config, seed: string): Promise<WalletContext> => {
  const { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore } = await withStatus(
    "Building wallet",
    async () => {
      const keys = deriveKeysFromSeed(seed);
      const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
      const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
      const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], getNetworkId());
      const shieldedWallet = ShieldedWallet(buildShieldedConfig(config)).startWithSecretKeys(shieldedSecretKeys);
      const unshieldedWallet = UnshieldedWallet(buildUnshieldedConfig(config)).startWithPublicKey(
        PublicKey.fromKeyStore(unshieldedKeystore),
      );
      const dustWallet = DustWallet(buildDustConfig(config)).startWithSecretKey(
        dustSecretKey,
        ledger.LedgerParameters.initialParameters().dust,
      );
      const wallet = new WalletFacade(shieldedWallet, unshieldedWallet, dustWallet);
      await wallet.start(shieldedSecretKeys, dustSecretKey);
      return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
    },
  );

  const DIV = "--------------------------------------------------------------";
  console.log(`
${DIV}
  Wallet Overview                            Network: ${getNetworkId()}
${DIV}
  Seed: ${seed}

  Unshielded Address (send tNight here):
  ${unshieldedKeystore.getBech32Address()}
${DIV}
`);

  await withStatus("Syncing with network", () => waitForSync(wallet));

  const syncedState = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  const balance = syncedState.unshielded.balances[unshieldedToken().raw] ?? 0n;
  if (balance === 0n) {
    const fundedBalance = await withStatus("Waiting for incoming tokens", () => waitForFunds(wallet));
    console.log(`    Balance: ${formatBalance(fundedBalance)} tNight\n`);
  } else {
    console.log(`  Balance: ${formatBalance(balance)} tNight\n`);
  }

  await registerForDustGeneration(wallet, unshieldedKeystore);
  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
};

export const buildFreshWallet = async (config: Config): Promise<WalletContext> =>
  buildWalletAndWaitForFunds(config, toHex(Buffer.from(generateRandomSeed())));

export const configureProviders = async (ctx: WalletContext, config: Config): Promise<SimpleCounterProviders> => {
  const walletAndMidnightProvider = await createWalletAndMidnightProvider(ctx);
  const zkConfigProvider = new NodeZkConfigProvider<SimpleCounterCircuits>(contractConfig.zkConfigPath);
  return {
    privateStateProvider: levelPrivateStateProvider<typeof import("./common-types.js").SimpleCounterPrivateStateId>({
      privateStateStoreName: contractConfig.privateStateStoreName,
      walletProvider: walletAndMidnightProvider,
    }),
    publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(config.proofServer, zkConfigProvider),
    walletProvider: walletAndMidnightProvider,
    midnightProvider: walletAndMidnightProvider,
  };
};

export const getDustBalance = async (
  wallet: WalletFacade,
): Promise<{ available: bigint; pending: bigint }> => {
  const state = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  const available = state.dust.walletBalance(new Date());
  const pending = state.dust.pendingCoins.reduce((sum: bigint, c: any) => sum + c.initialValue, 0n);
  return { available, pending };
};
