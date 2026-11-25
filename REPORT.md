# summer_base: final report (base-summer, surface-dressing-summer, arrival-summer)

1. Branch `agent/p4-summer_base`, last commit `6a02997` (merge of main; my last own commit `01edebf`). Looks branch `agent/p4-summer_base-looks`.
2. Stand-in or fallback left: none. `standIns` is empty; the `--diag standins` still (hero, rest, hd, draft) was all black at 02:23 UTC. No named fallback was used.
3. Honest standing: all three parts are built for real but none matches the approved pair yet. The base is the weakest and it is the part a viewer judges.

What is still wrong, worst first (pictures on the looks branch; details in `HANDOVER.md`):
4. Stone reads as folded cloth with seam lines, not carved sandstone; relief too soft, foot like a hem (`12`, `14`).
5. Sea glass reads as glazed ceramic: opaque, too saturated, a mark at the middle of each piece (`12`, `14`).
6. Shells pale grey and matte; stone evenly lit and greyer than the approved peach; no sun patch upper right (`12`).
7. Small dark gaps at the upper right silhouette between ledge sand and stone (`12`, `14`).
8. Pour off the ledge is a pale haze, not a bright curtain of grains (`13`, `14`).
9. Dune darker and more speckled than approved, reaches further right; pink weave in its tile from the base camera (`13`, `14`).
10. Landing jump reads only on the right; change to my base is abrupt, about two frames inside the bloom (`11`, `15`).
11. Unseen: the `low` camera; stills of `landed` and `settled`; the landing after the last two commits.

What I built:
12. Base: a 282,656 triangle glb made by script from 34 measured picks (stone wall with beds, 34 shells and sea glass pieces as geometry, ledge sand), four materials, `baseHeightMm` 33, winter's collar, gives way inside the bloom through `partChange`.
13. Surface: sand heaps as a height field on the slab (mesh on a 0.8 mm grid), lit by slope, shadowed by globe and base; front left kept clear for `summer_air`'s pool, which `slab.ts` draws through `glassPart.surfacePool`.
14. Arrival: 30,000 grains in one draw call; 14,000 jump off the ledge on the landing and come to rest, 16,000 pour off the ledge in a loop; all a pure function of the moment.

Make targets, in order: `npm run make -- base-summer` (26 s), `npm run texpack`, `npm run build`. No `slab-summer` folder.

Tests run on the last own commit:
15. `npx tsc --noEmit`: clean. `npx vitest run`: 32 files passed, 1 skipped; 432 tests passed, 4 skipped (run again after the last merge, same result).
16. `npm run determinism`: `determinism: pass · 3 pictures, 4 page loads, preview, draft, 330 s` (run 02:23..02:29 UTC, before the last merge of main; not run again after it).
17. `npm run measure -- --unit summer --only M2,M3 --tier draft`: M2 pass on all six pictures (0 soft pixels); M3 `summer-rest` FAIL 0.6909 against 0.75, where the base scores 2.683 and the miniature 0.691 (the failing part is not mine).
18. `npm run measure -- --unit summer --only M1,M6 --tier draft`: M1 and M6 pass on all six pictures (`measure summer: complete · 19 of 19 lines, 1 red`, the red line is M3 above).

Counts: looks used 15 pictures over the three parts (limit 40 a part). Generated pictures: none, all by script.
Size: my files in `public/assets/summer/` are 5.23 MiB of the 6.5 allowed; season folder 14.1 MiB of 18. Triangles: base 282,656; grains 30,000 quads; I did not measure G15 through the app's path.
