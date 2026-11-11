import { NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'
import { getMarketplaceItem } from '@/lib/constants/marketplace'
import { GAME_CONFIG } from '@/lib/constants/game-config'
import { tokenLabel } from '@/lib/constants/tokens'

// Public, no-wallet stats endpoint powering /stats — the analytics/operational
// visibility page MiniPay asks for in the listing readiness checklist
// (`celopedia-skill` → minipay-requirements.md §8). Everything here is
// aggregated from the same Firebase RTDB the game already writes to; no new
// tracking is introduced. Read-only, cached briefly at the edge.
export const dynamic = 'force-dynamic'

const DAY = 86_400_000

// Coerce anything to a finite number or 0.
function n(v: unknown): number {
  const x = typeof v === 'string' ? Number(v) : (v as number)
  return typeof x === 'number' && isFinite(x) ? x : 0
}

type TokenCount = { USDM: number; USDC: number; USDT: number }

export async function GET() {
  const db = getAdminDb()
  if (!db) {
    return NextResponse.json({ error: 'Stats service unavailable' }, { status: 503 })
  }

  try {
    const now = Date.now()

    const [
      mtxSnap,      // marketplaceTxHashes/{txHash} = { wallet, itemId, token, usd, at }
      passSnap,     // passMintTxHashes/{txHash}   = { wallet, seasonId, token, usd, at, status }
      elixirSnap,   // elixirTxHashes/{txHash}     = { wallet, token, usd, at }
      matSnap,      // materialsTxHashes/{txHash}  = { wallet, token, tier, usd, at }
      bpSnap,       // blueprintTxHashes/{txHash}  = { wallet, token, sectorId, usd, at }
      rewardsSnap,  // rewards/{wallet} = { seasonBonus:{...}, weeklyRewards:{...} }
      vaultSnap,    // vaultCompleted/{weekId}/{wallet} = { amount, token, completedAt }
      burnSnap,     // burnRecords/{seasonId}/{wallet}/{burnId} = { totalValue, timestamp }
      keySnap,      // goldenKeyClaims/{weekId}/{wallet}
      paperSnap,    // paperClaims/{weekId}/{wallet}
      ownedSnap,    // marketplaceOwned/{wallet}/{itemId}
      energySnap,   // energy/{wallet}
      playersSnap,  // players/{id} = { firstSeen, lastSeen, guest }
    ] = await Promise.all([
      db.ref('marketplaceTxHashes').get(),
      db.ref('passMintTxHashes').get(),
      db.ref('elixirTxHashes').get(),
      db.ref('materialsTxHashes').get(),
      db.ref('blueprintTxHashes').get(),
      db.ref('rewards').get(),
      db.ref('vaultCompleted').get(),
      db.ref('burnRecords').get(),
      db.ref('goldenKeyClaims').get(),
      db.ref('paperClaims').get(),
      db.ref('marketplaceOwned').get(),
      db.ref('energy').get(),
      db.ref('players').get(),
    ])

    // Track every wallet we ever see (unique-players proxy) and each wallet's
    // most recent activity timestamp (for DAU/MAU).
    const seen = new Set<string>()
    const lastActive = new Map<string, number>()
    const touch = (wallet?: unknown, ts?: number) => {
      if (typeof wallet !== 'string' || !wallet) return
      const w = wallet.toLowerCase()
      seen.add(w)
      if (ts && ts > (lastActive.get(w) ?? 0)) lastActive.set(w, ts)
    }

    // ---- Money in: EVERY paid flow, not just the marketplace ----------------
    // This used to count marketplaceTxHashes and nothing else. Season passes
    // were reported as a separate headline number worth $0, and elixir, shard
    // packs and sector blueprints were invisible entirely — three whole revenue
    // lines missing from "purchase volume", and their buyers missing from the
    // unique-player count.
    //
    // Revenue is read from the `usd` recorded ON THE TRANSACTION. The old code
    // looked each itemId up in the CURRENT price list, so every repricing
    // rewrote history: halving prices halved all past revenue. Records written
    // before `usd` existed fall back to today's price, which is the best that
    // can be done for them — `volumeEstimated` says how many are guesses so the
    // number is never quoted as exact when it isn't.
    const purchasesByToken: TokenCount = { USDM: 0, USDC: 0, USDT: 0 }
    let purchaseCount = 0
    let purchaseVolumeUsd = 0
    let volumeEstimated = 0
    // How many DIFFERENT wallets have ever paid. "12 purchases" means something
    // very different depending on whether it is twelve people or one person
    // twelve times, and without this the page cannot tell you which — which is
    // exactly the ambiguity that made a run of developer test purchases look
    // like demand.
    const buyers = new Set<string>()
    const revenueByKind: Record<string, { count: number; usd: number }> = {
      items: { count: 0, usd: 0 },
      passes: { count: 0, usd: 0 },
      elixir: { count: 0, usd: 0 },
      shards: { count: 0, usd: 0 },
      blueprints: { count: 0, usd: 0 },
    }

    // Daily purchase counts for the last 14 days (oldest → newest).
    const days = 14
    const perDay = new Array<number>(days).fill(0)
    const startDay = new Date(now); startDay.setHours(0, 0, 0, 0)
    const todayStart = startDay.getTime()

    const countSale = (kind: keyof typeof revenueByKind, rec: any, fallbackUsd: number | null) => {
      purchaseCount++
      const label = tokenLabel(rec.token) as keyof TokenCount
      if (label in purchasesByToken) purchasesByToken[label]++

      let usd = n(rec.usd)
      if (!usd && fallbackUsd != null) { usd = fallbackUsd; volumeEstimated++ }
      purchaseVolumeUsd += usd
      revenueByKind[kind].count++
      revenueByKind[kind].usd += usd

      if (typeof rec.wallet === 'string' && rec.wallet) buyers.add(rec.wallet.toLowerCase())

      const at = n(rec.at)
      touch(rec.wallet, at)
      if (at) {
        const idx = days - 1 - Math.floor((todayStart - at) / DAY)
        if (idx >= 0 && idx < days) perDay[idx]++
      }
    }

    const eachRec = (snap: any, fn: (rec: any) => void) => {
      if (!snap?.exists()) return
      for (const rec of Object.values(snap.val() as Record<string, any>)) {
        if (rec && typeof rec === 'object') fn(rec)
      }
    }

    eachRec(mtxSnap, (rec) => {
      const item = getMarketplaceItem(String(rec.itemId ?? ''))
      countSale('items', rec, item ? item.price : null)
    })

    // Only mints that actually SUCCEEDED. A failed or still-pending mint leaves
    // a record behind, and counting those inflated the headline pass number.
    // Records predating the status field are treated as successful, since at
    // the time nothing was written unless the mint went through.
    let passMints = 0
    eachRec(passSnap, (rec) => {
      if (rec.status && rec.status !== 'success') return
      passMints++
      countSale('passes', rec, null)   // no fallback: the price is owner-adjustable, so a guess would be fiction
    })

    eachRec(elixirSnap, (rec) => countSale('elixir', rec, GAME_CONFIG.elixir.priceUSD))
    eachRec(matSnap,    (rec) => countSale('shards', rec, GAME_CONFIG.weaponEvolution.shardPack.priceUSD))
    eachRec(bpSnap,     (rec) => {
      const sector = GAME_CONFIG.premiumSectors.find(s => s.id === rec.sectorId)
      countSale('blueprints', rec, sector ? sector.priceUSD : null)
    })

    // ---- Real stablecoin rewards paid out (vault wins + season/weekly ledger) ----
    let rewardsPaidCount = 0
    let rewardsPaidUsd = 0
    let vaultCompletions = 0
    if (vaultSnap.exists()) {
      const byWeek = vaultSnap.val() as Record<string, Record<string, any>>
      for (const wallets of Object.values(byWeek)) {
        for (const [w, rec] of Object.entries(wallets ?? {})) {
          if (!rec || typeof rec !== 'object') continue
          vaultCompletions++
          rewardsPaidCount++
          rewardsPaidUsd += n(rec.amount)
          touch(w, n(rec.completedAt))
        }
      }
    }
    if (rewardsSnap.exists()) {
      for (const [w, val] of Object.entries(rewardsSnap.val() as Record<string, any>)) {
        for (const rec of Object.values(val?.seasonBonus ?? {})) {
          rewardsPaidCount++; rewardsPaidUsd += n((rec as any)?.amount)
          touch(w, n((rec as any)?.claimedAt) || n((rec as any)?.at))
        }
        for (const rec of Object.values(val?.weeklyRewards ?? {})) {
          rewardsPaidCount++; rewardsPaidUsd += n((rec as any)?.amount)
          touch(w, n((rec as any)?.claimedAt) || n((rec as any)?.at))
        }
      }
    }

    // ---- Burns (in-game economy) ----
    let burnEvents = 0
    let pointsBurned = 0
    if (burnSnap.exists()) {
      const bySeason = burnSnap.val() as Record<string, Record<string, Record<string, any>>>
      for (const wallets of Object.values(bySeason)) {
        for (const [w, records] of Object.entries(wallets ?? {})) {
          for (const rec of Object.values(records ?? {})) {
            if (!rec || typeof rec !== 'object') continue
            burnEvents++
            pointsBurned += n((rec as any).totalValue)
            touch(w, n((rec as any).timestamp) || n((rec as any).recordedAt))
          }
        }
      }
    }

    // ---- Weekly quest claims (count leaves under {weekId}/{wallet}) ----
    const countLeaves = (snap: any): number => {
      if (!snap?.exists()) return 0
      let c = 0
      for (const wallets of Object.values(snap.val() as Record<string, any>)) {
        for (const w of Object.keys(wallets ?? {})) { touch(w); c++ }
      }
      return c
    }
    const goldenKeys = countLeaves(keySnap)
    const papers = countLeaves(paperSnap)

    // Fold owned + energy roots into the unique-player set.
    if (ownedSnap.exists()) for (const w of Object.keys(ownedSnap.val())) touch(w)
    if (energySnap.exists()) for (const w of Object.keys(energySnap.val())) touch(w)

    // ---- players/{id}: registered on opening the game, not on playing it ----
    // Owner: "anyone who clicks Play Game should count straight away." Before
    // this root, the earliest trace of a player was the energy row written by
    // STARTING A RUN, so anyone who opened the game, looked at the map and left
    // was invisible. /api/player/seen now records them on mount.
    //
    // lastSeen is a far better activity signal than what DAU/WAU/MAU had to
    // work with — timestamps scavenged from whichever gameplay side effect
    // happened to leave one — so it feeds the same `touch` and simply wins
    // whenever it is the more recent of the two.
    //
    // `guest` is the field that makes the headline honest. A guest id is 20
    // random bytes shaped like an address, so a browser cleared twice is three
    // ids and one person. Only ids recorded from now on carry the flag, which
    // is why `guestKnown` is reported alongside the split — without it a reader
    // would take "2 guests" as a fact about all players rather than about the
    // ones we have had a chance to label.
    let guests = 0, wallets = 0, guestKnown = 0
    if (playersSnap.exists()) {
      for (const [id, rec] of Object.entries(playersSnap.val() as Record<string, any>)) {
        touch(id, n(rec?.lastSeen))
        if (rec && typeof rec.guest === 'boolean') {
          guestKnown++
          if (rec.guest) guests++; else wallets++
        }
      }
    }

    // ---- DAU / MAU from collected activity timestamps ----
    let dau = 0, wau = 0, mau = 0
    for (const ts of lastActive.values()) {
      const age = now - ts
      if (age < DAY) dau++
      if (age < 7 * DAY) wau++
      if (age < 30 * DAY) mau++
    }

    const payload = {
      generatedAt: now,
      players: {
        total: seen.size,
        dau, wau, mau,
        // Owner: "24 total players — where does that come from, and which of
        // them ever paid?"
        //
        // `total` is every id that has ever written anything server-side: a
        // purchase, a vault completion, a quest claim, a burn, a reward, an
        // owned item, or an energy record. That last one is the wide door —
        // starting a single run creates it.
        //
        // Two things it is NOT, and both matter before this number is quoted
        // anywhere:
        //   - it is not visitors. Opening the landing page or the world map
        //     writes nothing, so someone who looked and left is invisible here.
        //     Measuring that needs PostHog, which is still unconfigured.
        //   - it is not humans, and not even wallets. A player without a wallet
        //     gets a random guest id in localStorage that is shaped exactly
        //     like an address, and every Firebase-keyed flow uses it. Clear the
        //     browser or open the game on a second device and the same person
        //     counts twice.
        //
        // The split below is the part that IS solid, because paying requires a
        // real wallet and an on-chain transaction — a guest id can never appear
        // in it. So `paying` is a floor on real distinct people, and
        // `nonPaying` is everyone else: real players who have not bought
        // anything, plus duplicate guest ids, mixed together.
        paying: buyers.size,
        nonPaying: Math.max(0, seen.size - buyers.size),
        // Only ids seen since /api/player/seen shipped can be classified.
        // guestKnown says how many that is, so the split is never mistaken for
        // a statement about everyone.
        guests, wallets, guestKnown,
        conversionPct: seen.size > 0
          ? Math.round((buyers.size / seen.size) * 1000) / 10
          : null,
      },
      onchain: {
        // `purchases` now spans every paid flow, so passes are inside this
        // count as well as being reported separately below.
        purchases: purchaseCount,
        purchasesByToken: purchasesByToken,
        purchaseVolumeUsd: Math.round(purchaseVolumeUsd * 100) / 100,
        // How many of those sales had no recorded price and were valued at
        // today's list price instead. Zero means the figure is exact.
        volumeEstimated,
        revenueByKind,
        passMints,
        rewardsPaidCount,
        rewardsPaidUsd: Math.round(rewardsPaidUsd * 1e6) / 1e6,
        // How many different wallets have ever paid. Read this next to
        // `purchases`: the two being far apart means a handful of people are
        // buying repeatedly, which is a very different business from the same
        // number of one-off buyers.
        uniqueBuyers: buyers.size,
        // Revenue minus rewards. Reported rather than left for the reader to
        // subtract, because the two figures sat on this page for weeks without
        // anybody putting them together — and the answer was negative the whole
        // time. Rewards are a marketing cost, and a marketing cost you have not
        // named is one you are not deciding about.
        netUsd: Math.round((purchaseVolumeUsd - rewardsPaidUsd) * 100) / 100,
        // Dollars paid out per dollar taken in. null rather than Infinity when
        // nothing has been sold, so the UI shows "—" instead of a number that
        // looks like a measurement.
        rewardRatio: purchaseVolumeUsd > 0
          ? Math.round((rewardsPaidUsd / purchaseVolumeUsd) * 100) / 100
          : null,
        // passMints is no longer added on top — it is already in purchaseCount.
        transactionsTotal: purchaseCount + rewardsPaidCount,
        purchasesPerDay: perDay,
      },
      economy: {
        burnEvents,
        pointsBurned: Math.round(pointsBurned),
        vaultCompletions,
        goldenKeys,
        papers,
      },
    }

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=300' },
    })
  } catch (error) {
    console.error('[stats] Error:', error)
    return NextResponse.json({ error: 'Failed to build stats' }, { status: 500 })
  }
}
