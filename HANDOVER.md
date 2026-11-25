# Handover: `miniature-spring` (spring_mini)

Written for someone who has never seen this work. Branch `agent/p4-spring_mini` (tip `8df335b`), looks branch `agent/p4-spring_mini-looks`.
The target is `references/approved/spring-rest.png` and `spring-shake.png`; put the approved crop beside every look.

## What the part is

The season's cover, growth, props, small lights and distance field on the shared miniature (cottage, trunk, lamppost, fence, path, pond outline, island are shared and read only: `src/miniature/**`, `src/scene/layout.ts`, `assets-src/village`, `assets-src/trunk`).

## Files (all of the part, nothing else was touched)

- `assets-src/village-spring/build.mjs`: makes `spring/village-spring.glb` (meshes `turf`, `growth`, `water`), `village-turf.lin.tile.png`, `village-water.lin.tile.png`. Seeded `rng(5171)`.
- `assets-src/village-spring/RECIPE.md`: the recipes (rows for `ASSETS.md` are below).
- `assets-src/tree-spring/build.mjs`: makes `spring/tree-blossom.glb` (meshes `blossom`, `twigs`, collider balls in `extras.balls`). Seeded stream `tree-spring`.
- `assets-src/tree-spring/RECIPE.md`.
- `src/seasons/spring/miniature.ts`: wiring of the part (`prepare`, `build`, `innerLights`, `collider`); no `standIns`.
- `src/seasons/spring/mini/palette.ts`: every colour of the part.
- `src/seasons/spring/mini/tree.ts`: trunk and blossom materials, lamp light on wood and blossom, the crown's solid.
- `src/seasons/spring/mini/village.ts`: turf, growth, pond and wall materials, halos, `innerLights`, the season's solid.

## Make targets, in order

`npm run make -- village-spring`, `npm run make -- tree-spring`, then `npm run texpack`, then `npm run build`.
The shared `village` and `trunk` are already built on `main`. `main` tracks `assets-full/` and `public/assets/`; after a make my outputs show as modified tracked files. Never commit them. Before merging `main`: `git checkout -- assets-full public/assets`, merge, then make both, texpack, build.
A still refuses to render if `dist/` is older than the source ("dist/ does not match the source"): run `npm run build` after every source change.

## Constants a successor should know

