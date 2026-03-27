import { useState, useEffect, useCallback } from "react";
import { type TokenDerivedState, TokenAPI, type DeployedTokenAPI } from "../../api/src/index.js";
import { getProviders } from "./providers.js";
import { toHex, fromHex } from "@midnight-ntwrk/midnight-js-utils";

type AppStatus = "disconnected" | "connecting" | "connected" | "deploying" | "ready" | "error";
type Tab = "mint" | "transfer" | "balance";

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
  const [api, setApi] = useState<DeployedTokenAPI | null>(null);
  const [tokenState, setTokenState] = useState<TokenDerivedState | null>(null);
  const [contractAddress, setContractAddress] = useState("");
  const [joinAddress, setJoinAddress] = useState("");
  const [tokenName, setTokenName] = useState("MyToken");
  const [activeTab, setActiveTab] = useState<Tab>("mint");
  const [isWorking, setIsWorking] = useState(false);
  const [workingMessage, setWorkingMessage] = useState("");
  const [txStatus, setTxStatus] = useState("");

  useEffect(() => {
    if (!api) return;
    const sub = api.state$.subscribe({
      next: (state) => setTokenState(state),
      error: (err) => setError(err.message),
    });
    return () => sub.unsubscribe();
  }, [api]);

  const connectAndDeploy = useCallback(async () => {
    if (!tokenName.trim()) return;
    try {
      setStatus("connecting");
      setError("");
      const providers = await getProviders();
      setStatus("deploying");
      const tokenApi = await TokenAPI.deploy(providers, tokenName.trim());
      setApi(tokenApi);
      setContractAddress(tokenApi.deployedContractAddress);
      setStatus("ready");
    } catch (e) {
      console.error("Deploy failed:", e);
      setError(formatError(e));
      setStatus("error");
    }
  }, [tokenName]);

  const connectAndJoin = useCallback(async () => {
    if (!joinAddress.trim()) return;
    try {
      setStatus("connecting");
      setError("");
      const providers = await getProviders();
      setStatus("deploying");
      const tokenApi = await TokenAPI.join(providers, joinAddress.trim());
      setApi(tokenApi);
      setContractAddress(tokenApi.deployedContractAddress);
      setStatus("ready");
    } catch (e) {
      console.error("Join failed:", e);
      setError(formatError(e));
      setStatus("error");
    }
  }, [joinAddress]);

  if (status === "disconnected" || status === "error") {
    return (
      <LandingPage
        status={status}
        error={error}
        tokenName={tokenName}
        joinAddress={joinAddress}
        onTokenNameChange={setTokenName}
        onJoinAddressChange={setJoinAddress}
        onDeploy={connectAndDeploy}
        onJoin={connectAndJoin}
      />
    );
  }

  if (status === "connecting" || status === "deploying") {
    return (
      <div>
        <h1>Private Token</h1>
        <Spinner message={status === "connecting" ? "Connecting to Lace wallet..." : "Deploying contract (this may take a minute)..."} />
      </div>
    );
  }

  return (
    <div>
      <h1>Private Token</h1>
      <div className="status connected">Contract: {contractAddress}</div>

      {tokenState && <TokenPanel state={tokenState} />}

      {isWorking && <Spinner message={workingMessage} />}

      {!isWorking && (
        <>
          <div className="tabs">
            <div className={`tab ${activeTab === "mint" ? "active" : ""}`} onClick={() => setActiveTab("mint")}>
              Mint
            </div>
            <div className={`tab ${activeTab === "transfer" ? "active" : ""}`} onClick={() => setActiveTab("transfer")}>
              Transfer
            </div>
            <div className={`tab ${activeTab === "balance" ? "active" : ""}`} onClick={() => setActiveTab("balance")}>
              Balance
            </div>
          </div>

          {activeTab === "mint" && (
            <MintCard
              api={api!}
              disabled={isWorking}
              onWorking={(msg) => { setIsWorking(true); setWorkingMessage(msg); setTxStatus(""); }}
              onDone={(msg) => { setIsWorking(false); setWorkingMessage(""); setTxStatus(msg); }}
            />
          )}
          {activeTab === "transfer" && (
            <TransferCard
              api={api!}
              disabled={isWorking}
              onWorking={(msg) => { setIsWorking(true); setWorkingMessage(msg); setTxStatus(""); }}
              onDone={(msg) => { setIsWorking(false); setWorkingMessage(""); setTxStatus(msg); }}
            />
          )}
          {activeTab === "balance" && <BalanceCard api={api!} />}
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
  status,
  error,
  tokenName,
  joinAddress,
  onTokenNameChange,
  onJoinAddressChange,
  onDeploy,
  onJoin,
}: {
  status: AppStatus;
  error: string;
  tokenName: string;
  joinAddress: string;
  onTokenNameChange: (v: string) => void;
  onJoinAddressChange: (v: string) => void;
  onDeploy: () => void;
  onJoin: () => void;
}) {
  return (
    <div>
      <h1>Private Token</h1>
      <p>A token contract on Midnight using Map ADT for balances and identity-based transfers via secret key witnesses.</p>

      <div className="card">
        <h2>Deploy New Token</h2>
        <label>Token name</label>
        <input
          placeholder="MyToken"
          value={tokenName}
          onChange={(e) => onTokenNameChange(e.target.value)}
        />
        <button onClick={onDeploy} disabled={!tokenName.trim()}>Connect Wallet & Deploy</button>
      </div>

      <div className="card">
        <h2>Join Existing Token</h2>
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

function TokenPanel({ state }: { state: TokenDerivedState }) {
  return (
    <div className="supply-box">
      <div style={{ marginBottom: "0.5rem", color: "#a0a0a0" }}>
        {state.tokenName} - Total Supply
      </div>
      <div className="count">{Number(state.totalSupply).toLocaleString()}</div>
      <div style={{ marginTop: "0.5rem", color: "#a0a0a0", fontSize: "0.8rem", wordBreak: "break-all" }}>
        Owner: {toHex(state.owner)}
      </div>
    </div>
  );
}

function MintCard({
  api,
  disabled,
  onWorking,
  onDone,
}: {
  api: DeployedTokenAPI;
  disabled: boolean;
  onWorking: (msg: string) => void;
  onDone: (msg: string) => void;
}) {
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");

  const mint = useCallback(async () => {
    if (!toAddress || !amount) return;
    onWorking(`Minting ${amount} tokens (generating ZK proof + submitting tx)...`);
    try {
      await api.mint(fromHex(toAddress), BigInt(amount));
      onDone(`Minted ${amount} tokens to ${toAddress.substring(0, 16)}...`);
    } catch (e) {
      console.error("Mint failed:", e);
      onDone(`Failed: ${formatError(e)}`);
    }
  }, [api, toAddress, amount, onWorking, onDone]);

  return (
    <div className="card">
      <h2>Mint Tokens (Owner Only)</h2>
      <label>Recipient address (hex)</label>
      <input
        placeholder="0x..."
        value={toAddress}
        onChange={(e) => setToAddress(e.target.value)}
      />
      <label>Amount</label>
      <input
        placeholder="1000"
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <button onClick={mint} disabled={disabled || !toAddress || !amount}>
        Mint
      </button>
    </div>
  );
}

function TransferCard({
  api,
  disabled,
  onWorking,
  onDone,
}: {
  api: DeployedTokenAPI;
  disabled: boolean;
  onWorking: (msg: string) => void;
  onDone: (msg: string) => void;
}) {
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");

  const transfer = useCallback(async () => {
    if (!toAddress || !amount) return;
    onWorking(`Transferring ${amount} tokens (generating ZK proof + submitting tx)...`);
    try {
      await api.transfer(fromHex(toAddress), BigInt(amount));
      onDone(`Transferred ${amount} tokens to ${toAddress.substring(0, 16)}...`);
    } catch (e) {
      console.error("Transfer failed:", e);
      onDone(`Failed: ${formatError(e)}`);
    }
  }, [api, toAddress, amount, onWorking, onDone]);

  return (
    <div className="card">
      <h2>Transfer Tokens</h2>
      <p style={{ color: "#888", marginBottom: "0.5rem" }}>
        Your secret key is used as a witness to prove identity (never leaves the browser).
      </p>
      <label>Recipient address (hex)</label>
      <input
        placeholder="0x..."
        value={toAddress}
        onChange={(e) => setToAddress(e.target.value)}
      />
      <label>Amount</label>
      <input
        placeholder="100"
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <button onClick={transfer} disabled={disabled || !toAddress || !amount}>
        Transfer
      </button>
    </div>
  );
}

function BalanceCard({ api }: { api: DeployedTokenAPI }) {
  const [ownAddress, setOwnAddress] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const deriveOwnAddress = useCallback(async () => {
    setLoading(true);
    try {
      const addr = await api.deriveAddress();
      setOwnAddress(toHex(addr));
    } catch (e) {
      console.error("deriveAddress failed:", e);
      setOwnAddress(`Error: ${formatError(e)}`);
    } finally {
      setLoading(false);
    }
  }, [api]);

  return (
    <div className="card">
      <h2>My Address</h2>
      <p style={{ color: "#888", marginBottom: "0.5rem" }}>
        Derive your token address from your secret key. Share this address to receive tokens.
      </p>
      <button onClick={deriveOwnAddress} disabled={loading}>
        {loading ? "Deriving..." : "Show My Address"}
      </button>
      {ownAddress && (
        <div className="status info" style={{ marginTop: "0.5rem", wordBreak: "break-all" }}>
          {ownAddress}
        </div>
      )}
    </div>
  );
}
