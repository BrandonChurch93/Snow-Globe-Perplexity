# Handover: fall_air (fall's glass dressing, veil, light and storm behaviour)

Written for an agent who has never seen this work. Branch `agent/p4-fall_air`, looks branch `agent/p4-fall_air-looks` (this one). Tips are in `REPORT.md`.

## Parts and files

Parts in the register: `glass-dressing-fall`, `light-fall`, `veil-fall`, and the behaviour and colours of the kinds `leaf`, `ember`, `bat` (the drawing of the kinds is `kinds_builder`'s; the row of `mote` is `spring_air`'s).

- `src/seasons/fall/glass.ts`: the crack and the fog. Exports `standIns` (empty), `glassDressing`, `look` (all constants), `dressing()`, `prepare()`, `crackSpread(seconds)`, `fogLift(seconds)`, `update(moment)`.
- `src/seasons/fall/veil.ts`: `standIns` (empty), the shared veil's tint and density, the kinds' colours and glow.
- `src/seasons/fall/rig.ts`: the lights. `src/seasons/fall/backdrop.ts`: the discs, the room and the floor.
- `assets-src/refrig/fall.json`: `{ "distanceMm": 604.0, "aimHeightMm": 65.2 }`, from the measured glass circle of `fall-rest.png` (centre (1417.1, 662.2), radius 564.3 px of 2816 x 1584).
- `src/particles/engine/kinds.ts`: only the rows `leaf`, `ember`, `bat`.
- `assets-src/dressing-fall/**`: empty. No picture was generated and no file of mine ships (so no `ASSETS.md` rows, no `RECIPE.md`).

## Make targets

None of this part. Since main f11761e the built assets of all seasons are tracked in main, so after `git checkout -- assets-full public/assets` and a merge of `origin/main`, `npm run build` is enough for stills. If a still says "file is not prepared", the season's others in order are: `village`, `trunk`, `village-fall`, `tree-fall`, `base-fall`, `slab-fall`, then `npm run texpack`, `npm run build`. If untracked files under `assets-full/` or `public/assets/` block a merge, move them aside (they are made files) and merge.

## How it is built

The crack: about 90 short pieces on a sphere just outside the shell, traced from the approved rest image (hub at px (1154, 366), six arms; `HUB`, `ARMS` in `glass.ts`). A thin shadow core with a bright edge that takes the key, the rim and the room. `crackSpread(seconds)` says how far from the hub it has cracked (three starts, full at about 0.95 s after the landing); a place is cracked or not, nothing fades in.

The fog: one density (the GLSL in `FOG_HEAD` and the `VOL` shader) sliced by 46 sheets inside the glass plus a lip shell under the ground's edge. Opaque list, render order 5.4 (lip) and 5.5 (sheets), after the particles (5) and before the shell stamp (6); blend One / OneMinusSrcAlpha; no depth write. Uniforms: `uFog` = (clock 0..1 over the period, lift, pour, mm fallen), `uFogTurn` = (turn angle of the strands, flood).
- At rest (`lift` 0) it lies as a skin on the mound and a pool against the wall (`ringFromMm 46` to `ringToMm 56`), stands taller and thin behind the scene (`back 0.3`, `backTall 2.4`), stays low in front (`front 0.3`), and fades to nothing at the ground (`open`), which removed the stripes where sheets met the slope.
- Stirred (`lift` 1, from `frame.turbulence` or from the landing) it is thrown to the wall and behind (`lifted 0.03`, `liftedMiddle 0.1`, `liftedFromMm 20`, `liftedToMm 50`, `liftedFront 0.22`) and drawn into strands that go round the axis (`swirl 3.4`, `swirlThin 0.1`, `spinRadS 2.2`, `spinDownSeconds 2.6`).
- At the hardest of the shake it fills the dome (`flood 0.1`, between `floodFrom 0.64` and `floodTo 0.99` of the turbulence, squared; M4 on this state is in `REPORT.md`): this is what hides the miniature at the swap (M4).
- After the landing it pours down near the wall (`pour 0.016`, `pourFallMm 36`) and pools over about 6.5 s (`fogLift`).
- In the `cover` diagnostic view the fog writes how much it hides (`vec4(a, 0, a, a)`, blend source DstAlpha, set in `update`); in other diagnostic views it is drawn only where its alpha is over 0.35.

The veil: the shared veil chunk (`src/core/chunks/veil.ts`, read only) whitens its bank on purpose, which was a milky wash over the ground at the landing, so fall keeps it thin: `veil = { tint [0.62, 0.95, 0.45], density 0.006, rest 0 }`. The storm's fog is the volume above.

The kinds (colours in `veil.ts`, rows in `kinds.ts`): leaf colour [0.85, 0.27, 0.035], `sizeMm [1.2, 4.2]`, `sizeSkew 2.2`, `renew 0.09`, `dwellSeconds [4, 16]`, `renewMmS [4, 8]`, `sinkMmS [16, 26]`, `settleMmS [35, 65]`; ember colour [1, 0.36, 0.06], glow 1.3, `mode 'cycle'`, `sinkMmS [-5.5, -2.2]`, `lifeSeconds [4, 8]`, `sizeMm [0.12, 0.7]`, `sizeSkew 4`; mote colour [0.26, 0.19, 0.12] (ash); bat colour [0.02, 0.02, 0.03], `turnRadS [40, 55]`, `cruiseMmS 26`, `reachMm 32`, `clearanceMm 7`, `orbit true` (home on the axis at 0.6 of the radius up, rings of 0.55 to 1 of `reachMm`).

