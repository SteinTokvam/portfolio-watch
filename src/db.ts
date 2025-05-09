import Database from "better-sqlite3";
import {
  AccessInfo,
  Account,
  EquityType,
  Transaction,
  ValueSinceLast,
} from "./types";

const db = new Database(process.env.DB_PATH as string);
db.pragma("journal_mode = WAL");

initDb();
function initDb() {
  db.exec(`
        CREATE TABLE IF NOT EXISTS account (
        id INTEGER PRIMARY KEY autoincrement,
        created_at TEXT NOT NULL,
        name TEXT NOT NULL,
        account_type TEXT NOT NULL,
        total_value REAL NOT NULL,
        is_automatic INTEGER NOT NULL default 0
        )
    `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS access_info (
        id INTEGER PRIMARY KEY autoincrement, 
        created_at TEXT NOT NULL, 
        account_id INTEGER NOT NULL, 
        access_key TEXT, 
        account_key TEXT, 
        username TEXT, 
        password TEXT, 
        FOREIGN KEY(account_id) REFERENCES account(id)
        )
    `);

  db.exec(`
        CREATE TABLE IF NOT EXISTS account_transaction (
        id INTEGER PRIMARY KEY autoincrement,
        created_at TEXT NOT NULL,
        amount REAL NOT NULL,
        name TEXT NOT NULL,
        transaction_type TEXT NOT NULL,
        transaction_date TEXT NOT NULL,
        unit_price REAL NOT NULL,
        ticker_id TEXT NOT NULL,
        total_shares REAL NOT NULL,
        equity_type TEXT NOT NULL,
        account_id INTEGER NOT NULL,
        FOREIGN KEY(account_id) REFERENCES account(id)
        );
    `);

  db.exec(`
        CREATE TABLE IF NOT EXISTS equity_types (
        id INTEGER PRIMARY KEY autoincrement,
        name TEXT NOT NULL,
        wanted_allocation REAL NOT NULL
        );
    `);
  db.exec(`
        CREATE TABLE IF NOT EXISTS value_since_last (
        id INTEGER PRIMARY KEY autoincrement,
        value REAL NOT NULL
        );
    `);
  db.exec(`
        CREATE TABLE IF NOT EXISTS kron_goal_percentage (
        id INTEGER PRIMARY KEY autoincrement,
        account_id INTEGER NOT NULL,
        holding_name TEXT NOT NULL,
        goal_percentage REAL NOT NULL)`);
  db.exec(`
        CREATE TABLE IF NOT EXISTS value_over_time (
        id INTEGER PRIMARY KEY autoincrement,
        account_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        value REAL NOT NULL,
        FOREIGN KEY(account_id) REFERENCES account(id)
        )`);
  db.exec(`
        CREATE INDEX IF NOT EXISTS idx_account_id_value_over_time ON value_over_time (account_id)`);
  db.exec(`
        CREATE TABLE IF NOT EXISTS kron_refresh_token (
        id INTEGER PRIMARY KEY autoincrement,
        refresh_token TEXT NOT NULL,
        access_token TEXT NOT NULL
        )`);
}

function insertAccessInfo(
  created_at: string,
  account_id: number,
  access_info: AccessInfo
) {
  const stmt = db.prepare(
    "INSERT INTO access_info (created_at, account_id, account_key, username, password) VALUES (?, ?, ?, ?, ?)"
  );
  stmt.run(
    created_at,
    account_id,
    access_info.account_key,
    access_info.username,
    access_info.password
  );
}

export function insertAccount(
  created_at: string,
  name: string,
  type: string,
  total_value: number,
  is_automatic: boolean,
  access_info: string | null
) {
  const stmt = db.prepare(
    "INSERT INTO account (created_at, name, account_type, total_value, is_automatic) VALUES (?, ?, ?, ?, ?)"
  );
  const id = stmt.run(created_at, name, type, total_value, is_automatic ? 1 : 0)
    .lastInsertRowid as number;
  if (is_automatic && access_info) {
    const parsed_access_info = parseAccessInfo(access_info);
    insertAccessInfo(created_at, id, parsed_access_info);

    return;
  }
}

function parseAccessInfo(access_info: string): AccessInfo {
  const obj = JSON.parse(access_info);
  return obj as AccessInfo;
}

function getAccessInfo(account_id: number) {
  const stmt = db.prepare(
    "SELECT account_key, username, password, last_edited FROM access_info WHERE account_id = ?"
  );
  return stmt.get(account_id) as AccessInfo;
}

export function getAccount(id: number) {
  const stmt = db.prepare("SELECT * FROM account WHERE id = ?");
  const res = stmt.get(id) as Account;
  if (res.is_automatic) {
    const access_info = getAccessInfo(id);
    res.access_info = access_info;
  }
  return res;
}

export function getAccounts() {
  const stmt = db.prepare("SELECT * FROM account");
  const res = stmt.all() as Account[];
  for (const account of res) {
    if (account.is_automatic) {
      const access_info = getAccessInfo(account.id);
      account.access_info = access_info;
    }
  }
  return res;
}

export function getTransactionsForAccount(account_id: number) {
  const stmt = db.prepare(
    "SELECT * FROM account_transaction WHERE account_id = ?"
  );
  return stmt.all(account_id) as Transaction[];
}

export function getAllTransactions() {
  const stmt = db.prepare("SELECT * FROM account_transaction");
  return stmt.all() as Transaction[];
}

export function deleteTransactionById(transaction_id: number) {
  const stmt = db.prepare("DELETE FROM account_transaction WHERE id = ?");
  const res = stmt.run(transaction_id);
  if (res.changes === 0) {
    return false;
  }
  return true;
}

export function getEquityType(equity_type: string): EquityType {
  const stmt = db.prepare(
    "SELECT id, name, wanted_allocation FROM equity_types WHERE name = ?"
  );
  return stmt.get(equity_type) as EquityType;
}

export function updateEquityType(
  equity_type: string,
  wanted_allocation: number
) {
  const stmt = db.prepare(
    "UPDATE equity_types SET wanted_allocation = ? WHERE name = ?"
  );
  stmt.run(wanted_allocation, equity_type);
}

export function getAllEquityTypes() {
  const stmt = db.prepare(
    "SELECT id, name, wanted_allocation FROM equity_types"
  );
  return stmt.all() as EquityType[];
}

export function fetchLastTotalValue() {
  //TODO: oppdater til å differansiere mellom alle kontoer og forskjellige kron kontoer
  const stmt = db.prepare("SELECT * FROM value_since_last");
  return stmt.get() as ValueSinceLast;
}

export function updateLastTotalValue(total_value: number) {
  const stmt = db.prepare("UPDATE value_since_last SET value = ?");
  stmt.run(total_value);
}

export function insertKronGoalPercentage(
  account: Account,
  holding_name: string,
  goal_percentage: number
) {
  const stmt = db.prepare(
    "INSERT INTO kron_goal_percentage (account_id, holding_name, goal_percentage) VALUES (?, ?, ?)"
  );
  stmt.run(account.id, holding_name, goal_percentage);
}

export function fetchKronHoldingGoalPercentage(
  account: Account,
  holding_name: string
) {
  const stmt = db.prepare(
    "SELECT goal_percentage FROM kron_goal_percentage WHERE account_id = ? AND holding_name = ?"
  );
  return (stmt.get(account.id, holding_name) as any).goal_percentage as number;
}

export function updateAccountTotalValue(
  account_id: number,
  total_value: number
) {
  const stmt = db.prepare("UPDATE account SET total_value = ? WHERE id = ?");
  stmt.run(total_value, account_id);
}

export function setTotalValueFor(account_id: number, total_value: number) {
  const stmt = db.prepare(
    "INSERT INTO value_over_time (account_id, date, value) VALUES (?, ?, ?)"
  );
  stmt.run(account_id, new Date().toISOString(), total_value);
}

export function setKronToken(refresh_token: string, access_token: string) {
  const stmt = db.prepare(
    "INSERT INTO kron_refresh_token (refresh_token, access_token) VALUES (?, ?)"
  );
  stmt.run(refresh_token, access_token);
  console.log("Kron token set");
}

export function deleteKronToken() {
  const stmt = db.prepare("DELETE FROM kron_refresh_token");
  stmt.run();
  console.log("Kron token deleted");
}

export function updateToken(refresh_token: string, access_token: string) {
  const oldToken = getKronToken();
  const stmt = db.prepare(
    "UPDATE kron_refresh_token SET refresh_token = ?, access_token = ? WHERE id = ?"
  );
  stmt.run(refresh_token, access_token, oldToken.id);
}

export function getKronToken() {
  const stmt = db.prepare(
    "SELECT id, access_token, refresh_token FROM kron_refresh_token"
  );
  return stmt.get() as {
    id: number;
    access_token: string;
    refresh_token: string;
  };
}
