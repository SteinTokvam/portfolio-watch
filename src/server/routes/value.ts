import express from 'express';
import { rebalanceKron, totalValue, totalValueForType } from '../value';

const value_router = express.Router();

value_router.get("/all", totalValue);

value_router.get("/:account_type", totalValueForType)

value_router.get("/rebalance/kron", rebalanceKron)

export { value_router }