import express from 'express';
import { fetchAllEquityTypes, fetchEquityType, updateEquityTypeAllocation } from '../equity_types';

const equity_type_router = express.Router();

equity_type_router.get("/equity_types", fetchAllEquityTypes);

equity_type_router.get("/equity_types/:name", fetchEquityType);

equity_type_router.post("/equity_types/:name/:allocation", updateEquityTypeAllocation);


export { equity_type_router };