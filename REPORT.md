# Report: `miniature-spring` (spring_mini), written 02:42 UTC

- Branch `agent/p4-spring_mini`, last commit `8df335b` (merge of `main`; my last change is `HEAD^1`). Looks branch `agent/p4-spring_mini-looks`, this file is in its tip.
- Stand-ins or fallbacks left: none. `standIns` is empty, every material has `standIn: false`, nothing is a relief fallback. The `standins` diag of the rest hero has 0 marked pixels (counted, not viewed).

Still wrong, worst first (pictures in this branch):
- The island bank shows as a wide green band under the scene; the approved has low moss lumps lit warm (`1-whole-frame`, `4-pond`).
- The crown is one dense dome, wider and flatter than the approved, with few gaps and bare twigs at its edge (`3-tree`).
- M3 at draft is red: 0.6685 against 0.75 (miniature 0.678, base 0.669). More contrast in the crown did not move it.
- Roof darker and flatter than the approved slate; wall stones even and a little yellow (`2-village`).
- Pond rings fainter than approved; resting petals (particles) cover part of the water (`4-pond`).
- Tulips smaller and thinner than the approved clump; stepping stones (shared geometry) mostly hidden.

Built:
- The blossom crown on the shared trunk: 112 sprays, 643 clusters, 7,027 separate flowers, shaded by depth; lamp light on bark and blossom.
- Roof moss, the grass skin with a mossy bank, blades, shrubs, four tulip beds, daisies, boulders, fallen petals of geometry.
- The thawed pond: mirrors sky, crown, lamp and window, a long lamp streak, rings that spread.
- Lamp and two window lights in `innerLights`, their halos, and their near light on walls, ground and growth.
- The distance field: ground with the shore dip, water surface, boulders, shrubs, trunk, crown balls. Petals rest on ground and pond.

Make targets, in order: `npm run make -- village-spring`, `npm run make -- tree-spring`, then `npm run texpack`, `npm run build`.

Tests:
- `npx tsc --noEmit` clean; `npx vitest run`: 432 passed, 4 skipped (436), on `8df335b`.
- `npm run determinism` (02:36 UTC, on my last change before the last merge): `determinism: pass · 3 pictures, 4 page loads, preview, draft, 311 s`.
- `npm run measure -- --unit spring --only M2,M3,M6 --tier draft` (02:27 UTC): 13 lines, 4 red. M6 pass on all six stills. M2 red on rest, shake, settled (0.0515, 0.0577, 0.0516 against 0.03); all 14,991 soft pixels of the rest still lie on the tabletop (rows 920 to 1018 of 1080), none on the miniature, and M2 interior is 0. M3 red as above.

Size and triangles: miniature files 8.57 MiB of 9.5 MiB after texpack. Village 224,372 triangles, tree 129,550; 84,208 below stage 1. Spring's triangle numbers never reached me, so none were added.

Looks used: 40 of 40. The last picture I saw is the rest hero at 02:31 UTC (`main` as merged at 02:17 plus my last crown change). `8df335b` adds 30 commits of `main` that I did not see rendered. The shake was last seen at 02:08 UTC.
