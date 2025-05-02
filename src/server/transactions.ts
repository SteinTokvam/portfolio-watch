import { Request, Response } from "express";
import { deleteTransactionById, getAllTransactions } from "../db";

export function fetchTransactions(req: Request, res: Response) {
  const transactions = getAllTransactions();
  if(!transactions) {
    res.status(404).json({ error: "No transactions found" });
    return;
  }
  res.status(200).json(transactions);
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