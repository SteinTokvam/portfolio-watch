import {
  fetchLastTotalValue,
  getAccount,
  getAccounts,
  updateLastTotalValue,
} from "./db";
import { Account, Holding } from "./types";
import {
  deleteAndCreateLimitOrders,
} from "./utils/barebitcoin";
import express from "express";
import dotenv from "dotenv";
import { generateInvestmentSummaryEmail, sendEmail } from "./utils/resend";
import { calculateInvestmentSummary, calculateKronSummary } from "./investments";
import { fetchKronHoldings } from "./utils/kron";

dotenv.config();
const app = express();
const port = 3000;

app.get('/kron/summary', (req, res) => {
  const kronAccounts = getAccounts().filter(account => account.name.includes('Kron'))
  calculateKronSummary(kronAccounts)
  
  res.send('Kron summary');
});

app.get("/investment_summary", (req, res) => {
  console.log("Creating investment summary...");
  const accounts = getAccounts();
  calculateInvestmentSummary(accounts).then((total) => {
    const total_value = total
      .map((item) => item.market_value)
      .reduce((a, b) => a + b, 0);
    const value_since_last = fetchLastTotalValue();
    updateLastTotalValue(total_value);
    generateInvestmentSummaryEmail(
      total,
      total_value,
      total_value - value_since_last.value
    ).then((email) => {
      sendEmail({
        from: `Portfolio <${process.env.FROM_EMAIL as string}>`,
        to: [process.env.EMAIL as string],
        subject: "Porteføljeoppdatering",
        html: email,
      });
    });
    res.send(total);
  });
});

app.get("/limit", (req, res) => {
  const bareBitcoin = getAccount(6) as Account;
  console.log("Calculating limit orders");
  console.log("\n\n");
  deleteAndCreateLimitOrders(
    bareBitcoin.access_info?.password as string,
    bareBitcoin.access_info?.username as string,
    4
  );
  res.send("Limit orders created");
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

if(process.argv[2] === '-is') {
  calculateInvestmentSummary(getAccounts())
}
