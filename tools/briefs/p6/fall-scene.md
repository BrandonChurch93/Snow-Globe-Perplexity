# Job: fall's miniature to the approved picture (name `fall-scene`, branch `agent/p6-fall-scene`)

Read `COMMON.md` in this folder first. Your limit is 2 hours from your start; `/root` may give you a second list after it.

## Why
Fall closed its rounds in phase 5 at its limit, not at the bar, and the gate's detail line is red: "FAIL M3 fall-rest: 0.5336 (threshold 0.75, detail.minSharpnessRatio) high frequency energy of the still over the approved image at the same size: base 0.700 over 173846 pixels of the part in the ids view; miniature 0.534 over 101144 pixels of the part in the ids view". The miniature holds about half the fine detail of the approved picture. Brandon's rule is that a part below the bar is worked on until it is there.

## What I see (hd, review tier, `references/approved/fall-rest.png` scaled to 1920 beside `npm run still -- --season fall --state rest --camera hero --tier review --format hd --force`; seen, not measured: measure boxes before you change a tone)
1. The cottage's walls. Approved: small dark grey green stones in tight uneven courses, dark joints, each stone with a worn face, the wall dark enough that the green and purple panes glow against it. Build: large light stones with bright even faces and pale joints, which reads as a toy.
2. The roof. Approved: thick, uneven, weathered shingles in staggered rows, dark brown violet, their lower edges catching warm light, a sagging ridge. Build: a flat slope with fine regular rows.
3. The chimney, the door and the panes. Approved: a dark stone chimney with a cap; an arched plank door set deep in a stone arch, dark; panes that throw a soft coloured light on the stone round them. Build: a brighter red brown brick chimney, a light brown door in an arch of light stones, panes that glow and light nothing.
4. The tree. Approved: a thick, twisted, nearly black trunk with deep grooves and a warm rim of light on one side, gnarled limbs that taper to fine twigs, and some 20 to 30 small points of ember light along the limbs. Build: a slimmer trunk and a crown covered by several hundred golden dots of about the same size, so the tree reads as a sparkling cloud and the bark cannot be seen. `src/seasons/fall/mini/tree.ts` holds `EMBER_GAIN`, `EMBER_ON_WOOD` and `embers()`; the air has ember particles of its own (`src/seasons/fall/veil.ts`), which are not yours: tell the two apart before you count (the controls' builder is adding a still without the air, `--no-air`; ask `/root` whether it is on main when you need it).
5. The pumpkins, the lamp and the fence. Approved: carved faces that burn bright and spill warm light on the ground and on the cottage's foot; a black lamp post with a warm lantern and a halo; dark weathered pickets. Build: smaller, flatter faces with little spill; the fence coarser.

What is not a fault: the green of the air and of the fog (it is the approved look), and the place and size of the cottage, the tree and the props. `kit/02-SUBJECT.md` line 20: "The layout never changes. A viewer has to see the same place in four seasons, not four places." Move and resize nothing.

## Files you own
`src/seasons/fall/mini/` (all four files), `src/seasons/fall/miniature.ts`, `assets-src/village-fall`, `assets-src/tree-fall`. Not yours: `src/seasons/fall/veil.ts`, `glass.ts`, `base.ts`, `slab.ts`, `arrival.ts`, anything under `src/miniature/`, `src/core/`, `src/particles/`. If the cause of a fault sits there, send `/root` the exact lines and why.

## How to work
- First, before any change: the pair at hd review, the miniature cut at one to one and at two times, approved left and build right, and a list of your own in the order of what a viewer sees first. Send `/root` that list in five lines if it differs from mine.
- Real detail, not noise: stone, shingle, bark and plank detail that is in the geometry or in maps read with levels, so it holds at 3840 in motion (a tight highlight on a facet smaller than a pixel sparkles; two other seasons are being mended for that right now).
- Counts: `npm run gate -- --phase 6 --only G15` must pass; high stands at 1716868 of 1800000 triangles in the fullest season, so read fall's own count before and after.
- If you change an asset script, say which `npm run make -- <part>` targets changed; `/root` makes the files again.

## Done means
- The pair at hd review, at full size and at 400 px wide: the cottage, the tree and the props read as the approved picture's.
- `npm run measure -- --unit fall --only M3 --force --tier review`: the miniature's number is 0.75 or more (it is 0.534), the base's number is not lower than on `main`; the line word for word in your report.
- Fall at the landing (`--state landed`) and in the shake (`npm run sheet -- --shot shake-3 --tier draft`) still work and show nothing new that is wrong.
- The other three seasons' stills at rest are byte for byte as on `main` (draft tier, hd, by sha256).
- `npm run strict -- --keys fall-rest,fall-shake` passes; `npm run determinism` passes; one still with `--diag standins` is black; `npx tsc --noEmit` and the whole `npx vitest run` pass before every push.

## Report
A first message of five lines after your first look. Then one message to `/root` at the end, at most 30 lines: branch and commit; what you changed part by part; the M3 line before and after, word for word; the pair as one JPEG attached (approved left, before middle, after right, the miniature at one to one); what is still short of the approved picture, plainly; what you did not see; checks run and their last lines.
