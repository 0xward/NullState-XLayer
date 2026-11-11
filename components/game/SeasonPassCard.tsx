'use client'

import Image from 'next/image'
import { GiPadlock } from 'react-icons/gi'
import { SeasonInfo } from '@/hooks/usePassSBT'
import { seasonLabel } from '@/lib/season'

export interface SeasonPassCardProps {
  seasonNumber: number // 1-6
  seasonId: bigint // e.g. 202607n
  imageSrc: string // /Season_1.png etc.
  isActive: boolean // true only for the season matching the current month
  /**
   * True for a season that has already ENDED.
   *
   * Derived from the season id, not from `info.endDate`: a season whose
   * on-chain window was never configured still reads `endDate === 0`, and the
   * calendar knows perfectly well that July is behind us. Passing it in keeps
   * the "which month is it" answer in one place (lib/season.ts).
   */
  isPast: boolean
  info: SeasonInfo | null // null while still loading
  hasPass: boolean // does the connected wallet already hold ANY active pass
  isConnected: boolean
  mintPhase: 'idle' | 'paying' | 'verifying' | 'minting'
  // Live on-chain price as a plain USD string (e.g. "10.00"), read from the
  // contract by usePassSBT. null while loading. Token-agnostic on purpose —
  // MiniPay pays in whichever stablecoin the wallet holds most of.
  priceUsd: string | null
  onMint: () => void
}

