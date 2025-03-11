import { getAccount, getWantedAllocation } from "./db";
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
import { Resend } from "resend";
import path from "path";
import { promises as fs } from 'fs';

const kron = getAccount(1) as Account;
const fundingPartner = getAccount(2) as Account;
const nordnet = getAccount(3) as Account;
const tangem = getAccount(4) as Account;
const folkeinvest = getAccount(5) as Account;
const bareBitcoin = getAccount(6) as Account;

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

async function calculateTotalValue() {
  const kronTotalValue = await fetchKronTotalValue(
    kron.access_info?.access_key as string,
    kron.access_info?.account_key as string,
    "total"
  );
  const fundingPartnerTotalValue = await fetchFundingPartnerTotalValue(
    fundingPartner.access_info?.username as string,
    fundingPartner.access_info?.password as string,
    fundingPartner.id,
    false
  );
  const bareBitcoinTotalValue = await fetchBareBitcoinTotalValue(
    bareBitcoin.id,
    bareBitcoin.access_info?.password as string,
    bareBitcoin.access_info?.username as string
  );

  const tangemTotalValue = await fetchTangemTotalValue(tangem.id);
  const folkeinvestTotalValue = await fetchStockAccountTotalValue(folkeinvest);
  const nordnetTotalValue = await fetchStockAccountTotalValue(nordnet);

  const all = [
    kronTotalValue,
    fundingPartnerTotalValue,
    bareBitcoinTotalValue,
    tangemTotalValue,
    folkeinvestTotalValue,
    nordnetTotalValue,
  ];
  const total_value = {
    account_name: "Total",
    market_value: Math.ceil(all.reduce((a, b) => a + b.market_value, 0)),
    yield: all.reduce((a, b) => a + b.yield, 0),
    return: Math.ceil(all.reduce((a, b) => a + b.return, 0)),
  } as TotalValue;

  const total_value_account = all.map((account) => {
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
    total_value_equity_type.sort((a, b) => a.market_value + b.market_value)
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

const generateEmail = async (investments: any[], totalValue: number) => {
  try {
      // Les HTML-mal fra fil
      const templatePath = path.join(__dirname, '../public/email.html');
      let template = await fs.readFile(templatePath, 'utf-8');

      // Generer tabellrader dynamisk
      const rows = investments.map(inv => `
          <tr class="${inv.rebalance ? 'rebalance' : 'no-rebalance'}">
              <td>${inv.equity_type}</td>
              <td>${inv.market_value.toFixed(2)}</td>
              <td>${inv.current_share}%</td>
              <td>${inv.wanted_share}%</td>
              <td>${inv.difference}%</td>
              <td>${inv.rebalance ? 'Ja' : 'Nei'}</td>
              <td>${inv.to_trade.toFixed(2)}</td>
          </tr>
      `).join('');

      // Sett inn data i malen
      template = template.replace("{{rows}}", rows).replace("{{totalValue}}", totalValue.toLocaleString("nb-NO", { style: "currency", currency: "NOK" })).replace("{{name}}", "Stein Petter");

      return template;
  } catch (error) {
      console.error("Feil ved lesing av e-postmal:", error);
      return ""; // Returnerer en tom streng ved feil
  }
};

async function sendEmail(investments: any[]) {
  const resend = new Resend(process.env.RESEND_API_KEY as string);
  const { data, error } = await resend.emails.send({
    from: `Portfolio <${process.env.FROM_EMAIL as string}>`,
    to: [process.env.EMAIL as string],
    subject: "Porteføljeoppdatering",
    html: await generateEmail(investments, investments.map(item => item.market_value).reduce((a, b) => a + b, 0)),
  });
  if(error){
    console.log(error);
  }
  console.log(data);
}

app.get("/total_value", (req, res) => {
  console.log("Calculating total value");
  calculateTotalValue().then((total) => {
    sendEmail(total);
    res.send(total);
  });
});

app.get("/limit", (req, res) => {
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
