import { getAccount } from "./db";
import { Account, KronDevelopment, KronInterval } from "./types";
import { fetchDevelopment, fetchHoldings, fetchTotalValue, fetchTransactions } from "./utils/kron";

const kron = getAccount(1) as Account;
const fundingPartner = getAccount(2) as Account;
const nordnet = getAccount(3) as Account;
const tangem = getAccount(4) as Account;
const folkeinvest = getAccount(5) as Account;
const bareBitcoin = getAccount(6) as Account;
console.log(kron);
console.log(fundingPartner);
console.log(nordnet);
console.log(tangem);
console.log(folkeinvest);
console.log(bareBitcoin);

if(kron.access_info && kron.access_info.access_key && kron.access_info.account_key) {
    fetchHoldings(kron.access_info.access_key, kron.id, kron.access_info.account_key).then(response => console.log(response))
}