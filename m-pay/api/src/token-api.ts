import { Token } from "../../contract/src/index.js";
import { CompiledTokenContract } from "../../contract/src/index.js";
import { type ContractAddress } from "@midnight-ntwrk/compact-runtime";
import { type TokenPrivateState, createTokenPrivateState } from "../../contract/src/index.js";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import type { DeployedContract, FoundContract } from "@midnight-ntwrk/midnight-js-contracts";
import { type ProvableCircuitId } from "@midnight-ntwrk/compact-js";
import * as utils from "./utils.js";
import { deployContract, findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { map, type Observable } from "rxjs";

export type TokenCircuitKeys = ProvableCircuitId<Token.Contract<TokenPrivateState>>;
export const tokenPrivateStateKey = "tokenPrivateState";
export type TokenProviders = MidnightProviders<TokenCircuitKeys, typeof tokenPrivateStateKey, TokenPrivateState>;

export interface DeployedTokenAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly tokenColor$: Observable<Uint8Array>;
  mint: (amount: bigint, recipientPk: Uint8Array) => Promise<void>;
  getTokenColor: () => Promise<Uint8Array>;
  getTotalMinted: () => Promise<bigint>;
}

export class TokenAPI implements DeployedTokenAPI {
  private readonly providers: TokenProviders;

  private constructor(
    public readonly deployedContract: DeployedContract<Token.Contract<TokenPrivateState>> | FoundContract<Token.Contract<TokenPrivateState>>,
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

  async mint(amount: bigint, recipientPk: Uint8Array): Promise<void> {
    // mint(amount, publicKey: ZswapCoinPublicKey, sendValue)
    // ZswapCoinPublicKey is a struct { bytes: Bytes<32> }
    await this.deployedContract.callTx.mint(amount, { bytes: recipientPk }, BigInt(amount));
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

  static async deploy(providers: TokenProviders): Promise<TokenAPI> {
    const deployedContract = await deployContract(providers, {
      compiledContract: CompiledTokenContract,
      privateStateId: tokenPrivateStateKey,
      initialPrivateState: await TokenAPI.getPrivateState(providers),
    } as any);
    return new TokenAPI(deployedContract as any, providers);
  }

  static async join(providers: TokenProviders, contractAddress: ContractAddress): Promise<TokenAPI> {
    const deployedContract = await findDeployedContract(providers, {
      contractAddress,
      compiledContract: CompiledTokenContract,
      privateStateId: tokenPrivateStateKey,
      initialPrivateState: await TokenAPI.getPrivateState(providers),
    });
    return new TokenAPI(deployedContract as any, providers);
  }

  private static async getPrivateState(providers: TokenProviders): Promise<TokenPrivateState> {
    const existing = await providers.privateStateProvider.get(tokenPrivateStateKey);
    return existing ?? createTokenPrivateState(utils.randomBytes(32));
  }
}
