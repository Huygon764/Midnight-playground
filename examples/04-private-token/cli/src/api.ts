import { type ContractAddress } from "@midnight-ntwrk/compact-runtime";
import { PrivateToken, type TokenPrivateState, witnesses } from "@example/private-token-contract";
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
import { type TokenCircuits, type TokenProviders, type DeployedTokenContract } from "./common-types.js";
import { type Config, contractConfig } from "./config.js";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { assertIsContractAddress, toHex } from "@midnight-ntwrk/midnight-js-utils";
import { getNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { CompiledContract } from "@midnight-ntwrk/compact-js";
import { Buffer } from "buffer";
import { randomBytes } from "crypto";

// @ts-expect-error: Required for GraphQL subscriptions in Node.js
globalThis.WebSocket = WebSocket;

const compiledContract = CompiledContract.make("private-token", PrivateToken.Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
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

// Query on-chain token state
export const getTokenState = async (
  providers: TokenProviders,
  contractAddress: ContractAddress,
) => {
  assertIsContractAddress(contractAddress);
  const state = await providers.publicDataProvider.queryContractState(contractAddress);
  if (state == null) return null;
  const l = PrivateToken.ledger(state.data);
  return {
    totalSupply: l.totalSupply,
    owner: l.owner,
    tokenName: l.tokenName,
  };
};

// Query on-chain balance for a specific address
export const getOnChainBalance = async (
  providers: TokenProviders,
  contractAddress: ContractAddress,
  addr: Uint8Array,
): Promise<bigint> => {
  assertIsContractAddress(contractAddress);
  const state = await providers.publicDataProvider.queryContractState(contractAddress);
  if (state == null) return 0n;
  const l = PrivateToken.ledger(state.data);
  if (l.balances.member(addr)) {
    return l.balances.lookup(addr);
  }
  return 0n;
};

export const generateSecretKey = (): Uint8Array => randomBytes(32);

// Derive a token address from a secret key using the contract's pure circuit
export const deriveAddress = (sk: Uint8Array): Uint8Array =>
  PrivateToken.pureCircuits.deriveAddress(sk);

export const deploy = async (
  providers: TokenProviders,
  secretKey: Uint8Array,
  tokenName: string,
): Promise<DeployedTokenContract> => {
  return await deployContract(providers, {
    compiledContract,
    privateStateId: "tokenPrivateState",
    initialPrivateState: { secretKey },
    args: [tokenName],
  });
};

export const joinContract = async (
  providers: TokenProviders,
  contractAddress: string,
  secretKey: Uint8Array,
): Promise<DeployedTokenContract> => {
  return await findDeployedContract(providers, {
    contractAddress,
    compiledContract,
    privateStateId: "tokenPrivateState",
    initialPrivateState: { secretKey },
  });
};

export const mint = async (
  contract: DeployedTokenContract,
  to: Uint8Array,
  amount: bigint,
): Promise<FinalizedTxData> => {
  const result = await contract.callTx.mint(to, amount);
  return result.public;
};

export const transfer = async (
  contract: DeployedTokenContract,
  to: Uint8Array,
  amount: bigint,
): Promise<FinalizedTxData> => {
  const result = await contract.callTx.transfer(to, amount);
  return result.public;
};

export const getBalance = async (
  contract: DeployedTokenContract,
  addr: Uint8Array,
): Promise<bigint> => {
  const result = await contract.callTx.getBalance(addr);
  return result.public.txData;
};

export const getTotalSupply = async (
  contract: DeployedTokenContract,
): Promise<bigint> => {
  const result = await contract.callTx.getTotalSupply();
  return result.public.txData;
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
      "signature", proofMarker, "pre-binding", intent.serialize(),
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
    getCoinPublicKey() { return state.shielded.coinPublicKey.toHexString(); },
    getEncryptionPublicKey() { return state.shielded.encryptionPublicKey.toHexString(); },
    async balanceTx(tx, ttl?) {
      const recipe = await ctx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: ctx.shieldedSecretKeys, dustSecretKey: ctx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      const signFn = (payload: Uint8Array) => ctx.unshieldedKeystore.signData(payload);
      signTransactionIntents(recipe.baseTransaction, signFn, "proof");
      if (recipe.balancingTransaction) signTransactionIntents(recipe.balancingTransaction, signFn, "pre-proof");
      return ctx.wallet.finalizeRecipe(recipe);
    },
    submitTx(tx) { return ctx.wallet.submitTransaction(tx) as any; },
  };
};

export const waitForSync = (wallet: WalletFacade) =>
  Rx.firstValueFrom(wallet.state().pipe(Rx.throttleTime(5_000), Rx.filter((s) => s.isSynced)));

export const waitForFunds = (wallet: WalletFacade): Promise<bigint> =>
  Rx.firstValueFrom(
    wallet.state().pipe(Rx.throttleTime(10_000), Rx.filter((s) => s.isSynced),
      Rx.map((s) => s.unshielded.balances[unshieldedToken().raw] ?? 0n), Rx.filter((b) => b > 0n)),
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
  if (hdWallet.type !== "seedOk") throw new Error("Failed to initialize HDWallet from seed");
  const result = hdWallet.hdWallet.selectAccount(0).selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust]).deriveKeysAt(0);
  if (result.type !== "keysDerived") throw new Error("Failed to derive keys");
  hdWallet.hdWallet.clear();
  return result.keys;
};

