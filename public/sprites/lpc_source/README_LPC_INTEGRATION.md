# LPC Asset Staging — Phase 5.3 Task 5 continuation

Source: `lpc_entry.zip` (LPC Contest entry by Johannes Sjölund / "wulax") +
`expansion_pack-0_04.zip` (post-contest expansion, same author). Both
verified genuine LPC (Liberated Pixel Cup) packs this session — real deal,
not a mismatch.

## License reminder (unverified this session — CHECK BEFORE SHIPPING)
LPC assets are historically dual CC-BY-SA 3.0 / GPL 3.0 with attribution
required (author: Johannes Sjölund, contact in `base/README` — actually at
repo root one level up, not copied here to save space, see original zips
if needed). No license file ships inside either zip. **Verify current exact
license text from OpenGameArt.org before any production ship** — this
session's network access couldn't reach that site to confirm.

## What's in here
- `base/` — full png/ folder from lpc_entry.zip. Animations: `walkcycle`,
  `slash`, `thrust`, `bow`, `hurt`, `spellcast`, `combat_dummy`. Only ONE
  body: `BODY_male.png` (+ `BODY_skeleton.png`, `BODY_human.png` — skeleton
  is for enemies, human is the same male body under a different filename
  used only in the `slash` folder, functionally identical rig).
  Armor per body part (HEAD/TORSO/LEGS/FEET/HANDS/BELT), each in matching
  `leather_armor` / `chain_armor` / `plate_armor` / `robe` flavors — these
  map cleanly to the 3 armor tiers in `marketplace-items.js`
  (leather_guard → leather, iron_plate → chain or plate, rune_armor → plate
  or robe+glow — final pick TBD, need visual comparison).
  Weapons: `dagger` (slash), `spear`/`staff`/`shield` (thrust), `bow`+`arrow`
  (bow).
- `expansion/64x64/` and `expansion/192x192/` — raw expansion pack contents,
  unmodified. The 192x192 weapons (`WEAPON_longsword`, `WEAPON_rapier` in
  slash; `WEAPON_long_spear` in thrust) are 3x-scale renders of the exact
  same frame grid as the base pack (verified this session: 1152x768 / 3 =
  384x256, same 6x4 slash grid; 1536x768 / 3 = 512x256, same 8x4 thrust
  grid — confirmed via Python/PIL, not assumed).
- `expansion/normalized_64px/` — **already downscaled** this session
  (Lanczos resample, per-frame crop+resize, not naive whole-sheet resize)
  to 64x64/frame so they align with `base/`'s BODY_male/armor sheets.
  Contains `WEAPON_longsword.png` (384x256), `WEAPON_rapier.png` (384x256),
  `WEAPON_long_spear.png` (512x256). **Not yet visually spot-checked in a
  real viewer for downscale artifacting** — Lanczos should be safe for
  LPC's semi-anti-aliased style (it's not flat-color retro pixel art like
  the current player/ set), but confirm it doesn't look mushy before wiring
  in. If it looks bad, redo with `Image.NEAREST` or re-crop from source at
  a cleaner multiple.

## Decisions made this session (don't re-litigate, just execute)
1. **Rendering approach: Path 2 (anchor/rig-driven compositing)**, not
   frame-by-frame hand layering. Body is the LPC male sheet as-is; armor
   pieces and weapons are composited via code at anchor coordinates I
   determine by inspecting each frame, with rotation following aim angle —
   same math pattern as Task 4's `swingFlash` block already uses. Chosen
   because: (a) it's the only realistic path for detailed/realistic art
   without a dedicated animator, (b) LPC's own sheets are ALREADY
   pixel-aligned per body part at identical grid position, so even pure
   layering (stacking PNGs at (0,0)) would technically work for
   TORSO/HEAD/LEGS/etc — it's specifically the WEAPON layer that benefits
   from anchor+rotation since weapons need to track swing direction, which
   the fixed pose sheets don't do per-behavior (no separate sheet per
   weapon behavior, just per weapon shape).
   **Correction/nuance for next session:** actually re-examine whether armor
   pieces (TORSO/HEAD/LEGS/FEET/HANDS/BELT) even need anchor-point logic at
   all — since they're pre-aligned to the SAME grid as BODY_male in every
   animation folder, plain layered stacking (draw armor PNG at same (0,0)
   offset as body, same frame index) should just work with zero anchor
   math. Only WEAPON needs anchor+rotation treatment (for the swing arc to
   follow aim direction across all 360°, matching Task 4). Don't overbuild
   anchor logic for armor pieces that don't need it — verify this
   assumption first with a quick stacked-render test before writing a full
   anchor system for everything.
