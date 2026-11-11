# decor2 sprite credits

## v75 set (cabinet/safe/table/bench)
User-supplied 4-direction sheets (see prior session notes).

## v80 set — LPC breakable/lootable props
18 sprites cut (crop + alpha-trim only, no repainting) from the Liberated
Pixel Cup contest tilesets, mirrored at:
https://github.com/LiberatedPixelCup/RPG_Maker_MZ_LPC_Starter_Kit
(`LPC/img/tilesets/LPC/Final Attributions/Individual Assets/`)

License for all pieces below: dual CC-BY-SA 3.0 / GPL 3.0 (LPC contest terms).

| File(s) | Source sheet | Author |
|---|---|---|
| oak_barrel, barrel_stack | Sharm/barrel.png | Lanea Zimmerman (Sharm) |
| bucket, bucket_water | Sharm/buckets.png | Lanea Zimmerman (Sharm) |
| footlocker, footlocker_open | Sharm/chests.png | Lanea Zimmerman (Sharm) |
| boulder | Sharm/rock.png | Lanea Zimmerman (Sharm) |
| plaque_sword, plaque_coin | Sharm/signs.png | Lanea Zimmerman (Sharm) |
| chalice | Sharm/cup.png | Lanea Zimmerman (Sharm) |
| basin | Sharm/kitchen.png | Lanea Zimmerman (Sharm) |
| hay_pile | Sharm/dungeon.png | Lanea Zimmerman (Sharm) |
| skull_heap | "crpyt" by Skyler Robert Collady | Skyler Robert Collady |
| shelf_stocked, shelf_empty, dresser, cabinet_ornate, cot | "House Objects 1 Revised" by Janna | Janna |

Attribution required on distribution: credit the authors above, the
Liberated Pixel Cup, and link the license (CC-BY-SA 3.0:
https://creativecommons.org/licenses/by-sa/3.0/ or GPL 3.0).

## Ambient dressing set (`amb_*.png`) + `amb_chest_gold.png`

15 sprites cut (crop + alpha-trim only, no repainting) from
`public/sprites/tiles2/topdown_objects.png`, which was already in this repo but
which **nothing had ever loaded** — it shipped in `public/` and was referenced
by no code path at all.

Provenance of that sheet is UNVERIFIED. It entered the repository inside a
single large squash commit (`01be51c`) with no CREDITS entry and no source URL,
so its licence is unknown. That is a real gap, not an oversight in this file:
the pieces are in use now, so if the original source can be identified it
should be recorded here, and if it turns out to be incompatible these fifteen
files are the ones to replace. `docs/network-manifest.md` also notes the sheet.

- `amb_crate_stack_a/b` — stacked crates, corner dressing
- `amb_barrel_a/b/c`    — sealed barrels
- `amb_urn_a`…`amb_urn_i` — clay urns and vases, nine sizes
- `amb_chest_gold`      — open gold chest; replaces the framed-coin art on the
                          `plaque_coin` prop, which is now an openable container
- `coin_pile`           — spilled gold heap; replaces the framed-sword art on
                          the `plaque_sword` prop (owner: both wall frames read
                          as hung photographs). Sixteenth cut from the same
                          sheet, same terms, same unverified provenance.

The first fourteen are `ambient:true` in props.js: scenery only, never
breakable, never lootable, never interactive. `amb_chest_gold` and `coin_pile`
are not — they dress real loot props.

`plaque_sword.png` (the framed crossed swords this replaced) was deleted rather
than left orphaned; `plaque_coin.png` is likewise no longer referenced.
