import { useState, useEffect, useCallback } from "react";
import type { DeployedPolyPayAPI, TransactionInfo } from "../../../api/src/index.js";
import type { DoAction } from "../types.js";
import { TX_TYPE_LABELS, TX_TYPE_ICONS } from "../types.js";
import { Icon } from "./ui.js";

export function TransactionsTab({
  api,
  doAction,
}: {
  api: DeployedPolyPayAPI;
  doAction: DoAction;
}) {
  const [txList, setTxList] = useState<TransactionInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const executeFns: Record<string, (id: bigint) => Promise<void>> = {
    "0": (id) => api.executeTransfer(id),
    "2": (id) => api.executeAddSigner(id),
    "3": (id) => api.executeRemoveSigner(id),
    "4": (id) => api.executeSetThreshold(id),
  };

  const refreshList = useCallback(async () => {
    setLoading(true);
    try {
      setTxList(await api.getTransactionList());
    } catch (e) {
      console.error("Failed to load txs:", e);
    } finally {
      setLoading(false);
    }
  }, [api]);

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
    const fn = executeFns[type];
    if (!fn) return;
    doAction(`Execute #${tx.txId} (${TX_TYPE_LABELS[type]})`, async () => {
      await fn(tx.txId);
      await refreshList();
    });
  };

  return (
    <>
      <div className="space-y-2 mb-8">
        <h2 className="text-4xl font-headline font-extrabold tracking-tight">Transactions</h2>
        <p className="text-on-surface-variant">
          View and manage pending multisig transactions.
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
                  <th className="px-8 py-4 font-medium">Approvals</th>
                  <th className="px-8 py-4 font-medium">Status</th>
                  <th className="px-8 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {txList.map((tx) => {
                  const typeStr = tx.txType.toString();
                  const isPending = tx.status === 0n;
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
