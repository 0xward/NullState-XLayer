'use client'

import { useEffect, useState } from 'react'
import { resolveItemId } from '@/lib/constants/marketplace'

// ─── Which face is yours ─────────────────────────────────────────────────────
// The avatar has to answer "is this me?", so it follows whatever the player
// last equipped. Portraits are pre-baked per look
// (scripts/build-hero-portrait.js) and picked here with the SAME precedence
// entities.js drawLPCComposite() uses to decide what to draw on the canvas:
//
//     outfit  (a cosmetic skin, always wins — that is the point of paying)
//  || armor   (the gameplay piece)
//  || default_skin (the free fallback, so nobody is ever bare)
//
// Keeping the precedence identical is what stops the avatar and the character
// in the dungeon from disagreeing about what you are wearing.

export interface EquippedSlots {
  mainhand: string | null
  body: string | null
  outfit: string | null
}

export const EMPTY_EQUIPPED: EquippedSlots = { mainhand: null, body: null, outfit: null }

const DIR = '/sprites/player/portraits'
export const DEFAULT_PORTRAIT = `${DIR}/default_skin.png`

// Only ids that were actually baked. An id with no portrait (a future skin
// added to the marketplace before the script is re-run) falls back to the
// default rather than requesting a 404 and showing a broken image.
const BAKED = new Set([
  'default_skin',
  'leather_guard', 'iron_plate', 'rune_armor',
  // ashen_warden is gone; resolveItemId() maps it to ashfall_scav above, so an
  // old save still lands on a face that exists.
  'ashfall_scav', 'sungild', 'emberguard', 'nullsteel', 'voidweave', 'hazard_warden',
  'pass_warden',
])

export function portraitFor(equipped: EquippedSlots | null | undefined): string {
  if (!equipped) return DEFAULT_PORTRAIT
  // resolveItemId maps retired ids onto their replacements, the same way the
  // shop and the engine do, so a wallet holding an old item still gets a face.
  for (const id of [equipped.outfit, equipped.body]) {
    if (!id) continue
    const resolved = resolveItemId(id)
    if (BAKED.has(resolved)) return `${DIR}/${resolved}.png`
  }
  return DEFAULT_PORTRAIT
}

/**
 * Reads the wallet's equipped slots once per address. Used by the world map's
 * player plate; the Character Sheet already fetches the same endpoint for its
 * item list and passes its own state to portraitFor() instead of calling this,
 * so equipping something updates the picture immediately rather than after a
 * round trip.
 */
export function useEquippedPortrait(address: string | null | undefined) {
  const [equipped, setEquipped] = useState<EquippedSlots>(EMPTY_EQUIPPED)

  useEffect(() => {
    if (!address) { setEquipped(EMPTY_EQUIPPED); return }
    let alive = true
    fetch(`/api/marketplace/owned?wallet=${address}`)
      .then(r => r.json())
      .then(d => { if (alive && d?.equipped) setEquipped({ ...EMPTY_EQUIPPED, ...d.equipped }) })
      .catch(() => { /* offline — the default face is still a correct answer */ })
    return () => { alive = false }
  }, [address])

  return { equipped, portrait: portraitFor(equipped) }
}
