# Handover: unit `change` (the four changes of season, the three arrivals)

Written by change_builder. Branch `agent/p4-change`, looks `agent/p4-change-looks`. Times UTC.

## State in one line each

| Part | Film frames | State | Worst thing on the newest sheet |
| --- | --- | --- | --- |
| change-winter-spring (shake-1) | window 648 to 683, outside span 672.2 to 677.8, landing 720 | built, flag down | stipple on the dissolving walnut base at 674 to 676 at draft's 2 samples |
| change-spring-summer (shake-2) | 1368 to 1403, 1392.2 to 1397.8, landing 1440 | built, flag down | on the build of c568e8a (sheet of 05:26): stipple on the base at 1394 and 1396, moss and shell base over each other; the sand heap is whole at the right of the foot from 1394 while petals still lie beyond it until 1398; the shell base is pale and flat in the flood at 1398, its shells read from 1400 |
| change-summer-fall (shake-3) | 2088 to 2123, 2112.2 to 2117.8, landing 2160 | built, flag down | stipple on the dissolving shell base at 2114 and 2116 at draft (the globe hardly moves across those two frames, so no blur covers it); summer's flare stands on the rim to 2112 until summer_air2's 9d99651 is on main |
| change-fall-winter (shake-4) | 2808 to 2843, 2832.2 to 2837.8, landing 2880 | built, flag down | winter's base is rust orange in winter's own amber flood 2836 to 2840; the approved winter test shake shows the same (frames 84 to 104), so it is winter's look, not a half base |
| arrival-spring | from 720 | rows have code in their owners' files on the landing clock; `arrival.ts` only sets the clock | beads on the glass and the rising mist cannot be read at sheet size; the storm thins inside one second (720 to 784), not as a slow whirl over `shake.spinDownSeconds`; the petals' jump (736) and the first water (752) read |
| arrival-summer | from 1440 | built: grains (`arrival.ts`), flare, lanterns, pool in owners' files | on the build of c568e8a (sheet of 05:29, 1440 to 1616): the storm is whole on the landing, the flare kindles at 1456, the light pools at the foot from 1456, the storm thins slowly and the miniature is clear by 1584. Wrong: the jump of the sand is 0.1 s long and under 5 mm high and does not read; the pour off the ledge is faint; lanterns one by one and fireflies finding their places cannot be told at sheet size |
| arrival-fall | from 2160 | rows have code in their owners' files on the landing clock; `arrival.ts` only sets the clock | the crack spreading and the bats finding the crown cannot be read at sheet size; the skitter is a small shift near the foot, not a run; faces light middle, right, left inside 0.5 s (2176 two, 2192 three); the fog pools from 2208 |

No stand-in and no fallback is left in any of the seven parts. Neither named fallback was used.

## How a change works (what to keep)

One number, `filmState().change`, 0 before the swap window and 1 after it. `src/shake/change.ts` gives every seasonal part its span of that number (`SPANS`), pinned by `tests/shake-change.test.ts`:

- inside the glass (`miniature`, `arrival`): 0.05 to 0.95, half of it a lag from the far side to the near side, hidden by the storm;
- `light`, `veil`, `particles`: 0 to 1;
- outside the glass (`base`, `glass-dressing`, `surface-dressing`, `backdrop`): `OUTSIDE` 0.69 to 0.85, which is 5.6 film frames at the fastest stroke.

`changeBloom(change)` is 1 across `OUTSIDE` with a smooth ramp of `BLOOM_RAMP` 0.12 on each side. `BUILT_CHANGES` lists the pairs without the stand-in flag (all four now).

`src/scene/lighting.ts`, `CHANGE_BLOOM = { flood: 200, lens: 0.6, pool: 8, swellFrom: 0.46, fall: 0.6 }`, used only when from and to differ:

