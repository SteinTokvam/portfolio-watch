#!/usr/bin/env node
import dotenv from "dotenv";
import express from "express";

dotenv.config();

import { startJobs } from "./jobs/JobsService";
import { fetchAllEquityTypes, fetchEquityType, updateEquityTypeAllocation } from "./server/equity_types";
import { deleteTransaction, fetchTransactions } from "./server/transactions";
import { setToken } from "./server/token";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/equity_types", fetchAllEquityTypes);

app.get("/equity_types/:name", fetchEquityType);

app.post("/equity_types/:name/:allocation", updateEquityTypeAllocation);

app.get("/transactions", fetchTransactions);

app.delete("/transactions/:id", deleteTransaction)

app.post("/token/set", setToken);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

startJobs();
