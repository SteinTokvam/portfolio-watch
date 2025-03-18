import { fetchKronHoldingGoalPercentage, insertKronGoalPercentage } from "../db";
import { Account, Holding, KronDevelopment, KronInterval, KronValue, TotalValue, Transaction } from "../types"

function getOptions(api_key: string) {
    return {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${api_key}`
        }
    }
}

async function getDevelopment(accessKey: string, account_id: string, interval: string): Promise<KronDevelopment> {
    return await fetch(`https://kron.no/api/v4/accounts/${account_id}/development?interval=${interval}`, getOptions(accessKey))
        .then(response => response.json())
        .then((response: any) => {
            return {
                data: {
                    currency: response.data.currency,
                    series: response.data.series.map((res: any) => {
                        return {
                            date: res.date,
                            market_value: res.market_value.value,
                            yield: res.yield.value,
                            return: res.return.value
                        }
                    })
                }
            }
            
    })
    .catch((error) => {
        console.error('Error:', error);
        console.error('Kanskje access key er utgått?');
        return {
            data: {
                currency: "NOK",
                series: []
            }
        }
    });
}


export const fetchTransactions = (accessKey: string, accountKey: number, account_id: string): Promise<Transaction> => fetch(`https://kron.no/api/accounts/${account_id}/transactions`, getOptions(accessKey))
        .then(response => response.json())
        .then((response: any) => response
            .filter((res: any) => res.type !== 'DEP' && res.status !== 'PROCESSING')
            .map((res: any) => {
                let type = ""
                switch(res.type) {
                    case 'SELL': 
                        type = 'SELL'
                        break
                    case 'BUY': 
                        type = 'BUY'
                        break
                    case 'ADD': 
                        type = 'BUY'
                        break
                    case 'REM': 
                        type = 'SELL'
                        break
                    default: 
                        type = res.type
                        break
                }
            return {
                amount: res.amount,
                name: type === 'FEE' ? 'Plattformavgift' : res.fund_name,
                transaction_type: type,
                transaction_date: res.date,
                ticker_id: res.id,
                account_id: accountKey,
                unit_price: 0,
                total_shares: 0,
                equity_type: "Fund",
            } 
        }))
        .catch((error) => {
            console.error('Error:', error);
            console.error('Kanskje access key er utgått?');
            return []
        });

export async function fetchKronTotalValue(accessKey: string, account_id: string, interval: KronInterval): Promise<TotalValue> {
    return await getDevelopment(accessKey, account_id, interval)
    .then(response => {
        const ret = response.data.series.pop()
        return ret ? {
            account_name: "Kron",
            market_value: parseFloat(ret.market_value.toFixed(2)),
            yield: ret.yield,
            return: ret.return,
            equity_type: "FUND"
        } 
        : {
            account_name: "Kron", 
            market_value: 0, 
            yield: 0, 
            return: 0,
            equity_type: "FUND"
        } as TotalValue
    })
};

export async function fetchKronHoldings(account: Account): Promise<Holding[]> {
    const lastValueInDevelopment = (await getDevelopment(account.access_info?.access_key as string, account.access_info?.account_key as string, "1W")).data.series.pop()
    const totalValue = lastValueInDevelopment ? lastValueInDevelopment.market_value : 0
    
    return await fetch(`https://kron.no/api/accounts/${account.access_info?.account_key}/position-performances`, getOptions(account.access_info?.access_key as string))
        .then(response => response.json())
        .then((response: any) => {
            const holdings = response.map((res: any) => {
                return {
                    name: res.security_name,
                    accountKey: account.id,
                    equityShare: res.units,
                    equityType: "FUND",
                    value: res.market_value,
                    goalPercentage: fetchKronHoldingGoalPercentage(account, res.security_name),
                    yield: res.profit,
                    isin: res.isin,
                }
            })

            if(holdings.reduce((a: any, b: any) => a + b.value, 0) < totalValue) {
                holdings.push({
                    name: "Kontanter",
                    accountKey: account.id,
                    equityShare: 1,
                    equityType: "FUND",
                    value: totalValue - holdings.reduce((a: any, b: any) => a + b.value, 0),
                    goalPercentage: 0,
                    yield: 0,
                    isin: "",
                })
            }
            
            return holdings.map((holding: Holding) => {
                return {
                    ...holding,
                    currentPercentage: parseFloat(((holding.value/totalValue)*100).toFixed(2))
                }
            })
        })
};

export async function fetchDevelopment(accessKey: string, account_id: string, interval: string): Promise<KronDevelopment> {
    return await getDevelopment(accessKey, account_id, interval)
};