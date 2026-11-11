'use client'

import { BaseError, InsufficientFundsError, UserRejectedRequestError } from 'viem'

// MiniPay Add Cash deeplink.
//
// Re-verified 2026-07-26 against the canonical reference,
// https://docs.minipay.xyz/technical-references/deeplinks.html, which states:
// "All deep links use the host link.minipay.xyz". Add Cash is documented as
// `https://link.minipay.xyz/add_cash[?tokens=XXX,YYY,ZZZ]`.
//
// This corrects an earlier value of https://minipay.opera.com/add_cash. The
// comment that accompanied it claimed link.minipay.xyz was MiniPay's unrelated
// P2P "Cash Links" feature — that is wrong; the deeplinks page above publishes
// link.minipay.xyz/add_cash as the Add Cash screen and documents no
// minipay.opera.com host at all.
//
// `tokens` is filtered by the client (unsupported codes are skipped), so
// naming all three we accept just means the top-up screen opens on the set the
// game can actually take. Codes are uppercase per the docs; USDM is the Mento
// dollar. The docs page is titled "Deeplinks (available soon)", so treat this
// as best-effort: it is a plain <a href>, and a MiniPay build that does not yet
// handle it simply does nothing rather than breaking the purchase flow.
export const MINIPAY_ADD_CASH_URL = 'https://link.minipay.xyz/add_cash?tokens=USDT,USDC,USDM'

export interface UserFriendlyWalletError {
  message: string
  insufficientFunds: boolean
}

// Punch list #3 — sendTx/payUsdmFee/buyMarketplaceItem in WalletProvider.tsx
// were computing a friendly message via getUserFriendlyError() but then
// re-throwing the ORIGINAL raw error (`throw e`), so any caller reading
// `e.message` directly (e.g. MarketplaceScreen.tsx's handleBuy/handleSwap)
// still surfaced the raw viem/RPC text ("insufficient funds for gas * price
// + value...") instead of the translated message. This wraps the friendly
// result in a real Error so `.message` is always the clean, human string —
// the raw error is preserved on `.cause` for console/debugging, and
// `insufficientFunds` stays available for callers that want to branch on it
// (e.g. show the MiniPay "Add Cash" link) without re-deriving it themselves.
export class WalletFriendlyError extends Error {
  insufficientFunds: boolean
  constructor(friendly: UserFriendlyWalletError, cause: unknown) {
    super(friendly.message, { cause })
    this.name = 'WalletFriendlyError'
    this.insufficientFunds = friendly.insufficientFunds
  }
}

function getErrorCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined
  const code = (error as { code?: unknown }).code
  return typeof code === 'number' ? code : undefined
}

function getErrorText(error: unknown): string {
  if (error instanceof BaseError) {
    return [error.shortMessage, error.details, error.message, error.name]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
  }
  if (error instanceof Error) return `${error.name} ${error.message}`.toLowerCase()
  return String(error ?? '').toLowerCase()
}

export function getUserFriendlyError(error: unknown): UserFriendlyWalletError {
  console.error(error)

  if (error instanceof BaseError) {
    if (error.walk(err => err instanceof UserRejectedRequestError)) {
      return { message: 'Transaction cancelled.', insufficientFunds: false }
    }
    if (error.walk(err => err instanceof InsufficientFundsError)) {
      return {
        message: 'Insufficient balance to complete this transaction.',
        insufficientFunds: true,
      }
    }
  }

  const code = getErrorCode(error)
  const text = getErrorText(error)

  if (code === 4001 || /user rejected|user denied|transaction cancelled|rejected the request/.test(text)) {
    return { message: 'Transaction cancelled.', insufficientFunds: false }
  }

  if (
    (code === -32000 && /insufficient funds|exceeds transaction sender account balance/.test(text)) ||
    /insufficient funds|insufficient balance|exceeds transaction sender account balance|not enough funds/.test(text)
  ) {
    return {
      message: 'Insufficient balance to complete this transaction.',
      insufficientFunds: true,
    }
  }

  // Plain ERC20 revert reason ("ERC20: transfer amount exceeds balance"),
  // surfaced e.g. by PassSBT.mintPaidPass()'s transferFrom() when the
  // wallet doesn't hold enough USDm. This is a token-balance shortfall,
  // not a native-gas shortfall, but it's still "insufficient funds" from
  // the player's point of view, so it gets the same friendly message.
  if (/transfer amount exceeds balance/.test(text)) {
    return {
      message: 'Insufficient stablecoin balance to complete this purchase.',
      insufficientFunds: true,
    }
  }

  // #9 investigation (this session): this final fallback used to return a
  // pure "Transaction failed. Please try again." with zero diagnostic
  // content — meaning any on-chain revert that ISN'T a balance shortfall
  // (wrong/retired contract address, a contract call reverting because the
  // function doesn't exist on that address, a season not yet active, etc.)
  // was indistinguishable from every other failure in a support screenshot.
  // Appending a short snippet of the actual short-message/revert text (when
  // available) means a user screenshot of the error toast alone can often
  // point at the real cause without needing a tx hash — e.g. it would show
  // something like "function selector not recognized" if PASS_SBT_ADDRESS
  // is pointed at a retired contract missing backendMintPass() (see the
  // RETIRED_PASS_SBT_ADDRESSES guard in lib/contract-abi.ts), instead of
  // just "try again" with nothing else to go on.
  const shortDetail = (error instanceof BaseError ? error.shortMessage : (error as Error)?.message) || ''
  const trimmedDetail = shortDetail.slice(0, 120).trim()
  return {
    message: trimmedDetail
      ? `Transaction failed: ${trimmedDetail}`
      : 'Transaction failed. Please try again.',
    insufficientFunds: false,
  }
}
