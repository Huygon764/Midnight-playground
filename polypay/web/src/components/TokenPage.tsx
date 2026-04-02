import { useState, useEffect, useCallback } from "react";
import type { DeployedTokenAPI } from "../../../api/src/index.js";
import type { TokenTab, DoAction } from "../types.js";
import { truncateHex, hexToBytes, decodeBech32mAddress } from "../utils.js";
import { Icon, CopyButton } from "./ui.js";
import { getConnectedAPI } from "../providers.js";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";

export function TokenPage({
  tab,
  tokenApi,
  tokenAddress,
  tokenColor,
  tokenName,
  tokenSymbol,
  myAddress,
  isWorking,
  doAction,
  onDeploy,
  onNameChange,
  onSymbolChange,
}: {
  tab: TokenTab;
  tokenApi: DeployedTokenAPI | null;
  tokenAddress: string;
  tokenColor: string;
  tokenName: string;
  tokenSymbol: string;
  myAddress: string;
  isWorking: boolean;
  doAction: DoAction;
  onDeploy: () => void;
  onNameChange: (name: string) => void;
  onSymbolChange: (symbol: string) => void;
}) {
  if (!tokenAddress) {
    return (
      <TokenDeploy
        isWorking={isWorking}
        tokenName={tokenName}
        tokenSymbol={tokenSymbol}
        onNameChange={onNameChange}
        onSymbolChange={onSymbolChange}
        onDeploy={onDeploy}
      />
    );
  }

  return (
    <>
      {tab === "token-info" && (
        <TokenInfo tokenApi={tokenApi} tokenAddress={tokenAddress} tokenColor={tokenColor} tokenName={tokenName} tokenSymbol={tokenSymbol} />
      )}
      {tab === "token-mint" && tokenApi && (
        <TokenMint tokenApi={tokenApi} tokenSymbol={tokenSymbol} myAddress={myAddress} doAction={doAction} />
      )}
    </>
  );
}

