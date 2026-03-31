import { useState } from "react";
import type { DeployedPolyPayAPI } from "../../../api/src/index.js";
import type { DoAction } from "../types.js";
import { Icon } from "./ui.js";

export function MintTab({
  api,
  doAction,
}: {
  api: DeployedPolyPayAPI;
  doAction: DoAction;
}) {
  const [amount, setAmount] = useState("");
  return (
    <>
      <div className="space-y-2 mb-8">
        <h2 className="text-4xl font-headline font-extrabold tracking-tight">
          Mint Tokens <span className="text-primary">to Vault</span>
        </h2>
        <p className="text-on-surface-variant max-w-xl">
          PolyPay tokens are issued directly into the privacy-shielded vault. Max 65,535 per
          transaction.
        </p>
      </div>

      <div className="max-w-xl">
        <div className="glass-panel p-8 rounded-[2rem] border border-outline-variant/10 shadow-2xl space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-2xl font-headline font-bold text-on-surface">Token Issuance</h3>
              <p className="text-sm text-outline">Configure your minting parameters</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-surface-container-highest flex items-center justify-center">
              <Icon name="token" className="text-primary" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-bold text-on-surface uppercase tracking-widest font-label">
                Amount
              </label>
              <span className="text-xs font-label text-outline">Max: 65,535</span>
            </div>
            <div className="relative">
              <input
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1"
                max="65535"
                className="w-full bg-surface-container-highest border-none rounded-2xl py-6 px-6 text-3xl font-label focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-outline/30 outline-none"
              />
              <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-3">
                <span className="font-headline font-bold text-primary">POLY</span>
                <button
                  type="button"
                  onClick={() => setAmount("65535")}
                  className="px-3 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-bold uppercase hover:bg-primary/20 transition-colors"
                >
                  Max
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={() => doAction("Mint", () => api.mint(BigInt(amount)))}
            disabled={!amount}
            className="w-full gradient-btn py-5 rounded-2xl text-on-primary font-headline font-extrabold text-xl tracking-tight shadow-xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <Icon name="bolt" filled />
            Mint Tokens
          </button>
        </div>
      </div>
    </>
  );
}
