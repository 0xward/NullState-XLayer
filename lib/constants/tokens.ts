/**
 * Token Configuration
 * USDm (Mento Dollar) - Official Celo Mainnet Token
 * Formerly known as cUSD
 */

export const USDM_TOKEN = {
  name: 'USDm',
  symbol: 'USDm',
  fullName: 'Mento Dollar',
  description: 'Official stablecoin on Celo network',
  
  // Contract Details
  address: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
  decimals: 18,
  
  // Logo & Branding - Official Mento/Celo logo
  logo: 'https://token-logos-static.s3.amazonaws.com/USDm.png',
  logoFallback: '/assets/tokens/usdm.png', // Local fallback if the S3 logo fails
  
  // Network
  chainId: 42220, // Celo Mainnet
  chainName: 'Celo Mainnet',
  
  // Verification
  verified: true,
  source: 'https://docs.celo.org/tooling/contracts/token-contracts',
  historicalName: 'cUSD (Celo Dollar)',
  migratedTo: 'USDm (Mento Dollar)',
} as const;

/**
 * Format USDm amount for display
 * @param amount - Amount in smallest unit (wei)
 * @param decimals - Decimal places to show (default: 2)
 */
export function formatUSDm(amount: bigint | number, decimals: number = 2): string {
  const numAmount = typeof amount === 'bigint' ? Number(amount) : amount;
  const actualDecimals = USDM_TOKEN.decimals;
  const divisor = Math.pow(10, actualDecimals);
  const value = numAmount / divisor;
  
  return `${value.toFixed(decimals)} USDM`;
}

/**
 * Human-facing label for a token symbol/key. The internal identifier for the
 * Mento Dollar is 'USDm' (used as the MARKETPLACE_TOKENS key, the
 * MarketplaceTokenSymbol type, and the string sent to the payment-verify API),
 * but the brand is written 'USDM' everywhere the player can see it. Keep the
 * identifier untouched and pass it through this at every DISPLAY site so the
 * two never drift. USDC/USDT are returned unchanged.
 */
export function tokenLabel(symbol?: string | null): string {
  return symbol === 'USDm' ? 'USDM' : (symbol ?? '');
}

/**
 * Brand logo (small, transparent PNG) for each marketplace token, keyed by the
 * internal token symbol/key. Rendered to the LEFT of the label in the
 * "Pay with" selectors (Marketplace + Crafting). Local assets so there's no
 * external fetch (compressed to ~64px). Unknown symbols return undefined.
 */
export const TOKEN_LOGOS: Record<string, string> = {
  USDm: '/assets/tokens/usdm.png',
  USDC: '/assets/tokens/usdc.png',
  USDT: '/assets/tokens/usdt.png',
};

/**
 * Parse USDm string to smallest unit (wei)
 * @param amount - Amount in USDm (e.g., "1.5")
 */
export function parseUSDm(amount: string): bigint {
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) throw new Error('Invalid USDm amount');
  
  const actualDecimals = USDM_TOKEN.decimals;
  const multiplier = Math.pow(10, actualDecimals);
  
  return BigInt(Math.floor(numAmount * multiplier));
}

/**
 * Parse USDm wei to human-readable format
 */
export function parseUSDmReadable(amountInWei: bigint | number): number {
  const numAmount = typeof amountInWei === 'bigint' ? Number(amountInWei) : amountInWei;
  const actualDecimals = USDM_TOKEN.decimals;
  const divisor = Math.pow(10, actualDecimals);
  
  return numAmount / divisor;
}

/**
 * Marketplace-accepted stablecoins on Celo Mainnet (42220).
 * All purchases are a plain ERC20 transfer() to the treasury wallet — no
 * smart contract required (confirmed by MiniPay docs). NOTE the decimals:
 * USDC/USDT are 6, USDm is 18 — always use parseUnits(amount, decimals).
 */
export const TREASURY_WALLET = '0xAb73e0E942ecAAF634216EFb78786fa0F92f2eb6' as const;

