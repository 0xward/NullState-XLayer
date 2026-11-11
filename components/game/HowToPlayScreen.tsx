'use client'

// How-to-Play / "The Loop" screen (Phase 2 — reward loop jelas).
//
// A single in-game explainer that makes the core loop obvious WITHOUT sending
// the player to the external /docs page. It reflects the ACTUAL economy the
// game ships with (owner-confirmed):
//   • Burning loot converts it to NullState Point — an IN-GAME, faucet-only
//     currency (spent on Marketplace "Swap" gear). It is NOT withdrawable.
//   • Real STABLECOIN comes from the Treasure Vault (weekly code), the
//     seasonal Leaderboard (top 3), and Season Pass reward tracks.
// If the burn→Point vs burn→stablecoin decision is ever revisited, the Weekly
// card below is the one to update.

import { useWorldMapHubFlag } from '@/lib/worldMapHubFlag'

interface HowToPlayScreenProps {
  onBack: () => void
}

// The five story bunkers, in order — names mirror CAMPAIGN[].title in
// public/game-engine/story_campaign.js. Each is one Act (5 floors).
const BUNKERS: { name: string; biome: string }[] = [
  { name: 'The Treeline Bunker', biome: 'Forest' },
  { name: 'The Sunken Field', biome: 'Sunken ruins' },
  { name: 'The Frostline Bunker', biome: 'Ice' },
  { name: 'The Hollow Market', biome: 'Dead market' },
  { name: 'The Last Light', biome: 'Finale' },
]

// Small pill marking whether a reward is real money or an in-game token.
function Tag({ kind }: { kind: 'stablecoin' | 'point' }) {
  const isCoin = kind === 'stablecoin'
  return (
    <span
      className={`inline-block rounded-sm px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[1px] align-middle ${
        isCoin
          ? 'bg-[rgba(0,255,136,0.14)] text-null-green border border-[rgba(0,255,136,0.4)]'
          : 'bg-[rgba(255,190,11,0.12)] text-null-amber border border-[rgba(255,190,11,0.35)]'
      }`}
    >
      {isCoin ? 'USDT' : 'POINT'}
    </span>
  )
}

// Highlights a bunker's story name inline so it reads as a proper place, not
// jargon like "Act 1" (owner: "user pasti bingung apa itu Act 1"). Styled like
// the USDT/POINT pills so the important nouns pop the same way.
function BunkerTag({ children }: { children: React.ReactNode }) {
  // Same footprint as the USDT/POINT pill (Tag) so bunker names sit inline
  // without ballooning the line (owner: "kegedean, beda dari USDT yg lebih fit").
  return (
    <span className="inline-block rounded-sm border border-[rgba(0,255,136,0.4)] bg-[rgba(0,255,136,0.12)] px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[1px] text-null-green align-middle">
      {children}
    </span>
  )
}

function LoopCard({
  cadence,
  title,
  accent,
  children,
}: {
  cadence: string
  title: string
  accent: string
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-md border p-4 sm:p-5"
      style={{ borderColor: `${accent}44`, background: `${accent}0a` }}
    >
      <div className="font-mono text-[9px] tracking-[3px] uppercase mb-1" style={{ color: accent }}>
        {cadence}
      </div>
      <h3 className="font-display font-black text-null-white text-lg sm:text-xl mb-3">{title}</h3>
      <div className="flex flex-col gap-2.5 text-[13px] leading-relaxed text-null-muted">{children}</div>
    </div>
  )
}

