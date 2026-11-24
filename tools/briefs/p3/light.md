# light_builder · branch `agent/p3-light`

Also read, every line: `kit/02-SUBJECT.md` section 3 (Winter); `kit/03-METHOD.md` sections 1, 9 and 14; in `kit/04-LOOK.md` sections 3, 5 and 6 and the ladder steps "The small lights do not glow" and "A still does not match its approved image"; decision 21 in `kit/PROGRESS.md`.

You own: `src/scene/lighting.ts`, `src/scene/lightgrid.ts`, `src/core/chunks/light.ts`, `src/seasons/winter/rig.ts`, and new tests you name `tests/light-*.test.ts`.

Goal: the light every part is lit by. The parts are `light-engine` and, with the miniature's builders, `light-winter`.

What the approved image shows:

- A dark room. A cold blue-white key from the upper right in front, large and soft, whose source shows as the window-shaped highlight on the glass. A colder rim light from behind. Shadows are soft and short.
- Inside the glass, small warm lights (the window, the lamp, the string lights, the tree's bulbs, the star) that light the snow, the stones and the flakes near them and fall off within millimetres, so the scene is warm near its lights and blue between them. Their glow comes out through the glass onto the slab in front.

What to build:

- The light grid: baked for a season from its `innerLights` with the season's distance field as the thing that blocks, with one bounce off bright ground. Give it direction as well as colour, so a lit surface has a lit side and a dark side and the miniature is never flat. `StageFrame.grids` holds one texture for each of the two seasons in play: if you need more data, pack it into that one texture.
- Flicker and breath that close over `scene.ambientPeriodSeconds`, pure functions of the time.
- The room rig for every lit material: the key with a soft shadow whose softness grows with distance from what casts it, at `quality.shadowMapPx`; the rim; sky and ground; the fill. Inside the liquid the key arrives through the glass: softer and bent, and never as hard sun.
- Reflection of the unseen room for every lit material, by its roughness: `stageRoomSoft(dir, rough)` and `stageRoomLights(dir, soft)` from `src/scene/room.ts` (include `ROOM_GLSL`, spread `roomUniforms`; `room.ts` imports nothing but three, so there is no import cycle). Brass, ice and wet stone have to look like themselves in a dark room with one window.
- Help for soft things: a wrapped and a through-light term that a snow or needle material can call from its `hook`. Name each function in your report.
- The glow reaching out: `glowOf` and what fills `f.pool`, so the slab's builder can draw the warm pool where it belongs.
- Winter's rig in `src/seasons/winter/rig.ts`, set by eye against the approved image. `/root` does the final fit after all parts are merged, so every number is a named field.
- Remove the `flagStandIn('light-engine')` call when it is real.

Contract:

- Keep every export another file imports, with its signature (`rg -n "scene/lighting|scene/lightgrid|chunks/light" src tools tests`): the `Lighting` class as `src/scene/stage.ts` uses it, `bakeGrid`, `lightAt`, `flickerOf`, `gainOf`, `glowOf`, `gridCells`, `gridBytes`, `lightUniforms`, `LIGHT_FRAG_PARS`, `LIGHT_FRAG`, and the GLSL `stageGrid(vec3 local)` and `stageLit`, which the veil and the particles read.
- The miniature is being rebuilt by two builders while you work: test on the stand-in and tune to nothing in its shapes.
- The cost matters: every lit material pays for what you add, in three passes.

Test: `npx vitest run`, `npm run determinism`, `npm run fit -- --tier draft`, stills from `interior`, `macro`, `base` and `hero`, and the diagnostic views of `kit/04-LOOK.md` section 9 that show light.

Looks: the inside beside the approved image; a close view of the lamp's pool on the snow; the base's brass; the light views.