`src/seasons/spring/mini/village.ts`
- Lights in `innerLights`: `LAMP { power 3.4, reachMm 13 }`, `WINDOW { power 1, reachMm 8 }`, `SIDE { power 0.9, reachMm 7 }`. The light grid bakes from these; the mist (spring_air's) is lit by them, so a higher lamp power floods the mist in front of the cottage.
- Near light added in the shaders: `NEAR.lamp { 5.6, 9.5 mm }` on the ground, `NEAR_WALL.lamp { 4.8, 12 mm }` on the cottage, `NEAR_GROWTH.lamp { 5, 8 mm }`.
- Cottage: `WALL_FILL 2.6` (key fill that hardly depends on direction; the rig key comes from the right and the crown shades the cottage, so without it the walls go near black), `STONE_LIFT [1.5, 1.36, 1.18]` on stone albedo, `SLATE.tint [2.2, 3.1, 3.8]` plus `SLATE_BASE [0.03, 0.036, 0.046]` on the roof slopes (picked by normal and height), `MOSS_FROM [-16.8, -15]` keeps moss off the low stones.
- Island bank (the skirt that rolls down the glass, surf kind 2): `SKIRT_FILL 3.4`, `BANK_TINT [0.95, 0.74, 0.5]`, `BANK { wide 0.24, wideMm 1.5, mid 0.63, midMm 0.65, fine 1.9, fineMm 0.18 }` drives `bankHeight()`, a 3D noise that gives the bank its bump and its tone. Boulders are surf kind 3 with `ROCK_FILL 2.4`; roof moss is surf kind 1.
- Pond: `MIRROR { lamp 3, pane 1.4, tight 0.0022, wide 0.035, wideShare 0.03, bump 1, lowMm 3.4 }`, `STREAK { strength 20, side 0.045, along 0.6, bump 0.06, rings 0.9 }` (the lamp's long reflection), `RING_SHOW 0.85`, `RIPPLE { waveMm 4.4, heightMm 0.21, reachMm 16, laps 5, chopMm 0.016, drift 2 }`, `WATER_LOOK.sky 0.52`.
- Halos: `HALO_KIND.lamp { size 4.6, rest 0.42, hot 0.07, bloom 0.3 }`. `rest` is the share shown outside the storm; `hot` is a core that is not scaled by `rest`. `LAMP_GLASS [9, 5.6, 2.3]`.
- `solid` (the distance field): shared solids without ground and pond, plus shrubs, the ground with the shore dip, the water surface at `pond.level` 0.55 mm under the mound, and the boulders. Petals rest on ground and water.

`src/seasons/spring/mini/tree.ts`: `LAMP_ON_WOOD { power 22, reachMm 13, wrap -0.3 }`, `LAMP_ON_BLOSSOM { power 5 }`; `solid` is the trunk plus the crown's balls, kept clear of the petal emitters.

`src/seasons/spring/mini/palette.ts`: `bark [0.16, 0.122, 0.104]`, `blossom [1.17, 0.98, 1.07]` (multiplier on the vertex tones), `room [1, 0.47, 0.11]`, `waterPale [0.55, 0.46, 0.48]`, `moss [0.16, 0.24, 0.045]`.

`assets-src/tree-spring/build.mjs`: `CROWN { centre [1.2, 29.5, 1], r [22.5, 15.5, 15], floor 14.2, sprays 114, spacing 4.9, reach 13, inner 0.5, layer 5.0, layerJitter 2.5 }`, `CLUSTER { step 1.35, size [0.95, 1.5], tip [1.4, 2.0], flowers [8, 12], flower [0.62, 0.98] }`, `TONES` seven pale pinks, `SHADE [0.72, 0.62, 0.65]`, `HEART #d86a8a` mixed 0.64 toward the petal tone; cluster light `(0.6 + 0.4 open) * (0.76 + 0.24 depth)`, each flower times `0.82 + 0.3 R`.

`assets-src/village-spring/build.mjs`: ground net 400 around, 40 out, 30 down the skirt; `SKIRT { cycles 6.5, deepMm 2.8, clumps 17, clumpMm 0.85 }`; tulips `TULIP_TALL 0.64`, cup height `2.0 + 0.6 R`, cup radius `1.02 + 0.22 R`; turf map 1024 px, water map 512 px.

## Measured

- Triangles: `village-spring` 224,372 (stage 1: 272,140), `tree-spring` 129,550 (stage 1: 166,990). 84,208 fewer than stage 1. `/root` never sent spring's triangle numbers, so nothing was added.
- Size after texpack, miniature files in `public/assets/spring/`: 8.57 MiB of the 9.5 MiB allowance (`village-spring.glb` 5,722,376 bytes, `tree-blossom.glb` 2,302,588, `village-turf.lin.tile.webp` 587,214 and its `.first` 231,182, `village-water.lin.tile.webp` 117,176).
- Tree print: 112 sprays, 643 clusters, 7,027 flowers, 101 collider balls, box -22.3 13.6 -15.2 to 23.6 49.3 17.0 mm. Village print: ground highest -17.25 mm at x -18, z -49 (told to spring_air for the mist).
- `npx tsc --noEmit` clean; `npx vitest run`: 432 passed, 4 skipped (436).
- `npm run determinism` (02:36 UTC, on my last change, before the last merge of `main`): `determinism: pass · 3 pictures, 4 page loads, preview, draft, 311 s`.
- `npm run measure -- --unit spring --only M2,M3,M6 --tier draft` at 02:27 UTC: M6 pass on all six stills (0 of 102,000 particles inside a solid at rest, 26 in the shake, 0.000255 against 0.002). M2 red on rest, shake and settled (0.0515, 0.0577, 0.0516 against 0.03) and green on interior (0), base, surface: I mapped the soft pixels of the rest still and all 14,991 lie in rows 920 to 1018 of 1080 across the left and right of the frame, which is the tabletop, not the miniature. M3 red: 0.6685 against 0.75 (base 0.669, miniature 0.678). Raising the flower to flower contrast in the crown did not move the miniature number (0.679 to 0.678), so the crown is not what holds it down; the mist and veil over the miniature are the likely cause, not tested.
- Looks used: 40 of 40. The last picture I saw is the rest hero at 02:31 UTC (`main` as merged at 02:17 UTC plus my last crown change); the four pictures in this branch are crops of it. The tip `8df335b` adds 30 later commits of `main` that I did not see rendered. The shake (`--state landed`) was last seen at 02:08 UTC: the storm hid most of the miniature then, lamp and windows glowed through.
- `--diag standins` on the rest hero at `8df335b`: 0 marked pixels (counted from the file, not viewed). Every material of the part has `standIn: false`.

## What is still wrong, worst first (pictures in this branch)

1. The island bank (`1-whole-frame`, `4-pond`): a wide green band under the scene. The approved shows low moss lumps lit warm. The camera sits lower than the approved, which is spring_air's rig; within this part the next step is a stronger catch light on `bankHeight()` lumps and tufts of grass geometry along the rim.
2. The crown (`3-tree`): one dense dome, wider and flatter than the approved, few gaps and few bare twigs at the edge. Next step: fewer, longer sprays at the edge (`CROWN.sprays`, `spacing`, `reach`) and a taller `CROWN.r[1]`, watching the glass (box top is 49.3 mm).
3. M3 miniature 0.678 against 0.75 (not a picture; see Measured).
4. Roof and walls (`2-village`): roof darker and flatter than the approved slate; wall stones even and a little yellow. Both are tints on the shared grain (`SLATE`, `STONE_LIFT`); the shared model has no single slates to catch light.
5. Pond (`4-pond`): rings fainter than approved; the lamp streak is there. `RING_SHOW`, `RIPPLE.heightMm` are the knobs; resting petals cover part of it and are particles.
6. Tulips (`2-village`, `4-pond`): smaller and thinner than the approved clump by the trunk.
7. Stepping stones are shared geometry and mostly hidden by grass and resting petals; not changed.

## What I tried that did not work

- Geometric lumps on the bank: the skirt's normals point outward and down (the island sits in the lower half of the sphere), so they take no light and do not show. Tests on "up" give nothing there.
- The turf tile's texture bump on the bank: reads as a regular waffle grid. Bump off: a smooth plain wall. The procedural `bankHeight()` noise is what holds now.
- Saturated blossom tones: in shade they turn into crimson flecks. The tones are pale on purpose; pinkness comes from `tones.blossom`.
- Lamp halo `rest 0.5` with `hot 0.4`: a blob that hides the lantern.
- `npm run fit` renders a different picture (`...-rig.png`) than the plain still. Judge with `npm run still`.
- Dark or crimson petals on the pond and the roof are particles (the `ids` diag shows them magenta), not this part.

## Rows for `ASSETS.md` (I may not edit it)

- `spring/village-spring.glb` | code only | `npm run make -- village-spring` | `assets-src/village-spring/build.mjs`, seed `rng(5171)` | recipe in `assets-src/village-spring/RECIPE.md`
- `spring/village-turf.lin.tile.png` | code only, seeded noise | `npm run make -- village-spring` | same run
- `spring/village-water.lin.tile.png` | code only, seeded noise | `npm run make -- village-spring` | same run
- `spring/tree-blossom.glb` | code only | `npm run make -- tree-spring` | `assets-src/tree-spring/build.mjs`, stream `tree-spring` | recipe in `assets-src/tree-spring/RECIPE.md`

## Line for `parts/PARTS.json` (I may not edit it)

`{ "name": "miniature-spring", "owner": "spring_mini", "branch": "agent/p4-spring_mini", "commit": "8df335b", "files": ["assets-src/village-spring/**", "assets-src/tree-spring/**", "src/seasons/spring/miniature.ts", "src/seasons/spring/mini/**"], "standIns": [] }` (take the field names from the row that is already there; only the commit changes from my stage 1 line)

## Useful commands

- `npm run still -- --season spring --state rest|landed|settled --camera hero|interior|base --tier draft --format hd --force` (hero about 55 s, interior about 70 s); output in `out/work/stills/`. `landed` is the state to put beside `spring-shake.png`.
- Diags: `--diag standins|ids|texels|cover|change|lightgrid|normals`.
- One render at a time; never make, texpack or build while a still renders.
