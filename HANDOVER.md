# Strict check, phase 6: handover

Start 04:04:56 UTC on 26 November 2026. Engine `e35b2bd01d0015cf`. Tool branch `agent/p6-strict`, last commit `ec0a8623` (merge of `origin/main` `17e9b252` over `a84b20d8`). Nothing under `src/` was changed. Before the push: `npx tsc --noEmit` clean, `npx vitest run` 49 files passed and 1 skipped, 528 tests passed and 4 skipped.

All pictures are 960x540. "preview, draft" is the tool's own tier. "live high" is the app's own path at the high level. Steps are levels of 255.

## What `tools/strict.mjs` can do now (the one file that was mine)

- `--live LEVEL`: the same keys through the app's own path, on the pattern of `tools/still.mjs`. Pictures and report go to `out/work/strict/live-LEVEL/`. The plain picture is rendered once and kept. Two plain renders of the live path agree to the pixel (`pow+dry`, 0 pixels), so the live rows are not noise.
- `--only fn`, `fn#a-b` (calls a to b, with a list of calls to leave out, as the tool's header describes), `fn~text`, `fn@shader`, as a comma list: only the listed functions or calls are wrapped, the rest stay plain. The calls taken are written next to the picture as `<picture>.calls.json` (`taken` and `sites`). The text after `~` cannot hold a comma.
- `--same`: the wrappers stay, with their test and their choice, and the open case answers what the plain function answers (plus a uniform that is never set, so the compiler cannot fold the choice away). This shows what the wrappers alone move. `dry` cannot show that, because it compiles to the plain function and always gives 0 pixels.
- Folder per mode: the mode tag with every other character as `_`, for example `all_smooth`, `all_smooth_same`, `all_smooth_only_atan_q_y`. Plain pictures are in `none/`.

## Runs, with the last line of each word for word

1. `npm run strict`: `strict: 12 FAILED (engine e35b2bd01d0015cf)`
2. `--keys summer-rest,spring-rest,fall-rest,winter-rest --modes all+smooth+dry,all+smooth+as0,all+smooth+asbig`: `strict: 4 FAILED (engine e35b2bd01d0015cf)`
3. `--keys summer-rest --modes all+smooth --only normalize`: `strict: 1 FAILED (engine e35b2bd01d0015cf)`; `--only atan`: `strict: 1 FAILED (engine e35b2bd01d0015cf)`; `--only sqrt,inversesqrt`: `strict: pass, 1 keys under all+smooth only sqrt,inversesqrt (engine e35b2bd01d0015cf): no pixel moves by more than 1 level, at most 0.01% of pixels move`
4. `--keys spring-rest --modes all+smooth --only normalize`: `strict: pass, 1 keys under all+smooth only normalize (engine e35b2bd01d0015cf): no pixel moves by more than 1 level, at most 0.01% of pixels move`
5. `--keys summer-rest,winter-rest --modes all+smooth --same`: `strict: 2 FAILED (engine e35b2bd01d0015cf)`
6. `--keys summer-rest --modes all+smooth --only atan~lampOut`: `strict: 1 FAILED (engine e35b2bd01d0015cf)`; `--only sqrt,inversesqrt,log,log2,acos,asin,mod,smoothstep,pow`: pass; `--only atan~(back.x`: pass; `--only atan~(q.y`: `strict: 1 FAILED (engine e35b2bd01d0015cf)`; `--only atan~(c.y`: pass
7. `--keys spring-rest,fall-rest --modes all+smooth --only atan`: `strict: 2 FAILED (engine e35b2bd01d0015cf)`; `--only atan~(q.y`: `strict: 2 FAILED (engine e35b2bd01d0015cf)`; `--only atan~(c.y`: `strict: pass, 2 keys under all+smooth only atan~(c.y (engine e35b2bd01d0015cf): no pixel moves by more than 1 level, at most 0.01% of pixels move`
8. `--keys summer-shake --modes all+smooth --only atan`: `strict: 1 FAILED (engine e35b2bd01d0015cf)`; `--keys winter-shake,summer-shake --modes all+smooth --same`: `strict: 2 FAILED (engine e35b2bd01d0015cf)`
9. `--keys winter-shake,summer-shake --modes all+smooth+dry,all+smooth+as0,all+smooth+asbig`: `strict: 4 FAILED (engine e35b2bd01d0015cf)`
10. Live: `--live high --keys winter-rest,spring-rest,summer-rest,fall-rest`: `strict: 7 FAILED through the app's own path at high (engine e35b2bd01d0015cf)`
11. Live: the same with `--modes pow,all+smooth --same`: `strict: 3 FAILED through the app's own path at high (engine e35b2bd01d0015cf)`
12. Live: `--live high --keys winter-rest --modes pow+dry`: `strict: pass, 1 keys through the app's own path at high under pow+dry (engine e35b2bd01d0015cf): no pixel moves by more than 1 level, at most 0.01% of pixels move`
13. Live: `--live high --keys summer-rest --modes all+smooth --only atan~lampOut`: `strict: 1 FAILED through the app's own path at high (engine e35b2bd01d0015cf)` (14 pixels, step 174, box 491,232,535,235: the two caps and nothing else)
14. Live: `--live high --keys spring-rest,summer-rest --modes all+smooth --only atan~(q.y`: `strict: 2 FAILED through the app's own path at high (engine e35b2bd01d0015cf)` (spring-rest 2 pixels, step 2; summer-rest 7 pixels, step 9: the fleck centres, fainter than in preview)

## Rows of run 1 (preview, draft): pixels that differ, largest step

| key | pow | all+smooth | all+smooth+noguard |
|---|---|---|---|
| winter-rest | 8, 1, pass | 848, 2, FAIL | 849, 2, FAIL |
| winter-shake | 4, 1, pass | 542, 1, FAIL | 544, 1, FAIL |
| spring-rest | 0, pass | 18, 13, FAIL | 18, 13, FAIL |
| spring-shake | 0, pass | 2, 1, pass | 2, 1, pass |
| summer-rest | 0, pass | 4412, 99, FAIL | 4429, 99, FAIL |
| summer-shake | 0, pass | 3817, 194, FAIL | 3825, 194, FAIL |
| fall-rest | 0, pass | 21, 20, FAIL | 21, 20, FAIL |
| fall-shake | 0, pass | 0, pass | 0, pass |

The noguard picture against the all+smooth picture, directly: winter-rest 6 pixels of 1 level, winter-shake 4 of 1, summer-rest 104 of at most 3, summer-shake 122 of at most 2, the other four 0. So no guard in these keys holds back a not-a-number that would otherwise reach the picture, and the noguard rows are the all+smooth rows. The dry, as0 and asbig triple was not run again for the noguard rows.

## The triple and `--same` for the rows that failed (preview, draft, all+smooth)

| key | dry | as0 | asbig | same | not-a-number picture against same picture |
|---|---|---|---|---|---|
| winter-rest | 0 | 847, step 2 | 846, step 2 | 847, step 2 | 5 pixels, at most 2 |
| winter-shake | 0 | 546, step 1 | 547, step 1 | 543, step 1 | 7 pixels of 1 level |
| spring-rest | 0 | 0 | 1, step 1 | not run | 18 pixels, step 13 (as0 is the plain picture) |
| summer-rest | 0 | 4358, step 9 | 4361, step 9 | 4344, step 9 | 186 pixels, at most 99 |
| summer-shake | 0 | 3756, step 8 | 3764, step 8 | 3754, step 8 | 200 pixels, 76 above one level, at most 194 |
| fall-rest | 0 | 1, step 1 | 1, step 1 | not run | 21 pixels, step 20 (as0 is the plain picture but one pixel) |

## Live rows (high, the four rest keys)

| key | pow | all+smooth | all+smooth+noguard | pow same | all+smooth same | not-a-number against same |
|---|---|---|---|---|---|---|
| winter-rest | 5, step 3, FAIL | 755, step 4, FAIL | 755, step 4, FAIL | 6, step 3, FAIL | 758, step 4, FAIL | 15 pixels of 1 level (pow: 1 pixel of 1) |
| spring-rest | 0, pass | 5, step 2, FAIL | 5, step 2, FAIL | 0, pass | 2, step 1, pass | 3 pixels, one of 2 levels at 498,222 |
| summer-rest | 0, pass | 3575, step 174, FAIL | 3542, step 174, FAIL | 0, pass | 3528, step 10, FAIL | 247 pixels, 45 above one level, at most 174 |
| fall-rest | 0, pass | 2, step 1, pass | 2, step 1, pass | 0, pass | 2, step 1, pass | 0 |

## Open cases that are met and reach the picture

### A. `src/seasons/summer/mini/tree.ts` line 165: `atan(lampOut.x, lampOut.z)`

In the lantern's emissive block. Where the lantern's normal points straight up or down (the cap), both arguments are 0 and the answer is open. Under not-a-number the caps of two lanterns turn dark: preview near 432,254 and 585,256, step up to 99; live high at 491,235 and 533,233, step up to 174 (the red channel, or all three, fall to 0); summer-shake, the caps and feet of six lanterns, step up to 194 (`--only atan` there: 71 pixels, box 432,241,588,273, all of them on lanterns; no fleck pixel shows in the shake). `--only atan~lampOut` (one call, atan site 99 in summer-rest) gives 20 pixels, step 99, box 431,253,588,257 and nothing else.

Fix: `abs(lampOut.x) + abs(lampOut.z) > 0.0 ? atan(lampOut.x, lampOut.z) : 0.0` in place of the bare call, or add `1e-6` to the second argument as `src/core/chunks/veil.ts` line 350 does. At the cap the ribs meet in a point, so any angle is right there.

### B. `src/particles/draw/cards.ts` line 332: `float ang = atan(q.y, q.x);`

In `cardEdge`, the fleck branch. At the exact centre of a card `q` is 0,0. Under not-a-number that is one dark pixel at the centre of a fleck: 52 pixels across the globe in summer-rest (step up to 45), 18 in spring-rest (step 13, the worst on a petal near 428,142), 20 in fall-rest (step 20, the worst near 550,279). In all three keys `--only atan~(q.y` gives the whole of what `--only atan` gives apart from the lantern caps; as0 and asbig give the plain picture, because at the centre any finite angle falls inside the rim.

Fix: `float ang = dot(q, q) > 0.0 ? atan(q.y, q.x) : 0.0;`

`atan~(q.y` takes two calls, this one and the maple's `atan(c.y, c.x)` of line 508 (its text holds `(q.y` a little further on). In summer-rest `--only atan~(c.y` (the maple calls of lines 308 and 508) gives 0 pixels, so line 332 is the one. For spring-rest and fall-rest: the same, `--only atan~(c.y` gives 0 pixels in both, so line 332 is the one in all three keys.

## Not an open case

### C. The `normalize` wrapper alone

About 4350 pixels (step up to 9) in the summer crown and on the sand, about 847 pixels (step up to 2) in the winter tree, about 545 pixels of one level in winter-shake. `--only normalize` gives them, `--same` gives them, and the not-a-number, as0 and asbig pictures agree with each other there. The wrapper is `dot(v, v) > 0.0 ? normalize(v) : nan`; the taken branch is the built-in, and still the compiled form rounds differently from the bare call. The crown's leaves and the sand grains turn that last digit into up to 9 levels (thresholds on a normal). No value under `src/` is wrong here; the tool's threshold cannot tell this from an open case, which is why `--same` was added. A row should be read as "all+smooth against all+smooth same", not against plain.

### D. `pow` in winter-rest through the live path

5 pixels, step 3 (544,140 goes from 15,16,26 to 18,19,27). `pow same` gives 6 pixels, step 3, and differs from the `pow` picture in one pixel of one level. The wrapper alone, not an open case.

## What the other functions do

`sqrt, inversesqrt, log, log2, acos, asin, mod, smoothstep, pow` wrapped alone in summer-rest: 0 pixels. `atan~(back.x` (cards.ts line 673): 0 pixels.

## What was not run, and what the tool does not cover

- The triple (dry, as0, asbig) for the noguard rows; they were compared to the all+smooth pictures instead (above).
- The triple through the live path; `--same` and `pow+dry` were run there instead.
- `--same` for spring-rest and fall-rest in preview (as0 already equals plain there).
- The live path for the four shake keys (the brief names the rest keys).
- Any tier above preview draft for the tool's own path, and any level but high for the live path.
- Division by zero is not wrapped by the tool. The roughly 1300 wrapped calls were not read one by one; only what the eight judged pictures meet was tested. Nothing was seen in motion.
- No fix was tried, since `src/` is not mine. The fixes above are untested.

## Helper scripts (not committed, in `out/work/sc/` of my clone)

`cmp.mjs a.png b.png [heat.png]` (count, largest step, histogram, heat picture), `top.mjs a b minStep` (the worst pixels with both colours), `crop.mjs` (side by side crops), `queue.sh` (one strict run after another).
