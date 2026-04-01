import { useState, useEffect, useCallback } from "react";
import {
  type PolyPayDerivedState,
  PolyPayAPI,
  type DeployedPolyPayAPI,
  TokenAPI,
  type DeployedTokenAPI,
} from "../../api/src/index.js";
import { PolyPay, createPolyPayPrivateState, createTokenPrivateState } from "../../contract/src/index.js";
import { getProviders, getConnectedAPI, getUnshieldedAddressBytes } from "./providers.js";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";

import type { Mode, Phase, TokenTab, WalletTab } from "./types.js";
import {
  formatError,
  hexToBytes,
  saveSecret,
  loadSecret,
  saveContractAddress,
  loadContractAddress,
  saveTokenAddress,
  loadTokenAddress,
  truncateHex,
  deriveSecretFromSignature,
} from "./utils.js";
import { Icon, CopyButton, Spinner, StatusMessage } from "./components/ui.js";
import { Sidebar } from "./components/Sidebar.js";
import { PageHeader } from "./components/PageHeader.js";
import { IdentityCard } from "./components/IdentityCard.js";
import { SignerListCard } from "./components/SignerListCard.js";
import { DashboardOverview } from "./components/DashboardOverview.js";
import { TokenPage } from "./components/TokenPage.js";
import { DepositTab } from "./components/DepositTab.js";
import { ProposeTransferTab } from "./components/ProposeTransferTab.js";
import { ProposeSignerTab } from "./components/ProposeSignerTab.js";
import { TransactionsTab } from "./components/TransactionsTab.js";

