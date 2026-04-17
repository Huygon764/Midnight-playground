import { useState } from "react";
import type { DeployedTokenAPI } from "../../../api/src/index.js";
import type { DoAction } from "../types.js";
import { truncateHex, hexToBytes } from "../utils.js";
import { MidnightBech32m, ShieldedAddress } from "@midnight-ntwrk/wallet-sdk-address-format";
import { Icon, CopyButton } from "./ui.js";

const NETWORK_ID = (import.meta.env.VITE_NETWORK_ID ?? "preprod") as string;

function parseRecipientAddress(input: string): Uint8Array {
  const trimmed = input.trim();
  if (trimmed.startsWith("mn_shield-addr_")) {
    const parsed = MidnightBech32m.parse(trimmed);
    const decoded = parsed.decode(ShieldedAddress, NETWORK_ID as any);
    return new Uint8Array(decoded.coinPublicKey.data);
  }
  const bytes = hexToBytes(trimmed);
  if (bytes.length !== 32) {
    throw new Error("Recipient must be a shielded address (mn_shield-addr_...) or 32-byte hex");
  }
  return bytes;
}

export function TokenPage({
  tokenApi: _tokenApi,
  tokenAddress,
  tokenColor,
  myAddress: _myAddress,
  myShieldedAddress,
  isWorking,
  doAction: _doAction,
  onDeploy,
  onJoin,
  onMint,
}: {
  tokenApi: DeployedTokenAPI | null;
  tokenAddress: string;
  tokenColor: string;
  myAddress: string;
  myShieldedAddress: string;
  isWorking: boolean;
  doAction: DoAction;
  onDeploy: () => void;
  onJoin: (address: string) => void;
  onMint: (amount: bigint, recipientPk: Uint8Array) => void;
}) {
  const [mintAmount, setMintAmount] = useState("");
  const [mintRecipient, setMintRecipient] = useState("");
  const [joinAddr, setJoinAddr] = useState("");

  if (!tokenAddress) {
    return (
      <>
        <div className="space-y-2 mb-8">
          <h2 className="text-4xl font-headline font-extrabold tracking-tight">Shielded Token</h2>
          <p className="text-on-surface-variant max-w-xl">
            Deploy a new shielded token contract, or reconnect to a previously deployed one.
            Tokens are minted as shielded coins — amounts and recipients are private.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
          <div className="bg-surface-container-low rounded-2xl p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-surface-container-highest flex items-center justify-center">
                <Icon name="token" className="text-primary text-xl" />
              </div>
              <div>
                <h3 className="text-xl font-headline font-bold">Deploy New</h3>
                <p className="text-xs text-outline">Creates a fresh shielded token contract</p>
              </div>
            </div>
            <button onClick={onDeploy} disabled={isWorking}
              className="w-full py-4 rounded-xl gradient-btn text-on-primary font-headline font-extrabold text-lg disabled:opacity-50">
              Deploy Shielded Token
            </button>
          </div>

          <div className="bg-surface-container-low rounded-2xl p-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-surface-container-highest flex items-center justify-center">
                <Icon name="link" className="text-secondary text-xl" />
              </div>
              <div>
                <h3 className="text-xl font-headline font-bold">Reconnect Existing</h3>
                <p className="text-xs text-outline">Paste a token contract address</p>
              </div>
            </div>
            <input
              placeholder="0x..."
              value={joinAddr}
              onChange={(e) => setJoinAddr(e.target.value)}
              className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-label text-sm focus:ring-2 focus:ring-primary/50 transition-all outline-none placeholder:text-outline/40"
            />
            <button
              onClick={() => onJoin(joinAddr.trim())}
              disabled={isWorking || !joinAddr.trim()}
              className="w-full py-4 rounded-xl bg-surface-container-highest hover:bg-surface-bright text-on-surface font-headline font-bold text-lg border border-outline-variant/30 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              Reconnect <Icon name="arrow_forward" className="text-sm" />
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
              <label className="block text-xs font-headline font-bold text-outline mb-1">Recipient Address</label>
              <input placeholder="mn_shield-addr_preprod1... or 32-byte hex"
                value={mintRecipient} onChange={(e) => setMintRecipient(e.target.value)}
                className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-label text-sm focus:ring-2 focus:ring-primary/50 transition-all outline-none placeholder:text-outline/40" />
              {myShieldedAddress && !mintRecipient && (
                <button onClick={() => setMintRecipient(myShieldedAddress)} className="mt-1 text-xs text-primary hover:underline">
                  Use my shielded address
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
                let pk: Uint8Array;
                try {
                  pk = parseRecipientAddress(mintRecipient);
                } catch (e) {
                  alert((e as Error).message);
                  return;
                }
                onMint(BigInt(Math.floor(Number(mintAmount))), pk);
              }}
              disabled={isWorking || !mintAmount || !mintRecipient}
              className="w-full py-3 rounded-xl gradient-btn text-on-primary font-headline font-bold disabled:opacity-50">
              Mint Shielded Tokens
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
