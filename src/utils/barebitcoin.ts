import { Holding, TotalValue } from "../types";
import crypto from "crypto";

type BBTransaction = {
  id: string;
  accountId: string;
  type: string;
  subType: string;
  createTime: Date;
  finalizeTime: Date;
  inAmount: string;
  inCurrency: String;
  outAmount: string;
  outCurrency: string;
  feeAmount: string;
  feeCurrency: string;
  rateMarket: string;
  isPayment: boolean;
  paymentInfo: string;
  note: string;
};

type BBAccounts = {
  accounts: [
    {
      id: string;
      availableBtc: number;
      pendingOrdersBtc: number;
    }
  ];
};

type BBPrice = {
  price: number;
  bid: number;
  ask: number;
  timestamp: Date;
  card: { buy: number; sell: number };
  bank: { buy: number; sell: number };
};

type BBToken = {
  accessToken: string;
  refreshToken: string;
  verifiedEmail: boolean;
};

type BBComponents = {
  method: string;
  path: string;
  nonce: number;
  data: string;
};

type BBOpenOrder = {
  orders: {
    orderId: string;
    type: "ORDER_TYPE_LIMIT" | "ORDER_TYPE_MARKET" | "ORDER_TYPE_UNSPECIFIED";
    direction: "DIRECTION_BUY" | "DIRECTION_SELL" | "DIRECTION_UNSPECIFIED";
    amount: number;
    createdAt: string;
  }[];
};

const baseUrl = "https://api.bb.no";

const createOptions = (
  secret_key: string,
  public_key: string,
  components: BBComponents
) => {
  const headers = {
    "Content-Type": "application/json",
    "x-bb-api-hmac": createHmac(secret_key, components),
    "x-bb-api-nonce": components.nonce.toString(),
    "x-bb-api-key": public_key,
  };
  if (components.method === "POST") {
    return {
      headers,
      method: components.method,
      body: components.data,
    };
  }
  return {
    headers,
    method: components.method,
  };
};

export function createHmac(secret: string, components: BBComponents) {
  // Encode data: nonce and raw data
  const encodedData = components.data
    ? `${components.nonce}${components.data.toString()}`
    : `${components.nonce}`;

  // SHA-256 hash of the encoded data
  const hashedData = crypto.createHash("sha256").update(encodedData).digest();

  // Concatenate method, path, and hashed data
  const message = Buffer.concat([
    Buffer.from(components.method),
    Buffer.from(components.path),
    hashedData,
  ]);

  const decodedSecret = Buffer.from(secret, "base64");

  // Generate HMAC
  const hmac = crypto.createHmac("sha256", decodedSecret);
  hmac.update(message);
  const macsum = hmac.digest();

  // Return base64-encoded HMAC
  return macsum.toString("base64");
}

function setType(type: string) {
  switch (type) {
    case "FIAT_DEPOSIT":
    case "BTC_DEPOSIT":
      return "DEPOSIT";
    case "FIAT_WITHDRAWAL":
    case "BTC_WITHDRAWAL":
      return "WITHDRAWAL";
    case "BTC_BUY":
      return "BUY";
    case "BTC_BONUS":
      return "YIELD";
    case "BTC_SELL":
      return "SELL";
    default:
      return type;
  }
}

function setEquityShare(transaction: BBTransaction) {
  if (transaction.type === "BTC_BUY") {
    return transaction.inAmount;
  } else if (transaction.type === "BTC_SELL") {
    return transaction.outAmount;
  } else if (transaction.type === "BTC_WITHDRAWAL") {
    return transaction.outAmount;
  } else if (transaction.type === "BTC_DEPOSIT") {
    return transaction.inAmount;
  } else if (transaction.type === "BTC_BONUS") {
    return transaction.inAmount;
  }
}

function setFeeAmount(transaction: BBTransaction) {
  if (transaction.type === "BTC_WITHDRAWAL") {
    return parseFloat(
      (
        parseFloat(transaction.feeAmount) * parseFloat(transaction.rateMarket)
      ).toFixed(2)
    );
  }
  return transaction.feeAmount;
}

function setCost(transaction: BBTransaction) {
  if (transaction.type === "BTC_WITHDRAWAL") {
    return parseFloat(
      (
        parseFloat(transaction.outAmount) * parseFloat(transaction.rateMarket)
      ).toFixed(2)
    );
  } else if (transaction.type === "BTC_DEPOSIT") {
    return parseFloat(
      (
        parseFloat(transaction.inAmount) * parseFloat(transaction.rateMarket)
      ).toFixed(2)
    );
  } else if (transaction.type === "BTC_BUY") {
    return parseFloat(transaction.outAmount).toFixed(2);
  } else if (transaction.type === "BTC_BONUS") {
    return parseFloat(
      (
        parseFloat(transaction.rateMarket) * parseFloat(transaction.inAmount)
      ).toFixed(2)
    );
  }
  return parseFloat(parseFloat(transaction.inAmount).toFixed(2));
}

