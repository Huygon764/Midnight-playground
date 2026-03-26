import { useState, useEffect, useCallback } from "react";
import { type VotingDerivedState, VotingAPI, type DeployedVotingAPI } from "../../api/src/index.js";
import { getProviders } from "./providers.js";

type AppStatus = "disconnected" | "connecting" | "connected" | "deploying" | "ready" | "error";

function formatError(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const cause = (e as any).cause;
  if (cause instanceof Error) return `${e.message}: ${cause.message}`;
  return e.message;
}

function Spinner({ message }: { message: string }) {
  return (
    <div className="card">
      <div className="spinner-row">
        <div className="spinner" />
        <span>{message}</span>
      </div>
    </div>
  );
}

export default function App() {
  const [status, setStatus] = useState<AppStatus>("disconnected");
  const [error, setError] = useState<string>("");
  const [api, setApi] = useState<DeployedVotingAPI | null>(null);
  const [votingState, setVotingState] = useState<VotingDerivedState | null>(null);
  const [contractAddress, setContractAddress] = useState("");
  const [joinAddress, setJoinAddress] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [workingMessage, setWorkingMessage] = useState("");
  const [txStatus, setTxStatus] = useState("");

  useEffect(() => {
    if (!api) return;
    const sub = api.state$.subscribe({
      next: (state) => setVotingState(state),
      error: (err) => setError(err.message),
    });
    return () => sub.unsubscribe();
  }, [api]);

  const connectAndDeploy = useCallback(async () => {
    try {
      setStatus("connecting");
      setError("");
      const providers = await getProviders();
      setStatus("deploying");
      const votingApi = await VotingAPI.deploy(providers);
      setApi(votingApi);
      setContractAddress(votingApi.deployedContractAddress);
      setStatus("ready");
    } catch (e) {
      console.error("Deploy failed:", e);
      setError(formatError(e));
      setStatus("error");
    }
  }, []);

  const connectAndJoin = useCallback(async () => {
    if (!joinAddress.trim()) return;
    try {
      setStatus("connecting");
      setError("");
      const providers = await getProviders();
      setStatus("deploying");
      const votingApi = await VotingAPI.join(providers, joinAddress.trim());
      setApi(votingApi);
      setContractAddress(votingApi.deployedContractAddress);
      setStatus("ready");
    } catch (e) {
      console.error("Join failed:", e);
      setError(formatError(e));
      setStatus("error");
    }
  }, [joinAddress]);

  const registerSelf = useCallback(async () => {
    if (!api) return;
    setIsWorking(true);
    setWorkingMessage("Registering voter (generating proof + submitting tx)...");
    setTxStatus("");
    try {
      await api.registerSelf();
      setTxStatus("Registered as voter successfully");
    } catch (e) {
      console.error("Register failed:", e);
      setTxStatus(`Failed: ${formatError(e)}`);
    } finally {
      setIsWorking(false);
      setWorkingMessage("");
    }
  }, [api]);

  const castVote = useCallback(async (vote: boolean) => {
    if (!api) return;
    setIsWorking(true);
    setWorkingMessage(`Casting vote ${vote ? "YES" : "NO"} (generating ZK proof + submitting tx)...`);
    setTxStatus("");
    try {
      await api.castVote(vote);
      setTxStatus(`Vote cast: ${vote ? "YES" : "NO"}`);
    } catch (e) {
      console.error("Vote failed:", e);
      setTxStatus(`Failed: ${formatError(e)}`);
    } finally {
      setIsWorking(false);
      setWorkingMessage("");
    }
  }, [api]);

  const closeVoting = useCallback(async () => {
    if (!api) return;
    setIsWorking(true);
    setWorkingMessage("Closing voting...");
    setTxStatus("");
    try {
      await api.closeVoting();
      setTxStatus("Voting closed");
    } catch (e) {
      console.error("Close failed:", e);
      setTxStatus(`Failed: ${formatError(e)}`);
    } finally {
      setIsWorking(false);
      setWorkingMessage("");
    }
  }, [api]);

  if (status === "disconnected" || status === "error") {
    return <LandingPage
      status={status}
      error={error}
      joinAddress={joinAddress}
      onJoinAddressChange={setJoinAddress}
      onDeploy={connectAndDeploy}
      onJoin={connectAndJoin}
    />;
  }

  if (status === "connecting" || status === "deploying") {
    return (
      <div>
        <h1>Private Voting</h1>
        <Spinner message={status === "connecting" ? "Connecting to Lace wallet..." : "Deploying contract (this may take a minute)..."} />
      </div>
    );
  }

  return (
    <div>
      <h1>Private Voting</h1>
      <div className="status connected">Contract: {contractAddress}</div>

      {votingState && <Results state={votingState} />}

      {isWorking && <Spinner message={workingMessage} />}

      {votingState?.votingOpen && !isWorking && (
        <>
          <div className="card">
            <h2>Register as Voter</h2>
            <p>Uses your auto-generated secret key to create a commitment on-chain.</p>
            <button onClick={registerSelf} disabled={isWorking}>Register</button>
          </div>
          <CastVoteCard onVote={castVote} disabled={isWorking} />
          <div className="card">
            <h2>Admin</h2>
            <button onClick={closeVoting} disabled={isWorking}>Close Voting</button>
          </div>
        </>
      )}

      {txStatus && (
        <div className="card">
          <div className={`status ${txStatus.startsWith("Failed") ? "error" : "connected"}`}>
            {txStatus}
          </div>
        </div>
      )}
    </div>
  );
}

