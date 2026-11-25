# Report: summer_air (summer: glass dressing, veil, light, storm)

1. Branch `agent/p4-summer_air`, last commit 0b52836 (merge of `origin/main` c35f1e4 over my last change c5f597b). Looks branch `agent/p4-summer_air-looks`.
2. Stand-ins: none left (`standIns = []` in `glass.ts` and `veil.ts`; the stand-ins still is black, largest pixel value 0). Fallbacks: none used.
3. Built assets: none. `npm run make` targets of my parts: none, so no order. Everything is drawn in the shader. 0 MiB, 3 quads, 3 draw calls.

Still wrong, worst first (pictures on the looks branch):
4. Storm at the landing is dimmer than approved (glass centre 179,147,107 approved, 114,94,58 build) and its lower left is a flat pale bank (`02-landed-pair.jpg`). The bank is the shared veil's; the streaks are `kinds_builder`'s.
5. The top of the glass lacks the approved bright warm reflections (`01-rest-globe.jpg`).
6. The discs upper right are dimmer than approved; I own their colours only, not where they stand.
7. Fireflies sit within 45 mm of the ground (shared engine `nest()`); approved has points up to the crown of the glass.
8. Whole seeds at rest are whiter and sharper than the approved tufts (their drawing is `kinds_builder`'s).
9. The pool's veins are fewer and smoother than approved's fine branching ones, and lie on the pale mirror image of the base (`03-pool.jpg`).
10. The pool's swing after the landing is small; the flare's spikes are longer and thinner than approved's.

Built:
11. `glass.ts`: clear glass; a sun flare at the key's mirror point that is out while the globe is held and kindles on the landing (0.22 s, overshoot); a warm glow on the far wall of the glass; a pool of light on the slab (hot knot, short rays, 13 curved folds) that moves with the globe and comes with the landing.
12. `rig.ts`, `backdrop.ts`: low warm key from the right, rim, card, amber and gold discs lifted by level, dark room and floor; `refrig/summer.json`.
13. `veil.ts`: golden haze, density 0.2, with the shared veil's rest share taken back (`rest` -0.0011) so the air at rest is clear: this closes open item 6 of `kit/PROGRESS.md` without changing a count (700, 9000, 40000 stay).
14. `kinds.ts` rows `seed` (floats 0.006, sizeMm [0.69, 1.39]) and `firefly` (sizeMm [0.25, 0.58]); colours of firefly, seed, mote.

Tests run and what they printed:
15. `npx tsc --noEmit`: clean. `npx vitest run`: `Test Files 32 passed | 1 skipped (33)`, `Tests 432 passed | 4 skipped (436)`.
16. `npm run determinism` at e3c0e9f: `determinism: pass · 3 pictures, 4 page loads, preview, draft, 331 s`. After it only the fireflies' size and glow changed.
17. Measures at draft at 2ec5d25: M4 shake-2 0.993 (0.85), M5 shake-2 1 (0.6), M4 shake-3 0.9774, M5 shake-3 0.9029; 0 red of 8 lines. M3 and M6 of unit `summer`: not run.
18. Checked by eye at rest through hero, macro, interior, base, surface, low; landing sheet of shake-2. Not seen: the hold `summer` in motion.
19. Fireflies were last tuned against `kinds_builder`'s newest drawing (`agent/p4-kinds` 93f789c), which was not on `main` yet: on `main` before that merge they are smaller and dimmer.

Looks used: glass dressing about 26, light about 13, veil and storm about 20 (limit 40 a part).
More in `HANDOVER.md`.
