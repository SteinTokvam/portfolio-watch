import express from 'express';
import { deleteTransaction, fetchTransactions } from '../transactions';

const transactions_router = express.Router();


transactions_router.get("/transactions", fetchTransactions);

transactions_router.delete("/transactions/:id", deleteTransaction)

export { transactions_router };