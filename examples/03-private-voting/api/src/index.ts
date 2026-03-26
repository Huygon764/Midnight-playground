import { PrivateVoting } from "../../contract/src/index.js";
import { CompiledVotingContract } from "../../contract/src/index.js";
import { type ContractAddress } from "@midnight-ntwrk/compact-runtime";
import { type Logger } from "pino";
import {
  type VotingDerivedState,
  type VotingProviders,
  type DeployedVotingContract,
  votingPrivateStateKey,
} from "./common-types.js";
import * as utils from "./utils.js";
import { deployContract, findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { map, type Observable } from "rxjs";
import { type VotingPrivateState, createVotingPrivateState } from "../../contract/src/index.js";

export interface DeployedVotingAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<VotingDerivedState>;

  registerSelf: () => Promise<void>;
  registerVoter: (commitment: Uint8Array) => Promise<void>;
  castVote: (vote: boolean) => Promise<void>;
  closeVoting: () => Promise<void>;
}

export class VotingAPI implements DeployedVotingAPI {
  private readonly providers: VotingProviders;

  private constructor(
    public readonly deployedContract: DeployedVotingContract,
    providers: VotingProviders,
    private readonly logger?: Logger,
  ) {
    this.providers = providers;
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    this.state$ = providers.publicDataProvider
      .contractStateObservable(this.deployedContractAddress, { type: "latest" })
      .pipe(
        map((contractState) => {
          const ledgerState = PrivateVoting.ledger(contractState.data);
          return {
            yesVotes: ledgerState.yesVotes,
            noVotes: ledgerState.noVotes,
            votingOpen: ledgerState.votingOpen,
          };
        }),
      );
  }

  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<VotingDerivedState>;

  async registerSelf(): Promise<void> {
    this.logger?.info("registerSelf");
    const privateState = await VotingAPI.getPrivateState(this.providers);
    const commitment = PrivateVoting.pureCircuits.voterCommitment(privateState.secretKey);
    try {
      await this.deployedContract.callTx.registerVoter(commitment);
    } catch (e: unknown) {
      // Extract full error chain for debugging
      let current: unknown = e;
      while (current instanceof Error) {
        console.error(`[registerSelf] ${current.constructor.name}: ${current.message}`);
        if (current.stack) console.error(current.stack);
        current = (current as any).cause;
      }
      throw e;
    }
  }

  async registerVoter(commitment: Uint8Array): Promise<void> {
    this.logger?.info("registerVoter");
    await this.deployedContract.callTx.registerVoter(commitment);
  }

  async castVote(vote: boolean): Promise<void> {
    this.logger?.info(`castVote: ${vote ? "YES" : "NO"}`);
    await this.deployedContract.callTx.castVote(vote);
  }

  async closeVoting(): Promise<void> {
    this.logger?.info("closeVoting");
    await this.deployedContract.callTx.closeVoting();
  }

  static async deploy(providers: VotingProviders, logger?: Logger): Promise<VotingAPI> {
    logger?.info("deployContract");
    const deployedContract = await deployContract(providers, {
      compiledContract: CompiledVotingContract,
      privateStateId: votingPrivateStateKey,
      initialPrivateState: await VotingAPI.getPrivateState(providers),
    });
    logger?.info({ address: deployedContract.deployTxData.public.contractAddress }, "contractDeployed");
    return new VotingAPI(deployedContract, providers, logger);
  }

  static async join(
    providers: VotingProviders,
    contractAddress: ContractAddress,
    logger?: Logger,
  ): Promise<VotingAPI> {
    logger?.info({ contractAddress }, "joinContract");
    const deployedContract = await findDeployedContract(providers, {
      contractAddress,
      compiledContract: CompiledVotingContract,
      privateStateId: votingPrivateStateKey,
      initialPrivateState: await VotingAPI.getPrivateState(providers),
    });
    logger?.info({ contractAddress }, "contractJoined");
    return new VotingAPI(deployedContract, providers, logger);
  }

  private static async getPrivateState(providers: VotingProviders): Promise<VotingPrivateState> {
    const existing = await providers.privateStateProvider.get(votingPrivateStateKey);
    return existing ?? createVotingPrivateState(utils.randomBytes(32));
  }
}

export * from "./common-types.js";
export { utils };
