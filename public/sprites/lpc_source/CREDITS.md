# LPC Asset Credits — NullState

This file lists attribution for every Liberated Pixel Cup (LPC) sprite
sheet currently wired into `public/game-engine/assets.js` under
`LPC_HERO`, `LPC_ARMOR`, and `LPC_WEAPON`. All LPC artwork is licensed
under one or more of: **GNU GPL 3.0**, **CC-BY-SA 3.0**, and/or
**OGA-BY 3.0**. Full license texts:
- GPL 3.0: https://www.gnu.org/licenses/gpl-3.0.html
- CC-BY-SA 3.0: https://creativecommons.org/licenses/by-sa/3.0/
- OGA-BY 3.0: https://static.opengameart.org/OGA-BY-3.0.txt

Compiled from the Universal-LPC-Spritesheet-Character-Generator
project's CREDITS.csv (category-level entries) plus the per-file
credits already shipped in `expansion2/credits/waraxe_scythe_CREDITS.csv`.
**Not yet independently re-verified against the generator's own
"export credits" output for this exact file set** — see note at the
bottom before treating this as final.

## Body (LPC_HERO — walk / idle / hurt / slash / thrust)
`walkcycle/BODY_male.png`, `hurt/BODY_male.png`, `slash/BODY_human.png`,
`thrust/BODY_animation.png`

- Authors: bluecarrot16, Benjamin K. Smith (BenCreating), Evert,
  Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani,
  Johannes Sjölund (wulax), Stephen Challener (Redshrike)
- License: CC-BY-SA 3.0, GPL 3.0
- Source: https://opengameart.org/content/liberated-pixel-cup-lpc-base-assets-sprites-map-tiles
  https://opengameart.org/content/lpc-medieval-fantasy-character-sprites

## Armor — leather_guard tier
`TORSO_leather_armor_torso.png`, `LEGS_pants_greenish.png`,
`FEET_shoes_brown.png`

- Torso (leather armor): Johannes Sjölund (wulax) — CC-BY-SA 3.0, GPL 3.0
  — https://opengameart.org/content/lpc-medieval-fantasy-character-sprites
- Legs (pants): bluecarrot16, JaidynReiman, Joe White, Matthew Krohn
  (makrohn), Johannes Sjölund (wulax) — CC-BY-SA 3.0, GPL 3.0 —
  https://opengameart.org/content/lpc-medieval-fantasy-character-sprites
- Feet (shoes): bluecarrot16, Johannes Sjölund (wulax) —
  OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 —
  https://opengameart.org/content/lpc-medieval-fantasy-character-sprites

## Armor — iron_plate tier
`TORSO_chain_armor_torso.png`, `LEGS_plate_armor_pants.png`,
`FEET_plate_armor_shoes.png`

- Torso (chain armor) and Legs/Feet (plate): Michael Whitlock
  (bigbeargames), Matthew Krohn (makrohn), Johannes Sjölund (wulax) —
  OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 —
  https://opengameart.org/content/lpc-medieval-fantasy-character-sprites

## Armor — rune_armor tier
`TORSO_plate_armor_torso.png`, `LEGS_plate_armor_pants.png`,
`FEET_plate_armor_shoes.png`, `HEAD_plate_armor_helmet.png`

- Torso/Legs/Feet (plate): Michael Whitlock (bigbeargames), Matthew
  Krohn (makrohn), Johannes Sjölund (wulax) — OGA-BY 3.0, CC-BY-SA 3.0,
  GPL 3.0 — https://opengameart.org/content/lpc-medieval-fantasy-character-sprites
- Head (plate helmet): bluecarrot16, Johannes Sjölund (wulax) —
  OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 —
  https://opengameart.org/content/lpc-medieval-fantasy-character-sprites
  https://opengameart.org/content/expanded-ulpc-head-accessories-facial-assets-hats-helmets

## Weapons
`WEAPON_dagger.png` (rusty_blade, twin_daggers), `WEAPON_longsword.png`
(ancient_blade), `WEAPON_long_spear.png` (frost_spear)

- dagger, longsword: Johannes Sjölund (wulax) — CC-BY-SA 3.0, GPL 3.0 —
  https://opengameart.org/content/lpc-medieval-fantasy-character-sprites
- long_spear: based on wulax's animations, extra weapon submitted to
  the LPC weapons expansion — https://opengameart.org/content/lpc-weapons-two-bows-a-spear-and-a-trident
  — CC-BY-SA 3.0 / OGA-BY 3.0 (per-submission; author name on this
  specific spear variant not yet double-checked against the exact
  file shipped in `LPC_EXP` — verify next session, see note below)

