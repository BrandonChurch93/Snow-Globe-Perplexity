# Report: kinds2 (Phase 4, the drawing of the seven new particle kinds)

Branch `agent/p4-kinds2`, tip `49c91ad` (pushed 05:16 UTC, main merged 05:15). Looks branch `agent/p4-kinds2-looks`.
Make targets: none. No stand-ins, no fallbacks, no assets (`assets-src/kinds/` empty, no ASSETS.md rows).

## Commits of this pass (newest first)
- `75688e6` seeds drawn whole only for the storm fade with the storm's gate (summer heap at rest).
- `659a85b` engine: half of fall's renewing leaves born under the dome's top, 55 percent of embers anywhere under the dome; bats 1.6.
- `de9bd44` bats at approved wingspan with own size, bank, beat; ember discs; storm leaf dabs in slow water, more dabs, larger storm leaves, veil over a storm leaf at most 0.4.
- `644bc15` spring storm: petal dabs under less veil, shorter streak, deeper pink.
- `d7d5b11` bats black; leaf hues gold to rust, shaded across the curl with a sheen; lying leaves 35 percent and lying petals 60 percent drawn; fall storm streaks orange with a few gold; more whole seeds in summer's storm.
- `b1b3a75` embers as small orange points with a yellow core; `819f023` summer seeds as hair tufts, fireflies of many sizes; `6d70144` outlines out of focus, lying sheets on their surface, storm streaks.

## Issues, by critic line
| Issue | State | Commit |
|---|---|---|
| Summer R1 #8, #1, R3-1 #5, R3-2 #2, jury "identical flat stars" | fixed: each seed a tuft of 52 hairs turned its own way, soft by depth | 819f023 |
| Summer storm needs streaked seeds | fixed, streaks thinner and dimmer than approved | 819f023, d7d5b11 |
| Summer heap of seed heads at rest (05:07) | fixed, seen on settled hero | 75688e6 |
| Summer R4 "interior frozen" | summer_air2's rows (agreed 03:40) | - |
| Spring R3-2 #2 severe (blurred petals become rectangles) | fixed: Gaussian blob with the outline's own span | 6d70144 |
| Spring R3-1 #3, #4, #11, R3-2 #15 | fixed in part: sizes, lying on the slope, storm dabs | 6d70144, 644bc15 |
| Fall R1 #1 severe, #22, R3-1 #4, jury "flat bat sprites" | fixed in part: black, approved wingspan, own size/bank/beat; one silhouette | d7d5b11, de9bd44 |
| Fall R1 #5 severe (through the whole volume, not bunched) | fixed, seen on rest hero; large soft discs near the glass still missing | 659a85b |
| Fall R1 #15 severe (storm streaks) | fixed in part | d7d5b11, de9bd44 |
| Fall R1 #16 severe (miniature legible in the storm) | not mine alone; storm sheets thinned before the cottage (`CARD.window 0.75`), tree half hidden | - |
| Fall R1 #18 (leaf hues) | fixed | d7d5b11 |
| Fall R3-1 #2, jury "flat leaves" | fixed in part: shade across the curl, sheen, two sides; one outline, still flat at macro | d7d5b11 |
| Fall R3-2 #5 (embers varied, soft near, some at rest) | fixed in part: size and brightness spread, discs; none at rest on roof (row: embers never land) | b1b3a75, de9bd44 |
| Fall R4 #3 (leaves from the window on) | in part, not re-seen on film | de9bd44 |
| Fall R4 #6 (engine side) | no engine change needed: row `slope` 0.72 against a 45 degree roof 0.707; sent to fall_air2 | - |
| Fall M2 fall-surface 0.3882 | not the particle kind: the surface's leaves are `src/seasons/fall/slab.ts` (fall_base2) | - |
| M1 6 invalid values on spring base | not from the kinds: 3 invalid with all particles hidden, same as drawn | - |
| G15 | 2 triangles an instance at every level; no mesh added | - |

## Not done because the approved pair asks otherwise
- /root 05:07 "approved summer has no large seed heads in the air": `references/approved/summer-rest.png` shows fine dandelion heads through the whole dome. I kept the seeds afloat and removed only the heap.

