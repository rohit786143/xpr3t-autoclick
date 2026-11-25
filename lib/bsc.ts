import QRCode from "qrcode";

export const RECEIVER_WALLET = "0x1c3Fe2bD2a2F0D2Ce35E45762B2Ae60A2c83D9c2";
export const USDT_BEP20_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";
export const ORDER_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface SubscriptionPlan {
  days: number;
  baseUsd: number;
  label: string;
}

export const SUBSCRIPTION_PLANS: Record<number, SubscriptionPlan> = {
  30: { days: 30, baseUsd: 1, label: "30 Days" },
  65: { days: 65, baseUsd: 2, label: "65 Days" },
  100: { days: 100, baseUsd: 3, label: "100 Days" },
  200: { days: 200, baseUsd: 6, label: "200 Days" },
  365: { days: 365, baseUsd: 10, label: "365 Days" },
};

/**
 * Converts decimal USDT string (e.g. "1.014") to 18-decimal wei BigInt.
 */
export function usdtToWei(amountStr: string): bigint {
  const [wholePart = "0", fracPart = ""] = amountStr.trim().split(".");
  const paddedFrac = (fracPart + "000000000000000000").slice(0, 18);
  return BigInt(wholePart) * BigInt("1000000000000000000") + BigInt(paddedFrac);
}

/**
 * Generates an EIP-681 BEP20 USDT payment QR data URL with recipient and exact amount encoded.
 * Does NOT expose the wallet address text separately in the UI.
 */
export async function generateBep20PaymentQr(amountStr: string): Promise<string> {
  const weiAmount = usdtToWei(amountStr).toString();
  const uri = `ethereum:${USDT_BEP20_CONTRACT}@56/transfer?address=${RECEIVER_WALLET}&uint256=${weiAmount}`;
  return QRCode.toDataURL(uri, {
    width: 280,
    margin: 2,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });
}

export interface IncomingBep20Transfer {
  txHash: string;
  valueWei: bigint;
  timestampMs: number;
}

/**
 * Fetches recent incoming BEP20 USDT transfers to RECEIVER_WALLET.
 * Tries BscScan API first (using BSCSCAN_API_KEY if configured), then falls back to public BSC RPC.
 */
export async function fetchRecentIncomingUsdtTransfers(): Promise<IncomingBep20Transfer[]> {
  const apiKey = process.env.BSCSCAN_API_KEY || "";
  const bscScanUrl = `https://api.bscscan.com/api?module=account&action=tokentx&contractaddress=${USDT_BEP20_CONTRACT}&address=${RECEIVER_WALLET}&page=1&offset=50&sort=desc${
    apiKey ? `&apikey=${apiKey}` : ""
  }`;

  try {
    const res = await fetch(bscScanUrl, {
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (data.status === "1" && Array.isArray(data.result)) {
        const targetLower = RECEIVER_WALLET.toLowerCase();
        return data.result
          .filter((tx: { to?: string }) => tx.to?.toLowerCase() === targetLower)
          .map((tx: { hash: string; value: string; timeStamp: string }) => ({
            txHash: tx.hash.toLowerCase(),
            valueWei: BigInt(tx.value),
            timestampMs: Number(tx.timeStamp) * 1000,
          }));
      }
    }
  } catch {
    // Fall back to BSC public JSON-RPC below
  }

  return fetchViaBscRpc();
}

const BSC_RPC_URLS = [
  "https://bsc-dataseed.binance.org/",
  "https://bsc-dataseed1.defibit.io/",
];

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

async function rpcCall(url: string, method: string, params: unknown[]) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "RPC error");
  return data.result;
}

async function fetchViaBscRpc(): Promise<IncomingBep20Transfer[]> {
  const paddedTo =
    "0x000000000000000000000000" + RECEIVER_WALLET.slice(2).toLowerCase();

  for (const rpcUrl of BSC_RPC_URLS) {
    try {
      const latestHex: string = await rpcCall(rpcUrl, "eth_blockNumber", []);
      const latestBlock = parseInt(latestHex, 16);
      const fromBlock = Math.max(0, latestBlock - 450); // ~22 mins of BSC blocks (3s/block)

      const logs: Array<{
        transactionHash: string;
        data: string;
        blockNumber: string;
      }> = await rpcCall(rpcUrl, "eth_getLogs", [
        {
          address: USDT_BEP20_CONTRACT,
          fromBlock: "0x" + fromBlock.toString(16),
          toBlock: "0x" + latestBlock.toString(16),
          topics: [TRANSFER_TOPIC, null, paddedTo],
        },
      ]);

      if (!Array.isArray(logs)) return [];

      const nowMs = Date.now();
      return logs.map((log) => {
        const blockNum = parseInt(log.blockNumber, 16);
        const approxAgeMs = Math.max(0, latestBlock - blockNum) * 3000;
        return {
          txHash: log.transactionHash.toLowerCase(),
          valueWei: BigInt(log.data),
          timestampMs: nowMs - approxAgeMs,
        };
      });
    } catch {
      continue;
    }
  }

  return [];
}
