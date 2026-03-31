import { toHex } from "@midnight-ntwrk/midnight-js-utils";

const STORAGE_KEY = "polypay:secret";

export function formatError(e: unknown): string {
  console.error("[formatError] Full error object:", e);
  if (!(e instanceof Error)) return String(e);
  const finalizedTxData = (e as any).finalizedTxData;
  if (finalizedTxData) {
    console.error("[formatError] finalizedTxData:", JSON.stringify(finalizedTxData, null, 2));
    return `${e.constructor.name}: status=${finalizedTxData.status ?? "unknown"}`;
  }
  const cause = (e as any).cause;
  if (cause instanceof Error) {
    console.error("[formatError] cause:", cause);
    const causeFinalizedTxData = (cause as any).finalizedTxData;
    if (causeFinalizedTxData) {
      console.error(
        "[formatError] cause.finalizedTxData:",
        JSON.stringify(causeFinalizedTxData, null, 2),
      );
      return `${e.message}: ${cause.constructor.name} status=${causeFinalizedTxData.status ?? "unknown"}`;
    }
    return `${e.message}: ${cause.message}`;
  }
  return e.message;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function saveSecret(secret: Uint8Array) {
  localStorage.setItem(STORAGE_KEY, toHex(secret));
}

export function loadSecret(): Uint8Array | null {
  const hex = localStorage.getItem(STORAGE_KEY);
  if (!hex) return null;
  return hexToBytes(hex);
}

export function truncateHex(hex: string): string {
  if (hex.length <= 12) return hex;
  return hex.slice(0, 6) + "\u2026" + hex.slice(-4);
}
