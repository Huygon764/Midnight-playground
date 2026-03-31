import { useState, useEffect, useCallback } from "react";
import {
  type PolyPayDerivedState,
  PolyPayAPI,
  type DeployedPolyPayAPI,
} from "../../api/src/index.js";
import { PolyPay, createPolyPayPrivateState } from "../../contract/src/index.js";
import { getProviders } from "./providers.js";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";

import type { Phase, Tab } from "./types.js";
import { formatError, hexToBytes, saveSecret, loadSecret } from "./utils.js";
import { Icon, Spinner, StatusMessage } from "./components/ui.js";
import { Sidebar } from "./components/Sidebar.js";
import { PageHeader } from "./components/PageHeader.js";
import { IdentityCard } from "./components/IdentityCard.js";
import { SignerListCard } from "./components/SignerListCard.js";
import { DashboardOverview } from "./components/DashboardOverview.js";
import { MintTab } from "./components/MintTab.js";
import { ProposeTransferTab } from "./components/ProposeTransferTab.js";
import { ProposeSignerTab } from "./components/ProposeSignerTab.js";
import { TransactionsTab } from "./components/TransactionsTab.js";

export default function App() {
  const [phase, setPhase] = useState<Phase>("connect");
  const [error, setError] = useState("");
  const [api, setApi] = useState<DeployedPolyPayAPI | null>(null);
  const [state, setState] = useState<PolyPayDerivedState | null>(null);
  const [contractAddress, setContractAddress] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [workingMsg, setWorkingMsg] = useState("");
  const [txStatus, setTxStatus] = useState("");
  const [tab, setTab] = useState<Tab>("overview");

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
      const saved = loadSecret();
      if (saved) {
        await providers.privateStateProvider.set(
          "polyPayPrivateState" as any,
          createPolyPayPrivateState(saved) as any,
        );
      }
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
        await providers.privateStateProvider.set(
          "polyPayPrivateState" as any,
          createPolyPayPrivateState(saved) as any,
        );
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
      setTxStatus(`${label} -- success`);
    } catch (e) {
      console.error(`${label} failed:`, e);
      setTxStatus(`Failed: ${formatError(e)}`);
    } finally {
      setIsWorking(false);
      setWorkingMsg("");
    }
  }, []);

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
            <h1 className="font-headline font-black text-4xl tracking-tighter text-on-surface mb-2">
              PolyPay
            </h1>
            <p className="text-on-surface-variant font-body text-lg">
              Private Multisig Wallet on Midnight
            </p>
            <div className="w-full h-px bg-gradient-to-r from-transparent via-outline-variant/20 to-transparent my-10" />
            <div className="w-full space-y-4">
              <button
                onClick={connectWallet}
                className="w-full gradient-btn text-on-primary font-headline font-bold text-lg py-5 px-8 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 shadow-lg shadow-primary-container/20"
              >
                <Icon name="account_balance_wallet" />
                Connect Lace Wallet
              </button>
              <p className="text-on-surface-variant/60 font-label text-sm tracking-wide">
                SECURED BY ZERO-KNOWLEDGE PROOFS
              </p>
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

  // ─── RENDER: Connecting Phase ───────────────────────────────────────

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

  // ─── RENDER: Sidebar Layout (setup, init-signers, dashboard) ───────

  const breadcrumbMap: Record<string, string> = {
    setup: "Setup",
    "init-signers": "Add Signers",
    overview: "Dashboard",
    mint: "Mint Tokens",
    "propose-transfer": "Propose Transfer",
    "propose-signer": "Manage Signers",
    transactions: "Transactions",
  };
  const breadcrumb = phase === "dashboard" ? breadcrumbMap[tab] : breadcrumbMap[phase];

  return (
    <div className="flex min-h-screen bg-background text-on-surface font-body">
      <Sidebar
        activeTab={tab}
        onTabChange={(t) => {
          if (phase === "dashboard") {
            setTab(t);
            setTxStatus("");
          }
        }}
        address={myCommitment || undefined}
        interactive={phase === "dashboard"}
      />

      <div className="ml-64 flex-1 flex flex-col min-h-screen relative">
        <PageHeader breadcrumb={breadcrumb} />

        <main className="flex-1 p-8 max-w-5xl w-full mx-auto space-y-6">
          {/* Setup Phase */}
          {phase === "setup" && (
            <>
              <div className="space-y-2 mb-8">
                <h2 className="text-4xl font-headline font-extrabold tracking-tight">Setup PolyPay</h2>
                <p className="text-on-surface-variant max-w-2xl">
                  Deploy a new private multisig vault or join an existing contract on the Midnight Network.
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
                      <label className="block text-sm font-headline font-bold text-outline mb-2">Approval Threshold</label>
                      <input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} min="1" max="10"
                        className="w-full bg-surface-container-lowest border-none rounded-xl py-4 px-5 text-on-surface font-label text-lg focus:ring-2 focus:ring-primary/50 transition-all outline-none" />
                      <div className="mt-2 flex items-start gap-2 px-1">
                        <Icon name="info" className="text-primary text-sm mt-0.5" />
                        <p className="text-xs text-on-surface-variant">You will be added as the first signer. The threshold defines how many signatures are needed to execute transactions.</p>
                      </div>
                    </div>
                    <button onClick={deployContract} disabled={isWorking}
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
                      <div className="mt-2 flex items-center gap-2 px-1">
                        <Icon name="info" className="text-tertiary text-sm" />
                        <span className="text-xs text-on-surface-variant italic">Verify the address on the Midnight Explorer.</span>
                      </div>
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

          {/* Init Signers Phase */}
          {phase === "init-signers" && (
            <>
              <div className="space-y-2 mb-4">
                <h2 className="text-4xl font-headline font-extrabold tracking-tight">Add Signers</h2>
                <p className="text-on-surface-variant max-w-2xl">
                  Define the multisig participants who will authorize future configuration changes. This ensures decentralized security for the Midnight Network protocol.
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
                      <p className="text-sm text-on-tertiary-container/80">After finalizing, only multisig proposals can change signers. Ensure all commitments are correct before proceeding.</p>
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-4 flex flex-col gap-6">
                  <IdentityCard secret={mySecret} commitment={myCommitment} />
                  <div className="bg-surface-container-low rounded-2xl p-6">
                    <h4 className="font-headline font-bold text-on-surface mb-4 flex items-center gap-2">
                      <Icon name="gavel" className="text-primary text-sm" /> Multisig Policy
                    </h4>
                    <ul className="flex flex-col gap-3">
                      <li className="flex gap-3 text-sm"><Icon name="check_circle" className="text-outline text-lg" /><span className="text-on-surface-variant">Add all required signers before finalizing.</span></li>
                      <li className="flex gap-3 text-sm"><Icon name="check_circle" className="text-outline text-lg" /><span className="text-on-surface-variant">Threshold determines required approvals per transaction.</span></li>
                      <li className="flex gap-3 text-sm"><Icon name="check_circle" className="text-outline text-lg" /><span className="text-on-surface-variant">All signers have equal cryptographic weight.</span></li>
                    </ul>
                  </div>
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

          {/* Dashboard Phase */}
          {phase === "dashboard" && (
            <>
              {tab === "overview" && <DashboardOverview state={state} contractAddress={contractAddress} mySecret={mySecret} myCommitment={myCommitment} onNavigate={setTab} />}
              {tab === "mint" && <MintTab api={api!} doAction={doAction} />}
              {tab === "propose-transfer" && <ProposeTransferTab api={api!} doAction={doAction} />}
              {tab === "propose-signer" && <ProposeSignerTab api={api!} doAction={doAction} myCommitment={myCommitment} />}
              {tab === "transactions" && <TransactionsTab api={api!} doAction={doAction} />}
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
