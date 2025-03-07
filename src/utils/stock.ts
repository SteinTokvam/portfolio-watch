import { getTransactionsForAccount } from "../db";
import { Account, Holding, TotalValue, Transaction } from "../types";

async function fetchStockPrice(ticker: string): Promise<number> {
  if (ticker === "Folkekraft") {
    return 8;
  }
  const stock_price = await fetch(
    `https://api.e24.no/bors/chart/${ticker}?period=1weeks&type=stock`
  )
    .then((res) => res.json())
    .then((data) => {
      const ret = data.data.map((item: any) => {
        return item[1];
      });
      return ret[ret.length - 1];
    });
  return parseFloat(stock_price.toFixed(2));
}

export function fetchTransactions(account_id: number): Transaction[] {
  return getTransactionsForAccount(account_id);
}

async function fetchAccountHoldings(account_id: number): Promise<Holding[]> {
  const transactions = getTransactionsForAccount(account_id);
  const unique_tickers = Array.from(new Set([
    ...transactions.map((transaction) => transaction.ticker_id),
  ]));
  const holdings: Holding[] = [];
  return Promise.all(unique_tickers.map(async (ticker_id: string) => {
    const filteredTransactions = transactions.filter(
      (transaction) => transaction.ticker_id === ticker_id
    );
    const totalCost = filteredTransactions
      .filter(
        (transaction: Transaction) =>
          transaction.transaction_type === "BUY" ||
          transaction.transaction_type === "SELL"
      )
      .map((transaction: Transaction) => transaction.amount)
      .reduce((a: number, b: number) => {
        return a + b;
      }, 0);

    const total_shares = filteredTransactions.reduce(
      (a: number, b: Transaction) => a + b.total_shares,
      0
    );
    const price = await fetchStockPrice(ticker_id);

    const value = total_shares * price;
    const totalYield = totalCost - value;

    return {
      name: ticker_id,
      accountKey: account_id,
      equityShare: total_shares,
      equityType: "STOCK",
      value,
      goalPercentage: 20,
      yield: totalYield,
      isin: ticker_id,
    } as Holding;
  }));
}

export async function fetchStockAccountTotalValue(
  account: Account
): Promise<TotalValue> {
  return fetchAccountHoldings(account.id).then((holdings) => {
    return {
      account_name: account.name,
      market_value: holdings.reduce((a: number, b: Holding) => a + b.value, 0),
      yield: 0,
      return: holdings.reduce((a: number, b: Holding) => a + b.yield, 0),
      equity_type: "STOCK",
    };
  });
}
