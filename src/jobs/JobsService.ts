import { CronJob } from "cron";
import {
  deleteKronToken,
  fetchLastTotalValue,
  getAccount,
  getAccounts,
  getKronToken,
  setKronToken,
  setTotalValueFor,
  updateAccountTotalValue,
  updateLastTotalValue,
} from "../db";
import {
  calculateAccountValues,
  calculateInvestmentSummary,
  calculateKronSummary,
  calculateMaxDiffToRebalance,
} from "../investments";
import { Account, Holding, InvestmentSummary } from "../types";
import { deleteAndCreateLimitOrders } from "../utils/barebitcoin";
import { generateInvestmentSummaryEmail, sendEmail } from "../utils/resend";
import { sendAccessKeyMail } from "../utils/kron";
import { addDays } from "../utils/functions";
import { refreshKronToken } from "../refreshTokenService";

enum JobType {
  INVESTMENT_SUMMARY = "investment_summary",
  BB_LIMIT_ORDER = "bb_limit_order",
  KRON_SUMMARY = "kron_summary",
  VALUE_OVER_TIME = "value_over_time",
  KRON_REFRESH_TOKEN = "kron_refresh_token",
  UNKNOWN = "unknown",
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateKronSummaryEmail(holdings: Holding[], account: Account) {
  logNextFiretime(JobType.INVESTMENT_SUMMARY);
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
      const max_diff_to_rebalance = calculateMaxDiffToRebalance();
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
  logNextFiretime(JobType.KRON_SUMMARY);
  const kronAccounts = getAccounts().filter(
    (account) => account.is_automatic && account.access_info?.account_key
  );
  if (kronAccounts.length > 0) {
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
  logNextFiretime(JobType.VALUE_OVER_TIME);
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
  logNextFiretime(JobType.BB_LIMIT_ORDER);
  const bareBitcoin = getAccount(6) as Account;
  console.log("Calculating limit orders");
  console.log("\n\n");
  deleteAndCreateLimitOrders(
    bareBitcoin.access_info?.password as string,
    bareBitcoin.access_info?.username as string,
    4
  );
}

function refreshKronTokenJob() {
  logNextFiretime(JobType.KRON_REFRESH_TOKEN);
  if (process.env.KRON_REFRESH_TOKEN && process.env.KRON_ACCESS_TOKEN) {
    console.log("Env variables found. Setting tokens...");
    deleteKronToken();
    setKronToken(process.env.KRON_REFRESH_TOKEN, process.env.KRON_ACCESS_TOKEN);
  } else {
    refreshKronToken(getKronToken().refresh_token);
  }
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

const refresh_kron_token_job = new CronJob(
  process.env.KRON_REFRESH_TOKEN_CRON as string,
  refreshKronTokenJob,
  null,
  false,
  "Europe/Oslo"
);

export function logNextFiretime(jobType: JobType) {
  switch (jobType) {
    case JobType.INVESTMENT_SUMMARY:
      console.log("Investment summary job: ", investmentSummaryJob.nextDate());
      break;
    case JobType.BB_LIMIT_ORDER:
      console.log("Limit order job: ", limitOrderJob.nextDate());
      break;
    case JobType.KRON_SUMMARY:
      console.log("Kron summary job: ", kronSummaryJob.nextDate());
      break;
    case JobType.VALUE_OVER_TIME:
      console.log("Value over time job: ", valueOverTimeJob.nextDate());
      break;
    case JobType.KRON_REFRESH_TOKEN:
      console.log(
        "Kron refresh token job: ",
        refresh_kron_token_job.nextDate()
      );
      break;
    case JobType.UNKNOWN:
    default:
      console.log("Investment summary job: ", investmentSummaryJob.nextDate());
      console.log("Limit order job: ", limitOrderJob.nextDate());
      console.log("Kron summary job: ", kronSummaryJob.nextDate());
      console.log("Value over time job: ", valueOverTimeJob.nextDate());
      console.log(
        "Kron refresh token job: ",
        refresh_kron_token_job.nextDate()
      );
      break;
  }
}

export function startJobs(runImimediately = false) {
  investmentSummaryJob.start();
  limitOrderJob.start();
  kronSummaryJob.start();
  valueOverTimeJob.start();
  refresh_kron_token_job.start();
  if (runImimediately) {
    //createSummaryMail();
    createLimitOrders();
    //kronSummary();
    //calculateTotalValue();
  }

  logNextFiretime(JobType.UNKNOWN);
}
