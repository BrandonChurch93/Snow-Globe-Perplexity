# Report: fall miniature, second set (`fall_mini2`)

Times are UTC, 25 Nov 2026. Took over at 02:43 from `fall_mini`.

- Branch `agent/p4-fall_mini2`, last commit `cdfc304` (merge of `origin/main` of 05:00; my last change is `e680554`), pushed 05:03. Looks branch `agent/p4-fall_mini2-looks`.
- No stand-in and no fallback is left anywhere in the part.
- Looks used: 35 of 40. Pictures 01 to 18 with `captions.txt` on the looks branch.

## What I built

- Tree: ridged trunk sleeve and thick limb sleeves over the shared trunk; black bare crown whose boughs rise to the top of the glass; 36 small lights; shorter twig tips, fewer twigs.
- Cottage: short square chimney without pot, ivy removed, darker mossy wall stones with more fill on the shadow side, greyer roof, lighter door, panes with a hot centre and darker drapes, less colour spill, door pumpkin moved clear of the door.
- Lamp: taller lantern (the shared lamppost stretched), warm glass and a halo.
- Ground: own leaning rail fence (taller, stouter), flagstone path and three door steps that stand above the landed leaves, pond rim stones, pebbles, craggy mossy rock bank on the right, thinner litter (230 leaves), brighter earth under the lamp.
- Pond: dark green, wet line at the shore, mirrors the trunk and the lamp post, warm glints of lamp, pane and pumpkins.
- Triangles: own lighter index lists for medium and low on both models; my files are at high 251,898 / medium 69,115 / low 48,216 against targets 270,062 / 73,533 / 65,509.

## Round 10 issues

- R1 #2 severe (tree): fixed in my files at `d350a6f` and `c08844d`; crown shape and limb twist still differ (shared limbs).
- R1 #3 severe (pond, path, steps, banks, thin litter): fixed at `c08844d`, `ddda8db`, `e680554`; the landed leaf particles over the path are not mine.
- R1 #6 (cottage): chimney, ivy, door, fence done; scale and placement open (shared layout).
- R1 #7 (lamp): fixed at `8afde62`.
- R3-1 #6 (twigs): tips shortened and thinned; junctions not blended; not re-judged.
- R3-1 #8 (windows): hot centre, darker drapes, less spill at `aba79c4`; no deeper recess (shared pane shader).
- R3-2 #2 (pond and ground): fixed with R1 #3.
- M2: 0 soft pixels on all six stills at draft tier on my build; the final tier soft pixels of round 10 look like base and slab pixels (not proven at final tier).
- Jury: "the unreal tree", "flat emissive cottage windows", "simple house textures" worked on as above; "blurry, smeared green ground" from the low camera is the glass fog band under the island, not the ground.

## What is still wrong, worst first

See `HANDOVER.md`, section "What is still wrong".

## Make targets, in order

`npm run make -- village`, `npm run make -- trunk` (shared), `npm run make -- village-fall`, `npm run make -- tree-fall`, then `npm run texpack`, `npm run build`.

## Tests

All at draft tier.

- `npx tsc --noEmit`: clean (05:00). `npx vitest run`: 432 passed, 4 skipped (05:01, after the merge).
- `npm run determinism` on `cdfc304`: `determinism: pass · 3 pictures, 4 page loads, preview, draft, 352 s` (05:09). Also pass on `5caece9` at 04:47 (343 s).
- `npm run measure -- --unit fall --only M2,M3,M6 --tier draft` on `cdfc304` (05:15): `measure fall: not complete · 13 of 19 lines, 1 red · draft · 294 s`. M2 pass on all six stills with 0 soft pixels (rest, shake, interior 0 of 453,132, base 0 of 98,478, surface 0 of 96,643, settled). M6 pass on all six (0 of 102,000 inside a solid). M3 `fall-rest` FAIL 0.3649: base 0.542, miniature 0.365 over 97,551 pixels.
- The same measure on `5caece9` (04:52): M3 0.5719, base 0.860, miniature 0.572. On `e680554` (04:58, M3 only): miniature 0.600, base 0.860. The fall from 0.600 to 0.365 (and base 0.860 to 0.542) came with the 05:00 merge of `main` (fall glass, veil, backdrop, rig, base, slab, particle draw and engine); not traced further, told `/root` at 05:16.
- M3 history of the miniature at draft: 0.540 at 03:21, 0.572 at 04:52, 0.578 with brighter ground, 0.600 with paler flagstones and sharper pond glints.
- `node out/work/bin/tris.mjs fall` on `cdfc304`: high 1,689,849; medium 992,700; low 427,860. All under the limits.
- Zone replica of M3: `/tmp/lk/zm.py` (not in the repo): high pass at sigma 1.5 px, squared, on the two halves of `out/work/measure/m3-fall-rest-draft-crops-1.png`, masked by colour 134, 249, 16 in `out/work/stills/fall-rest-hd-draft-ids.png` at hd x 612 to 1308, y 328 to 720; it gave 0.578 and 0.600 where the measure printed 0.5783 and 0.6001.

## Handover

See `HANDOVER.md` on this branch: files, constants, what did not work.
