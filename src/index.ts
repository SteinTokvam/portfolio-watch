#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();
import {
  fetchLastTotalValue,
  getAccount,
  getAccounts,
  updateLastTotalValue,
} from "./db";
import { Account } from "./types";
import {
  deleteAndCreateLimitOrders,
} from "./utils/barebitcoin";
import { generateInvestmentSummaryEmail, sendEmail } from "./utils/resend";
import { calculateInvestmentSummary, calculateKronSummary } from "./investments";
import { program } from "commander";
import inquirer from "inquirer";

function kronSummary() {
  const kronAccounts = getAccounts().filter(account => account.name.includes('Kron'))
  calculateKronSummary(kronAccounts)
  
}

console.log(process.env.DB_PATH);

function createSummaryMail() {
  console.log("Creating investment summary...");
  const accounts = getAccounts();
  calculateInvestmentSummary(accounts, true).then((total) => {
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
  });
};

function createLimitOrders() {
  const bareBitcoin = getAccount(6) as Account;
  console.log("Calculating limit orders");
  console.log("\n\n");
  deleteAndCreateLimitOrders(
    bareBitcoin.access_info?.password as string,
    bareBitcoin.access_info?.username as string,
    4
  );
};

program
.version('1.0.0')
.description('Investment watcher')
.action(() => {
  inquirer
    .prompt([
      {
        type: 'list',
        name: 'summary',
        message: 'Hva vil du gjøre?',
        choices: ['investments', 'kron', 'limit', 'mail'],
      },
    ])
    .then((answers) => {
      if(answers.summary === 'investments') {
        calculateInvestmentSummary(getAccounts())
      } else if(answers.summary === 'mail') {
        createSummaryMail();
      } else if(answers.summary === 'kron') {
        kronSummary();
      } else if(answers.summary === 'limit') {
        createLimitOrders();
      }
    });
}).parse(process.argv);
//program.parse(process.argv);