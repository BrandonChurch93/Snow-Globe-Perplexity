# kinds3: handover (Phase 4, third set)

Branch `agent/p4-kinds3` (source), `agent/p4-kinds3-looks` (this branch). Files: `src/particles/draw/**`, `src/particles/engine/engine.ts` (not the change of kind inside a change), `assets-src/kinds/**` (untouched). Make targets: none.

## Where things are

- `src/particles/draw/looks.ts`: every number. `CARD.clear` is the rest-clear rule for the cards (winter's `REST_CLEAR` for petal, leaf, seed): inside the middle of the picture, in front of the miniature and low, a card is capped in size (`sheetPx`, `seedPx`) and its blur cut. `snagPx`, `snagSkew`, `snagLiftMm`, `snagSeen` are the seeds that have come to rest. `CARD.line` is the storm trail: `share`, `keep`, `stretch`/`leafStretch`/`seedStretch` (length), `widePx`, `*Heads` (share of trails with a head), `*HeadPx`, `deep` (size by depth), `frontCut`, `deepMostMm` (how much depth a trail may span), `leafHead`/`leafWhite`/`leafLow`/`leafHigh` (fall's colours; `step(leafWhite, hash)` picks the pale head, so a HIGHER `leafWhite` means FEWER pale heads). `CARD.glow` fireflies (`nearShare` is the share drawn as large discs, `unlit` must equal the engine's `HOME_UNLIT`). `CARD.spark` embers (`sparkClear` is where the full-brightness share begins: lower shows more). `bat*` the bats.
- `src/particles/draw/cards.ts`: `CARD_VERT` runs for shapes from `SHAPE.petal` on and rewrites every output; winter's shapes (`shape < 2.5`) never enter it, which is why winter stays byte-identical. Order inside: who is kept (`whole`, `keepC`, `lineC`), size (`rC`), clear rule (`clearC`), near and far classes, axes, streak (`stC`), trail head and width (`headC`, `wideC`), bats hide the things behind them (`uBat`), clip. Two places set `clip.z`: seeds at rest are lifted toward the eye by `snagLiftMm`; trails get their own depth along their length (`dzC`).
- `src/particles/engine/engine.ts`: `nest()` bats' homes; `steer()` fireflies: a firefly the liquid carries faster than `HOME_CARRIED` times its cruise dims to `HOME_UNLIT` and stops blinking, and lights over `HOME_LIGHTS_SECONDS` once within `HOME_NEAR_REACHES` reaches of the point it wanders after, or once it has all but stopped. `fade`/`opacity` carry it to the shader as `aData.z`.

## Traps

- A GLSL error removes every particle without failing the still: `grep -a -c useProgram <still log>` must be 0.
- `ROLL_AXIS` (`src/globe/liquid.ts:77`) is one constant read by the liquid, the engine and three shaders (`seasons/spring/veil.ts`, `core/chunks/veil.ts`, `seasons/fall/glass.ts`); a value per season is open item 74. The trails are drawn along the velocity on purpose; do not flatten them in the picture (`/root`, 07:31).
- The cards have one depth each. Anything large near a surface is cut by it unless lifted.
- `BORN_WIDE` in engine.ts (`leaf 0.5, ember 0.55`) is a per-kind number that belongs in the rows of `kinds.ts`; not moved.
- The seed, petal, leaf, ember, firefly and bat rows (`kinds.ts`) and the counts (`config/showcase.json`) are other owners'. What is afloat at rest is `floats` in the row.

## Open, worst first

See REPORT.md.
