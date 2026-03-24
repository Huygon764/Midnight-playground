"use client";

import { useState } from "react";

type WalletState = {
  connected: boolean;
  address?: string;
};

type VotingState = {
  yesVotes: number;
  noVotes: number;
  votingOpen: boolean;
};

function ConnectWallet({
  onConnect,
}: {
  onConnect: (address: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    try {
      setError(null);
      const midnight = (window as any).midnight;
      if (!midnight?.mnLace) {
        setError("Lace wallet extension not found. Please install it.");
        return;
      }
      const api = await midnight.mnLace.connect("preprod");
      const addresses = await api.getShieldedAddresses();
      if (addresses.length > 0) {
        onConnect(addresses[0]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    }
  };

  return (
    <div className="card">
      <h2>Connect Wallet</h2>
      <button onClick={connect}>Connect Lace Wallet</button>
      {error && <div className="status error">{error}</div>}
    </div>
  );
}

function RegisterVoter() {
  const [secretKey, setSecretKey] = useState("");
  const [status, setStatus] = useState("");

  const register = () => {
    setStatus(
      `Registration submitted for key: ${secretKey.substring(0, 16)}...`,
    );
    // In production, this would call the contract via DApp connector
  };

  return (
    <div className="card">
      <h2>Register Voter</h2>
      <input
        placeholder="Voter secret key (hex)"
        value={secretKey}
        onChange={(e) => setSecretKey(e.target.value)}
      />
      <button onClick={register} disabled={!secretKey}>
        Register
      </button>
      {status && <div className="status connected">{status}</div>}
    </div>
  );
}

function CastVote() {
  const [status, setStatus] = useState("");

  const vote = (choice: boolean) => {
    setStatus(`Vote submitted: ${choice ? "YES" : "NO"}`);
    // In production, this would call contract.callTx.castVote(choice)
  };

  return (
    <div className="card">
      <h2>Cast Vote</h2>
      <button onClick={() => vote(true)}>Vote YES</button>
      <button onClick={() => vote(false)}>Vote NO</button>
      {status && <div className="status connected">{status}</div>}
    </div>
  );
}

function Results({ state }: { state: VotingState }) {
  const total = state.yesVotes + state.noVotes;
  return (
    <div className="card">
      <h2>Results</h2>
      <div className="status connected">
        Status: {state.votingOpen ? "OPEN" : "CLOSED"}
      </div>
      <div className="results">
        <div className="result-box yes">
          <div className="count">{state.yesVotes}</div>
          <div>YES</div>
          {total > 0 && (
            <div>{((state.yesVotes / total) * 100).toFixed(1)}%</div>
          )}
        </div>
        <div className="result-box no">
          <div className="count">{state.noVotes}</div>
          <div>NO</div>
          {total > 0 && (
            <div>{((state.noVotes / total) * 100).toFixed(1)}%</div>
          )}
        </div>
      </div>
      <div>Total votes: {total}</div>
    </div>
  );
}

export default function App() {
  const [wallet, setWallet] = useState<WalletState>({ connected: false });
  const [votingState] = useState<VotingState>({
    yesVotes: 0,
    noVotes: 0,
    votingOpen: true,
  });

  return (
    <div>
      <h1>Private Voting</h1>
      <p>
        A privacy-preserving voting system on Midnight using commitment/nullifier
        pattern.
      </p>

      {!wallet.connected ? (
        <ConnectWallet
          onConnect={(addr) => setWallet({ connected: true, address: addr })}
        />
      ) : (
        <>
          <div className="status connected">
            Connected: {wallet.address?.substring(0, 20)}...
          </div>
          <RegisterVoter />
          {votingState.votingOpen && <CastVote />}
          <Results state={votingState} />
        </>
      )}
    </div>
  );
}
