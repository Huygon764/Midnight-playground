import { Token } from "../../contract/src/index.js";
import { CompiledTokenContract } from "../../contract/src/index.js";
import { type ContractAddress } from "@midnight-ntwrk/compact-runtime";
import { type TokenPrivateState, createTokenPrivateState } from "../../contract/src/index.js";
import { type TokenProviders, type DeployedTokenContract, tokenPrivateStateKey } from "./common-types.js";
import * as utils from "./utils.js";
import { deployContract, findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { map, type Observable } from "rxjs";

export interface DeployedTokenAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly tokenColor$: Observable<Uint8Array>;
  mint: (amount: bigint, to: Uint8Array) => Promise<void>;
  getTokenColor: () => Promise<Uint8Array>;
  getTotalMinted: () => Promise<bigint>;
  getTokenInfo: () => Promise<{ name: string; symbol: string; totalMinted: bigint; color: Uint8Array }>;
}

export class TokenAPI implements DeployedTokenAPI {
  private readonly providers: TokenProviders;

  private constructor(
    public readonly deployedContract: DeployedTokenContract,
    providers: TokenProviders,
  ) {
    this.providers = providers;
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    this.tokenColor$ = providers.publicDataProvider
      .contractStateObservable(this.deployedContractAddress, { type: "latest" })
      .pipe(map((cs) => Token.ledger(cs.data).tokenColor));
  }

  readonly deployedContractAddress: ContractAddress;
  readonly tokenColor$: Observable<Uint8Array>;

  async mint(amount: bigint, to: Uint8Array): Promise<void> {
    await this.deployedContract.callTx.mint(amount, { bytes: to });
  }

  async getTokenColor(): Promise<Uint8Array> {
    const contractState = await this.providers.publicDataProvider.queryContractState(
      this.deployedContractAddress,
    );
    if (!contractState) throw new Error("Contract state not found");
    return Token.ledger(contractState.data).tokenColor;
  }

  async getTotalMinted(): Promise<bigint> {
    const contractState = await this.providers.publicDataProvider.queryContractState(
      this.deployedContractAddress,
    );
    if (!contractState) return 0n;
    return Token.ledger(contractState.data).totalMinted;
  }

  async getTokenInfo(): Promise<{ name: string; symbol: string; totalMinted: bigint; color: Uint8Array }> {
    const contractState = await this.providers.publicDataProvider.queryContractState(
      this.deployedContractAddress,
    );
    if (!contractState) throw new Error("Contract state not found");
    const l = Token.ledger(contractState.data);
    return { name: l.tokenName, symbol: l.tokenSymbol, totalMinted: l.totalMinted, color: l.tokenColor };
  }

  static async deploy(providers: TokenProviders, name: string, symbol: string): Promise<TokenAPI> {
    const deployedContract = await deployContract(providers, {
      compiledContract: CompiledTokenContract,
      privateStateId: tokenPrivateStateKey,
      initialPrivateState: await TokenAPI.getPrivateState(providers),
      args: [name, symbol],
    });
    return new TokenAPI(deployedContract as any, providers);
  }

  static async join(
    providers: TokenProviders,
    contractAddress: ContractAddress,
  ): Promise<TokenAPI> {
    const deployedContract = await findDeployedContract(providers, {
      contractAddress,
      compiledContract: CompiledTokenContract,
      privateStateId: tokenPrivateStateKey,
      initialPrivateState: await TokenAPI.getPrivateState(providers),
    });
    return new TokenAPI(deployedContract as any, providers);
  }

  private static async getPrivateState(
    providers: TokenProviders,
  ): Promise<TokenPrivateState> {
    const existing = await providers.privateStateProvider.get(tokenPrivateStateKey);
    return existing ?? createTokenPrivateState(utils.randomBytes(32));
  }
}