export default function HowToPlayScreen({ onBack }: HowToPlayScreenProps) {
  // The map section only appears for players who actually get the world-map
  // hub — otherwise the help would describe a screen they never see.
  const hasWorldMap = useWorldMapHubFlag()

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[rgba(0,0,0,0.95)] p-4 sm:p-6 overflow-y-auto">
      <div
        className="absolute pointer-events-none inset-0"
        style={{ background: 'radial-gradient(circle at 50% 25%, rgba(0,255,136,0.08) 0%, transparent 60%)' }}
      />

      <div className="relative z-10 max-w-3xl w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8 gap-3">
          <div className="min-w-0">
            <div className="font-mono text-[9px] sm:text-[10px] tracking-[4px] sm:tracking-[6px] text-null-green uppercase mb-1 sm:mb-2">
              // HOW IT WORKS
            </div>
            <h2 className="font-display font-black text-null-white leading-none" style={{ fontSize: 'clamp(28px, 8vw, 48px)' }}>
              THE LOOP
            </h2>
          </div>
          <button
            onClick={onBack}
            className="shrink-0 inline-flex items-center justify-center min-h-11 font-mono text-[10px] sm:text-xs tracking-[1px] sm:tracking-[2px] uppercase text-null-green border border-[rgba(0,255,136,0.4)] px-3 sm:px-4 py-2 transition-all duration-200 hover:border-null-green hover:bg-[rgba(0,255,136,0.05)]"
            style={{ clipPath: 'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)' }}
          >
            ✕ CLOSE
          </button>
        </div>

        {/* Legend */}
        <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-4 py-3 font-mono text-[11px] text-null-muted">
          <span className="flex items-center gap-2"><Tag kind="stablecoin" /> real USDT reward — withdrawable to your wallet</span>
          <span className="flex items-center gap-2"><Tag kind="point" /> NullState Point — in-game only, not cashable</span>
        </div>

        {/* The Loop — four cadences.
            DAILY was missing entirely, from a game whose entire retention is
            daily: energy is what ends every session, the streak is what should
            start the next one, and missions are what a session is FOR. A help
            screen that skips all three explains the game a player is not
            actually playing. */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
          <LoopCard cadence="EVERY DAY" title="Show Up" accent="#ffd166">
            <p>
              <span className="text-null-white font-semibold">5 free runs a day.</span> One run = one bunker descent.
              They refill at <span className="text-null-white">00:00 UTC</span>, and unused ones do not stack.
            </p>
            <p>
              <span className="text-null-white font-semibold">Opening the game is enough</span> to move your streak —
              you do not have to play. Seven days pay more each rung; day 7 pays{' '}
              <span className="text-null-acid">8 Glitch Shards</span>, exactly one weapon evolution.
            </p>
            <p>
              Three days in a row earns a <span className="text-null-white">Streak Shield</span>: miss one day and your
              streak survives it. Miss two and it resets.
            </p>
            <p>
              <span className="text-null-white font-semibold">3 Daily Missions</span> reset with the day and pay{' '}
              <Tag kind="point" /> and shards the moment you finish them — no claim button.
            </p>
          </LoopCard>

          <LoopCard cadence="EVERY RUN" title="Play &amp; Farm" accent="#00ff88">
            <p>Descend the bunkers, clear floors, and loot gear from containers and elites.</p>
            <p>
              Burn loot you don&apos;t need to convert it into <Tag kind="point" /> — then <span className="text-null-acid font-semibold">Swap</span> that
              Point for non-premium Marketplace gear. This is the daily grind-and-gear cycle.
            </p>
          </LoopCard>

          <LoopCard cadence="EVERY WEEK" title="Treasure Vault" accent="#00aaff">
            <p>
              You need <span className="text-null-white font-semibold">two special items</span> — both drop from ordinary
              containers as you loot (one of each per week, and never locked behind an evolution weapon):
            </p>
            {/* Golden Key + Old Paper shown with their real in-game sprites so
                players recognise them on sight (owner: "kami bisa set gambar
                disitu, ambil dari asset di repo"). */}
            <div className="flex gap-2.5 my-1">
              <div className="flex flex-1 items-center gap-2 rounded-md border border-[rgba(255,190,11,0.35)] bg-[rgba(255,190,11,0.06)] px-2.5 py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/sprites/items/golden_key.png" alt="Golden Key" className="h-8 w-8 shrink-0 [image-rendering:pixelated]" draggable={false} />
                <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-null-amber leading-tight">Golden Key</span>
              </div>
              <div className="flex flex-1 items-center gap-2 rounded-md border border-[rgba(201,168,106,0.4)] bg-[rgba(201,168,106,0.08)] px-2.5 py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/sprites/items/paper.png" alt="Old Paper" className="h-8 w-8 shrink-0 [image-rendering:pixelated]" draggable={false} />
                <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-[#d9b877] leading-tight">Old Paper</span>
              </div>
            </div>
            <p>
              Carry <span className="text-null-white">both</span> to the sealed Vault door, then read the 4-digit code
              off your Old Paper and enter it (3 tries that week) for a real <Tag kind="stablecoin" /> payout straight to
              your wallet. No claim button — it is already sent.
            </p>
            <p>
              <span className="text-null-white font-semibold">You are never left to luck.</span> Every lockable container
              you open earns a <span className="text-null-white">Vault Fragment</span>:{' '}
              <span className="text-null-acid">8</span> guarantees the Paper,{' '}
              <span className="text-null-acid">18</span> guarantees the Key. A week of playing can never pay you nothing.
            </p>
          </LoopCard>

          <LoopCard cadence="EVERY SEASON" title="Rank &amp; Pass" accent="#ffaa00">
            <p>
              The <span className="text-null-white">Leaderboard</span> ranks the{' '}
              <span className="text-null-white">XP you earn this month</span> — everyone starts each season at zero, so a
              player who joins today can win it.
            </p>
            <p>
              The <span className="text-null-white">top 10</span> share <Tag kind="stablecoin" />{' '}
              <span className="text-null-acid">35 USDT</span>: $20 / $5 / $3 for the podium, $1 each for ranks 4–10. The
              top 3 claim theirs in Rewards (that season&apos;s Pass required); ranks 4–10 are sent straight to your
              wallet.
            </p>
            <p>
              A <span className="text-null-white">Season Pass</span> (Soulbound NFT) grants the exclusive Warden outfit, daily perks
              (bonus energy or Glitch Shards), and top-3 bonus eligibility.
            </p>
          </LoopCard>
        </div>

        {/* Character stats: XP, Level, HP — how the three relate */}
        <div className="mb-8">
          <div className="font-mono text-[10px] tracking-[4px] uppercase text-null-green mb-3">// XP · LEVEL · HP</div>
          <div className="rounded-md border border-[rgba(0,255,136,0.2)] bg-[rgba(0,255,136,0.03)] p-4 sm:p-6">
            <div className="flex flex-col gap-3 text-[13px] leading-relaxed text-null-muted">
              <p>
                <span className="text-[#4ad7ff] font-semibold">XP</span> fills the blue bar. Kill enemies and grab XP
                drops — when the bar is full you <span className="text-null-white">Level Up</span> (and heal to full).
              </p>
              <p>
                <span className="text-null-white font-semibold">Level</span> raises your{' '}
                <span className="text-null-white">Critical Hit chance</span> — a crit deals{' '}
                <span className="text-null-acid font-semibold">double damage</span> (the big gold numbers). Level does
                <span className="text-null-white"> not</span> add HP or base attack; it multiplies whatever your weapon
                already deals, so the more you level, the harder your equipped weapon hits. Crit climbs ~0.4% per level,
                up to 25%.
              </p>
              <p>
                <span className="text-[#00ff88] font-semibold">HP</span> is the green bar — your health. Your base is
                100; equip <span className="text-null-white">Armor</span> to raise your Max HP and eat{' '}
                <span className="text-null-white">Food</span> to heal. Hit 0 and you respawn on the same floor, so a run
                is never wiped to zero.
              </p>
              <p className="text-[12px] text-null-muted/90">
                In short: <span className="text-null-white">Weapons</span> = base damage,{' '}
                <span className="text-null-white">Armor</span> = survival (HP),{' '}
                <span className="text-null-white">Level</span> = crit that makes your weapon hit harder. Each one pulls
                its own weight.
              </p>
            </div>
          </div>
        </div>

        {/* The Map — only shown to players who get the world-map hub */}
        {hasWorldMap && (
          <div className="mb-8">
            <div className="font-mono text-[10px] tracking-[4px] uppercase text-null-green mb-3">// THE MAP</div>
            <div className="rounded-md border border-[rgba(0,255,136,0.2)] bg-[rgba(0,255,136,0.03)] p-4 sm:p-6">
              <p className="text-[13px] leading-relaxed text-null-muted mb-4">
                Every bunker sits on one map. You start at the <span className="text-null-white">bottom</span> and work
                your way <span className="text-null-white">up</span> the trail — <BunkerTag>The Last Light</BunkerTag> waits
                at the very top.
              </p>
              <div className="flex flex-col gap-2 text-[13px] leading-relaxed text-null-muted">
                <p>
                  <span className="inline-block h-3 w-5 rounded-full border-2 border-[#39ff9a] align-middle mr-2" />
                  <span className="text-null-white">Glowing ring</span> — the bunker you&apos;re in right now.
                </p>
                <p>
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#39ff9a] text-[10px] font-bold text-[#04140c] align-middle mr-2">✓</span>
                  <span className="text-null-white">Stamp</span> — already cleared.
                </p>
                <p>
                  <span className="inline-block h-4 w-4 rounded-sm bg-[rgba(214,228,224,0.45)] align-middle mr-2" />
                  <span className="text-null-white">Fog and a padlock</span> — not open yet. Tap it and the bar at the
                  bottom tells you what you still need.
                </p>
                <p className="pt-1">
                  Tapping a bunker only <span className="text-null-white">selects</span> it — the bar at the bottom shows
                  where you&apos;re pointing. Press <span className="text-null-white">ENTER</span> to actually go down.
                </p>
                <p>
                  The buttons down the <span className="text-null-white">left</span> are things that pay you back
                  (Daily, Rewards, Pass, Invite); the <span className="text-null-white">right</span> is your gear
                  (Bag, Shop, Craft).
                </p>
                <p>
                  <span className="text-null-white">BAG</span> is where everything you own lives — tap an item once to
                  equip it, once more to take it off. Buy a weapon in the Shop and this is where you put it on; you
                  don&apos;t have to start a run first.
                </p>
                <p>
                  Your <span className="text-null-white">name plate</span> in the top-left corner opens your character —
                  what you have equipped, your level, and how close you are to the next one.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Progression */}
        <div className="mb-8">
          <div className="font-mono text-[10px] tracking-[4px] uppercase text-null-green mb-3">// PROGRESSION</div>
          <div className="rounded-md border border-[rgba(0,255,136,0.2)] bg-[rgba(0,255,136,0.03)] p-4 sm:p-6">
            <div className="flex items-baseline gap-3 mb-4 flex-wrap">
              <span className="font-display font-black text-null-white text-3xl sm:text-4xl">5 × 5 = 25</span>
              <span className="font-mono text-[11px] uppercase tracking-[2px] text-null-muted">bunkers × floors = total depths</span>
            </div>

            {/* 5 bunkers, 5 floors each — with the story name of each Act */}
            <div className="flex flex-col gap-2.5 mb-5">
              {BUNKERS.map((bk, bi) => (
                <div key={bk.name} className="flex items-center gap-3">
                  <div className="flex items-baseline gap-2 w-[168px] shrink-0">
                    <span className="font-mono text-[10px] text-null-green shrink-0">B{bi + 1}</span>
                    <span className="font-mono text-[11px] text-null-white leading-tight">{bk.name}</span>
                  </div>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map(f => (
                      <span
                        key={f}
                        className="inline-block h-4 w-4 rounded-[2px] border border-[rgba(0,255,136,0.35)] bg-[rgba(0,255,136,0.08)]"
                        title={`${bk.name} · Floor ${f} · ${bk.biome}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 text-[13px] leading-relaxed text-null-muted">
              <p className="text-null-white font-semibold">Why come back after a run?</p>
              <p>• Each bunker is one chapter of the story — clear all five floors to move outside and unlock the next bunker.</p>
              <p>• Death is softened: you respawn on the same floor, so a run is never wiped to zero.</p>
              <p>• Gear, weapon tiers, and NullState Point <span className="text-null-white">carry over</span> — every run makes the next one stronger.</p>
              <p>• Deeper bunkers drop higher-tier crafting shards for better weapons.</p>
              <p>• Clear <BunkerTag>The Treeline Bunker</BunkerTag> (Bunker 1) to unlock the <span className="text-null-white">Armory Trial</span> — pick 2 premium weapons to try free for 48h each (clock starts on first equip).</p>
              <p>• Invite friends from the <span className="text-null-white">Referral</span> menu — free weapon trials, a permanent skin at 3 friends, and a free Season Pass when an invitee makes their first purchase.</p>
              <p>• The Vault code resets weekly and the Leaderboard resets each season — fresh <Tag kind="stablecoin" /> to chase on a timer.</p>
              <p>• Beat all 5 bunkers up to <BunkerTag>The Last Light</BunkerTag> to unlock <span className="text-null-white">New Game+</span> — replay the campaign at a higher Cycle: enemies hit +35% harder per Cycle and shards drop +25% richer.</p>
              <p>• …and <span className="text-null-white">THE NULL ABYSS</span> — an endless descent below <BunkerTag>The Last Light</BunkerTag>. Deep floors drop the best shards, death ends the dive, and your deepest floor is recorded as your Abyss record for the season. (That record is <span className="text-null-white">separate</span> from the Leaderboard, which ranks XP.)</p>
              <p>• Every bunker you clear <span className="text-null-white">stays open</span> — tap it on the map and the button reads <span className="text-null-white">RAID</span>. Loot, shards and Vault Fragments all count, it costs 1 energy, and your campaign position is untouched. This is how you reach the Vault every week once the story is done.</p>
            </div>
          </div>
        </div>

        {/* Weapon evolution */}
        <div className="mb-8">
          <div className="font-mono text-[10px] tracking-[4px] uppercase text-null-amber mb-3">// WEAPON EVOLUTION</div>
          <div className="rounded-md border border-[rgba(255,190,11,0.2)] bg-[rgba(255,190,11,0.03)] p-4 sm:p-6">
            <div className="flex flex-col gap-2.5 text-[13px] leading-relaxed text-null-muted">
              <p>
                Every weapon starts at <span className="text-null-white">Tier 1</span> and can be evolved with
                <span className="text-null-white"> Glitch Shards</span> (crafting material dropped by elites, caches and
                deeper floors). Each step costs matching-tier shards and adds <span className="text-null-white">+20% attack</span>{' '}
                plus a hotter glow — no stat is ever paid for with real money.
              </p>
              <p>
                Push a weapon to its <span className="text-null-white">MAX tier</span> and it awakens a
                <span className="text-null-white"> traversal power</span>:
              </p>
              <ul className="flex flex-col gap-1.5 pl-1">
                <li>
                  • <span className="text-null-acid font-semibold">Grapple</span> — Void Katana &amp; Sunfire Bow. Opens a
                  <span className="text-null-white"> Chasm Cache</span>.
                </li>
                <li>
                  • <span className="text-null-acid font-semibold">Wall-Melt</span> — Verdant Reaper &amp; Ancient Blade. Opens a
                  <span className="text-null-white"> Frozen Cache</span>.
                </li>
              </ul>
              <p>
                Those sealed caches stay shut until you carry the matching maxed weapon — they hold the richest shard hauls,
                so evolution literally unlocks new loot. <span className="text-null-white">Your Golden Key and Code Paper are
                never locked behind one</span> — they only ever drop in ordinary breakable containers.
              </p>
            </div>
          </div>
        </div>

        {/* The Null Abyss */}
        <div className="mb-8">
          <div className="font-mono text-[10px] tracking-[4px] uppercase text-null-green mb-3">// THE NULL ABYSS</div>
          <div className="rounded-md border border-[rgba(120,80,255,0.28)] bg-[rgba(120,80,255,0.05)] p-4 sm:p-6">
            <div className="flex flex-col gap-2.5 text-[13px] leading-relaxed text-null-muted">
              <p>
                Beat all 5 bunkers to open <span className="text-null-white">THE NULL ABYSS</span> from the title screen — an
                <span className="text-null-white"> endless descent</span> below The Last Light. There is no bottom and no
                lift cap; the floors just keep going and hitting harder.
              </p>
              <ul className="flex flex-col gap-1.5 pl-1">
                <li>• Your <span className="text-null-white">deepest floor</span> this season is your Abyss rank.</li>
                <li>• The top 3 ranks split the seasonal <Tag kind="stablecoin" /> bonus pool.</li>
                <li>• The deep floors drop the <span className="text-null-white">best crafting shards</span> in the game.</li>
                <li>• <span className="text-null-white">Death ends the dive</span> — no respawn — so bank your depth by
                  going as deep as you dare, then dying is how the run is scored.</li>
              </ul>
            </div>
          </div>
        </div>

        <p className="text-center font-mono text-[10px] text-null-muted pb-4">
          Play free, loot free — NULL_STRIKE is free too. You only ever spend real money if you choose to buy premium gear or a Season Pass.
        </p>
      </div>
    </div>
  )
}
