# Job: fall's air to the approved picture (name `fall-air`, branch `agent/p6-fall-air`)

Read `COMMON.md` in this folder first. Your limit is 2 hours from your start; `/root` may give you a second list after it.

## Why
Fall closed its rounds in phase 5 at its limit, not at the bar. Brandon's rule is that a part below the bar is worked on until it is there. At rest the air of fall hides the scene: the tree stands behind a cloud of soft golden dots. The miniature's builder (`/root/fall_scene_builder`, branch `agent/p6-fall-scene`) counted them: the tree itself holds 26 embers, the several hundred dots over it are the air's ember particles. The air is yours, the miniature is not.

## What I see (hd, `references/approved/fall-rest.png` scaled to 1920 beside `npm run still -- --season fall --state rest --camera hero --tier review --format hd --force`)
1. The sparks. Approved: fine sharp points of 1 to 3 pixels, orange, most of them dim, thick in the upper left and thin over the tree and the cottage, so the black tree reads whole against the air; beside them a few dozen large soft discs that stand near the glass, out of focus and dim. Build: soft round glowing dots of 6 to 14 pixels, golden, about the same size, spread evenly through the whole room and in front of the tree and the cottage.
2. The leaves. Approved: many small leaves with a read shape (lobed, some edge on, some curled), dark orange to red brown, a few of them bright where the light meets them, a few large and blurred near the glass. Build: fewer, larger, lighter, more yellow, most of them face on.
3. The air's tone. Approved: neutral to green grey and dark, with the green glow of the fog low behind the cottage and the tree. Build: tinted warm by the glow of the dots, and dark where the fog should glow between the cottage and the tree.
4. The bats. Approved: three, crisp and black, upper left. Build: there, softer. Look, and leave them if they hold.

Measured on main `cd64e5b8` (draft tier still; read it again at review before you change anything). Inside the glass (a circle about x 960, y 430 with radius 370, above y 620), pixels with red more than 40 over blue:
- luma 70 to 110: 9.9% of the glass in the approved, 14.3% in the build; luma 110 to 150: 4.9% against 6.3%; luma 150 to 200: 1.8% against 2.3%.
- median of a box, approved then build: between the cottage and the tree (x 900 to 1000, y 330 to 400) 69, 71, 60 against 32, 33, 29; right of the tree (x 1180 to 1280, y 300 to 420) 51, 49, 47 against 77, 60, 42; upper left (x 700 to 860, y 150 to 300) 56, 54, 43 against 64, 48, 37.

What is not a fault: the green of the storm and of its fog (`references/approved/fall-shake.png` is the approved look of the storm; do not change `bankWhite` for fall), and the place and size of anything in the miniature.

## Files you own
`src/seasons/fall/veil.ts`; in `src/particles/engine/kinds.ts` the lines of `leaf`, `ember` and `bat`; in `src/particles/draw/looks.ts` the lines of `leaf`, `ember`, `bat` and the numbers named `spark...`, `leaf...` and `bat...`; in `src/particles/draw/cards.ts` the shapes `spark`, `leaf` and `bat`; in `config/showcase.json` only the four counts under `particles` for `fall`. The kind `mote` is shared with summer: change fall's motes only through `src/seasons/fall/veil.ts`. `/root/summer_air_p6` works in the same three particle files on summer's kinds (`seed`, `firefly`, `mote`): touch none of its lines, and merge `origin/main` often. Not yours: `src/seasons/fall/glass.ts` (the fog), `src/seasons/fall/mini/`, `src/core/`, `src/scene/`, the lens. If the cause of a fault sits there (the lens turning every spark into a disc, the fog's glow), send `/root` the exact lines and why.

## How to work
- First, before any change: the pair at hd review, at full size and at 400 px wide, and the cause of the dots' size (the card's size, the spark's falloff, the glow, the lens). Send `/root` five lines after that first look.
- The storm is the same particles. Whatever you change at rest, look at the landing (`--state landed`), at the shake (`npm run sheet -- --shot shake-3 --tier draft` and `--shot shake-4`) and at the settling after it, beside `references/approved/fall-shake.png`. The cover of the change of season rests on the storm: `npm run measure -- --unit change --only M4,M5 --tier draft --force` must keep all eight lines green.
- A spark of one pixel sparkles in motion at 3840 if it is drawn anew each frame. Read `npm run seq` over 12 frames at rest at 60 a second (`--first 2300 --last 2311 --tier review`) and say what the sparks do from frame to frame.
- `--no-air` on a still is being added by `/root/controls_finisher`; ask `/root` whether it is on main when you need the scene without the air.

## Done means
- The pair at hd review, at full size and at 400 px wide: the tree reads as a black tree against the air, the sparks read as fine points with a few soft discs near the glass, the leaves read as leaves.
- The three shares above within a fifth of the approved's, and the three boxes within 12 levels a channel, read at review tier; the numbers in your report.
- `npm run measure -- --unit fall --only M3 --force --tier review` before and after, word for word (the miniature stands at 0.534 and is being mended by its own builder; your change must not lower either number).
- All eight M4 and M5 lines green at draft; the landing and the shake show nothing new that is wrong.
- The other three seasons' stills at rest and landed byte for byte as on `main` (draft tier, hd, by sha256).
- `npm run strict -- --keys fall-rest,fall-shake` passes; `npm run determinism` passes; one still with `--diag standins` is black; `npx tsc --noEmit` and the whole `npx vitest run` pass before every push.

## Report
A first message of five lines after your first look. Then one message to `/root` at the end, at most 30 lines: branch and commit; what you changed; the shares and boxes before and after; the M3 and the eight M4 and M5 lines word for word; the pair as one JPEG attached (approved left, before middle, after right); what is still short of the approved picture, plainly; what you did not see; checks run and their last lines.
