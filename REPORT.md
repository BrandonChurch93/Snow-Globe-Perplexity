# Report: summer miniature, third set (summer_mini3), Phase 4, Round 12 fix pass

Branch `agent/p4-summer_mini3`, last commit: see the last line of this file. Looks branch `agent/p4-summer_mini3-looks`.
Make targets, in order: `tree-summer`, `village-summer`, then `npm run texpack`, `npm run build`.
Stand-ins and fallbacks: none.

## What each commit answers
| Commit | Issue (Round 12) | Seen with my own eyes |
| --- | --- | --- |
| `814948a`, `6f27fb7`, `e736060` | first pass: crown tone and gold rims, sun pools, sand lip, lanterns, wall, pond sky | rest hero draft and review |
| `25334c4` | M3 summer-rest (final 0.5806 on the frozen build): grain the lens resolves in sand, grass, crown, masonry; R1 #4 larger sparser vines, darker chimney; R1 #7 pebble bank | rest hero draft and review, energy map |
| `a8881ec` | R1 #6 and R3 part 2 lanterns (hot cores, soft ribs, light on wall and leaves); R1 #7 and R3 part 2 fence (separate boards with grain); R3 part 2 sunflowers (cupped petals, 0.27 mm stems), both windows, sand band relief; R1 #3 my half (ragged lip, darker face, broken shelf); R3 beetle blob (a sunk stone, removed) | rest hero draft; settled hero draft (all ten lanterns lit: "leftmost unlit" not reproduced) |
| `e42a7f1` | R4 major, decision 91: lanterns come up one by one from a dim glow (floor 0.4, every 0.23 s, each over 0.42 s, last up at 2.49 s); green sunflower stems, smaller leaves; R3 waterline (wider wet film, ruffled); side pane lit | landed hero draft, rest hero draft, macro and interior at rest (draft), rest hero at the final tier (the measure's still) |
| `a0997d0` | R3 part 2 "warm glow onto nearby foliage", R1 #5 modelling in the lower crown: the lanterns' light reaches further into the leaves | rest hero draft |

## Still wrong, worst first
1. M3 passes at the final tier by a small margin only (see the last lines). The lower crown (0.53 to 0.64 of the approved
   detail), the pond (0.52) and the roof (0.56) hold least. Much of the approved detail there is leaf silhouette against
   bright haze, and the air behind the tree is dark (summer_air3's backdrop).
2. Crown (R1 #5, R3 minor): the pads are still alike in size and density; gaps between tiers are clearer than before
   but not the approved image's separate rounded masses. The leaf cards are the same model at all pads.
3. Cottage (R1 #4): chimney height, roof rows, wall courses and the arch are the shared model, not in my files. I
   darkened the chimney and varied the stones in tone only.
4. Fence (R1 #7): boards now differ in width, tone and grain, but the rails are not open (shared model), so from the
   hero it is still a low dark shape.
5. Sunflower leaves are flat kites (two triangles each); the petals are shaded by normals only, not translucent.
6. Pond (R1 #7): reflections are broad pale and dark shapes of the sky, cottage, post and trunk from an analytic
   model, not the real silhouettes; the lamp's narrow reflection is there but faint.
7. Lamp post (R1 #6): its shape is the shared model.
8. The front lip of sand is wide from the hero; bases3's taller collar is meant to cover part of it (not seen merged).
9. A clipped red-white dot in the pond's reflection at rest is a particle, not my mesh.

## Not seen
- The film (lantern timing in motion); only the landed still at 0.5 s.
- Cameras base, surface, low after today's changes; the stand-ins diagnostic.
- The landed state after `a0997d0` (seen after `e42a7f1`'s timing at floor 0.4).

## Built
Nothing new as a part; the same meshes (ground, water, grass, decor, leaves, lanterns), re-toned and re-shaded, with
fewer triangles than at the start of the pass.

## Triangles (G15), merged build at `24ae271`
Season: 1,648,500 / 906,237 / 427,880 (high / medium / low; limits 1,800,000 / 1,100,000 / 600,000).
My files at high by the builders' logs: 181,510 (ground 31,920, water 2,160, grass 63,000, decor 23,282, leaves 49,404,
lanterns 11,744); 182,472 before today's last batches. Medium and low not recounted mesh by mesh; the season's counts
fell by 299 and 1,118 against my 07:11 figures with nothing but my files changed in the build.

## Tests and measures on the last state
- `npx tsc --noEmit`: clean. `npx vitest run`: 32 files, 432 tests passed, 4 skipped (run on `24ae271`).
- `npm run determinism`: `determinism: pass · 3 pictures, 4 page loads, preview, draft, 348 s` (on `3fbe51f`; `24ae271` adds
  only scorecards, kit and status files from main).
- `npm run measure -- --unit summer --only M3 --tier final` on `3fbe51f`: pass, 0.7645 against 0.75 (base 1.237, miniature
  0.765 over 125,261 pixels). Earlier finals: 0.5806 (frozen `e39ec6c`, from /root), 0.536 (`e736060`), 0.7644 (`a8881ec` less
  two edits), 0.7593 (`3d8d0c4`).
- `npm run measure -- --unit summer --only M2,M3,M6 --tier draft` on `3fbe51f`: 13 of 19 lines, 0 red (M3 draft 1.0775; M2 all
  0; M6 at most 9 of 102,000 particles inside a solid at summer-shake).

## Looks
40 of 40 used (stills, fits and measures that render, counted together).

Last commit of `agent/p4-summer_mini3`: `24ae271` (merge of main over `a0997d0`).
