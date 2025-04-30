import { CronJob } from "cron";
import { fetchLastTotalValue, getAccount, getAccounts, setTotalValueFor, updateAccountTotalValue, updateLastTotalValue } from "../db";
import { calculateAccountValues, calculateInvestmentSummary, calculateKronSummary, calculateMaxDiffToRebalance } from "../investments";
import { Account, Holding, InvestmentSummary } from "../types";
import { deleteAndCreateLimitOrders } from "../utils/barebitcoin";
import { generateInvestmentSummaryEmail, sendEmail } from "../utils/resend";
import { sendAccessKeyMail } from "../utils/kron";
import { addDays } from "../utils/functions";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateKronSummaryEmail(holdings: Holding[], account: Account) {
    const total_value = holdings.reduce((a, b) => a + b.value, 0);
  
    generateInvestmentSummaryEmail(
      holdings.map((holding) => {
        const currentPercentage = holding.currentPercentage
          ? holding.currentPercentage
          : 0;
        const difference = parseFloat(
          (holding.goalPercentage - currentPercentage).toFixed(2)
        );
        let rebalance = false;
        const max_diff_to_rebalance = calculateMaxDiffToRebalance(
          holding.goalPercentage
        );
        if (Math.abs(difference) >= max_diff_to_rebalance) {
          rebalance = true;
        }
        const to_trade = parseFloat(
          ((difference * total_value) / 100).toFixed(2)
        );
  
        return {
          equity_type: holding.name,
          market_value: parseFloat(holding.value.toFixed(2)),
          current_share: holding.currentPercentage as number,
          wanted_share: holding.goalPercentage,
          difference,
          max_diff_to_rebalance,
          rebalance,
          to_trade,
        } as InvestmentSummary;
      }),
      total_value,
      total_value - account.total_value
    ).then((email) => {
      updateAccountTotalValue(account.id, total_value);
      sendEmail({
        from: `Portfolio <${process.env.FROM_EMAIL as string}>`,
        to: [process.env.EMAIL as string],
        subject: `${account.name} oppdatering`,
        html: email,
      });
    });
  }

async function kronSummary() {
  const kronAccounts = getAccounts().filter(
    (account) => account.is_automatic && account.access_info?.account_key
  );
  if (kronAccounts.length > 0 && kronAccounts[0].access_info?.last_edited) {
    if (
      addDays(
        new Date(kronAccounts[0].access_info.last_edited),
        80
      ).getMonth() === new Date().getMonth()
    ) {
      sendAccessKeyMail(kronAccounts[0]);
      await sleep(1000);
    }
    calculateKronSummary(kronAccounts).then((result) => {
      Promise.all(result).then((res) => {
        res.forEach((item, index) => {
          generateKronSummaryEmail(item, kronAccounts[index]);
        });
      });
    });
  }
}

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
        subject: "📈 Porteføljeoppdatering",
        html: email,
      });
    });
  });
}

function calculateTotalValue() {
  console.log("Calculating total value for all accounts...");
  const accounts = getAccounts();
  calculateAccountValues(accounts)
    .then((total) => {
      total.forEach((item) => {
        if (item.account_id) {
          setTotalValueFor(item.account_id, item.market_value);
        }
      });
    })
    .catch((err) => {
      console.log("Error calculating total value: ", err);
    });
  console.log("Total value for all accounts calculated.");
}

function createLimitOrders() {
  const bareBitcoin = getAccount(6) as Account;
  console.log("Calculating limit orders");
  console.log("\n\n");
  deleteAndCreateLimitOrders(
    bareBitcoin.access_info?.password as string,
    bareBitcoin.access_info?.username as string,
    4
  );
}

const investmentSummaryJob = new CronJob(
  process.env.INVESTMENT_SUMMARY_CRON as string,
  createSummaryMail,
  null,
  false,
  "Europe/Oslo"
);
const limitOrderJob = new CronJob(
  process.env.LIMIT_ORDER_CRON as string,
  createLimitOrders,
  null,
  false,
  "Europe/Oslo"
);
const kronSummaryJob = new CronJob(
  process.env.KRON_SUMMARY_CRON as string,
  kronSummary,
  null,
  false,
  "Europe/Oslo"
);
const valueOverTimeJob = new CronJob(
  process.env.VALUE_OVER_TIME_CRON as string,
  calculateTotalValue,
  null,
  false,
  "Europe/Oslo"
);

export function logNextFiretime() {
    console.log("Investment summary job: ", investmentSummaryJob.nextDate());
    console.log("Limit order job: ", limitOrderJob.nextDate());
    console.log("Kron summary job: ", kronSummaryJob.nextDate());
    console.log("Value over time job: ", valueOverTimeJob.nextDate());
}

export function startJobs() {
    investmentSummaryJob.start();
    limitOrderJob.start();
    kronSummaryJob.start();
    valueOverTimeJob.start();

    logNextFiretime();
}
