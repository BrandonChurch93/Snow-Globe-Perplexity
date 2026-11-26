# Job: fall's base to the approved picture (name `fall-base`, branch `agent/p6-fall-base`)

Read `COMMON.md` in this folder first. Your limit is 2 hours from your start; `/root` may give you a second list after it.

## Why
Fall closed its rounds in phase 5 at its limit, not at the bar, and the gate's detail line is red: "FAIL M3 fall-rest: 0.5336" with base 0.700 and miniature 0.534 (threshold 0.75, `detail.minSharpnessRatio`; the miniature has its own builder). The base is nearer its approved picture than any other season's, so this is a short list, and it is about material more than form.

## What I see (hd, review tier, `references/approved/fall-rest.png` scaled to 1920 beside `npm run still -- --season fall --state rest --camera hero --tier review --format hd --force`, the base cut at two times)
1. The brambles. Approved: near black and neutral, glossy as if wet, with fine bark and few cool highlights; at the left a tangle of finer twigs. Build: lit brown and tan with a scaly pattern that reads as rope or snake skin at the left, and black with a hard grey sheen at the right, with a warm rim on most of them. Measured, the band of the brambles (x 800 to 1150, y 760 to 820): approved mean 18, 18, 18, build 45, 41, 34. The whole base (x 580 to 1340, y 740 to 990): approved 39, 31, 28, build 51, 41, 31.
2. The pumpkins. Approved: orange ribbed skin that is seen, lit from inside, with warm light spilling on the vines beside each. Build: dark balls of which only the face glows.
3. The wax. Approved: cream, thick, a little translucent, in fat runs and pooled blobs from the lip to the table. Build: thin tan strings like hoses.
4. The body under the brambles. Approved: matte black, almost not seen. Build: a grey woven cloth pattern where the body shows at the right.
5. The cobweb at the right. Approved: few fine threads. Build: a dense coarse fan.
6. Under the lip (x 700 to 1250, y 730 to 760) the build is about twice as light and green as the approved picture (91, 114, 72 against 49, 61, 44). Find whose it is before you touch it: if it is the glass's foot or the fog, it is not yours; send `/root` the lines.

What is not a fault: the base's outline, height and place, the number and places of the pumpkins and their faces, the leaves on the table.

## Files you own
`src/seasons/fall/base.ts` and `assets-src/base-fall`. Not yours: `src/seasons/fall/glass.ts` (the fall air builder holds the fog at rest), `veil.ts`, `slab.ts`, `arrival.ts`, `mini/`, anything under `src/core/`. The change of season pours light on every base through one line in `src/core/materials.ts` that the change finisher adds; no base file is touched for it.

## How to work
- First, before any change: the pair at hd review, the base cut at one to one and at two times, approved left and build right, and a list of your own in the order of what a viewer sees first. Send `/root` that list in five lines if it differs from mine.
- Measure boxes of pixel levels before you write a tone, and look at `references/approved/fall-rest.png` and `fall-shake.png` before you call a colour a fault.
- Real detail, not noise: bark, the pumpkins' ribs and the wax's runs are in the geometry or in maps read with levels, so they hold at 3840 in motion. A highlight lobe narrower than a facet, or a normal map standing at 4 or more texels a pixel under a tight lamp lobe, twinkles at 3840 at 60 a second (found today on winter's pond and on spring's beads). The glossy bramble is the risk here: give its highlight a width that holds. Read `assets-src/base-fall/RECIPE.md` before you touch the asset.
- Measure at the review tier, never at draft.
- Counts: `npm run gate -- --phase 6 --only G15` must pass; read fall's own count before and after.
- If you change an asset script, say which `npm run make -- <part>` targets changed; `/root` makes the files again.

## Done means
- The pair at hd review, at full size and at 400 px wide: the base reads as the approved picture's.
- `npm run measure -- --unit fall --only M3 --force --tier review`: the base's number is 0.75 or more (it is 0.700) and stands there by form, not by grain laid over it; the line word for word in your report.
- Fall at the landing (`--state landed`) and in the shake (`npm run sheet -- --shot shake-3 --tier draft`) still work and show nothing new that is wrong; in the storm the base follows `references/approved/fall-shake.png`.
- Four neighbouring frames of fall at rest at 3840 final where the camera drifts (`npm run seq`, see `tools/README.md`), the base cut at one to one: say what the brambles' highlights, the wax and the pumpkins do from frame to frame.
- The other three seasons' stills at rest are byte for byte as on `main` (draft tier, hd, by sha256).
- `npm run strict -- --keys fall-rest,fall-shake` passes; `npm run determinism` passes; one still with `--diag standins` is black; `npx tsc --noEmit` and the whole `npx vitest run` pass before every push.

## Report
A first message of five lines after your first look. Then one message to `/root` at the end, at most 30 lines: branch and commit; what you changed part by part; the M3 line before and after, word for word; the pair as one JPEG attached (approved left, before middle, after right, the base at one to one); what is still short of the approved picture, plainly; what you did not see; checks run and their last lines.
