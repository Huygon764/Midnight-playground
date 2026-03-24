"use client";

import { useState } from "react";

type WalletState = {
  connected: boolean;
  address?: string;
};

type Role = "employer" | "employee" | null;

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

function RoleSelector({
  onSelect,
}: {
  onSelect: (role: Role) => void;
}) {
  return (
    <div className="card">
      <h2>Select Role</h2>
      <p style={{ marginBottom: "1rem", color: "#aaa" }}>
        Are you the employer or an employee?
      </p>
      <div className="role-selector">
        <button onClick={() => onSelect("employer")}>Employer</button>
        <button onClick={() => onSelect("employee")}>Employee</button>
      </div>
    </div>
  );
}

function EmployerView() {
  const [contractAddress, setContractAddress] = useState("");
  const [empPubKey, setEmpPubKey] = useState("");
  const [salaryAmount, setSalaryAmount] = useState("");
  const [period, setPeriod] = useState<number | null>(null);
  const [status, setStatus] = useState("");

  const deploy = () => {
    setContractAddress("0x" + "a".repeat(64));
    setStatus("Contract deployed (demo). In production, this calls the contract deployer.");
    setPeriod(1);
  };

  const commitSalary = () => {
    if (!empPubKey || !salaryAmount) return;
    setStatus(
      `Salary commitment submitted: ${salaryAmount} for employee ${empPubKey.substring(0, 16)}...`,
    );
    // In production, this would compute commitment and call contract.callTx.commitSalary()
  };

  const newPeriod = () => {
    setPeriod((p) => (p ?? 0) + 1);
    setStatus("New period started. Merkle history reset.");
    // In production, this would call contract.callTx.newPeriod()
  };

  return (
    <>
      <div className="card">
        <h2>Deploy Contract</h2>
        <button onClick={deploy} disabled={!!contractAddress}>
          {contractAddress ? "Deployed" : "Deploy Payroll Contract"}
        </button>
        {contractAddress && (
          <div className="status connected">
            Contract: {contractAddress.substring(0, 20)}...
          </div>
        )}
      </div>

      {contractAddress && (
        <>
          <div className="card">
            <h2>Commit Salary</h2>
            <label>Employee Public Key (hex)</label>
            <input
              placeholder="0x..."
              value={empPubKey}
              onChange={(e) => setEmpPubKey(e.target.value)}
            />
            <label>Salary Amount</label>
            <input
              placeholder="e.g. 5000"
              type="number"
              value={salaryAmount}
              onChange={(e) => setSalaryAmount(e.target.value)}
            />
            <button onClick={commitSalary} disabled={!empPubKey || !salaryAmount}>
              Commit Salary
            </button>
          </div>

          <div className="card">
            <h2>Period Management</h2>
            {period !== null && (
              <div className="status info">Current Period: {period}</div>
            )}
            <button onClick={newPeriod}>Start New Period</button>
          </div>
        </>
      )}

      {status && (
        <div className="card">
          <div className="status connected">{status}</div>
        </div>
      )}
    </>
  );
}

function EmployeeView() {
  const [contractAddress, setContractAddress] = useState("");
  const [period, setPeriod] = useState<number | null>(null);
  const [claimStatus, setClaimStatus] = useState("");

  const joinContract = () => {
    if (!contractAddress) return;
    setPeriod(1);
    setClaimStatus("Joined contract. You can now claim salary.");
    // In production, this would call findDeployedContract()
  };

  const claimSalary = () => {
    setClaimStatus("Salary claim submitted. Nullifier generated to prevent double-claim.");
    // In production, this would call contract.callTx.claimSalary()
  };

  return (
    <>
      <div className="card">
        <h2>Join Contract</h2>
        <label>Contract Address (hex)</label>
        <input
          placeholder="Contract address..."
          value={contractAddress}
          onChange={(e) => setContractAddress(e.target.value)}
        />
        <button onClick={joinContract} disabled={!contractAddress}>
          Join Contract
        </button>
      </div>

      {period !== null && (
        <>
          <div className="card">
            <h2>Claim Salary</h2>
            <div className="status info">Current Period: {period}</div>
            <button onClick={claimSalary}>Claim Salary</button>
          </div>
        </>
      )}

      {claimStatus && (
        <div className="card">
          <div className="status connected">{claimStatus}</div>
        </div>
      )}
    </>
  );
}

export default function App() {
  const [wallet, setWallet] = useState<WalletState>({ connected: false });
  const [role, setRole] = useState<Role>(null);

  return (
    <div>
      <h1>Payroll Lite</h1>
      <p>
        Private payroll on Midnight using commitment/nullifier pattern with
        HistoricMerkleTree.
      </p>

      {!wallet.connected ? (
        <ConnectWallet
          onConnect={(addr) => setWallet({ connected: true, address: addr })}
        />
      ) : !role ? (
        <>
          <div className="status connected">
            Connected: {wallet.address?.substring(0, 20)}...
          </div>
          <RoleSelector onSelect={setRole} />
        </>
      ) : (
        <>
          <div className="status connected">
            Connected: {wallet.address?.substring(0, 20)}... | Role:{" "}
            {role.charAt(0).toUpperCase() + role.slice(1)}
            <button
              style={{ marginLeft: "1rem", fontSize: "0.8rem", padding: "0.25rem 0.75rem" }}
              onClick={() => setRole(null)}
            >
              Switch Role
            </button>
          </div>
          {role === "employer" ? <EmployerView /> : <EmployeeView />}
        </>
      )}
    </div>
  );
}
