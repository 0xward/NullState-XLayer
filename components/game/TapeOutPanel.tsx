'use client'

import { useTapeOut } from '@/hooks/useTapeOut'
import { maskAddress } from '@/lib/addressMask'

/**
 * TapeOut Network strip — a slim live status line pinned to the top of the
 * world-map hub. Every number comes from the useTapeOut hook (live reads
 * against X Layer mainnet via /api/tapeout); nothing here is a constant.
 *
 * States:
 * - loading: "reading on-chain…" — the strip never shows a number it
 *   has not actually read yet.
 * - error: "data unavailable (retrying)" — the hook retries every minute.
 * - live: processor count, featured processor name, reference circuit
 *   owner, and a "verified on-chain" stamp with the read time.
 *
 * pointerEvents: 'none' — this is a status line, not a control; it must
 * never eat a tap meant for a bunker node underneath it.
 */

export default function TapeOutPanel() {
  const { data, loading, error } = useTapeOut()

  const title = data
    ? `TapeOut on X Layer (chain ${data.chainId}) — ${data.processorCount} processors. ` +
      `Featured processor ${data.featuredProcessor.name} (#${data.featuredProcessor.index}) at ` +
      `${data.featuredProcessor.address}. Reference circuit ${data.referenceCircuit.tapeId} ` +
      `owned by ${data.referenceCircuit.owner}. Read live ${data.updatedAt}.`
    : 'TapeOut on X Layer — reading live on-chain data.'

  const body = loading && !data
    ? 'TAPEOUT · X LAYER — reading on-chain…'
    : error && !data
      ? 'TAPEOUT · X LAYER — data unavailable (retrying)'
      : data
        ? `TAPEOUT · X LAYER LIVE — ${data.processorCount} processors · ` +
          `${data.featuredProcessor.name} #${data.featuredProcessor.index} · ` +
          `circuit ${data.referenceCircuit.tapeId} owner ${maskAddress(data.referenceCircuit.owner)} · ✓ on-chain`
        : 'TAPEOUT · X LAYER — reading on-chain…'

  return (
    <div
      className="tapeout-strip"
      title={title}
      aria-live="polite"
      style={{
        position: 'absolute',
        top: 10,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 8,
        maxWidth: '94vw',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        fontFamily: 'monospace',
        fontSize: 10,
        letterSpacing: '1.5px',
        color: 'rgba(255,255,255,.78)',
        background: 'rgba(4,10,7,.72)',
        border: '1px solid rgba(57,255,154,.25)',
        borderRadius: 999,
        padding: '5px 12px',
      }}
    >
      <span style={{ color: '#39ff9a' }} aria-hidden="true">● </span>
      {body}
    </div>
  )
}
