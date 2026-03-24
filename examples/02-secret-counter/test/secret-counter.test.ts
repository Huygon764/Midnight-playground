import { SecretCounterSimulator } from "./secret-counter-simulator.js";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, it, expect } from "vitest";
import { randomBytes } from "crypto";

setNetworkId("undeployed");

describe("SecretCounter smart contract", () => {
  const ownerKey = randomBytes(32);

  it("initializes with owner set to deployer public key", () => {
    const sim = new SecretCounterSimulator(ownerKey);
    const ledger = sim.getLedger();
    expect(ledger.round).toEqual(0n);
    expect(ledger.owner).toEqual(sim.publicKey());
  });

  it("owner can increment", () => {
    const sim = new SecretCounterSimulator(ownerKey);
    const ledger = sim.increment();
    expect(ledger.round).toEqual(1n);
  });

  it("owner can decrement", () => {
    const sim = new SecretCounterSimulator(ownerKey);
    sim.increment();
    sim.increment();
    const ledger = sim.decrement();
    expect(ledger.round).toEqual(1n);
  });

  it("non-owner cannot increment", () => {
    const sim = new SecretCounterSimulator(ownerKey);
    sim.switchUser(randomBytes(32));
    expect(() => sim.increment()).toThrow("failed assert: Not the owner");
  });

  it("non-owner cannot decrement", () => {
    const sim = new SecretCounterSimulator(ownerKey);
    sim.increment();
    sim.switchUser(randomBytes(32));
    expect(() => sim.decrement()).toThrow("failed assert: Not the owner");
  });

  it("anyone can read counter", () => {
    const sim = new SecretCounterSimulator(ownerKey);
    sim.increment();
    sim.increment();
    sim.switchUser(randomBytes(32));
    expect(sim.readCounter()).toEqual(2n);
  });

  it("owner can increment multiple times", () => {
    const sim = new SecretCounterSimulator(ownerKey);
    for (let i = 0; i < 5; i++) {
      sim.increment();
    }
    expect(sim.getLedger().round).toEqual(5n);
  });

  it("generates deterministic initial state for same key", () => {
    const sim0 = new SecretCounterSimulator(ownerKey);
    const sim1 = new SecretCounterSimulator(ownerKey);
    expect(sim0.getLedger()).toEqual(sim1.getLedger());
  });
});
