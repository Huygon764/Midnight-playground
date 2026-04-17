import { useState } from "react";
import type { DeployedMPayAPI } from "../../../api/src/index.js";
import type { DoAction } from "../types.js";
import { hexToBytes } from "../utils.js";
import { Icon } from "./ui.js";

export function DepositTab({
  api,
  tokenColor,
  doAction,
}: {
  api: DeployedMPayAPI;
  tokenColor: string;
  doAction: DoAction;
}) {
  const [amount, setAmount] = useState("");
  return (
    <>
      <div className="space-y-2 mb-8">
        <h2 className="text-4xl font-headline font-extrabold tracking-tight">
          Deposit <span className="text-primary">to Vault</span>
        </h2>
        <p className="text-on-surface-variant max-w-xl">
          Deposit shielded MPAY tokens from your wallet into the multisig vault.
          Your deposit source remains private (shielded UTXO unlinkable).
        </p>
      </div>

      <div className="max-w-xl">
        <div className="glass-panel p-8 rounded-[2rem] border border-outline-variant/10 shadow-2xl space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-2xl font-headline font-bold text-on-surface">Vault Deposit</h3>
              <p className="text-sm text-outline">Transfer shielded MPAY to multisig vault</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-surface-container-highest flex items-center justify-center">
              <Icon name="savings" className="text-primary" />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-bold text-on-surface uppercase tracking-widest font-label">
              Amount
            </label>
            <div className="relative">
              <input
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1"
                className="w-full bg-surface-container-highest border-none rounded-2xl py-6 px-6 text-3xl font-label focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-outline/30 outline-none"
              />
              <div className="absolute right-6 top-1/2 -translate-y-1/2">
                <span className="font-headline font-bold text-primary">MPAY</span>
              </div>
            </div>
          </div>

          <div className="flex gap-4 p-4 rounded-xl bg-surface-container-high/50 border border-primary/10">
            <Icon name="info" className="text-primary" />
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Tokens deposited into the vault can only be withdrawn through multisig proposals
              approved by the required threshold of signers. Deposit source is shielded.
            </p>
          </div>

          <button
            onClick={() => {
              const parsed = Math.floor(Number(amount));
              if (parsed <= 0 || isNaN(parsed)) {
                alert("Amount must be a positive integer (atomic units)");
                return;
              }
              if (!tokenColor) {
                alert("Token color not set — deploy the token contract first");
                return;
              }
              const nonce = new Uint8Array(32);
              crypto.getRandomValues(nonce);
              const coin = {
                nonce,
                color: hexToBytes(tokenColor),
                value: BigInt(parsed),
              };
              doAction("Deposit", async () => {
                await api.deposit(coin);
                setAmount("");
              });
            }}
            disabled={!amount || !tokenColor}
            className="w-full gradient-btn py-5 rounded-2xl text-on-primary font-headline font-extrabold text-xl tracking-tight shadow-xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <Icon name="savings" filled />
            Deposit to Vault
          </button>
        </div>
      </div>
    </>
  );
}
