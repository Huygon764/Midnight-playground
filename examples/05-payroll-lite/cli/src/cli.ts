import { type WalletContext } from "./api.js";
import { stdin as input, stdout as output } from "node:process";
import { createInterface, type Interface } from "node:readline/promises";
import { type PayrollProviders, type DeployedPayrollContract } from "./common-types.js";
import { type Config } from "./config.js";
import * as api from "./api.js";

const BANNER = `
================================================================
       Payroll Lite - Midnight Blockchain Example
       Commitment/Nullifier pattern + HistoricMerkleTree
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
  Contract Setup${dustLabel ? `                      DUST: ${dustLabel}` : ""}
${DIV}
  [1] Deploy a new payroll contract
  [2] Join an existing payroll contract
  [3] Exit
${DIV}
> `;

const ROLE_MENU = `
${DIV}
  Select Role
${DIV}
  [1] Employer
  [2] Employee
  [3] Exit
${DIV}
> `;

const employerMenu = (dustLabel: string) => `
${DIV}
  Employer Actions${dustLabel ? `                    DUST: ${dustLabel}` : ""}
${DIV}
  [1] Commit salary
  [2] New period
  [3] View status
  [4] Exit
${DIV}
> `;

const employeeMenu = (dustLabel: string) => `
${DIV}
  Employee Actions${dustLabel ? `                    DUST: ${dustLabel}` : ""}
${DIV}
  [1] Generate keypair
  [2] Claim salary
  [3] View status
  [4] Exit
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
  providers: PayrollProviders,
  walletCtx: WalletContext,
  rli: Interface,
): Promise<DeployedPayrollContract | null> => {
  while (true) {
    const dustLabel = await getDustLabel(walletCtx.wallet);
    const choice = await rli.question(contractMenu(dustLabel));
    switch (choice.trim()) {
      case "1": {
        const secretKey = api.generateSecretKey();
        console.log(`  Your secret key: ${Buffer.from(secretKey).toString("hex")}`);
        const pubKey = api.derivePublicKey(secretKey);
        console.log(`  Your public key: ${Buffer.from(pubKey).toString("hex")}\n`);
        try {
          const contract = await api.withStatus("Deploying payroll contract", () =>
            api.deploy(providers, secretKey),
          );
          console.log(`  Contract: ${contract.deployTxData.public.contractAddress}\n`);
          return contract;
        } catch (e) { console.log(`  x Deploy failed: ${e instanceof Error ? e.message : e}\n`); }
        break;
      }
      case "2": {
        const addr = await rli.question("Contract address (hex): ");
        const skHex = await rli.question("Secret key (hex, or press Enter to skip): ");
        try {
          const secretKey = skHex.trim() ? Buffer.from(skHex.trim(), "hex") : api.generateSecretKey();
          const contract = await api.withStatus("Joining contract", () =>
            api.joinContract(providers, addr.trim(), secretKey, 0n),
          );
          if (skHex.trim()) {
            const pubKey = api.derivePublicKey(secretKey);
            console.log(`  Your public key: ${Buffer.from(pubKey).toString("hex")}`);
          }
          console.log(`  Joined contract.\n`);
          return contract;
        } catch (e) { console.log(`  x Failed: ${e instanceof Error ? e.message : e}\n`); }
        break;
      }
      case "3": return null;
      default: console.log(`  Invalid choice: ${choice}`);
    }
  }
};

const selectRole = async (rli: Interface): Promise<"employer" | "employee" | null> => {
  while (true) {
    const choice = await rli.question(ROLE_MENU);
    switch (choice.trim()) {
      case "1": return "employer";
      case "2": return "employee";
      case "3": return null;
      default: console.log(`  Invalid choice: ${choice}`);
    }
  }
};

const employerLoop = async (
  providers: PayrollProviders,
  walletCtx: WalletContext,
  contract: DeployedPayrollContract,
  rli: Interface,
): Promise<void> => {
  const contractAddress = contract.deployTxData.public.contractAddress;

  while (true) {
    const dustLabel = await getDustLabel(walletCtx.wallet);
    const choice = await rli.question(employerMenu(dustLabel));
    switch (choice.trim()) {
      case "1": {
        const empPubKeyHex = await rli.question("Employee public key (hex): ");
        const amountStr = await rli.question("Salary amount: ");
        try {
          const empPubKey = Buffer.from(empPubKeyHex.trim(), "hex");
          const salary = BigInt(amountStr.trim());
          const state = await api.getPayrollState(providers, contractAddress);
          const period = state?.period ?? 1n;
          const commitment = api.computeCommitment(empPubKey, salary, period);
          await api.withStatus("Committing salary", () => api.commitSalary(contract, commitment));
          console.log(`  Salary committed for period ${period}.\n`);
        } catch (e) { console.log(`  x Failed: ${e instanceof Error ? e.message : e}\n`); }
        break;
      }
      case "2": {
        try {
          await api.withStatus("Starting new period", () => api.newPeriod(contract));
          console.log("  New period started.\n");
        } catch (e) { console.log(`  x Failed: ${e instanceof Error ? e.message : e}\n`); }
        break;
      }
      case "3": {
        try {
          const state = await api.getPayrollState(providers, contractAddress);
          if (state) {
            console.log(`\n  Period: ${state.period}`);
            console.log(`  Total claimed: ${state.claimedAmount}\n`);
          }
        } catch (e) { console.log(`  x Failed: ${e instanceof Error ? e.message : e}\n`); }
        break;
      }
      case "4": return;
      default: console.log(`  Invalid choice: ${choice}`);
    }
  }
};

const employeeLoop = async (
  providers: PayrollProviders,
  walletCtx: WalletContext,
  contract: DeployedPayrollContract,
  rli: Interface,
): Promise<void> => {
  const contractAddress = contract.deployTxData.public.contractAddress;

  while (true) {
    const dustLabel = await getDustLabel(walletCtx.wallet);
    const choice = await rli.question(employeeMenu(dustLabel));
    switch (choice.trim()) {
      case "1": {
        const secretKey = api.generateSecretKey();
        const pubKey = api.derivePublicKey(secretKey);
        console.log(`\n  Secret key: ${Buffer.from(secretKey).toString("hex")}`);
        console.log(`  Public key: ${Buffer.from(pubKey).toString("hex")}`);
        console.log(`  (Give your public key to employer, keep secret key safe)\n`);
        break;
      }
      case "2": {
        const skHex = await rli.question("Your secret key (hex): ");
        const salaryStr = await rli.question("Your salary amount: ");
        try {
          const secretKey = Buffer.from(skHex.trim(), "hex");
          const salary = BigInt(salaryStr.trim());
          // Update private state with employee's key and salary
          await providers.privateStateProvider.set("payrollPrivateState" as any, {
            secretKey,
            salary,
          } as any);
          await api.withStatus("Claiming salary", () => api.claimSalary(contract));
          console.log(`  Salary claimed successfully\n`);
        } catch (e) { console.log(`  x Failed: ${e instanceof Error ? e.message : e}\n`); }
        break;
      }
      case "3": {
        try {
          const state = await api.getPayrollState(providers, contractAddress);
          if (state) {
            console.log(`\n  Period: ${state.period}`);
            console.log(`  Total claimed: ${state.claimedAmount}\n`);
          }
        } catch (e) { console.log(`  x Failed: ${e instanceof Error ? e.message : e}\n`); }
        break;
      }
      case "4": return;
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
      const contract = await deployOrJoin(providers, walletCtx, rli);
      if (!contract) return;
      const role = await selectRole(rli);
      if (!role) return;
      if (role === "employer") {
        await employerLoop(providers, walletCtx, contract, rli);
      } else {
        await employeeLoop(providers, walletCtx, contract, rli);
      }
    } finally { try { await walletCtx.wallet.stop(); } catch {} }
  } finally { rli.close(); rli.removeAllListeners(); console.log("Goodbye."); }
};