export async function fetchPrice(
  onlyPrice: boolean
): Promise<number | BBPrice> {
  return await fetch(`${baseUrl}/v1/price/nok`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((response) => response.json())
    .then((response: BBPrice) => (onlyPrice ? response.price : response));
}

/*async function getPnl() {
  return fetch(
    "https://barebitcoin.no/connect/bb.pnl.v1.PnlService/LatestPNL?connect=v1&encoding=json&message=%7B%7D",
    createOptions
  )
    .then((response) => response.json())
    .then((response) =>
      response.pnlAllAccounts.filter((item: any) => item.account)
    );
}

export async function fetchTransactions(accountKey: number) {
  return await fetch("https://api.bb.no/export/transactions", createOptions)
    .then((response) => response.json())
    .then((response) => {
      if (response.error) {
        return;
      }
      return response
        .filter(
          (transaction: BBTransaction) => transaction.inCurrency !== "NOK"
        )
        .map((transaction: BBTransaction) => {
          const accountName =
            transaction.accountId === "acc_01J631DK3N56K40P6NC1HZXWBQ"
              ? "Barn"
              : "Hovedkonto";
          const limit = transaction.subType ? ` - ${transaction.subType}` : "";
          return {
            transactionKey: transaction.id,
            accountKey,
            cost: setCost(transaction),
            name:
              transaction.type === "BTC_WITHDRAWAL"
                ? `${accountName} - (${transaction.outCurrency}${limit})`
                : `${accountName} - (${transaction.inCurrency}${limit})`,
            type: setType(transaction.type),
            date: transaction.createTime,
            equityPrice: transaction.rateMarket,
            e24Key: "",
            equityShare: setEquityShare(transaction),
            equityType: "Cryptocurrency",
            fee: setFeeAmount(transaction),
          };
        });
    });
}*/

export async function fetchHoldings(
  accountKey: number,
  secret_key: string,
  public_key: string
): Promise<Holding[]> {
  const path = "/v1/user/bitcoin-accounts";
  return fetch(
    `${baseUrl}${path}`,
    createOptions(secret_key, public_key, {
      method: "GET",
      path,
      nonce: new Date().getTime(),
      data: "",
    } as BBComponents)
  )
    .then((response) => response.json())
    .then((response: BBAccounts) => {
      return fetchPrice(true).then((price) => {
        return response.accounts.map((item) => {
          return {
            name: item.id,
            accountKey,
            equityShare: item.availableBtc,
            equityType: "Cryptocurrency",
            value: item.availableBtc * (price as number),
            yield: 0,
            isin: "BTC",
          } as Holding;
        });
      });
    });
}

export const fetchBareBitcoinTotalValue = async (
  accountKey: number,
  secret_key: string,
  public_key: string
): Promise<TotalValue> => {
  return await fetchHoldings(accountKey, secret_key, public_key).then(
    (holdings) => {
      return {
        account_name: "Bare Bitcoin",
        market_value: parseFloat(holdings[0].value.toFixed(2)),//Math.ceil(holdings.map((holding) => holding.value).reduce((a, b) => a + b, 0)),
        yield: 0,
        return: Math.ceil(
          holdings.map((holding) => holding.yield).reduce((a, b) => a + b, 0)
        ),
        equity_type: "CRYPTOCURRENCY",
      } as TotalValue;
    }
  );
};

export async function fetchLedger(secret_key: string, public_key: string) {
  const path = "/v1/ledger";
  return await fetch(
    `${baseUrl}${path}`,
    createOptions(secret_key, public_key, {
      method: "GET",
      path,
      nonce: new Date().getTime(),
      data: "",
    } as BBComponents)
  )
    .then((response) => response.json())
    .then((response) => response);
}

function createLimitOrder(
  secret_key: string,
  public_key: string,
  limit: number,
  amount: number
) {
  const path = "/v1/orders";
  const body = JSON.stringify({
    type: "ORDER_TYPE_LIMIT",
    direction: "DIRECTION_BUY",
    amount,
    price: limit,
  });

  return fetch(
    `${baseUrl}${path}`,
    createOptions(secret_key, public_key, {
      method: "POST",
      path,
      nonce: new Date().getTime(),
      data: body,
    })
  );
}

function fetchOpenOrders(secret_key: string, public_key: string) {
  const path = "/v1/orders";
  return fetch(
    `${baseUrl}${path}`,
    createOptions(secret_key, public_key, {
      method: "GET",
      path,
      nonce: new Date().getTime(),
      data: "",
    } as BBComponents)
  );
}

function timeout(func: () => void, index: number, numOfRuns: number) {
  setTimeout(() => {
    func()
    if(index < numOfRuns) {
      timeout(func, index+1, numOfRuns)
    }
  }, 1000)
}

function deleteAllLimitOrders(secret_key: string, public_key: string) {
  return fetchOpenOrders(secret_key, public_key)
    .then((response) => response.json())
    .then((orders: BBOpenOrder) => {
      timeout(() => {
        const orderId = orders.orders.pop()?.orderId
        const path = `/v1/orders/${orderId}`;
          return fetch(
            `${baseUrl}${path}`,
            createOptions(secret_key, public_key, {
              method: "DELETE",
              path,
              nonce: new Date().getTime(),
            } as BBComponents)
          ).then((res) => res.json())
          .then(res => {
            console.log(`Removed order ${orderId}.`)
          });
      }, 1, orders.orders.length)
    });
}

export function deleteAndCreateLimitOrders(
  secret_key: string,
  public_key: string,
  numberOfOrders: number
) {
  deleteAllLimitOrders(secret_key, public_key).then((res) => {
    fetchPrice(false).then((price) => {
      let limit = (price as BBPrice).ask;
      timeout(() => {
        limit = Math.ceil(limit * 0.93);
        const amount = 25
        createLimitOrder(secret_key, public_key, limit, amount)
        .then(res => res.json())
        .then((res: any) => {
          console.log(`Created limit order for ${amount}Kr at ${limit}Kr! - orderId: ${res.orderId}`)
        });
      }, 1, numberOfOrders)
    });
  });
}


