# Fall base, handover

Branch agent/p6-fall-base, head f77009c7 (main b1cb4567 merged in), fourth list. Files touched: src/seasons/fall/base.ts, assets-src/base-fall/mesh.mjs, assets-src/base-fall/layout.mjs, assets-src/base-fall/RECIPE.md. The asset script changed, so `npm run make -- base-fall` must be run and its files committed by /root (80910 triangles, 1448 more than main's 79462; public glb 1348780 bytes, sha eb905811891fd477 on this VM). G15 counts the base three times at high: 1798023 of 1800000, 1977 left.

## Fourth list, what was done
- Right flank: 11 thin vines of 0.75 to 1.15 mm curve over the hide on slants of 24 to 56 degrees, standing 1 to 4.5 mm off it, each with a few thorns.
- Bark: the grain that made rows of scales is off the vines (it stays on the hide). The vines carry a fibre field stretched along their length (barkAt in base.ts, BARK_GRAIN 1.6), and the copper light at the left is broken along the vine by baseDash.
- Left tangle: the pairs are 1.6 to 2.0 mm and 1.1 to 1.3 mm. The thorns are dark: they took the drum's broad warm lobe from the left (power 5 on ironWarm and ironLeft at weights 0.45 and 0.1); vines and thorns take the vines' own narrow lobe now, and the edge sheen and the sky's lift are cut on thorns.
- Left pumpkin: the blue fill on the rind is a warm one at under half the strength, and the body glow is down by 0.68 at the west.
- Front vines: radius 0.85 to 1.7 mm (was 1.0 to 2.05).
- Web: the rings run straight between the spokes (the sag and the wobble are nearly off), the veil is thin, the threads weigh less.
- The long vine at the right foot (TWIGS in layout.mjs, az 72): 25 mm long. At 32 mm the base reached 79.7 mm from the axis and failed tests/app.test.ts, which holds every base inside 74 mm for the phone and the tablet; it reaches 73.6 mm now.

## Where it stands
- M3 at hd review: base 0.823 (was 0.797), bar 0.75, asked 0.78.
- Grid of the base's energy, this branch over approved, columns x 612, 786, 960, 1134 to 1308, rows y 762, 868, 974 to 1080. Before: 0.95 2.30 1.26 0.70 / 0.75 0.46 0.45 0.66 / 2.27 0.38 1.12 0.80. After: 1.05 2.63 1.24 0.71 / 0.75 0.67 0.42 0.68 / 2.30 0.18 1.16 0.79.
- Boxes at hd review, approved against this branch: band 90th percentile 28.7 and 32.6, median 10.1 and 7.7; low vines 27.1 and 28.6; right flank 23.1,25.6,29.4 median 20.6 p90 49.9 against 23.3,23.8,27.4 median 17.3 p90 57.6; left tangle 25.7,19.7,18.8 median 18.8 p90 41.0 against 23.7,16.8,17.1 median 15.4 p90 29.8; left pumpkin 102,52,28.5 median 29 against 96.8,50.9,15.9 median 31.0.

## How the number moved, said plainly
- With the thin vines modelled and the scale grain off the vines the base read 0.739 to 0.833 over six tries of tone. The highest had a silver glare on the vines of the right flank and was dropped; the pushed one reads 0.823. Its last step, from 0.747, came mostly from the copper light at the left: stronger (WARM_WEST 30, CARD_WEST 30) and broken along the vine by a noise field (baseDash). That is tone on modelled vines, not new form.
- The right column did not rise with the new vines (0.70, 0.66 before; 0.71, 0.68 now). Approved's energy there is in thin wet lines and in the knot of thorns; these vines are thicker with a wider sheen.

## What is still short against the approved picture
- The pair does not read as the same base yet.
- Left tangle: the vines read as flat ribbons with pale orange stripes; approved's are round dark brown wood with small copper lights. Darker than approved in the median (15.4 against 18.8).
- Right flank: the vines are thicker than approved's, the sheen wider; no knot of thorns at the top; the hide is pebbled where approved's is smooth with soft folds.
- Front vines: thinner, but still matt next to approved's wet ones; the long cool highlight is faint.
- Left pumpkin: brown and orange, no purple, median 31 against 29, but blue is 15.9 against 28.5, so it is more orange than approved's, and it glows over more of its skin.
- Web: a clear net now, coarser and brighter than approved's fine one.
- Middle row, third cell 0.42 and bottom row, second cell 0.18: the dark front between the pumpkins has less fine detail than approved.
- Under the lip the green of the air stands over the vines (102 against 43 median); not the base's, passed to fall's air by /root.

## Where to go next
- Tones are constants at the top of base.ts (BRAMBLE, DRUM_SHEEN, DRUM_FOLD, DRUM_CRINKLE, DRUM_GRAIN, BARK_GRAIN, PUMPKIN_BODY).
- The left vines want form, not stripes: a knobbly radius along the tube in mesh.mjs would do more than the fibre field. Fall has 1977 triangles left at high and the base counts three times, so any new form must be paid for inside the base.
- /tmp/look/grid.py on the builder's VM copies the tool's M3 into the grid; it is not in the repo.

## Which head each proof was taken on
- On e490169c (main d13d29c6 merged in; the pushed head f77009c7 adds only main's b1cb4567, which changes index.html, kit, public/first and out/stills, nothing under src, assets-src, tools or tests): M3, the grid, the boxes, tsc, the whole vitest (917 passed, 8 skipped), strict on fall-rest and fall-shake (pass), determinism (pass), the stand-ins still (black), G15 (pass, high 1798023 of 1800000), the landed still, the hero still at 3840 final, frames 2400 to 2403 at 3840 final.
- The six stills of winter, spring and summer matched d13d29c6's list on 450d2bfc (the same tree but for the length of the long vine) and again on the build of e490169c.
- On f77009c7 itself: the whole vitest again, 916 passed, 9 skipped, none failed; one more skipped than on e490169c, and which one was not found.
- Main has since moved to b4bc96c0 (chain 16); it is not merged into this branch.

## Not seen
- The storm in motion. The storm was looked at as the landed still only.
- The four 3840 frames were looked at in two cuts (the right end of the ring and the left tangle), not whole.
- The hero still at 3840 final was looked at in two cuts (the left tangle and the right flank), not whole.
- Phone and tablet framing with the long vine: held by the test's number (73.6 mm inside 74), not looked at as pictures.
