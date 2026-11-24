# base_builder · branch `agent/p3-base`

Also read, every line: `kit/02-SUBJECT.md` sections 1, 3 (Winter) and 6 ("The arrival"); `kit/03-METHOD.md` sections 1, 5, 11 and 16; in `kit/04-LOOK.md` section 2 and the ladder step "A base looks like plastic or a toy"; in `kit/07-QUALITY-BAR.md` the measures M2 and M3 and the critic R3.

You own: `src/seasons/winter/base.ts`, `assets-src/base-winter/`, files named `assets-full/winter/base-*`.

Goal: winter's base with its icicles, the part `base-winter`, to the point where a critic takes it for carved, oiled wood and cast brass. It is the largest sharp thing in the frame.

What the approved image shows (the base lies in about x 850 to 1960, y 1090 to 1460), from the top down:

- Snow lying on the ledge round the glass: soft, uneven, with a little sparkle and blue shade.
- A brass collar the glass sits in, with a thin dark line of shadow where they meet.
- Clear icicles hanging from the ledge all the way round, of different lengths and thicknesses, tapered, rippled, with bright rims and dark cores, bending what is behind them.
- A dark carved wood body: a turned profile, a band of carved leaves, a pine cone at the right front, deep grain, an oiled sheen, worn lighter edges, dust in the hollows.
- A rope-twist brass foot ring, outer radius about 58.8 mm, with a plain rim under it, and a thin contact shadow where the foot meets the slab.

Measured on the approved image: the glass is a circle of radius 549 px centred at (1409, 646); the foot's sides are at x 872 and 1941 at y 1340 and its front edge at y 1445. Sizes are in `globe` in the config. Fit the glass and the collar exactly; the foot of the build may stand 2 mm high against the picture, which is accepted (decision 41). Measure the profile from the picture's silhouette with `rayOf` and `projectWorld`, and say the numbers.

How:

- Geometry by script in `assets-src/base-winter/build.mjs`: the turned profile as a fine lathe; the carving as real displacement of the mesh; the pine cone as sculpted scales; the rope twist as real helical geometry; the collar; the ledge's snow as its own soft mesh; each icicle its own irregular mesh. The base is seen from `live.orbitYawDeg` to either side and from the `base` and `macro` cameras, so the sides hold up and the carving runs all the way round.
- Materials with height as well as colour: wood from a generated material sheet with the approved crop as reference, its grain as displacement and normals, roughness varying with the grain; brass as real metal with fine wear and tarnish in the hollows, reflecting the room (`stageRoomSoft`, `stageRoomLights`); snow soft with sparkle that holds still in time; ice clear, by refraction worked out in its own shader against the room and the wood behind it, since no picture of the scene behind is available to a material.
- The approved image may be projected onto the faces that look at `hero` as a starting texture, with its light taken out, as `tools/briefs/P3.md` says.
- The icicles grow in the arrival: `update(moment)` sets each one's length from `moment.sinceLanding` with its own small delay from the seeded stream, as `kit/02-SUBJECT.md` says under "The arrival"; fully grown they match the picture.
- Every material carries `change: 'base'` and `standIn: false`. Keep the exports `season`, `main` (set it to the wood's mean colour; the glass reflects it), `prepare`, `base` and `update`.
- At most 6 draw calls and about 60000 triangles; maps at most `assetSets.full` sizes, with the web copies capped by the names.

Test: `npx vitest run`, `npm run determinism`, `npm run fit -- --tier draft --box 820,1080,2000,1480 --name base`, stills from `base`, `macro` and `hero`, the `texels` view (M2), and `npm run measure` for M2 and M3 (see `tools/README.md`).

Looks: the base beside the approved image; a close view of the carving and the foot ring; the icicles against the dark; the base from 35 degrees to one side.
