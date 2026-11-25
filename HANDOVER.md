# Handover: kinds2 (the drawing of the seven new particle kinds)

Branch `agent/p4-kinds2`, tip `49c91ad` (main merged 05:15 UTC). Looks branch `agent/p4-kinds2-looks`. Make targets: none (nothing baked; `assets-src/kinds/` is empty).

## My files
- `src/particles/draw/cards.ts`: the GLSL of every kind drawn as a card (petal, mote/fleck, leaf, seed, firefly/light, ember/spark, bat). `CARD_VERT` is spliced into the vertex shader of `shader.ts`; the fragment side has `cardEdge` (outlines), `cardTint`, `cardSeed` (the hair tuft), `cardGlow` (fireflies, embers), `cardStreak` (storm lines), `cardMain`.
- `src/particles/draw/looks.ts`: every constant. `SHAPE` (codes), `LOOKS` (shape, size, body, flash per kind), `CARD` (all card constants, commented one by one), `LENS_LOOK`, `STORM_*`.
- `src/particles/draw/shader.ts`, `src/particles/draw/points.ts`: the shared point shader and its uniforms (winter's flakes and glitter live here: do not change what `shape < 2.5` draws).
- `src/particles/engine/engine.ts`, except the change of kind (`follow`, `turn`, `blend`: change_builder's).

## How a card decides what it is (cards.ts, top of CARD_VERT)
- `whole`: a kind that never settles, or a particle of the row's `renew` or `floats` share, or one of the `CARD.chosen` share. Whole cards are the ones drawn at rest.
- Not whole (the many that settle after a storm): drawn only in the storm, as `lineC` streaks (share `CARD.line.share`), as small dabs (share `CARD.dabShare`), the rest not at all; invisible once they lie. So the rest picture is the row's `renew` and `floats` shares, the storm is everything.
- `nearC` / `farC`: soft classes by depth at rest; `gustC`: the particle's own pace on screen times the storm gate.
- Lying sheets take their normal from `phase` (engine writes `facingPhase(nx, nz)` on landing).

## Things that bite
- A GLSL error removes every particle without failing the still: `grep -a -c useProgram <still log>` must be 0.
- Stills refuse when `dist/build.json` is older than the source: no edits under `src` while a still queue runs.
- Winter must stay byte-identical: after every push compare `winter rest hero` and `winter landed hero` draft hd with the baseline pair (mine: `/tmp/base/`, re-make from `origin/main` if lost; identical at 49c91ad's parent 75688e6).
- `tests/sim.test.ts` checks that every particle starts inside the glass and out of solids: any new birth place must be clamped (see `spring()` and the rest placement in `reset`).

## Open, worst first
0. Fall, M3 at rest is red: 0.3726 against 0.75 at draft on `49c91ad` (base 0.542, miniature 0.373; Round 10 at final: 0.3938, base 0.394, miniature 0.447). The measure's crop shows leaves and soft ember discs over the cottage and tree. Winter keeps flakes in front of the miniature small and sharp with `REST_CLEAR` (`looks.ts`, `shader.ts` line 141); the cards of the new kinds (`cards.ts`) have no such rule, and `BORN_WIDE` (659a85b) put more leaves and embers in front of the miniature. Try first: the same rule for cards at rest (size and blur capped inside 0.72 to 0.92 of the lens radius from the centre, off in the storm), then `npm run measure -- --unit fall --only M3 --tier draft` (about 60 s). I did not measure the particles' share (no run with the particles off), so the miniature and fog may be the larger part.
1. Fall, change into fall (R4 #3): on film frames 2128 and 2147 the leaves are thin faint streaks under the green flood. I raised what the draw can (dabs drawn while the storm lasts also in slow water `CARD.dabCalm`, more dabs, larger storm leaves, `CARD.leafFogMost`), not re-seen on film. The flood's density over the window is fall_air2's and change_builder's.
2. Fall leaves read flat and of one outline (jury): one lobed outline in `cardEdge` with `cardLeafHalf`; wants 3 outlines (maple, oak, oval) chosen by `own`, a wider `CARD.spread`, a vein line in `cardTint`.
3. Fall: no large soft orange discs near the glass (`CARD.spark.nearShare`, `nearFrom`, `nearPx`): the discs drawn now are few and dim. At macro the embers' discs are pale gold and drawn out along their path (`discHold`, the streak of a disc should be dropped).
4. Bats: one silhouette, varied only by size, bank and wing raise (`batSpread`, `batBank`, `batRaise`, `batFlap`); hard to find against the dark top; not checked in the storm. Size follows the row: `LOOKS.bat.size 1.6` is fitted to `sizeMm [4.4, 5.8]`.
5. Summer seeds whiter and heavier than the approved's fine starbursts (`CARD.hair.wide`, `hair.gain`, `LOOKS.seed.size 3.6`); storm streaks thinner and dimmer than its white-gold.
6. Spring: fewer large soft petals near the glass than the approved; storm dabs smaller and fewer.
7. `BORN_WIDE` in `engine.ts` names two kinds (leaf 0.5, ember 0.55: the share born away from the emitters). It belongs in the rows of `src/particles/engine/kinds.ts` (fall_air2's) as a field; move it there when that file is free.
8. R4 #6: leaves rest only where `n.y >= slope` of the row; leaf has 0.72, a 45 degree roof 0.707. Sent to fall_air2 (slope 0.5). No engine change needed.
