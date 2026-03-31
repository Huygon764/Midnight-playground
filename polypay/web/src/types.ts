export type Mode = "token" | "wallet";

export type Phase = "connect" | "connecting" | "setup" | "init-signers" | "dashboard" | "error";

export type TokenTab = "token-info" | "token-mint";
export type WalletTab = "overview" | "deposit" | "propose-transfer" | "propose-signer" | "transactions";

export type DoAction = (label: string, fn: () => Promise<void>) => Promise<void>;

export const TOKEN_NAV_ITEMS: { id: TokenTab; icon: string; label: string }[] = [
  { id: "token-info", icon: "token", label: "Token" },
  { id: "token-mint", icon: "add_card", label: "Mint" },
];

export const WALLET_NAV_ITEMS: { id: WalletTab; icon: string; label: string }[] = [
  { id: "overview", icon: "dashboard", label: "Dashboard" },
  { id: "deposit", icon: "savings", label: "Deposit" },
  { id: "propose-transfer", icon: "add_circle", label: "Propose" },
  { id: "propose-signer", icon: "group", label: "Signers" },
  { id: "transactions", icon: "history", label: "Transactions" },
];

export const TX_TYPE_LABELS: Record<string, string> = {
  "0": "Transfer",
  "2": "Add Signer",
  "3": "Remove Signer",
  "4": "Set Threshold",
};

export const TX_TYPE_ICONS: Record<string, string> = {
  "0": "move_up",
  "2": "person_add",
  "3": "person_remove",
  "4": "settings_suggest",
};
