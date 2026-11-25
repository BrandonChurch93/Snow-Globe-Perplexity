# spring_mini3: handover (spring miniature)

Branch `agent/p4-spring_mini3` at `7bc93d5` (last work commit `20e7055`); looks on `agent/p4-spring_mini3-looks`. Started from `origin/main` with `origin/agent/p4-spring_mini2` merged in. The notes of the agent before me (`agent/p4-spring_mini2-looks:HANDOVER.md`) still hold where this file does not say otherwise.

## Files (mine)
- `src/seasons/spring/miniature.ts`: builds the group, calls `village.update` and `tree.update`.
- `src/seasons/spring/mini/palette.ts`: every colour of the part.
- `src/seasons/spring/mini/village.ts`: cover over the shared village (stone, slate, moss, storm wash), the colours of spring's own copy of the shared mesh (`dressed`: chimney, fence), the turf with its kinds (`vSurf.x`: 0 lawn, 1 roof moss, 2 bank skirt with depth in `vSurf.y`, 3 rock with `vSurf.y` 1 on stepping stones), growth, pond, halos, storm glow sprites. `update` sets clock, gain and `storm` (1 at landing, 0 after `config.shake.settleCheckSeconds`).
- `src/seasons/spring/mini/tree.ts`: blossom, twig, bark materials; `STORM` terms; level lists.
- `assets-src/village-spring/build.mjs` (+ `levels.mjs`, `RECIPE.md`): `turf`, `growth`, `water`.
- `assets-src/tree-spring/build.mjs` (+ `RECIPE.md`): `blossom`, `twigs`, collider balls.
- One line outside my files, by `/root`'s leave (decision 87): `src/miniature/surface.ts` line 80, commit `94de95e`.

No file of mine needs an `ASSETS.md` row: nothing is a generated picture or a bought file; both assets are built by their `build.mjs`.

## Make
`npm run make -- village-spring`, `npm run make -- tree-spring`, `npm run texpack`, `npm run build`. After a merge of main: `git checkout -- assets-full public/assets` first, then the four again. Never commit `assets-full/` or `public/assets/`.

