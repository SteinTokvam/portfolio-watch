import {
  fetchLastTotalValue,
  getAccount,
  getAccounts,
  getWantedAllocation,
  updateLastTotalValue,
} from "./db";
import { Account, TotalValue } from "./types";
import {
  deleteAndCreateLimitOrders,
  fetchBareBitcoinTotalValue,
} from "./utils/barebitcoin";
import { fetchFundingPartnerTotalValue } from "./utils/fundingpartner";
import { fetchKronTotalValue } from "./utils/kron";
import { fetchStockAccountTotalValue } from "./utils/stock";
import { fetchTangemTotalValue } from "./utils/tangem";
import { Console } from "console";
import { Transform } from "stream";
import express from "express";
import dotenv from "dotenv";
import { generateInvestmentSummaryEmail, sendEmail } from "./utils/resend";

const accounts = getAccounts();

function table(input: any) {
  const ts = new Transform({
    transform(chunk, enc, cb) {
      cb(null, chunk);
    },
  });
  const logger = new Console({ stdout: ts });
  logger.table(input);
  const table = (ts.read() || "").toString();
  let result = "";
  for (let row of table.split(/[\r\n]+/)) {
    let r = row.replace(/[^┬]*┬/, "┌");
    r = r.replace(/^├─*┼/, "├");
    r = r.replace(/│[^│]*/, "");
    r = r.replace(/^└─*┴/, "└");
    r = r.replace(/'/g, " ");
    result += `${r}\n`;
  }
  console.log(result);
}

accounts.forEach((account) => {
  console.log(account);
});
async function calculateTotalValue() {
  const all: Promise<TotalValue>[] = [];
  accounts.forEach((account) => {
    console.log(`Fetching data for ${account.name}`);
    if (account.is_automatic) {
      if (account.access_info?.access_key && account.access_info?.account_key) {
        all.push(
          fetchKronTotalValue(
            account.access_info?.access_key as string,
            account.access_info?.account_key as string,
            "total"
          )
        );
      } else if (
        account.access_info?.username &&
        account.access_info?.password
      ) {
        if (account.account_type === "Kryptovaluta") {
          all.push(
            fetchBareBitcoinTotalValue(
              account.id,
              account.access_info?.password as string,
              account.access_info?.username as string
            )
          );
        } else {
          all.push(
            fetchFundingPartnerTotalValue(
              account.access_info?.username as string,
              account.access_info?.password as string,
              account.id,
              false
            )
          );
        }
      }
    } else {
      if (account.account_type === "Kryptovaluta") {
        all.push(fetchTangemTotalValue(account.id));
      } else {
        all.push(fetchStockAccountTotalValue(account));
      }
    }
  });

  const results = await Promise.all(all);
  const total_value = {
    account_name: "Total",
    market_value: Math.ceil(results.reduce((a, b) => a + b.market_value, 0)),
    yield: results.reduce((a, b) => a + b.yield, 0),
    return: Math.ceil(results.reduce((a, b) => a + b.return, 0)),
  } as TotalValue;

  const total_value_account = results.map((account) => {
    const wanted_share = getWantedAllocation(account.equity_type);

    const difference = parseFloat(
      (
        wanted_share -
        (account.market_value / total_value.market_value) * 100
      ).toFixed(2)
    );
    let rebalance = false;
    let toTrade = 0;
    if (Math.abs(difference) >= 5) {
      rebalance = true;
      toTrade = parseFloat(
        ((difference * total_value.market_value) / 100).toFixed(2)
      );
    }

    return {
      account_name: account.account_name,
      total_value: account.market_value,
      current_share: parseFloat(
        ((account.market_value / total_value.market_value) * 100).toFixed(2)
      ),
      wanted_share,
      difference,
      rebalance,
      to_trade: toTrade,
      equity_type: account.equity_type,
    };
  });
  table(total_value_account);
  const unique_equity_types = new Set([
    ...total_value_account.map((account) => account.equity_type),
  ]);

  const total_value_equity_type: any[] = [];
  unique_equity_types.forEach((equity_type: string) => {
    const wanted_share = total_value_account
      .filter((account) => account.equity_type === equity_type)
      .map((account) => account.wanted_share)[0];
    const market_value = total_value_account
      .filter((account) => account.equity_type === equity_type)
      .map((account) => account.total_value)
      .reduce((a: number, b: number) => a + b, 0);
    const current_share = parseFloat(
      total_value_account
        .filter((account) => account.equity_type === equity_type)
        .map(
          (account) => (account.total_value / total_value.market_value) * 100
        )
        .reduce((a: number, b: number) => a + b, 0)
        .toFixed(2)
    );
    const difference = parseFloat((wanted_share - current_share).toFixed(2));
    let rebalance = false;
    const toTrade = parseFloat(
      ((difference * total_value.market_value) / 100).toFixed(2)
    );
    const max_diff_to_rebalance = wanted_share < 10 ? 3 : wanted_share * 0.1;
    if (Math.abs(difference) >= max_diff_to_rebalance) {
      rebalance = true;
    }
    total_value_equity_type.push({
      equity_type,
      market_value,
      current_share: parseFloat(
        total_value_account
          .filter((account) => account.equity_type === equity_type)
          .map((account) => account.current_share)
          .reduce((a: number, b: number) => a + b, 0)
          .toFixed(2)
      ),
      wanted_share,
      difference,
      max_diff_to_rebalance,
      rebalance,
      to_trade: toTrade,
    });
  });

  table(
    total_value_equity_type.sort((a, b) => b.market_value - a.market_value)
  );

  console.log(
    `Total value for my investments: ${total_value_equity_type
      .map((account) => account.market_value)
      .reduce((a, b) => a + b, 0)
      .toLocaleString("nb-NO", { style: "currency", currency: "NOK" })}`
  );
  return total_value_equity_type;
}

dotenv.config();
const app = express();
const port = 3000;

app.get("/total_value", (req, res) => {
  console.log("Calculating total value");
  calculateTotalValue().then((total) => {
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

//resend_email();

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
