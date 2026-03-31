import { useState } from "react";
import type { DeployedPolyPayAPI } from "../../../api/src/index.js";
import type { DoAction } from "../types.js";
import { hexToBytes } from "../utils.js";
import { SignerListCard } from "./SignerListCard.js";

export function ProposeSignerTab({
  api,
  doAction,
  myCommitment,
}: {
  api: DeployedPolyPayAPI;
  doAction: DoAction;
  myCommitment: string;
}) {
  const [commitment, setCommitment] = useState("");
  const [newThreshold, setNewThreshold] = useState("");
  return (
    <>
      <div className="space-y-2 mb-8">
        <h2 className="text-4xl font-headline font-extrabold tracking-tight">
          Propose Signer Change
        </h2>
        <p className="text-on-surface-variant max-w-xl">
          Adjust the multisig authority structure. All proposals require approval from the defined
          threshold of signers.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          {/* Add / Remove Signer */}
          <div className="bg-surface-container-low rounded-3xl p-8 space-y-6">
            <div className="space-y-2">
              <label className="block font-label text-sm text-secondary tracking-wider">
                COMMITMENT HEX
              </label>
              <input
                placeholder="0x..."
                value={commitment}
                onChange={(e) => setCommitment(e.target.value)}
                className="w-full bg-surface-container-highest border-none rounded-2xl py-4 px-6 font-label text-on-surface placeholder:text-outline/50 focus:ring-2 focus:ring-primary/50 transition-all outline-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  doAction("Propose Add Signer", () =>
                    api.proposeAddSigner(hexToBytes(commitment)),
                  );
                  setCommitment("");
                }}
                disabled={!commitment}
                className="flex-1 gradient-btn py-4 rounded-xl font-headline font-extrabold text-on-primary shadow-lg hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                Propose Add
              </button>
              <button
                onClick={() => {
                  doAction("Propose Remove Signer", () =>
                    api.proposeRemoveSigner(hexToBytes(commitment)),
                  );
                  setCommitment("");
                }}
                disabled={!commitment}
                className="flex-1 py-4 rounded-xl font-headline font-extrabold text-error border border-error/30 hover:bg-error/10 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                Propose Remove
              </button>
            </div>
          </div>

          {/* Set Threshold */}
          <div className="bg-surface-container-low rounded-3xl p-8 space-y-4">
            <label className="block font-label text-sm text-secondary tracking-wider">
              SET THRESHOLD
            </label>
            <div className="flex gap-3">
              <input
                type="number"
                placeholder="New threshold"
                value={newThreshold}
                onChange={(e) => setNewThreshold(e.target.value)}
                min="1"
                max="10"
                className="flex-1 bg-surface-container-highest border-none rounded-2xl py-4 px-6 font-label text-on-surface placeholder:text-outline/50 focus:ring-2 focus:ring-primary/50 transition-all outline-none"
              />
              <button
                onClick={() =>
                  doAction("Propose Set Threshold", () =>
                    api.proposeSetThreshold(BigInt(newThreshold)),
                  )
                }
                disabled={!newThreshold}
                className="gradient-btn px-8 py-4 rounded-xl font-headline font-bold text-on-primary hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                Propose
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <SignerListCard api={api} myCommitment={myCommitment} />
        </div>
      </div>
    </>
  );
}
