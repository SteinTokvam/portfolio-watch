import Database from "better-sqlite3";
import { Transaction } from "../types";

const db = new Database(process.env.DB_PATH as string);
db.pragma("journal_mode = WAL");

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
  
  export function getTransactionById(transaction_id: number) {
    const stmt = db.prepare(
      "SELECT * FROM account_transaction WHERE id = ?"
    );
    const res = stmt.get(transaction_id) as Transaction;
    if (!res) {
      return null;
    }
    return res;
  }
  
  export function insertTransactionInDb(
    transaction: Transaction,
  ) {
    const stmt = db.prepare(
      "INSERT INTO account_transaction (created_at, amount, name, transaction_type, transaction_date, unit_price, ticker_id, total_shares, equity_type, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    stmt.run(
      transaction.transaction_date,
      transaction.amount,
      transaction.name,
      transaction.transaction_type,
      transaction.transaction_date,
      transaction.unit_price,
      transaction.ticker_id,
      transaction.total_shares,
      transaction.equity_type,
      transaction.account_id
    );
  }
  
  export function updateTransactionInDb(
    transaction: Transaction,
    transaction_id: number
  ) {
    const stmt = db.prepare(
      "UPDATE account_transaction SET amount = ?, name = ?, transaction_type = ?, transaction_date = ?, unit_price = ?, ticker_id = ?, total_shares = ?, equity_type = ? WHERE id = ?"
    );
    stmt.run(
      transaction.amount,
      transaction.name,
      transaction.transaction_type,
      transaction.transaction_date,
      transaction.unit_price,
      transaction.ticker_id,
      transaction.total_shares,
      transaction.equity_type,
      transaction_id
    );
  }
  
  export function deleteTransactionById(transaction_id: number) {
    const stmt = db.prepare("DELETE FROM account_transaction WHERE id = ?");
    const res = stmt.run(transaction_id);
    if (res.changes === 0) {
      return false;
    }
    return true;
  }