# Strict check, phase 6: handover

Start 04:04:56 UTC on 26 November 2026. Engine `e35b2bd01d0015cf`. Tool branch `agent/p6-strict`, last commit `ec0a8623` (merge of `origin/main` `17e9b252` over `a84b20d8`). Nothing under `src/` was changed. Before the push: `npx tsc --noEmit` clean, `npx vitest run` 49 files passed and 1 skipped, 528 tests passed and 4 skipped.

All pictures are 960x540. "preview, draft" is the tool's own tier. "live high" is the app's own path at the high level. Steps are levels of 255.

At 05:38 UTC `origin/main` stood at `3fb0bede`, with changes under `src/` since `17e9b252` (audio, copy, core/materials, post, scene, two season bases, winter arrival, shake/change, ui). Every run below is of engine `e35b2bd01d0015cf`, that is `17e9b252`; none was repeated on the newer main. `src/seasons/summer/mini/tree.ts`, `src/particles/draw/cards.ts` and `src/core/chunks/veil.ts` are the same in both, so the files and lines named below hold on `3fb0bede`. `tools/strict.mjs` is untouched on main since, so the branch merges without conflict. tsc and vitest were run again on the branch at 05:37 UTC with the same result.

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

## Second job (05:41 to 06:41 UTC): the reading of the gate

The report sent to the lead, as sent:

