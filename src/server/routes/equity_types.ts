import express from 'express';
import { fetchAllEquityTypes, fetchEquityType, updateEquityTypeAllocation } from '../equity_types';

const equity_type_router = express.Router();

equity_type_router.get("/", fetchAllEquityTypes);

equity_type_router.get("/:name", fetchEquityType);

equity_type_router.post("/:name/:allocation", updateEquityTypeAllocation);


export { equity_type_router };