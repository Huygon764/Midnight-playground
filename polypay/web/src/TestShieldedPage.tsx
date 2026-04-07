import { useState, useCallback } from "react";
import { CompiledTestShieldedContract, TestShielded } from "../../contract/src/index.js";
import { getProviders } from "./providers.js";
import { deployContract } from "@midnight-ntwrk/midnight-js-contracts";
import { formatError } from "./utils.js";

const PRIVATE_STATE_KEY = "testShieldedState";

export default function TestShieldedPage() {
  const [status, setStatus] = useState("Not connected");
  const [contractAddr, setContractAddr] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  const log = useCallback((msg: string) => {
    setStatus((prev) => prev + "\n" + msg);
    console.log("[TestShielded]", msg);
  }, []);

  const connectAndDeploy = useCallback(async () => {
    setIsWorking(true);
    setStatus("Connecting wallet...");
    try {
      const providers = await getProviders();

      // Set private state
      const secret = new Uint8Array(32);
      crypto.getRandomValues(secret);
      await providers.privateStateProvider.set(PRIVATE_STATE_KEY as any, { secret } as any);

      log("Wallet connected. Deploying minimal test-shielded contract...");

      const deployed = await deployContract(providers, {
        compiledContract: CompiledTestShieldedContract,
        privateStateId: PRIVATE_STATE_KEY,
        initialPrivateState: { secret },
      } as any);

      const addr = deployed.deployTxData.public.contractAddress;
      setContractAddr(addr);
      log(`Deployed at: ${addr}`);
      log("Now try 'Test receiveShielded' button.");

      // Store deployed contract for later use
      (window as any).__testShieldedContract = deployed;
    } catch (e) {
      log(`Deploy FAILED: ${formatError(e)}`);
    } finally {
      setIsWorking(false);
    }
  }, [log]);

  const testReceiveShielded = useCallback(async () => {
    setIsWorking(true);
    const deployed = (window as any).__testShieldedContract;
    if (!deployed) {
      log("Deploy first!");
      setIsWorking(false);
      return;
    }
    try {
      log("Calling receiveShieldedTokens (exact Midnight docs pattern)...");
      const coin = {
        nonce: new Uint8Array(32),
        color: new Uint8Array(32), // native tNIGHT
        value: 1n,
      };
      await deployed.callTx.receiveShieldedTokens(coin);
      log("SUCCESS! receiveShielded works!");
    } catch (e) {
      log(`receiveShielded FAILED: ${formatError(e)}`);
    } finally {
      setIsWorking(false);
    }
  }, [log]);

  return (
    <div style={{ padding: 40, fontFamily: "monospace", maxWidth: 800 }}>
      <h1>Minimal Shielded Test</h1>
      <p>Contract: only <code>receiveShieldedTokens(coin)</code> — exact Midnight docs pattern.</p>
      <p>No Maps, no Counters, no other circuits. Isolates if receiveShielded works.</p>
      <hr />
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <button onClick={connectAndDeploy} disabled={isWorking}
          style={{ padding: "12px 24px", fontSize: 16, cursor: "pointer" }}>
          1. Connect + Deploy
        </button>
        <button onClick={testReceiveShielded} disabled={isWorking || !contractAddr}
          style={{ padding: "12px 24px", fontSize: 16, cursor: "pointer" }}>
          2. Test receiveShielded
        </button>
      </div>
      {contractAddr && <p>Contract: <code>{contractAddr}</code></p>}
      <pre style={{
        background: "#111", color: "#0f0", padding: 20, borderRadius: 8,
        whiteSpace: "pre-wrap", minHeight: 200, fontSize: 13
      }}>
        {status}
      </pre>
    </div>
  );
}
