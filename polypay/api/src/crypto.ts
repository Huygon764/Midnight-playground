// AES-256-GCM encryption for proposal data.
// vaultKey MUST NEVER be stored on-chain.
//
// Encrypted layout (3 x Bytes<32> = 96 bytes):
//   enc0: iv(12) + ciphertext[0:20]
//   enc1: ciphertext[20:52]
//   enc2: ciphertext[52:64] + zero-padding(20)
//
// Plaintext (48 bytes): recipientCpk(32) + amount(16 big-endian)
// Ciphertext: 48 + 16 GCM tag = 64 bytes. With IV: 76 bytes total.

const ALGO = "AES-GCM";
const KEY_LEN = 256;
const IV_LEN = 12;

export async function generateVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: ALGO, length: KEY_LEN }, true, ["encrypt", "decrypt"]);
}

export async function exportVaultKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return uint8ToHex(new Uint8Array(raw));
}

export async function importVaultKey(hex: string): Promise<CryptoKey> {
  const raw = hexToUint8(hex);
  return crypto.subtle.importKey("raw", raw.buffer as ArrayBuffer, { name: ALGO, length: KEY_LEN }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptProposalData(
  vaultKey: CryptoKey,
  recipientCpk: Uint8Array,
  amount: bigint,
): Promise<{ enc0: Uint8Array; enc1: Uint8Array; enc2: Uint8Array }> {
  const plaintext = new Uint8Array(48);
  plaintext.set(recipientCpk, 0);
  plaintext.set(bigintToBytes16BE(amount), 32);

  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: ALGO, iv }, vaultKey, plaintext.buffer as ArrayBuffer));
  // ct = 64 bytes (48 data + 16 GCM tag)

  const enc0 = new Uint8Array(32);
  const enc1 = new Uint8Array(32);
  const enc2 = new Uint8Array(32);

  enc0.set(iv, 0); // [0:12]
  enc0.set(ct.subarray(0, 20), 12); // [12:32]
  enc1.set(ct.subarray(20, 52)); // [0:32]
  enc2.set(ct.subarray(52, 64)); // [0:12], rest is zero-padding

  return { enc0, enc1, enc2 };
}

export async function decryptProposalData(
  vaultKey: CryptoKey,
  enc0: Uint8Array,
  enc1: Uint8Array,
  enc2: Uint8Array,
): Promise<{ recipientCpk: Uint8Array; amount: bigint }> {
  const iv = enc0.subarray(0, 12);
  const ct = new Uint8Array(64);
  ct.set(enc0.subarray(12, 32), 0);
  ct.set(enc1, 20);
  ct.set(enc2.subarray(0, 12), 52);

  const plaintext = new Uint8Array(
    // @ts-expect-error TS5.9 ArrayBufferLike strictness
    await crypto.subtle.decrypt({ name: ALGO, iv }, vaultKey, ct),
  );

  return {
    recipientCpk: new Uint8Array(plaintext.subarray(0, 32)),
    amount: bytes16BEToBigint(plaintext.subarray(32, 48)),
  };
}

function bigintToBytes16BE(value: bigint): Uint8Array {
  const bytes = new Uint8Array(16);
  let v = value;
  for (let i = 15; i >= 0; i--) {
    bytes[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return bytes;
}

function bytes16BEToBigint(bytes: Uint8Array): bigint {
  let value = 0n;
  for (let i = 0; i < 16; i++) {
    value = (value << 8n) | BigInt(bytes[i]);
  }
  return value;
}

export function uint8ToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToUint8(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