// `feeCurrency` (CIP-64 Celo Dynamic Fee v2) lets a MiniPay user pay gas in a
// stablecoin instead of native CELO. Per docs.minipay.xyz/technical-references/
// send-transaction.html, SOME tokens need a separate "fee adapter" contract
// address instead of the token address itself — using the raw token address
// as feeCurrency for an adapter-token is WRONG and MiniPay will reject/ignore
// it. `feeCurrency` below is the address to actually pass; for adapter-less
// tokens (USDm) it's identical to `address`.
export const MARKETPLACE_TOKENS = {
  USDm: { symbol: 'USDm', address: '0x765DE816845861e75A25fCA122bb6898B8B1282a', decimals: 18, feeCurrency: '0x765DE816845861e75A25fCA122bb6898B8B1282a' },
  USDC: { symbol: 'USDC', address: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C', decimals: 6,  feeCurrency: '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B' }, // USDC fee ADAPTER, not the USDC token address
  USDT: { symbol: 'USDT', address: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e', decimals: 6,  feeCurrency: '0x0E2A3e05bc9A16F5292A6170456A710cb89C6f72' }, // USD₮ fee ADAPTER, not the USDT token address
} as const;

export type MarketplaceTokenSymbol = keyof typeof MARKETPLACE_TOKENS;

/**
 * Default feeCurrency to attach to non-marketplace transactions (contract
 * writes paid in native CELO, e.g. register()/executeAction()/mintFreePass()).
 * MiniPay users mostly hold stablecoins, not CELO, so letting them pay GAS in
 * USDm (even when the tx `value`/payload is native CELO or a different token)
 * avoids "insufficient funds for gas" when their CELO balance is wafer-thin.
 * MiniPay "may ignore feeCurrency and choose the token the user has the most
 * of" (per docs.minipay.xyz/technical-references/send-transaction.html) — this
 * is a best-effort hint, not a guarantee. It is also the FALLBACK value used
 * by `pickBestFeeCurrency()` below when balance detection isn't possible
 * (RPC error, disconnected client, or every stablecoin balance reads as 0).
 */
export const DEFAULT_FEE_CURRENCY = '0x765DE816845861e75A25fCA122bb6898B8B1282a' as `0x${string}`; // USDm, no adapter needed

/**
 * Minimal read-only ERC20 ABI (balanceOf) shared by the balance check below.
 * Kept local to avoid importing the full USDM_ABI (which also has write
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
 * Dynamic feeCurrency selection ("dynamic adaptation" pattern recommended at
 * docs.minipay.xyz/technical-references/retrieve-balance.html: "adapt to the
 * user's preferred stablecoin, e.g. the one with the highest balance").
 *
 * Reads the user's USDm/USDC/USDT balance (using the plain TOKEN address for
 * balanceOf, per docs.minipay.xyz — NOT the adapter address; adapters are
 * only for the feeCurrency field itself), compares them on a normalized
 * (decimal-adjusted) basis since USDC/USDT use 6 decimals and USDm uses 18,
 * and returns the correct feeCurrency address for whichever token the user
 * holds the most of:
 *   - USDm  -> its own token address (no adapter)
 *   - USDC  -> the USDC FeeCurrencyAdapter address
 *   - USDT  -> the USDT FeeCurrencyAdapter address
 *
 * Falls back to DEFAULT_FEE_CURRENCY (USDm) if `publicClient` is missing, any
 * balance read fails, or every balance comes back as 0 — never throws, so
 * callers can always safely spread the result into a writeContract/
 * sendTransaction call.
 *
 * NOTE: MiniPay itself may still override this and pick whatever the user
 * actually holds the most of regardless of what we pass (see DEFAULT_FEE_
 * CURRENCY comment above) — this function exists so the *correct* value is
 * still sent for wallets that don't do that override (Valora, WalletConnect,
 * etc.), and so the on-chain tx doesn't fail for a MiniPay user in the rare
 * case MiniPay does respect our hint.
 */
/**
 * Shared balance-comparison core used by both pickBestFeeCurrency() (below)
 * and pickBestPaymentToken() (used by PassSBT minting — see
 * hooks/usePassSBT.ts). Reads the connected wallet's USDm/USDC/USDT
 * balances, normalizes each to 18 decimals so a 6-decimal USDC/USDT balance
 * is comparable 1:1 against an 18-decimal USDm balance, and returns the
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
 * pickBestTokenSymbol() above already reads all three on the way to answering
 * "which does the user hold most of", then throws the amounts away. The shop's
 * "Pay with" selector was therefore offering three tokens with no hint of what
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
  const empty = { USDm: null, USDC: null, USDT: null } as Record<MarketplaceTokenSymbol, number | null>;
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
        // Number(raw) on an 18-decimal balance loses precision well before it
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

export async function pickBestFeeCurrency(
  publicClient: { readContract: (args: any) => Promise<unknown> } | undefined | null,
  userAddress: `0x${string}` | undefined,
): Promise<`0x${string}`> {
  const bestSymbol = await pickBestTokenSymbol(publicClient, userAddress);
  if (!bestSymbol) return DEFAULT_FEE_CURRENCY; // no client/address, read failed, or user holds none of the 3 — fall back to USDm
  return getFeeCurrency(bestSymbol);
}

/**
 * Which stablecoin should PAY for a purchase (not gas) — the one the
 * connected wallet holds the most of, normalized across decimals. Used by
 * PassSBT minting (hooks/usePassSBT.ts) so a user isn't forced to hold
 * USDm specifically; falls back to 'USDm' if the wallet holds none of the
 * 3, or if balances can't be read (RPC error, disconnected client).
 */
export async function pickBestPaymentToken(
  publicClient: { readContract: (args: any) => Promise<unknown> } | undefined | null,
  userAddress: `0x${string}` | undefined,
): Promise<MarketplaceTokenSymbol> {
  const bestSymbol = await pickBestTokenSymbol(publicClient, userAddress);
  return bestSymbol ?? 'USDm';
}

/** Look up the correct feeCurrency address for a marketplace token symbol. */
export function getFeeCurrency(symbol: MarketplaceTokenSymbol): `0x${string}` {
  return MARKETPLACE_TOKENS[symbol].feeCurrency as `0x${string}`;
}

/** Parse a human amount (e.g. "2.5") into smallest units for a given token. */
export function parseTokenAmount(amount: string, symbol: MarketplaceTokenSymbol): bigint {
  const num = parseFloat(amount);
  if (isNaN(num)) throw new Error('Invalid token amount');
  const decimals = MARKETPLACE_TOKENS[symbol].decimals;
  // Avoid float precision loss for 18-decimal tokens by scaling via string.
  const [whole, frac = ''] = num.toFixed(decimals).split('.');
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt(whole + fracPadded);
}

export default USDM_TOKEN;
