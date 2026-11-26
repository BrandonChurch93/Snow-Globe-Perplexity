# Summer: light, glass, air glow, net of light, room behind (job `summer_glass`, Phase 6)

Code branch `agent/p6-summer-glass`, last commit `ae2c486c` (a merge of main f80dc66a; the last change is `51d687ac`). Files changed: `src/seasons/summer/rig.ts`, `src/seasons/summer/glass.ts`,
`src/seasons/summer/backdrop.ts`. Nothing else. `src/scene/surface.ts` and `src/globe/shell.ts` are untouched.

## What changed

`rig.ts` (the other four builders tuned under these numbers)
- key `[1, 0.82, 0.6]` at 1.9 from `[250, 230, -400]`; rim `[1, 0.84, 0.64]` at 1.3 from `[-330, 250, -280]`;
  sky `[0.075, 0.092, 0.115]`; ground `[0.03, 0.03, 0.032]`; fill 0.7;
  card `[1, 0.84, 0.66]` at 0.45 from `[-240, 300, 450]`, wrap 0.25, specular 0.4, inside 1.2.

`glass.ts`
- `setGlass`: the window's reflection is cut to `windowGain [0.14, 0.1, 0.14, 0.1]`. It was the flat curtain at the lower
  left. The rim is cool (`rimTint [0.8, 1, 1.25]`), `arcs 2.5` draws the long pale sweeps.
- `WALL`, the far wall's light: a burn against the limb (`hot`, `hotAt`, `hotSize`), white at its middle; the wall parts its
  skirt and the glow into slanted strokes (`brush*`, a noise read along `r - brushLean * a`), and a sheaf of strokes climbs
  the limb above it; an amber edge on the limb round it (`edge 2.6`, `edgeAt`, `edgeIn`); the bloom outside the glass sits
  lower (`spill 0.3`, `spillAt 0.12`). `hot 10`, `hotAt [0.89, -0.06]`, `hotSize [0.044, 0.1, 0.13]`.
- The haze (`haze*`): one glow low behind the miniature, falling off outward and upward. `haze 0.32` at the plume's
  middle; `hazeRim` is what is left at the sides (0.07 of it); `hazeTall` 0.66 and `hazeSideTall` 0.55 hold it under the
  upper third. The first numbers told to the other four builders (about 0.9 linear just over the ground, even through the
  ball) were lowered to these after the mid-pass look: the ball read as fog.
- `POOL`, the net of light: a white knot and `trunks` thin lines out of it, each forking twice (`forkMm`, `fork`), stepping
  aside in kinks (`kinkMm`, `kinkEveryMm`), long on the left and short on the right (`linesMm`, `rightReach`). A line
  thinner than a pixel is drawn a pixel wide and as much dimmer; the pixel's footprint is read with derivatives taken before
  any `discard`. `early` is 0.75: the approved shake picture has the pool lit under the storm.

`backdrop.ts`
- Colours deeper (gold, amber, peach, cream). `CLUSTER`: `floor 0.07` nearly puts out the lights of the open room, `column`
  0.5 keeps a dim amber column on the left, `lift 5.5` with `fromPx`, `topPx` keeps one cream cluster high on the right.

## What is still wrong, worst first

1. The discs behind are larger and softer than approved, and the cluster at the upper right is a few big discs where
   approved has many small crisp ones. Their size is the lens's blur and `DISCS` in the shared
   `src/scene/backdrop.ts`; a season's kit sets only colours and a gain. Not in summer's files.
2. The left limb carries one smooth cream band (sRGB 150 to 207, 16 to 56 px inside the limb, from 0.1 to 0.5 radii above
   the middle) where approved has clear dark glass with thin separate sweeps. It is the rig's rim light seen in the glass
   (`glassLook.rimCard` with `uRimCol`, `src/globe/shell.ts` lines 38 and 408). Seen at draft: with `rig.rim.intensity`
   at zero the band goes (177 to 207 falls to 33 to 125 at 0.4 radii up) and the limb reads dark and clear with the sweeps
   standing apart, close to approved. The rim was left at 1.3 because it also lights the miniature and the other four
   builders tuned under it. The clean mend is one number for the season on line 408 of `shell.ts` (the card's two lobes
   times a `setGlass` amount, 1 for the other seasons, about 0.3 for summer; not tried), or a lower rim with the
   miniature's builder at the table.
3. The burn at the lower left is smoother and paler than approved: there the white patch is ragged, with hard strokes
   and the fence and sunflower dark against it.
4. The lines on the table are thinner and paler than approved, and approved has glints of sand round them (the sand's).
5. The storm (`landed`, seen at review): the dome is a beige grey swirl where approved is white gold with hard bright
   streaks. The glass's part of it (`storm 0.03`) was left as it was; the streaks are the air's.
6. A thin dark straight line at the upper left of the glass (hero hd, about 627,387 to 659,408) stands in `rest` and
   `settled` alike. It is not the window's reflection (it stays with `windowGain` at zero). At six times size it reads as the straight edge of
   a darker wedge in the glass, not a hair. Not found.

## What a critic asks beyond the approved image

A thick wall of glass, the fence bent at the rim, discs seen refracted through the ball: in the approved picture the fence,
the sunflower and the cottage stand straight and unmagnified next to the left rim, the wall is thin, and no disc shows
through the ball. Left as it is.

## Checks on `51d687ac`

`npx tsc --noEmit` clean; `npx vitest run` 54 files passed, 1 skipped, 702 tests passed, 8 skipped; `npm run determinism`
pass (3 pictures, 4 page loads); `npm run strict -- --keys summer-rest,summer-shake` pass; `npm run measure -- --unit
summer --tier draft` 19 of 19 lines, 0 red; `--diag standins` black (0 lit pixels). `winter-rest`, `spring-rest`,
`fall-rest` at draft: the same file hashes on this branch, with `origin/main`'s three files and with the three files as
they were before this pass. On the merge `ae2c486c`: `tsc` clean, vitest 54 files passed, 716 tests passed, 8 skipped,
and the final rest still has the same file hash as on `51d687ac`; strict, determinism and measure were not run again.

## How to look

`npm run still -- --season summer --state rest --camera hero --tier review --format hd --force --look no`, and `--state
landed` for the shake. Globe in the 1080 frame: centre 959,448, radius 374.