export default function App() {
  const [phase, setPhase] = useState<Phase>("connect");
  const [mode, setMode] = useState<Mode>("token");
  const [error, setError] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [workingMsg, setWorkingMsg] = useState("");
  const [txStatus, setTxStatus] = useState("");

  // Identity
  const [mySecret, setMySecret] = useState("");
  const [myCommitment, setMyCommitment] = useState("");
  const [myAddress, setMyAddress] = useState("");

  // Token state
  const [tokenApi, setTokenApi] = useState<DeployedTokenAPI | null>(null);
  const [tokenAddress, setTokenAddress] = useState("");
  const [tokenColor, setTokenColor] = useState("");
  const [tokenName, setTokenName] = useState("POLY");
  const [tokenSymbol, setTokenSymbol] = useState("POLY");
  const [tokenTab, setTokenTab] = useState<TokenTab>("token-info");

  // Wallet state
  const [api, setApi] = useState<DeployedPolyPayAPI | null>(null);
  const [state, setState] = useState<PolyPayDerivedState | null>(null);
  const [contractAddress, setContractAddress] = useState("");
  const [walletTab, setWalletTab] = useState<WalletTab>("overview");
  const [threshold, setThreshold] = useState("2");
  const [joinAddr, setJoinAddr] = useState("");
  const [signerCommitment, setSignerCommitment] = useState("");
  const [tokenColorInput, setTokenColorInput] = useState("");

  // Subscribe to multisig state
  useEffect(() => {
    if (!api) return;
    const sub = api.state$.subscribe({
      next: (s) => setState(s),
      error: (err) => setError(err.message),
    });
    return () => sub.unsubscribe();
  }, [api]);

  // Restore secret from localStorage on load
  useEffect(() => {
    const saved = loadSecret();
    if (saved) {
      const commitment = PolyPay.pureCircuits.deriveCommitment(saved);
      setMySecret(toHex(saved));
      setMyCommitment(toHex(commitment));
    }
  }, []);

  // Derive or restore secret
  const restoreOrDeriveSecret = useCallback(async (): Promise<Uint8Array> => {
    const saved = loadSecret();
    if (saved) return saved;
    const walletApi = getConnectedAPI();
    const result = await walletApi.signData("PolyPay Signer Identity", {
      encoding: "text",
      keyType: "unshielded",
    });
    const secret = await deriveSecretFromSignature(result.signature);
    saveSecret(secret);
    return secret;
  }, []);

  // Connect wallet + restore session
  const connectWallet = useCallback(async () => {
    try {
      setPhase("connecting");
      setError("");
      const providers = await getProviders();

      const secret = await restoreOrDeriveSecret();
      const commitment = PolyPay.pureCircuits.deriveCommitment(secret);
      setMySecret(toHex(secret));
      setMyCommitment(toHex(commitment));

      await providers.privateStateProvider.set("polyPayPrivateState" as any, createPolyPayPrivateState(secret) as any);
      await providers.privateStateProvider.set("tokenPrivateState" as any, createTokenPrivateState(secret) as any);

      setMyAddress(toHex(getUnshieldedAddressBytes()));

      // Restore token contract
      const savedTokenAddr = loadTokenAddress();
      if (savedTokenAddr) {
        try {
          const tApi = await TokenAPI.join(providers as any, savedTokenAddr);
          setTokenApi(tApi);
          setTokenAddress(tApi.deployedContractAddress);
          const info = await tApi.getTokenInfo();
          const colorHex = toHex(info.color);
          if (colorHex !== "0".repeat(64)) setTokenColor(colorHex);
          if (info.name) setTokenName(info.name);
          if (info.symbol) setTokenSymbol(info.symbol);
        } catch (e) {
          console.warn("Failed to restore token contract:", e);
        }
      }

      // Restore multisig contract
      const savedAddr = loadContractAddress();
      if (savedAddr) {
        setWorkingMsg("Rejoining contract...");
        const payApi = await PolyPayAPI.join(providers, savedAddr);
        setApi(payApi);
        setContractAddress(payApi.deployedContractAddress);
        setMode("wallet");
        setPhase("dashboard");
      } else {
        setPhase("setup");
      }
    } catch (e) {
      console.error("Connect failed:", e);
      setError(formatError(e));
      setPhase("error");
    }
  }, [restoreOrDeriveSecret]);

  // ─── Token Actions ──────────────────────────────────────────────────

  const deployToken = useCallback(async () => {
    setIsWorking(true);
    setWorkingMsg("Deploying token contract...");
    setTxStatus("");
    try {
      const providers = await getProviders();
      const tApi = await TokenAPI.deploy(providers as any, tokenName, tokenSymbol);
      setTokenApi(tApi);
      setTokenAddress(tApi.deployedContractAddress);
      saveTokenAddress(tApi.deployedContractAddress);
      setTxStatus("Token contract deployed");
    } catch (e) {
      console.error("Deploy token failed:", e);
      setTxStatus(`Deploy token failed: ${formatError(e)}`);
    } finally {
      setIsWorking(false);
      setWorkingMsg("");
    }
  }, [tokenName, tokenSymbol]);

  // ─── Wallet Actions ─────────────────────────────────────────────────

  const deployContract = useCallback(async () => {
    if (!tokenColorInput) return;
    setIsWorking(true);
    setWorkingMsg("Deploying PolyPay contract...");
    setTxStatus("");
    try {
      const providers = await getProviders();
      const payApi = await PolyPayAPI.deploy(providers, BigInt(threshold), hexToBytes(tokenColorInput));
      setApi(payApi);
      setContractAddress(payApi.deployedContractAddress);
      saveContractAddress(payApi.deployedContractAddress);
      setTxStatus("Deployed successfully");
      setPhase("init-signers");
    } catch (e) {
      console.error("Deploy failed:", e);
      setTxStatus(`Deploy failed: ${formatError(e)}`);
    } finally {
      setIsWorking(false);
      setWorkingMsg("");
    }
  }, [threshold, tokenColorInput]);

  const joinContract = useCallback(async () => {
    if (!joinAddr.trim()) return;
    setIsWorking(true);
    setWorkingMsg("Joining contract...");
    setTxStatus("");
    try {
      const providers = await getProviders();
      const payApi = await PolyPayAPI.join(providers, joinAddr.trim());
      setApi(payApi);
      setContractAddress(payApi.deployedContractAddress);
      saveContractAddress(payApi.deployedContractAddress);
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

  const refreshTokenColor = useCallback(async () => {
    if (!tokenApi) return;
    try {
      const color = await tokenApi.getTokenColor();
      const hex = toHex(color);
      if (hex !== "0".repeat(64)) setTokenColor(hex);
    } catch {}
  }, [tokenApi]);

  const doAction = useCallback(async (label: string, fn: () => Promise<void>) => {
    setIsWorking(true);
    setWorkingMsg(`${label}...`);
    setTxStatus("");
    try {
      await fn();
      setTxStatus(`${label} -- success`);
      if (mode === "token") await refreshTokenColor();
    } catch (e) {
      console.error(`${label} failed:`, e);
      setTxStatus(`Failed: ${formatError(e)}`);
    } finally {
      setIsWorking(false);
      setWorkingMsg("");
    }
  }, [mode, refreshTokenColor]);

  // Auto-fill token color when switching to wallet mode
  useEffect(() => {
    if (tokenColor && !tokenColorInput) setTokenColorInput(tokenColor);
  }, [tokenColor, tokenColorInput]);

  // ─── RENDER: Connect Phase ──────────────────────────────────────────

  if (phase === "connect" || phase === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 font-body text-on-surface">
        <div className="fixed inset-0 overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-20 blur-[120px] rounded-full bg-primary-container" />
        </div>
        <main className="w-full max-w-lg">
          <div className="glass-panel border border-outline-variant/15 rounded-3xl p-10 md:p-12 flex flex-col items-center text-center shadow-2xl">
            <div className="w-16 h-16 gradient-btn rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-primary-container/20">
              <Icon name="toll" filled className="text-on-primary text-4xl" />
            </div>
            <h1 className="font-headline font-black text-4xl tracking-tighter text-on-surface mb-2">PolyPay</h1>
            <p className="text-on-surface-variant font-body text-lg">Private Multisig Wallet on Midnight</p>
            <div className="w-full h-px bg-gradient-to-r from-transparent via-outline-variant/20 to-transparent my-10" />
            <div className="w-full space-y-4">
              <button onClick={connectWallet} className="w-full gradient-btn text-on-primary font-headline font-bold text-lg py-5 px-8 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 shadow-lg shadow-primary-container/20">
                <Icon name="account_balance_wallet" />
                Connect Lace Wallet
              </button>
              <p className="text-on-surface-variant/60 font-label text-sm tracking-wide">SECURED BY ZERO-KNOWLEDGE PROOFS</p>
            </div>
            {error && (
              <div className="mt-8 w-full bg-error-container/10 border border-error/20 rounded-xl p-4 text-left flex items-start gap-3">
                <Icon name="error" filled className="text-error mt-0.5" />
                <p className="text-on-error-container text-sm">{error}</p>
              </div>
            )}
            <div className="mt-12 grid grid-cols-2 gap-4 w-full">
              <div className="bg-surface-container-low/50 p-4 rounded-xl flex flex-col items-start gap-2 text-left">
                <Icon name="shield" className="text-secondary" />
                <span className="font-headline font-semibold text-sm">Always Private</span>
                <span className="text-xs text-on-surface-variant">Transactional metadata remains shielded.</span>
              </div>
              <div className="bg-surface-container-low/50 p-4 rounded-xl flex flex-col items-start gap-2 text-left">
                <Icon name="group" className="text-secondary" />
                <span className="font-headline font-semibold text-sm">Multi-Signature</span>
                <span className="text-xs text-on-surface-variant">Collective asset management for DAOs.</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (phase === "connecting") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center font-body text-on-surface">
        <div className="fixed inset-0 overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-20 blur-[120px] rounded-full bg-primary-container" />
        </div>
        <div className="glass-panel rounded-2xl p-8 flex items-center gap-4 shadow-2xl">
          <div className="w-6 h-6 border-2 border-outline-variant border-t-primary rounded-full animate-spin" />
          <span className="text-on-surface font-headline text-lg">Connecting to Lace wallet...</span>
        </div>
      </div>
    );
  }

  // ─── RENDER: Sidebar Layout ─────────────────────────────────────────

  const breadcrumbMap: Record<string, string> = {
    "token-info": "Token",
    "token-mint": "Mint Tokens",
    setup: "Setup",
    "init-signers": "Add Signers",
    overview: "Dashboard",
    deposit: "Deposit",
    "propose-transfer": "Propose Transfer",
    "propose-signer": "Manage Signers",
    transactions: "Transactions",
  };

  const currentTab = mode === "token" ? tokenTab : walletTab;
  const breadcrumb = phase === "dashboard" || mode === "token"
    ? breadcrumbMap[currentTab] || currentTab
    : breadcrumbMap[phase] || phase;

  const isInteractive = mode === "token" ? !!tokenAddress : phase === "dashboard";

  return (
    <div className="flex min-h-screen bg-background text-on-surface font-body">
      <Sidebar
        mode={mode}
        onModeChange={(m) => { setMode(m); setTxStatus(""); }}
        activeTokenTab={tokenTab}
        activeWalletTab={walletTab}
        onTokenTabChange={(t) => { setTokenTab(t); setTxStatus(""); }}
        onWalletTabChange={(t) => { setWalletTab(t); setTxStatus(""); }}
        address={myCommitment || undefined}
        interactive={isInteractive}
      />

      <div className="ml-64 flex-1 flex flex-col min-h-screen relative">
        <PageHeader breadcrumb={breadcrumb} />

        <main className="flex-1 p-8 max-w-5xl w-full mx-auto space-y-6">
          {/* ── Token Mode ─────────────────────────────────────── */}
          {mode === "token" && (
            <TokenPage
              tab={tokenTab}
              tokenApi={tokenApi}
              tokenAddress={tokenAddress}
              tokenColor={tokenColor}
              tokenName={tokenName}
              tokenSymbol={tokenSymbol}
              myAddress={myAddress}
              isWorking={isWorking}
              doAction={doAction}
              onDeploy={deployToken}
              onNameChange={setTokenName}
              onSymbolChange={setTokenSymbol}
            />
          )}

          {/* ── Wallet Mode: Setup ─────────────────────────────── */}
          {mode === "wallet" && phase === "setup" && (
            <>
              <div className="space-y-2 mb-8">
                <h2 className="text-4xl font-headline font-extrabold tracking-tight">Setup Multisig</h2>
                <p className="text-on-surface-variant max-w-2xl">
                  Deploy a new multisig vault or join an existing one. You need a token color from
                  a deployed token contract.
                </p>
              </div>
              {mySecret && <IdentityCard secret={mySecret} commitment={myCommitment} />}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-surface-container-low rounded-2xl p-8 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary-container" />
                  <h3 className="text-2xl font-headline font-extrabold tracking-tight mb-2">Deploy New Multisig</h3>
                  <p className="text-on-surface-variant text-sm mb-6">Initialize your private vault on the Midnight Network.</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-headline font-bold text-outline mb-2">Token Color</label>
                      <input
                        placeholder="Token color hex (from token contract)"
                        value={tokenColorInput}
                        onChange={(e) => setTokenColorInput(e.target.value)}
                        className="w-full bg-surface-container-lowest border-none rounded-xl py-4 px-5 text-on-surface font-label text-sm focus:ring-2 focus:ring-primary/50 transition-all outline-none placeholder:text-outline/40"
                      />
                      {tokenColor && !tokenColorInput && (
                        <button onClick={() => setTokenColorInput(tokenColor)} className="mt-1 text-xs text-primary hover:underline">
                          Use deployed token color
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-headline font-bold text-outline mb-2">Approval Threshold</label>
                      <input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} min="1" max="10"
                        className="w-full bg-surface-container-lowest border-none rounded-xl py-4 px-5 text-on-surface font-label text-lg focus:ring-2 focus:ring-primary/50 transition-all outline-none" />
                      <div className="mt-2 flex items-start gap-2 px-1">
                        <Icon name="info" className="text-primary text-sm mt-0.5" />
                        <p className="text-xs text-on-surface-variant">You will be added as the first signer. The threshold defines how many signatures are needed.</p>
                      </div>
                    </div>
                    <button onClick={deployContract} disabled={isWorking || !tokenColorInput}
                      className="w-full py-4 rounded-xl gradient-btn text-on-primary font-headline font-extrabold text-lg shadow-xl shadow-primary-container/20 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50">
                      Deploy Multisig Vault
                    </button>
                  </div>
                </div>
                <div className="bg-surface-container-low rounded-2xl p-8 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-secondary to-secondary-container" />
                  <h3 className="text-2xl font-headline font-extrabold tracking-tight mb-2">Join Existing Multisig</h3>
                  <p className="text-on-surface-variant text-sm mb-6">Connect to an existing Midnight contract by providing the contract identifier.</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-headline font-bold text-outline mb-2">Contract Address</label>
                      <input placeholder="0x..." value={joinAddr} onChange={(e) => setJoinAddr(e.target.value)}
                        className="w-full bg-surface-container-lowest border-none rounded-xl py-4 px-5 text-on-surface font-label text-lg focus:ring-2 focus:ring-primary/50 transition-all outline-none placeholder:text-outline/40" />
                    </div>
                    <button onClick={joinContract} disabled={isWorking || !joinAddr.trim()}
                      className="w-full py-4 rounded-xl gradient-btn text-on-primary font-headline font-extrabold text-lg shadow-xl shadow-primary-container/20 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                      Join Multisig <Icon name="arrow_forward" className="text-xl" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Wallet Mode: Init Signers ──────────────────────── */}
          {mode === "wallet" && phase === "init-signers" && (
            <>
              <div className="space-y-2 mb-4">
                <h2 className="text-4xl font-headline font-extrabold tracking-tight">Add Signers</h2>
                <p className="text-on-surface-variant max-w-2xl">
                  Define the multisig participants. This ensures decentralized security for the Midnight Network protocol.
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 space-y-6">
                  {state && (
                    <div className="bg-surface-container rounded-2xl p-6">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-xs uppercase font-bold tracking-widest text-outline font-label mb-1">Configuration Status</p>
                          <h3 className="text-2xl font-headline font-bold text-primary">
                            Signers: {state.signerCount.toString()}
                            <span className="text-outline text-lg font-normal ml-2">(threshold: {state.threshold.toString()})</span>
                          </h3>
                        </div>
                        <div className="w-32 h-2 bg-surface-container-highest rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full"
                            style={{ width: `${Math.min(100, (Number(state.signerCount) / Math.max(1, Number(state.threshold) + 1)) * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="bg-surface-container rounded-2xl p-6 space-y-4">
                    <label className="block text-sm font-label font-medium text-on-surface-variant">Signer Commitment (hex)</label>
                    <div className="flex gap-3">
                      <input placeholder="0x..." value={signerCommitment} onChange={(e) => setSignerCommitment(e.target.value)}
                        className="flex-1 bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-4 font-label text-on-surface focus:outline-none focus:border-primary/50 transition-all placeholder:text-outline/40" />
                      <button onClick={addSigner} disabled={isWorking || !signerCommitment.trim()}
                        className="gradient-btn text-on-primary font-headline font-bold px-8 rounded-xl hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 whitespace-nowrap disabled:opacity-50">
                        <Icon name="person_add" className="text-sm" /> Add Signer
                      </button>
                    </div>
                  </div>
                  <SignerListCard api={api!} myCommitment={myCommitment} />
                  <div className="flex items-start gap-4 p-5 bg-tertiary-container/10 border border-tertiary-container/30 rounded-2xl">
                    <Icon name="warning" className="text-tertiary mt-1" />
                    <div className="flex flex-col gap-1">
                      <span className="font-headline font-bold text-tertiary leading-none">Security Protocol Warning</span>
                      <p className="text-sm text-on-tertiary-container/80">After finalizing, only multisig proposals can change signers.</p>
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-4 flex flex-col gap-6">
                  <IdentityCard secret={mySecret} commitment={myCommitment} />
                  <div className="mt-auto">
                    <button onClick={doFinalize} disabled={isWorking}
                      className="w-full gradient-btn text-on-primary font-headline font-extrabold py-5 rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-primary-container/20 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50">
                      <Icon name="lock" /> Finalize Configuration
                    </button>
                    <p className="text-[10px] text-center text-outline mt-3 font-label uppercase tracking-widest">Locks contract for operations</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Wallet Mode: Dashboard ─────────────────────────── */}
          {mode === "wallet" && phase === "dashboard" && (
            <>
              {walletTab === "overview" && <DashboardOverview state={state} api={api} contractAddress={contractAddress} tokenSymbol={tokenSymbol} mySecret={mySecret} myCommitment={myCommitment} onNavigate={setWalletTab} />}
              {walletTab === "deposit" && api && <DepositTab api={api} doAction={doAction} />}
              {walletTab === "propose-transfer" && api && <ProposeTransferTab api={api} doAction={doAction} />}
              {walletTab === "propose-signer" && api && <ProposeSignerTab api={api} doAction={doAction} myCommitment={myCommitment} />}
              {walletTab === "transactions" && api && <TransactionsTab api={api} doAction={doAction} />}
            </>
          )}

          {isWorking && <Spinner message={workingMsg} />}
          {txStatus && <StatusMessage message={txStatus} />}
        </main>

        <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
        <div className="fixed bottom-0 left-64 w-[300px] h-[300px] bg-secondary/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
      </div>
    </div>
  );
}
