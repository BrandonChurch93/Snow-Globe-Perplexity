# Handover: fall_air2 (fall's glass dressing, veil, light, backdrop and the rows of leaf, ember, bat)

Written for an agent who has never seen this work. Branch `agent/p4-fall_air2` (from `origin/main`, merges only), looks branch `agent/p4-fall_air2-looks` (this one). The tips and the tests are in `REPORT.md`. The predecessor's handover is `fall_air-HANDOVER.md` on `agent/p4-fall_air-looks`; what is below replaces its constants.

## Files (all mine, nothing else touched)

- `src/seasons/fall/glass.ts`: the crack and the fog (sheets and lip). Exports `standIns` (empty), `glassDressing`, `look`, `dressing()`, `prepare()`, `crackSpread(seconds)`, `fogLift(seconds)`, `update(moment)`.
- `src/seasons/fall/veil.ts`: the shared veil's tint and density, the kinds' colours.
- `src/seasons/fall/rig.ts`: the lights. `src/seasons/fall/backdrop.ts`: the discs behind.
- `src/particles/engine/kinds.ts`: only the rows `leaf`, `ember`, `bat`.
- `assets-src/dressing-fall/**`: empty; `assets-src/refrig/fall.json` unchanged. No generated picture, no shipped file, so no `ASSETS.md` rows and no make target.
- `src/core/chunks/veil.ts`: not changed.

## Make targets

None. After `git checkout -- assets-full public/assets` and a merge of `origin/main`, `npm run build` is enough for stills.

## How it is built now

The fog is one density sliced by 46 sheets (now 16 x 12 cells each, 17,664 triangles; was 23,184) plus a lip shell (1,536). Both are in the `veil` change group and thin evenly with the crossing (`seen` in the shaders), not as a stipple.

- At rest: a skin and pool against the wall, a low bank behind the scene, and the lip under the ground's edge. The lip is the deep green band at the collar: `lip 1.1`, colour from `tint [0.4, 1, 0.5]` to `lipDeep [0.26, 1, 0.32]`, glow `glow 0.11 x lipGlow 1.35 x (0.45 + 1.1 n.y) x (1 + lipDeepGlow 3.2 x low^2)`, `lipDeepMm 8`. Measured against `fall-rest.png` at rows 1040 to 1080 of 1584: approved mean (56, 114, 65); before (150, 202, 145).
- Stirred (`lift` 1): strands on the wall of the dome about `ROLL_AXIS`, three runs of noise in (turn, latitude, radius): (1, 2.3, r/110), (2, 5.1, r/70), (4, 11.3, r/45), weights 0.46, 0.34, 0.2, cut `smoothstep(0.52, 0.6)`, `swirl 8`, `glowLifted 1.6`, `lifted 0.03`, `liftedMiddle 0.02`, `liftedFromMm 45`, `liftedToMm 54`, `liftedFront 0.12`, `lean 0.22`, `bank 0.5`, `bankMm 9`, `lipLifted 0.9`, `lipLiftedGlow 0.9`.
- The flood (what hides the swap, M4): in a shake `flood = thrown + (floodHeld - thrown) x ease((beat - swap.toBeat) / setDownBeats)`, with `thrown = max(stir^2, ease((beat - liftBeats) / (swap.fromBeat - liftBeats)))` and `stir` from the turbulence between `floodFrom 0.64` and `floodTo 0.99`. After the landing `flood = floodHeld 0.05 x (1 - ease((since - states.landedSeconds) / floodGoneSeconds 1.2))`. Fog amp per mm is `mix(lifted 0.03, flood 0.1, flood)`: frame 2123 0.100, 2141 0.070, 2160 0.0335, 2190 0.0335, then the strands thin with `fogLift` (lift 0.81 at +1.5 s, 0.29 at +3 s, pooled by 6.5 s).
- In the liquid: `air 0.0003` (tint [0.3, 0.24, 0.1]), `dustGlow 0.001` (tint [1, 0.72, 0.42], the lamp's and windows' halo), `haze 0.0016`, `pour 0.006`.

The shared veil: `veil = { tint [0.62, 0.95, 0.45], density 0.001, rest 0 }`. At 0.006 it was the pale even wash over the miniature at the landed still.

The crack: `widthMm 0.09, edgeMm 0.05, shade 0.3, bright 3.6, sky 0.5, key 1.6, rim 3.0, room 2.4, jitterMm 0.08, stepMm 2.2, glintPerMm 0.3, catchPerMm 0.1, faint 0.16, warm [1, 0.8, 0.56]`. The bright edge is drawn times `caught` (long lit stretches, a faint hair between, fainter to the tips) and its filter footprint is 1.8 pixels with the same light, so a hair thinner than a pixel does not break into crawling dots.

