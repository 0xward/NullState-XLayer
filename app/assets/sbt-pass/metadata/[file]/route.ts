import { NextResponse } from 'next/server'
import { SEASON_IDS, seasonNumberOf, seasonLabel } from '@/lib/season'
import { SITE_URL } from '@/lib/siteUrl'

// ─── Season Pass NFT metadata ────────────────────────────────────────────────
//
// PassSBTv3.tokenURI() returns BASE_URI + seasonId + ".json", and BASE_URI is
// a `string public constant` — no setter, deployed, immutable:
//
//   https://nullstate-ten.vercel.app/assets/sbt-pass/metadata/202607.json
//
// This route serves that path. Until now nothing did: `public/assets/sbt-pass/`
// never existed, so every pass ever minted resolved to a 404. In the game the
// pass looks right, because the game draws it from its own UI and never reads
// tokenURI — but in a wallet, on Celoscan, or in any NFT viewer, a paid item
// showed up as an unnamed token with no image. That is the entire audience who
// looks at a purchase somewhere other than inside the game.
//
// ─── WHY THE VERCEL SUBDOMAIN CAN NEVER BE DELETED ──────────────────────────
// BASE_URI names nullstate-ten.vercel.app and cannot be changed. That host now
// 307s to the current domain, and this route answers there, so the chain still
// resolves — but only for as long as the old host keeps redirecting. Removing
// it would break the metadata of every pass already minted, permanently, with
// no on-chain fix available. See docs/custom-domain.md.
//
// Statically generated for the six real seasons and nothing else: an unknown
// id is a 404 rather than an invented pass. lib/season.ts stays the one place
// that decides which seasons exist.

export const dynamicParams = false

export function generateStaticParams() {
  return SEASON_IDS.map((id) => ({ file: `${id.toString()}.json` }))
}

export async function GET(_req: Request, { params }: { params: { file: string } }) {
  const raw = params.file.replace(/\.json$/, '')
  if (!/^\d+$/.test(raw)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const seasonId = BigInt(raw)
  const number = seasonNumberOf(seasonId)
  const label = seasonLabel(seasonId)
  if (number === null || label === null) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(
    {
      name: `NULL_STATE Season Pass — Season ${number}`,
      description:
        `Season ${number} of NULL_STATE, ${label}. A soulbound pass for the Forsaken Depths: ` +
        `it unlocks cosmetic and convenience perks for the season it belongs to and cannot be ` +
        `transferred or sold. Every gameplay advantage it touches is also reachable for free — ` +
        `the pass buys time and appearance, never power. Playable in MiniPay.`,
      image: `${SITE_URL}/Season_${number}.png`,
      external_url: SITE_URL,
      attributes: [
        { trait_type: 'Season', value: number },
        { trait_type: 'Period', value: label },
        { trait_type: 'Season ID', value: raw },
        { trait_type: 'Transferable', value: 'No (soulbound)' },
      ],
    },
    {
      headers: {
        // Indexers re-read metadata rarely and cache hard. A day is long enough
        // to be cheap and short enough that a correction is not stuck for weeks.
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'Access-Control-Allow-Origin': '*',
      },
    },
  )
}
