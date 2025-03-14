import { Holding, TotalValue, Transaction } from "../types";

async function getTransactions(accountKey: number, token: string) {
  return await fetch(
    `https://fundingpartner.no/api/v2/transactions-unified?startDate=2018-01-01&endDate=${
      new Date().toISOString().split("T")[0]
    }&lastILTID=&lastIFTID=`,
    {
      headers: {
        "Content-Type": "application/json",
        Cookie: `token=${token}`,
      },
    }
  )
    .then((res) => res.json())
    .then((data: any) => {
      const filteredTransactions = data.message.payload.transList.filter(
        (fundingpartnerTransaction: any) =>
          fundingpartnerTransaction.classification !== "depositDomestic" || // innskudd til klientkonto
          fundingpartnerTransaction.classification !==
            "withdrawalRequestedByUser" || // manuelt uttak
          fundingpartnerTransaction.classification !==
            "withdrawalDomesticForced" // automatisk uttak
      );

      return filteredTransactions
        .map((fundingpartnerTransaction: any) => {
          const transactions = [];
          if (
            fundingpartnerTransaction.principal !== null &&
            fundingpartnerTransaction.principal !== 0
          ) {
            transactions.push({
              amount: -fundingpartnerTransaction.principal,
              name: `${fundingpartnerTransaction.borrowerName} - (${fundingpartnerTransaction.loanId})`,
              transaction_type: "SELL",
              transaction_date: fundingpartnerTransaction.transactionDate,
              unit_price: -fundingpartnerTransaction.principal,
              ticker_id: "",
              total_shares: 1,
              equity_type: "Loan",
              account_id: accountKey,
            } as Transaction);
          }
          if (fundingpartnerTransaction.netInterest !== null) {
            transactions.push({
              amount: fundingpartnerTransaction.netInterest,
              name: `${fundingpartnerTransaction.borrowerName} - (${fundingpartnerTransaction.loanId})`,
              transaction_type: "YIELD",
              transaction_date: fundingpartnerTransaction.transactionDate,
              unit_price: 0,
              ticker_id: "",
              total_shares: 1,
              equity_type: "Loan",
              account_id: accountKey,
            } as Transaction);
          }
          if (
            fundingpartnerTransaction.classification === "withdrawalActiveLoan"
          ) {
            transactions.push({
              amount: Math.abs(fundingpartnerTransaction.amount),
              name: `${fundingpartnerTransaction.borrowerName} - (${fundingpartnerTransaction.loanId})`,
              transaction_type: "BUY",
              transaction_date: fundingpartnerTransaction.transactionDate,
              unit_price: Math.abs(fundingpartnerTransaction.amount),
              ticker_id: "",
              total_shares: 1,
              equity_type: "Loan",
              account_id: accountKey,
            } as Transaction);
          }

          return transactions;
        })
        .flat();
    });
}

async function login(email: string, password: string) {
  return fetch("https://fundingpartner.no/api/v2/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ApplicantUsername: email,
      ApplicantPassword: password,
    }),
  })
    .then((res) => res.json())
    .then((data: any) => data.token);
}

export const fetchTransactions = async (
  email: string,
  password: string,
  accountKey: number
) =>
  login(email, password).then((token) =>
    getTransactions(accountKey, token).then((transactions) => transactions)
  );

export const fetchFundingPartnerHoldings = async (
  username: string,
  password: string,
  accountKey: number,
  onlyCurrent: boolean
) =>
  login(username, password).then((token) =>
    getTransactions(accountKey, token).then((transactions) => {
      const uniqueTransactionNames = [
        ...new Set(
          transactions.map((transaction: Transaction) => transaction.name)
        ),
      ];
      const holdings = uniqueTransactionNames.map((transactionName) => {
        const filteredTransactions = transactions.filter(
          (transaction: Transaction) => transaction.name === transactionName
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
        const totalYield = filteredTransactions
          .filter(
            (transaction: Transaction) =>
              transaction.transaction_type === "YIELD"
          )
          .map((transaction: Transaction) => transaction.amount)
          .reduce((a: number, b: number) => a + b, 0);
        return {
          name: transactionName,
          accountKey: accountKey,
          equityShare: 1,
          equityType: "Loan",
          value: totalCost,
          goalPercentage: 0,
          yield: totalYield,
        } as Holding;
      });
      return onlyCurrent
        ? holdings.filter((holding: Holding) => holding.value > 1)
        : holdings;
    })
  );

export const fetchFundingPartnerTotalValue = async (
  username: string,
  password: string,
  accountKey: number,
  onlyCurrent: boolean
) =>
  fetchFundingPartnerHoldings(username, password, accountKey, onlyCurrent).then(
    (holdings: Holding[]) => {
      const market_value = holdings.filter(holding => holding.value >= 1).reduce(
        (a: number, b: Holding) => a + b.value,
        0
      );
      const return_value = holdings.reduce(
        (a: number, b: Holding) => a + b.yield,
        0
      );
      return {
        account_name: "FundingPartner",
        market_value: Math.ceil(market_value),
        yield: 0,
        return: Math.ceil(return_value),
        equity_type: "LOAN"
      } as TotalValue;
    }
  );