The light (`rig.ts`): key {[0.82, 0.9, 1], 0.75, from [450, 455, 80]}, rim {[1, 0.55, 0.22], 0.35, from [-240, 230, -380]}, sky [0.085, 0.105, 0.085], ground [0.035, 0.04, 0.035], fill 0.6, card {[0.55, 0.85, 0.7], 0.6, from [-460, 190, -40], wrap 0.1, specular 0.6, inside 0.2}. `fall_base` and `fall_mini` tuned against these: move the rig only with a line to both. Backdrop: orange and amber discs with dark teal ones, room [0.0026, 0.0036, 0.0046], floor [0.0065, 0.0048, 0.0063].

## What is still wrong, worst first

1. The storm against `fall-shake.png` (`veil-02-s9-landed-pair.jpg`): the leaves are flat flakes bunched in the upper middle of the dome; the approved has thin orange streaks through the whole dome. Their drawing is `kinds_builder`'s (it said its next work is exactly this); mine are size, count and colour.
2. The same picture: the pool at the bottom is dimmer than the approved's bright mint and the fog over the ground hides the litter; the strands are faint. Try `lipLifted` up and `swirl` up, `liftedFront` down.
3. At rest (`glass-04-g20-rest-pair.jpg`, my 8e4829f): the bats are dark blue zigzag smears under the cap, not black silhouettes. `kinds_builder` redrew the bat card after that picture (`agent/p4-kinds` 72546dc and 93f789c; it says they still read slate and faint); I did not see its new card. Mine: `reachMm 32` spread them from one clump to a wider ring. The approved has three; the count 7 is `/root`'s (`config/showcase.json`).
3b. At rest in the macro camera (`glass-05-rest-macro.jpg`, my 8e4829f): pale grey soft puffs before the cottage door, by the lamp and in the crown; `fall_mini` reported the same. They are embers (born near a light) drawn pale and soft up close; the colour and glow are mine (`veil.ts`, [1, 0.36, 0.06], 1.3), the drawing is `kinds_builder`'s (its 93f789c changed the embers again: gain 1, size factor 1.3, tuned to my row; not seen by me). If they stay pale, lower the ember's `sizeMm` top or ask `/root` for a lower ember count (6000; 3000 is inside the allowed half).
4. At rest: leaves afloat keep to the middle band and embers to the tree; the approved spreads both through the dome (about 150 leaves, about 300 ember dots, some large and soft). The lip of fog under the rim is flatter and dimmer than the approved's billows (`lip`, `lipGlow`). The inside of the glass's top is a little dark and teal (box `glass-top` render (37, 46, 47), approved (52, 54, 45)).
5. The arrival was looked at only as one small sheet of the first 0.9 s after the landing (`out/work/sheets/motion-landing-shake-3-preview-draft-x3-1.jpg`, not pushed): the flood thins in about 0.2 s, which is quick; the crack's spread and the pour were not judged in motion, and the cameras `low`, `surface`, `macro`, `interior` were not checked for banding of the 46 sheets.
6. M3 `fall-rest` at draft is 0.592 against 0.75 (base 0.606, miniature 0.592; the miniature was 0.185 when the fog covered the ground and 0.336 before the fog left the ground); `fall_mini` read the fog and the sparks as the cause of the low numbers. The approved has fog in front of the ground too, so the rest is a matter of the miniature and the fog together.

## What was tried and did not work

- Fog as a few sheets (1 x 1 grid): broke the refraction at the glass; kept 18 x 14 grids.
- Fog everywhere in the dome when stirred (`mix(wall, 1, lift)`): a milky whiteout over the miniature at the landing.
- `pour 0.05`: the same whiteout; now 0.016 and near the wall.
- Shared veil density 0.035 and more: its bank is white by design (it divides the tint out), a milky band over the ground. Density 0.006 now.
- Ember rise faster or life longer: embers start outside the dome on the first frame and `tests/sim.test.ts` "starts the whole pool inside the glass" fails. Keep rise times life small.
- Leaves `sizeMm [2.6, 4.4]`: 16000 of them hid the miniature at the landing.
- Ember glow 3.2 with `sizeMm [0.2, 1.0]`, `sizeSkew 3`: fine against the old drawing, but `kinds_builder` raised the drawing's gain in the same half hour and the two together were a pale cloud over the tree (pushed for about ten minutes in 6b3aa62, taken back in 8e4829f). Agree with `kinds_builder` on who turns the ember's brightness before touching it: it now tunes to glow 1.3, `sizeMm [0.12, 0.7]`, `sizeSkew 4`.

## Size and triangles

No file under `public/assets/fall/` is from these parts. Fog sheets about 23,000 triangles (46 sheets of 18 x 14 quads), lip sphere 64 x 12, crack sphere 96 x 64 (about 12,000); 3 draw calls. Nothing was added after `/root`'s line of 00:57.

## Tools I used

`npm run fit -- --season fall --tier draft --format hd --name <n> --force [--state landed]` (about 1.3 min; writes `out/work/fit/<n>-pair.jpg` and `out/work/stills/fall-<state>-hero-hd-draft-rig.png`; the glass crop is (545, 40, 1390, 1023) of the hd still), `npm run measure -- --unit change --only M4,M5 --tier draft` (about 4 min; unit `fall` does not hold M4 and M5), `npm run sheet -- --motion landing --shot shake-3 --fit --tier draft` (about 4 min).
