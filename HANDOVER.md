# Handover: the seven particle kinds of spring, summer and fall (`kinds_builder`, Phase 4)

Written for someone who has never seen this work. Branch `agent/p4-kinds`; looks branch `agent/p4-kinds-looks`.

## What this part is

Seven particle kinds drawn in the particle shader: `petal`, `mote` (spring), `seed`, `firefly`, `mote` (summer), `leaf`, `ember`, `bat`, `mote` (fall). Parts in the register: `particle-petal`, `particle-mote`, `particle-firefly`, `particle-seed`, `particle-leaf`, `particle-ember`, `particle-bat`. All seven are real (`real: true` in `LOOKS`); there is no stand-in and no fallback (no crossed cards with a generated picture were needed).

There is no table and no sheet: every shape is worked out in the shader. So there is **no `npm run make -- kinds` target** and no `assets-src/kinds/`. Nothing of mine has to be made before `npm run texpack && npm run build`.

## My files

- `src/particles/draw/cards.ts` (new): all GLSL of the seven kinds. Four strings: `CARD_VERT_PARS`, `CARD_VERT`, `CARD_FRAG_PARS` (holds `cardMain`).
- `src/particles/draw/looks.ts`: `SHAPE` (petal 3, fleck 4, leaf 5, seed 6, light 7, spark 8, bat 9), the seven rows of `LOOKS`, and the `CARD` constants.
- `src/particles/draw/shader.ts`: five small hooks only: `vec4 clipC = clip;`, `vec3 base0 = base;`, `${CARD_VERT}` before the last `gl_Position` line, `${CARD_VERT_PARS}`, `${CARD_FRAG_PARS}`, and in the fragment main `if (look.x > 2.5) { cardMain(...); return; }`. Winter's own expressions are not touched.
- `src/particles/draw/points.ts`: one uniform, `uKindWay[kind] = (renew, floats, settles ? 1 : 0, 0)` from `BEHAVIOUR`.
- `src/particles/engine/engine.ts`: one change (see "Winter").

Not mine: the rows of `BEHAVIOUR` in `src/particles/engine/kinds.ts` and the colours in `src/seasons/<season>/veil.ts` belong to `spring_air`, `summer_air`, `fall_air`. Counts are in the config.

## How a kind is drawn

Everything for shapes above 2.5 happens in one block at the end of the vertex stage (`CARD_VERT`), which writes every output again, and in `cardMain` in the fragment stage. Flakes and glitter never enter either.

- A card has three axes (along U, across V, out of the sheet N), turned by a yaw from the particle's hash and rocked by its phase `aData.w`. Only whole multiples of the phase are used, because the engine wraps it at 2 pi. Lying (`aState` 1 to 2), the rocking goes to a small tilt (`lieTilt`).
- The fragment stage solves the pixel back onto the card (`cardSolve`, two steps for the bend), reads an outline with an analytic edge (`cardEdge`), and blurs along the path through the shutter with four taps plus a sharp head (`CARD.head`).
- petal: notched outline, cupped (`petalCup`), pale to white along its length, light let through by `flash`.
- mote (fleck): a small lobed speck, drawn in classes of visibility (`fleckKeep`, `fleckSkew`): few bright, most faint.
- leaf: lobed outline with a stem, midrib and side veins, curled (`leafCurl`), spins about its midrib; orange to rust by a hash over the season's colour.
- seed: not a card but lines: stem, grain, three rings of hairs (`CARD.hair.ringA/B/C` = count, opening angle, length), 34 lines.
- firefly (light) and ember (spark): `cardGlow`, a core and halos as gaussians along the path, added light. Ember colour runs hot to the season's colour to dark red by its life (`phase / 2 pi`); firefly blinks by its phase.
- bat: a facing card, head up, leaning the way it goes (`batLean`, `batBank`), scalloped wings that beat by shifting the outline with the phase (`batFlap`), a lighter rim (`batRim`).

## The classes (the one idea a successor must know)

Config counts are large (24000 petals, 16000 leaves, 9000 seeds). Drawn all whole they wall the storm and carpet the ground. So for kinds that settle and stay (petal, leaf, seed):

- **whole**: the particle is in the engine's `renew` or `floats` class. The shader repeats the engine's own test: `hash2(i, 191 + kindIndex) < max(renew, floats)` (`cardHash2` is a GLSL copy of `hash2` in `src/core/rng.ts`). Plus a small chosen share that lies for good: `CARD.chosen` = [petal 0.004, others 0.012].
- **storm share**: `CARD.dabShare` = [petal 0.2, leaf 0.3, seed 0.6] of the rest are small (`dabSize` 0.36) and seen only while the storm blows; they are gone once down. For seeds these draw as fine streaks only.
- the rest are not drawn.

So the number afloat at rest is set by the row (`renew`, `renewMmS`, `floats`, `dwellSeconds`), not by me. If an air builder changes `renew`, the picture follows with no change here.

