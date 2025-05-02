import { getAllEquityTypes, getEquityType, updateEquityType } from "../db";
import { Request, Response } from 'express';


export function fetchAllEquityTypes (req: Request, res: Response) {
    const equityTypes = getAllEquityTypes();
    res.status(200).json(equityTypes);
  }

export function fetchEquityType(req: Request, res: Response) {
  const equityType = getEquityType(req.params.name);
  if (!equityType) {
    res.status(404).json({ error: "Equity type not found" });
    return;
  }
  res.status(200).json(equityType);
}

export function updateEquityTypeAllocation(req: Request, res: Response) {
    const name = req.params.name;
    const equityType = getEquityType(name);
    if (!equityType) {
      res.status(404).json({ error: "Equity type not found" });
      return;
    }
    const allocation = parseFloat(req.params.allocation);
    if (isNaN(allocation)) {
      res.status(400).json({ error: "Invalid allocation" });
      return;
    }
  
    const totalAllocation =
      getAllEquityTypes()
        .filter((equity_type) => equity_type.name !== name)
        .reduce((acc, equityType) => acc + equityType.wanted_allocation, 0) +
      allocation;
  
    if (allocation < 0 || allocation > 100 || totalAllocation > 100) {
      res.status(400).json({ error: "Allocation must be between 0 and 100" });
      return;
    }

    if (allocation === equityType.wanted_allocation) {
      res.status(200).json({ message: "No changes made" });
      return;
    }
  
    updateEquityType(name, allocation);
    res.status(200).json({ message: "Equity type updated" });
  }
