import { useState, useEffect, useCallback } from "react";
import type { DeployedPolyPayAPI, TransactionInfo } from "../../../api/src/index.js";
import { crypto as polyCrypto } from "../../../api/src/index.js";
import type { DoAction } from "../types.js";
import { TX_TYPE_LABELS, TX_TYPE_ICONS } from "../types.js";
import { truncateHex } from "../utils.js";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";
import { Icon } from "./ui.js";

type DecryptedTransfer = { recipientCpk: string; amount: string };

export function TransactionsTab({
  api,
  vaultKey,
  doAction,
}: {
  api: DeployedPolyPayAPI;
  vaultKey: CryptoKey | null;
  doAction: DoAction;
}) {
  const [txList, setTxList] = useState<TransactionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [decrypted, setDecrypted] = useState<Record<string, DecryptedTransfer>>({});

  const refreshList = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.getTransactionList();
      setTxList(list);

      // Try to decrypt transfer proposals
      if (vaultKey) {
        const dec: Record<string, DecryptedTransfer> = {};
        for (const tx of list) {
          if (tx.txType === 0n) {
            try {
              const encData = await api.getEncryptedTransferData(tx.txId);
              if (encData) {
                const result = await polyCrypto.decryptProposalData(
                  vaultKey,
                  encData.enc0,
                  encData.enc1,
                  encData.enc2,
                );
                dec[tx.txId.toString()] = {
                  recipientCpk: toHex(result.recipientCpk),
                  amount: result.amount.toString(),
                };
              }
            } catch {
              // Decryption failed — wrong vault key or corrupted data
            }
          }
        }
        setDecrypted(dec);
      }
    } catch (e) {
      console.error("Failed to load txs:", e);
    } finally {
      setLoading(false);
    }
  }, [api, vaultKey]);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  const handleApprove = (tx: TransactionInfo) => {
    doAction(`Approve #${tx.txId}`, async () => {
      await api.approveTx(tx.txId);
      await refreshList();
    });
  };

  const handleExecute = (tx: TransactionInfo) => {
    const type = tx.txType.toString();
    doAction(`Execute #${tx.txId} (${TX_TYPE_LABELS[type]})`, async () => {
      if (type === "0") {
        // Transfer — need decrypted data for witness + vault coin key
        const dec = decrypted[tx.txId.toString()];
        if (!dec) throw new Error("Cannot execute: transfer data not decrypted (missing vault key?)");
        const recipientCpk = polyCrypto.hexToUint8(dec.recipientCpk);
        const amount = BigInt(dec.amount);
        // Find first available vault coin
        const vaultCoins = await api.getVaultCoins();
        if (vaultCoins.length === 0) throw new Error("No coins in vault");
        const coin = vaultCoins.find((c) => c.value >= amount);
        if (!coin) throw new Error(`Insufficient vault balance (need ${amount}, largest coin: ${vaultCoins[0]?.value ?? 0})`);
        await api.executeTransfer(tx.txId, coin.key, recipientCpk, amount);
      } else if (type === "2") {
        await api.executeAddSigner(tx.txId);
      } else if (type === "3") {
        await api.executeRemoveSigner(tx.txId);
      } else if (type === "4") {
        await api.executeSetThreshold(tx.txId);
      }
      await refreshList();
    });
  };

  return (
    <>
      <div className="space-y-2 mb-8">
        <h2 className="text-4xl font-headline font-extrabold tracking-tight">Transactions</h2>
        <p className="text-on-surface-variant">
          View and manage pending multisig transactions.
          {!vaultKey && " (Import vault key to decrypt transfer details)"}
        </p>
      </div>

      <section className="bg-surface-container rounded-3xl overflow-hidden">
        <div className="px-8 py-6 flex justify-between items-center border-b border-outline-variant/10">
          <h3 className="text-xl font-headline font-bold tracking-tight">
            Pending Transactions
          </h3>
          <button
            onClick={refreshList}
            disabled={loading}
            className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-lg border border-outline-variant/20 text-xs font-label text-outline hover:text-primary transition-colors"
          >
            <Icon name="refresh" className="text-sm" />
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {txList.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-lowest/50 text-outline uppercase text-[10px] font-label tracking-[0.2em]">
                  <th className="px-8 py-4 font-medium">TX ID</th>
                  <th className="px-8 py-4 font-medium">Type</th>
                  <th className="px-8 py-4 font-medium">Details</th>
                  <th className="px-8 py-4 font-medium">Approvals</th>
                  <th className="px-8 py-4 font-medium">Status</th>
                  <th className="px-8 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {txList.map((tx) => {
                  const typeStr = tx.txType.toString();
                  const isPending = tx.status === 0n;
                  const dec = decrypted[tx.txId.toString()];
                  return (
                    <tr
                      key={tx.txId.toString()}
                      className={`hover:bg-surface-container-highest/30 transition-colors ${!isPending ? "opacity-60" : ""}`}
                    >
                      <td className="px-8 py-5 font-label text-sm text-secondary">
                        #{tx.txId.toString()}
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                          <Icon
                            name={TX_TYPE_ICONS[typeStr] ?? "receipt_long"}
                            className={isPending ? "text-primary text-lg" : "text-outline text-lg"}
                          />
                          <span className="text-sm font-headline font-medium">
                            {TX_TYPE_LABELS[typeStr] ?? `Type ${typeStr}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        {typeStr === "0" && dec ? (
                          <div className="text-xs space-y-1">
                            <div className="text-on-surface-variant">
                              To: <span className="text-secondary">{truncateHex(dec.recipientCpk)}</span>
                            </div>
                            <div className="text-on-surface-variant">
                              Amount: <span className="text-on-surface font-bold">{dec.amount} tNIGHT</span>
                            </div>
                          </div>
                        ) : typeStr === "0" ? (
                          <span className="text-xs text-outline italic flex items-center gap-1">
                            <Icon name="lock" className="text-sm" /> Encrypted
                          </span>
                        ) : (
                          <span className="text-xs text-outline">--</span>
                        )}
                      </td>
                      <td className="px-8 py-5">
                        <span className="text-sm font-label font-bold text-on-surface">
                          {tx.approvals.toString()}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        {isPending ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold font-headline bg-tertiary/10 text-tertiary border border-tertiary/20">
                            PENDING
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold font-headline bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            EXECUTED
                          </span>
                        )}
                      </td>
                      <td className="px-8 py-5 text-right">
                        {isPending && (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleApprove(tx)}
                              className="px-4 py-1.5 rounded-lg text-xs font-bold font-headline bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all active:scale-95"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleExecute(tx)}
                              className="px-4 py-1.5 rounded-lg text-xs font-bold font-headline gradient-btn text-on-primary shadow-lg shadow-primary-container/20 hover:scale-105 active:scale-95 transition-all"
                            >
                              Execute
                            </button>
                          </div>
                        )}
                        {!isPending && (
                          <span className="text-xs font-label text-outline italic">Completed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {txList.length === 0 && !loading && (
          <div className="px-8 py-12 text-center text-outline font-body">
            <Icon name="inbox" className="text-4xl mb-2 block mx-auto text-outline-variant" />
            <p>No transactions yet.</p>
          </div>
        )}
      </section>
    </>
  );
}
