import Database from "better-sqlite3";
import {
  AccessInfo,
  Account,
  EquityType,
  Transaction,
  ValueSinceLast,
} from "../types";

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
    db.exec(`DROP TABLE IF EXISTS value_over_time`);
    db.exec(`DROP TABLE IF EXISTS kron_refresh_token`);
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
  return {
    holding_name,
    goal_percentage: (stmt.get(account.id, holding_name) as any).goal_percentage as number
  };
}

export function setTotalValueFor(account_id: number, total_value: number) {
  const stmt = db.prepare(
    "INSERT INTO value_over_time (account_id, date, value) VALUES (?, ?, ?)"
  );
  stmt.run(account_id, new Date().toISOString(), total_value);
}