2. **Body variants: Option 2 — generate 2 more body variants FROM the
   existing LPC male body**, not sourced from a different pack, but
   clearly differentiated per class (not just recolors — user wants visibly
   distinct, likely via silhouette/proportion edits, not just palette swap).
   This part needs actual image-generation capability (outpainting/editing
   an existing character consistently across a full animation sheet) which
   was NOT available in this session (no imagegen tool was loaded/available).
   **Next session must check whether an image-gen tool/skill is available**
   before attempting this — if not available, fall back and ask the user
   directly rather than attempting manual pixel editing across dozens of
   frames (not a good use of one session's budget, likely low quality, per
   this session's honest assessment of programmatic pixel-art limits).
3. Weapon → animation folder mapping (for `_weaponBehavior` in
   marketplace-items.js):
   - `slash` behavior (rusty_blade) → base pack `slash/WEAPON_dagger.png`
     or expansion `slash/WEAPON_longsword.png` (normalized) — pick based on
     visual fit with tier 1 (plain baseline).
   - `ranged` (hunters_bow) → base `bow/` folder (has its own animation,
     not just a weapon overlay on slash/thrust — bow throw and arrows use
     a dedicated 13-frame sequence per base README).
   - `double_hit` (twin_daggers) → base `slash/WEAPON_dagger.png`,
     rendered twice with the existing `double_hit` accent timing from
     Task 4, OR check if LPC has a dedicated dual-wield sheet (not seen in
     these 2 packs — may need a 3rd pack/search later if two visible
     daggers matters more than reusing one).
   - `knockback` (war_axe) → no axe sheet in either pack inventoried this
     session. **Missing asset** — need another LPC-compatible axe pack
     (search OpenGameArt for "LPC axe" — common addon) or reuse
     longsword/rapier as a stand-in.
   - `triple_slash` (ancient_blade) → expansion `slash/WEAPON_longsword.png`
     (normalized) — tier 3, matches "ancient/heavier blade" flavor.
   - `slow` (frost_spear) → base or expansion `thrust/WEAPON_long_spear.png`
     (normalized) or `WEAPON_spear.png` — thrust animation fits a spear.
   - `aoe` (void_reaper) → **no reaper/scythe asset found in either pack**.
     Missing asset, same as war_axe — needs sourcing.
   So: 2 of 7 weapons (war_axe, void_reaper) have NO matching LPC asset in
   what's been provided so far. Flag this to the user early next session —
   don't silently substitute without asking.
4. Armor tier → LPC flavor mapping (tentative, not yet visually confirmed
   side by side):
   - `leather_guard` (tier1) → `leather_armor` parts
   - `iron_plate` (tier2) → `chain_armor` parts
   - `rune_armor` (tier3) → `plate_armor` parts (or `robe` if "rune" implies
     magic-cloth rather than metal — ask user, don't assume)

## Concrete next steps, in order
1. Check whether an image-generation tool is available this session before
   promising body-variant generation — if yes, attempt LPC-male-based
   variants for rogue/wizzard silhouettes; if no, tell the user immediately
   (don't rediscover this 3 sessions from now).
2. Quick stacked-render test: write a small throwaway HTML/canvas test
   (or Python/PIL composite) that layers `BODY_male.png` +
   `TORSO_leather_armor_torso.png` + `HEAD_leather_armor_hat.png` from the
   SAME animation folder (e.g. `walkcycle/`) at identical (0,0) offset per
   frame, and visually confirm (via `view` tool) that they align with zero
   extra math. This settles the open question in decision #1 above before
   writing any real rendering code.
3. Once confirmed, wire a new `HERO_LPC` (or similar) config into
   `assets.js` alongside the existing `HERO` — don't delete the Pixel
   Crawler set yet, keep it swappable until the LPC path is verified
   in-browser (same "don't stack unverified work" lesson from Task
   1-4 handoffs).
4. Extend `Player.draw()` in `entities.js` to layer body+armor (direct
   stack, no anchor math per decision #1 correction) and weapon (anchor +
   rotation, reusing the aim-angle math already in the `swingFlash` block)
   — keep Task 4's particle FX layer on top of this, don't remove it.
5. Flag the 2 missing weapon assets (war_axe/knockback, void_reaper/aoe) to
   the user and ask how to source them, rather than picking a silent
   substitute.
6. Live-browser verification is STILL owed — 4 sessions running now with
   zero actual browser load. If this environment genuinely cannot run one,
   say so plainly to the project owner instead of re-promising again.

## Files changed this session
- Added `public/sprites/lpc_source/` (this staging folder) — new, not
  wired into the game yet, purely staged source material + this README.
- No `entities.js`/`assets.js`/`game.js` changes this session — this
  session was investigation + asset staging only, per user's explicit
  request to discuss the approach before coding.
