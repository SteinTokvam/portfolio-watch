import { getTransactionsForAccount, getEquityType, fetchKronHoldingGoalPercentage } from "../db";
import { calculateAccountValues } from "../investments";
import { Account, Holding, KronRebalance, TotalValue, Transaction } from "../types";

export async function fetchStockPrice(ticker: string, equity_type: string): Promise<number> {
  if (ticker === "Folkekraft") {
    return 8;
  }
  const stock_price = await fetch(
    `https://api.e24.no/bors/chart/${ticker}?period=1weeks&type=${equity_type.toLowerCase()}`
  )
    .then((res) => res.json())
    .then((data: any) => {
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

  return Promise.all(unique_tickers.map(async (ticker_id: string) => {
    const filteredTransactions = transactions.filter(
      (transaction) => transaction.ticker_id === ticker_id
    );
    const equity_type = filteredTransactions[0].equity_type;
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
    const price = await fetchStockPrice(ticker_id, equity_type);

    const value = parseFloat((total_shares * price).toFixed(2));

    const totalYield = value - totalCost;

    return {
      name: ticker_id,
      accountKey: account_id,
      equityShare: total_shares,
      equityType: equity_type.toUpperCase(),
      value,
      goalPercentage: getEquityType(equity_type.toUpperCase()).wanted_allocation,
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
      account_id: account.id,
      market_value: holdings.reduce((a: number, b: Holding) => a + b.value, 0),
      yield: 0,
      return: parseFloat(holdings.reduce((a: number, b: Holding) => a + b.yield, 0).toFixed(2)),
      equity_type: account.name === "Folkeinvest" ? "STOCK" : "FUND",
    };
  });
}

export async function calculateKronRebalance(account: Account, new_money: number): Promise<KronRebalance[]> {
  const transactions = getTransactionsForAccount(account.id)
  const goals = transactions.map(transaction => fetchKronHoldingGoalPercentage(account, transaction.name))

  const total_value = (await calculateAccountValues([account]))[0].market_value + new_money

  const prices = await Promise.all(transactions.map(async transaction => {
      return {
          ticker: transaction.ticker_id,
          price: await fetchStockPrice(transaction.ticker_id, transaction.equity_type)
      }
  }))

  return transactions.map(transaction => {
      const ticker_price = prices.find(price => price.ticker === transaction.ticker_id)?.price
      const value = transaction.total_shares * (ticker_price ? ticker_price : 0)
      const current_allocation = (value/total_value) * 100
      const goal_allocation = goals.filter(goal => goal.holding_name === transaction.name)[0].goal_percentage
      return {
          name: transaction.name,
          goal_allocation,
          value: parseInt(value.toFixed(0)),
          current_allocation,
          diff_to_goal: goal_allocation - current_allocation,
          to_buy: parseInt((total_value*(goal_allocation/100)-value).toFixed(0)),
      }
  })
}
