import { toHex } from "@midnight-ntwrk/midnight-js-utils";
import { MidnightBech32m, UnshieldedAddress } from "@midnight-ntwrk/wallet-sdk-address-format";

const STORAGE_KEY = "polypay:secret";
const CONTRACT_KEY = "polypay:contract";
const TOKEN_KEY = "polypay:token-contract";

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

export function saveContractAddress(address: string) {
  localStorage.setItem(CONTRACT_KEY, address);
}

export function loadContractAddress(): string | null {
  return localStorage.getItem(CONTRACT_KEY);
}

export function saveTokenAddress(address: string) {
  localStorage.setItem(TOKEN_KEY, address);
}

export function loadTokenAddress(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearSession() {
  localStorage.removeItem(CONTRACT_KEY);
}

export function clearAll() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(CONTRACT_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export function truncateHex(hex: string): string {
  if (hex.length <= 12) return hex;
  return hex.slice(0, 6) + "\u2026" + hex.slice(-4);
}

export function decodeBech32mAddress(address: string): Uint8Array | null {
  try {
    const networkId = (import.meta.env.VITE_NETWORK_ID ?? "preprod") as string;
    const parsed = MidnightBech32m.parse(address);
    const decoded = parsed.decode(UnshieldedAddress, networkId);
    return new Uint8Array(decoded.data);
  } catch {
    return null;
  }
}

export async function deriveSecretFromSignature(signature: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(signature);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hash);
}
