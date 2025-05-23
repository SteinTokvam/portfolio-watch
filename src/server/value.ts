import { Request, Response } from "express";
import { getAccount, getAccounts } from "../db";
import { calculateAccountValues } from "../investments";
import { calculateKronRebalance } from "../utils/stock";

export async function totalValue(req: Request, res: Response) {
    const accounts = getAccounts()
    const total_values = await calculateAccountValues(accounts)
    res.status(200).json({
        accounts: total_values,
        totalValue: total_values.map(total => total.market_value).reduce((a,b) => a + b)
    })
}

export async function totalValueForType(req: Request, res: Response) {
    const { account_type } = req.params
    if(!account_type) {
        res.status(400).json({message: "account_type not provided"})
    }

    var equity_type = ""
    switch(account_type) {
        case "CRYPTOCURRENCY": 
            equity_type = "CRYPTOCURRENCY"; 
            break;
        case "Aksjesparekonto": 
            equity_type = "FUND"; 
            break;
        case "LOAN":
            equity_type = "LOAN";
            break;
        case "Aksjefondskonto":
            equity_type = "STOCK";
            break;
    }

    const filteredAccounts = getAccounts().filter(account => account.account_type === account_type)

    const total_values = await calculateAccountValues(filteredAccounts)


    if(total_values.length === 0) {
        res.status(200).json({})
        return;
    }
    res.status(200).json({
        accounts: total_values,
        totalValue: total_values.map(total => total.market_value).reduce((a,b) => a + b)
    })
}

export async function rebalanceKron(req: Request, res: Response) {
    const { new_money } = req.query

    const account = getAccount(1)
    if(!account) {
        res.status(404).json({message: "Not found"})
        return
    }
    
    const funds = await calculateKronRebalance(account, parseInt(new_money as string))

    res.send(
        funds.map(fund => {
            return {
                name: fund.name,
                to_buy: parseInt(fund.to_buy.toFixed(0))
            }
        })
    )
}