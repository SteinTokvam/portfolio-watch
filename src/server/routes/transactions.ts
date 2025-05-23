import express from 'express';
import { deleteTransaction, fetchTransaction, fetchTransactions, insertTransaction, updateTransaction } from '../transactions';

const transactions_router = express.Router();


transactions_router.get("/", fetchTransactions);

transactions_router.get("/:id", fetchTransaction);

transactions_router.post("/new", insertTransaction);

transactions_router.put("/:id", updateTransaction);

transactions_router.delete("/:id", deleteTransaction)



export { transactions_router };