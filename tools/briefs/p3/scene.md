# scene_builder · branch `agent/p3-scene`

Also read, every line: `kit/02-SUBJECT.md` sections 1 and 9; `kit/03-METHOD.md` sections 1, 3 and 14; in `kit/04-LOOK.md` sections 3 to 8 and the ladder steps "A still does not match its approved image", "The surface or the mirror image looks wrong", "The discs behind the globe look fake" and "Slow gradients band"; decision 21 in `kit/PROGRESS.md`.

You own: `src/scene/surface.ts`, `src/scene/backdrop.ts`, `src/scene/room.ts`, `src/scene/cameras.ts`, `src/scene/passes.ts`, everything under `src/post/`, `src/seasons/winter/backdrop.ts`, `assets-src/scene/`, files named `assets-full/shared/scene-*`.

Goal: everything round the globe and the lens it is filmed through. The parts are `surface`, `backdrop` and `lens`.

What the approved image shows, and what must be true of yours:

- The slab: dark, cold, glossy, with fine marks and dust that have height. Its far edge lies about two thirds down the frame. The mirror image of the base is sharp where the foot touches, about half as bright as the base, and softens and fades with the height of what it mirrors. A mirror image as sharp far away as at contact is a tell.
- A soft contact shadow under the foot and a cold pool of light round it; the warm glow of the globe's own lights on the slab in front (`f.pool`). All of it follows `f.globe`: lifted, the shadow widens, softens and pales; tilted, it shifts; at the landing it closes.
- The backdrop: a dark blue room. Real small emitters at different depths, drawn out of focus as soft discs of different sizes: cold blue, white and a few amber, denser toward the sides, squeezed into cat's-eye shapes toward the corners, some with a slightly brighter edge, none hard, none identical. Their count is `scene.bokehLights`; their colours come from the season (`kit.backdrop`) and cross with `f.mix`.
- The room no one sees (`src/scene/room.ts`): give `stageRoom` the key light's source as a soft window shape in `f.keyDir` with `f.keyCol`, and the rim light's source; give `stageRoomSoft(d, rough)` a real closed-form blur of the same. Keep the three names and signatures; the glass, the bases and the light engine call them.
- The lens: shallow depth of field as the approved image has it (the globe sharp, the far slab and the room soft), set per camera in `src/scene/cameras.ts`; a gentle glow round the small lights in several sizes, tinted by `f.bloomTint`; fine film grain that depends on brightness and on the seed and frame only; faint fringing toward the corners; corners a little darker; dither before 8 bits so the dark gradient never bands.
- Tone and grade: a filmic curve and a grade toward the approved image. The stand-in build is brighter and less blue than it (mean colour of the approved image 39.5, 49.3, 58.9 of 255; of the build 65.1, 68.1, 78.9). Put every number of the tone curve, the grade, the glow, the grain, the fringing and the corners as named fields of one exported object in `src/post/grade.ts`, because `/root` fits them against the approved image after all parts are merged.

Contract:

- Keep `Post`'s interface (`exposure`, `seed`, `resolve(mean, raw)`), `Pose`, `poseOf`, `poseById`, `poseWith`, `mixPose`, `applyPose`, `drawPasses` and every other export another file imports (`rg -n "scene/surface|scene/backdrop|scene/cameras|scene/passes|post/" src tools tests`). The numbers under `cameras` in the config are `/root`'s; say which you would change.
- `makeDressing(kit)` in `surface.ts` is the stand-in dressing; the frost's builder replaces it with its own object through `kit.dressing()`. Draw order 2 lies over your slab.
- The mirror pass draws the scene again and the shadow pass once more: keep both cheap, and give the `baked` level of `live.quality` a mirror image that needs no second pass.
- At most 6 draw calls of your own. Every material `standIn: false`; remove `flagStandIn('lens')` in `src/post/post.ts` when the lens is real.

Test: `npx vitest run`, `npm run determinism`, `npm run fit -- --tier draft` (whole frame), `--box 0,1000,2816,1584 --name slab`, `--box 0,0,800,900 --name discs`, and stills from `surface`, `base` and `low`.

Looks: the whole frame beside the approved image; the slab with the mirror image; a corner of the backdrop; a crop at full size showing grain and glow.
