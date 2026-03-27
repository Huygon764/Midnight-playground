import { type ContractAddress } from "@midnight-ntwrk/compact-runtime";
import { PayrollLite, type PayrollPrivateState, witnesses, createPayrollPrivateState } from "@example/payroll-lite-contract";
import { convertFieldToBytes } from "@midnight-ntwrk/compact-runtime";
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
import { type PayrollCircuits, type PayrollProviders, type DeployedPayrollContract } from "./common-types.js";
import { type Config, contractConfig } from "./config.js";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { assertIsContractAddress, toHex } from "@midnight-ntwrk/midnight-js-utils";
import { getNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { CompiledContract } from "@midnight-ntwrk/compact-js";
import { Buffer } from "buffer";
import { randomBytes } from "crypto";

// @ts-expect-error: Required for GraphQL subscriptions in Node.js
globalThis.WebSocket = WebSocket;

const compiledContract = CompiledContract.make("payroll-lite", PayrollLite.Contract).pipe(
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

export const getPayrollState = async (
  providers: PayrollProviders,
  contractAddress: ContractAddress,
) => {
  assertIsContractAddress(contractAddress);
  const state = await providers.publicDataProvider.queryContractState(contractAddress);
  if (state == null) return null;
  const l = PayrollLite.ledger(state.data);
  return {
    period: l.period,
    employer: l.employer,
    claimedAmount: l.claimedAmount,
  };
};

export const generateSecretKey = (): Uint8Array => randomBytes(32);

export const derivePublicKey = (secretKey: Uint8Array): Uint8Array =>
  PayrollLite.pureCircuits.derivePublicKey(secretKey);

export const computeCommitment = (pubKey: Uint8Array, salary: bigint, period: bigint): Uint8Array => {
  const salaryBytes = convertFieldToBytes(32, salary, "payroll-cli");
  const periodBytes = convertFieldToBytes(32, period, "payroll-cli");
  return PayrollLite.pureCircuits.computeCommitment(pubKey, salaryBytes, periodBytes);
};

export const deploy = async (
  providers: PayrollProviders,
  secretKey: Uint8Array,
): Promise<DeployedPayrollContract> => {
  return await deployContract(providers, {
    compiledContract,
    privateStateId: "payrollPrivateState",
    initialPrivateState: createPayrollPrivateState(secretKey, 0n),
  });
};

export const joinContract = async (
  providers: PayrollProviders,
  contractAddress: string,
  secretKey: Uint8Array,
  salary: bigint,
  timeoutMs = 120_000,
): Promise<DeployedPayrollContract> => {
  const result = await Promise.race([
    findDeployedContract(providers, {
      contractAddress,
      compiledContract,
      privateStateId: "payrollPrivateState",
      initialPrivateState: createPayrollPrivateState(secretKey, salary),
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Join timed out after ${timeoutMs / 1000}s — check that the contract address is correct`)), timeoutMs),
    ),
  ]);
  return result;
};

export const commitSalary = async (
  contract: DeployedPayrollContract,
  commitment: Uint8Array,
): Promise<FinalizedTxData> => {
  const result = await contract.callTx.commitSalary(commitment);
  return result.public;
};

export const claimSalary = async (
  contract: DeployedPayrollContract,
): Promise<void> => {
  await contract.callTx.claimSalary();
};

export const newPeriod = async (contract: DeployedPayrollContract): Promise<FinalizedTxData> => {
  const result = await contract.callTx.newPeriod();
  return result.public;
};

export const getPeriod = async (
  providers: PayrollProviders,
  contractAddress: ContractAddress,
): Promise<bigint> => {
  const state = await getPayrollState(providers, contractAddress);
  return state?.period ?? 0n;
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

export const configureProviders = async (ctx: WalletContext, config: Config): Promise<PayrollProviders> => {
  const walletAndMidnightProvider = await createWalletAndMidnightProvider(ctx);
  const zkConfigProvider = new NodeZkConfigProvider<PayrollCircuits>(contractConfig.zkConfigPath);
  return {
    privateStateProvider: levelPrivateStateProvider<typeof import("./common-types.js").PayrollPrivateStateId>({
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
