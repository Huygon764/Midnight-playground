import { useState, useCallback, useRef } from "react";
import { CompiledTestShieldedContract, TestShielded } from "../../contract/src/index.js";
import { getProviders } from "./providers.js";
import { deployContract } from "@midnight-ntwrk/midnight-js-contracts";
import { formatError } from "./utils.js";

const PRIVATE_STATE_KEY = "testShieldedState";

const toHexShort = (bytes: Uint8Array, n = 10) =>
  Array.from(bytes).slice(0, n).map(b => b.toString(16).padStart(2, "0")).join("");

export default function TestShieldedPage() {
  const [status, setStatus] = useState("Not connected");
  const [contractAddr, setContractAddr] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [mintAmount, setMintAmount] = useState("100");
  const [depositAmount, setDepositAmount] = useState("10");
  const [spendAmount, setSpendAmount] = useState("1");
  const [recipientAddr, setRecipientAddr] = useState("");
  const lastMintedCoinRef = useRef<{ nonce: Uint8Array; color: Uint8Array; value: bigint } | null>(null);
  const lastVaultKeyRef = useRef<Uint8Array | null>(null);

  const bigintToBytes32LE = (v: bigint): Uint8Array => {
    const b = new Uint8Array(32);
    let x = v;
    for (let i = 0; i < 32 && x !== 0n; i++) {
      b[i] = Number(x & 0xffn);
      x >>= 8n;
    }
    return b;
  };

  const log = useCallback((msg: string) => {
    setStatus((prev) => prev + "\n" + msg);
    console.log("[TestShielded]", msg);
  }, []);

  const connectAndDeploy = useCallback(async () => {
    setIsWorking(true);
    setStatus("Connecting wallet...");
    try {
      const providers = await getProviders();
      const secret = new Uint8Array(32);
      crypto.getRandomValues(secret);
      await providers.privateStateProvider.set(PRIVATE_STATE_KEY as any, { secret } as any);
      log("Wallet connected. Deploying test-shielded contract...");
      const deployed = await deployContract(providers, {
        compiledContract: CompiledTestShieldedContract,
        privateStateId: PRIVATE_STATE_KEY,
        initialPrivateState: { secret },
      } as any);
      const addr = deployed.deployTxData.public.contractAddress;
      setContractAddr(addr);
      log(`Deployed at: ${addr}`);
      (window as any).__testShieldedContract = deployed;
    } catch (e) {
      log(`Deploy FAILED: ${formatError(e)}`);
    } finally {
      setIsWorking(false);
    }
  }, [log]);

  const buildDomainSep = (label: string): Uint8Array => {
    const buf = new Uint8Array(32);
    buf.set(new TextEncoder().encode(label).slice(0, 32));
    return buf;
  };

  const testMintShieldedToUser = useCallback(async () => {
    setIsWorking(true);
    const deployed = (window as any).__testShieldedContract;
    if (!deployed) { log("Deploy first!"); setIsWorking(false); return; }
    try {
      log("Calling mintShieldedToUser...");
      const domainSep = buildDomainSep("test:mint-user:");
      const nonce = new Uint8Array(32);
      crypto.getRandomValues(nonce);
      const value = BigInt(mintAmount);
      const result = await deployed.callTx.mintShieldedToUser(domainSep, value, nonce);
      const coin = result?.private?.result as { nonce: Uint8Array; color: Uint8Array; value: bigint } | undefined;
      if (coin) {
        lastMintedCoinRef.current = coin;
        log(`SUCCESS! color=${toHexShort(coin.color)}`);
      }
    } catch (e) {
      log(`mintShieldedToUser FAILED: ${formatError(e)}`);
    } finally {
      setIsWorking(false);
    }
  }, [log, mintAmount]);

  const testReceiveShielded = useCallback(async () => {
    setIsWorking(true);
    const deployed = (window as any).__testShieldedContract;
    if (!deployed) { log("Deploy first!"); setIsWorking(false); return; }
    const minted = lastMintedCoinRef.current;
    if (!minted) { log("No minted coin."); setIsWorking(false); return; }
    try {
      log("Calling receiveShieldedTokens...");
      const nonce = new Uint8Array(32);
      crypto.getRandomValues(nonce);
      const value = BigInt(depositAmount);
      const coin = { nonce, color: minted.color, value };
      const result = await deployed.callTx.receiveShieldedTokens(coin);
      lastVaultKeyRef.current = bigintToBytes32LE(1n);
      log(`SUCCESS! receiveShielded done. txHash=${result?.public?.txHash ?? "?"}`);
    } catch (e) {
      log(`receiveShieldedTokens FAILED: ${formatError(e)}`);
    } finally {
      setIsWorking(false);
    }
  }, [log, depositAmount]);

  // Helper: parse recipient pk from address field (or use self)
  const getRecipientPk = async (): Promise<Uint8Array> => {
    const { MidnightBech32m, ShieldedAddress } = await import("@midnight-ntwrk/wallet-sdk-address-format");
    let addrToUse = recipientAddr.trim();
    if (!addrToUse) {
      await getProviders();
      const lace = (window as any).midnight;
      const laceWallet = lace && Object.values(lace).find((w: any) => w?.apiVersion);
      const connected = await (laceWallet as any).connect("preprod");
      addrToUse = (await connected.getShieldedAddresses()).shieldedAddress as string;
    }
    const parsed = MidnightBech32m.parse(addrToUse);
    const decoded = parsed.decode(ShieldedAddress, "preprod" as any);
    return new Uint8Array(decoded.coinPublicKey.data);
  };

  // α: 5 reads with Bool+Set+Counter (no hash check). Should PASS.
  const testAlpha = useCallback(async () => {
    setIsWorking(true);
    const deployed = (window as any).__testShieldedContract;
    if (!deployed) { log("Deploy first!"); setIsWorking(false); return; }
    const coinKey = lastVaultKeyRef.current;
    if (!coinKey) { log("No vault coin."); setIsWorking(false); return; }
    try {
      log("α: spendVaultAll3NoHash (5 reads, Bool+Set+Counter)");
      const pkBytes = await getRecipientPk();
      const amount = BigInt(spendAmount);
      const dataKey = bigintToBytes32LE(42n);
      log("  -> setupLikePolypay");
      await deployed.callTx.setupLikePolypay(dataKey);
      const providers = await getProviders();
      const prev = await providers.privateStateProvider.get(PRIVATE_STATE_KEY as any);
      await providers.privateStateProvider.set(PRIVATE_STATE_KEY as any, {
        ...(prev as any), pendingRecipient: pkBytes, pendingAmount: amount,
      } as any);
      log("  -> spendVaultAll3NoHash");
      const result = await deployed.callTx.spendVaultAll3NoHash(coinKey, dataKey);
      log(`α SUCCESS! txHash=${result?.public?.txHash ?? "?"}`);
      await providers.privateStateProvider.set(PRIVATE_STATE_KEY as any, {
        ...(prev as any), pendingRecipient: undefined, pendingAmount: undefined,
      } as any);
    } catch (e) {
      log(`α FAILED: ${formatError(e)}`);
    } finally {
      setIsWorking(false);
    }
  }, [log, spendAmount, recipientAddr]);

  // γ: 6 Map reads, NO Bool, NO Set. Tests pure count.
  const testGamma = useCallback(async () => {
    setIsWorking(true);
    const deployed = (window as any).__testShieldedContract;
    if (!deployed) { log("Deploy first!"); setIsWorking(false); return; }
    const coinKey = lastVaultKeyRef.current;
    if (!coinKey) { log("No vault coin."); setIsWorking(false); return; }
    try {
      log("γ: spendVault6Maps (6 Map reads, no Bool/Set)");
      const pkBytes = await getRecipientPk();
      const amount = BigInt(spendAmount);
      const { persistentHash, CompactTypeVector, CompactTypeBytes } = await import("@midnight-ntwrk/compact-runtime");
      const hashType = new CompactTypeVector(2, new CompactTypeBytes(32));
      const expectedHash = persistentHash(hashType, [pkBytes, bigintToBytes32LE(amount)]);
      const dataKey1 = bigintToBytes32LE(42n);
      const dataKey2 = bigintToBytes32LE(43n);
      const dataKey3 = bigintToBytes32LE(44n);
      const dataKey4 = bigintToBytes32LE(45n);
      const filler = new Uint8Array(32);
      log("  -> setTestData x4");
      await deployed.callTx.setTestData(dataKey1, expectedHash);
      await deployed.callTx.setTestData(dataKey2, filler);
      await deployed.callTx.setTestData(dataKey3, filler);
      await deployed.callTx.setTestData(dataKey4, filler);
      const providers = await getProviders();
      const prev = await providers.privateStateProvider.get(PRIVATE_STATE_KEY as any);
      await providers.privateStateProvider.set(PRIVATE_STATE_KEY as any, {
        ...(prev as any), pendingRecipient: pkBytes, pendingAmount: amount,
      } as any);
      log("  -> spendVault6Maps");
      const result = await deployed.callTx.spendVault6Maps(coinKey, dataKey1, dataKey2, dataKey3, dataKey4);
      log(`γ SUCCESS! txHash=${result?.public?.txHash ?? "?"}`);
      await providers.privateStateProvider.set(PRIVATE_STATE_KEY as any, {
        ...(prev as any), pendingRecipient: undefined, pendingAmount: undefined,
      } as any);
    } catch (e) {
      log(`γ FAILED: ${formatError(e)}`);
    } finally {
      setIsWorking(false);
    }
  }, [log, spendAmount, recipientAddr]);

  // δ2: same as δ but post-write goes to testStatusStamp (same map, same slot as read)
  const testDelta2 = useCallback(async () => {
    setIsWorking(true);
    const deployed = (window as any).__testShieldedContract;
    if (!deployed) { log("Deploy first!"); setIsWorking(false); return; }
    const coinKey = lastVaultKeyRef.current;
    if (!coinKey) { log("No vault coin."); setIsWorking(false); return; }
    try {
      log("δ2: spendVaultSameMap (read+write testStatusStamp same slot)");
      const pkBytes = await getRecipientPk();
      const amount = BigInt(spendAmount);
      const { persistentHash, CompactTypeVector, CompactTypeBytes } = await import("@midnight-ntwrk/compact-runtime");
      const hashType = new CompactTypeVector(2, new CompactTypeBytes(32));
      const expectedHash = persistentHash(hashType, [pkBytes, bigintToBytes32LE(amount)]);
      const dataKey = bigintToBytes32LE(42n);
      log("  -> setupLikePolypay");
      await deployed.callTx.setupLikePolypay(dataKey);
      log("  -> setTestData");
      await deployed.callTx.setTestData(dataKey, expectedHash);
      log("  -> setTestStamp(dataKey, 1)");
      await deployed.callTx.setTestStamp(dataKey, 1n);
      const providers = await getProviders();
      const prev = await providers.privateStateProvider.get(PRIVATE_STATE_KEY as any);
      await providers.privateStateProvider.set(PRIVATE_STATE_KEY as any, {
        ...(prev as any), pendingRecipient: pkBytes, pendingAmount: amount,
      } as any);
      log("  -> spendVaultSameMap");
      const result = await deployed.callTx.spendVaultSameMap(coinKey, dataKey);
      log(`δ2 SUCCESS! txHash=${result?.public?.txHash ?? "?"}`);
      await providers.privateStateProvider.set(PRIVATE_STATE_KEY as any, {
        ...(prev as any), pendingRecipient: undefined, pendingAmount: undefined,
      } as any);
    } catch (e) {
      log(`δ2 FAILED: ${formatError(e)}`);
    } finally {
      setIsWorking(false);
    }
  }, [log, spendAmount, recipientAddr]);

  // δ: Option A mirror — Bool + Set + 3 Maps (no vaultCoin.member).
  const testDelta = useCallback(async () => {
    setIsWorking(true);
    const deployed = (window as any).__testShieldedContract;
    if (!deployed) { log("Deploy first!"); setIsWorking(false); return; }
    const coinKey = lastVaultKeyRef.current;
    if (!coinKey) { log("No vault coin."); setIsWorking(false); return; }
    try {
      log("δ: spendVaultOptionAMirror (5 reads: Bool+Set+3Maps, no vaultCoin.member)");
      const pkBytes = await getRecipientPk();
      const amount = BigInt(spendAmount);
      const { persistentHash, CompactTypeVector, CompactTypeBytes } = await import("@midnight-ntwrk/compact-runtime");
      const hashType = new CompactTypeVector(2, new CompactTypeBytes(32));
      const expectedHash = persistentHash(hashType, [pkBytes, bigintToBytes32LE(amount)]);
      const dataKey = bigintToBytes32LE(42n);
      log("  -> setupLikePolypay");
      await deployed.callTx.setupLikePolypay(dataKey);
      log("  -> setTestData");
      await deployed.callTx.setTestData(dataKey, expectedHash);
      log("  -> setTestStamp(dataKey, 1)");
      await deployed.callTx.setTestStamp(dataKey, 1n);
      const providers = await getProviders();
      const prev = await providers.privateStateProvider.get(PRIVATE_STATE_KEY as any);
      await providers.privateStateProvider.set(PRIVATE_STATE_KEY as any, {
        ...(prev as any), pendingRecipient: pkBytes, pendingAmount: amount,
      } as any);
      log("  -> spendVaultOptionAMirror");
      const result = await deployed.callTx.spendVaultOptionAMirror(coinKey, dataKey);
      log(`δ SUCCESS! txHash=${result?.public?.txHash ?? "?"}`);
      await providers.privateStateProvider.set(PRIVATE_STATE_KEY as any, {
        ...(prev as any), pendingRecipient: undefined, pendingAmount: undefined,
      } as any);
    } catch (e) {
      log(`δ FAILED: ${formatError(e)}`);
    } finally {
      setIsWorking(false);
    }
  }, [log, spendAmount, recipientAddr]);

  return (
    <div style={{ padding: 40, fontFamily: "monospace", maxWidth: 900 }}>
      <h1>Shielded Bisect — Polypay 186 Verification</h1>
      <p>Deploy fresh for each test. Tests: α (retry), γ (pure count), δ (Option A mirror).</p>
      <hr />
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <button onClick={connectAndDeploy} disabled={isWorking}
          style={{ padding: "12px 24px", fontSize: 15, cursor: "pointer" }}>
          1. Connect + Deploy
        </button>
        <button onClick={testMintShieldedToUser} disabled={isWorking || !contractAddr}
          style={{ padding: "12px 24px", fontSize: 15, cursor: "pointer" }}>
          2. mint
        </button>
        <button onClick={testReceiveShielded} disabled={isWorking || !contractAddr}
          style={{ padding: "12px 24px", fontSize: 15, cursor: "pointer" }}>
          3. deposit
        </button>
        <button onClick={testAlpha} disabled={isWorking || !contractAddr}
          style={{ padding: "12px 24px", fontSize: 15, cursor: "pointer", background: "#def" }}>
          α. All3NoHash (5 reads, retry)
        </button>
        <button onClick={testGamma} disabled={isWorking || !contractAddr}
          style={{ padding: "12px 24px", fontSize: 15, cursor: "pointer", background: "#ffd" }}>
          γ. 6Maps (no Bool/Set)
        </button>
        <button onClick={testDelta} disabled={isWorking || !contractAddr}
          style={{ padding: "12px 24px", fontSize: 15, cursor: "pointer", background: "#dfd", fontWeight: "bold" }}>
          δ. OptionA mirror (fix design)
        </button>
        <button onClick={testDelta2} disabled={isWorking || !contractAddr}
          style={{ padding: "12px 24px", fontSize: 15, cursor: "pointer", background: "#fdd", fontWeight: "bold" }}>
          δ2. SameMap (read+write same slot)
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, marginBottom: 16, maxWidth: 700 }}>
        <label>Mint:</label>
        <input value={mintAmount} onChange={(e) => setMintAmount(e.target.value)} style={{ padding: 6 }} />
        <label>Deposit:</label>
        <input value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} style={{ padding: 6 }} />
        <label>Spend:</label>
        <input value={spendAmount} onChange={(e) => setSpendAmount(e.target.value)} style={{ padding: 6 }} />
        <label>Recipient:</label>
        <input
          value={recipientAddr}
          onChange={(e) => setRecipientAddr(e.target.value)}
          placeholder="mn_shield-addr_preprod1... (empty = self)"
          style={{ padding: 6, fontFamily: "monospace", fontSize: 11 }}
        />
      </div>
      {contractAddr && <p>Contract: <code>{contractAddr}</code></p>}
      <pre style={{
        background: "#111", color: "#0f0", padding: 20, borderRadius: 8,
        whiteSpace: "pre-wrap", minHeight: 240, fontSize: 13
      }}>
        {status}
      </pre>
    </div>
  );
}
