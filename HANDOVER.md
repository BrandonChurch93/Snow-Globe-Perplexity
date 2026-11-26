# Snow Globe inertia verification

The matched comparison holds the hand and artwork fixed. `4c1ebe13` is the hand-only tree, with all five twist readers, and `c11e34ce` adds inertia on the same main and assets. The pinned Phase 6 starting point is `1deae971`; it is useful as a historical reference, not as the control for an isolated inertia delta.

## Motion

- The liquid subtracts the glass's local translational and angular velocity in the bulk during the early shake. Coupling increases at the boundary. The suspended load banks rather than moving as an attachment to the glass, and a smooth release near the end of lift lets settled particles join without a single-frame burst.
- The original whirl can reach its full strength before the swap. After landing, a height-weighted return and late thinning clear the crown; summer retains its low dust and fireflies. Film, live Shake, loop, test shake and preroll use the same solver and do not select motion by capture state. No change to `src/capture/showcase.ts` or shader code.
- Shake 2, f1308 through f1322: the glass centre moves 14.276 mm right, projected as 18.101 px in a 400 px picture. The f1308 suspended petal cohort moves 2.439 mm right / 3.321 px after inertia, versus 8.883 mm / 10.809 px before. The 15-frame mean room-frame speeds are 71.485 mm/s for the glass and 72.116 to 58.671 mm/s for the suspended pool, before to after. At f1338, 78.3% of the visible suspended pool is in the trailing near-wall region after inertia, versus 45.0% before. Near-wall here means radius greater than nine tenths of the liquid radius.
- Lift, f1297 to f1298: the count of petals above the opacity cut barely moves, 1,558 to 1,558 with inertia versus 1,617 to 7,407 without. The full numbers measure world-frame speeds, not positions read by a tracker from rendered pixels.
- On the matched review pictures at f1318 to f1320, the glass travels right while much of the suspended detail stays left of the moving tree. In f1338 to f1340, the incoming right-side bank is more distinct, but f1341 to f1343 still becomes a pale pink wash in both trees. Fall f2777 to f2779 preserves orange clusters and clearer branches against the green veil. These are frame comparisons, not a watched playback.

## Film holds and state stills

Counts come from the 240 Hz solver with the full asset colliders and emitters. `Afloat` is a state count, not visible intensity; a low-opacity airborne mote still counts. The alpha totals and crown counts in the records make that distinction visible. The crown here is more than half a radius above the glass centre.

| Hold | Film frames | Hand only, first to last | With inertia, first to last |
| --- | --- | ---: | ---: |
| Winter opening | 0 to 575 | 13,047 to 7,715 | 13,012 to 7,659 |
| Spring | 720 to 1295 | 44,000 to 21,623 | 44,000 to 21,570 |
| Summer | 1440 to 2015 | 12,700 to 4,245 | 12,700 to 4,246 |
| Fall | 2160 to 2735 | 36,004 to 26,867 | 36,004 to 26,782 |
| Winter closing | 2880 to 3599 | 101,998 to 12,104 | 101,994 to 12,478 |

At the end of spring the upper crown contains 494 motes with inertia versus 3,937 without; at the end of fall the same count is 307 versus 4,814. At f2015 summer still has 546 seeds, 1,200 fireflies and 2,500 motes airborne. Its upper motes decrease from 471 in the hand-only tree to 73 with inertia. Winter's closing total is slightly higher after inertia, though upper flakes drop from 1,521 to 1,336.

In the review pairs of f1962 and f2015, the summer crown is a little clearer without losing the large seeds or green lights. The defined settled still on this candidate has 5,325 afloat in winter, 20,882 in spring, 4,191 in summer and 26,555 in fall. The subject's settled rule lets motes hang, fireflies and bats hover or circle, and embers rise. A count that includes all of them cannot be read as a count of unsettled solids.

The test shake for each season supplies both landed at 0.5 s and rest at 12 s after landing. The distribution columns are counts of laid particles in quadrants `-x,-z | +x,-z | -x,+z | +x,+z`; elevated means more than 12 mm above the local ground sample.

| Rest | Afloat before to after | Laid quadrants before | Laid quadrants after | Elevated before to after |
| --- | ---: | ---: | ---: | ---: |
| Winter | 13,018 to 12,858 | 24809/43874/7042/13257 | 25008/43916/7055/13163 | 4278 to 4350 |
| Spring | 21,583 to 21,575 | 4191/11780/1065/5381 | 4135/11841/1082/5367 | 551 to 522 |
| Summer | 4,253 to 4,241 | 1886/4388/450/1723 | 1955/4419/381/1704 | 477 to 469 |
| Fall | 26,770 to 26,742 | 642/5901/159/2532 | 641/5819/171/2631 | 23 to 35 |

## Draft change gates

`node tools/measure.mjs --unit change --tier draft` on `c11e34ce` completed 24 of 24 rows, with M4 shake 3 the only red. The hand-only command requested M4 and M5, so it measured all eight rows in scope and intentionally left the other 16 unmeasured on that tree.

| Shake | M4, hand only to inertia (floor 0.85) | M5, hand only to inertia (floor 0.60) |
| --- | ---: | ---: |
| 1, winter to spring | 0.9881 to 0.9932 | 0.9819 to 0.9880 |
| 2, spring to summer | 0.8698 to 0.8721 | 1.0000 to 1.0000 |
| 3, summer to fall | 0.7557 to 0.7723 | 0.9802 to 0.9694 |
| 4, fall to winter | 0.9622 to 0.9755 | 0.9999 to 0.9997 |

Shake 3 M4 was already red without inertia. The change owner is handling it. No attempt was made to force it over the floor with a denser storm.

`c11e34ce`: TypeScript and build passed; Vitest 783 passed, 8 skipped. G11, G12 and G14 passed. G14 compares the default winter's frame 480 to frame 0 at HD draft and found them pixel-identical. The unchanged loop unit test covering the bound also passed.

## Integration

Fresh engine hashes invalidate film, still and loop checkpoints. On integrated main, build and run `npm run simcache -- film stills loop`. The poster records also carry the engine hash, so regenerate the live first pictures with `npm run poster`, then build again so the table and image bytes agree. The live cold opening starts with no shake history, so the stamp change alone does not prove its pixels moved. Regenerate the hero rest and landed looks, recorded film ranges, card still from loop frame 0 and the card loop. There are no new fetched assets and no `make` target was changed by inertia.
