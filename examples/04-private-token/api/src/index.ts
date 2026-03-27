import { PrivateToken } from "../../contract/src/index.js";
import { CompiledTokenContract } from "../../contract/src/index.js";
import { type ContractAddress } from "@midnight-ntwrk/compact-runtime";
import { type Logger } from "pino";
import {
  type TokenDerivedState,
  type TokenProviders,
  type DeployedTokenContract,
  tokenPrivateStateKey,
} from "./common-types.js";
import * as utils from "./utils.js";
import { deployContract, findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { map, type Observable } from "rxjs";
import { type TokenPrivateState, createTokenPrivateState } from "../../contract/src/index.js";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";

export interface DeployedTokenAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<TokenDerivedState>;
  mint: (to: Uint8Array, amount: bigint) => Promise<void>;
  transfer: (to: Uint8Array, amount: bigint) => Promise<void>;
  deriveAddress: () => Promise<Uint8Array>;
}

export class TokenAPI implements DeployedTokenAPI {
  private readonly providers: TokenProviders;

  private constructor(
    public readonly deployedContract: DeployedTokenContract,
    providers: TokenProviders,
    private readonly logger?: Logger,
  ) {
    this.providers = providers;
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    this.state$ = providers.publicDataProvider
      .contractStateObservable(this.deployedContractAddress, { type: "latest" })
      .pipe(
        map((contractState) => {
          const ledgerState = PrivateToken.ledger(contractState.data);
          return {
            totalSupply: ledgerState.totalSupply,
            owner: ledgerState.owner,
            tokenName: ledgerState.tokenName,
          };
        }),
      );
  }

  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<TokenDerivedState>;

  async mint(to: Uint8Array, amount: bigint): Promise<void> {
    this.logger?.info(`mint: ${amount} to ${toHex(to)}`);
    await this.deployedContract.callTx.mint(to, amount);
  }

  async transfer(to: Uint8Array, amount: bigint): Promise<void> {
    this.logger?.info(`transfer: ${amount} to ${toHex(to)}`);
    await this.deployedContract.callTx.transfer(to, amount);
  }

  async deriveAddress(): Promise<Uint8Array> {
    const ps = await TokenAPI.getPrivateState(this.providers);
    return PrivateToken.pureCircuits.deriveAddress(ps.secretKey);
  }

  static async deploy(providers: TokenProviders, tokenName: string, logger?: Logger): Promise<TokenAPI> {
    logger?.info("deployContract");
    const deployedContract = await deployContract(providers, {
      compiledContract: CompiledTokenContract,
      privateStateId: tokenPrivateStateKey,
      initialPrivateState: await TokenAPI.getPrivateState(providers),
      args: [tokenName],
    });
    logger?.info({ address: deployedContract.deployTxData.public.contractAddress }, "contractDeployed");
    return new TokenAPI(deployedContract, providers, logger);
  }

  static async join(
    providers: TokenProviders,
    contractAddress: ContractAddress,
    logger?: Logger,
  ): Promise<TokenAPI> {
    logger?.info({ contractAddress }, "joinContract");
    const deployedContract = await findDeployedContract(providers, {
      contractAddress,
      compiledContract: CompiledTokenContract,
      privateStateId: tokenPrivateStateKey,
      initialPrivateState: await TokenAPI.getPrivateState(providers),
    });
    logger?.info({ contractAddress }, "contractJoined");
    return new TokenAPI(deployedContract, providers, logger);
  }

  private static async getPrivateState(providers: TokenProviders): Promise<TokenPrivateState> {
    const existing = await providers.privateStateProvider.get(tokenPrivateStateKey);
    return existing ?? createTokenPrivateState(utils.randomBytes(32));
  }
}

export * from "./common-types.js";
export { utils };
