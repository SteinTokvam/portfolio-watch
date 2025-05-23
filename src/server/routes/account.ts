import express from "express";
import { createAccount, deleteAccount, fetchAccount, fetchAccounts, updateAccount } from "../account";

const account_router = express.Router();

account_router.get("/", fetchAccounts);

account_router.get("/:account_id", fetchAccount);

account_router.post("/:account_id", updateAccount);

account_router.delete("/:account_id", deleteAccount);

account_router.put("/new", createAccount);

export { account_router };