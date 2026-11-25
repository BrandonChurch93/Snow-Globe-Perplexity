# kinds3: report (Phase 4, third set)

Branch `agent/p4-kinds3`, last commit `b329515` (merge of `origin/main` on top of `56b30fd`). Looks branch `agent/p4-kinds3-looks`. Make targets: none. No stand-ins, no fallbacks, no placeholder.

Everything below marked "seen" was seen by me in a still at `--tier draft --format hd`, hero camera, beside the approved crop. Nothing else was seen: no film, no arrival frames, no macro or other camera, no medium or low level picture.

## What is still wrong, worst first

1. Spring's storm trails run diagonal (a corkscrew) where the approved arcs run sideways. Cause: the liquid's roll axis, one constant for all seasons, read by the liquid, the engine and three shaders. Not mine and more than a value: open item 74. Seen at spring landed hero.
2. Spring's and summer's storm are milkier than approved; the miniature reads less through it. That is the veil (air agents). My trails over it: seen, thinner and with smaller heads than the approved smears.
3. Fall's storm: trails are straight spokes, not silky arcs; no large blurred leaf shapes; green haze thicker than approved (not mine). Seen at fall landed hero on `56b30fd`.
4. Trails behind the cottage or the trunk (Round 13 R3 part 1 major): each trail now carries its own depth along its length (`56b30fd`), but I could not see a difference by eye; unproven.
5. Fall at rest: far fewer leaves afloat than approved (the row's `floats`, fall_air3). The leaves' curl and tone spread were raised (`bb54623`) but with so few leaves in the hero I could not judge the jury's "flat cutouts". One outline only (maple); "more than one outline" not done.
6. Summer at rest and settled: seed heads afloat few and tiny on main's row; summer_air3's row (`floats 0.03`) not seen by me. Heads are whiter and harder than approved. Tufts lying on roof and stones are barely visible; none on the fence.
7. Fireflies: none sits on a surface; none is dimmed behind foliage beyond the depth test. The lighting-up on arrival (`bb54623`) is not seen, only read in the code; at rest and settled all are lit (seen).
8. Bats: softer, darker, inside the glass (seen); the orange rim is too faint to see at hero size; no wing translucency.
9. Embers: denser and warmer (seen at fall rest), still points where approved has more soft discs.
10. Petals 3 to 10 s after the landing (Round 11 R4 #9) and petals round the pedestal (R1 #10): the row and the dressing, not checked by me.
11. `BORN_WIDE` in engine.ts not moved to the rows of kinds.ts.

## What was built (commits, the issue each answers)

- `0813478` clear rule for cards at rest (`/root` at the freeze), crisp embers, maple leaves, solid bats.
- `73f5582` round embers, fine seed heads at rest (`/root` 06:05), slimmer lower bats.
- `f8c2393` storm trails with heads, shorter, varied by depth (Round 11 R1 #1, R3-1 severe; Round 12 R1 #1, R3-1); bats stay inside the glass.
- `6cd4977` petals at rest in depth classes (Round 11 R1 #6); firefly discs cut to a few (Round 12 R1 #8, R3-1 and R3-2 majors).
- `00e452f` seed head no longer cut by the chimney in settled (Round 12 R3-2); darker bats; larger petal heads.
- `d96b7bd` a quarter of the seeds at rest show as small tufts lifted clear of what they lie on (Round 12 R3-2).
- `bb54623` fireflies dim when carried and light up coming home (Round 12 R4); fall trails longer (Round 13 R1 #6); embers denser, warmer (R1 #5); bats rim and focus (R3-2 #6); leaf curl and tones (jury); more whole petals and larger heads in spring's storm (Round 11 R1 #1).
- `56b30fd` trails keep their depth along their length (Round 13 R3-1 major); warm leaf heads and cream trails in fall.

Not done because `/root` said no: trails drawn flatter than their path (`CARD.line.flat`, removed, never pushed).

## Checks printed on `b329515`

- `npx tsc --noEmit`: clean (08:27).
- `npx vitest run`: 432 passed, 4 skipped (32 files passed, 1 skipped) (08:27).
- `npm run determinism`: last line `determinism: pass · 3 pictures, 4 page loads, preview, draft, 385 s` (08:11).
- `npm run measure -- --unit <season> --only M3,M4,M5,M6 --tier draft`:
  - spring: 7 of 19 lines, 0 red. M3 spring-rest 0.8766 (threshold 0.75). M6 all pass (shake: 19 of 102,000 inside a solid). M4, M5 "not measured for the unit".
  - summer: 7 of 19 lines, 0 red. M3 summer-rest 0.7791. M6 all pass (shake: 9 of 102,000).
  - fall: 7 of 19 lines, 1 red: `FAIL M3 fall-rest: 0.3594 (threshold 0.75)`, base 0.665, miniature 0.359 (frozen build: 0.279). `/root` 05:48: fall's M3 is not the particles. M6 all pass (shake: 6 of 102,000).
- Triangles on the merged build, high / medium / low (08:24): fall 1,606,733 / 937,690 / 417,788; spring 1,492,992 / 869,699 / 394,312; summer 1,660,058 / 916,170 / 438,632. All inside 1,800,000 / 1,100,000 / 600,000 and equal to the frozen build's. My files: 204,000 / 122,400 / 61,200 (two per particle), unchanged.
- Winter rest and landed hero, draft hd: byte-identical to the baseline of `e39ec6c` (`cmp`, 08:26).
- `grep -a -c useProgram` on every still log: 0.

The checks ran on the tree of `56b30fd`; `b329515` adds only main's `kit/`, `scorecards/` and `out/` files.

## Looks used (limit 40 per part)

Fall 26, summer 23, spring 11.
