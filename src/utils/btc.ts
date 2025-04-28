import { getTransactionsForAccount, getWantedAllocation } from "../db";
import { Holding, TotalValue, Transaction } from "../types";
import { fetchPrice } from "./barebitcoin";

export function fetchTransactions(account_id: number): Transaction[] {
  return getTransactionsForAccount(account_id);
}

export async function fetchHoldings(account_id: number): Promise<Holding[]> {
  const transactions = getTransactionsForAccount(account_id);

  const total_yield = transactions.reduce(
    (a: number, b: Transaction) => a + b.amount,
    0
  );
  const total_shares = transactions.reduce(
    (a: number, b: Transaction) => a + b.total_shares,
    0
  );
  const price = await fetchPrice(true) as number;
  const value = parseFloat((total_shares * price).toFixed(2));
  return [
    {
      name: "BTC",
      accountKey: account_id,
      equityShare: total_shares,
      equityType: "CRYPTOCURRENCY",
      value,
      goalPercentage: getWantedAllocation("CRYPTOCURRENCY"),
      yield: total_yield,
      isin: "BTC",
    } as Holding,
  ];
}

export async function fetchTangemTotalValue(account_id: number): Promise<TotalValue> {
  return fetchHoldings(account_id)
    .then(holdings => {
      return {
        account_name: "Tangem",
        account_id: account_id,
        market_value: Math.ceil(holdings.map(holding => holding.value).reduce((a, b) => a + b, 0)),
        yield: 0,
        return: Math.ceil(holdings.map(holding => holding.yield).reduce((a, b) => a + b, 0)),
        equity_type: "CRYPTOCURRENCY"
      } as TotalValue
    });
}
