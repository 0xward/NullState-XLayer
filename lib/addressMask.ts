// MiniPay listing compliance (v75): raw wallet addresses must never be
// shown in the UI. Every user-facing address goes through this mask:
// keep the "0x" prefix, censor the middle, show only the LAST 5 hex
// characters — e.g. 0x71C7...9aF23 renders as "0x....9aF23".
// (Server/API/on-chain code still uses the full address — display only.)
export function maskAddress(addr?: string | null): string {
  if (!addr) return ''
  const a = addr.trim()
  if (a.length <= 7) return a // too short to be a real address; show as-is
  return `0x....${a.slice(-5)}`
}
