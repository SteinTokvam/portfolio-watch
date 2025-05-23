import { Request, Response } from "express";
import { deleteAccessInfo, deleteAccountInDb, getAccount, getAccounts, insertAccessInfo, insertAccountInDb, updateAccountDb } from "../db";
import { AccessInfo } from "../types";


export function fetchAccounts(req: Request, res: Response) {
  const accounts = getAccounts();
  if (!accounts) {
    res.status(404).json({ error: "No accounts found" });
  }
  res.status(200).json(accounts.map(account => {
    return {
      ...account,
      access_info: null,
    }
  }));
}

export function fetchAccount(req: Request, res: Response) {
    const { account_id } = req.params;
    if (!account_id) {
        res.status(400).json({ error: "Account ID is required" });
        return;
    }
    const fetchedAccount = getAccount(parseInt(account_id as string));
    if(!fetchedAccount || !fetchedAccount.id) {
        res.status(404).json({ error: "Account not found" });
        return;
    }
    const account = {
        ...fetchedAccount,
        access_info: null,
    };
    if (!account) {
        res.status(404).json({ error: "Account not found" });
        return;
    }
    res.status(200).json(account);
}

export function updateAccount(req: Request, res: Response) {
    const { account_id } = req.params;
    if (!account_id) {
        res.status(400).json({ error: "Account ID is required" });
        return;
    }
    const account = getAccount(parseInt(account_id as string));
    if (!account || account === null) {
        res.status(404).json({ error: "Account not found" });
        return;
    }

    const { name, account_type, total_value, is_automatic, access_info } = req.body;
    if (!name || !account_type || !total_value || is_automatic === undefined) {
        res.status(400).json({ error: "All fields are required" });
        return;
    }
    if (is_automatic && !access_info) {
        res.status(400).json({ error: "Access info is required for automatic accounts" });
        return;
    }
    if (is_automatic && access_info) {
        const parsed_access_info = JSON.parse(access_info) as AccessInfo;
        updateAccountDb({
            name,
            account_type,
            total_value,
            is_automatic,
            access_info: parsed_access_info,
            created_at: account.created_at,
            id: account.id,
        })
        res.status(200).json({ message: "Account updated successfully" });
        return;
    }
    updateAccountDb({
        name,
        account_type,
        total_value,
        is_automatic,
        access_info: null,
        created_at: account.created_at,
        id: account.id,
    });
    res.status(200).json({ message: "Account updated successfully" });
}

export function deleteAccount(req: Request, res: Response) {
    const { account_id } = req.params;
    if (!account_id) {
        res.status(400).json({ error: "Account ID is required" });
        return;
    }
    const account = getAccount(parseInt(account_id as string));
    if (!account) {
        res.status(404).json({ error: "Account not found" });
        return;
    }
    if(account.is_automatic) {
        deleteAccessInfo(parseInt(account_id as string));
    }
    const deleted = deleteAccountInDb(parseInt(account_id as string));

    if (!deleted) {
        res.status(500).json({ error: "Account not deleted" });
        return;
    }
    res.status(200).json({ message: "Account deleted successfully" });
}

export function createAccount(req: Request, res: Response) {
    const { name, account_type, total_value, is_automatic, access_info } = req.body;
    if (!name || !account_type || !total_value || is_automatic === undefined) {
        res.status(400).json({ error: "All fields are required" });
        return;
    }
    if (is_automatic && !access_info) {
        res.status(400).json({ error: "Access info is required for automatic accounts" });
        return;
    }
    if (is_automatic && access_info) {
        insertAccountInDb(
            new Date().toISOString(),
            name,
            account_type,
            total_value,
            is_automatic,
            access_info
        )
        res.status(200).json({ message: "Account created successfully" });
        return;
    }

    insertAccountInDb(
        new Date().toISOString(),
        name,
        account_type,
        total_value,
        is_automatic,
        null
    )
    res.status(200).json({ message: "Account created successfully" });
}