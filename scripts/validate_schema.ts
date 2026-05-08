import { getFinancials } from "../lib/farmland-financials";
const tickers = ["LAND","FPI","ALCO","LMNR","AGRO","TSN","HRL","PPC","CALM","VITL","DAR","POST","DOLE","ADM","BG","NTR","CTVA","CF","MOS","CRESY","INGR","FRPT","MLP","AVD","GPRE","ALTO","SMG","ANDE","LW","FDP","AVO","CVGW"];
let fail = 0;
for (const t of tickers) {
  try {
    const r = getFinancials(t);
    if (!r) { console.log(`MISSING: ${t}`); fail++; }
  } catch (e) {
    console.log(`FAIL ${t}:`, (e as Error).message);
    fail++;
  }
}
console.log(fail === 0 ? "All schemas validated" : `${fail} failures`);