const registerForDustGeneration = async (wallet: WalletFacade, unshieldedKeystore: UnshieldedKeystore): Promise<void> => {
  const state = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  if (state.dust.availableCoins.length > 0) { console.log(`  + Dust available`); return; }
  const nightUtxos = state.unshielded.availableCoins.filter((c: any) => c.meta?.registeredForDustGeneration !== true);
  if (nightUtxos.length === 0) {
    await withStatus("Waiting for dust", () => Rx.firstValueFrom(wallet.state().pipe(Rx.throttleTime(5_000), Rx.filter((s) => s.isSynced), Rx.filter((s) => s.dust.walletBalance(new Date()) > 0n))));
    return;
  }
  await withStatus(`Registering ${nightUtxos.length} NIGHT UTXO(s)`, async () => {
    const recipe = await wallet.registerNightUtxosForDustGeneration(nightUtxos, unshieldedKeystore.getPublicKey(), (p) => unshieldedKeystore.signData(p));
    await wallet.submitTransaction(await wallet.finalizeRecipe(recipe));
  });
  await withStatus("Waiting for dust", () => Rx.firstValueFrom(wallet.state().pipe(Rx.throttleTime(5_000), Rx.filter((s) => s.isSynced), Rx.filter((s) => s.dust.walletBalance(new Date()) > 0n))));
};

export const buildWalletAndWaitForFunds = async (config: Config, seed: string): Promise<WalletContext> => {
  const { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore } = await withStatus("Building wallet", async () => {
    const keys = deriveKeysFromSeed(seed);
    const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
    const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
    const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], getNetworkId());
    const shieldedWallet = ShieldedWallet(buildShieldedConfig(config)).startWithSecretKeys(shieldedSecretKeys);
    const unshieldedWallet = UnshieldedWallet(buildUnshieldedConfig(config)).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore));
    const dustWallet = DustWallet(buildDustConfig(config)).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust);
    const wallet = new WalletFacade(shieldedWallet, unshieldedWallet, dustWallet);
    await wallet.start(shieldedSecretKeys, dustSecretKey);
    return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
  });
  console.log(`\n  Address: ${unshieldedKeystore.getBech32Address()}\n`);
  await withStatus("Syncing", () => waitForSync(wallet));
  const syncedState = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  const balance = syncedState.unshielded.balances[unshieldedToken().raw] ?? 0n;
  if (balance === 0n) await withStatus("Waiting for tokens", () => waitForFunds(wallet));
  await registerForDustGeneration(wallet, unshieldedKeystore);
  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
};

export const buildFreshWallet = async (config: Config): Promise<WalletContext> =>
  buildWalletAndWaitForFunds(config, toHex(Buffer.from(generateRandomSeed())));

export const configureProviders = async (ctx: WalletContext, config: Config): Promise<TokenProviders> => {
  const walletAndMidnightProvider = await createWalletAndMidnightProvider(ctx);
  const zkConfigProvider = new NodeZkConfigProvider<TokenCircuits>(contractConfig.zkConfigPath);
  return {
    privateStateProvider: levelPrivateStateProvider<typeof import("./common-types.js").TokenPrivateStateId>({
      privateStateStoreName: contractConfig.privateStateStoreName, walletProvider: walletAndMidnightProvider,
    }),
    publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(config.proofServer, zkConfigProvider),
    walletProvider: walletAndMidnightProvider,
    midnightProvider: walletAndMidnightProvider,
  };
};

export const getDustBalance = async (wallet: WalletFacade): Promise<bigint> => {
  const state = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  return state.dust.walletBalance(new Date());
};
