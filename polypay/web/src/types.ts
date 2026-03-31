import type { DeployedPolyPayAPI } from "../../api/src/index.js";

export type Phase = "connect" | "connecting" | "setup" | "init-signers" | "dashboard" | "error";
export type Tab = "overview" | "mint" | "propose-transfer" | "propose-signer" | "transactions";

export type DoAction = (label: string, fn: () => Promise<void>) => Promise<void>;

export const NAV_ITEMS: { id: Tab; icon: string; label: string }[] = [
  { id: "overview", icon: "dashboard", label: "Dashboard" },
  { id: "mint", icon: "toll", label: "Mint" },
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
