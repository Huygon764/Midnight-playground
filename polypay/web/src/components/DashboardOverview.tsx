import { useState, useEffect, useCallback } from "react";
import type { PolyPayDerivedState, DeployedPolyPayAPI } from "../../../api/src/index.js";
import { utils } from "../../../api/src/index.js";
import type { WalletTab } from "../types.js";
import { truncateHex } from "../utils.js";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";
import { Icon, CopyButton } from "./ui.js";
import { IdentityCard } from "./IdentityCard.js";
import { getIndexerUri } from "../providers.js";

export function DashboardOverview({
  state,
  api,
  contractAddress,
  tokenSymbol,
  mySecret,
  myCommitment,
  onNavigate,
}: {
  state: PolyPayDerivedState | null;
  api: DeployedPolyPayAPI | null;
  contractAddress: string;
  tokenSymbol: string;
  mySecret: string;
  myCommitment: string;
  onNavigate: (tab: WalletTab) => void;
}) {
  const [vaultBalance, setVaultBalance] = useState("--");

  const colorHex = state ? toHex(state.tokenColor) : "";
  const hasColor = colorHex && colorHex !== "0".repeat(64);

  const refreshBalance = useCallback(async () => {
    if (!api || !hasColor) return;
    try {
      const indexerUri = getIndexerUri();
      const balances = await utils.queryVaultBalance(indexerUri, api.deployedContractAddress);
      console.log("[vaultBalance] direct GraphQL:", balances);
      const entry = balances.find((b) => b.tokenType === colorHex);
      setVaultBalance(entry ? entry.balance.toString() : "0");
    } catch (err) {
      console.error("[vaultBalance] error:", err);
      setVaultBalance("?");
    }
  }, [api, hasColor, colorHex]);

  useEffect(() => {
    refreshBalance();
    const interval = setInterval(refreshBalance, 10_000);
    return () => clearInterval(interval);
  }, [refreshBalance]);

  return (
    <>
      {/* Stats Row */}
      {state && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-surface-container-low p-6 rounded-2xl flex flex-col gap-2 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 opacity-10">
              <Icon name="account_balance" className="text-6xl" />
            </div>
            <span className="text-outline text-xs font-label tracking-wider uppercase">
              Vault Balance
            </span>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl font-headline font-extrabold text-on-surface tracking-tight">
                {vaultBalance}
              </h2>
              <span className="text-primary font-label font-bold">{tokenSymbol || "tokens"}</span>
            </div>
          </div>

          <div className="bg-surface-container-low p-6 rounded-2xl flex flex-col gap-2">
            <span className="text-outline text-xs font-label tracking-wider uppercase">
              Signer Count
            </span>
            <h2 className="text-3xl font-headline font-extrabold text-on-surface tracking-tight">
              {state.signerCount.toString()}
            </h2>
          </div>

          <div className="bg-surface-container-low p-6 rounded-2xl flex flex-col gap-2">
            <span className="text-outline text-xs font-label tracking-wider uppercase">
              Threshold
            </span>
            <h2 className="text-3xl font-headline font-extrabold text-on-surface tracking-tight">
              {state.threshold.toString()}/{state.signerCount.toString()}
            </h2>
            <div className="w-full bg-surface-container-highest h-1.5 rounded-full mt-1">
              <div
                className="bg-primary h-full rounded-full shadow-[0_0_12px_rgba(208,188,255,0.4)]"
                style={{
                  width: `${(Number(state.threshold) / Math.max(1, Number(state.signerCount))) * 100}%`,
                }}
              />
            </div>
          </div>

          <div className="bg-surface-container-low p-6 rounded-2xl flex flex-col gap-4 justify-center items-start border border-emerald-500/10">
            <span className="text-outline text-xs font-label tracking-wider uppercase">
              Status
            </span>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
              <Icon name="check_circle" filled className="text-sm" />
              <span className="text-sm font-bold font-headline">Finalized</span>
            </div>
          </div>
        </div>
      )}

      {/* Contract Address */}
      {contractAddress && (
        <div className="bg-surface-container rounded-2xl p-4 flex items-center gap-3 mb-6">
          <Icon name="description" className="text-outline" />
          <span className="text-xs font-label text-outline uppercase tracking-wider">
            Contract:
          </span>
          <span className="font-label text-sm text-secondary">{truncateHex(contractAddress)}</span>
          <CopyButton text={contractAddress} />
        </div>
      )}

      {/* Quick Actions */}
      <div className="mb-8 flex flex-wrap gap-4">
        <button
          onClick={() => onNavigate("deposit")}
          className="gradient-btn px-6 py-3 rounded-xl font-headline font-bold text-on-primary flex items-center gap-2 shadow-lg shadow-primary-container/20 active:scale-95 transition-transform"
        >
          <Icon name="savings" />
          Deposit
        </button>
        <button
          onClick={() => onNavigate("propose-transfer")}
          className="bg-surface-container-highest hover:bg-surface-bright px-6 py-3 rounded-xl font-headline font-bold text-on-surface flex items-center gap-2 border border-outline-variant/30 active:scale-95 transition-all"
        >
          <Icon name="send_money" />
          Propose Transfer
        </button>
        <button
          onClick={() => onNavigate("propose-signer")}
          className="bg-surface-container-highest hover:bg-surface-bright px-6 py-3 rounded-xl font-headline font-bold text-on-surface flex items-center gap-2 border border-outline-variant/30 active:scale-95 transition-all"
        >
          <Icon name="group_add" />
          Manage Signers
        </button>
      </div>

      <IdentityCard secret={mySecret} commitment={myCommitment} />
    </>
  );
}
