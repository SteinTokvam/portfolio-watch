import Database from 'better-sqlite3';
import { AccessInfo, Account, Transaction } from './types';

const db = new Database('database.db');
db.pragma('journal_mode = WAL');

initDb();
//initAccounts();
function initDb() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS account (
        id INTEGER PRIMARY KEY autoincrement,
        created_at TEXT NOT NULL,
        name TEXT NOT NULL,
        account_type TEXT NOT NULL,
        total_value REAL NOT NULL,
        is_automatic INTEGER NOT NULL default 0
        );
    `);

    db.exec(`CREATE TABLE IF NOT EXISTS access_info (
        id INTEGER PRIMARY KEY autoincrement, 
        created_at TEXT NOT NULL, 
        account_id INTEGER NOT NULL, 
        access_key TEXT, 
        account_key TEXT, 
        username TEXT, 
        password TEXT, 
        FOREIGN KEY(account_id) REFERENCES account(id)
        )`);
    
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
}

function initAccounts() {
    insertAccount("2024-09-16 06:19:56.305148+00","Kron","Aksjesparekonto",55003.5448741145,true,JSON.stringify({access_key: "67faed48-2b2f-42c4-ae3e-12f1d78b8708", account_key: "ff16ab6d-159a-4c94-908a-6606370f4570"}))
    insertAccount("2025-02-06 11:14:55.158159+00","FundingPartner","Obligasjon",8000,true,JSON.stringify({username: "stto1210@gmail.com",password: "like8Not"}))
    insertAccount("2024-06-06 11:28:46.718726+00","Nordnet","Aksjesparekonto",23538.799483462484,false,null)
    insertAccount("2024-11-06 07:16:55.51106+00","Tangem","Kryptovaluta",9267.7596026015,false,null)
    insertAccount("2024-06-06 11:28:46.71627+00","Folkeinvest","Aksjefondskonto",2000,false,null)
    insertAccount("2024-08-27 13:59:06.445019+00","Bare Bitcoin","Kryptovaluta",4664.8327240515,true,JSON.stringify({access_key:"ota_OTI5ZDK5M2UTM2I5YS0ZODJLLTLMYJMTYWJLMGZLNDK4Y2FM"}))
}   


function insertAccessInfo(created_at: string, account_id: number, access_info: AccessInfo) {
    const stmt = db.prepare('INSERT INTO access_info (created_at, account_id, access_key, account_key, username, password) VALUES (?, ?, ?, ?, ?, ?)');
    stmt.run(created_at, account_id, access_info.access_key, access_info.account_key, access_info.username, access_info.password);
}


export function insertAccount(created_at: string, name: string, type: string, total_value: number, is_automatic: boolean, access_info: string | null) {
    const stmt = db.prepare('INSERT INTO account (created_at, name, account_type, total_value, is_automatic) VALUES (?, ?, ?, ?, ?)');
    const id = stmt.run(created_at, name, type, total_value, is_automatic ? 1 : 0).lastInsertRowid as number;
    if(is_automatic && access_info) {
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
    const stmt = db.prepare('SELECT access_key, account_key, username, password FROM access_info WHERE account_id = ?');
    return stmt.get(account_id) as AccessInfo;
}

export function getAccount(id: number) {
    const stmt = db.prepare('SELECT * FROM account WHERE id = ?');
    const res = stmt.get(id) as Account;
    if(res.is_automatic) {
        const access_info = getAccessInfo(id);
        res.access_info = access_info;
    }
    return res;
}

export function getTransactionsForAccount(account_id: number) {
    const stmt = db.prepare('SELECT * FROM account_transaction WHERE account_id = ?');
    return stmt.all(account_id) as Transaction[];
}
