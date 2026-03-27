import { useState, useEffect, useCallback } from "react";
import { type PolyPayDerivedState, type TransactionInfo, PolyPayAPI, type DeployedPolyPayAPI, utils } from "../../api/src/index.js";
import { PolyPay, createPolyPayPrivateState } from "../../contract/src/index.js";
import { getProviders } from "./providers.js";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";

type Phase = "connect" | "connecting" | "setup" | "init-signers" | "dashboard" | "error";
type Tab = "mint" | "propose-transfer" | "propose-signer" | "transactions" | "withdraw";

const STORAGE_KEY = "polypay:secret";

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

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function saveSecret(secret: Uint8Array) {
  localStorage.setItem(STORAGE_KEY, toHex(secret));
}

function loadSecret(): Uint8Array | null {
  const hex = localStorage.getItem(STORAGE_KEY);
  if (!hex) return null;
  return hexToBytes(hex);
}

const TX_TYPE_LABELS: Record<string, string> = {
  "0": "Transfer",
  "2": "Add Signer",
  "3": "Remove Signer",
  "4": "Set Threshold",
};

export default function App() {
  const [phase, setPhase] = useState<Phase>("connect");
  const [error, setError] = useState("");
  const [api, setApi] = useState<DeployedPolyPayAPI | null>(null);
  const [state, setState] = useState<PolyPayDerivedState | null>(null);
  const [contractAddress, setContractAddress] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [workingMsg, setWorkingMsg] = useState("");
  const [txStatus, setTxStatus] = useState("");
  const [tab, setTab] = useState<Tab>("mint");

  const [mySecret, setMySecret] = useState("");
  const [myCommitment, setMyCommitment] = useState("");
  const [threshold, setThreshold] = useState("2");
  const [joinAddr, setJoinAddr] = useState("");
  const [signerCommitment, setSignerCommitment] = useState("");

  useEffect(() => {
    if (!api) return;
    const sub = api.state$.subscribe({
      next: (s) => setState(s),
      error: (err) => setError(err.message),
    });
    return () => sub.unsubscribe();
  }, [api]);

  useEffect(() => {
    const saved = loadSecret();
    if (saved) {
      const commitment = PolyPay.pureCircuits.deriveCommitment(saved);
      setMySecret(toHex(saved));
      setMyCommitment(toHex(commitment));
    }
  }, []);

  const connectWallet = useCallback(async () => {
    try {
      setPhase("connecting");
      setError("");
      await getProviders();
      setPhase("setup");
    } catch (e) {
      console.error("Connect failed:", e);
      setError(formatError(e));
      setPhase("error");
    }
  }, []);

  const setupIdentity = async (payApi: PolyPayAPI) => {
    const secret = await payApi.getSecret();
    saveSecret(secret);
    const commitment = PolyPay.pureCircuits.deriveCommitment(secret);
    setMySecret(toHex(secret));
    setMyCommitment(toHex(commitment));
  };

  const deployContract = useCallback(async () => {
    setIsWorking(true);
    setWorkingMsg("Deploying PolyPay contract...");
    setTxStatus("");
    try {
      const providers = await getProviders();
      const payApi = await PolyPayAPI.deploy(providers, BigInt(threshold));
      setApi(payApi);
      setContractAddress(payApi.deployedContractAddress);
      await setupIdentity(payApi);
      setTxStatus("Deployed successfully");
      setPhase("init-signers");
    } catch (e) {
      console.error("Deploy failed:", e);
      setTxStatus(`Deploy failed: ${formatError(e)}`);
    } finally {
      setIsWorking(false);
      setWorkingMsg("");
    }
  }, [threshold]);

  const joinContract = useCallback(async () => {
    if (!joinAddr.trim()) return;
    setIsWorking(true);
    setWorkingMsg("Joining contract...");
    setTxStatus("");
    try {
      const providers = await getProviders();
      const saved = loadSecret();
      if (saved) {
        await providers.privateStateProvider.set("polyPayPrivateState" as any, createPolyPayPrivateState(saved) as any);
      }
      const payApi = await PolyPayAPI.join(providers, joinAddr.trim());
      setApi(payApi);
      setContractAddress(payApi.deployedContractAddress);
      await setupIdentity(payApi);
      setPhase("dashboard");
    } catch (e) {
      console.error("Join failed:", e);
      setTxStatus(`Join failed: ${formatError(e)}`);
    } finally {
      setIsWorking(false);
      setWorkingMsg("");
    }
  }, [joinAddr]);

  const addSigner = useCallback(async () => {
    if (!api || !signerCommitment.trim()) return;
    setIsWorking(true);
    setWorkingMsg("Adding signer...");
    setTxStatus("");
    try {
      await api.initSigner(hexToBytes(signerCommitment.trim()));
      setTxStatus("Signer added");
      setSignerCommitment("");
    } catch (e) {
      console.error("initSigner failed:", e);
      setTxStatus(`Failed: ${formatError(e)}`);
    } finally {
      setIsWorking(false);
      setWorkingMsg("");
    }
  }, [api, signerCommitment]);

  const doFinalize = useCallback(async () => {
    if (!api) return;
    setIsWorking(true);
    setWorkingMsg("Finalizing...");
    setTxStatus("");
    try {
      await api.finalize();
      setTxStatus("Contract finalized");
      setPhase("dashboard");
    } catch (e) {
      console.error("Finalize failed:", e);
      setTxStatus(`Failed: ${formatError(e)}`);
    } finally {
      setIsWorking(false);
      setWorkingMsg("");
    }
  }, [api]);

  const doAction = useCallback(async (label: string, fn: () => Promise<void>) => {
    setIsWorking(true);
    setWorkingMsg(`${label}...`);
    setTxStatus("");
    try {
      await fn();
      setTxStatus(`${label} — success`);
    } catch (e) {
      console.error(`${label} failed:`, e);
      setTxStatus(`Failed: ${formatError(e)}`);
    } finally {
      setIsWorking(false);
      setWorkingMsg("");
    }
  }, []);

  // === RENDER ===

  if (phase === "connect" || phase === "error") {
    return (
      <div>
        <h1>PolyPay</h1>
        <p>Private multisig wallet on Midnight. ZK-proven signer identity.</p>
        <div className="card">
          <h2>Connect Wallet</h2>
          <button onClick={connectWallet}>Connect Lace Wallet</button>
        </div>
        {error && <div className="card"><div className="status error">{error}</div></div>}
      </div>
    );
  }

  if (phase === "connecting") {
    return <div><h1>PolyPay</h1><Spinner message="Connecting to Lace wallet..." /></div>;
  }

  if (phase === "setup") {
    return (
      <div>
        <h1>PolyPay</h1>
        <div className="status connected">Wallet connected</div>

        {mySecret && <IdentityCard secret={mySecret} commitment={myCommitment} />}

        <div className="card">
          <h2>Deploy New Contract</h2>
          <label>Threshold (min approvals)</label>
          <input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} min="1" max="10" />
          <button onClick={deployContract} disabled={isWorking}>Deploy</button>
        </div>

        <div className="card">
          <h2>Join Existing Contract</h2>
          <input placeholder="Contract address (hex)" value={joinAddr} onChange={(e) => setJoinAddr(e.target.value)} />
          <button onClick={joinContract} disabled={isWorking || !joinAddr.trim()}>Join</button>
        </div>

        {isWorking && <Spinner message={workingMsg} />}
        {txStatus && <div className="card"><div className={`status ${txStatus.includes("ailed") ? "error" : "connected"}`}><pre>{txStatus}</pre></div></div>}
      </div>
    );
  }

  if (phase === "init-signers") {
    return (
      <div>
        <h1>PolyPay</h1>
        <div className="status connected">Contract: <span className="mono">{contractAddress}</span></div>

        <IdentityCard secret={mySecret} commitment={myCommitment} />

        {state && (
          <div className="grid-2">
            <div className="stat"><div className="value">{state.signerCount.toString()}</div><div className="label">Signers</div></div>
            <div className="stat"><div className="value">{state.threshold.toString()}</div><div className="label">Threshold</div></div>
          </div>
        )}

        <div className="card">
          <h2>Add Signer</h2>
          <p>Add signer commitments one by one. Deployer is already added.</p>
          <input placeholder="Signer commitment (hex)" value={signerCommitment} onChange={(e) => setSignerCommitment(e.target.value)} />
          <button onClick={addSigner} disabled={isWorking || !signerCommitment.trim()}>Add Signer</button>
        </div>

        <div className="card">
          <h2>Finalize</h2>
          <p>Lock the contract. No more signers can be added via initSigner after this.</p>
          <button className="success" onClick={doFinalize} disabled={isWorking}>Finalize Contract</button>
        </div>

        {isWorking && <Spinner message={workingMsg} />}
        {txStatus && <div className="card"><div className={`status ${txStatus.includes("ailed") ? "error" : "connected"}`}><pre>{txStatus}</pre></div></div>}
      </div>
    );
  }

  return (
    <div>
      <h1>PolyPay</h1>
      <div className="status connected">Contract: <span className="mono">{contractAddress}</span></div>

      <IdentityCard secret={mySecret} commitment={myCommitment} />

      {state && (
        <div className="grid-2">
          <div className="stat"><div className="value">{state.totalSupply.toString()}</div><div className="label">Total Supply</div></div>
          <div className="stat"><div className="value">{state.signerCount.toString()}/{state.threshold.toString()}</div><div className="label">Signers / Threshold</div></div>
        </div>
      )}

      {isWorking && <Spinner message={workingMsg} />}

      {!isWorking && (
        <>
          <div className="tabs">
            {(["mint", "propose-transfer", "propose-signer", "transactions", "withdraw"] as Tab[]).map((t) => (
              <div key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => { setTab(t); setTxStatus(""); }}>
                {t === "propose-transfer" ? "Transfer" : t === "propose-signer" ? "Signers" : t.charAt(0).toUpperCase() + t.slice(1)}
              </div>
            ))}
          </div>

          {tab === "mint" && <MintTab api={api!} doAction={doAction} />}
          {tab === "propose-transfer" && <ProposeTransferTab api={api!} doAction={doAction} />}
          {tab === "propose-signer" && <ProposeSignerTab api={api!} doAction={doAction} />}
          {tab === "transactions" && <TransactionsTab api={api!} doAction={doAction} />}
          {tab === "withdraw" && <WithdrawTab api={api!} doAction={doAction} />}
        </>
      )}

      {txStatus && <div className="card"><div className={`status ${txStatus.includes("ailed") ? "error" : "connected"}`}><pre>{txStatus}</pre></div></div>}
    </div>
  );
}

