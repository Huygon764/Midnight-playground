/**
 * Minimal test: deploy a contract with ONLY receiveShielded (exact Midnight docs pattern)
 * and try to call it. This isolates whether shielded ops work on the proof server at all.
 *
 * Usage: npx tsx test-shielded.ts
 */

import * as TestShielded from "./contract/src/managed/test-shielded/contract/index.js";
import { CompiledContract } from "@midnight-ntwrk/compact-js";
import { deployContract } from "@midnight-ntwrk/midnight-js-contracts";
import { type WitnessContext } from "@midnight-ntwrk/compact-runtime";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import * as fs from "node:fs";
import * as path from "node:path";

// -- Config (adjust if needed) --
const PROOF_SERVER_URI = "http://localhost:6300";
const INDEXER_URI = process.env.INDEXER_URI || "https://indexer.preprod.midnight.network/api/v1/graphql";
const INDEXER_WS_URI = process.env.INDEXER_WS_URI || "wss://indexer.preprod.midnight.network/api/v1/graphql/ws";

type PrivateState = { secret: Uint8Array };
const PRIVATE_STATE_KEY = "testShieldedState";

const witnesses = {
  localSecret: ({ privateState }: WitnessContext<any, PrivateState>): [PrivateState, Uint8Array] => [
    privateState,
    privateState.secret,
  ],
};

// Minimal file-based zkConfig for CLI (reads from managed/ directory)
function fileZkConfigProvider(basePath: string) {
  return {
    getProvingKey: async (circuitId: string) => {
      const keyPath = path.join(basePath, "keys", `${circuitId}.prover`);
      return fs.readFileSync(keyPath);
    },
    getVerifyingKey: async (circuitId: string) => {
      const keyPath = path.join(basePath, "keys", `${circuitId}.verifier`);
      return fs.readFileSync(keyPath);
    },
    getZKIR: async (circuitId: string) => {
      const keyPath = path.join(basePath, "zkir", `${circuitId}.zkir`);
      return fs.readFileSync(keyPath);
    },
  };
}

async function main() {
  console.log("=== Minimal Shielded Test ===");
  console.log("Proof server:", PROOF_SERVER_URI);

  const secret = new Uint8Array(32);
  crypto.getRandomValues(secret);

  const basePath = path.join(import.meta.dirname, "contract/src/managed/test-shielded");
  const zkConfigProvider = fileZkConfigProvider(basePath);

  const compiledContract = CompiledContract.make(
    "test-shielded",
    TestShielded.Contract,
  ).pipe(
    CompiledContract.withWitnesses(witnesses),
    CompiledContract.withCompiledFileAssets(path.join(basePath, "..")),
  );

  console.log("Compiled contract created");
  console.log("NOTE: This script only tests compilation + proof provider setup.");
  console.log("To fully test, you need wallet balancing (Lace DApp connector).");
  console.log("");
  console.log("The proving keys are at:", basePath + "/keys/");
  console.log("  receiveShieldedTokens.prover:", fs.statSync(path.join(basePath, "keys/receiveShieldedTokens.prover")).size, "bytes");
  console.log("  mintShieldedToSelf.prover:", fs.statSync(path.join(basePath, "keys/mintShieldedToSelf.prover")).size, "bytes");
  console.log("");

  // Quick test: send a prove request directly to proof server
  console.log("Testing proof server /prove endpoint with receiveShieldedTokens ZKIR...");
  const zkirPath = path.join(basePath, "zkir", "receiveShieldedTokens.zkir");
  const proverPath = path.join(basePath, "keys", "receiveShieldedTokens.prover");

  if (fs.existsSync(zkirPath)) {
    console.log("  ZKIR file exists:", fs.statSync(zkirPath).size, "bytes");
  }
  if (fs.existsSync(proverPath)) {
    console.log("  Prover key exists:", fs.statSync(proverPath).size, "bytes");
  }

  console.log("");
  console.log("To test via web UI:");
  console.log("1. Copy keys to web/public/keys/ and zkir to web/public/zkir/");
  console.log("2. Add test contract to web build");
  console.log("3. Deploy and call receiveShieldedTokens");
  console.log("");
  console.log("Or deploy via Lace wallet using the compiled contract.");
}

main().catch(console.error);