## Constants that matter (src/particles/draw/looks.ts)
- `LOOKS`: petal size 1, mote 1.2, leaf 1.35 flash 0.35, seed 3.6, firefly 1, ember 1.25, bat 1.6.
- Shares: `CARD.chosen [0.004, 0.012, 0.035]` (petal, leaf, seed drawn whole in the storm), `dabShare [0.2, 0.22, 0.6]`, `dabSize 0.36`, `dabCalm 0.8`, `stormSize [0.45, 0.6]`, `lieKeep [0.6, 0.35]`, `lieSize 0.7`, `line.share [0.3, 0.5]`, `line.keep [0.03, 0.9]` skew 3.5, `line.fromPx [6, 30]`.
- Depth: `near {share 0.4, from 0.05, to 0.7, size 1.7, px [2.5, 12]}`, `far {from -0.25, to -0.9, px [0.6, 2.2]}`.
- Leaf: `leafCurl [0.34, 0.5, 0.3]`, `bendFit 0.55`, `leafShade [0.5, 1.15]`, `leafSheen 0.22`, `leafThrough 0.9`, `leafMost 0.95`, `leafLie 0.7`, `leafHue 0.15`, `leafFogMost 0.4`, streak `leafLow [1.3, 0.7, 0.4]` x colour, `leafHigh [1.9, 1.3, 0.6]`.
- Ember: `spark {core 0.42, halo 1.5, haloShare 0.05, tail 1.6, hot [1, 0.74, 0.26], hotCore 0.8, dying [0.85, 0.17, 0.03], small 1.8, large 0.75, fromMm [0.12, 0.7], discHold 0.42, nearShare 0.04, nearFrom [0.05, 0.45], nearPx [6, 14], calmStreak 0.35}`, `sparkKeep [0.012, 1]`, `sparkSkew 12`.
- Bat: `batBody 0.2`, `batGlow [0.06, 0.035, 0.015]`, `batRim 1.5`, `batSoft 0.3`, `batFog 0.01`, `batFlap 0.5`, `batRaise 0.3`, `batBank 0.7`, `batLean 0.5`, `batSpread [0.78, 1.2]`.
- Seed: 52 hairs, `hair.gain 1.5`, `hair.wide 0.012`, `hairSeen 1.5`, `line.seedGain 1.9`.
- Spring storm: `dabFog 0.45`, `dabStreak 0.5`, `dabTint [1, 0.74, 0.86]`.
- Engine (`engine.ts`): `BORN_WIDE { leaf: 0.5, ember: 0.55 }`; lying sheets write `facingPhase(nx, nz)` into `phase`.

## Triangles (G15)
2 triangles an instance at every level. Pass cost 204,000 / 122,400 / 61,200 (high / medium / low); drawn in the view pass and the planar mirror pass at high and medium (408,000 / 244,800), once at low; not in the shadow pass. Unchanged since 04:05.

## Tests on the tip
All on `agent/p4-kinds2` `49c91ad` (origin/main merged 05:15 UTC), read 05:22 to 05:30 UTC.
- `npx tsc --noEmit`: clean (no output).
- `npx vitest run`: `Test Files 32 passed | 1 skipped (33)`, `Tests 432 passed | 4 skipped (436)`.
- `npm run determinism`: last line `determinism: pass · 3 pictures, 4 page loads, preview, draft, 318 s`.
- Winter rest and landed hero, draft hd: byte-identical with the baseline (`cmp`), after every push.
- `npm run measure -- --unit fall --only M3,M4,M5,M6 --tier draft`: `measure fall: not complete · 7 of 19 lines, 1 red · draft · 181 s`.
  - RED `FAIL M3 fall-rest: 0.3726 (threshold 0.75)`: base 0.542 over 175151 px, miniature 0.373 over 90685 px. It was red in Round 10 too (final tier 0.3938: base 0.394, miniature 0.447). In the measure's own crop (`out/work/measure/m3-fall-rest-draft-crops-1.png`) the cottage and tree are dark and soft behind the fog, and my leaves and soft ember discs lie over them where the approved has small sharp ones. How much of the miniature's 0.373 is the particles and how much the miniature and fog I did not separate (no run without particles). Not fixed.
  - M6 fall: rest 0, shake 0.000049 (5 of 102000 inside a solid), interior 0, base 0, surface 0, settled 0; all pass against 0.002; 0 outside the sphere.
  - `M4 is not measured for the unit fall.` `M5 is not measured for the unit fall.`
- `... --unit summer ...`: `measure summer: not complete · 7 of 19 lines, 0 red · draft · 143 s`. M3 summer-rest pass 0.9154 (base 2.171, miniature 0.915). M6 rest 0, shake 0.000088 (9 of 102000), the other four 0; all pass. M4, M5 not measured for the unit.
- `... --unit spring ...`: `measure spring: not complete · 7 of 19 lines, 0 red · draft · 162 s`. M3 spring-rest pass 0.7977 (base 1.429, miniature 0.798; 0.05 above the bar). M6 rest 0, shake 0.000196 (20 of 102000), the other four 0; all pass. M4, M5 not measured for the unit.
- "not complete" is the tool's word for a run with `--only`: 7 of the 19 lines were asked for.

## Looks used (limit 40 a part)
Spring 15, summer 17, fall 23 stills, all draft hd beside the approved crop; plus 2 film frames (2128, 2147) of the change into fall and 4 diagnostic renders of spring's base (M1 check), not counted as looks.