function IdentityCard({ secret, commitment }: { secret: string; commitment: string }) {
  if (!secret) return null;
  return (
    <div className="card">
      <h2>Your Identity</h2>
      <label>Commitment (share this):</label>
      <div className="mono">{commitment}</div>
      <button className="secondary" onClick={() => navigator.clipboard.writeText(commitment)}>Copy Commitment</button>
      <details style={{ marginTop: "0.5rem" }}>
        <summary style={{ cursor: "pointer", color: "#888" }}>Show Secret</summary>
        <div className="mono" style={{ marginTop: "0.25rem" }}>{secret}</div>
        <button className="secondary" onClick={() => navigator.clipboard.writeText(secret)}>Copy Secret</button>
      </details>
    </div>
  );
}

function MintTab({ api, doAction }: { api: DeployedPolyPayAPI; doAction: (l: string, fn: () => Promise<void>) => Promise<void> }) {
  const [amount, setAmount] = useState("");
  return (
    <div className="card">
      <h2>Mint Tokens</h2>
      <p>Add tokens to the multisig vault. Max 65535 per call.</p>
      <input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} min="1" max="65535" />
      <button onClick={() => doAction("Mint", () => api.mint(BigInt(amount)))} disabled={!amount}>Mint</button>
    </div>
  );
}

