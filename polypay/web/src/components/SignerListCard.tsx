import { useState, useEffect, useCallback } from "react";
import type { DeployedPolyPayAPI } from "../../../api/src/index.js";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";
import { truncateHex } from "../utils.js";
import { CopyButton, Icon } from "./ui.js";

export function SignerListCard({
  api,
  myCommitment,
  refreshKey = 0,
  onRemove,
}: {
  api: DeployedPolyPayAPI;
  myCommitment: string;
  refreshKey?: number;
  onRemove?: (commitmentHex: string) => void;
}) {
  const [signers, setSigners] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.getSignerList();
      setSigners(list.map((s) => toHex(s)));
    } catch (e) {
      console.error("Failed to load signers:", e);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  return (
    <div className="bg-surface-container-low rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-headline font-bold text-on-surface">Current Signers</h3>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-xs font-label text-outline hover:text-primary transition-colors"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {signers.map((s, i) => {
          const isYou = s === myCommitment;
          return (
            <div
              key={i}
              className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                isYou
                  ? "bg-primary/5 border-l-4 border-primary/40"
                  : "bg-surface-container"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center font-label text-xs text-primary-fixed-dim">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <span className="font-label text-sm text-on-surface">{truncateHex(s)}</span>
                {isYou && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold uppercase">
                    You
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <CopyButton text={s} />
                {onRemove && (
                  <button
                    onClick={() => onRemove(s)}
                    title="Propose remove"
                    className="text-error/70 hover:text-error transition-colors p-1"
                  >
                    <Icon name="delete" className="text-sm" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {signers.length === 0 && !loading && (
          <p className="text-sm text-outline py-2">No signers registered yet.</p>
        )}
      </div>
    </div>
  );
}
