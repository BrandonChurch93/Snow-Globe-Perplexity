# Report: spring_air (spring's glass dressing, veil, light and storm)
1. Work branch `agent/p4-spring_air`, last commit `1e04ae4` (merge of `origin/main` 192ccf3 into my last own commit `fc90e0c`; pushed 02:36 UTC). Looks branch `agent/p4-spring_air-looks`, tip named in my last message to `/root`.
2. Stand-ins left: none. `standIns` is empty in `glass.ts` and `veil.ts`, nothing drawn carries `userData.standIn`, and `--diag standins` at rest, hero, is black over the whole frame (0 pixels above 0). Fallbacks used: none.
3. Parts: `glass-dressing-spring`, `veil-spring`, `light-spring` and the rows of `petal` and `mote`. Files and constants are in `HANDOVER.md`.
Still wrong, worst first (pictures on this branch):
4. `rest-hero.jpg`: the right limb is a thin cold-white crescent; the approved has a broad pink-white highlight with bloom and a pinkish band on the left. The rim (now [1, 0.66, 0.74] x 0.75) hardly moves it.
5. `landed-hero.jpg`: with main's newest petal drawing the storm is close in kind (small petals on streaks, tree and cottage glow showing through); still wrong: the mist is an even pale pink where the approved has white clumps with dark gaps in the upper half, and the grass at the front rim is not misted over.
6. `rest-hero.jpg`: too few petals in the top third and before the crown, and they read a little larger and whiter than the approved's.
7. `rest-hero.jpg`: dew dusting sparser, trails fewer than the approved's upper right.
8. `rest-macro.jpg`: on the macro camera the near beads read as bubbles, the running drops as large rings.
9. Not seen at a readable size: the beads forming in the arrival; the cameras `low`, `interior`, `surface` in stage 2.
10. Against the brief's words: a thin pink is left in still liquid behind the island (`calm` 0.0045), because the approved rest shows it; `calm: 0` removes it.
Built:
11. Glass: 9,000 dew beads and 420 beads as small lenses (the inside small and upside down, dark edge, key glint), 26 runs that slide on paths that are functions of the time since the landing, leave a short wet trail, swallow beads, hang and run off; bare from the swap to the landing, beads grow in the first seconds of the arrival.
12. Veil: a lit pink petal mist inside the glass, thickest in the swap and where the liquid is stirred and rolls; a dawn mist low on the island that lies on the ground and rises and thins in the arrival. The shared veil is nearly off.
13. Light: early-morning pearl key from front right, pink rim behind right, rose card behind left; discs from rose to pearl.
14. Storm: petals 24,000 and motes 20,000 (counts unchanged, none asked for); about 860 petals stay in the air, about 340 fall from the tree and come again.
15. 45,212 triangles in 4 draw calls, no asset file (0 MiB), none added since the allowance mail. The whole of spring at draft, hero: rest 1,481,269 triangles in 55 draw calls, landed 1,732,853 in 59.
Make targets: 16. none for this part (`assets-src/refrig/spring.json` is data). After merging `main`: `npm run texpack`, `npm run build`.
Tests and checks, as printed:
17. `npx tsc --noEmit`: no output. `npx vitest run` at 1e04ae4: `Tests 432 passed | 4 skipped (436)`.
18. `npm run determinism` on the code of fc90e0c (before the last merge of main): `determinism: pass · 3 pictures, 4 page loads, preview, draft, 335 s`. Again at 1e04ae4 after the merge: `determinism: pass · 3 pictures, 4 page loads, preview, draft, 339 s`.
19. `npm run measure -- --unit change --only M4,M5 --tier draft` (code of fc90e0c): `pass M4 shake-1: 0.9467 (threshold 0.85)`, `pass M5 shake-1: 0.9325 (threshold 0.6)`; shake-2 0.9881 and 0.9999; shake-3 0.9384 and 0.9349; shake-4 0.9631 and 0.9998; `8 of 24 lines, 0 red`.
20. `npm run measure -- --unit spring --only M1,M2,M3,M6 --tier draft` at ac598f7 (one veil commit and one merge of main earlier, not rerun since): `19 of 19 lines, 6 red`. Pass: M1 rest, shake, surface, settled; M3 rest 0.7768 (0.75); M6 all six (shake 0.000235 of 0.002). Red, none in my files: M2 rest 0.0532, shake 0.055, settled 0.0533, surface 0.0347 (0.03; my parts carry no texture); M1 interior (the miniature touches the frame edge); M1 base (3 invalid values, still 3 with my whole dressing hidden; `spring_base` told).
Looks used: 21. light-spring 4; glass, veil and storm share 42 renders in all (22 rest, 13 landed, 1 interior, 1 macro, 1 base, 2 stand-in views, 2 motion sheets); by the part each was made to judge every part is under 40 (the 13 landed judged veil and storm only, the first 5 rest the glass only); counted against all three at once it is 42, two over.
22. Times written wrong: two looks commit messages are one to three minutes off the clock (00:54 for 00:51, 01:44 for 01:43).
