# Generated rail icons — `elixir`, `volume`, `volume_off`

The world-map rail shipped nine icons. The in-game HUD has four controls, and
two of them (drop-rate elixir, sound) had no icon in that set — so when the HUD
was moved onto the rail art, those two were left as CSS plates holding vector
line icons, the exact mismatch the move was meant to remove.

These three were drawn to close that gap. The generator was a one-off and is
not checked in: regenerating these should mean redrawing them deliberately, not
re-running a script whose output nobody would diff. The method is written down
below so it can be repeated.

## How they were made, and why not with an image model

An image model cannot reproduce the set's octagonal frame pixel-for-pixel, and
a frame that is *nearly* right is worse than an obvious mismatch — it reads as a
rendering bug rather than a different icon.

So the frame is the REAL one, recovered from the nine existing icons:

1. For each pixel, take the colour that the most icons agree on. The frame is
   identical in all nine so it survives exactly; the centre objects all differ,
   so the agreement collapses there.
2. Refill the interior per row with the median of that row's outermost interior
   pixels, which preserves the field's subtle top-to-bottom gradient. (First
   attempt sampled at a fixed inset and skipped the narrow rows near the top and
   bottom entirely, leaving ghosts of the old objects there.)

The objects are then drawn on the set's own 32x32 logical grid, scaled 4x, with
outlines added automatically — hand-placed outlines are where drawn pixel art
usually goes wrong.

## Choices worth keeping

- **Footprint matched to the set.** The existing objects span ~81px of the 128
  plate; the first flask came out 56 and read as a lighter icon in the same row.
  Measured, not eyeballed.
- **No object uses the frame's green.** The first speaker drew its waves in it
  and they merged into the border two pixels away. Nothing in the original set
  colours an object with the frame accent — this is why.
- **Violet for the elixir.** Nothing else in the set is violet, so it stays
  tellable-apart at 30px on a lit dungeon floor, which is the whole job.
- **`volume_off` is a real icon, not a CSS filter.** Greyscaling an icon that is
  already steel changes nothing a player would notice, and a mute button that
  cannot show its state is worse than a plain one.

Licence: original work for this project, same terms as the rest of the repo.
The nine icons they were derived from are the project's own art.
