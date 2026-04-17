import { useState } from "react";
import type { DeployedTokenAPI } from "../../../api/src/index.js";
import type { DoAction } from "../types.js";
import { truncateHex, hexToBytes } from "../utils.js";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";
import { Icon, CopyButton } from "./ui.js";

export function TokenPage({
  tokenApi,
  tokenAddress,
  tokenColor,
  myAddress,
  myShieldedCpk,
  isWorking,
  doAction,
  onDeploy,
  onMint,
}: {
  tokenApi: DeployedTokenAPI | null;
  tokenAddress: string;
  tokenColor: string;
  myAddress: string;
  myShieldedCpk: string;
  isWorking: boolean;
  doAction: DoAction;
  onDeploy: () => void;
  onMint: (amount: bigint, recipientPk: Uint8Array) => void;
}) {
  const [mintAmount, setMintAmount] = useState("");
  const [mintRecipientPk, setMintRecipientPk] = useState("");

  if (!tokenAddress) {
    return (
      <>
        <div className="space-y-2 mb-8">
          <h2 className="text-4xl font-headline font-extrabold tracking-tight">Shielded Token</h2>
          <p className="text-on-surface-variant max-w-xl">
            Deploy a shielded token contract. Tokens are minted as shielded coins
            using mintShieldedToken — amounts and recipients are private.
          </p>
        </div>
        <div className="max-w-md">
          <div className="bg-surface-container-low rounded-2xl p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-surface-container-highest flex items-center justify-center">
                <Icon name="token" className="text-primary text-xl" />
              </div>
              <div>
                <h3 className="text-xl font-headline font-bold">Deploy Token Contract</h3>
                <p className="text-xs text-outline">Creates shielded custom token</p>
              </div>
            </div>
            <button onClick={onDeploy} disabled={isWorking}
              className="w-full py-4 rounded-xl gradient-btn text-on-primary font-headline font-extrabold text-lg disabled:opacity-50">
              Deploy Shielded Token
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-2 mb-8">
        <h2 className="text-4xl font-headline font-extrabold tracking-tight">Shielded Token</h2>
        <p className="text-on-surface-variant max-w-xl">
          Mint shielded tokens and manage your token contract.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Token Info */}
        <div className="bg-surface-container-low rounded-2xl p-8 space-y-4">
          <h3 className="text-xl font-headline font-bold">Token Info</h3>
          <div className="space-y-3">
            <div>
              <span className="text-xs text-outline uppercase tracking-wider font-label">Type</span>
              <p className="text-sm font-bold text-primary">Shielded (mintShieldedToken)</p>
            </div>
            <div>
              <span className="text-xs text-outline uppercase tracking-wider font-label">Contract</span>
              <div className="flex items-center gap-2">
                <p className="text-sm text-secondary">{truncateHex(tokenAddress)}</p>
                <CopyButton text={tokenAddress} />
              </div>
            </div>
            {tokenColor && (
              <div>
                <span className="text-xs text-outline uppercase tracking-wider font-label">Token Color</span>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-on-surface break-all">{truncateHex(tokenColor)}</p>
                  <CopyButton text={tokenColor} />
                </div>
                <p className="text-[10px] text-outline mt-1">Use this color when deploying multisig</p>
              </div>
            )}
          </div>
        </div>

        {/* Mint */}
        <div className="bg-surface-container-low rounded-2xl p-8 space-y-4">
          <h3 className="text-xl font-headline font-bold">Mint Shielded Tokens</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-headline font-bold text-outline mb-1">Amount</label>
              <input type="number" placeholder="1000" value={mintAmount} onChange={(e) => setMintAmount(e.target.value)} min="1"
                className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-label focus:ring-2 focus:ring-primary/50 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-xs font-headline font-bold text-outline mb-1">Recipient Shielded Coin Public Key (hex)</label>
              <input placeholder="64 hex chars" value={mintRecipientPk} onChange={(e) => setMintRecipientPk(e.target.value)}
                className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-label text-sm focus:ring-2 focus:ring-primary/50 transition-all outline-none placeholder:text-outline/40" />
              {myShieldedCpk && !mintRecipientPk && (
                <button onClick={() => setMintRecipientPk(myShieldedCpk)} className="mt-1 text-xs text-primary hover:underline">
                  Use my shielded key
                </button>
              )}
            </div>
            <div className="flex gap-4 p-3 rounded-xl bg-surface-container-high/50 border border-primary/10">
              <Icon name="info" className="text-primary text-sm" />
              <p className="text-xs text-on-surface-variant">
                Tokens are minted as shielded coins sent directly to the recipient's wallet.
                The recipient needs to sync their wallet to see the coins.
              </p>
            </div>
            <button
              onClick={() => {
                const pk = hexToBytes(mintRecipientPk);
                if (pk.length !== 32) {
                  alert("Recipient PK must be 32 bytes (64 hex chars)");
                  return;
                }
                onMint(BigInt(Math.floor(Number(mintAmount))), pk);
              }}
              disabled={isWorking || !mintAmount || !mintRecipientPk}
              className="w-full py-3 rounded-xl gradient-btn text-on-primary font-headline font-bold disabled:opacity-50">
              Mint Shielded Tokens
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
