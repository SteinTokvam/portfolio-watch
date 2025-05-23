import { Request, Response } from "express";
import { deleteTransactionById, getAllTransactions, getTransactionById, getTransactionsForAccount, insertTransactionInDb, updateTransactionInDb } from "../db";
import { Transaction } from "../types";

export function fetchTransactions(req: Request, res: Response) {
  const transactions = getAllTransactions();
  if(!transactions) {
    res.status(404).json({ error: "No transactions found" });
    return;
  }
  res.status(200).json(transactions);
}

export function fetchTransaction(req: Request, res: Response) {
  const transaction_id = parseInt(req.params.id);
  if (isNaN(transaction_id)) {
    res.status(400).json({ error: "invalid transactionID" });
    return;
  }
  const transaction = getTransactionById(transaction_id);
  if (!transaction) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  res.status(200).json(transaction);
}

export function insertTransaction(req: Request, res: Response) {
  const { amount, name, transaction_type, transaction_date, unit_price, ticker_id, total_shares, equity_type, account_id } = req.body;
  if (!account_id || !equity_type || !amount || !transaction_date || !name || !transaction_type || !unit_price || !ticker_id || !total_shares) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }
  const transaction = {
    amount,
    name,
    transaction_type,
    transaction_date,
    unit_price,
    ticker_id,
    total_shares,
    equity_type,
    account_id
} as Transaction;

insertTransactionInDb(transaction);
  res.status(201).json({ message: "Transaction created successfully" });
}

export function updateTransaction(req: Request, res: Response) {
  const transaction_id = parseInt(req.params.id);
  if (isNaN(transaction_id)) {
    res.status(400).json({ error: "invalid transactionID" });
    return;
  }
  const transaction = getTransactionById(transaction_id);
  if (!transaction) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  const { amount, name, transaction_type, transaction_date, unit_price, ticker_id, total_shares, equity_type } = req.body;
  if (!amount || !transaction_date || !name || !transaction_type || !unit_price || !ticker_id || !total_shares || !equity_type) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }
  const updatedTransaction = {
    amount,
    name,
    transaction_type,
    transaction_date,
    unit_price,
    ticker_id,
    total_shares,
    equity_type,
    account_id: transaction.account_id
} as Transaction;

  updateTransactionInDb(updatedTransaction, transaction_id);
  res.status(200).json({ message: "Transaction updated successfully" });
}

export function deleteTransaction(req: Request, res: Response) {
  const transactionId = parseInt(req.params.id);
  if (isNaN(transactionId)) {
    res.status(400).json({ error: "invalid transactionID" });
    return;
  }

  const result = deleteTransactionById(transactionId);
    if (result) {
        res.status(200).json({ message: "Transaction deleted successfully" });
    } else {
        res.status(404).json({ error: "Transaction not found" });
    }
}