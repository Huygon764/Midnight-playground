import { useState } from "react";
import type { DeployedPolyPayAPI } from "../../../api/src/index.js";
import type { DoAction } from "../types.js";
import { hexToBytes } from "../utils.js";
import { Icon } from "./ui.js";

export function ProposeTransferTab({
  api,
  vaultKey,
  doAction,
}: {
  api: DeployedPolyPayAPI;
  vaultKey: CryptoKey | null;
  doAction: DoAction;
}) {
  const [recipientCpk, setRecipientCpk] = useState("");
  const [amount, setAmount] = useState("");

  if (!vaultKey) {
    return (
      <div className="max-w-xl text-center py-12">
        <Icon name="lock" className="text-4xl text-outline mb-4 block mx-auto" />
        <h3 className="text-xl font-headline font-bold mb-2">Vault Key Required</h3>
        <p className="text-on-surface-variant">Import a vault key to create encrypted proposals.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2 mb-8">
        <h2 className="text-4xl font-headline font-extrabold tracking-tight">Propose Transfer</h2>
        <p className="text-on-surface-variant max-w-xl">
          Create an encrypted transfer proposal. Recipient and amount are hidden on-chain
          (only signers with the vault key can read them).
        </p>
      </div>

      <div className="max-w-2xl">
        <div className="bg-surface-container-low rounded-3xl p-8 space-y-6">
          <div className="space-y-3">
            <label className="text-xs font-bold font-headline uppercase tracking-widest text-outline ml-1">
              Recipient Shielded Public Key (hex)
            </label>
            <input
              placeholder="Recipient's shielded coin public key (64 hex chars)"
              value={recipientCpk}
              onChange={(e) => setRecipientCpk(e.target.value)}
              className="w-full bg-surface-container-highest border-none rounded-2xl py-5 px-6 font-label text-on-surface placeholder:text-outline/40 focus:ring-2 focus:ring-primary/50 transition-all outline-none"
            />
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold font-headline uppercase tracking-widest text-outline ml-1">
              Amount (tNIGHT)
            </label>
            <div className="relative">
              <input
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-surface-container-highest border-none rounded-2xl py-5 px-6 font-label text-2xl font-bold text-on-surface placeholder:text-outline/40 focus:ring-2 focus:ring-primary/50 transition-all outline-none"
              />
              <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-surface-container rounded-xl px-4 py-2 border border-outline-variant/20">
                <div className="w-5 h-5 rounded-full gradient-btn" />
                <span className="font-bold font-headline text-sm">tNIGHT</span>
              </div>
            </div>
          </div>

          <div className="flex gap-4 p-5 rounded-2xl bg-surface-container-high/50 border border-primary/10">
            <Icon name="lock" className="text-primary" />
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Proposal data is encrypted with the vault key. Only signers who have the
              vault key can see recipient and amount. On-chain observers see only encrypted bytes.
            </p>
          </div>

          <button
            onClick={() => {
              const cpkBytes = hexToBytes(recipientCpk);
              if (cpkBytes.length !== 32) {
                alert("Recipient public key must be 32 bytes (64 hex characters)");
                return;
              }
              doAction("Propose Transfer", () =>
                api.proposeTransfer(cpkBytes, BigInt(amount), vaultKey),
              );
            }}
            disabled={!recipientCpk || !amount}
            className="w-full py-5 rounded-2xl gradient-btn text-on-primary font-bold text-lg hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            Propose Encrypted Transfer
          </button>
        </div>
      </div>
    </>
  );
}
