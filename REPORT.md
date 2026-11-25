# REPORT: spring air, second set (spring_air2)

Written 05:12 UTC. Branch `agent/p4-spring_air2`, last commit `becf7f0` (pushed 04:54, holds `origin/main` 832eb32). Looks on `agent/p4-spring_air2-looks`. Nothing was pushed to the build branch after 04:54: no source change of mine is left uncommitted. `main` has moved since (194209a at 05:10); it is not merged into the branch, because I had nothing to push with it.

Make targets: none. Nothing in my files is built by `npm run make`.
Stand-ins and fallbacks: none.

## What was changed for each issue, and where

"Seen" means I looked at the hero still at draft hd beside the approved crop after the change. None of it has been judged by a critic since.

| Issue | What changed | Commit | State as I saw it |
| --- | --- | --- | --- |
| R1 #1 severe: air at rest thin, dark at the top | Halo about the lamp, a lit sheet of mist behind the miniature, low haze behind the trunk, more petals afloat in more sizes | 8801263, 5670139, 2641dcf | Lower and middle air close to the approved; the top is still darker (item 2 below) |
| R1 #2 severe: petals blot the cottage after the shake, no streaks | Storm mist stands behind the miniature with lanes, streaks and dashes, thin before the cottage | a92ec0c, 3565b87 | Cottage windows and lamp read, fine streaks go round; lanes too even (item 3) |
| R1 #3 severe: grass shows, lamp lost in an orange wash | Wash round the glass and bank layer cover the grass edge; mist pinker; rig and lamp halo | a92ec0c, 8801263, 1c19715 | Bank is in haze, the lamp is a point with a halo |
| R1 #7, R3-1 #6, R3-2 #1 severe: long trail on the glass | Runs short and straight, 26 slots, shrink toward the limb | a92ec0c | No long drip in the hero still. The hard double rim line of #7 and #9 is the shell's (item 1) |
| R3-1 #11 beads, #12 rim droplets | Dew out of focus is drawn soft; drops shrink to nothing toward the limb | 8801263 | Soft in the hero and the macro check |
| R3-1 #14 fog ball | Still air's haze lies low behind the trunk | 5670139, 2641dcf | Gone as a ball |
| R1 #14, #15, R3-1 #15: lights behind | Warmer, gain 1.7, massed to the right | 8801263, 3565b87 | Colour and mass close; ring and size are the shared draw (item 5) |
| R2: backlight and glow for depth in the petals, air around the lamp | Card light, lamp halo, petal sizes 0.9 to 3.3 mm | 8801263, 2641dcf | Seen at rest; not judged |
| G15 (03:46 mail) | My triangles 45,212 to 26,100, 0.577 of the judged build | 4fdb953 | Counted |
| 03:55 mail: storm gone in one sample | Flood lets go through the set down and the landing by equal ratios, no ramp | 1c19715 | Seen on the range sheet 684 to 762 |

Not mine, and said so at the time: R3-2 #12 to #15 (bases2), R3-2 #2 (kinds2), R1 #4 to #6, #8, #10 to #13 (miniature, base, surface), and the cyan-white dots on the water (they carry the shared `surface` part's id colour; told bases2 and `/root` 04:28).

## What is still wrong, worst first

1. Right limb of the glass is a broad pale band, the left limb has no highlight, there is a ring at the apex. Shared (`src/globe/shell.ts`; the shell reads key and rim only). Tried from my side: rim light 0.75 to 0.5 moved the band 3 of 255, so it was taken back.
2. Upper air at rest is darker than the approved: median at the top 91,81,85 against 141,127,135. The approved has a pale haze on the upper glass (the shell's film) and soft near petals (the petal draw).
3. Landed: the lower half is an even pale pink where the approved keeps darker lanes. Mine; levers `storm.lane`, `storm.near`, `storm.washLight`.
4. Landed: the crown is a pink shape, in the approved a white ghost. Mine; levers `storm.treeSide`, `storm.treeSideMm`.
5. Bokeh discs: hard double ring and size are the shared backdrop's draw. Colours, gain and side weights are done.
6. My meshes are the same at high, medium and low, because a season's parts are not given the quality level. The cut to 0.58 was made at all three.
7. M2 red at rest, shake and settled; M1 red on `spring-base`. Neither is in my files (below).
8. Landing range sheet: the first three frames (684 to 696) are a flat pink disc with no streaks in it.

## Numbers

Triangles, `node out/work/bin/tris.mjs spring` on becf7f0, run 05:09 UTC:

| Level | Drawn | Limit |
| --- | --- | --- |
| high | 1,515,704 | 1,800,000 |
| medium | 885,486 | 1,100,000 |
| low | 402,146 | 600,000 |

My files: 26,100 at each level (dew and beads 18,892, trails 728, dawn mist 2,080, storm mist 4,400), drawn in the view and again in the mirror pass. `/root` measured 1,650,735 / 1,292,336 / 518,516 on the merged tree ad96570; the difference is not in my tip, and I added no mesh after 04:20.

Storm mist thickness per mm on the film (shake-1, landing at frame 720), logged at 1c19715:

| Moment | Thickness |
| --- | --- |
| beat 3.0 (swap closes) | 0.260 |
| beat 3.5 | 0.185 |
| landing | 0.086 (was 0.037) |
| +0.5 s | 0.027 |
| +1.5 s | 0.012 |
| +3 s | 0.0055 |

M4 / M5 at draft, measured after the petal size change (2641dcf), thresholds 0.85 / 0.6: shake-1 0.9449 / 0.9597, shake-2 0.9931 / 0.9999, shake-3 0.9612 / 0.9363, shake-4 0.9936 / 0.9997. Not run again after the merge of main 832eb32.

`npm run measure -- --unit spring --only M1,M2,M3,M6 --tier draft` on becf7f0: `measure spring: complete · 19 of 19 lines, 4 red · draft · 424 s`.

- Pass: M1 rest, shake, interior, surface, settled (0 invalid values); M3 rest 0.8177 (threshold 0.75); M6 all six lines (worst 0.000147, threshold 0.002); M2 interior 0, base 0.006, surface 0.0255.
- Red: M2 rest 0.0499, shake 0.0548, settled 0.0501 (threshold 0.03). These are soft textured pixels of the base and the miniature; my parts carry no texture. It was 0.0531 / 0.055 on the judged build.
- Red: M1 `spring-base`, 6 invalid values. I did not find which part they come from in this run; earlier in the session (03:31 mail) they were not from my groups.

`npm run determinism`: `determinism: pass · 3 pictures, 4 page loads, preview, draft, 345 s`.

Tests on becf7f0 at 05:11 UTC: `npx tsc --noEmit` exit 0; `npx vitest run`: `Test Files 32 passed | 1 skipped (33)`, `Tests 432 passed | 4 skipped (436)`.

## Looks

37 of 40 used. On the looks branch: `rest-hero.jpg`, `landed-hero.jpg` (approved beside ours, becf7f0), `landing-range.jpg` (film 684 to 762, at 1c19715, not rendered again after later commits), `captions.txt`.

## For the successor

`HANDOVER.md` beside this file: what each file holds, how the storm runs in time, what was tried and failed, the levers for items 3 and 4.
