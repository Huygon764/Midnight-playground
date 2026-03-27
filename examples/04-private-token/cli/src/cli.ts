import { type WalletContext } from "./api.js";
import { stdin as input, stdout as output } from "node:process";
import { createInterface, type Interface } from "node:readline/promises";
import { type TokenProviders, type DeployedTokenContract } from "./common-types.js";
import { type Config } from "./config.js";
import { PrivateToken } from "@example/private-token-contract";
import * as api from "./api.js";

const BANNER = `
================================================================
       Private Token - Midnight Blockchain Example
       Map ADT + Identity-based transfers
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
  [1] Deploy a new token contract
  [2] Join an existing token contract
  [3] Exit
${DIV}
> `;

const tokenMenu = (dustLabel: string) => `
${DIV}
  Token Actions${dustLabel ? `                       DUST: ${dustLabel}` : ""}
${DIV}
  [1] Mint tokens (owner only)
  [2] Transfer tokens
  [3] Check balance
  [4] Total supply
  [5] Derive address from secret key
  [6] Exit
${DIV}
> `;

const getDustLabel = async (wallet: api.WalletContext["wallet"]): Promise<string> => {
  try { return (await api.getDustBalance(wallet)).toLocaleString(); } catch { return ""; }
};

const buildWallet = async (config: Config, rli: Interface): Promise<WalletContext | null> => {
  while (true) {
    const choice = await rli.question(WALLET_MENU);
    switch (choice.trim()) {
      case "1": return await api.buildFreshWallet(config);
      case "2": {
        const seed = await rli.question("Enter your wallet seed: ");
        return await api.buildWalletAndWaitForFunds(config, seed);
      }
      case "3": return null;
      default: console.log(`  Invalid choice: ${choice}`);
    }
  }
};

const deployOrJoin = async (
  providers: TokenProviders, walletCtx: WalletContext, rli: Interface,
): Promise<{ contract: DeployedTokenContract; secretKey: Uint8Array } | null> => {
  while (true) {
    const dustLabel = await getDustLabel(walletCtx.wallet);
    const choice = await rli.question(contractMenu(dustLabel));
    switch (choice.trim()) {
      case "1": {
        const secretKey = api.generateSecretKey();
        console.log(`  Your secret key: ${Buffer.from(secretKey).toString("hex")}\n`);
        const tokenName = await rli.question("Token name: ");
        try {
          const contract = await api.withStatus("Deploying token contract", () =>
            api.deploy(providers, secretKey, tokenName.trim()));
          console.log(`  Contract: ${contract.deployTxData.public.contractAddress}\n`);
          const addr = api.deriveAddress(secretKey);
          console.log(`  Owner address: ${Buffer.from(addr).toString("hex")}\n`);
          return { contract, secretKey };
        } catch (e) { console.log(`  x Deploy failed: ${e instanceof Error ? e.message : e}\n`); }
        break;
      }
      case "2": {
        const addr = await rli.question("Contract address (hex): ");
        const skHex = await rli.question("Your secret key (hex): ");
        try {
          const secretKey = Buffer.from(skHex.trim(), "hex");
          const contract = await api.withStatus("Joining contract", () =>
            api.joinContract(providers, addr.trim(), secretKey),
          );
          return { contract, secretKey };
        } catch (e) { console.log(`  x Failed: ${e instanceof Error ? e.message : e}\n`); }
        break;
      }
      case "3": return null;
      default: console.log(`  Invalid choice: ${choice}`);
    }
  }
};

const mainLoop = async (providers: TokenProviders, walletCtx: WalletContext, rli: Interface): Promise<void> => {
  const result = await deployOrJoin(providers, walletCtx, rli);
  if (!result) return;
  const { contract, secretKey } = result;
  const contractAddress = contract.deployTxData.public.contractAddress;

  while (true) {
    const dustLabel = await getDustLabel(walletCtx.wallet);
    const choice = await rli.question(tokenMenu(dustLabel));
    switch (choice.trim()) {
      case "1": {
        const toHex = await rli.question("Recipient address (hex): ");
        const amountStr = await rli.question("Amount: ");
        try {
          const to = Buffer.from(toHex.trim(), "hex");
          const amount = BigInt(amountStr.trim());
          await api.withStatus("Minting tokens", () => api.mint(contract, to, amount));
          console.log(`  Minted ${amount} tokens.\n`);
        } catch (e) { console.log(`  x Failed: ${e instanceof Error ? e.message : e}\n`); }
        break;
      }
      case "2": {
        const toHex = await rli.question("Recipient address (hex): ");
        const amountStr = await rli.question("Amount: ");
        try {
          const to = Buffer.from(toHex.trim(), "hex");
          const amount = BigInt(amountStr.trim());
          await api.withStatus("Transferring tokens", () => api.transfer(contract, to, amount));
          console.log(`  Transferred ${amount} tokens.\n`);
        } catch (e) { console.log(`  x Failed: ${e instanceof Error ? e.message : e}\n`); }
        break;
      }
      case "3": {
        const addrHex = await rli.question("Address (hex, or 'me' for your address): ");
        try {
          let addr: Uint8Array;
          if (addrHex.trim().toLowerCase() === "me") {
            addr = api.deriveAddress(secretKey);
            console.log(`  Your address: ${Buffer.from(addr).toString("hex")}`);
          } else {
            addr = Buffer.from(addrHex.trim(), "hex");
          }
          const balance = await api.getOnChainBalance(providers, contractAddress, addr);
          console.log(`  Balance: ${balance.toLocaleString()}\n`);
        } catch (e) { console.log(`  x Failed: ${e instanceof Error ? e.message : e}\n`); }
        break;
      }
      case "4": {
        const state = await api.getTokenState(providers, contractAddress);
        if (state) {
          console.log(`\n  Token: ${state.tokenName}`);
          console.log(`  Total Supply: ${state.totalSupply.toLocaleString()}`);
          console.log(`  Owner: ${Buffer.from(state.owner).toString("hex")}\n`);
        }
        break;
      }
      case "5": {
        const skHex = await rli.question("Secret key (hex): ");
        try {
          const sk = Buffer.from(skHex.trim(), "hex");
          const addr = api.deriveAddress(sk);
          console.log(`  Derived address: ${Buffer.from(addr).toString("hex")}\n`);
        } catch (e) { console.log(`  x Failed: ${e instanceof Error ? e.message : e}\n`); }
        break;
      }
      case "6": return;
      default: console.log(`  Invalid choice: ${choice}`);
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
      const providers = await api.withStatus("Configuring providers", () => api.configureProviders(walletCtx, config));
      await mainLoop(providers, walletCtx, rli);
    } finally { try { await walletCtx.wallet.stop(); } catch {} }
  } finally { rli.close(); rli.removeAllListeners(); console.log("Goodbye."); }
};
