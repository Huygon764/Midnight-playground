import { useState } from "react";
import { Icon, CopyButton } from "./ui.js";

export function IdentityCard({ secret, commitment }: { secret: string; commitment: string }) {
  const [showSecret, setShowSecret] = useState(false);
  if (!secret) return null;
  return (
    <div className="bg-surface-container-low rounded-2xl p-6 space-y-4">
      <h3 className="font-headline font-bold text-on-surface flex items-center gap-2">
        <Icon name="fingerprint" className="text-primary" />
        Your Identity
      </h3>
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-label uppercase tracking-widest text-secondary">
            Commitment (share this)
          </label>
          <div className="flex items-center gap-2 bg-surface-container rounded-xl px-4 py-3">
            <span className="font-label text-sm text-on-surface truncate flex-1">
              {commitment}
            </span>
            <CopyButton text={commitment} />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-label uppercase tracking-widest text-tertiary">
            Secret (keep private!)
          </label>
          <div className="flex items-center gap-2 bg-surface-container rounded-xl px-4 py-3">
            <span
              className={`font-label text-sm text-on-surface truncate flex-1 ${!showSecret ? "blur-sm select-none" : ""}`}
            >
              {showSecret ? secret : "\u2022".repeat(32)}
            </span>
            <button
              onClick={() => setShowSecret(!showSecret)}
              className="text-outline hover:text-tertiary transition-colors shrink-0"
            >
              <Icon name={showSecret ? "visibility_off" : "visibility"} className="text-sm" />
            </button>
            <CopyButton text={secret} />
          </div>
        </div>
      </div>
    </div>
  );
}