## Winter

Winter's rest and landed stills (`npm run still -- --season winter --state rest|landed --camera hero --tier draft --format hd --force`) were compared byte for byte with stills taken before my first change, after every push: identical every time.

One real finding: `engine.ts` took one number, the slowest stir that lifts anything, as the lowest `liftMmS[0]` of every kind of every season. When summer's seed row went from 18 to 10, winter's rest still changed (3787 pixels). Now it is per season (`MIN_LIFT_IN`), from that season's own kinds, both seasons' during a swap, capped at `LIFT_FLOOR = 18`. The cap is there because winter's own lowest is 40 and it has always run with 18; without the cap winter would change.

## Things that bite

- A GLSL error breaks the particle shader silently: no particles at all. Look at a still after every shader edit.
- Stills need `npm run texpack && npm run build` first; `dist/` must match the source or the still tool stops.
- Never run a still while vitest's heaviest tests run if you time things; the result is still the same bytes, only slower.
- `main` now carries built assets of all seasons; before a merge run `git checkout -- assets-full public/assets` and `git clean -fdq assets-full public/assets`.
- To see particles on the air builders' newest rows before they reach `main`, lay their `kinds.ts` rows and `veil.ts` over the tree, look, and `git checkout` them again before committing.

## Constants a successor should know (`CARD` in `src/particles/draw/looks.ts`)

| Constant | Value | What it does |
|---|---|---|
| `LOOKS.<kind>.size` | petal 1, mote 1.2, leaf 1.35, seed 3.6, firefly 1, ember 1.3, bat 1.15 | Drawn radius as a multiple of the row's `sizeMm`. Seed 3.6 is agreed with `summer_air` (its row is `[2.5, 5] / 3.6`): do not change one without the other |
| `chosen` | [0.004, 0.012] | Share that lies for good: petal, others. `spring_air` asked for the low petal number so the pond's mirror shows |
| `dabShare` | [0.2, 0.12, 0.6] | Storm share of the rest: petal, leaf, seed |
| `dabSize`, `stormSize` | 0.36, [0.45, 0.45] | Size of a storm-share card; size of a whole petal and leaf while the storm blows |
| `head` | 0.85 | How sharp a moving card is at the head of its trail |
| `fog`, `batFog` | 0.3, 0.08 | How much of the season's veil lies over a card in the air, over a bat |
| `leafHue` | 0.15 | How much of the light's colour a leaf takes (low, so it stays orange in fall's green light) |
| `litMost` | 1.25 | Cap on the light a card takes from the grid |
| `fleckKeep`, `fleckSkew`, `fleckStorm` | [0.01, 0.5], 8, 3 | Motes: most are faint, more show in the storm |
| `sparkKeep`, `sparkSkew`, `spark.gain` | [0.02, 1], 4, 1 | Embers: tuned to `fall_air`'s row (`sizeMm [0.12, 0.7]`, skew 4, glow 1.3). With a brighter row they become a white cloud over the tree; then lower `gain` |
| `glow` | core 0.34, halo 1.5, wide 4.5, shares 0.1 and 0.01 | Firefly; tuned to `summer_air`'s row (`sizeMm [0.22, 0.5]`, glow 3) |
| `hair` | 34 hairs, `wide` 0.011, `runStretch` 2, `runSeen` 1.6 | Seed head; the `run*` numbers are the storm streaks |
| `batLean`, `batBank`, `batFlap`, `batRim` | 0.5, 0.3, 0.45, 1.5 | Bat. `batRim` 0.6 made them vanish on the dark air at rest; 1.5 shows them but slate, not black |

## What is still wrong, worst first (pictures are on the looks branch)