function LandingPage({
  status, error, joinAddress, onJoinAddressChange, onDeploy, onJoin,
}: {
  status: AppStatus;
  error: string;
  joinAddress: string;
  onJoinAddressChange: (v: string) => void;
  onDeploy: () => void;
  onJoin: () => void;
}) {
  return (
    <div>
      <h1>Private Voting</h1>
      <p>A privacy-preserving voting system on Midnight using commitment/nullifier pattern.</p>

      <div className="card">
        <h2>Deploy New Contract</h2>
        <button onClick={onDeploy}>Connect Wallet & Deploy</button>
      </div>

      <div className="card">
        <h2>Join Existing Contract</h2>
        <input
          placeholder="Contract address (hex)"
          value={joinAddress}
          onChange={(e) => onJoinAddressChange(e.target.value)}
        />
        <button onClick={onJoin} disabled={!joinAddress.trim()}>Connect Wallet & Join</button>
      </div>

      {error && <div className="card"><div className="status error">{error}</div></div>}
    </div>
  );
}

function CastVoteCard({ onVote, disabled }: { onVote: (vote: boolean) => void; disabled: boolean }) {
  return (
    <div className="card">
      <h2>Cast Vote</h2>
      <button onClick={() => onVote(true)} disabled={disabled}>Vote YES</button>
      <button onClick={() => onVote(false)} disabled={disabled}>Vote NO</button>
    </div>
  );
}

function Results({ state }: { state: VotingDerivedState }) {
  const total = Number(state.yesVotes + state.noVotes);
  const yes = Number(state.yesVotes);
  const no = Number(state.noVotes);

  return (
    <div className="card">
      <h2>Results</h2>
      <div className="status connected">Status: {state.votingOpen ? "OPEN" : "CLOSED"}</div>
      <div className="results">
        <div className="result-box yes">
          <div className="count">{yes}</div>
          <div>YES</div>
          {total > 0 && <div>{((yes / total) * 100).toFixed(1)}%</div>}
        </div>
        <div className="result-box no">
          <div className="count">{no}</div>
          <div>NO</div>
          {total > 0 && <div>{((no / total) * 100).toFixed(1)}%</div>}
        </div>
      </div>
      <div>Total votes: {total}</div>
    </div>
  );
}
