# Icon Credits

NULL_STATE uses icons from **[game-icons.net](https://game-icons.net/)**.

## License

These icons are licensed under **[Creative Commons Attribution 3.0 Unported (CC BY 3.0)](https://creativecommons.org/licenses/by/3.0/)**.

- **Source:** https://game-icons.net/
- **Authors:** various game-icons.net contributors (Lorc, Delapouite, Skoll, and others — see each icon's page on game-icons.net for its specific author).
- **Delivery:** bundled via the [`react-icons`](https://react-icons.github.io/react-icons/) `gi` (Game Icons) set. Only the icons listed below are imported, so only those ship in the build.
- **Changes:** icons are recolored (via `currentColor`) and resized to fit the UI. No other modifications.

Per CC BY 3.0, this file provides attribution to game-icons.net and its authors. No endorsement by the authors is implied.

## Icons used

Rendered as React components (`react-icons/gi`) in the UI, and as inline SVG in the vanilla-JS game engine (`public/game-engine/game.js`, via `nsIcon()`).

| Icon (game-icons.net) | Used for |
|---|---|
| `GiLightningTrio` | NULL_STRIKE action, energy refill, tutorial bolt |
| `GiOpenChest` | OPEN / cache action |
| `GiOpenTreasureChest` | OPEN VAULT action |
| `GiGrapple` | Grapple-open sealed cache |
| `GiFlame` | Melt-open sealed cache |
| `GiPadlock` | Locked cache/floor, tutorial lock, Season Pass lock |
| `GiScrollUnfurled` | Code Paper pickup |
| `GiKey` | Golden Key pickup |
| `GiDeathSkull` | Guarded (boss) floor banner, "Permadeath" feature |
| `GiHearts` | HP loot glyph |
| `GiCrossedSwords` | Marketplace "Weapons" |
| `GiCheckedShield` | Marketplace "Armor", Crafting "Premium Sectors" |
| `GiBroadsword` | Attack button, "Dungeon Crawler" feature |
| `GiAnvil` | Crafting "Your Weapons" / forging |
| `GiSandsOfTime` | Craft countdown timer |
| `GiPotionBall` | Buy Elixir |
| `GiChainLightning` | "On-Chain" feature |
| `GiSmartphone` | "Mobile-First via MiniPay" feature |
| `GiChest` | "Treasure Vault Quest" feature |
| `GiTrophy` | "Seasonal Leaderboard" feature |
| `GiMedal` | Leaderboard rank 1/2/3 badges |

> Note: the "Finish Now" crafting button intentionally keeps the ⚡ lightning glyph (rendered white), per design.
