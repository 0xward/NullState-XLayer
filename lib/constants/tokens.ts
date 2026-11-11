/**
 * Token Configuration — stablecoins accepted on X Layer (chain 196).
 *
 * USDC is the native USDC on X Layer; USDT is USDT0 (the bridged Tether on
 * X Layer). Both are 6-decimal USD-pegged stablecoins, so a USD price converts
 * 1:1 into either one — always use parseTokenAmount() / parseUnits(amount,
 * decimals) with the token's own decimals, never a hardcoded 18.
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
 * symbol itself ('USDC' / 'USDT'), used as the MARKETPLACE_TOKENS key, the
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
 * Marketplace-accepted stablecoins on X Layer Mainnet (196).
 * All purchases are a plain ERC20 transfer() to the treasury wallet — no
 * smart contract required. NOTE the decimals: USDC/USDT are both 6 — always
 * use parseUnits(amount, decimals).
 *
 * Gas is paid in OKB, the native token. There is no fee-token abstraction on
 * X Layer: a player needs a small OKB balance to transact, whatever
 * stablecoin they pay with.
 */
export const TREASURY_WALLET = '0xAb73e0E942ecAAF634216EFb78786fa0F92f2eb6' as const;

export const MARKETPLACE_TOKENS = {
  USDC: { symbol: 'USDC', address: '0xB6CEceAB302E2E4948951eE7843FC24E92933061', decimals: 6 },
  USDT: { symbol: 'USDT', address: '0x779Ded0c9e1022225f8E0630b35a9b54bE713736', decimals: 6 },
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
 * Reads the connected wallet's USDC/USDT balances, normalizes each to 18
 * decimals so the two 6-decimal balances are comparable 1:1, and returns the
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
  const empty = { USDC: null, USDT: null } as Record<MarketplaceTokenSymbol, number | null>;
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
 * USDC specifically; falls back to 'USDC' if the wallet holds neither,
 * or if balances can't be read (RPC error, disconnected client).
 */
export async function pickBestPaymentToken(
  publicClient: { readContract: (args: any) => Promise<unknown> } | undefined | null,
  userAddress: `0x${string}` | undefined,
): Promise<MarketplaceTokenSymbol> {
  const bestSymbol = await pickBestTokenSymbol(publicClient, userAddress);
  return bestSymbol ?? 'USDC';
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
