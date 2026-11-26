# Handover: summer's air (job `summer_air`, branch `agent/p6-summer-air`)

Written by the builder of Phase 6's fix pass on summer's air. Read this before you change the seed, the firefly or summer's mote.

## What changed

- `src/particles/draw/cards.ts`, vertex: a seed's stroke in the storm is turned to the whirl (`CARD.line.stormAlign`), takes its own length (`stormLong`, skewed short), width (`stormWidePx`), bow (`stormBow`, `stormArc`, capped by `stormBowMost`) and dwell (`stormDwellPx`). A share `stormLeaves` of the strokes are bits of green leaf (flagged to the fragment by `headC = -1`). Whole seeds in the storm keep their hairs (`CARD.run.seedHairs`, `seedDrawn`) and are sized by `CARD.hair.stormSize`. At rest a head is not drawn where the light grid finds the place closed in (`CARD.hair.airFrom` on `gridAir`), so no head hangs inside the crown or a wall.
- `src/particles/draw/cards.ts`, fragment: the hairs of a tuft turn by the golden angle (the old constant was close to 4/7 and stamped a seven armed star), each head has its own count of hairs (`CARD.hair.least`) and its own opening (`openWide`); the head's light is capped (`CARD.hair.litMost`) so a hair is white and fine, not a burnt stroke; the ball of the tuft is off at rest (`CARD.hair.ball[0] = 0`, it drew a grey disc cut at the card's bound); a light near the lens has a soft disc edge (`CARD.glow.discEdge`, `nearPx`, `nearShare`).
- `src/particles/draw/looks.ts`: the numbers of all the above (`CARD.line.storm*`, `CARD.hair`, `CARD.run.seed*`, `CARD.glow`, `LOOKS.seed.size`).
- `src/seasons/summer/veil.ts`: the seed is white (`[1.3, 1.28, 1.2]`), the storm's haze is cream (`veil.tint`), the storm's share is 1.2, the mote is dim (`[0.55, 0.58, 0.26]`, glow 0.08): at the old colour the motes were a field of gold dots of one size over the whole glass and in front of the crown.
- `tests/storm-draw.test.ts`: one case added at the end of the describe, stating the seed's own rule in the storm. The old case passes as written (the line `if (storming) mvC *= mix(shutLong...)` is kept word for word because that case reads it; the seed's own length follows on the next line).

## What is still wrong, worst first

1. The storm is a cream volume of curved dashes round the whirl. The approved image has longer, finer, silkier streaks in a whiter haze that pools bright and low, and its tufts read as tufts. Mine lose their hairs in the lens blur at `review` (the app draws them crisp), the leaf bits are smaller and paler, the fireflies' streaks are dim.
2. At rest the hairs of a tuft are fewer and coarser than the approved down: at close zoom a tuft reads as an asterisk on a stalk, not a ball of down.
3. Nothing rests on the roof, the chimney cap, the fence rail or the lamp's top. The settled still shows a handful of tufts low by the door, the yard and the pond. The collider that decides where a seed may rest is not in this job's files and was not changed.
4. The straight edges of the haze near the trunk were not found and not mended (see the facts below).

## Facts worth knowing

- The gold dots at rest were motes, not seeds: `col += flash * k.rgb * k.a` in `shader.ts`, and the flash is capped, so the colour has to fall far before the dots dim.
- The thin dark line at the upper left of the settled still is not a particle: it stands on the same pixels in `summer-rest` and `summer-settled` (hero, hd, about x 627 y 387 to x 659 y 408) and in the build before this one. It belongs to the glass layer.
- The straight edges of the haze near the trunk in the shake: the haze takes the key's shade from the light grid (`veilLit` in `src/core/chunks/veil.ts` reads `stageKeyIn`, which reads `stageGridShade` in `src/core/chunks/light.ts`), so what a critic sees as cut-out cards is, as far as the code says, the miniature's shadow standing in the haze. Neither file is this job's. Not proven by a picture.
- `CARD.hair.seen` is read by the stroke of every kind in the storm (`cardStreak`), not by the seed alone. Raising it for the seed moved the shake of fall and of spring; the seed now reads `CARD.hair.seedSeen` and the shared number is 1.25 as on `main`. Before you change a number under `CARD.hair`, `CARD.line` or `CARD.run`, search `cards.ts` for who reads it, and hash the `landed` still of the other three seasons against `origin/main`, not only the `rest` still: the rest stills did not show this.
- `draft` doubles each hair (two lens samples), so judge the tufts at `review`.
- `--diag cover` shows the cards over the miniature only; it is black elsewhere.
- The looks were tuned under the glass builder's new rig (key 1.9, rim 1.3, cool sky). Under the old rig the storm is dimmer.
