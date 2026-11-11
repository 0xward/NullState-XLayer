# ART-TODO — sprite work needing an image-generation MCP

These tasks need an image-generation tool (gemini-mcp / imagine.art). They
can't be done without one. Everything else from the 6-issue batch is already
merged to `main`.

## MCP setup (do this first, in a fresh session)

MCP servers only connect at session start, so after configuring, **start a new
session**. Config lives in `~/.claude.json` (already has `imagine` + `gemini-mcp`).

- **gemini-mcp** needs a Gemini API key (free: https://aistudio.google.com/apikey):
  ```
  claude mcp remove gemini-mcp -s user
  claude mcp add gemini-mcp -s user -e GEMINI_API_KEY=<KEY> -- npx -y @houtini/gemini-mcp
  ```
- **imagine** needs OAuth (`/mcp` in an interactive app).

Verify with `claude mcp list` (should show "Connected", not "Failed"/"Needs auth").

---

## Task A — Weapon in-hand art must match its marketplace icon

The in-game weapon is an **artist-drawn ULPC overlay** held by the Knight; the
store shows a separate **marketplace icon**. For the Frost Spear these diverged
badly — the store shows an ornate blue crystalline spear, but in-hand it was a
plain brown stick (only a blue tint was applied as a stopgap). **Audit all 9
weapons and regenerate any overlay whose look doesn't match its store icon.**

Weapons (each has `/sprites/marketplace/<id>.png` + 4 overlay sheets):
`rusty_blade`, `emberwood_maul`, `ironbolt_crossbow`, `argent_waraxe`,
`ancient_blade`, `frost_spear`, `verdant_reaper`, `void_katana`, `sunfire_bow`.

### Marketplace icon format
- `public/sprites/marketplace/<id>.png` — **64×64**, transparent PNG, pixel-art.

### ULPC overlay format (the hard part)
- 4 files per weapon in `public/sprites/lpc_source/weapon_ulpc/`:
  `<id>_walk_fg.png`, `<id>_walk_bg.png`, `<id>_atk_fg.png`, `<id>_atk_bg.png`.
- Each is a **sprite sheet**: `cell = height / 4` (4 rows = facing up/left/down/right),
  `cols = width / cell` = frame count. Frost Spear walk = 576×256 → 64px cells,
  9 frames. `fg` = the part drawn IN FRONT of the body; `bg` = the part the body
  occludes (drawn behind). Frame- and hand-anchor-matched to the LPC rig — this
  is precise work; expect several iterations + manual pixel cleanup.
- Engine reads these in `entities.js` `_drawWpnOvlLayer()` / `_wpnOvlFor()` and
  `assets.js` `LPC_WPN_OVL` (auto-built per weapon id). Config per weapon:
  `assets.js` `NS_WEAPON` (anim, motion, gy, ln, sfx, glow, ovlTint/ovlTintA).
- After proper art lands, drop the stopgap tint boost on `frost_spear`
  (`ovlTintA` was raised 0.30 → 0.62 as a color-only band-aid).

## Task B — Per-tier evolution art (owner request)

Today a weapon's evolution tiers only **recolor/glow the same overlay** via code
(`buildWeaponEvolution` in `lib/constants/marketplace.ts`: `spriteOverrideTint`,
`fxColorOverride`, `glowOverride`; render intensity scales in
`_drawWpnOvlLayer` via `evo`). The owner wants **distinct generated art per
tier/level** — each evolution step should look meaningfully fancier, not just
brighter.

- Tiers per weapon: `maxTier = max(2, fxTier)`. So fxTier-1/2 weapons have 1
  upgrade (T1→T2); fxTier-3 weapons have 2 (T1→T2→T3). Shard costs `[8, 14]`.
- **Needs both art + an engine change:** add per-tier overlay sheets (e.g.
  `<id>_t2_walk_fg.png`, `<id>_t3_...`) and make `LPC_WPN_OVL` + the overlay
  lookup select the sheet by `opts.weaponEvo` (already threaded through
  `drawLPCComposite`). Consider per-tier marketplace icons too so the store /
  inventory preview shows the evolved look.
- Keep the existing tint/glow escalation as a fallback for any tier without a
  bespoke sheet.

## Task C — NullState Warden icon (upgrade the stopgap)

`pass_warden` is the Season-Pass reward outfit. Its icon was missing
(`/sprites/marketplace/pass_warden.png` 404 → blank inventory row). It's now a
**stopgap**: an emerald recolor of `rune_armor` (via sharp). Replace with a
proper bespoke **64×64 pixel-art** icon: a luxurious green-glowing warden
outfit, emerald (#00ff88 / #00c46a) + gold accents, clearly premium and
distinct from base gear. The in-world skin (`assets.js` `LPC_OUTFIT` /
`pass_warden` with tint #00c46a, glow #00ff88) already renders green-glowing.

---

## Style reference
Match the existing pixel-art: chunky readable pixels, warm-to-cool shading,
saturated but not neon, transparent cutout. Anchor new weapon art to the
weapon's own marketplace icon; anchor tiers to the base weapon; keep a single
consistent light direction across a set.
