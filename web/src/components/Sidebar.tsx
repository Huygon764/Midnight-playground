import { type Mode, type WalletTab, TOKEN_NAV_ITEMS, WALLET_NAV_ITEMS } from "../types.js";
import { truncateHex, clearSession } from "../utils.js";
import { Icon, CopyButton } from "./ui.js";

export function Sidebar({
  mode,
  onModeChange,
  activeWalletTab,
  onWalletTabChange,
  address,
  interactive,
}: {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  activeWalletTab: WalletTab;
  onWalletTabChange: (tab: WalletTab) => void;
  address?: string;
  interactive: boolean;
}) {
  const navItems = mode === "token" ? TOKEN_NAV_ITEMS : WALLET_NAV_ITEMS;
  const activeTab = mode === "token" ? "token-info" : activeWalletTab;

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 flex flex-col bg-surface-container-lowest py-8 px-4 gap-6 z-50">
      <div className="flex items-center gap-3 px-2">
        <div className="w-10 h-10 rounded-xl gradient-btn flex items-center justify-center">
          <Icon name="toll" filled className="text-on-primary" />
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-black text-on-surface tracking-tighter font-headline">
            M-pay
          </span>
          <span className="text-[10px] text-outline font-label tracking-widest uppercase">
            Midnight Network
          </span>
        </div>
      </div>

      <div className="flex gap-1 bg-surface-container rounded-xl p-1">
        <button
          onClick={() => onModeChange("token")}
          className={`flex-1 py-2 rounded-lg text-xs font-headline font-bold transition-all ${
            mode === "token" ? "bg-primary/10 text-primary" : "text-outline hover:text-on-surface"
          }`}
        >
          Token
        </button>
        <button
          onClick={() => onModeChange("wallet")}
          className={`flex-1 py-2 rounded-lg text-xs font-headline font-bold transition-all ${
            mode === "wallet" ? "bg-primary/10 text-primary" : "text-outline hover:text-on-surface"
          }`}
        >
          Multisig
        </button>
      </div>

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (!interactive && mode === "wallet") return;
                if (mode === "wallet") onWalletTabChange(item.id as WalletTab);
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 ${
                isActive
                  ? "text-primary font-bold border-r-4 border-primary-container bg-white/5"
                  : interactive || mode === "token"
                    ? "text-outline hover:text-on-surface hover:bg-surface-container cursor-pointer"
                    : "text-outline/40 cursor-default"
              }`}
            >
              <Icon name={item.icon} filled={isActive} />
              <span className="font-headline tracking-tight text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-4">
        {address && (
          <div className="bg-surface-container rounded-xl p-4 flex items-center justify-between group hover:bg-surface-container-highest transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-label text-xs text-on-surface">{truncateHex(address)}</span>
            </div>
            <CopyButton text={address} />
          </div>
        )}
        <button
          onClick={() => { clearSession(); window.location.reload(); }}
          className="w-full py-3 rounded-xl border border-outline-variant/30 text-on-surface-variant font-headline text-sm hover:bg-error/5 hover:text-error transition-all"
        >
          Disconnect
        </button>
      </div>
    </aside>
  );
}
