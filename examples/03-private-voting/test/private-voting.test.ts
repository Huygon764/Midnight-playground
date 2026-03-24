import { VotingSimulator } from "./voting-simulator.js";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, it, expect } from "vitest";
import { randomBytes } from "crypto";

setNetworkId("undeployed");

describe("PrivateVoting smart contract", () => {
  it("initializes with voting open and zero votes", () => {
    const sim = new VotingSimulator(randomBytes(32));
    const ledger = sim.getLedger();
    expect(ledger.votingOpen).toBe(true);
    expect(ledger.yesVotes).toEqual(0n);
    expect(ledger.noVotes).toEqual(0n);
  });

  it("registers a voter (commitment inserted into tree)", () => {
    const sk = randomBytes(32);
    const sim = new VotingSimulator(sk);
    const commitment = sim.computeCommitment(sk);
    sim.registerVoter(commitment);
    // Verify commitment is in the tree by checking findPathForLeaf
    const path = sim.getLedger().voters.findPathForLeaf(commitment);
    expect(path).toBeDefined();
  });

  it("voter can cast yes vote", () => {
    const sk = randomBytes(32);
    const sim = new VotingSimulator(sk);
    const commitment = sim.computeCommitment(sk);
    sim.registerVoter(commitment);
    sim.castVote(true);
    expect(sim.getLedger().yesVotes).toEqual(1n);
    expect(sim.getLedger().noVotes).toEqual(0n);
  });

  it("voter can cast no vote", () => {
    const sk = randomBytes(32);
    const sim = new VotingSimulator(sk);
    const commitment = sim.computeCommitment(sk);
    sim.registerVoter(commitment);
    sim.castVote(false);
    expect(sim.getLedger().yesVotes).toEqual(0n);
    expect(sim.getLedger().noVotes).toEqual(1n);
  });

  it("voter cannot vote twice (nullifier exists)", () => {
    const sk = randomBytes(32);
    const sim = new VotingSimulator(sk);
    const commitment = sim.computeCommitment(sk);
    sim.registerVoter(commitment);
    sim.castVote(true);
    expect(() => sim.castVote(true)).toThrow("Already voted");
  });

  it("unregistered voter cannot vote", () => {
    const sk1 = randomBytes(32);
    const sk2 = randomBytes(32);
    const sim = new VotingSimulator(sk1);
    const commitment1 = sim.computeCommitment(sk1);
    sim.registerVoter(commitment1);
    // Switch to unregistered user
    sim.switchUser(sk2);
    expect(() => sim.castVote(true)).toThrow("Voter commitment not found in tree");
  });

  it("cannot register when voting is closed", () => {
    const sk = randomBytes(32);
    const sim = new VotingSimulator(sk);
    sim.closeVoting();
    const commitment = sim.computeCommitment(sk);
    expect(() => sim.registerVoter(commitment)).toThrow("Voting is closed");
  });

  it("cannot vote when voting is closed", () => {
    const sk = randomBytes(32);
    const sim = new VotingSimulator(sk);
    const commitment = sim.computeCommitment(sk);
    sim.registerVoter(commitment);
    sim.closeVoting();
    expect(() => sim.castVote(true)).toThrow("Voting is closed");
  });

  it("multiple voters can vote correctly", () => {
    const sk1 = randomBytes(32);
    const sk2 = randomBytes(32);
    const sk3 = randomBytes(32);
    const sim = new VotingSimulator(sk1);

    // Register all voters
    sim.registerVoter(sim.computeCommitment(sk1));
    sim.registerVoter(sim.computeCommitment(sk2));
    sim.registerVoter(sim.computeCommitment(sk3));

    // Vote: sk1=yes, sk2=no, sk3=yes
    sim.castVote(true); // sk1

    sim.switchUser(sk2);
    sim.castVote(false); // sk2

    sim.switchUser(sk3);
    sim.castVote(true); // sk3

    const [yes, no] = sim.getResults();
    expect(yes).toEqual(2n);
    expect(no).toEqual(1n);
  });

  it("getResults returns correct counts", () => {
    const sk = randomBytes(32);
    const sim = new VotingSimulator(sk);
    const commitment = sim.computeCommitment(sk);
    sim.registerVoter(commitment);
    sim.castVote(true);
    const [yes, no] = sim.getResults();
    expect(yes).toEqual(1n);
    expect(no).toEqual(0n);
  });

  it("domain separators produce different hashes", () => {
    const sk = randomBytes(32);
    const sim = new VotingSimulator(sk);
    const commitment = sim.computeCommitment(sk);
    const nullifier = sim.computeNullifier(sk);
    expect(commitment).not.toEqual(nullifier);
  });
});
