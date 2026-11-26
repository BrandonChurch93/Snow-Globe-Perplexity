# Snow Globe inertia verification

## After the summer base and veil merge

`68d5b464` merges main `15d7017d` with the summer base third list and the repaired veil. The hand is still the staged retime, not yet the final main hand. The eight forced draft change checks are all green: M4/M5 0.9696/0.993, 0.9046/1, 0.9548/0.9718 and 0.9594/0.9997 in shake order. The repair lifts shake 2 cover by 0.0361 and shake 3 by 0.1757 over `7aa7b19a`. The literal rows are in `air-main-change.log`.

The forced HD review M3 values before the new base, main `1878461b` to `7aa7b19a`, were winter 0.9365 to 0.9262, spring 0.4308 to 0.4307, summer 0.8266 to 0.7972 and fall 0.5336 to 0.5393. Winter, spring and fall meet the 0.015 allowance; summer's 0.0294 miniature difference did not, even though it stayed above 0.75.

On the new base, the limiting region is the base itself: main `15d7017d` 0.621096 and candidate `68d5b464` 0.621069. Both are red at 0.6211. The miniature is 0.820385 on main and 0.790982 on the candidate, a change of -0.029403. The summer rest pair is HD review from the hero camera, full frame at 400 px each and the exact 696 by 392 px M3 source regions at 1:1. Main is at left in the full frame and above in the native crop.

### Summer miniature isolation

The unmuted controls are byte-identical to the respective official HD review stills. The variants below hide one group in a scratch draw, leaving the solver, sample, approved picture, mask rule and threshold untouched. They diagnose the standard result rather than replacing it.

| Picture | Main miniature | Candidate miniature | Difference |
| --- | ---: | ---: | ---: |
| Official, all groups | 0.820385 | 0.790982 | -0.029403 |
| All seeds hidden | 0.729597 | 0.722516 | -0.007081 |
| Snagged and fixed seeds hidden | 0.741439 | 0.730252 | -0.011187 |
| Fireflies hidden | 0.748430 | 0.715908 | -0.032522 |
| Motes hidden | 0.820209 | 0.789304 | -0.030905 |
| All particles hidden | 0.622364 | 0.621807 | -0.000557 |

The small residual in the last row comes from the two particle-sensitive ID masks. The 696 by 392 px particle-free RGB boxes are byte-identical, with the same common-box high-frequency energy. The cottage itself did not soften. The changes in M3 are driven by the arrangement of particle detail in the full composite, with most of the difference disappearing when seeds are hidden. The score still misses the 0.015 allowance in the actual picture.

On the same particle-free miniature silhouette, using tag coverage of at least 0.10, main to candidate: airborne seeds 42 to 45 heads and 2080 to 2408 px; simulated seed snags 138 to 107 and 2324 to 1747 px; fixed-art heads 18 to 18 and 1253 to 1326 px, with the same scene anchors; fireflies 3 to 3 and 3 to 4 px; motes 26 to 27 and 34 to 40 px. The snags within 2 mm of ground go from 48 to 42, near the cottage proxy 8 to 5, roof 3 to 6, crown 6 to 4 and other above ground 65 to 46. The largest candidate-only snag covers 92 tagged pixels on the centre post, at native (963,612), not on the cottage. One new roof-area head covers 40 at (867,477). Neither points to a single conspicuous new perch that explains the score. No change to the rest behavior was made on this evidence.

## Retimed comparison

`7aa7b19a` brings in main `a6b42369`, which contains the summer sand guard, and the held hand at `6165039b`. The control `f82ea164` is tree-identical to `agent/p6-hand` at `90f78390`. The two comparison trees differ only in `src/globe/liquid.ts`, `src/particles/engine/engine.ts`, `src/particles/engine/loop.ts`, `tests/engine-storm.test.ts` and `tests/liquid.test.ts`.

The retime exposed three jumps by fall embers at card-loop second 2.61. Their steps measured 2.7514, 2.5582 and 2.5420 mm, giving 3 / 125953 above 2.5 mm per step, against the unchanged share bound of 0.000020. The matched hand-only tree had 0 / 125803. `fafa312d` takes up 0.27 of upright wrist acceleration instead of 0.35. Full early counterflow remains, as do the drawn hand and the periodic path construction. The same probe now finds 1 / 125953 (0.000007939469484649036), and the unchanged loop test passes.

### Retimed motion and settling

In shake 2 from f1308 to f1322, the glass moves 14.558 mm right, or 18.452 px at 400 px width. Petals tracked from f1308 in each run move 8.971 mm / 10.893 px in the control and 2.461 mm / 3.325 px with inertia. The 15-frame mean glass speed is 72.749 mm/s; the suspended particles average 72.426 to 58.429 mm/s in the room. At f1338 the share of visible particles behind the motion and past 90% of the liquid radius is 44.7% to 78.0%. The count of visibly suspended petals from f1297 to f1298 goes 1593 to 7838 in the control and holds 1613 to 1613 with inertia.

