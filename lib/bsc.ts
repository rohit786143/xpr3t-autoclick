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
 * Converts decimal USDT string (e.g. "10") to 18-decimal wei BigInt.
 */
export function usdtToWei(amountStr: string): bigint {
  const [wholePart = "0", fracPart = ""] = amountStr.trim().split(".");
  const paddedFrac = (fracPart + "000000000000000000").slice(0, 18);
  return BigInt(wholePart) * BigInt("1000000000000000000") + BigInt(paddedFrac);
}

/**
 * Generates a universal BEP20 wallet QR code data URL.
 * Encodes only the clean wallet address so SafePal, Trust Wallet, MetaMask, and Binance
 * never throw "Invalid address" when scanning from their Send screen.
 */
export async function generateBep20PaymentQr(): Promise<string> {
  return QRCode.toDataURL(RECEIVER_WALLET, {
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
  from: string;
  valueWei: bigint;
  timestampMs: number;
}

const BSC_RPC_URLS = [
  "https://bsc-rpc.publicnode.com",
  "https://bsc.drpc.org",
  "https://bsc-dataseed.binance.org/",
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

/**
 * Fetches recent incoming BEP20 USDT transfers to RECEIVER_WALLET.
 * Uses BSC JSON-RPC (bsc-rpc.publicnode.com primary) with exact on-chain block timestamps,
 * and optional Etherscan/BscScan V2 API if BSCSCAN_API_KEY is configured.
 */
export async function fetchRecentIncomingUsdtTransfers(): Promise<IncomingBep20Transfer[]> {
  const rpcTransfers = await fetchViaBscRpc();
  if (rpcTransfers.length > 0) {
    return rpcTransfers;
  }

  const apiKey = process.env.BSCSCAN_API_KEY;
  if (apiKey) {
    try {
      const url = `https://api.etherscan.io/v2/api?chainid=56&module=account&action=tokentx&contractaddress=${USDT_BEP20_CONTRACT}&address=${RECEIVER_WALLET}&page=1&offset=50&sort=desc&apikey=${apiKey}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "1" && Array.isArray(data.result)) {
          const targetLower = RECEIVER_WALLET.toLowerCase();
          return data.result
            .filter((tx: { to?: string }) => tx.to?.toLowerCase() === targetLower)
            .map((tx: { hash: string; from: string; value: string; timeStamp: string }) => ({
              txHash: tx.hash.toLowerCase(),
              from: (tx.from || "").toLowerCase(),
              valueWei: BigInt(tx.value),
              timestampMs: Number(tx.timeStamp) * 1000,
            }));
        }
      }
    } catch {
      // Ignore API fallback error
    }
  }

  return [];
}

async function fetchViaBscRpc(): Promise<IncomingBep20Transfer[]> {
  const paddedTo =
    "0x000000000000000000000000" + RECEIVER_WALLET.slice(2).toLowerCase();

  for (const rpcUrl of BSC_RPC_URLS) {
    try {
      const latestHex: string = await rpcCall(rpcUrl, "eth_blockNumber", []);
      const latestBlock = parseInt(latestHex, 16);
      // Scan last 2500 blocks (~20-30 mins on BSC)
      const fromBlock = Math.max(0, latestBlock - 2500);

      const logs: Array<{
        transactionHash: string;
        topics: string[];
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

      if (!Array.isArray(logs)) continue;

      const blockTimeCache = new Map<string, number>();
      const transfers: IncomingBep20Transfer[] = [];

      for (const log of logs) {
        let timestampMs = blockTimeCache.get(log.blockNumber);
        if (!timestampMs) {
          try {
            const block = await rpcCall(rpcUrl, "eth_getBlockByNumber", [
              log.blockNumber,
              false,
            ]);
            timestampMs = block?.timestamp
              ? parseInt(block.timestamp, 16) * 1000
              : Date.now();
          } catch {
            timestampMs = Date.now();
          }
          blockTimeCache.set(log.blockNumber, timestampMs);
        }

        const fromTopic = log.topics?.[1] || "";
        const fromAddr =
          fromTopic.length === 66
            ? ("0x" + fromTopic.slice(26)).toLowerCase()
            : "";

        transfers.push({
          txHash: log.transactionHash.toLowerCase(),
          from: fromAddr,
          valueWei: BigInt(log.data),
          timestampMs,
        });
      }

      return transfers;
    } catch {
      continue;
    }
  }

  return [];
}
