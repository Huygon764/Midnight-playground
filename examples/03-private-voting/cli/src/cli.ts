import { type WalletContext } from "./api.js";
import { stdin as input, stdout as output } from "node:process";
import { createInterface, type Interface } from "node:readline/promises";
import { type VotingProviders, type DeployedVotingContract } from "./common-types.js";
import { type Config } from "./config.js";
import { PrivateVoting } from "@example/private-voting-contract";
import * as api from "./api.js";

const BANNER = `
================================================================
       Private Voting - Midnight Blockchain Example
       Commitment/Nullifier pattern + MerkleTree
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
  [1] Deploy a new voting contract
  [2] Join an existing voting contract
  [3] Exit
${DIV}
> `;

const votingMenu = (dustLabel: string) => `
${DIV}
  Voting Actions${dustLabel ? `                      DUST: ${dustLabel}` : ""}
${DIV}
  [1] Register voter
  [2] Cast vote (yes/no)
  [3] View results
  [4] Close voting
  [5] Exit
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
  providers: VotingProviders, walletCtx: WalletContext, rli: Interface,
): Promise<{ contract: DeployedVotingContract; secretKey: Uint8Array } | null> => {
  while (true) {
    const dustLabel = await getDustLabel(walletCtx.wallet);
    const choice = await rli.question(contractMenu(dustLabel));
    switch (choice.trim()) {
      case "1": {
        const secretKey = api.generateSecretKey();
        console.log(`  Your secret key: ${Buffer.from(secretKey).toString("hex")}\n`);
        try {
          const contract = await api.withStatus("Deploying voting contract", () => api.deploy(providers, secretKey));
          console.log(`  Contract: ${contract.deployTxData.public.contractAddress}\n`);
          return { contract, secretKey };
        } catch (e) { console.log(`  x Deploy failed: ${e instanceof Error ? e.message : e}\n`); }
        break;
      }
      case "2": {
        const addr = await rli.question("Contract address (hex): ");
        const skHex = await rli.question("Your secret key (hex): ");
        try {
          const secretKey = Buffer.from(skHex.trim(), "hex");
          const contract = await api.joinContract(providers, addr.trim(), secretKey);
          return { contract, secretKey };
        } catch (e) { console.log(`  x Failed: ${e instanceof Error ? e.message : e}\n`); }
        break;
      }
      case "3": return null;
      default: console.log(`  Invalid choice: ${choice}`);
    }
  }
};

const mainLoop = async (providers: VotingProviders, walletCtx: WalletContext, rli: Interface): Promise<void> => {
  const result = await deployOrJoin(providers, walletCtx, rli);
  if (!result) return;
  const { contract, secretKey } = result;
  const contractAddress = contract.deployTxData.public.contractAddress;

  while (true) {
    const dustLabel = await getDustLabel(walletCtx.wallet);
    const choice = await rli.question(votingMenu(dustLabel));
    switch (choice.trim()) {
      case "1": {
        const skHex = await rli.question("Voter secret key (hex, or 'new' to generate): ");
        let voterSk: Uint8Array;
        if (skHex.trim() === "new") {
          voterSk = api.generateSecretKey();
          console.log(`  Generated: ${Buffer.from(voterSk).toString("hex")}`);
        } else {
          voterSk = Buffer.from(skHex.trim(), "hex");
        }
        const commitment = PrivateVoting.pureCircuits.voterCommitment(voterSk);
        try {
          await api.withStatus("Registering voter", () => api.registerVoter(contract, commitment));
          console.log("  Voter registered.\n");
        } catch (e) { console.log(`  x Failed: ${e instanceof Error ? e.message : e}\n`); }
        break;
      }
      case "2": {
        const voteStr = await rli.question("Vote (yes/no): ");
        const vote = voteStr.trim().toLowerCase() === "yes";
        try {
          await api.withStatus(`Casting vote: ${vote ? "YES" : "NO"}`, () => api.castVote(contract, vote));
          console.log("  Vote cast.\n");
        } catch (e) { console.log(`  x Failed: ${e instanceof Error ? e.message : e}\n`); }
        break;
      }
      case "3": {
        const state = await api.getVotingState(providers, contractAddress);
        if (state) {
          console.log(`\n  Results: YES=${state.yesVotes} / NO=${state.noVotes}`);
          console.log(`  Status: ${state.votingOpen ? "OPEN" : "CLOSED"}\n`);
        }
        break;
      }
      case "4":
        try {
          await api.withStatus("Closing voting", () => api.closeVoting(contract));
          console.log("  Voting closed.\n");
        } catch (e) { console.log(`  x Failed: ${e instanceof Error ? e.message : e}\n`); }
        break;
      case "5": return;
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
