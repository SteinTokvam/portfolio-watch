import express from 'express';
import { deleteTransaction, fetchTransaction, fetchTransactions } from '../transactions';

const transactions_router = express.Router();


transactions_router.get("/transactions", fetchTransactions);

transactions_router.get("/transactions/:id", fetchTransaction);

transactions_router.post("/transactions/new", insertTransaction);

transactions_router.put("/transactions/:id", updateTransaction);

transactions_router.delete("/transactions/:id", deleteTransaction)



export { transactions_router };