The rows: leaf `sinkMmS [0.3, 1.8], floats 0.05, renew 0.03, slope 0.5, sizeMm [1.0, 3.5], sizeSkew 2.2` (2 percent of the leaves hang and sink slowly, 3 percent keep falling from the crown, the rest land in 2 to 3 s; about 560 in the air at rest); ember unchanged (`sizeMm [0.12, 0.7]`, skew 4, life 4 to 8 s); bat `sizeMm [4.4, 5.8]` (kinds2 sets `LOOKS.bat.size` against this; tell kinds2 if it changes).

The light: key {[0.82, 0.9, 1], 0.65}, rim {[1, 0.55, 0.22], 0.5}, card {[1, 0.62, 0.3], 0.6} from the left, the rest as before. Backdrop: `colors [teal, rust, amber, slate, orange, orange, warm, amber, gold, amber]`, `gain 1.3`, orange [0.9, 0.31, 0.075], amber [0.65, 0.25, 0.068], warm [0.85, 0.33, 0.085], gold [0.68, 0.3, 0.092].

## Tried and not kept

Fog everywhere when stirred; a thick shell with broad strands (milky blobs); `swirl` 9 to 10 with a wide cut (opaque paint); `lipLifted 1.7` (flat mint band); `lipDeepGlow 10` (twice the approved band's brightness, pale mint); `dustGlow 0.012` (a yellow ball round the lamp); flood following the turbulence with a power (0.25 of the flood at the landed still hides the miniature); bats `sizeMm [3.6, 4.8]` (too small); leaves `sizeMm [2.6, 4.4]`; faster ember rise and longer life (a sim test fails).

## Helpers (not tracked, `out/work/v/`)

`pair.py <still.png> <rest|shake> <out.jpg> [x0,y0,x1,y1 in approved px]` puts the approved crop beside the render. `node out/work/bin/tris.mjs fall` prints the drawn triangles per tier (2 minutes; never while a still renders).

## What is open, worst first, and where to start

1. Embers through the whole dome (R1 #5 severe). The `sparks` emitters are in the shared `src/scene/layout.ts` (`/root`'s; it stays as it is in a season's round, lines are logged for the polish rounds). Untested idea: add to `sparks` a `shell` of spots through the upper dome (`shell(centre, radius, r, directions)` as `canopy` uses), run `tests/layout.test.ts`, look at the rest hero, then send `/root` the tested lines. Raising the ember row's rise and life instead fails a sim test.
2. The crack (R3-1 #5, R3-2 #1, R1 #9): it is a lit hair, straighter and sparser than the approved's branching web, and it does not refract. Refraction needs a picture of the scene in the crack's pass, which my files do not have; ask the owner of the shared glass. The web itself is `HUB`, `ARMS` and `PIECES` in `glass.ts` (traced from the approved rest image): more side branches there is the next step.
3. The storm's wisps (R3-1 #1): softer and less white than approved's. The numbers that worked are in "How it is built now"; brighter is `glowLifted`, whiter is `pale` and `paleGain`, more of them is the weights of the three runs. Mean colour of the landed still already matches approved, so brighten the wisps and darken the pockets together.
4. Orange streaks on the glass's left edge and the thin vertical streaks on the right (R1 #9): the rig's card is orange now but the left wall still shows a blue streak and the upper left a brown sheen. A still with my `air` and `dustGlow` at 0 was unchanged, so both are the shared glass under the rim and the key. Not tried: rim back to 0.35 to see whether the sheen goes.
5. The flood's colour at the swap (R4 #3): green against summer's cream. Mine follows the crossing (`seen`); a tint that starts at summer's and turns green over the window would need the leaving season's tint in my shader.
6. Tell fall_mini2 and fall_base2 that the rig changed (rim 0.5, key 0.65, card [1, 0.62, 0.3]); I did not.
7. Bats: `/root` sets the count 7 -> 4 in the config at the freeze; kinds2 sets `LOOKS.bat.size` against the row's `[4.4, 5.8]`.

## What I could not see

- The crack in motion (R4 #7 was a crawl on an orbiting camera): only the rest still was looked at after the change.
- Leaves lying on the roof after `slope 0.5`: no close look at the roof.
- The landing sheet after main's merge (the sheet on this branch is from 424be89, before kinds2's new leaves).
- The cameras `low` and `macro` after the last changes; `settled`, `interior`, `surface` and `base` were seen once, as the measure run's stills, before the merge.
- Any tier but draft.