// Format a decimal-dollar string ("10.00" / "0.30") as a compact price label,
// dropping a trailing ".00" so $10 reads as "$10" not "$10.00".
function formatUsd(price: string | null): string {
  if (price == null) return '…'
  const n = Number(price)
  if (!isFinite(n)) return `$${price}`
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`
}

function daysRemaining(endDateSeconds: bigint): number | null {
  if (endDateSeconds === BigInt(0)) return null
  const endMs = Number(endDateSeconds) * 1000
  const diffMs = endMs - Date.now()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

export default function SeasonPassCard({
  seasonNumber,
  seasonId,
  imageSrc,
  isActive,
  isPast,
  info,
  hasPass,
  isConnected,
  mintPhase,
  priceUsd,
  onMint,
}: SeasonPassCardProps) {
  // The price is now its own element rather than a fragment of one 10px
  // string, so it can be set larger than the verb beside it. On a shop button
  // the number is the decision the player is making.
  const MINT_LABEL: Record<SeasonPassCardProps['mintPhase'], string> = {
    idle: 'MINT PASS',
    paying: 'SENDING PAYMENT…',
    verifying: 'VERIFYING PAYMENT…',
    minting: 'MINTING…',
  }
  const cardStyle: React.CSSProperties = {
    clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
  }
  // "July 2026" — a finished season is named by the month it was, which is more
  // use than its number to anyone trying to remember whether they played it.
  const monthLabel = seasonLabel(seasonId)

  // ── FINISHED season ──────────────────────────────────────────────────────
  //
  // OWNER, on August 2nd, looking at July: *"ini mint pass ko gini tulisaannya
  // not started, padahal sudah lewat."*
  //
  // He is right, and the cause is that this card only ever knew TWO states:
  // "the current month" and "everything else". A season that had already run
  // fell into the same branch as one that had not started, so July was blurred
  // behind a padlock and captioned **"Not started yet — Coming Season 1"** the
  // day after it paid out three players real USDT.
  //
  // It compounds: the program is six months long, so by December five of the
  // six cards would have said "Coming" about months that were already over.
  //
  // A finished season is not locked, it is DONE — so it is not blurred and
  // carries no padlock. The art stays legible because it is a record of a month
  // that happened, and the caption says when.
  if (isPast) {
    return (
      <div
        className="shrink-0 w-[78%] sm:w-[300px] snap-center border border-[#7a4f24]/30 bg-[rgba(26,15,6,0.45)] rounded-md overflow-hidden"
        style={cardStyle}
      >
        <div className="relative aspect-square w-full">
          <Image
            src={imageSrc}
            alt={`Season ${seasonNumber}`}
            fill
            sizes="(max-width: 640px) 78vw, 300px"
            className="object-cover"
            style={{ filter: 'grayscale(0.65) brightness(0.55)' }}
          />
          <div className="absolute inset-0 flex items-start justify-end p-2">
            <span
              className="font-mono text-[9px] uppercase tracking-[2px] text-[#f0dcb8]/85 bg-black/70 px-2 py-1"
              style={{ clipPath: 'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)' }}
            >
              Ended
            </span>
          </div>
        </div>
        <div className="p-3 font-mono">
          <div className="text-[#9c7a4f] text-[10px] uppercase tracking-[2px] mb-1">
            Season {seasonNumber}
          </div>
          <div className="text-[#f0dcb8]/60 text-xs mb-3">
            {monthLabel ? `Ended — ${monthLabel}` : 'Ended'}
          </div>
          <button
            disabled
            className="w-full font-mono text-[10px] tracking-[1px] uppercase text-[#9c7a4f]/70 border border-[#7a4f24]/35 py-2 cursor-not-allowed"
            style={{ clipPath: 'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)' }}
          >
            Season {seasonNumber} is over
          </button>
        </div>
      </div>
    )
  }

  // ── Locked / not-yet-active card ──────────────────────────────────────────
  if (!isActive) {
    const notAnnounced = !info || info.startDate === BigInt(0)

    return (
      <div
        className="shrink-0 w-[78%] sm:w-[300px] snap-center border border-[#7a4f24]/45 bg-[rgba(26,15,6,0.6)] rounded-md overflow-hidden"
        style={cardStyle}
      >
        <div className="relative aspect-square w-full">
          <Image
            src={imageSrc}
            alt={`Season ${seasonNumber}`}
            fill
            sizes="(max-width: 640px) 78vw, 300px"
            className="object-cover"
            style={{ filter: 'blur(6px) brightness(0.4)' }}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <GiPadlock aria-hidden className="text-4xl text-[#9c7a4f]" />
          </div>
        </div>
        <div className="p-3 font-mono">
          <div className="text-[#9c7a4f] text-[10px] uppercase tracking-[2px] mb-1">
            Season {seasonNumber}
          </div>
          <div className="text-[#f0dcb8]/70 text-xs mb-3">
            {notAnnounced ? 'Not announced yet' : 'Not started yet'}
          </div>
          <button
            disabled
            className="w-full font-mono text-[10px] tracking-[1px] uppercase text-[#9c7a4f] border border-[#7a4f24]/50 py-2 cursor-not-allowed"
            style={{ clipPath: 'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)' }}
          >
            Coming — Season {seasonNumber}
          </button>
        </div>
      </div>
    )
  }

  // ── Active card ──────────────────────────────────────────────────────────
  const minted = info?.minted ?? BigInt(0)
  const supply = info?.supply ?? BigInt(0)
  const days = info ? daysRemaining(info.endDate) : null

  // NOTE: `endDate` is purely informational here. PassSBTv2.sol's backendMintPass()
  // / mintFreePass() never check seasonEndDate — only seasonStartDate != 0,
  // seasonMinted < seasonSupply, and userPassSeason == 0. So an elapsed
  // countdown must NOT disable the mint button; it only changes the status
  // text shown to the player.
  let statusLine: string
  if (!info) {
    statusLine = '// fetching season data…'
  } else if (days === null) {
    statusLine = 'Not announced yet'
  } else if (days < 0) {
    statusLine = 'Season ended'
  } else if (days === 0) {
    statusLine = 'Ends today'
  } else {
    statusLine = `${days} day${days === 1 ? '' : 's'} left`
  }

  const soldOut = info ? minted >= supply && supply > BigInt(0) : false

  let buttonLabel = MINT_LABEL[mintPhase]
  let buttonDisabled = mintPhase !== 'idle' || !isConnected

  if (mintPhase === 'idle') {
    if (hasPass) {
      buttonLabel = '✓ PASS ACTIVE'
      buttonDisabled = true
    } else if (soldOut) {
      buttonLabel = 'SOLD OUT'
      buttonDisabled = true
    } else if (!isConnected) {
      // MiniPay auto-connects silently on load; this state should only be
      // momentary. Deliberately avoid the phrase "Connect Wallet" here —
      // MiniPay's submission checklist explicitly requires apps to never
      // show connect-wallet language, even as a disabled status label.
      buttonLabel = 'WALLET SYNCING…'
      buttonDisabled = true
    }
  }

  return (
    <div
      className="shrink-0 w-[86%] sm:w-[320px] snap-center border border-[#7a4f24] bg-gradient-to-b from-[#2b1a0d] to-[#1a0f06] rounded-md overflow-hidden"
      style={cardStyle}
    >
      <div className="relative aspect-square w-full">
        <Image
          src={imageSrc}
          alt={`Season ${seasonNumber}`}
          fill
          sizes="(max-width: 640px) 86vw, 320px"
          className="object-cover"
        />
        <div className="absolute top-2 left-2 font-mono text-[10px] tracking-[2px] uppercase bg-black/70 text-[#7ef0a6] px-2 py-1 border border-[#4ade80]/60">
          ● ACTIVE
        </div>
      </div>

      <div className="p-3.5 font-mono">
        <div className="text-[#f2cd82] text-sm font-bold uppercase tracking-[1px] mb-2">
          Season {seasonNumber}
        </div>

        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-[#9c7a4f] uppercase tracking-[1px]">Minted</span>
          <span className="text-[#f0dcb8]">
            {info ? `${minted.toString()}/${supply.toString()}` : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] mb-3">
          <span className="text-[#9c7a4f] uppercase tracking-[1px]">Status</span>
          <span className="text-[#f2cd82]">{statusLine}</span>
        </div>

        {/* .ns-cta (styles/game.css): filled slab, 13px bold, 44px floor.
            This is the only button on the card that spends money and it was
            styled as a secondary outline at 10px — see the class comment. */}
        <button
          onClick={onMint}
          disabled={buttonDisabled}
          className={
            'ns-cta' +
            (mintPhase !== 'idle' ? ' is-busy' : '') +
            (mintPhase === 'idle' && hasPass ? ' is-done' : '')
          }
        >
          <span>{buttonLabel}</span>
          {/* Price shows only when the button is actually offering the sale —
              not next to SOLD OUT or PASS ACTIVE, where it would be quoting a
              price for something you cannot buy. */}
          {mintPhase === 'idle' && !hasPass && !soldOut && isConnected && (
            <span className="ns-cta-price">{formatUsd(priceUsd)}</span>
          )}
        </button>
        {!hasPass && mintPhase === 'idle' && (
          <div className="mt-2 text-[#9c7a4f] text-[9px] tracking-[1px] uppercase text-center">
            Paid in your MiniPay stablecoin
          </div>
        )}
      </div>
    </div>
  )
}
