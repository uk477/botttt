import { ENV } from "../env.js";
import { matchTransaction, type IncomingTx } from "./matcher.js";

const USDT_CONTRACT = "0xdAC17F958D2ee523a2206206994597C13D831ec7".toLowerCase();
const USDC_CONTRACT = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48".toLowerCase();
const BASE = "https://api.etherscan.io/api";

interface EtherscanTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenDecimal?: string;
  contractAddress?: string;
  blockNumber: string;
  timeStamp: string;
}

let lastBlockErc20 = "0";
let lastBlockEth = "0";

async function apiCall(params: Record<string, string>): Promise<EtherscanTx[]> {
  const qs = new URLSearchParams({
    ...params,
    ...(ENV.etherscanKey ? { apikey: ENV.etherscanKey } : {}),
  });
  const res = await fetch(`${BASE}?${qs}`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return [];
  const body = (await res.json()) as { status: string; result: EtherscanTx[] | string };
  if (body.status !== "1" || !Array.isArray(body.result)) return [];
  return body.result;
}

export async function checkEthereumErc20(): Promise<void> {
  const addrErc20 = ENV.addr.erc20;
  const addrUsdcEth = ENV.addr.usdc_eth;
  const addr = addrErc20 || addrUsdcEth;
  if (!addr) return;

  try {
    const txs = await apiCall({
      module: "account",
      action: "tokentxlist",
      address: addr,
      startblock: lastBlockErc20,
      endblock: "99999999",
      sort: "desc",
      page: "1",
      offset: "30",
    });

    for (const tx of txs) {
      if (tx.to.toLowerCase() !== addr.toLowerCase()) continue;
      const contract = (tx.contractAddress ?? "").toLowerCase();

      let network: string | null = null;
      if (contract === USDT_CONTRACT && addrErc20) network = "erc20";
      else if (contract === USDC_CONTRACT && addrUsdcEth) network = "usdc_eth";
      if (!network) continue;

      const decimals = Number(tx.tokenDecimal ?? "6");
      const amount = Number(tx.value) / 10 ** decimals;

      const incoming: IncomingTx = {
        tx_hash: tx.hash,
        network,
        from_addr: tx.from,
        to_addr: tx.to,
        amount,
        token: network === "erc20" ? "USDT" : "USDC",
        block: Number(tx.blockNumber),
        ts: new Date(Number(tx.timeStamp) * 1000).toISOString(),
      };

      matchTransaction(incoming);
    }

    if (txs.length > 0) {
      lastBlockErc20 = txs[0].blockNumber;
    }
  } catch (e) {
    console.error("[ethereum-erc20] check error:", e);
  }
}

export async function checkEthereumNative(): Promise<void> {
  const addr = ENV.addr.eth;
  if (!addr) return;

  try {
    const txs = await apiCall({
      module: "account",
      action: "txlist",
      address: addr,
      startblock: lastBlockEth,
      endblock: "99999999",
      sort: "desc",
      page: "1",
      offset: "20",
    });

    for (const tx of txs) {
      if (tx.to.toLowerCase() !== addr.toLowerCase()) continue;

      const amount = Number(tx.value) / 1e18;
      if (amount <= 0) continue;

      const incoming: IncomingTx = {
        tx_hash: tx.hash,
        network: "eth",
        from_addr: tx.from,
        to_addr: tx.to,
        amount,
        token: "ETH",
        block: Number(tx.blockNumber),
        ts: new Date(Number(tx.timeStamp) * 1000).toISOString(),
      };

      matchTransaction(incoming);
    }

    if (txs.length > 0) {
      lastBlockEth = txs[0].blockNumber;
    }
  } catch (e) {
    console.error("[ethereum-native] check error:", e);
  }
}
