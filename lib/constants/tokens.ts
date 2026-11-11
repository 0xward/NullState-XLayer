/**
 * Token Configuration — stablecoins accepted by the app.
 *
 * USDC is the native USDC on X Layer; USDT is USDT0 (the bridged Tether on
 * X Layer). Both are 6-decimal USD-pegged stablecoins, so a USD price converts
 * 1:1 into either one — always use parseTokenAmount() / parseUnits(amount,
 * decimals) with the token's own decimals, never a hardcoded 18.
 *
 * The demo runs on X Layer TESTNET (chain 1952), where the payment and
 * reward token is tUSD — a 6-decimal test token deployed for the demo
 * (see MARKETPLACE_TOKENS below). USDC/USDT are the mainnet tokens, kept
 * in the table so the same code works when the app points at mainnet again.
 */

export const USDC_TOKEN = {
  name: 'USDC',
  symbol: 'USDC',
  fullName: 'USD Coin',
  description: 'Native USDC stablecoin on X Layer',

  // Contract Details — native USDC on X Layer mainnet
  address: '0xB6CEceAB302E2E4948951eE7843FC24E92933061',
  decimals: 6,

  // Logo & Branding
  logo: '/assets/tokens/usdc.png',
  logoFallback: '/assets/tokens/usdc.png',

  // Network
  chainId: 196, // X Layer Mainnet
  chainName: 'X Layer Mainnet',

  // Verification
  verified: true,
} as const;

/**
 * Format USDC amount for display
 * @param amount - Amount in smallest unit
 * @param decimals - Decimal places to show (default: 2)
 */
export function formatUSDC(amount: bigint | number, decimals: number = 2): string {
  const numAmount = typeof amount === 'bigint' ? Number(amount) : amount;
  const actualDecimals = USDC_TOKEN.decimals;
  const divisor = Math.pow(10, actualDecimals);
  const value = numAmount / divisor;

  return `${value.toFixed(decimals)} USDC`;
}

/**
 * Human-facing label for a token symbol/key. The internal identifier is the
 * symbol itself ('USDC' / 'USDT' / 'TUSD'), used as the MARKETPLACE_TOKENS key, the
 * MarketplaceTokenSymbol type, and the string sent to the payment-verify API.
 * Returned unchanged — the label and the identifier are the same string.
 */
export function tokenLabel(symbol?: string | null): string {
  return symbol ?? '';
}

/**
 * Brand logo (small, transparent PNG) for each marketplace token, keyed by the
 * internal token symbol/key. Rendered to the LEFT of the label in the
 * "Pay with" selectors (Marketplace + Crafting). Local assets so there's no
 * external fetch (compressed to ~64px). Unknown symbols return undefined.
 */
export const TOKEN_LOGOS: Record<string, string> = {
  USDC: '/assets/tokens/usdc.png',
  USDT: '/assets/tokens/usdt.png',
};

/**
 * Parse USDC string to smallest unit
 * @param amount - Amount in USDC (e.g., "1.5")
 */
export function parseUSDC(amount: string): bigint {
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) throw new Error('Invalid USDC amount');

  const actualDecimals = USDC_TOKEN.decimals;
  const multiplier = Math.pow(10, actualDecimals);

  return BigInt(Math.floor(numAmount * multiplier));
}

/**
 * Parse USDC smallest units to human-readable format
 */
export function parseUSDCReadable(amountInWei: bigint | number): number {
  const numAmount = typeof amountInWei === 'bigint' ? Number(amountInWei) : amountInWei;
  const actualDecimals = USDC_TOKEN.decimals;
  const divisor = Math.pow(10, actualDecimals);

  return numAmount / divisor;
}

/**
 * Marketplace-accepted stablecoins. All purchases are a plain ERC20
 * transfer() to the treasury wallet — no smart contract required. NOTE the
 * decimals: USDC/USDT/tUSD are all 6 — always use parseUnits(amount,
 * decimals).
 *
 * The demo runs on X Layer TESTNET (chain 1952): tUSD is the token players
 * actually hold and pay with there. USDC/USDT are the mainnet tokens, kept
 * so the same table works when the app points at mainnet again.
 *
 * Gas is paid in OKB, the native token. There is no fee-token abstraction on
 * X Layer: a player needs a small OKB balance to transact, whatever
 * stablecoin they pay with.
 */
export const TREASURY_WALLET = '0xAb73e0E942ecAAF634216EFb78786fa0F92f2eb6' as const;

export const MARKETPLACE_TOKENS = {
  USDC: { symbol: 'USDC', address: '0xB6CEceAB302E2E4948951eE7843FC24E92933061', decimals: 6 },
  USDT: { symbol: 'USDT', address: '0x779Ded0c9e1022225f8E0630b35a9b54bE713736', decimals: 6 },
  // tUSD — the testnet reward token (X Layer Testnet, chain 1952). The
  // payment/reward token on the testnet deployment; minted by the testnet
  // deploy script, held by players and the vault pool.
  TUSD: { symbol: 'TUSD', address: '0x3ff2324b603c079dd17506858856a9e4ab4af4e9', decimals: 6 },
} as const;

export type MarketplaceTokenSymbol = keyof typeof MARKETPLACE_TOKENS;

/**
 * Minimal read-only ERC20 ABI (balanceOf) shared by the balance check below.
 * Kept local to avoid importing the full ERC20_ABI (which also has write
 * methods) into a pure-read helper.
 */
