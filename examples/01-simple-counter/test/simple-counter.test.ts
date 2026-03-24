import { SimpleCounterSimulator } from "./simple-counter-simulator.js";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, it, expect } from "vitest";

setNetworkId("undeployed");

describe("SimpleCounter smart contract", () => {
  it("generates initial ledger state deterministically", () => {
    const sim0 = new SimpleCounterSimulator();
    const sim1 = new SimpleCounterSimulator();
    expect(sim0.getLedger()).toEqual(sim1.getLedger());
  });

  it("initializes round to 0", () => {
    const sim = new SimpleCounterSimulator();
    expect(sim.getLedger().round).toEqual(0n);
  });

  it("increments the counter by 1", () => {
    const sim = new SimpleCounterSimulator();
    const state = sim.increment();
    expect(state.round).toEqual(1n);
  });

  it("decrements the counter by 1", () => {
    const sim = new SimpleCounterSimulator();
    sim.increment();
    sim.increment();
    const state = sim.decrement();
    expect(state.round).toEqual(1n);
  });

  it("increments multiple times", () => {
    const sim = new SimpleCounterSimulator();
    for (let i = 0; i < 5; i++) {
      sim.increment();
    }
    expect(sim.getLedger().round).toEqual(5n);
  });

  it("reads counter value via circuit", () => {
    const sim = new SimpleCounterSimulator();
    sim.increment();
    sim.increment();
    sim.increment();
    const value = sim.readCounter();
    expect(value).toEqual(3n);
  });

  it("does not affect private state", () => {
    const sim = new SimpleCounterSimulator();
    sim.increment();
    expect(sim.getPrivateState()).toEqual({ privateCounter: 0 });
  });
});