The hold table counts all particles in liquid state, even very low-opacity ones. The paired settled figures use each season's separate test-shake settled key. Winter closes with 92 more afloat than in the control, but its upper flakes fall from 1555 to 1351. Upper motes at the ends of spring, summer and fall fall from 3599 to 451, 495 to 39, and 4157 to 290. Summer still has 542 seeds, 1200 fireflies and 2500 motes at f2015.

| Hold | Frames | Control first to last | Inertia first to last | Settled key control to inertia |
| --- | --- | ---: | ---: | ---: |
| Winter opening | 0 to 575 | 13047 to 7715 | 13012 to 7659 | 5328 to 5325 |
| Spring | 720 to 1295 | 44000 to 21607 | 44000 to 21625 | 20897 to 20882 |
| Summer | 1440 to 2015 | 12700 to 4251 | 12700 to 4242 | 4197 to 4203 |
| Fall | 2160 to 2735 | 36004 to 26858 | 36004 to 26785 | 26554 to 26555 |
| Winter closing | 2880 to 3599 | 101999 to 12716 | 101998 to 12808 | 5328 to 5325 |

The rest quadrants below count laid particles, in order `-x,-z | +x,-z | -x,+z | +x,+z`. Landed is 0.5 s and rest is 12 s after the same test shake; both use the same response as the film, live app and preroll.

| Season | Landed afloat control to inertia | Rest afloat control to inertia | Rest laid quadrants, control to inertia |
| --- | ---: | ---: | --- |
| Winter | 101980 to 101990 | 13018 to 12858 | 24809/43874/7042/13257 to 25008/43916/7055/13163 |
| Spring | 43982 to 43984 | 21583 to 21575 | 4191/11780/1065/5381 to 4135/11841/1082/5367 |
| Summer | 12699 to 12700 | 4249 to 4249 | 1920/4348/386/1797 to 1924/4503/370/1654 |
| Fall | 35979 to 35976 | 26770 to 26742 | 642/5901/159/2532 to 641/5819/171/2631 |

### Retimed gates and cost

Build and TypeScript pass, and Vitest reports 797 passed and 8 skipped across 58 passing files and 1 skipped file. G11, G12 and G14 are green. G12 found 0.44 mm as the lowest height over 432 airborne frames. G14 found winter frame 480 pixel-identical to frame 0 at HD draft.

Forced draft change results on `7aa7b19a`:

| Shake | M4, floor 0.85 | M5, floor 0.60 |
| --- | ---: | ---: |
| 1 | 0.9696 pass | 0.993 pass |
| 2 | 0.8685 pass | 1 pass |
| 3 | 0.7791 fail | 0.9718 pass |
| 4 | 0.9594 pass | 0.9997 pass |

Shake 3 cover was red before inertia. It remains the air owner's issue: the crown and front rim need more cover. The pink veil in f1341 to f1343 is the change's cover and not the early particle bank.

Live step on the same retimed hand and web colliders (`3992f3b6` to `fafa312d`, before the shader-only guard): 102000 particles, 144 frames of the spring Shake in `Replay.advanceTo`, one warmup and four recorded runs per tree. Mean cost was 13.9073 to 13.5863 ms/frame, down 2.31%; mean run p95 was 23.9300 to 24.3813 ms, up 1.89%. Settle mean was 6.7918 to 7.1605 ms/frame, up 5.43%. This does not include painting, messaging to the worker or display FPS.

## Earlier painted-hand comparison

The matched comparison holds the hand and artwork fixed. `4c1ebe13` is the hand-only tree, with all five twist readers, and `c11e34ce` adds inertia on the same main and assets. The pinned Phase 6 starting point is `1deae971`; it is useful as a historical reference, not as the control for an isolated inertia delta.

## Motion

- The liquid subtracts the glass's local translational and angular velocity in the bulk during the early shake. Coupling increases at the boundary. The suspended load banks rather than moving as an attachment to the glass, and a smooth release near the end of lift lets settled particles join without a single-frame burst.
- The original whirl can reach its full strength before the swap. After landing, a height-weighted return and late thinning clear the crown; summer retains its low dust and fireflies. Film, live Shake, test shake and preroll use the same particle step and do not select motion by capture state. The periodic loop reads the same liquid step and still builds a closed particle path. No change to `src/capture/showcase.ts` or shader code.
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

All four landed hero comparisons were drawn at HD review. The hand-only and inertia pictures keep the same broad swirl and readable miniature when compared with each approved shake at 400 px and in native crown and ground crops. Winter and spring remain dense and pale on the front, as before. Summer keeps the deep gold streaks, seeds and green points; fall keeps the orange streaks over its green veil. This is a visual judgment, not a measured image-distance score.

The four HD review rest triptychs show no conspicuous new pile or bare patch. The score is stricter than that visual check. M3, hand-only to inertia: winter 0.9365 to 0.9262, spring 0.4308 to 0.4307, summer 0.7276 to 0.7160, fall 0.5336 to 0.5393. Spring, summer and fall are already under the absolute 0.75 floor on this control. Winter, spring and summer nevertheless miss the separate no-regression requirement on this exact pair. This candidate is held, not passed. Main's later stable sampling and summer changes are not part of these scores.

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
