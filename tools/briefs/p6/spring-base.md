# Job: spring's base to the approved picture (name `spring-base`, branch `agent/p6-spring-base`)

Read `COMMON.md` in this folder first. Your limit is 2 hours from your start; `/root` may give you a second list after it.

## Why
Spring closed its rounds in phase 5 at its limit, not at the bar, and the gate's detail line is red: "FAIL M3 spring-rest: 0.4308 (threshold 0.75, detail.minSharpnessRatio) high frequency energy of the still over the approved image at the same size: base 0.431 over 176612 pixels of the part in the ids view; miniature 0.898 over 111223 pixels of the part in the ids view". The base holds less than half the fine detail of the approved picture; it read 0.394 in Round 14 and an earlier pass measured at the draft tier only, where the number is flattered. Brandon's rule is that a part below the bar is worked on until it is there.

## What I see (hd, review tier, `references/approved/spring-rest.png` scaled to 1920 beside `npm run still -- --season spring --state rest --camera hero --tier review --format hd --force`, the base cut at two times; seen, not measured: measure boxes before you change a tone)
1. The moss. Approved: thick, tufted, fibrous, dark in its hollows, with stray strands over the edge, a ragged lower edge that runs down between the stones, and points of dew. Build: one smooth olive velvet band with an almost straight lower edge, lighter and flatter than the approved, and lace-edged blobs of the same velvet on the stones below.
2. The water. Approved: one thin clear trickle at the left, a few pixels wide, that follows the stone and carries a line of small bright glints. Build: a broad band about four times as wide with painted white streaks, which reads as a waterfall.
3. The stones. Approved: small dark wet cobbles, low in contrast, each with its own soft highlight, half hidden under moss and roots. Build: large smooth blue grey slabs with soft shading and clean outlines.
4. The roots. Approved: many thin dark roots that wind over the stones and branch, with a fine pale ridge of light. Build: few, thick, smooth brown tubes with few branches.
5. The mushrooms and flowers. Approved: small tan caps on thin stems, in twos and threes, and a few tiny white flowers. Build: pale ovals that stand off the moss, most without a stem that can be seen.
6. Overall: the approved base is darker and wetter than the build's, so the lit dome above it is the brightest thing in the picture.

What is not a fault: the base's outline, height and place, and the petals on the table.

## Files you own
`src/seasons/spring/base.ts` and `assets-src/base-spring`. In `base.ts` the dew's lines (244 to 249 on main `708c31cd` and what they read) belong to `/root/spring_drops_mender` until `/root` tells you its mend is on main: leave them, and merge main when you are told. Not yours: `src/seasons/spring/glass.ts`, `slab.ts`, `veil.ts`, `mini/`, anything under `src/core/`. If the cause of a fault sits there, send `/root` the exact lines and why.

## How to work
- First, before any change: the pair at hd review, the base cut at one to one and at two times, approved left and build right, and a list of your own in the order of what a viewer sees first. Send `/root` that list in five lines if it differs from mine.
- Real detail, not noise: moss fibres, stone pores, root bark that are in the geometry or in maps read with levels, so they hold at 3840 in motion. A farm machine found that the dew on this moss draws as rings of dots that change from frame to frame at 3840 (a lobe of `pow(..., 120.0)` on a facet smaller than a pixel); do not add anything of that kind. Read `assets-src/base-spring/RECIPE.md` before you touch the asset.
- Measure at the review tier, never at draft.
- Counts: `npm run gate -- --phase 6 --only G15` must pass; read spring's own count before and after.
- If you change an asset script, say which `npm run make -- <part>` targets changed; `/root` makes the files again.

## Done means
- The pair at hd review, at full size and at 400 px wide: the base reads as the approved picture's.
- `npm run measure -- --unit spring --only M3 --force --tier review`: the base's number is 0.75 or more (it is 0.431), the miniature's number is not lower than on `main` by more than 0.015; the line word for word in your report.
- Spring at the landing (`--state landed`) and in the shake (`npm run sheet -- --shot shake-1 --tier draft`) still work, the water's arrival included, and show nothing new that is wrong.
- The other three seasons' stills at rest are byte for byte as on `main` (draft tier, hd, by sha256).
- `npm run strict -- --keys spring-rest,spring-shake` passes; `npm run determinism` passes; one still with `--diag standins` is black; `npx tsc --noEmit` and the whole `npx vitest run` pass before every push.

## Report
A first message of five lines after your first look. Then one message to `/root` at the end, at most 30 lines: branch and commit; what you changed part by part; the M3 line before and after, word for word; the pair as one JPEG attached (approved left, before middle, after right, the base at one to one); what is still short of the approved picture, plainly; what you did not see; checks run and their last lines.
