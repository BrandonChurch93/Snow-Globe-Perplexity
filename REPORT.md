# summer_air3 — report (Phase 4, third set, season summer)

Branch `agent/p4-summer_air3`, looks `agent/p4-summer_air3-looks`. Last commit and final numbers: see the end of this file.

## What I was given

Files: `src/seasons/summer/glass.ts`, `veil.ts`, `rig.ts`, `backdrop.ts`, the seed and firefly rows of
`src/particles/engine/kinds.ts`, `assets-src/refrig/summer.json`, `assets-src/dressing-summer/**` (does not exist: summer's
glass dressing is light only), and from 06:54 UTC `src/seasons/summer/arrival.ts` for the grains outside the bowl only.

Round 12 judged `e39ec6c`. Issues in my files and what answers them:

| Issue | What the critic saw | Commit | State |
|---|---|---|---|
| R1 #1, R3 major (storm) | cream slab over the ground, flat peach smear, miniature lost | `deef7c4`, `80ede8a`, `ce1cf0d` | fixed in my files; streak and seed-head drawing is kinds3's |
| M3 red (summer-rest 0.58 at final tier) | rest fog over the miniature | `80ede8a` | draft 1.105 (threshold 0.75); final tier not measured by me |
| R1 #12, R3 major (streaks over base) | streak layer across the stone, bright line round the foot | `e6ec213` (arrival.ts) | fixed |
| R1 #2, R3 minor (glass) | fat star, white blade, apex oval, untapered lower-left patch | `ccb533e` | star and patch fixed; blade and apex oval are the shared shell's |
| R1 #13 (backdrop) | olive-brown haze, oversized brown patches left | `ccb533e` | fixed in colour and level; sizes and layout are shared |
| R1 #8 (particles at rest) | large uniform disks, few seeds | `1fcbb02` (firefly row), `e3f8f53` (seed row) | fixed, with kinds3's head drawing |
| R4 major (arrival) | scene uncovered, not arriving | `1475b6c` (pool), lanterns by summer_mini3 | pool delayed; not seen in motion |
| R3 part 2 major (band at the bottom of the sphere) | flat blotch mask | — | not mine: `mini/village.ts` (`SAND`), summer_mini3 |

## What each change does

- `veil.ts` — `holdStorm`: while summer holds its storm (from the swap through 0.3 s after the landing, gone 3 s later) the
  shared veil's haze is set to summer's own values (`STORM.share 1.3`, `uneven 0.8`) and the shared drift bank is taken off
  (`calms 0.97`). The bank is proportional to the kit's density and stood as a cream slab over the ground and a white
  crescent inside the left limb. `veil.rest -0.0007` takes back the shared rest fog, which fogged the miniature.
- `glass.ts` — the wall layer (far-wall light, haze, storm glow) is drawn in the opaque queue at render order −0.25 with
  the depth test off: after the shell's see-through pass, before the miniature. So the haze lies behind the cottage and the
  tree and never over them. The haze is gold and fullest low behind the miniature and thins toward the top, where a paler
  cooler light takes the sides (`hazeLow`, `hazeTall`, `hazeTop`, `hazeSky`). In the storm the still haze gives way by 0.45
  and the wall's own storm glow is 0.03, so the dome's tone in the storm equals its tone at rest, as in the approved pair.
  The flare has thinner, more and longer rays and a smaller bloom; the hot patch is narrower and longer along the limb. The
  pool of light on the slab arrives 2.0 s after the landing and is whole at 3.1 s.
- `backdrop.ts` — the four dimmest colour levels at 0.4, room and floor bluer and less green, the high right cluster lifted.
- `kinds.ts` — seed row `floats 0.03` (was 0.003 on main), `sizeMm [0.5, 1.0]`; firefly row `sizeMm [0.16, 0.58]`,
  `sizeSkew 2.6`.
- `arrival.ts` — `LOOK.jump`: `ringShare 0`, `edgeDeg [62, 76]`, and the `flies` test in `grainGeometry`: only grains bound
  for the right edge leave the ledge. The jump itself stays.

## What is still wrong, worst first

1. The storm's streaks are peach dabs and the seed heads are few on main's drawing; kinds3's branch (`e73852d`) draws
   short soft trails with heads. Seen together only in a scratch merge.
2. The miniature in the storm is more solid than in the approved mid-shake image (crown box 97,76,45 against 172,145,106
   at share 1.1). The critics asked for solid, the approved image for ghosted; I stopped at share 1.3.
3. The white blade inside the right limb and the oval at the apex: the shared shell (its reflection and its bubble). With
   my card's specular at 0 neither changed.
4. The liquid does not bend or magnify the miniature near the wall: shared shell.
5. The dome at rest is still more even than the approved, whose upper dome has darker see-through areas between
   reflections.
6. The 0.5 s landed still has no pool of light now; the approved mid-shake image has one. The kit's arrival table asks
   for the pool after the lanterns, and /root asked for that order.
7. The pool's arrival was not seen in motion: in the film's landing the camera pushes in and the pool's place is at the
   frame edge by 26.8 s.
8. Seed row `floats 0.03` relies on kinds3's head drawing; on main's older drawing it shows more heads and some low in
   front of the cottage. If that drawing is not on main, 0.016 is the value.
9. Merge commit `75d539c` lacks the trailer (told to /root at 05:54).

## Stand-ins and fallbacks

None. `standIns` of `veil.ts` and `glass.ts` are empty.

## Final state

- Branch `agent/p4-summer_air3`, last commit: see the last line of this file.
- Built: `npm run texpack`, `npm run build` (clean), on the branch merged with `origin/main`.
- Tests, as printed: `npx tsc --noEmit` clean; `npx vitest run`: 32 files passed | 1 skipped, 432 tests passed | 4
  skipped; `npm run determinism`: `determinism: pass · 3 pictures, 4 page loads, preview, draft, 356 s` (on 5780839).
- Measures, draft tier, as printed: M1 and M2 pass on every summer shot (rest, shake, interior, base, surface, settled);
  M3 summer-rest 1.095 (threshold 0.75; base 2.144), measured on e3f8f53; M4 shake-1 0.9447, shake-2 0.9779, shake-3
  0.9167, shake-4 0.9627 (threshold 0.85) and M5 0.9883, 1, 0.9948, 0.9996 (threshold 0.6), measured on 5780839.
  Final-tier M3 was not measured by me.
- Triangles (G15), on the build of my branch: summer 1,660,058 / 916,170 / 438,632 (high / medium / low); my files 6.
- Make targets: none.
- Looks: 17 pictures on the looks branch; about 45 renders looked at in all across my parts (veil-summer,
  glass-dressing-summer, backdrop, the seed and firefly rows, the arrival's grains), under 40 for each part.
- Seen with my own eyes: hero at rest and 0.5 s after the landing at hd draft after every change; the fitted camera beside
  the approved pair for the haze and the storm; one landing sheet (12 frames, before the pool's delay); a scratch merge
  with kinds3 and summer_mini3 at rest and at the landing.
- Not seen: the arrival in motion with the new lantern and pool timing; anything at final tier; the film.

Last commit of `agent/p4-summer_air3` when this was written (08:14 UTC): `d962787` (merge of main c5577c6; last own commit `ddd1944`).