function ProposeTransferTab({ api, doAction }: { api: DeployedPolyPayAPI; doAction: (l: string, fn: () => Promise<void>) => Promise<void> }) {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  return (
    <div className="card">
      <h2>Propose Transfer</h2>
      <p>Propose sending tokens from vault to a recipient. Auto-approves as proposer.</p>
      <label>Recipient (hex)</label>
      <input placeholder="Recipient commitment/address" value={to} onChange={(e) => setTo(e.target.value)} />
      <label>Amount</label>
      <input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <button onClick={() => doAction("Propose Transfer", () => api.proposeTransfer(hexToBytes(to), BigInt(amount)))} disabled={!to || !amount}>Propose</button>
    </div>
  );
}

function ProposeSignerTab({ api, doAction }: { api: DeployedPolyPayAPI; doAction: (l: string, fn: () => Promise<void>) => Promise<void> }) {
  const [commitment, setCommitment] = useState("");
  const [newThreshold, setNewThreshold] = useState("");
  return (
    <div className="card">
      <h2>Signer Management</h2>
      <label>Add Signer (commitment hex)</label>
      <input placeholder="Commitment" value={commitment} onChange={(e) => setCommitment(e.target.value)} />
      <button onClick={() => { doAction("Propose Add Signer", () => api.proposeAddSigner(hexToBytes(commitment))); setCommitment(""); }} disabled={!commitment}>Propose Add</button>
      <button className="danger" onClick={() => { doAction("Propose Remove Signer", () => api.proposeRemoveSigner(hexToBytes(commitment))); setCommitment(""); }} disabled={!commitment}>Propose Remove</button>
      <label style={{ marginTop: "1rem" }}>Set Threshold</label>
      <input type="number" placeholder="New threshold" value={newThreshold} onChange={(e) => setNewThreshold(e.target.value)} min="1" max="10" />
      <button onClick={() => doAction("Propose Set Threshold", () => api.proposeSetThreshold(BigInt(newThreshold)))} disabled={!newThreshold}>Propose Threshold</button>
    </div>
  );
}

