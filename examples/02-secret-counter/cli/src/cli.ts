import { type WalletContext } from "./api.js";
import { stdin as input, stdout as output } from "node:process";
import { createInterface, type Interface } from "node:readline/promises";
import { type SecretCounterProviders, type DeployedSecretCounterContract } from "./common-types.js";
import { type Config } from "./config.js";
import * as api from "./api.js";

const BANNER = `
================================================================
       Secret Counter - Midnight Blockchain Example
       Owner-only access control with witness + persistentHash
================================================================
`;

const DIV = "--------------------------------------------------------------";

const WALLET_MENU = `
${DIV}
  Wallet Setup
${DIV}
  [1] Create a new wallet
  [2] Restore wallet from seed
  [3] Exit
${DIV}
> `;

const contractMenu = (dustLabel: string) => `
${DIV}
  Contract Actions${dustLabel ? `                    DUST: ${dustLabel}` : ""}
${DIV}
  [1] Deploy a new secret counter
  [2] Join an existing contract
  [3] Exit
${DIV}
> `;

const counterMenu = (dustLabel: string) => `
${DIV}
  Counter Actions (owner-only)${dustLabel ? `       DUST: ${dustLabel}` : ""}
${DIV}
  [1] Increment (owner only)
  [2] Decrement (owner only)
  [3] Read counter (anyone)
  [4] Exit
${DIV}
> `;

const getDustLabel = async (wallet: api.WalletContext["wallet"]): Promise<string> => {
  try {
    const dust = await api.getDustBalance(wallet);
    return dust.toLocaleString();
  } catch {
    return "";
  }
};

const buildWallet = async (config: Config, rli: Interface): Promise<WalletContext | null> => {
  while (true) {
    const choice = await rli.question(WALLET_MENU);
    switch (choice.trim()) {
      case "1":
        return await api.buildFreshWallet(config);
      case "2": {
        const seed = await rli.question("Enter your wallet seed: ");
        return await api.buildWalletAndWaitForFunds(config, seed);
      }
      case "3":
        return null;
      default:
        console.log(`  Invalid choice: ${choice}`);
    }
  }
};

const deployOrJoin = async (
  providers: SecretCounterProviders,
  walletCtx: WalletContext,
  rli: Interface,
): Promise<{ contract: DeployedSecretCounterContract; secretKey: Uint8Array } | null> => {
  while (true) {
    const dustLabel = await getDustLabel(walletCtx.wallet);
    const choice = await rli.question(contractMenu(dustLabel));
    switch (choice.trim()) {
      case "1": {
        const secretKey = api.generateSecretKey();
        console.log(`  Generated secret key: ${Buffer.from(secretKey).toString("hex")}`);
        console.log(`  (Save this key to interact with your contract later)\n`);
        try {
          const contract = await api.withStatus("Deploying secret counter", () =>
            api.deploy(providers, secretKey),
          );
          console.log(`  Contract deployed at: ${contract.deployTxData.public.contractAddress}\n`);
          return { contract, secretKey };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`\n  x Deploy failed: ${msg}\n`);
        }
        break;
      }
      case "2": {
        const addr = await rli.question("Enter the contract address (hex): ");
        const skHex = await rli.question("Enter your secret key (hex): ");
        const secretKey = Buffer.from(skHex.trim(), "hex");
        try {
          const contract = await api.joinContract(providers, addr.trim(), secretKey);
          console.log(`  Joined contract at: ${contract.deployTxData.public.contractAddress}\n`);
          return { contract, secretKey };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`  x Failed to join: ${msg}\n`);
        }
        break;
      }
      case "3":
        return null;
      default:
        console.log(`  Invalid choice: ${choice}`);
    }
  }
};

const mainLoop = async (
  providers: SecretCounterProviders,
  walletCtx: WalletContext,
  rli: Interface,
): Promise<void> => {
  const result = await deployOrJoin(providers, walletCtx, rli);
  if (!result) return;

  const { contract } = result;
  const contractAddress = contract.deployTxData.public.contractAddress;

  while (true) {
    const dustLabel = await getDustLabel(walletCtx.wallet);
    const choice = await rli.question(counterMenu(dustLabel));
    switch (choice.trim()) {
      case "1":
        try {
          await api.withStatus("Incrementing counter", () => api.increment(contract));
          const state = await api.getCounterLedgerState(providers, contractAddress);
          console.log(`  Counter value: ${state?.round}\n`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`  x Increment failed: ${msg}\n`);
        }
        break;
      case "2":
        try {
          await api.withStatus("Decrementing counter", () => api.decrement(contract));
          const state = await api.getCounterLedgerState(providers, contractAddress);
          console.log(`  Counter value: ${state?.round}\n`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`  x Decrement failed: ${msg}\n`);
        }
        break;
      case "3": {
        const state = await api.getCounterLedgerState(providers, contractAddress);
        console.log(`  Counter value: ${state?.round}\n`);
        break;
      }
      case "4":
        return;
      default:
        console.log(`  Invalid choice: ${choice}`);
    }
  }
};

export const run = async (config: Config): Promise<void> => {
  console.log(BANNER);
  const rli = createInterface({ input, output, terminal: true });
  try {
    const walletCtx = await buildWallet(config, rli);
    if (!walletCtx) return;
    try {
      const providers = await api.withStatus("Configuring providers", () =>
        api.configureProviders(walletCtx, config),
      );
      console.log("");
      await mainLoop(providers, walletCtx, rli);
    } finally {
      try { await walletCtx.wallet.stop(); } catch {}
    }
  } finally {
    rli.close();
    rli.removeAllListeners();
    console.log("Goodbye.");
  }
};
