import { useState, useEffect, useCallback } from "react";
import type { DeployedMPayAPI } from "../../../api/src/index.js";
import type { DoAction } from "../types.js";
import { truncateHex } from "../utils.js";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";
import { MidnightBech32m, ShieldedAddress } from "@midnight-ntwrk/wallet-sdk-address-format";
import { Icon } from "./ui.js";

const NETWORK_ID = (import.meta.env.VITE_NETWORK_ID ?? "preprod") as string;

// Parse a bech32m shielded address into raw coin + encryption public keys.
// We need BOTH because encrypted proposal data stores them so the recipient
// address can be fully reconstructed for display later.
function parseRecipient(input: string): { cpk: Uint8Array; epk: Uint8Array } {
  const trimmed = input.trim();
  if (!trimmed.startsWith("mn_shield-addr_")) {
    throw new Error("Recipient must be a shielded address (mn_shield-addr_...)");
  }
  const parsed = MidnightBech32m.parse(trimmed);
  const decoded = parsed.decode(ShieldedAddress, NETWORK_ID as any);
  return {
    cpk: new Uint8Array(decoded.coinPublicKey.data),
    epk: new Uint8Array(decoded.encryptionPublicKey.data),
  };
}

type VaultCoin = { key: Uint8Array; value: bigint };

export function ProposeTransferTab({
  api,
  vaultKey,
  myShieldedAddress,
  doAction,
}: {
  api: DeployedMPayAPI;
  vaultKey: CryptoKey | null;
  myShieldedAddress: string;
  doAction: DoAction;
}) {
  const [recipientCpk, setRecipientCpk] = useState("");
  const [selectedCoinKey, setSelectedCoinKey] = useState("");
  const [coins, setCoins] = useState<VaultCoin[]>([]);
  const [loadingCoins, setLoadingCoins] = useState(false);

  const refreshCoins = useCallback(async () => {
    setLoadingCoins(true);
    try {
      const list = await api.getVaultCoins();
      setCoins(list);
    } catch (e) {
      console.error("Failed to load vault coins:", e);
    } finally {
      setLoadingCoins(false);
    }
  }, [api]);

  useEffect(() => {
    refreshCoins();
  }, [refreshCoins]);

  const selectedCoin = coins.find((c) => toHex(c.key) === selectedCoinKey) ?? null;

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
              Recipient Shielded Address
            </label>
            <input
              placeholder="mn_shield-addr_preprod1..."
              value={recipientCpk}
              onChange={(e) => setRecipientCpk(e.target.value)}
              className="w-full bg-surface-container-highest border-none rounded-2xl py-5 px-6 font-label text-on-surface placeholder:text-outline/40 focus:ring-2 focus:ring-primary/50 transition-all outline-none"
            />
            {myShieldedAddress && !recipientCpk && (
              <button
                onClick={() => setRecipientCpk(myShieldedAddress)}
                className="ml-1 text-xs text-primary hover:underline"
              >
                Use my shielded address
              </button>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold font-headline uppercase tracking-widest text-outline ml-1">
                Vault Coin (full-spend)
              </label>
              <button
                onClick={refreshCoins}
                disabled={loadingCoins}
                className="flex items-center gap-1 text-xs text-outline hover:text-primary transition-colors"
              >
                <Icon name="refresh" className="text-sm" />
                {loadingCoins ? "Loading..." : "Refresh"}
              </button>
            </div>
            {coins.length === 0 ? (
              <div className="bg-surface-container-highest rounded-2xl p-5 text-sm text-outline">
                {loadingCoins ? "Loading vault coins..." : "No coins in vault. Deposit first."}
              </div>
            ) : (
              <div className="space-y-2">
                {coins.map((c) => {
                  const keyHex = toHex(c.key);
                  const active = keyHex === selectedCoinKey;
                  return (
                    <button
                      key={keyHex}
                      onClick={() => setSelectedCoinKey(keyHex)}
                      className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border transition-all text-left ${
                        active
                          ? "bg-primary/10 border-primary/40"
                          : "bg-surface-container-highest border-transparent hover:border-outline-variant/30"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg ${active ? "gradient-btn" : "bg-surface-container"} flex items-center justify-center`}>
                          <Icon name={active ? "radio_button_checked" : "radio_button_unchecked"} className={active ? "text-on-primary text-sm" : "text-outline text-sm"} />
                        </div>
                        <div>
                          <div className="font-label text-xs text-outline">key {truncateHex(keyHex)}</div>
                          <div className="font-headline font-bold text-lg text-on-surface">
                            {c.value.toString()} <span className="text-xs text-primary">MPAY</span>
                          </div>
                        </div>
                      </div>
                      {active && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-bold uppercase font-headline">
                          Selected
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-4 p-5 rounded-2xl bg-surface-container-high/50 border border-primary/10">
            <Icon name="lock" className="text-primary" />
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Proposal data is encrypted with the vault key. Only signers who have the
              vault key can see recipient and amount. On-chain observers see only encrypted bytes.
              The selected coin is spent in full on execute.
            </p>
          </div>

          <button
            onClick={() => {
              if (!selectedCoin) {
                alert("Select a vault coin first");
                return;
              }
              let keys: { cpk: Uint8Array; epk: Uint8Array };
              try {
                keys = parseRecipient(recipientCpk);
              } catch (e) {
                alert((e as Error).message);
                return;
              }
              const amount = selectedCoin.value;
              doAction("Propose Transfer", async () => {
                await api.proposeTransfer(keys.cpk, keys.epk, amount, vaultKey);
                setRecipientCpk("");
                setSelectedCoinKey("");
                await refreshCoins();
              });
            }}
            disabled={!recipientCpk || !selectedCoin}
            className="w-full py-5 rounded-2xl gradient-btn text-on-primary font-bold text-lg hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            Propose Encrypted Transfer
          </button>
        </div>
      </div>
    </>
  );
}
