import { type Ledger, pureCircuits } from "./managed/payroll-lite/contract/index.js";
import { type WitnessContext, type MerkleTreePath, convertFieldToBytes } from "@midnight-ntwrk/compact-runtime";

export type PayrollPrivateState = {
  readonly secretKey: Uint8Array;
  readonly salary: bigint;
};

export const createPayrollPrivateState = (
  secretKey: Uint8Array,
  salary: bigint,
): PayrollPrivateState => ({
  secretKey,
  salary,
});

export const witnesses = {
  localSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, PayrollPrivateState>): [PayrollPrivateState, Uint8Array] => [
    privateState,
    privateState.secretKey,
  ],

  salaryAmount: ({
    privateState,
  }: WitnessContext<Ledger, PayrollPrivateState>): [PayrollPrivateState, bigint] => [
    privateState,
    privateState.salary,
  ],

  commitmentMerklePath: ({
    ledger,
    privateState,
  }: WitnessContext<Ledger, PayrollPrivateState>): [PayrollPrivateState, MerkleTreePath<Uint8Array>] => {
    const pubKey = pureCircuits.derivePublicKey(privateState.secretKey);
    const periodBytes = convertFieldToBytes(32, ledger.period, "payroll-witness");
    const salaryBytes = convertFieldToBytes(32, privateState.salary, "payroll-witness");
    const commitment = pureCircuits.computeCommitment(pubKey, salaryBytes, periodBytes);
    const path = ledger.commitments.findPathForLeaf(commitment);
    if (path === undefined) {
      throw new Error("Salary commitment not found in tree");
    }
    return [privateState, path];
  },
};
