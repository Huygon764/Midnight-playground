import { useState } from "react";
import type { DeployedPolyPayAPI } from "../../../api/src/index.js";
import type { DoAction } from "../types.js";
import { hexToBytes } from "../utils.js";
import { Icon } from "./ui.js";

export function ProposeTransferTab({
  api,
  doAction,
}: {
  api: DeployedPolyPayAPI;
  doAction: DoAction;
}) {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  return (
    <>
      <div className="space-y-2 mb-8">
        <h2 className="text-4xl font-headline font-extrabold tracking-tight">Propose Transfer</h2>
        <p className="text-on-surface-variant max-w-xl">
          Initiate a secure, multi-signature transaction across the Midnight privacy network. All
          proposals require consensus from the defined threshold of signers.
        </p>
      </div>

      <div className="max-w-2xl">
        <div className="bg-surface-container-low rounded-3xl p-8 space-y-6">
          <div className="space-y-3">
            <label className="text-xs font-bold font-headline uppercase tracking-widest text-outline ml-1">
              Recipient Address (Bytes&lt;32&gt;)
            </label>
            <input
              placeholder="0x..."
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full bg-surface-container-highest border-none rounded-2xl py-5 px-6 font-label text-on-surface placeholder:text-outline/40 focus:ring-2 focus:ring-primary/50 transition-all outline-none"
            />
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold font-headline uppercase tracking-widest text-outline ml-1">
              Amount
            </label>
            <div className="relative">
              <input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-surface-container-highest border-none rounded-2xl py-5 px-6 font-label text-2xl font-bold text-on-surface placeholder:text-outline/40 focus:ring-2 focus:ring-primary/50 transition-all outline-none"
              />
              <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-surface-container rounded-xl px-4 py-2 border border-outline-variant/20">
                <div className="w-5 h-5 rounded-full gradient-btn" />
                <span className="font-bold font-headline text-sm">DUST</span>
              </div>
            </div>
          </div>

          <div className="flex gap-4 p-5 rounded-2xl bg-surface-container-high/50 border border-primary/10">
            <Icon name="info" className="text-primary" />
            <p className="text-sm text-on-surface-variant leading-relaxed">
              This will create a proposal. Other signers must approve before execution. Your
              transaction will remain private until final settlement.
            </p>
          </div>

          <button
            onClick={() =>
              doAction("Propose Transfer", () => api.proposeTransfer(hexToBytes(to), BigInt(amount)))
            }
            disabled={!to || !amount}
            className="w-full py-5 rounded-2xl gradient-btn text-on-primary font-bold text-lg hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            Propose Transaction
          </button>
        </div>
      </div>
    </>
  );
}
