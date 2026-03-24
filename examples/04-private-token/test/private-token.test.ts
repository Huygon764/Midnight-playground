import { TokenSimulator } from "./token-simulator.js";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, it, expect } from "vitest";
import { randomBytes } from "crypto";

setNetworkId("undeployed");

describe("PrivateToken smart contract", () => {
  const ownerKey = randomBytes(32);

  it("initializes with correct owner and token name", () => {
    const sim = new TokenSimulator(ownerKey, "TestToken");
    const ledger = sim.getLedger();
    expect(ledger.owner).toEqual(sim.deriveAddress(ownerKey));
    expect(ledger.tokenName).toEqual("TestToken");
    expect(ledger.totalSupply).toEqual(0n);
  });

  it("owner can mint tokens", () => {
    const sim = new TokenSimulator(ownerKey, "TestToken");
    const addr = sim.deriveAddress(ownerKey);
    sim.mint(addr, 1000n);
    expect(sim.getBalance(addr)).toEqual(1000n);
    expect(sim.getTotalSupply()).toEqual(1000n);
  });

  it("owner can mint to another address", () => {
    const sim = new TokenSimulator(ownerKey, "TestToken");
    const otherKey = randomBytes(32);
    const otherAddr = sim.deriveAddress(otherKey);
    sim.mint(otherAddr, 500n);
    expect(sim.getBalance(otherAddr)).toEqual(500n);
    expect(sim.getTotalSupply()).toEqual(500n);
  });

  it("non-owner cannot mint", () => {
    const sim = new TokenSimulator(ownerKey, "TestToken");
    sim.switchUser(randomBytes(32));
    const addr = sim.deriveAddress(ownerKey);
    expect(() => sim.mint(addr, 100n)).toThrow("Not the owner");
  });

  it("transfer works correctly", () => {
    const sim = new TokenSimulator(ownerKey, "TestToken");
    const senderAddr = sim.deriveAddress(ownerKey);
    const recipientKey = randomBytes(32);
    const recipientAddr = sim.deriveAddress(recipientKey);

    sim.mint(senderAddr, 1000n);
    sim.transfer(recipientAddr, 300n);

    expect(sim.getBalance(senderAddr)).toEqual(700n);
    expect(sim.getBalance(recipientAddr)).toEqual(300n);
    expect(sim.getTotalSupply()).toEqual(1000n);
  });

  it("transfer fails with insufficient balance", () => {
    const sim = new TokenSimulator(ownerKey, "TestToken");
    const senderAddr = sim.deriveAddress(ownerKey);
    const recipientAddr = sim.deriveAddress(randomBytes(32));

    sim.mint(senderAddr, 100n);
    expect(() => sim.transfer(recipientAddr, 200n)).toThrow("Insufficient balance");
  });

  it("transfer fails with wrong key (derives wrong address)", () => {
    const sim = new TokenSimulator(ownerKey, "TestToken");
    const senderAddr = sim.deriveAddress(ownerKey);
    sim.mint(senderAddr, 1000n);

    // Switch to a different user who has no balance
    const wrongKey = randomBytes(32);
    sim.switchUser(wrongKey);
    const recipientAddr = sim.deriveAddress(randomBytes(32));
    // The wrong user's address has 0 balance, so transfer should fail
    expect(() => sim.transfer(recipientAddr, 100n)).toThrow("No balance");
  });

  it("multiple mints accumulate", () => {
    const sim = new TokenSimulator(ownerKey, "TestToken");
    const addr = sim.deriveAddress(ownerKey);
    sim.mint(addr, 100n);
    sim.mint(addr, 200n);
    sim.mint(addr, 300n);
    expect(sim.getBalance(addr)).toEqual(600n);
    expect(sim.getTotalSupply()).toEqual(600n);
  });
});