0. **Embers against the wrong row** (`fall-rest-hero-pair.png`, rendered at my last commit on `main`'s rows as of 192ccf3): a pale glowing cloud over the tree. `main` then still had `fall_air`'s older ember row (glow 3.2, `sizeMm [0.2, 1.0]`, skew 3); my numbers (`spark.gain` 1, `LOOKS.ember.size` 1.3, `sparkKeep [0.02, 1]`, `sparkSkew` 4) are tuned to its newer row at `agent/p4-fall_air` 8e4829f (glow 1.3, `sizeMm [0.12, 0.7]`, skew 4), with which I saw a scatter of orange sparks round the tree and no cloud. First thing to do: render fall at rest on the current `main`; if the cloud is there, check which ember row `main` has, and if the brighter one stays, set `spark.gain` to about 0.4 and `sparkSkew` to 9.
1. **Fall storm** (`fall-landed-hero-pair.png`): leaves are soft orange shapes; the approved has many long thin bright streaks and red leaves among the orange, and three crisp black bats. Ours has no thin streak class for leaves (seeds have one: copy `runLong` in `cardSeed` for the leaf's storm share) and the bats do not show in the storm.
2. **Bats at rest** (`fall-rest-hero-pair.png`): they face the picture and beat, but read slate and translucent, and sit in one clump under the cap where the sky is dark. The approved has three crisp black ones lower, against the lit haze. Their place is the row's (`reachMm`, height in the engine's `nest()`); their translucency is the lens blur on a small card near the glass (`amp` in `cardCover`): try a floor on `amp` for the bat.
3. **Summer storm** (`summer-landed-hero-pair.png`): streaks are there through the globe but the whole seed stars are larger and flatter than the approved's, and the fireflies are lost in the storm.
4. **Summer rest** (`summer-rest-hero-pair.png`): fewer seeds than the approved, all of one brightness; fireflies smaller than the approved's; no large soft ones near the glass (no kind has a near, out-of-focus class like winter's bokeh flakes).
5. **Spring storm** (`spring-landed-hero-pair.png`): close in kind; petals still a little larger and more uniform than the approved's fine dabs, and no fine white streak lines.
6. **Spring rest** (`spring-rest-hero-pair.png`): petals a little large; the notch at a petal's tip does not read at this size.
7. Leaves: the veins and lobes are in the shader but do not read at hero size; only the macro camera would show them, and I did not look at a macro still. Not seen: the live (instanced quad) path in a browser, any macro still, any still at a tier above draft.

## Tried and dropped

- Every particle whole: a pink wall in spring's storm and a carpet on the ground. Hence the classes.
- Embers with every one drawn at full light: one white column, later a white cloud. Hence the skewed keep.
- Bat as a card flying along its 3D path with a share turned to the eye (`batFace`): from the hero camera, level with them, they were edge-on slivers, then tall zigzags. Now a facing card.
- Seed stars drawn whole in the storm with three taps along the path: thick-armed still stars. Now a head plus a trail, and streak-only for the storm share.
- A lower `seed` size factor (1.5) while `summer_air` cut its row at the same time: we crossed twice. Settled: factor 3.6 stays, the row carries the size.
- Same crossing with `fall_air` on ember brightness. Settled: its row is fixed (glow 1.3), my `spark.gain` is the knob.

## `ASSETS.md` rows

None: this part has no generated image, no built asset and no third-party source. All shapes are code in `src/particles/draw/cards.ts`.

## Make targets

Mine: none. On `main` at my last merge the targets with a script are: `base-fall base-spring base-summer base-winter flakes frost-winter scene slab-fall slab-spring tree-fall tree-spring tree-summer tree-winter trunk village village-fall village-spring village-summer village-winter`. Order that matters: `trunk` before any `tree-<season>`; then `npm run texpack`, then `npm run build`. Since `main` carries the built assets of every season, a fresh clone needs only `npm run texpack && npm run build`.

## Tests at the last commit (93f789c), what ran and what it printed

- `npx tsc --noEmit`: clean.
- `npx vitest run`: `Test Files 32 passed | 1 skipped (33)`, `Tests 432 passed | 4 skipped (436)`.
- Winter rest and landed hero stills at draft, hd: byte-identical with the stills taken before my first change (`cmp`).
- `npm run determinism`: `identical: still-settled, pass d against pass a`, then `determinism: pass · 3 pictures, 4 page loads, preview, draft, 320 s`.
- Stand-ins view (`--diag standins`, rest, hero, draft, hd) for spring, summer and fall: every pixel of all three pictures is black (counted, 0 of 2073600 pixels above black), so no stand-in shows in any of the three seasons, mine included.
- `npm run measure -- --unit spring --only M3,M4,M5,M6 --tier draft` (142 s): `measure spring: not complete · 7 of 19 lines, 1 red`. M6 passes on all six lines (`spring-rest` 0, `spring-shake` 0.000186 = 19 of 102000 particles inside a solid, threshold 0.002; the other four 0). The one red is `FAIL M3 spring-rest: 0.6769 (threshold 0.75)`, and its text names the base (`base 0.677`; `miniature 0.928`): it is the spring base's sharpness, not a particle measure. The tool printed `M4 is not measured for the unit spring` and the same for M5.
- **Not run**: `npm run measure` for the units `summer` and `fall` (each takes about two and a half minutes and my last push was due). A successor should run both first: `npm run measure -- --unit summer --only M3,M4,M5,M6 --tier draft` and the same with `fall`. Watch M6 in `fall-shake` and `summer-shake` (particles inside a solid) most.

## Looks

62 pictures looked at in all, each as a pair with the approved crop at hd (helper: crop both to the box 560,60 to 1360,860 of the hd frame and set them side by side): spring 24, summer 13, fall 25. Each season's count stands against every kind of that season; all under 40.

The pictures on the looks branch were rendered with the air builders' newest rows and colours laid over the tree (their branches at that minute), which may be ahead of `main`.
