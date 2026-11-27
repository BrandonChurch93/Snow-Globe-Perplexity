# Fall base, handover

Branch agent/p6-fall-base, head 13ba6faa (main a55e7ee6 merged in), third list. Files touched: src/seasons/fall/base.ts, assets-src/base-fall/mesh.mjs, assets-src/base-fall/layout.mjs, assets-src/base-fall/RECIPE.md. The asset script changed, so `npm run make -- base-fall` must be run and its files committed by /root (79462 triangles, 1532 more than main; public glb 1315916 bytes, sha 993a3032665783f4 on this VM). G15 counts the base three times at high: 1795227 of 1800000 on main 26394c0a, 4596 over that main.

## Third list, what was done
- Left tangle: the thin twigs went from 30 to 9. Three pairs of thick vines wound round one another stand there now (2.2 to 2.7 mm and 1.4 to 1.6 mm), lit copper from the left, with a ridged bark in the normal.
- Thorns over the lip: five long ones of 9 to 14 mm (LIP_THORNS in layout.mjs), each tilted until it clears the glass.
- Leather: long folds at three times the old depth, the crinkle at under half, and a pebbled grain in the normal (DRUM_GRAIN). The sheen is bluer.
- Vines of the right flank: a rough grey sheen from the key and the same grain (BARK_GRAIN), where they were smooth black tubes.
- Front band: the long cool highlight is tighter (LINE_POW 320) and dimmer right of the middle; the low vines are darkened by height except at the two ends.
- Left pumpkin: the body glow is down by 0.6 at the west and a blue fill is on the rind.
- Web: more spokes and rings, fewer gaps, the rings weigh more.

## Where it stands
- M3 at hd review: base 0.797 (was 0.723), bar 0.75.
- Grid of the base's energy, this branch over approved, columns x 612, 786, 960, 1134 to 1308, rows y 762, 868, 974 to 1080. Before: 1.06 2.03 1.25 0.62 / 0.66 0.28 0.52 0.51 / 1.46 0.46 1.40 0.64. After: 0.95 2.30 1.26 0.70 / 0.75 0.46 0.45 0.66 / 2.27 0.38 1.12 0.80.
- Boxes at hd review, approved against this branch: band 90th percentile 28.7 and 32.2; low vines 27.1 and 29.6; left pumpkin 102,52,28.5 median 29 against 97,53,28.3 median 35; left tangle 25.7,19.7,18.8 against 27.5,18.4,17.0; right flank 23,26,29 median 20.6 against 25,26,30 median 19.4.

## How the number rose, said plainly
- Most of the rise is relief in the normal: the bark's ridges on the thick vines at the left and the grain on the hide and on the vines of the right flank. Both are drawn from a noise field, not from modelled form. The approved picture shows a pebbled hide and a ridged bark there, but its energy at the right comes mostly from many thin curving vines over the flank, which this base does not have.
- Before the grain was written the same mesh read 0.67 to 0.72 over four tries of tone.

## What is still short against the approved picture
- Four cells under 0.75: the right column's upper two (0.70, 0.66) and the middle row's two inner cells (0.46, 0.45).
- The right flank shows bare hide where approved has thin black vines curving over it and a thorn cluster at the top.
- The vines of the front band are thicker and rougher than approved's thin wet ones.
- The thorns in the left tangle are smooth orange cones; approved's are dark.
- The bark's ridges at 3840 read as rows of scales, bolder than approved's fine fibres.
- The left pumpkin's median is 35 against 29; band and low vines 3 over at the 90th percentile.
- The web is a pale sheet with wavy threads; approved is a fine clear net.
- Under the lip the green of the air still stands over the vines (104 against 43 median); not the base's.
- In the storm the base differs as at rest; approved's long vine that runs out over the table at the right is not here.

## Where to go next
- Tones are constants at the top of base.ts (BRAMBLE, DRUM_SHEEN, DRUM_FOLD, DRUM_CRINKLE, DRUM_GRAIN, BARK_GRAIN, PUMPKIN_BODY).
- /tmp/look/grid.py on the builder's VM copies the tool's M3 into the grid; it is not in the repo.
- The form that is missing is at the right: thin vines over the flank. Fall has under 5000 triangles left at high, so they must come out of the front band's 37 open vines.

## Which head each proof was taken on
- On 13ba6faa (main a55e7ee6 merged in): M3, the grid, tsc, the whole vitest (917 passed, 8 skipped), the six stills of winter, spring and summer against a55e7ee6's list (all six the same).
- On ee6a802d (main 26394c0a merged in), the same base.ts and base asset: strict on fall-rest and fall-shake (pass), determinism (pass), the stand-ins still (black), G15 (pass), the landed still, frames 2400 to 2403 at 3840 final.

## Not seen
- The storm in motion. The storm was looked at as the landed still only.
- The four 3840 frames were looked at in two cuts (the right end of the ring and the left tangle), not whole.
