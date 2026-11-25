# Storm drawing: handover

Written 17:18 UTC by storm_polisher for the agent that takes the storm next. Code is on `agent/p5-storm` (tip c57168a; the last commit of mine is c28539c). Nothing of it is merged.

## State in one paragraph

In a storm every kind (flake, petal, seed, leaf, light, spark, glint) is drawn once along its own path through the shutter, with no sharp head, no turning to the veil's current and no stretch by kind. All of it is in `src/particles/draw/` (`shader.ts`, `cards.ts`, `looks.ts`) behind `storming = uStorm.x > 0.0`; at rest the old path runs and the rest keys are byte-identical (winter-rest and summer-rest proven at the final tier on c28539c). The stroke is `STORM_SHUTTER` (0.3) of one exposure. Fall is better than kept, summer no worse, winter and spring lose what the approved images have: winter the dense white swirl with long curved streaks, spring the many separate petals at the front glass. Frame 666 is still a milky disc.

## What the drawing gets from the engine today

- Per particle: `aNow`, `aPrev` (places one simulation step apart, 1/240 s, glass frame, mm), `aData`, `aState`. Velocity is `(aNow - aPrev) * 240`. By liquid_polisher's word the engine renews each particle's velocity once per film frame, so a third place would lie on the same straight line: there is no curvature in the data.
- `uPoint` = (mix between `aPrev` and `aNow`, focal length in px, the shutter in steps, scale). The shutter is `config.film.shutterDegrees / 360 * stepHz / fps` = 2 steps.
- `uStorm` = (storm 0..1 from the liquid's turbulence between `LENS_LOOK.stormFrom` and `stormTo`, the sample's time offset, share shown, paced). In a storm the sample's time offset is switched off (`shader.ts` line 113), so the stroke alone is the exposure and samples do not double it.
- `uVeilRoll.x` is the roll. The only bend of a trail today is the roll about `ROLL_AXIS` through `ROLL_CENTRE` (`pointSag`, `shader.ts` line 67), held to `STREAK_ARC.most`.
- Not yet used: `liquidBend(L, out)` and `LIQUID_CURL` on `agent/p5-liquid` d7e6553 (`src/globe/liquid.ts`): local turn at place p = turn + LIQUID_CURL * cross(flow, p), plus the roll. A place s seconds on = p + v*s + 0.5*cross(turn, v)*s*s. Once that is on main: one more uniform set in `src/particles/draw/points.ts` (next to `uStorm`, line 213) and `pointSag` takes the liquid's turn. This is what gives long curved streaks.

## Why 0.3, and what it costs

At 0.8 of the shutter the finals (commit a04e931) were worse than kept: each piece was spread over 3 to 8 times its own size. Reckoned from the pictures the fastest pieces at the landing run 1.4 to 2.4 m/s. At 0.3 a piece is blurred by about its own size. The cost: winter's long white streaks are gone, and the storm and the glass no longer share one exposure length. The cleaner cure is in the engine: slower liquid at the landing, or neighbours that move alike. Kept's swirl came from turning every stroke to the veil's current (`STORM_ALIGN`), which my storm branch does not do; neighbours' own velocities do not agree, so true strokes cross. If the engine cannot give coherent motion, the honest half step is a stroke along the particle's own motion with its length from the liquid's local flow.

