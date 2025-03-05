export type Account = {
    id: number,
    created_at: string,
    name: string,
    account_type: string,
    total_value: number,
    is_automatic: boolean,
    access_info: AccessInfo | null
}

export type AccessInfo = {
    access_key: string | null,
    account_key: string | null,
    username: string | null, 
    password: string | null
}

export type KronValue = {
    date: string,
    market_value: number,
    yield: number
    return: number
}

export type KronDevelopment = {
    data: {
        currency: string,
        series: KronValue[]
    }
}

export type Holding = {
    name: string,
    accountKey: number,
    equityShare: number,
    equityType: string,
    value: number,
    goalPercentage: number,
    yield: number,
    isin: number,
}

export type Transaction = {
    amount: number,
    name: string,
    transaction_type: string,
    transaction_date: string,
    unit_price: number,
    ticker_id: string,
    total_shares: number,
    equity_type: string,
    account_id: number
}

export type KronInterval = '1W' | '1M' | '3M' | '6M' | 'year-to-date' | '1Y' | '3Y' | '5Y' | 'total'