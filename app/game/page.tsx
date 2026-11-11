import type { Metadata } from 'next'
import GameFlowManager from '@/components/game/GameFlowManager'

// STATIC, deliberately. This route was force-dynamic with revalidate = 0 and no
// note saying why, and nothing under it justified the cost: GamePage renders one
// client component, and the whole subtree reads its state from the browser —
// wallet from window.ethereum, hub flag from the query string via useEffect,
// profile from localStorage and fetch. There is no server data here, no
// cookies(), no headers(), no useSearchParams.
//
// What it cost was the LCP. Rendering on demand put the HTML round trip in front
// of everything: PageSpeed measured 580ms of "resource load delay" before the
// map image could even be requested, because the image cannot be discovered
// until the document arrives. Prerendered, the document comes off the CDN and
// that wait is mostly gone.
//
// Safe to cache precisely because the HTML is the same for everybody. The plate
// renders its loading placeholder for every visitor — see the profileSettled
// note in WorldMapHub — so there is no per-player content to leak into a shared
// cache. If that ever stops being true, this has to go back to dynamic.

export const metadata: Metadata = {
  title: 'NullState // Play',
  description: 'Continue your run, start a new game, check the leaderboard, or review your rewards in NullState.',
}

// /game always drops straight into the in-game MainMenu (Continue / New
// Game / Leaderboard / Rewards) — there is no separate "dashboard" landing
// step; nothing sits between the route and the menu.
export default function GamePage() {
  return <GameFlowManager />
}
