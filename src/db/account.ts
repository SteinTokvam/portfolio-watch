import Database from "better-sqlite3";
import { AccessInfo, Account } from "../types";

const db = new Database(process.env.DB_PATH as string);
db.pragma("journal_mode = WAL");

function getAccessInfo(account_id: number) {
  const stmt = db.prepare(
    "SELECT account_key, username, password, last_edited FROM access_info WHERE account_id = ?"
  );
  return stmt.get(account_id) as AccessInfo;
}

export function insertAccessInfo(
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

export function updateAccountTotalValue(
  account_id: number,
  total_value: number
) {
  const stmt = db.prepare("UPDATE account SET total_value = ? WHERE id = ?");
  stmt.run(total_value, account_id);
}

export function insertAccountInDb(
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

export function deleteAccessInfo(account_id: number) {
  const stmt = db.prepare("DELETE FROM access_info WHERE account_id = ?");
  const res = stmt.run(account_id);
  if (res.changes === 0) {
    return false;
  }
  return true;
}

export function updateAccountDb(account: Account) {
    const stmt = db.prepare(
        "UPDATE account SET name = ?, account_type = ?, total_value = ?, is_automatic = ? WHERE id = ?"
    );
    stmt.run(
        account.name,
        account.account_type,
        account.total_value,
        account.is_automatic ? 1 : 0,
        account.id
    );
    if (account.is_automatic && account.access_info) {
        insertAccessInfo(account.created_at, account.id, account.access_info);
    }
}

export function deleteAccountInDb(id: number) {
    const stmt = db.prepare("DELETE FROM account WHERE id = ?");
    const res = stmt.run(id);
    if (res.changes === 0) {
      return false;
    }
    return true;
  }

function parseAccessInfo(access_info: string): AccessInfo {
  const obj = JSON.parse(access_info);
  return obj as AccessInfo;
}

export function getAccount(id: number) {
  const stmt = db.prepare("SELECT * FROM account WHERE id = ?");
  const res = stmt.get(id) as Account;
    if (!res) {
        return null;
    }
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