import { PayrollSimulator } from "./payroll-simulator.js";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, it, expect } from "vitest";
import { randomBytes } from "crypto";

setNetworkId("undeployed");

describe("PayrollLite smart contract", () => {
  const employerKey = randomBytes(32);
  const employee1Key = randomBytes(32);
  const employee2Key = randomBytes(32);
  const salary1 = 5000n;
  const salary2 = 3000n;

  it("initializes with employer set and period 1", () => {
    const sim = new PayrollSimulator(employerKey);
    const ledger = sim.getLedger();
    expect(ledger.employer).toEqual(sim.derivePublicKey(employerKey));
    expect(ledger.period).toEqual(1n);
    expect(ledger.claimedAmount).toEqual(0n);
  });

  it("employer can commit salary", () => {
    const sim = new PayrollSimulator(employerKey);
    const emp1PubKey = sim.derivePublicKey(employee1Key);
    const commitment = sim.computeCommitment(emp1PubKey, salary1, 1n);
    sim.commitSalary(commitment);
    const path = sim.getLedger().commitments.findPathForLeaf(commitment);
    expect(path).toBeDefined();
  });

  it("non-employer cannot commit salary", () => {
    const sim = new PayrollSimulator(employerKey);
    sim.switchUser(employee1Key);
    const commitment = randomBytes(32);
    expect(() => sim.commitSalary(commitment)).toThrow("Not employer");
  });

  it("employee can claim salary", () => {
    const sim = new PayrollSimulator(employerKey);
    const emp1PubKey = sim.derivePublicKey(employee1Key);
    const commitment = sim.computeCommitment(emp1PubKey, salary1, 1n);
    sim.commitSalary(commitment);

    sim.switchUser(employee1Key, salary1);
    const claimed = sim.claimSalary();
    expect(claimed).toEqual(salary1);
    expect(sim.getLedger().claimedAmount).toEqual(salary1);
  });

  it("employee cannot claim twice (nullifier exists)", () => {
    const sim = new PayrollSimulator(employerKey);
    const emp1PubKey = sim.derivePublicKey(employee1Key);
    const commitment = sim.computeCommitment(emp1PubKey, salary1, 1n);
    sim.commitSalary(commitment);

    sim.switchUser(employee1Key, salary1);
    sim.claimSalary();
    expect(() => sim.claimSalary()).toThrow("Already claimed");
  });

  it("unregistered employee cannot claim", () => {
    const sim = new PayrollSimulator(employerKey);
    const emp1PubKey = sim.derivePublicKey(employee1Key);
    const commitment = sim.computeCommitment(emp1PubKey, salary1, 1n);
    sim.commitSalary(commitment);

    // employee2 was never committed
    sim.switchUser(employee2Key, salary2);
    expect(() => sim.claimSalary()).toThrow("Salary commitment not found");
  });

  it("employer can start new period", () => {
    const sim = new PayrollSimulator(employerKey);
    expect(sim.getPeriod()).toEqual(1n);
    sim.newPeriod();
    expect(sim.getPeriod()).toEqual(2n);
  });

  it("non-employer cannot start new period", () => {
    const sim = new PayrollSimulator(employerKey);
    sim.switchUser(employee1Key, salary1);
    expect(() => sim.newPeriod()).toThrow("Not employer");
  });

  it("claim after resetHistory fails (old root invalid)", () => {
    const sim = new PayrollSimulator(employerKey);
    const emp1PubKey = sim.derivePublicKey(employee1Key);
    const commitment = sim.computeCommitment(emp1PubKey, salary1, 1n);
    sim.commitSalary(commitment);

    // Start new period (which resets history)
    sim.newPeriod();

    // Try to claim with period 1 commitment in period 2
    // The commitment was for period 1, but we haven't committed for period 2
    sim.switchUser(employee1Key, salary1);
    // The witness will try to find the commitment for period 2, which doesn't exist
    expect(() => sim.claimSalary()).toThrow("Salary commitment not found");
  });

  it("multiple employees can claim in same period", () => {
    const sim = new PayrollSimulator(employerKey);
    const emp1PubKey = sim.derivePublicKey(employee1Key);
    const emp2PubKey = sim.derivePublicKey(employee2Key);
    const commitment1 = sim.computeCommitment(emp1PubKey, salary1, 1n);
    const commitment2 = sim.computeCommitment(emp2PubKey, salary2, 1n);
    sim.commitSalary(commitment1);
    sim.commitSalary(commitment2);

    sim.switchUser(employee1Key, salary1);
    expect(sim.claimSalary()).toEqual(salary1);

    sim.switchUser(employee2Key, salary2);
    expect(sim.claimSalary()).toEqual(salary2);

    expect(sim.getLedger().claimedAmount).toEqual(salary1 + salary2);
  });

  it("domain separators produce different hashes", () => {
    const sim = new PayrollSimulator(employerKey);
    const pk = sim.derivePublicKey(employee1Key);
    const commitment = sim.computeCommitment(pk, salary1, 1n);
    const nullifier = sim.computeNullifier(employee1Key, 1n);
    expect(commitment).not.toEqual(nullifier);
  });
});
