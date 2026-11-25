# Summer miniature: final report
Part `miniature-summer`, agent `summer_mini`, written 02:43 UTC, 2026-11-25. Longer notes: `HANDOVER.md` beside this file.
- Branch `agent/p4-summer_mini`, last commit `2347819` (main merged at 02:29). Looks branch `agent/p4-summer_mini-looks`.
- Stand-ins and fallbacks left: none. `standIns` is empty, nothing drawn carries `userData.standIn`; the stand-in view was black where the part is at stage 1 (`03-rest-standins.jpg`), not rendered again since.
## Still wrong, worst first
1. Flatter than the approved image: M3 on `summer-rest` is 0.703 against 0.75 for the miniature (0.627 one merge earlier). The one red line of the summer measures I ran.
2. Grass brighter and yellower than the approved darker green.
3. No stones by the pond and the path (no triangles were added after the 00:57 mail).
4. Trunk bark faint at hero size; trunk and bark maps are shared, only tint and normal scale are set here.
5. Lanterns on the string paler than the approved orange at rest; smaller and less bright than the approved cream-yellow ones in the landed still.
6. Roof flat dark; pond paler than the approved dark water.
7. The lanterns' ripple after a landing is seen in the landed still only, not on a motion sheet.
## What was built
- A full deep green crown of 138 small clusters on the shared trunk, sprig cards on it, key-lit tops over dark undersides.
- Ten ribbed paper lanterns on a string and under the limbs, with caps and cords; they sway, kick after a landing and come up one by one from `moment.sinceLanding`, all lit by 0.54 s.
- Turf with a sand skirt, 30000 grass tufts, roses, five sunflowers, small blooms, a still pond mirroring sky, lamp, trunk, crown and cottage.
- Small lights as real lights: lamp, two windows and ten lanterns in `innerLights`; near light baked on grass, walls, wood and leaves.
- The distance field: trunk, crown, cottage, fence, lamp, shrubs, ground, sunflower stems, so seeds snag on the tree and the fence.
## Make targets, in order
`npm run make -- tree-summer`, then `npm run make -- village-summer` (shared `village` and `trunk` first if missing), then `npm run texpack`, `npm run build`.
## Tests and measures, all on `2347819`
- `npx tsc --noEmit` clean; `npx vitest run`: 432 tests passed, 4 skipped (02:31).
- `npm run determinism`: `determinism: pass`, 3 pictures, 4 page loads, 332 s (02:42).
- `npm run measure -- --unit summer --only M2,M3,M6 --tier draft` (02:36): 13 of 19 lines, 12 pass, 1 red. M2 0 soft pixels on all six stills; M6 passes on all six (shake 6 of 102000 inside a solid); M3 as in point 1 (base 3.101).
## Size, triangles, looks
- Miniature web files after texpack 8.91 MiB of 9.5; 260547 triangles, none added since the 00:57 mail (5192 taken out of the leaves).
- Looks used: 37 of 40 (stills, fits and sheets looked at; measure sheets not counted).
