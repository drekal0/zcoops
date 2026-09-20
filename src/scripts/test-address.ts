import { validateZcashAddress } from "@/wallet/address";
import { mintUnified, mintSapling, mintTransparentTest, mintTransparentMainnet } from "./mint-address";

let pass = 0, fail = 0;
function check(name: string, cond: boolean) { cond ? pass++ : (fail++, console.log("  ✗", name)); }

const uMain = mintUnified("mainnet");
const uTest = mintUnified("testnet");
const zsMain = mintSapling("mainnet");
const tmTest = mintTransparentTest();
const t1Main = mintTransparentMainnet();

console.log("minted:", { uMain: uMain.slice(0,14)+"…", uTest: uTest.slice(0,14)+"…", tmTest, t1Main });

check("UA mainnet ok on mainnet pool", validateZcashAddress(uMain, "mainnet").ok);
check("UA mainnet rejected on testnet pool", !validateZcashAddress(uMain, "testnet").ok);
check("UA testnet ok on testnet pool", validateZcashAddress(uTest, "testnet").ok);
check("UA testnet rejected on regtest pool (distinct HRP)", !validateZcashAddress(uTest, "regtest").ok);
check("UA regtest ok on regtest pool", validateZcashAddress(mintUnified("regtest"), "regtest").ok);
check("sapling mainnet ok on mainnet", validateZcashAddress(zsMain, "mainnet").ok);
check("t-addr test ok on testnet", validateZcashAddress(tmTest, "testnet").ok);
check("t-addr test ok on regtest", validateZcashAddress(tmTest, "regtest").ok);
check("t-addr test rejected on mainnet", !validateZcashAddress(tmTest, "mainnet").ok);
check("t1 mainnet ok on mainnet", validateZcashAddress(t1Main, "mainnet").ok);
check("t1 mainnet rejected on testnet", !validateZcashAddress(t1Main, "testnet").ok);
// corruption → checksum fails
check("corrupted UA rejected", !validateZcashAddress(uMain.slice(0, -1) + (uMain.endsWith("q") ? "p" : "q"), "mainnet").ok);
check("garbage rejected", !validateZcashAddress("not-an-address", "mainnet").ok);
check("empty rejected", !validateZcashAddress("", "mainnet").ok);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