- the new season's inner light swells from 0.46 of the window (winter into winter keeps the rig's 0.12, so the frozen test shake is untouched);
- `cross = mix.bloom * smooth(lift / fall)` where `lift` is the inner swell's fall (1 at 0.69, 0 at 0.975): the flood stands through the outside span and falls over about 3 frames after the base is whole;
- `cross` adds to the flood on the stage (`uLightFloodFloor.w`, 200 against winter's own 18), to the pool on the table (`f.pool`) and to the lens bloom and the glass shell (`f.bloomTint`). At lens 3.5 the orb burnt to flat white; at 0.6 it keeps its glass. For scale: flood 800 was a white flash, 150 let the dissolve show.

`src/core/materials.ts`, `DRESSING_FRONT = { gain: 2, fromMm: 58, toMm: 230 }`: a part with `change: 'surface-dressing'` changes from the foot outward inside its span (`stageChange()` when `uState.z < 0`).

`src/particles/engine/engine.ts`: while the window is open the particles collide with the union of both seasons' solids (`both(a, b)`, a grid of the smaller distance, cached in `unions`). This took M6 at shake-2's swap from 206 of 102000 to 35. The turn of a particle (`turn`, `follow`, `blend`) was there and is unchanged: each turns at its own `swapAt` (0.22 to 0.78), in place, with its velocity, opacity dipping `SWAP_HALF` 0.22 each side.

`src/seasons/summer/arrival.ts`: the grains. Drawn only from summer's landing until 8 s after it (cover fades 6.5 to 8 s), never at rest, never in the mirror of the slab, 0.6 and 0.3 of them at medium and low (index order is a stride so a prefix is an even share). 46,000 triangles at high while they fly. The pour ends by 6 s (`LOOK.flow`); `pourShare` is 0 at rest.

## Measures

Thresholds: M4 at least 0.85 (`shake.minCoverAtSwap`), M5 at least 0.6 (`shake.minVisibleAfterSettle`), M6 at most 0.002 (`sim.maxInsideFraction`), none outside the sphere. M6 is given as swap / landing.

| Change | Cycle | What changed | Tier | M4 | M5 | M6 swap | M6 landing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| winter-spring | before | first bloom only (d58fa20) | draft | 0.9449 | 0.9598 | 0.001559 | 0.000265 |
| spring-summer | before | same | draft | 0.9932 | 1 | 0.00202 RED (206 of 102000) | 0.000029 |
| summer-fall | before | same | draft | 0.9622 | 0.9472 | 0.000137 | 0.000029 |
| fall-winter | before | same | draft | 0.9934 | 0.9997 | 0.000078 | 0.000029 |
| winter-spring | work | union collider, capped bloom, dressing front (fc047e8) | draft | 0.9451 | 0.9622 | 0.000324 | 0.000363 |
| spring-summer | work | same | draft | 0.9931 | 1 | 0.000343 | 0.00002 |
| summer-fall | work | same | draft | 0.9633 | 0.9382 | 0.000118 | 0.000049 |
| fall-winter | work | same | draft | 0.9937 | 0.9998 | 0.000069 | 0.000029 |
| winter-spring | 1 | flood falls sooner, grains only while they fly, main at 832eb32 merged (c568e8a) | final | 0.9444 | 0.9864 | 0.000284 | 0.000265 |
| spring-summer | 1 | same | final | 0.9797 | 1 | 0.000353 | 0.000029 |
| summer-fall | 1 | same | final | 0.9198 | 0.9728 | 0.000088 | 0.000039 |
| fall-winter | 1 | same | final | 0.9603 | 0.9996 | 0.000088 | 0.000039 |

Cycles used at final tier: 1 of 5 on each change (05:11 to 05:23 on c568e8a, engine ef1720f38b0d94af). Outside the sphere: 0 in every line. Nothing is red. M1 on the eight judged stills of the unit was not run at final (`npm run measure -- --unit change --tier final`, run again until it says complete; with `--only` a rerun starts the asked lines again from the first). `npm run determinism` on the same build: `determinism: pass`.

## Open issues from the critics, mine (Round 10 R4 on fall, Rounds 8 and 9 R4 on spring and summer)

Round 10 R4 (fall), judged on 216e427, before the work below:

- Issue 1, the exposed cut at 2106 to 2120. Fixed in my files with 6a5643c (flood capped so the base keeps its shape, table dressing from the foot outward), 405aaee (the flood falls over about 3 frames once the base is whole) and SPANS (the lights behind cross linearly over the whole outside span, 5.6 frames, with the flood). Seen on `flood-shake-3.jpg`. Not yet on main: the flare leaving before the window (summer_air2, 9d99651). Still open: the stipple (below).
- Issue 3, veil and leaves across the window (shared). The engine turns every particle in place and whole by the window's close (verified in the engine; M6 green). The veil's colour crosses 0 to 1. On merged main leaves are seen in the dome at 2122 and 2124 and the storm is whole on the landing (2160). Density: summer's veil is 0.09 and fall's 0.006, so the shared flood thins fifteen times across the window; fall's own fog volume must stand in (fall_air2 knows from summer_air2). Leaves at storm size and brightness are `src/particles/draw/**` (kinds2).
- Issue 4, the arrival revealed and the faces lit as a wipe. The faces are fall_base2's (see below, taken in part). The rest of the staging is open.
- Issue 5, the bright patch far left on the table at 2120. Fixed with 405aaee (`fall: 0.6`): the pool on the table is down by 2122. Seen on `flood-shake-3.jpg`.

Rounds 8 and 9 R4 (spring, summer): "no globe motion" is the hand, frozen for this unit (open item 71). "Surroundings never answer, base orange for a frame at 666, inner light flips early": the bloom was rebuilt after those rounds (capped flood, light swelling from 0.46, lights behind over the whole span); Rounds 11 and 12 judge fc047e8. "Season wiped on, not grown" is the arrivals' staging, open.

Known and open, worst first as a viewer sees it:

1. The arrivals are not yet staged one thing after another across the first 3 s in any season; the storm thins as an even fade in about 1 to 3 s, not as one slow whirl (the air builders' `veil.ts` and the engine's settle, not mine; what an arrival adds is mine).
2. The outside dissolve is a per pixel stipple (`stageGone` in `materials.ts` hashes `gl_FragCoord.xy` with `uSeed`). At draft's 2 samples it shows as grain on the base in 2 frames of each change. At final tier (24 samples, frame 2116 rendered at 05:05, `final-2116.jpg` on the looks branch) it averages to a fine grain and the frame reads as a double exposure of the shell base and the twig base under the flood; the globe hardly moves in that frame, so no motion blur helps.
3. Summer: the sand's jump off the ledge does not read (see next things).
4. Shake-2: the shell base is flat cream in the flood at 1398 to 1400 and the heap is nearly whole at 1396 while petals still lie beyond it (the heap is one mesh with `change: 'surface-dressing'`, its front runs 58 to 230 mm so most of a heap near the foot changes first; that is the wanted order, but it reads early).
5. Shake-4: winter's base is rust orange in winter's amber flood (winter's approved look; frozen).

## Next three things, in order

The order below is by what can be finished and seen soonest, not by rank; the arrivals (rank 1 above) are the longest work and need the owners.

Before them: the branch last merged main at 832eb32 (04:41). Main has moved since (194209a at 05:23; the commit of the 05:20 freeze, with all ten tips, is due on origin/main about 05:35). `git checkout -- assets-full public/assets`, merge `origin/main`, make the parts whose sources changed, `npm run texpack`, `npm run build`, then render winter's two stills and the test shake again and compare them with the hashes below before anything else.

1. Summer's jump: in `src/seasons/summer/arrival.ts` `LOOK.jump.liftMm` is `[0.5, 4.5]` (a flight of about 0.1 s). Try `[1, 10]` and `hopMm` `[0.6, 5]`, then `npm run sheet -- --first 1438 --last 1452 --tier draft --force` and the landed still of summer. bases2 asked for the fine radii (0.07 to 0.15 mm); keep them, raise the count's reach instead if it still does not read.
2. The stipple: if it still shows at review tier, replace the hash in `stageGone` (`src/core/materials.ts`) by a low frequency noise in object space (about 3 mm cells) plus the radial front, so the old base breaks into patches under the flood and not into pixels. The winter into winter shake does not run this path (`from === to`), so winter stays byte-identical; check it anyway.
3. The arrivals, one season at a time, spring first (it opens the film): render `npm run sheet -- --motion arrival --shot shake-1 --fit --tier draft --force` and close sheets on the glass (beads) and the foot (water); where a row is not seen, write the exact lines to the owner (`spring_air2` for beads and mist in `glass.ts` and `veil.ts`, `bases2` for the water in `base.ts`). Then fall (crack: `fall_air2` `glass.ts`; bats: `fall_mini2`; skitter: `fall_base2` `slab.ts`), then summer (lanterns one by one: `summer_mini2`; fireflies: `kinds2`).

## Tried, and what I could not see

Tried, with the numbers:

- Flood strength (`CHANGE_BLOOM.flood`): 800 was a white flash over the whole base, 150 let the dissolve show clean, 200 is kept. Lens bloom 3.5 burnt the orb to flat white for 3 frames, 0.6 keeps the glass.
- Fall of the flood (`fall`): 1 (the flood dying with the inner swell at 0.975 of the window) left a bright patch on the table after the base was whole (the critics' frame 2120); 0.6 has it down about 3 frames after the outside span.
- Table dressing: all at once read as popped on; with `DRESSING_FRONT` it runs from the foot (58 mm) to 230 mm inside the same 5.6 frames.
- M6 at shake-2's swap: colliding with the new season's solids only left 206 particles inside the old ones; the union of both took it to 35.
- Summer's grains: radii and pour as bases2 asked; a ring of grains lying on the slab outside the arrival was taken out (they hovered when the heap changed).
- Spring "grown, not wiped on": I wrote lines for `src/seasons/spring/mini/tree.ts` (spring_mini2's file) that open the blossom clusters from buds on the landing clock (`BUD = { closed: 0.34, openSeconds: 1.2, spreadSeconds: 1.5, startSeconds: 0.15 }`) and dropped them unsent: the kit's row for spring does not name it and the storm hides the crown for the first second. They lie beside this file as `bud.patch`, never built into a judged frame and never seen; take them only as a start for a message to spring_mini2.

Not seen by me, so not claimed:

- The build of the 05:20 freeze (ten tips merged). Everything here was seen on c568e8a, which is main at 832eb32 plus my work.
- The grains' fade from 6.5 to 8 s after summer's landing: not seen on a sheet, only that the rest still shows none and the sheet to 2.9 s shows them.
- Any change at final tier except the one frame 2116. Any change or arrival as moving video; all judging was on sheets.
- In the arrivals, at sheet size: beads and mist (spring), lanterns one by one and fireflies finding their places (summer), the crack and the bats (fall). They need close sheets.
- summer_air2's flare leaving before the window (their 9d99651): agreed, not seen merged.

## Agreed with owners

- fall_air2 (03:26): fog is `change: 'veil'`, crosses through the window (on main).
- fall_base2 (04:41): seen faces catch middle 0.04, right 0.10, left 0.20 s with a spit, a low hold and a flare, lit by 0.5 s because the landed still must show them lit; the four behind catch at 0.6, 1.9, 0.3, 1.0 s. `setCandles(moment, seconds)` unchanged.
- summer_air2 (04:42): when summer leaves, the flare, the hot patch and the caustic pool are out 0.2 beat before the window opens (their 9d99651); the golden wall glow thins with `1 - mix.veil`.
- bases2 (04:43): summer's heap runs on under the foot (no notch when the base lifts); my grains no longer lie on the slab outside the arrival.
- kinds2 (04:38, sent, no answer yet): the turn is whole by the window's close; that fall's leaves are not seen from the window to the landing is the drawing of a fast leaf or the fog over it.

## Handover: files

Mine: `src/shake/change.ts`, `src/scene/stage.ts`, `src/scene/lighting.ts`, `src/scene/surface.ts`, `src/core/materials.ts`, in `src/particles/engine/engine.ts` the change of kind and `both`/`unions`, `src/seasons/spring/arrival.ts`, `src/seasons/summer/arrival.ts`, `src/seasons/fall/arrival.ts`. Changed in this pass: `change.ts`, `lighting.ts`, `materials.ts`, `engine.ts`, `summer/arrival.ts`. Not changed: `stage.ts` (already reads `BUILT_CHANGES`), `surface.ts`, the spring and fall `arrival.ts`.

Read only: `src/shake/table.ts` (the hand, open item 71), cameras, `config/showcase.json`, winter.

`npm run make` targets: none of mine. After merging main at 04:41 these were made in this order before `npm run texpack` and `npm run build`: base-fall, base-spring, base-summer, slab-fall, slab-spring, tree-fall, tree-spring, tree-summer, village-fall, village-spring, village-summer.

`ASSETS.md` rows: none (no asset added).

Winter check: `npm run still -- --season winter --state rest|landed --camera hero --tier draft --format hd --force`, sha256 rest `f6a5bfd6b05a584dbfe3e3344f464111ee9389b25fe3540b87da78d6c7681bf9`, landed `06ce7056f5a4ce7e45d414b6f98da58b995c0a4b8e8f2969ff233430d05bf0cd`; test shake `npm run sheet -- --motion swap --shot test --fit --tier draft --force`, nine frames 72 to 104 every 4th.

## Looks used

Counted from my notes, sheets and stills I rendered and looked at: change-winter-spring 10; change-spring-summer 4; change-summer-fall 6 (one of them the final-tier frame 2116); change-fall-winter 4; arrival-spring 2; arrival-summer 4; arrival-fall 2. All under 40. Not looks of a part but checks: the winter into winter test shake 4 sheets, winter's two stills 8 times (2 kept before the first change, 6 to compare). On the looks branch now: `flood-shake-1.jpg` to `flood-shake-4.jpg`, `arrival-spring.jpg`, `arrival-summer.jpg`, `arrival-fall.jpg`, `summer-grains.jpg`, `final-2116.jpg`, with `captions.txt`.
