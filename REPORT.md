# Report: `kinds_builder`, the seven particle kinds of spring, summer and fall (Phase 4)

- Branch `agent/p4-kinds`, last commit 93f789c (main 192ccf3 merged in). Looks branch `agent/p4-kinds-looks`.
- Stand-ins or fallbacks left: none. All seven kinds (`petal`, `mote`, `seed`, `firefly`, `leaf`, `ember`, `bat`) are real shapes worked out in the shader; no crossed-card fallback was needed.
## Still wrong, worst first (full list with pictures in `HANDOVER.md`)
0. MERGE ORDER: my ember numbers are tuned to `fall_air`'s ember row at its 8e4829f (glow 1.3, `sizeMm [0.12, 0.7]`, skew 4). On main's row at 192ccf3 (glow 3.2, `[0.2, 1.0]`) the embers at rest are a pale cloud over the tree (`fall-rest-hero-pair.png`, seen 02:50). With 8e4829f's row they are a scatter of orange sparks (seen 02:33). Merge both, or set `CARD.spark.gain` 1 -> 0.4.
1. Fall storm: leaves are soft orange shapes; the approved has long thin bright streaks, red among the orange, and crisp black bats. No thin streak class for leaves yet; bats do not show in the storm.
2. Bats at rest: they face the picture and beat, but read slate and faint, in one clump under the dark cap.
3. Summer storm: whole seed stars larger and flatter than the approved's; fireflies lost in the storm.
4. Summer rest: fewer seeds than the approved, one brightness; no large soft near ones (no kind has a near, out-of-focus class).
5. Spring storm and rest: close in kind; petals a little large and uniform, no fine white streak lines, the notch does not read.
6. Not seen at all: any macro still, the live (instanced quad) path in a browser, any tier above draft. Veins and lobes of the leaf are in the shader but unseen at hero size.
## What was built
- `src/particles/draw/cards.ts` (new) and rows and constants in `looks.ts`; five hooks in `shader.ts`; one uniform in `points.ts`.
- Each kind is a turned card with thickness (seed: 34 hair lines; firefly, ember: added light; bat: facing card with beating wings), lit by the season's light grid, blurred by lens and shutter, lying in a lying pose.
- Classes: whole = the engine's `renew`/`floats` class (same hash as the engine) plus a small chosen share; a storm share that is gone once down; the rest not drawn. The number afloat is set by the air builders' rows.
- `engine.ts`: the slowest stir that lifts anything is now per season (`MIN_LIFT_IN`, capped at `LIFT_FLOOR = 18`). Before, summer's seed row changed winter's rest still (3787 pixels); found by the byte comparison, fixed on `/root`'s word.

- Winter: rest and landed hero stills byte-identical with the stills taken before my first change, after every push and at 93f789c.
## Make targets
Mine: none (no `assets-src/kinds/`). A clone of `main` needs only `npm run texpack && npm run build`; to remake, `trunk` before `tree-<season>`.
## Tests run at 93f789c and what they printed
- `npx tsc --noEmit`: clean.
- `npx vitest run`: `Test Files 32 passed | 1 skipped (33)`, `Tests 432 passed | 4 skipped (436)`.
- `npm run determinism`: `determinism: pass · 3 pictures, 4 page loads, preview, draft, 320 s`.
- Stand-ins view, rest, three seasons: all black (0 pixels lit). `npm run measure` spring: M6 passes on 6 lines; 1 red, M3 `spring-rest` 0.677 under 0.75, which is the base's sharpness. Measures for summer and fall were NOT run (no time).
## Looks used
62 pictures looked at in all, each a pair with the approved crop at hd: spring 24, summer 13, fall 25 (under 40 for every part).
