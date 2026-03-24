"use client";

import { useState } from "react";

type WalletState = {
  connected: boolean;
  address?: string;
};

type Tab = "mint" | "transfer" | "balance";

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

function MintPage() {
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");

  const mint = () => {
    if (!toAddress || !amount) return;
    setStatus(`Mint submitted: ${amount} tokens to ${toAddress.substring(0, 16)}...`);
    // In production, this would call contract.callTx.mint(to, amount)
  };

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
      <button onClick={mint} disabled={!toAddress || !amount}>
        Mint
      </button>
      {status && <div className="status connected">{status}</div>}
    </div>
  );
}

function TransferPage() {
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");

  const transfer = () => {
    if (!toAddress || !amount) return;
    setStatus(`Transfer submitted: ${amount} tokens to ${toAddress.substring(0, 16)}...`);
    // In production, this would call contract.callTx.transfer(to, amount)
  };

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
      <button onClick={transfer} disabled={!toAddress || !amount}>
        Transfer
      </button>
      {status && <div className="status connected">{status}</div>}
    </div>
  );
}

function BalancePage() {
  const [address, setAddress] = useState("");
  const [balance, setBalance] = useState<string | null>(null);

  const checkBalance = () => {
    if (!address) return;
    // In production, this would query the on-chain state
    setBalance("0");
  };

  return (
    <div className="card">
      <h2>Check Balance</h2>
      <label>Address (hex)</label>
      <input
        placeholder="0x..."
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />
      <button onClick={checkBalance} disabled={!address}>
        Check
      </button>
      {balance !== null && (
        <div className="status info">Balance: {balance}</div>
      )}
    </div>
  );
}

function TotalSupplyDisplay({
  totalSupply,
  tokenName,
}: {
  totalSupply: number;
  tokenName: string;
}) {
  return (
    <div className="supply-box">
      <div style={{ marginBottom: "0.5rem", color: "#a0a0a0" }}>
        {tokenName} - Total Supply
      </div>
      <div className="count">{totalSupply.toLocaleString()}</div>
    </div>
  );
}

export default function App() {
  const [wallet, setWallet] = useState<WalletState>({ connected: false });
  const [activeTab, setActiveTab] = useState<Tab>("mint");
  const [totalSupply] = useState(0);
  const [tokenName] = useState("PrivateToken");

  return (
    <div>
      <h1>Private Token</h1>
      <p>
        A token contract on Midnight using Map ADT for balances and identity-based
        transfers via secret key witnesses.
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

          <TotalSupplyDisplay totalSupply={totalSupply} tokenName={tokenName} />

          <div className="tabs">
            <div
              className={`tab ${activeTab === "mint" ? "active" : ""}`}
              onClick={() => setActiveTab("mint")}
            >
              Mint (Admin)
            </div>
            <div
              className={`tab ${activeTab === "transfer" ? "active" : ""}`}
              onClick={() => setActiveTab("transfer")}
            >
              Transfer
            </div>
            <div
              className={`tab ${activeTab === "balance" ? "active" : ""}`}
              onClick={() => setActiveTab("balance")}
            >
              Balance
            </div>
          </div>

          {activeTab === "mint" && <MintPage />}
          {activeTab === "transfer" && <TransferPage />}
          {activeTab === "balance" && <BalancePage />}
        </>
      )}
    </div>
  );
}