Winter next: flakes are too faint at the short stroke. Two commits of mine made them fainter for the long strokes of 0.8 and were not looked at again at 0.3: 3b64b71 (a flake keeps its own width in its stroke and is that much fainter, `shader.ts`) and 42a7c5a (`STORM_SHARP_SOFT` in `looks.ts`). Undo or ease them and look at the dome. My report named a number `wider` in `looks.ts`; there is no number of that name, these two commits are what was meant. Spring next: at the front glass fewer petals are drawn than kept (the near share `CARD.near.stormShare` and the flood's front, `STORM_FLOOD.frontMm`, `frontClear`), look there first.

## Where the veil's split into far and near would go

The veil is not a sheet in the code: it is fog along the path from the glass to each thing, `veilPath(eye, placed, world, path)` in `src/core/chunks/veil.ts` (line 409). The miniature takes it in `VEIL_FRAG` (line 480, used by `src/core/materials.ts` line 277) and each particle in `src/particles/draw/shader.ts` line 276. It reads as one sheet because the fog is smooth (`veilMilk`, the bank, `bankWhite`, `bankEven`) and at the swap its flood covers nearly every particle. The split I would make, in `veilPath`: return the fog of the part of the path behind a plane through the miniature's middle apart from the fog in front of it; the miniature takes both, a particle only what lies in front of itself, and the near part is thinned where particles stand (today only `STORM_FLOOD.frontMm`, `frontClear`, `frontGain` in `looks.ts` do this, for 6 to 22 mm behind the front glass). I take the pink grain of frame 666 to come from the bank's grain (`bankGrainLow`, `bankGrainHigh`, `bankGrainFlood`) and not from particles; I did not prove it by drawing the veil alone. I did not edit the veil.

## The two long pale lines in fall

One upright, left of the tree, about 110 px long; one level near the top of the dome. They stand in the same place in kept, at 0.8 and at 0.3, so their length does not come from `STORM_SHUTTER` and they are not trails of the storm branch. What I would do: draw fall-shake at draft with one layer at a time (the views of `src/diagnostics/views.ts` through `--diag`) to see whether the particles or the veil draw them. If the veil: `veilFibre` and `veilStreak` (`veil.ts` lines 345 and 372). If the particles: something that does not pass through the storm branch. In `cardCover` (`cards.ts` line 457) the bats (`shape >= SHAPE.bat`) stay on the old path; look there first, then at the points of `shader.ts` whose stroke is not `moved` of line 166.

## Not checked

No film in motion was seen, so a jump at the frame where `uStorm.x` reaches 0 is possible. The live app (`--live`) was not drawn. No shake key but spring was seen at the final tier at 0.3. The proofs ran on c28539c; later merges of origin/main changed `src/shake/table.ts`, which may move the shake keys by itself.

## Commands

Two trees, one render at a time: edit and commit in the main tree, then in the render tree `git checkout -q --detach <sha> && npm run -s build`.

```
npm run still -- --key fall-shake --tier draft --force      # about 70 s; --tier final about 11 to 15 min
npm run still -- --key winter-rest --tier final --force      # about 5 min; sha256sum out/work/stills/winter-rest-hd-final.png
npm run seq -- --first 666 --last 666 --tier review --format hd --look no --force   # about 5 min
node tools/measure.mjs --unit change --tier draft --only M4,M5
npm run determinism
npm run gate -- --phase 4 --only G11,G12
```

Do not run `node tools/still.mjs --help`: it starts a render.

The stacks (three rows: cottage, front glass, dome; approved | kept | mine, native size at hd):

```python
import sys
from PIL import Image
key, mine, out = sys.argv[1], sys.argv[2], sys.argv[3]
season = key.split('-')[0]
kept = {'fall': 'out/stills/fall/fall-shake.jpg', 'summer': 'out/stills/summer/summer-shake.jpg',
        'spring': 'out/stills/spring/spring-shake.jpg', 'winter': 'out/stills/phase-3/winter-shake.jpg'}[season]
ap = Image.open('references/approved/%s-shake.png' % season).convert('RGB').resize((1920, 1080), Image.LANCZOS)
kp = Image.open(sys.argv[4] if len(sys.argv) > 4 else kept).convert('RGB')
mn = Image.open(mine).convert('RGB')
crops = [(730, 400, 1190, 860), (480, 260, 940, 720), (730, 85, 1190, 545)]
im = Image.new('RGB', (460 * 3 + 8, 460 * 3 + 8), (0, 0, 0))
for j, c in enumerate(crops):
    for i, src in enumerate((ap, kp, mn)):
        im.paste(src.crop(c), (i * 464, j * 464))
im.save(out, quality=88)
```

Run from the repository root: `python3 stack.py fall-shake out/work/stills/fall-shake-hd-draft.png fall.jpg`. Frame 666 is the crop (700, 250, 1390, 700) of `out/work/seq/film-hd-review/film-000666.png`, kept commit beside mine.
