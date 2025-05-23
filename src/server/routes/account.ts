import express from "express";
import { createAccount, deleteAccount, fetchAccount, fetchAccounts, updateAccount } from "../account";

const accountRouter = express.Router();

accountRouter.get("/", fetchAccounts);

accountRouter.get("/:account_id", fetchAccount);

accountRouter.post("/:account_id", updateAccount);

accountRouter.delete("/:account_id", deleteAccount);

accountRouter.put("/new", createAccount);

export { accountRouter };