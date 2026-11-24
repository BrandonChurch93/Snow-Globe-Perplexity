# glass_builder · branch `agent/p3-glass`

Also read, every line: `kit/02-SUBJECT.md` section 1; `kit/03-METHOD.md` sections 1 and 2; in `kit/04-LOOK.md` sections 2 and 3 and the ladder step "The glass reads as a plain ball, or the miniature looks stuck on behind it"; decisions 18 and 21 in `kit/PROGRESS.md`.

You own: `src/globe/shell.ts`, `src/globe/lens.ts`, `tools/lib/lens.mjs`, `tools/lib/lens.d.mts`, `tests/lens.test.ts`, `tests/lensport.test.ts`, `assets-src/glass/`, files named `assets-full/shared/glass-*`.

Goal: the glass sphere and what is seen through the liquid where nothing stands, so that a critic takes it for thick hand-blown glass full of liquid. The parts are `glass` and `liquid`.

What the approved image shows, and what must be true of yours:

- A thick clear wall. The rim is a soft bright band that fades inward, with a thin darker band inside it where the wall's thickness shows. It is not a line and not an even ring.
- Reflectance follows the angle: the middle of the glass is nearly clear, the rim reflects the room. Two reflections, from the outer surface and, fainter and shifted, from the inner surface where glass meets liquid.
- A soft window-shaped highlight on the upper right shoulder, curved with the sphere, soft at its edges. A hard round highlight is the first thing a critic names.
- Where no miniature stands, the dark room is seen through the liquid, small and upside down, with the backdrop's discs as small soft points, dimmed by the two passes through the wall.
- A small air bubble at the crown, just under the wall, seen as a ring with a bright rim. It sits at the highest point of the inside along true up, slides and lags as the globe tilts, and wobbles with the liquid (`f.liquid`, the indexes are in `src/globe/liquid.ts`, which is not yours).
- In the lowest band of the glass the collar and the base are reflected (take the base's colour from `f.from.main` and `f.to.main` with `f.mix.base`), with the slab's edge and the lit pool (`f.pool`), and a thin dark line of shadow where the glass sits in the collar, near `collarY`. The sphere never ends on a hard line.
- Very fine dust and a few hairline marks that show only inside the highlight, and a slight waviness in the reflections. Small amounts.

Contract:

- Reflections read the unseen room through `stageRoom`, `stageRoomLights` and `stageRoomSoft` from `src/scene/room.ts` (the scene's builder owns their bodies and is making the key light's source a window shape). Until that lands you may shape the highlight in your own shader; say so.
- Frost is not yours: its builder draws its own mesh after the shell, just outside the outer surface.
- Keep every exported name and signature of `shell.ts` and `lens.ts` that another file imports, and every GLSL name `src/core/materials.ts` uses (`rg -n "globe/shell|globe/lens|stagePlaced|LENS_GLSL" src tools tests`). `tools/lib/lens.mjs` is the Node copy of the lens maths and `tests/lensport.test.ts` keeps the two equal: change both or neither.
- At most 5 draw calls. Every material `standIn: false`.

Test: `npx vitest run`, `npm run determinism`, `npm run fit -- --tier draft --box 820,60,2000,1260 --name glass`, and stills from `hero`, `macro`, `low` and `interior`, at `rest` and at `landed` (the bubble and the storm).

Looks: the glass region beside the approved image; a close view of the highlight and the rim; the crown with the bubble; the lowest band at the collar.