## Constants that carry the look
Tree (`assets-src/tree-spring/build.mjs`):
- `CROWN { centre [0.8, 27.5, 1], r [20.5, 15.6, 14.5], floor 11.6, reach 13 }`. Built box x -19.3..20.9, y 14.6..44.0, z -13.4..15.3; farthest point 35.6 mm from the globe's centre. The box top must stay at or under about 44.3, or the interior camera's M1 (miniature clear of the frame's edge) is at risk; at 44.0 it passes.
- `LOBES { count 44, spacing 6.3, tall 1.3, shell [0.22, 1], r [3.4, 2.3, 3.2], size [0.6, 1.3], sprays 3.8, gap 3.0 }`: 44 rounded tufts, each on its own bough (`BOUGH { from 0.62, to 0.17, steps 6, sag 0.75, past 0.5 }`). My first tufts (`r [3.9, 1.35, 3.6]`, `tall 1.9`, `sprays 5.2`, `gap 2.2`, commit `890edda`) were flat and close and read as level pads with no air between them.
- `TWIG { from 0.36, to 0.085, sides 5, steps 5, bare 0.13 }` (the tip cluster sits up to 13% short of the tip), `CLUSTER { step 2.1, from 0.42, size [0.72, 1.15], ... }`, `LOBE_LOOK { round 0.55, under 0.72 }`.
- Counts: 131 sprays, 542 clusters, 2,978 flowers, 60 collider balls.
- `palette.ts` `blossom [1.5, 1.42, 1.6]`; `tree.ts` `STORM { blossom [0.3, 0.2, 0.25], pale 0.25, wood [0.5, 0.38, 0.38], woodPale 0.8 }` (`[0.42, 0.32, 0.36]` with `pale 0.4`, commit `2189b1b`, was the brighter step before it).

Village (`assets-src/village-spring/build.mjs`):
- `MOUND { count 30, low 0.5, lipMm 1.25, lipReach 3.2, fromMm 5.0, deepMm 6.5, raggedMm 3.0, underMm 2.4, soilMm [0.4, 4.5] }`: 30 moss mounds round the rim; each drapes `fromMm + deepMm * moundAt + ragged` down the glass. The skirt's second surf number is the depth down a mound (0 lawn edge, 0.5 mound foot, 1 well under); below a foot the vertex colour is grey = the light the soil keeps. `fromMm 1.4, deepMm 2.6` (commit `2189b1b`) showed a wide brown soil band the approved image does not have.
- `STEPPING { halfMm [2.25, 0.8, 1.6], sinkMm 0.3, flat 0.5, tones [...], moss 0.12, seed 7719 }`: five stones on `layout.stones`, own random stream so nothing else moves. Rim boulders are `IcosahedronGeometry(1, 3)` now (320 triangles each, were 500) to pay for them.
- Tulip beds: 11, 5 and 4 heads (were 17, 8, 9).
- The build throws if a turf attribute holds a value that is not a number (line 916).

Village (`src/seasons/spring/mini/village.ts`):
- Bank: `BANK { ..., deep 0.05, lip 0.95, fall [0.05, 0.5], sun [0, 0.24] }`, `BANK_SUN [1.45, 1.3, 0.85]`, `BANK_TINT [0.74, 0.52, 0.52]`; `SOIL { tone, pebble, root, fill 2.6, roots 26, share 0.5, seam [collarY + 4.4, collarY + 6.0] }`.
- Pond: `RIPPLE { waveMm 2.5, heightMm 0.15, chopMm 0.034, shore 0.75 }` (rings calmer toward the shore by `vSurf.x`).
- Cottage: `STONE_LIFT [1.15, 1.05, 0.93]` times `(0.62 + 0.76 * mottle)`, `SLATE.tint [1.7, 2.4, 3.0]`, `SLATE_BASE [0.018, 0.022, 0.03]`, slate moss `0.6 * smoothstep(0.56, 0.78, ...)`, `WALL_FILL 2.2`, `STACK.tone [0.58, 0.54, 0.5]` (chimney), `FENCE_WOOD { rail [0.36, 0.225, 0.135], picket [0.29, 0.185, 0.115] }`, `FENCE_TINT [1.08, 1, 0.92]`, `STEP_FILL 1.5`.
- Lights: `HALO_KIND.lamp { size 3.8, rest 0.5 }`, `pane { size 2.2, rest 0.18 }`, `LAMP_GLASS [7.5, 4.6, 1.9]`, `bulbCore 6`.
- Storm: `STORM_COVER { tone [0.86, 0.68, 0.66], pale 0.34, slate 0.9, wood 0.25, moss 0.8 }` (uniform `uVillageStorm` in the cover), `STORM_GLOW { lamp { size 17, rest 0.62, hot 11 }, behind { size 13, rest 0.45, hot 11 }, flame { size 2.3, rest 1.7, hot -2, bloom 3.5 } }`.
- NaN guards: my bump code keeps the plain normal where the bumped one has no length; the shared `villageBump` does the same since `94de95e`. Cause of M1 spring-base's 6 invalid values: a face seen edge on has det 0, `sign(0)` drops the gradient and `normalize` of the zero vector is not a number. Winter's rest and landed hero stills (hd, draft) were byte for byte the same before and after.

## Triangles
- My files, highest level: 255,038 (village 190,314 = turf 85,491 + growth 102,423 + water 2,400; tree 64,700 = blossom 55,510 + twigs 9,190; glow sprites 24). Received from spring_mini2: 277,099.
- Lower levels as the makes print them: turf medium 31,162, low 15,581; growth medium 45,180, low 38,920; blossom medium 25,730, low 18,285. Received totals were 120,986 (medium) and 83,506 (low); `tris.mjs` does not print a per-file total at those levels, so I can only say that every change I made at those levels was a cut except the stepping stones (+516 turf medium, +272 turf low against my own 07:31 push), which the cut in boulders, tulips and blossom outweighs.
- Season drawn on the merged build at `7bc93d5`: 1,460,506 of 1,800,000 (high), 856,937 of 1,100,000 (medium), 386,672 of 600,000 (low); draw calls 66 / 66 / 50. On the frozen `e39ec6c` it was 1,492,992 / 869,699 / 394,312.
Count with `node out/work/bin/tris.mjs spring` after `npm run build` (script from `/root`, untracked).

## Measures and tests at the last commit
Run at `a547439` (same code and assets as `7bc93d5`; the merge after it brought only `kit/` and `scorecards/`), draft tier, hd:
- `npm run determinism`: last line `determinism: pass · 3 pictures, 4 page loads, preview, draft, 343 s`.
- `npm run measure -- --unit spring --only M1,M2,M3,M6 --tier draft`: `measure spring: complete · 19 of 19 lines, 3 red · draft · 433 s`.
  - M1: pass on rest, shake, interior, base, surface, settled; 0 invalid values on each (base was 6 on the frozen build). Interior: "the miniature, 542027 pixels in the ids view, stays clear of the edge of the frame".
  - M3 spring-rest: 0.8768 against 0.75, pass (base 0.877 over 176,691 px; miniature 1.057 over 116,024 px). Draft reads higher than final (`/root`'s round 11 number at final was 0.5187 with the miniature at 0.722); I did not run the final tier.
  - M6: pass on all six (shake 21 of 102,000 inside a solid = 0.000206 against 0.002).
  - M2: pass on interior (0), base (0.006), surface (0.0256); RED on rest 0.0498, shake 0.0549, settled 0.0501 against 0.03. I crossed the rest still's texels view with its ids view: all 14,548 soft pixels carry one ids colour, (96, 251, 121), in rows 921 to 1018 across the whole width of the frame; none carries the miniature's colour (249, 190, 16), which has 87,308 pixels in the sharp zone and 0 soft. So the red M2 is not the miniature's; it is whatever part lies across the foot of the frame (I did not look up its name).
- `npx tsc --noEmit`: clean. `npx vitest run`: `Test Files 32 passed | 1 skipped (33)`, `Tests 432 passed | 4 skipped (436)`.
- Not run: any measure at the final tier, `npm run fit`, the live levels medium and low in a browser.

## Dead ends (do not repeat), added to spring_mini2's
- A soil band under thin mounds reads as a dish of earth; the approved bank is moss to the glass foot.
- Flat crown tiers read as bonsai pads from the hero camera.
- A storm wash of 0.55 on the cottage turns the gable white; 0.34 with wood at a quarter keeps the door.
- Setting my three storm glow sprites to 0 does not bring back the lamp post or the trunk in the landed still: the wash is not theirs.

## What is still wrong, worst first (hero still, as a viewer would rank it)
1. The miniature still sits as a low disk: under the mounds' feet a strip of dark soil shows above the collar. `bases3` raises the moss collar to cover it; the ground's rake (`moundAt`) and the collar height are not my files.
2. Tree: smaller than the approved's, its top lower (the interior camera's M1 caps the crown box at about 44.3), trunk thick with a wide foot (shared `src/miniature/trunk.ts`); tufts a little heavier and more even than the approved's sprays; few twigs reach past the blossom.
3. Landed (seen at 08:03, look 21): the whole globe is more opaque and whiter than the approved's; the crown is an even pale pink mass where the approved has a near white core with pink edges; the lamp is a faint small glow on a faint post where the approved has a crisp flame on a dark post; the trunk is patchy; the roof ridge and chimney stay dark where the approved's roof is washed pale; no large warm glow to the right of the lamp. The post and trunk are washed by something in front of them that is not my glow (with my three glow sprites at 0 they stayed washed; I told `spring_air3`; I did not test the veil switched off).
4. Cottage: chimney shape, door recess, arched stone surround, window shape and pane relief are the shared model (open item for the polish rounds, per `/root`). Mine are only the tones.
5. Fence small and far left with pickets between the rails; stepping stones small in the frame and the ones nearest the pond dark. Place and size are the shared layout's.
6. No pool of lamp light on the lawn; petals crowd the cottage wall and pond (kinds3, spring_air3).
7. Not looked at: medium and low live levels, macro and low cameras, anything above the draft tier.

## What I would do next, in order
1. After `bases3`'s collar lands: look at the rest hero again and take `SOIL` out of the shader if no soil shows any more.
2. Crown: vary tuft size more (`LOBES.size [0.45, 1.5]`), let 1 spray in 4 run bare past its last cluster; check the interior M1 row after every change of `CROWN`.
3. Landed: `STORM.blossom` between `[0.3, 0.2, 0.25]` and `[0.42, 0.32, 0.36]` with the rise weighted to the crown's middle; `STORM_COVER.slate` to 1 and the roof moss with it; lamp flame core white and tighter while `storm` is up.
4. Pale the three stones nearest the pond (they are the rim boulders: `BOULDERS` tones and `ROCK_FILL`).
5. Ask the owner of the shared model for the door recess and chimney shape.

## Messages sent to other owners
- `/root`: cause and fix of M1 spring-base's invalid values (`surface.ts` line 80).
- `spring_air3` (07:04): lamp post and trunk washed out in the landed still; not my glow.