> strict_checker, second report. Tool pushed: `agent/p6-strict` at `2f0ead55` (change `e61b2b0c`, then merge of main `bad03291`); tsc clean, vitest 562 passed, 7 skipped. Only `tools/strict.mjs` changed. A later local merge of main `197e2476` is not pushed (no tool change in it).
>
> 1. The reading. By default every wrapped row is read against its own `--same` picture, preview and `--live` alike. `--against plain` gives the old reading. `--same` runs are always read against plain. Limits and exit codes unchanged. The last line names the reading: `..., each row read against its own --same picture (engine ...)` or `..., each row read against the plain picture (engine ...)`. Under the new reading no plain picture is rendered; each row costs two renders (six a key by default, where the old cost four). Pictures made for an engine are kept and shared between runs.
>
> The pow rows: I chose the same reading for them, not plain. Reason: through the live path the pow row of winter-rest fails against plain by the wrapper alone (5 pixels, step 3; `pow same` gives the same pixels), so against plain "every row passes" could not hold. Not proven on today's engine, see "not run".
>
> The noguard rows: in their `--same` picture isnan and isinf answer false as in the mode itself. So the row says whether an open case reaches the picture with the guards gone; it no longer says whether a guard holds back a number from a source the wrappers do not watch (a division by zero). `--against plain` still does. Your call whether that is the reading you want.
>
> 2. Before the mends, main `d35fd0cf`, preview, `--keys summer-rest,spring-rest,fall-rest,winter-rest,winter-shake --modes all+smooth`: `strict: 3 FAILED, each row read against its own --same picture (engine f4d953e4984e5ec6)`. Rows: summer-rest 212 pixels, step 99, FAIL; spring-rest 19, step 13, FAIL; fall-rest 20, step 20, FAIL; winter-rest 5, step 1, pass; winter-shake 9, step 1, pass.
>
> After the mends: main took summer_finisher's mends (`18d14700`, the same two lines as I proposed) while my scratch copy was on its first key, so I dropped the scratch copy and ran on main itself, `197e2476`, engine `d3c64f0b7e6b5c04`.
>
> Preview, all eight keys, `--modes all+smooth`: `strict: 1 FAILED, each row read against its own --same picture (engine d3c64f0b7e6b5c04)`. Rows: summer-rest 0 pass; summer-shake 0 pass; spring-rest 0 pass; fall-rest 1 pixel, step 1, pass; winter-rest 7 pixels, step 2, FAIL; winter-shake 6, step 1, pass; spring-shake 1, step 1, pass; fall-shake 0 pass.
>
> Live, all eight keys, `--live high --modes all+smooth`: `strict: 1 FAILED through the app's own path at high, each row read against its own --same picture (engine d3c64f0b7e6b5c04)`. Rows: winter-rest 21 pixels, step 2, FAIL; winter-shake 20, step 1, pass; spring-rest 0; spring-shake 1, step 1; summer-rest 0; summer-shake 0; fall-rest 0; fall-shake 0, all pass.
>
> So cases A and B are gone from the picture on main, in both paths.
>
> 3. The row that still fails: winter-rest. Preview: one pixel of 2 levels (533,148: 23,30,26 against 25,31,27) and six of 1 level. Live: two pixels of 2 levels (489,223 and 465,236) and nineteen of 1, scattered over the tree. It is not an open case. I rendered the same two programs again, nothing changed: the second not-a-number picture differs from the first in 7 pixels, 533,148 by 3 levels (25,31,27 then 22,30,26); the second `--same` picture differs from the first in 5 pixels of 1 level; and the row then passes: `strict: pass, 1 keys under all+smooth, each row read against its own --same picture (engine d3c64f0b7e6b5c04): no pixel moves by more than 1 level, at most 0.01% of pixels move` (4 pixels, step 1). With the open case answering 1e30 the row passes too (7 pixels, step 1; 533,148 stays 22,30,26), which no met open case would allow. So a wrapped winter still wobbles from render to render by a handful of pixels, one of them by up to 3 levels, and the gate at 1 level fails or passes on winter-rest by chance (it failed in the main runs, preview and live, and passed on the rerender). There is no line under `src/` to give you for this. A hint only: the plain winter picture has always come out the same to the pixel (every `dry` row was 0 on the engine of my first report), so the wobble shows only when the shaders are slower to compile, which points at something in the winter draw that depends on time or on when a program is ready, near the top of the tree (533,148; live 489,223 and 465,236). Not narrowed further.
>
> What would make the gate exact, if you want it: one compiled program for both pictures, the wrapper answering not-a-number or the plain answer by a uniform, so that only a met open case can differ. Not built; it does not cure the wobble, which is in the picture itself.
>
> Not run (the limit; a render takes 62 to 75 s on today's engine, the default run is now 48 renders, about 55 minutes, and live 48 more, about 40 minutes): every pow row and every noguard row under the new reading, in either path; so there is no last line of a plain `npm run strict` to give you, and I have not seen it pass. The narrowing of winter-rest. Item 4: `mesa-vulkan-drivers` installed (Mesa 26.0.8) but no run was made under lavapipe; note that the tool's kept pictures are keyed by engine and not by renderer, so a lavapipe run needs `--fresh` or its own folder.
>

Logs of the runs are in `out/work/p2/` of my clone (before.log, main1.log, mainlive1.log, mainw.log, mainw2.log, mainw3.log), not committed. The scratch copy with the two mends (`sg-mend`, engine `02f8b037dbd40cf5`) was stopped on its first key and gives no row.

## Job 3 (06:38 to 07:46 UTC), lavapipe

Tool pushed: agent/p6-strict 87dabc7e. Local only and untested, not pushed: 292b6f9b (a row over the limit against the
plain picture is read against the plain picture twice before it goes to its own --same picture) and its merge 5af71bfb.

What was seen, engine 00d85924a764cc69 unless said, all drawn by lavapipe (Mesa 26.0.8, 4 cores):
- Engine 365e27f8ae66164f: winter-rest all+smooth and its --same picture rendered fresh three times are the same bytes
  each time. No wobble in preview under lavapipe.
- Engine 365e27f8ae66164f: winter-rest all+smooth against its --same picture, 1094 pixels, largest step 13, the same on
  three renders. Narrowed: only sqrt,inversesqrt,normalize 1094; only normalize 1094; only log,log2,pow 0; only
  normalize~abs(det) 0; only normalize~vTreeN 102 against same and 0 against plain. The picture of all+smooth with
  every function strict is the same bytes as with only normalize~vTreeN strict, so it is the plain picture. The --same
  picture is the one that moves. Not explained. assets-full/winter/tree-crown.glb holds no normal of no length.
- npm run strict: pass, all 32 rows 0 pixels, 15 min 19 s.
- npm run strict -- --live high: 2 FAILED, both winter-shake (all+smooth and all+smooth+noguard, each 2 pixels from the
  plain picture, largest step 2; their guards row 0 pixels; pow 0). Not narrowed. Next step: --live high --keys
  winter-shake --modes all+smooth --against plain --only with the groups sqrt,inversesqrt,normalize then
  log,log2 then atan,acos,asin,mod then smoothstep (one render each, the plain picture is kept).
- Not run: main 9691393f (six files under src changed, the opening film; a new engine). No known met case was drawn
  under lavapipe to show the check can fail there.

To find out about sm_same: in SAME_INIT set the uniform to 0 after each link and see whether the --same picture of
winter-rest all+smooth becomes the plain picture.
