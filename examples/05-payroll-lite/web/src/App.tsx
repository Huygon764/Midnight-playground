import { useState, useEffect, useCallback } from "react";
import { type PayrollDerivedState, PayrollAPI, type DeployedPayrollAPI, utils } from "../../api/src/index.js";
import { PayrollLite, createPayrollPrivateState } from "../../contract/src/index.js";
import { getProviders } from "./providers.js";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";

type AppPhase = "connect" | "connecting" | "contract-setup" | "role-select" | "ready" | "error";
type Role = "employer" | "employee";

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
  const [phase, setPhase] = useState<AppPhase>("connect");
  const [error, setError] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [api, setApi] = useState<DeployedPayrollAPI | null>(null);
  const [payrollState, setPayrollState] = useState<PayrollDerivedState | null>(null);
  const [contractAddress, setContractAddress] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [workingMessage, setWorkingMessage] = useState("");
  const [txStatus, setTxStatus] = useState("");

  const [joinAddress, setJoinAddress] = useState("");
  const [joinSecretKey, setJoinSecretKey] = useState("");

  useEffect(() => {
    if (!api) return;
    const sub = api.state$.subscribe({
      next: (state) => setPayrollState(state),
      error: (err) => setError(err.message),
    });
    return () => sub.unsubscribe();
  }, [api]);

  const connectWallet = useCallback(async () => {
    try {
      setPhase("connecting");
      setError("");
      await getProviders();
      setPhase("contract-setup");
    } catch (e) {
      console.error("Connect failed:", e);
      setError(formatError(e));
      setPhase("error");
    }
  }, []);

  const deployContract = useCallback(async () => {
    setIsWorking(true);
    setWorkingMessage("Deploying payroll contract...");
    setTxStatus("");
    try {
      const providers = await getProviders();
      const payrollApi = await PayrollAPI.deploy(providers);
      setApi(payrollApi);
      setContractAddress(payrollApi.deployedContractAddress);
      const pubKey = await payrollApi.derivePublicKey();
      setTxStatus(`Deployed. Your public key: ${toHex(pubKey)}`);
      setPhase("role-select");
    } catch (e) {
      console.error("Deploy failed:", e);
      setTxStatus(`Deploy failed: ${formatError(e)}`);
    } finally {
      setIsWorking(false);
      setWorkingMessage("");
    }
  }, []);

  const joinContract = useCallback(async () => {
    if (!joinAddress.trim()) return;
    setIsWorking(true);
    setWorkingMessage("Joining contract...");
    setTxStatus("");
    try {
      const providers = await getProviders();
      // If secret key provided (employer rejoining), set it in provider
      if (joinSecretKey.trim()) {
        const skBytes = hexToBytes(joinSecretKey.trim());
        await providers.privateStateProvider.set("payrollPrivateState" as any, createPayrollPrivateState(skBytes, 0n) as any);
      }
      const payrollApi = await PayrollAPI.join(providers, joinAddress.trim(), 0n);
      setApi(payrollApi);
      setContractAddress(payrollApi.deployedContractAddress);
      setPhase("role-select");
      setTxStatus("Joined contract");
    } catch (e) {
      console.error("Join failed:", e);
      setTxStatus(`Join failed: ${formatError(e)}`);
    } finally {
      setIsWorking(false);
      setWorkingMessage("");
    }
  }, [joinAddress, joinSecretKey]);

  // === EMPLOYER ACTIONS ===

  const [empPubKey, setEmpPubKey] = useState("");
  const [commitAmount, setCommitAmount] = useState("");

  const commitSalary = useCallback(async () => {
    if (!api || !empPubKey || !commitAmount) return;
    setIsWorking(true);
    setWorkingMessage("Committing salary...");
    setTxStatus("");
    try {
      const pubKeyBytes = hexToBytes(empPubKey);
      const salary = BigInt(commitAmount);
      const period = payrollState?.period ?? 1n;
      await api.commitSalary(pubKeyBytes, salary, period);
      setTxStatus(`Salary committed: ${commitAmount} for period ${period}`);
      setEmpPubKey("");
      setCommitAmount("");
    } catch (e) {
      console.error("Commit failed:", e);
      setTxStatus(`Failed: ${formatError(e)}`);
    } finally {
      setIsWorking(false);
      setWorkingMessage("");
    }
  }, [api, empPubKey, commitAmount, payrollState]);

  const newPeriod = useCallback(async () => {
    if (!api) return;
    setIsWorking(true);
    setWorkingMessage("Starting new period...");
    setTxStatus("");
    try {
      await api.newPeriod();
      setTxStatus("New period started");
    } catch (e) {
      console.error("New period failed:", e);
      setTxStatus(`Failed: ${formatError(e)}`);
    } finally {
      setIsWorking(false);
      setWorkingMessage("");
    }
  }, [api]);

  // === EMPLOYEE ACTIONS ===

  const [claimSk, setClaimSk] = useState("");
  const [claimSalary_, setClaimSalary_] = useState("");

  const generateKeypair = useCallback(() => {
    const sk = utils.randomBytes(32);
    const pk = PayrollLite.pureCircuits.derivePublicKey(sk);
    setTxStatus(`Secret key: ${toHex(sk)}\nPublic key: ${toHex(pk)}\n(Give public key to employer, keep secret key safe)`);
  }, []);

  const claimSalary = useCallback(async () => {
    if (!api || !claimSk || !claimSalary_) return;
    setIsWorking(true);
    setWorkingMessage("Claiming salary (ZK proof + submit)...");
    setTxStatus("");
    try {
      const providers = await getProviders();
      const skBytes = hexToBytes(claimSk);
      const salary = BigInt(claimSalary_);
      await providers.privateStateProvider.set("payrollPrivateState" as any, createPayrollPrivateState(skBytes, salary) as any);
      await api.claimSalary();
      setTxStatus("Salary claimed successfully");
      setClaimSk("");
      setClaimSalary_("");
    } catch (e) {
      console.error("Claim failed:", e);
      setTxStatus(`Failed: ${formatError(e)}`);
    } finally {
      setIsWorking(false);
      setWorkingMessage("");
    }
  }, [api, claimSk, claimSalary_]);

  // === RENDER ===

  if (phase === "connect" || phase === "error") {
    return (
      <div>
        <h1>Payroll Lite</h1>
        <p>Private payroll on Midnight using commitment/nullifier pattern.</p>
        <div className="card">
          <h2>Connect Wallet</h2>
          <button onClick={connectWallet}>Connect Lace Wallet</button>
        </div>
        {error && <div className="card"><div className="status error">{error}</div></div>}
      </div>
    );
  }

  if (phase === "connecting") {
    return <div><h1>Payroll Lite</h1><Spinner message="Connecting to Lace wallet..." /></div>;
  }

  if (phase === "contract-setup") {
    return (
      <div>
        <h1>Payroll Lite</h1>
        <div className="status connected">Wallet connected</div>

        <div className="card">
          <h2>Deploy New Contract</h2>
          <button onClick={deployContract} disabled={isWorking}>Deploy</button>
        </div>

        <div className="card">
          <h2>Join Existing Contract</h2>
          <input placeholder="Contract address (hex)" value={joinAddress} onChange={(e) => setJoinAddress(e.target.value)} />
          <input placeholder="Secret key (hex, employer only - optional)" value={joinSecretKey} onChange={(e) => setJoinSecretKey(e.target.value)} />
          <button onClick={joinContract} disabled={isWorking || !joinAddress.trim()}>Join</button>
        </div>

        {isWorking && <Spinner message={workingMessage} />}
        {txStatus && <div className="card"><div className={`status ${txStatus.includes("failed") || txStatus.includes("Failed") ? "error" : "connected"}`}>{txStatus}</div></div>}
      </div>
    );
  }

  if (phase === "role-select") {
    return (
      <div>
        <h1>Payroll Lite</h1>
        <div className="status connected">Contract: {contractAddress}</div>
        <div className="card">
          <h2>Select Role</h2>
          <div className="role-selector">
            <button onClick={() => { setRole("employer"); setPhase("ready"); setTxStatus(""); }}>Employer</button>
            <button onClick={() => { setRole("employee"); setPhase("ready"); setTxStatus(""); }}>Employee</button>
          </div>
        </div>
        {txStatus && <div className="card"><div className="status connected">{txStatus}</div></div>}
      </div>
    );
  }

  // Ready
  return (
    <div>
      <h1>Payroll Lite</h1>
      <div className="status connected">
        Contract: {contractAddress} | Role: {role === "employer" ? "Employer" : "Employee"}
      </div>

      {payrollState && (
        <div className="card">
          <h2>Status</h2>
          <div>Period: {payrollState.period.toString()} | Total Claimed: {payrollState.claimedAmount.toString()}</div>
        </div>
      )}

      {isWorking && <Spinner message={workingMessage} />}

      {role === "employer" && !isWorking && (
        <>
          <div className="card">
            <h2>Commit Salary</h2>
            <input placeholder="Employee public key (hex)" value={empPubKey} onChange={(e) => setEmpPubKey(e.target.value)} />
            <input placeholder="Salary amount" type="number" value={commitAmount} onChange={(e) => setCommitAmount(e.target.value)} />
            <button onClick={commitSalary} disabled={!empPubKey || !commitAmount}>Commit</button>
          </div>
          <div className="card">
            <h2>Period Management</h2>
            <button onClick={newPeriod}>Start New Period</button>
          </div>
        </>
      )}

      {role === "employee" && !isWorking && (
        <>
          <div className="card">
            <h2>Generate Keypair</h2>
            <p style={{ color: "#aaa", marginBottom: "0.5rem" }}>Generate a new keypair. Give public key to employer.</p>
            <button onClick={generateKeypair}>Generate</button>
          </div>
          <div className="card">
            <h2>Claim Salary</h2>
            <input placeholder="Your secret key (hex)" value={claimSk} onChange={(e) => setClaimSk(e.target.value)} />
            <input placeholder="Your salary amount" type="number" value={claimSalary_} onChange={(e) => setClaimSalary_(e.target.value)} />
            <button onClick={claimSalary} disabled={!claimSk || !claimSalary_}>Claim</button>
          </div>
        </>
      )}

      {txStatus && (
        <div className="card">
          <div className={`status ${txStatus.includes("failed") || txStatus.includes("Failed") ? "error" : "connected"}`}>
            <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{txStatus}</pre>
          </div>
        </div>
      )}
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
