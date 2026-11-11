/**
 * NullState Web3 Client
 *
 * Viem public client configured for X Layer Testnet (chain 1952) — the
 * demo runs on testnet; the contracts have not been deployed on mainnet
 * yet. Use this for read-only contract calls outside of React hooks
 * (e.g. API routes, server-side data fetching).
 *
 * For React components, prefer wagmi's usePublicClient() hook.
 */

import { createPublicClient } from 'viem'
import { xlayerTestnetTransport, xLayerTestnetChain } from '@/lib/xlayerRpc'

export const publicClient = createPublicClient({
  chain: xLayerTestnetChain,
  // Endpoint choice lives in lib/xlayerRpc.ts so the browser and the server can
  // never disagree about it — they used to, and only this half honoured the
  // env var.
  transport: xlayerTestnetTransport(),
})

/** ISO week helper — returns YYYYWW (e.g. 202627) */
export function getISOWeekId(date: Date = new Date()): number {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return d.getUTCFullYear() * 100 + week
}

/** Current season helper — returns YYYYMM (e.g. 202607) */
export function getCurrentSeasonId(date: Date = new Date()): number {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return parseInt(`${year}${month}`, 10)
}