const ERC20_READ_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

/**
 * Shared balance-comparison core used by pickBestPaymentToken() (used by
 * PassSBT minting — see hooks/usePassSBT.ts) and readStablecoinBalances().
 * Reads the connected wallet's accepted-token balances, normalizes each to 18
 * decimals so the 6-decimal balances are comparable 1:1, and returns the
 * symbol with the highest normalized balance. Returns null if every balance
 * reads as 0 or a balance read fails — callers decide their own fallback.
 */
async function pickBestTokenSymbol(
  publicClient: { readContract: (args: any) => Promise<unknown> } | undefined | null,
  userAddress: `0x${string}` | undefined,
): Promise<MarketplaceTokenSymbol | null> {
  if (!publicClient || !userAddress) return null;

  try {
    const symbols = Object.keys(MARKETPLACE_TOKENS) as MarketplaceTokenSymbol[];

    const balances = await Promise.all(
      symbols.map((symbol) => {
        const cfg = MARKETPLACE_TOKENS[symbol];
        return publicClient
          .readContract({
            address: cfg.address as `0x${string}`,
            abi: ERC20_READ_ABI,
            functionName: 'balanceOf',
            args: [userAddress],
          })
          .catch(() => BigInt(0)) as Promise<bigint>;
      }),
    );

    let bestSymbol: MarketplaceTokenSymbol | null = null;
    let bestNormalized = BigInt(0);

    symbols.forEach((symbol, i) => {
      const raw = (balances[i] ?? BigInt(0)) as bigint;
      if (raw <= BigInt(0)) return;
      const decimals = MARKETPLACE_TOKENS[symbol].decimals;
      const normalized = decimals < 18 ? raw * BigInt(10) ** BigInt(18 - decimals) : raw;
      if (normalized > bestNormalized) {
        bestNormalized = normalized;
        bestSymbol = symbol;
      }
    });

    return bestSymbol;
  } catch {
    return null;
  }
}

/**
 * Every accepted stablecoin balance, as a human number.
 *
 * pickBestTokenSymbol() above already reads all of them on the way to answering
 * "which does the user hold most of", then throws the amounts away. The shop's
 * "Pay with" selector was therefore offering tokens with no hint of what
 * the player actually has: the DEFAULT was correct, but a player who tapped a
 * token they hold none of learned that only by watching a transaction fail.
 *
 * Returns null per token when the balance cannot be read, so a UI can tell
 * "you have zero" apart from "we could not check" — the first is worth showing
 * as 0.00, the second is not worth showing at all. Never throws.
 */
export async function readStablecoinBalances(
  publicClient: { readContract: (args: any) => Promise<unknown> } | undefined | null,
  userAddress: `0x${string}` | undefined,
): Promise<Record<MarketplaceTokenSymbol, number | null>> {
  const empty = { USDC: null, USDT: null, TUSD: null } as Record<MarketplaceTokenSymbol, number | null>;
  if (!publicClient || !userAddress) return empty;

  const symbols = Object.keys(MARKETPLACE_TOKENS) as MarketplaceTokenSymbol[];
  const out = { ...empty };

  await Promise.all(
    symbols.map(async (symbol) => {
      const cfg = MARKETPLACE_TOKENS[symbol];
      try {
        const raw = (await publicClient.readContract({
          address: cfg.address as `0x${string}`,
          abi: ERC20_READ_ABI,
          functionName: 'balanceOf',
          args: [userAddress],
        })) as bigint;
        // Integer division for the whole part, remainder for the fraction —
        // Number(raw) on a large balance loses precision well before it
        // reaches a value anyone would spend.
        const d = BigInt(10) ** BigInt(cfg.decimals);
        out[symbol] = Number(raw / d) + Number(raw % d) / Number(d);
      } catch {
        out[symbol] = null;
      }
    }),
  );

  return out;
}

/**
 * Which stablecoin should PAY for a purchase (not gas) — the one the
 * connected wallet holds the most of, normalized across decimals. Used by
 * PassSBT minting (hooks/usePassSBT.ts) so a user isn't forced to hold
 * one specific token; falls back to 'TUSD' if the wallet holds none, or
 * if balances can't be read (RPC error, disconnected client) — the demo
 * runs on testnet, where tUSD is the token players can actually hold.
 * (When the app points at mainnet again, this fallback should go back
 * to 'USDC'.)
 */
export async function pickBestPaymentToken(
  publicClient: { readContract: (args: any) => Promise<unknown> } | undefined | null,
  userAddress: `0x${string}` | undefined,
): Promise<MarketplaceTokenSymbol> {
  const bestSymbol = await pickBestTokenSymbol(publicClient, userAddress);
  return bestSymbol ?? 'TUSD';
}

/** Parse a human amount (e.g. "2.5") into smallest units for a given token. */
export function parseTokenAmount(amount: string, symbol: MarketplaceTokenSymbol): bigint {
  const num = parseFloat(amount);
  if (isNaN(num)) throw new Error('Invalid token amount');
  const decimals = MARKETPLACE_TOKENS[symbol].decimals;
  // Avoid float precision loss by scaling via string.
  const [whole, frac = ''] = num.toFixed(decimals).split('.');
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt(whole + fracPadded);
}

export default USDC_TOKEN;