function TokenDeploy({
  isWorking,
  tokenName,
  tokenSymbol,
  onNameChange,
  onSymbolChange,
  onDeploy,
}: {
  isWorking: boolean;
  tokenName: string;
  tokenSymbol: string;
  onNameChange: (name: string) => void;
  onSymbolChange: (symbol: string) => void;
  onDeploy: () => void;
}) {
  return (
    <>
      <div className="space-y-2 mb-8">
        <h2 className="text-4xl font-headline font-extrabold tracking-tight">Deploy Token</h2>
        <p className="text-on-surface-variant max-w-2xl">
          Deploy a native token contract on the Midnight Network. This creates a new token type
          that can be minted and transferred on the ledger.
        </p>
      </div>

      <div className="max-w-xl">
        <div className="bg-surface-container-low rounded-2xl p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-tertiary to-tertiary-container" />

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-headline font-bold text-outline mb-2">Token Name</label>
                <input
                  value={tokenName}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder="e.g. PolyPay Token"
                  className="w-full bg-surface-container-lowest border-none rounded-xl py-4 px-5 text-on-surface font-label focus:ring-2 focus:ring-primary/50 transition-all outline-none placeholder:text-outline/40"
                />
              </div>
              <div>
                <label className="block text-sm font-headline font-bold text-outline mb-2">Symbol</label>
                <input
                  value={tokenSymbol}
                  onChange={(e) => onSymbolChange(e.target.value)}
                  placeholder="e.g. POLY"
                  className="w-full bg-surface-container-lowest border-none rounded-xl py-4 px-5 text-on-surface font-label focus:ring-2 focus:ring-primary/50 transition-all outline-none placeholder:text-outline/40"
                />
              </div>
            </div>
            <div className="flex gap-4 p-4 rounded-xl bg-surface-container/50">
              <Icon name="info" className="text-primary mt-0.5" />
              <p className="text-sm text-on-surface-variant">
                Deploying creates the token type on the ledger. After deployment, you can mint
                tokens to any wallet address.
              </p>
            </div>
            <button
              onClick={onDeploy}
              disabled={isWorking || !tokenName || !tokenSymbol}
              className="w-full py-4 rounded-xl gradient-btn text-on-primary font-headline font-extrabold text-lg shadow-xl shadow-primary-container/20 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              Deploy Token Contract
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function TokenInfo({
  tokenApi,
  tokenAddress,
  tokenColor,
  tokenName,
  tokenSymbol,
}: {
  tokenApi: DeployedTokenAPI | null;
  tokenAddress: string;
  tokenColor: string;
  tokenName: string;
  tokenSymbol: string;
}) {
  const [totalMinted, setTotalMinted] = useState<string>("--");
  const [walletBalance, setWalletBalance] = useState<string>("--");

  const refresh = useCallback(async () => {
    if (tokenApi) {
      try {
        const minted = await tokenApi.getTotalMinted();
        setTotalMinted(minted.toString());
      } catch {
        setTotalMinted("?");
      }
    }
    if (tokenColor) {
      if (tokenColor) {
        try {
          const walletApi = getConnectedAPI();
          const balances = await walletApi.getUnshieldedBalances();
          const bal = balances[tokenColor] ?? 0n;
          setWalletBalance(bal.toString());
        } catch {
          setWalletBalance("?");
        }
      }
    }
  }, [tokenApi, tokenColor]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <>
      <div className="space-y-2 mb-8">
        <h2 className="text-4xl font-headline font-extrabold tracking-tight">
          {tokenName} <span className="text-primary">({tokenSymbol})</span>
        </h2>
        <p className="text-on-surface-variant max-w-xl">
          Native unshielded token deployed on the Midnight Network.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-surface-container-low p-6 rounded-2xl flex flex-col gap-2">
          <span className="text-outline text-xs font-label tracking-wider uppercase">Type</span>
          <div className="inline-flex items-center gap-2 text-on-surface">
            <Icon name="visibility" className="text-secondary text-sm" />
            <span className="font-headline font-bold">Unshielded</span>
          </div>
        </div>
        <div className="bg-surface-container-low p-6 rounded-2xl flex flex-col gap-2">
          <span className="text-outline text-xs font-label tracking-wider uppercase">Total Minted</span>
          <h2 className="text-2xl font-headline font-extrabold text-on-surface tracking-tight">
            {totalMinted} <span className="text-primary text-sm font-label">{tokenSymbol}</span>
          </h2>
        </div>
        <div className="bg-surface-container-low p-6 rounded-2xl flex flex-col gap-2">
          <span className="text-outline text-xs font-label tracking-wider uppercase">Your Wallet Balance</span>
          <h2 className="text-2xl font-headline font-extrabold text-on-surface tracking-tight">
            {walletBalance} <span className="text-primary text-sm font-label">{tokenSymbol}</span>
          </h2>
        </div>
      </div>

      {/* Refresh */}
      <div className="mb-6">
        <button onClick={refresh} className="text-xs font-label text-outline hover:text-primary transition-colors flex items-center gap-1">
          <Icon name="refresh" className="text-sm" /> Refresh balances
        </button>
      </div>

      {/* Contract details */}
      <div className="max-w-2xl space-y-4">
        <div className="bg-surface-container-low rounded-2xl p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-label uppercase tracking-widest text-outline">
              Contract Address
            </label>
            <div className="flex items-center gap-2 bg-surface-container rounded-xl px-4 py-3">
              <span className="font-label text-sm text-on-surface truncate flex-1">
                {tokenAddress}
              </span>
              <CopyButton text={tokenAddress} />
            </div>
          </div>
          {tokenColor && (
            <div className="space-y-2">
              <label className="text-xs font-label uppercase tracking-widest text-outline">
                Token Color (used by multisig contract)
              </label>
              <div className="flex items-center gap-2 bg-surface-container rounded-xl px-4 py-3">
                <span className="font-label text-sm text-on-surface truncate flex-1">
                  {tokenColor}
                </span>
                <CopyButton text={tokenColor} />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-start gap-4 p-5 bg-primary/5 border border-primary/10 rounded-2xl">
          <Icon name="lightbulb" className="text-primary mt-0.5" />
          <p className="text-sm text-on-surface-variant">
            Use the <strong>Mint</strong> tab to create tokens. Then switch to{" "}
            <strong>Multisig</strong> mode to deposit tokens into a vault.
          </p>
        </div>
      </div>
    </>
  );
}

function TokenMint({
  tokenApi,
  tokenSymbol,
  myAddress,
  doAction,
}: {
  tokenApi: DeployedTokenAPI;
  tokenSymbol: string;
  myAddress: string;
  doAction: DoAction;
}) {
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState(myAddress);

  return (
    <>
      <div className="space-y-2 mb-8">
        <h2 className="text-4xl font-headline font-extrabold tracking-tight">
          Mint Tokens
        </h2>
        <p className="text-on-surface-variant max-w-xl">
          Mint native POLY tokens directly to a wallet address on the Midnight ledger.
        </p>
      </div>

      <div className="max-w-xl">
        <div className="glass-panel p-8 rounded-[2rem] border border-outline-variant/10 shadow-2xl space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-2xl font-headline font-bold text-on-surface">Token Issuance</h3>
              <p className="text-sm text-outline">Mint to any Midnight wallet address</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-surface-container-highest flex items-center justify-center">
              <Icon name="token" className="text-primary" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold font-headline uppercase tracking-widest text-outline ml-1">
                Recipient Address
              </label>
              {myAddress && (
                <button
                  type="button"
                  onClick={() => setRecipient(myAddress)}
                  className="text-xs font-label text-primary hover:underline"
                >
                  Use my address
                </button>
              )}
            </div>
            <input
              placeholder="Midnight address (mn_addr_preprod1...)"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full bg-surface-container-highest border-none rounded-2xl py-4 px-6 font-label text-sm text-on-surface placeholder:text-outline/40 focus:ring-2 focus:ring-primary/50 transition-all outline-none"
            />
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
                <span className="font-headline font-bold text-primary">{tokenSymbol}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              const toBytes = decodeBech32mAddress(recipient);
              if (!toBytes) {
                alert("Invalid address. Paste a Midnight address (mn_addr_preprod1...)");
                return;
              }
              doAction("Mint", () => tokenApi.mint(BigInt(amount), toBytes));
            }}
            disabled={!amount || !recipient}
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