`WEAPON_waraxe_attack_slash.png` (war_axe), `WEAPON_scythe_attack_slash.png`
(void_reaper) — already fully documented in
`expansion2/credits/waraxe_scythe_CREDITS.csv` (shipped alongside this
file): Benjamin K. Smith (BenCreating), bluecarrot16, Sander Frenken
(castelonia) for waraxe; bluecarrot16 for scythe — CC-BY-SA 3.0 / GPL 3.0.

## Weapon — hunters_bow (wired this session, Option A)
`bow/BODY_animation.png` (shoot pose), `bow/WEAPON_bow.png`, plus the
same leather/chain/plate armor part filenames reused from the tiers
above (LPC keeps part names consistent across animation folders)

- Authors: bluecarrot16, Benjamin K. Smith (BenCreating), Evert,
  Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani,
  Johannes Sjölund (wulax), Stephen Challener (Redshrike) — same
  contributor set as the base body sheets (the shoot/bow animation
  ships as part of the same LPC character-bases submission)
- License: CC-BY-SA 3.0, GPL 3.0
- Source: https://opengameart.org/content/liberated-pixel-cup-lpc-base-assets-sprites-map-tiles
  https://opengameart.org/content/lpc-medieval-fantasy-character-sprites

## Weapon — idle/walk carry overlays (sourced this session, punch list #8, v38)
`weapon_walk/WEAPON_dagger_walk.png`, `weapon_walk/WEAPON_longsword_walk.png`,
`weapon_walk/WEAPON_bow_walk.png`, `weapon_walk/WEAPON_spear_walk.png`

Cropped (rows 8-11 = walk up/left/down/right, cols 0-8 = 9 frames) from each
weapon's full 21-row "universal" sheet in the
Universal-LPC-Spritesheet-Character-Generator repo
(https://github.com/sanderfrenken/Universal-LPC-Spritesheet-Character-Generator),
per its `CREDITS.csv`:

- dagger (`spritesheets/weapon/sword/dagger/dagger.png`): bluecarrot16,
  Johannes Sjölund (wulax), Matthew Krohn (makrohn) — OGA-BY 3.0,
  CC-BY-SA 3.0, GPL 3.0 —
  https://opengameart.org/content/lpc-medieval-fantasy-character-sprites
  https://opengameart.org/content/lpc-extended-weapon-animations
- longsword (`spritesheets/weapon/sword/longsword/longsword.png`): Johannes
  Sjölund (wulax), bluecarrot16 — OGA-BY 3.0, CC-BY-SA 3.0 —
  https://opengameart.org/content/lpc-medieval-fantasy-character-sprites
  https://opengameart.org/content/lpc-extended-weapon-animations
- bow, "normal" variant (`spritesheets/weapon/ranged/bow/normal/universal/foreground.png`,
  used for hunters_bow): Johannes Sjölund (wulax) original art, Pierre
  Vigier (pvigier) walk animations, split/tweaked by bluecarrot16 —
  OGA-BY 3.0+, GPL 3.0, CC-BY 4.0 —
  https://opengameart.org/content/lpc-medieval-fantasy-character-sprites
  https://opengameart.org/content/lpc-walk-animations-for-bows
- spear, used for frost_spear (`spritesheets/weapon/polearm/spear/foreground.png`
  — note this is the generator's plain "spear" family, a different source
  submission than the `WEAPON_long_spear.png` attack overlay above, but the
  same weapon type; picked because it was the one with a clean matching
  walk-carry layer): Pierre Vigier (pvigier), Johannes Sjölund (wulax),
  Inboxninja — CC-BY-SA 3.0 —
  https://opengameart.org/content/lpc-medieval-fantasy-character-sprites
  https://opengameart.org/content/lpc-spear-and-shovel-reworked

war_axe and void_reaper reuse `expansion2/waraxe/walk.png` and
`expansion2/scythe/walk.png` — already covered by
`expansion2/credits/waraxe_scythe_CREDITS.csv` (see above), just wired up
this session — no new asset for those two.


This file was assembled by cross-referencing category-level rows in
the LPC generator's CREDITS.csv (fetched from GitHub) against the
specific filenames wired in `assets.js` — NOT by running the actual
generator tool and using its own "export credits for my selection"
feature, which is the authoritative source. The category-level match
is very likely correct (these are the standard, widely-reused LPC
base/armor/weapon sheets, not obscure variants), but the `long_spear`
attribution above is the one line worth a 2-minute double-check if
you have a working `npm run dev`/browser session: load the actual
generator, select the same pieces, and diff its credits export
against this file. Everything else can be treated as settled.
