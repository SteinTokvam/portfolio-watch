import { Transform } from "stream";
import { fetchLastTotalValue, getEquityType } from "./db";
import { Account, Holding, InvestmentSummary, TotalValue } from "./types";
import { fetchBareBitcoinTotalValue } from "./utils/barebitcoin";
import { fetchFundingPartnerTotalValue } from "./utils/fundingpartner";
import { fetchStockAccountTotalValue } from "./utils/stock";
import { fetchTangemTotalValue } from "./utils/btc";
import { Console } from "console";

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

export async function calculateKronSummary(kronAccounts: Account[]) {
  const holdings: Promise<Holding[]>[] = [];
  kronAccounts.forEach(async (account) => { // TODO: hent manuelt i stedet for
    // holdings.push(fetchKronHoldings(account));
  });
  const result = await Promise.all(holdings)
  
  result.forEach(item => table(item))
  return holdings;
}

export function calculateMaxDiffToRebalance() {
  return 2.5;
}

export async function calculateAccountValues(accounts: Account[]) {
  const all: Promise<TotalValue>[] = [];
  accounts.forEach((account) => {
    console.log(`Fetching data for ${account.name}`);
    if (account.is_automatic) {
      if (account.access_info?.account_key) { // TODO: Hent manuelt i stedet for
        /* all.push(
          fetchKronTotalValue(
            account,
            "total"
          )
        );*/ 
      } else if (
        account.access_info?.username &&
        account.access_info?.password
      ) {
        if (account.account_type === "CRYPTOCURRENCY") {
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
      if (account.account_type === "CRYPTOCURRENCY") {
        all.push(fetchTangemTotalValue(account.id));
      } else {
        all.push(fetchStockAccountTotalValue(account));
      }
    }
  });
  return await Promise.all(all);
}

export async function calculateInvestmentSummary(accounts: Account[], email: boolean = false): Promise<InvestmentSummary[]> {
  const results = await calculateAccountValues(accounts);
  
  const total_value = {
    account_name: "Total",
    market_value: Math.ceil(results.reduce((a, b) => a + b.market_value, 0)),
    yield: results.reduce((a, b) => a + b.yield, 0),
    return: Math.ceil(results.reduce((a, b) => a + b.return, 0)),
  } as TotalValue;

  const total_value_account = results.map((account) => {
    const wanted_share = getEquityType(account.equity_type).wanted_allocation;

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

  const total_value_equity_type: InvestmentSummary[] = [];
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
    const max_diff_to_rebalance = calculateMaxDiffToRebalance();
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
  if(!email) {
    table(
      total_value_equity_type.sort((a, b) => b.market_value - a.market_value)
    );
    console.log(
      `Total value for my investments: ${total_value_equity_type
        .map((account) => account.market_value)
        .reduce((a, b) => a + b, 0)
        .toLocaleString("nb-NO", { style: "currency", currency: "NOK" })}. Change since last: ${(fetchLastTotalValue().value - total_value.market_value).toLocaleString("nb-NO", { style: "currency", currency: "NOK" })}`
    );
  } 
  return total_value_equity_type;
}
