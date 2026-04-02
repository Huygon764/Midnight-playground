export const randomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
};

// Direct GraphQL query to bypass SDK bug where ContractCall fragment
// fetches deploy.unshieldedBalances instead of the call's own balances.
export async function queryVaultBalance(
  indexerUri: string,
  contractAddress: string,
): Promise<{ tokenType: string; balance: bigint }[]> {
  const query = `
    query($address: HexEncoded!) {
      contractAction(address: $address) {
        __typename
        ... on ContractDeploy {
          unshieldedBalances { tokenType amount }
        }
        ... on ContractUpdate {
          unshieldedBalances { tokenType amount }
        }
        ... on ContractCall {
          unshieldedBalances { tokenType amount }
        }
      }
    }
  `;
  const response = await fetch(indexerUri, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { address: contractAddress } }),
  });
  const json = (await response.json()) as { data?: { contractAction?: { unshieldedBalances?: { tokenType: string; amount: string }[] } } };
  const action = json.data?.contractAction;
  if (!action) return [];
  const balances = action.unshieldedBalances ?? [];
  return balances.map((b: { tokenType: string; amount: string }) => ({
    tokenType: b.tokenType,
    balance: BigInt(b.amount),
  }));
}
