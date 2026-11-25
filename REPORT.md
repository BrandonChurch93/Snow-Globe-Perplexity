# REPORT: fall base and slab (fall_base3), 05:47 to 08:47 UTC

Branch `agent/p4-fall_base3`, last commit **e59fc18** (merge of `origin/main` at 08:19 UTC). Looks branch `agent/p4-fall_base3-looks`.
Files: `assets-src/base-fall/**`, `assets-src/slab-fall/**`, `src/seasons/fall/base.ts`, `src/seasons/fall/slab.ts`, and my own test `tests/fall-candles.test.ts`. Nothing else touched.

## Stand-ins and fallbacks
None. Everything that ships is made by the scripts; no picture was generated or fetched; no pixel of an approved image is in any file.

## Fixed (commit; make targets)
From the takeover list (HANDOVER of fall_base2):
- Branches level like a bundle, brown at left: vines rebuilt as thin tapering lengths that cross (538fbef, ea35779; base-fall, texpack, build); foot and crown vines cross at angles (9217d16; base-fall, texpack, build).
- Wax blobs, crown thorn a flat blade: ea35779, c0ff90e (base-fall, texpack, build); foot runs lie over a vine to a puddle (4e48a6b); collar wax as a rim with thin runs, no ball (b48bb76); thinner, warmer at the tips, long run alone (d4f93a7).
- Side pumpkins small and lined up: set among the vines (c0ff90e; base-fall, texpack, build).
- No lit grey leather at right: fewer vines there (9244dee), key sheen (103fa65), grain (b19b50b; build).
- Slab reflections as blobs, too many small leaves: streaks under the faces, 96 larger leaves (ea35779, c0ff90e; slab-fall, texpack, build).
From Round 13 (judged build e39ec6c):
- R4 set-B-01 MAJOR, face lights, drops, relights: 54ac639 (build). `faceLevel` eases to an ember it never falls under, then to the whole light; `tests/fall-candles.test.ts` holds it.
- R1 #7, #8 MAJOR, stacked level twigs, oversized drips, pumpkins lined up: 538fbef to 9217d16, d4f93a7 (base-fall, texpack, build). In part: "taller" not done (see below).
- R3-2 #3 MAJOR, cobweb a flat fan of lines: 3914cbf (base-fall, texpack, build).
- R3-2 #4 MAJOR, leaves one template and colour, hovering: in part, 6890bed, ddb51a2 (slab-fall, texpack, build): colour, age and edges vary; no contact line.
- R3-2 #7 MINOR, drips plastic: d4f93a7 (base-fall, texpack, build).
- R3-2 #8 MINOR, core an even stipple: d4f93a7, b19b50b (build).
- R3-2 #9 MINOR, pale splats right of the base: ddb51a2 (build): they were cupped leaves washed white by the key's glint.
- Jury, identical glow in the three faces: 9217d16 (build): own share of light and own hot place per face.
- M3 fall-rest, base: 0.407 (frozen) to **0.752 at FINAL** on e59fc18 (0.641, 0.710, 0.749 on the way); threshold 0.75.

## Still wrong, worst first
1. Vines fatter and smoother than the approved thorn tangle; facets at silhouettes (jury) not rounded.
2. Leaves: no contact line or reflection seam; curled and dry, larger and brighter than the approved wet ones.
3. Faces light the vines round them less than approved.
4. M3's margin on the base is 0.002 at final; the line stays red on the miniature (0.277, not mine).
5. Cobweb threads straighter and more even than the approved wisps.
6. "Taller" (R1 #7, #8): not done; the ring's height is the approved pair's, its size in frame is the camera's.
7. R1 #9 (muddy mirror, pale rocky patch at the front): not found in my files; the mirror is the shared surface.
8. Mirror streaks stand apart from the foot in the surface camera; seat of the glass is a wax rim, not a channel.

## What I did not do because the approved pair asks otherwise
- The cobweb has no spiral capture thread (R3-2 #3 asked for one): the approved image shows a draped veil of long threads from the crown thorns to the slab, not an orb web.
- The one long wax run right of centre stays (R1 asked for shorter drips): it is in the approved image at that place and length.

## Triangles
My files: 82,396 (base 78,004: iron 53,678, pumpkin 13,458, wax 9,950, web 918; slab 4,392). At takeover 89,572. Never added at any level.
Season drawn (high / medium / low): 1,587,581 / 918,771 / 408,738 at d553105, no mesh changed since (frozen build 1,606,733 / 937,690 / 417,788; limits 1,800,000 / 1,100,000 / 600,000).

## Tests and measures at the head
- `npx tsc --noEmit` clean; `npx vitest run` 436 passed, 4 skipped (on the merged tree, 08:19).
- `npm run determinism`: `determinism: pass` (3 pictures, 4 page loads, 348 s; 08:32).
- `npm run measure -- --unit fall --only M1,M2,M3,M6 --tier draft` (08:33 on): 19 lines, 17 pass, 2 red (run ended 08:40). Pass: M1, M2, M6 of fall-rest, fall-shake (4 of 102,000 particles inside a solid, 0.000039 against 0.002), fall-base, fall-surface, fall-settled; M2, M6 of fall-interior. FAIL M3 fall-rest 0.329 on the miniature (base 1.182 at draft, which is noise); FAIL M1 fall-interior: the miniature touches the edge of the frame (not my part).
- M3 fall-rest at FINAL (08:19 to 08:26): base 0.752, miniature 0.277.

## Looks
base-fall 37 of 40, slab-fall 7 of 40, all `--tier draft --format hd` beside the approved crop.

## Seen and not seen
Seen with my own eyes: rest/hero/draft hd beside the approved crop after every change (base looks 23 to 37); film B frames 35.97 to 36.17 s at 54ac639; landed hero at 54ac639; surface camera at c0ff90e.
Not seen: see HANDOVER.md, "What I could not see".
