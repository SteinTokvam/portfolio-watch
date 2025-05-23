#!/usr/bin/env node
import dotenv from "dotenv";
import express from "express";

dotenv.config();

import { startJobs } from "./jobs/JobsService";
import { account_router } from "./server/routes/account";
import { equity_type_router } from "./server/routes/equity_types";
import { transactions_router } from "./server/routes/transactions";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const port = process.env.PORT || 3000;

app.use('/accounts', account_router);
app.use('/equity_types', equity_type_router);
app.use('/transactions', transactions_router);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

startJobs();