function TransactionsTab({ api, doAction }: { api: DeployedPolyPayAPI; doAction: (l: string, fn: () => Promise<void>) => Promise<void> }) {
  const [txList, setTxList] = useState<TransactionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [txId, setTxId] = useState("");
  const [txType, setTxType] = useState("0");

  const executeFns: Record<string, (id: bigint) => Promise<void>> = {
    "0": (id) => api.executeTransfer(id),
    "2": (id) => api.executeAddSigner(id),
    "3": (id) => api.executeRemoveSigner(id),
    "4": (id) => api.executeSetThreshold(id),
  };

  const refreshList = useCallback(async () => {
    setLoading(true);
    try {
      setTxList(await api.getTransactionList());
    } catch (e) {
      console.error("Failed to load txs:", e);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { refreshList(); }, [refreshList]);

  return (
    <div className="card">
      <h2>Transactions</h2>
      <button className="secondary" onClick={refreshList} disabled={loading}>{loading ? "Loading..." : "Refresh"}</button>

      {txList.length > 0 && (
        <div style={{ marginTop: "0.75rem" }}>
          <div className="tx-row" style={{ fontWeight: "bold", color: "#888" }}>
            <span>ID</span><span>Type</span><span>Status</span><span>Approvals</span>
          </div>
          {txList.map((tx) => (
            <div key={tx.txId.toString()} className="tx-row">
              <span>#{tx.txId.toString()}</span>
              <span>{TX_TYPE_LABELS[tx.txType.toString()] ?? `Type ${tx.txType}`}</span>
              <span style={{ color: tx.status === 0n ? "#f59e0b" : "#16a34a" }}>{tx.status === 0n ? "Pending" : "Executed"}</span>
              <span>{tx.approvals.toString()}</span>
            </div>
          ))}
        </div>
      )}

      {txList.length === 0 && !loading && <p style={{ marginTop: "0.5rem" }}>No transactions yet.</p>}

      <div style={{ marginTop: "1rem", borderTop: "1px solid #333", paddingTop: "1rem" }}>
        <h2>Approve & Execute</h2>
        <label>Transaction ID</label>
        <input type="number" placeholder="txId" value={txId} onChange={(e) => setTxId(e.target.value)} />
        <button onClick={() => doAction("Approve", async () => { await api.approveTx(BigInt(txId)); await refreshList(); })} disabled={!txId}>Approve</button>

        <label style={{ marginTop: "0.5rem" }}>Execute (select tx type)</label>
        <select value={txType} onChange={(e) => setTxType(e.target.value)}>
          {Object.entries(TX_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="success" onClick={() => doAction(`Execute ${TX_TYPE_LABELS[txType]}`, async () => { await executeFns[txType](BigInt(txId)); await refreshList(); })} disabled={!txId}>Execute</button>
      </div>
    </div>
  );
}

function WithdrawTab({ api, doAction }: { api: DeployedPolyPayAPI; doAction: (l: string, fn: () => Promise<void>) => Promise<void> }) {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  return (
    <div className="card">
      <h2>Withdraw</h2>
      <p>Transfer tokens from your personal balance to another address.</p>
      <label>To (hex)</label>
      <input placeholder="Recipient address" value={to} onChange={(e) => setTo(e.target.value)} />
      <label>Amount</label>
      <input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <button onClick={() => doAction("Withdraw", () => api.withdraw(hexToBytes(to), BigInt(amount)))} disabled={!to || !amount}>Withdraw</button>
    </div>
  );
}
