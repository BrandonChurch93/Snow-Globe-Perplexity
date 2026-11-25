# Report: fall miniature, third set (`fall_mini3`)

Times are UTC, 25 Nov 2026. Branch `agent/p4-fall_mini3`, tip `946f650` (merge of `origin/main` `de1c404`; last change of mine `6ac1efd`). Looks branch `agent/p4-fall_mini3-looks`.

## What I was asked and what I did

Took over at 05:38 from `fall_mini2` (merged at once). My files only: `assets-src/village-fall/**`, `assets-src/tree-fall/**`, `src/seasons/fall/miniature.ts`, `src/seasons/fall/mini/**`.

Commits of mine (merges left out), oldest first:

- fc1668e, 52dfa56, be9959c, c6d23ac: thin lit glints on the bark ridges (`barkHook`), wall stone tone curve, door, timber and roof tones, lamp on the near wall.
- 60b96c9: pond takes the teal of the lit fog.
- af36b77: lighter flagstone tops over dark sides, deeper pumpkin grooves.
- b947ba1: an open crown, fewer terminal twigs and no spikes.
- 269430d: weathered slates with lit lower edges, flat warm flagstones, lighter side wall (two baked bounce sources).
- c6f3593: slimmer limb sleeves and upper stem.
- daeeed5: pond less saturated (the approved grey-teal), roof tone nearer the approved slate.
- 2945de7: crown inside the interior frame (M1), thinner crown with 26 lights instead of 36, tall grass on the island's front rim through the fog, panes with a dim room, a hot centre and grime.
- 6ac1efd: wet dark stone along the pond's waterline, contact shade under the pumpkins and along the fence.

## Round 13 issues in my files

- M1 `fall-interior`, miniature touches the frame edge: fixed in 2945de7 (`CEIL` in `tree-fall/build.mjs`). The draft measure on 6ac1efd prints "pass M1 fall-interior ... the miniature, 410661 pixels in the ids view, stays clear of the edge of the frame".
- M3 `fall-rest`, miniature 0.279 at final on e39ec6c: at FINAL tier on main c3aab2a + fall_air3 2dd31bf + my 323cfce the line printed base 0.407 over 172,715 px, miniature 0.572 over 103,397 px. Still short of 0.75. fall_air3 measured its fog's share at 0.041 (review tier); the rest of the gain is my surfaces.
- R1 #3 (crown): thinner (end twigs 0.3 to 0.7 a joint, sleeves thinner), 26 lights, crown no longer reaches the top of the interior frame. Not done: "restore the heavy twisted trunk silhouette" beyond what the ridged sleeve gives; the trunk below the fork is the shared trunk (read only) and is about twice the approved's width at the hero.
- R1 #4 and R3-2 #1 (green slab): split agreed with fall_air3 at 07:43. Mine: tall grass on the front rim standing through the fog, dark soil and contact shade under pumpkins and fence, wet stones. The lit band itself is fall_air3's low fog (thinned and darkened in its 2dd31bf). Not done by me: stones on the front slope, fallen leaves on the fog-covered rim beyond the 230 litter leaves already there.
- R3-2 #10 (no visible pond): the pond is grey-teal with the lamp's sheen and reads at the hero once the fog over it is thinned; its outline is shared and unchanged.
- R3-1 minor (waterline): rim stones are dark and smooth from the waterline up 0.85 mm on the water's side (6ac1efd). Seen at hero rest draft hd: a dark foot under the far shore's stones; subtle at this size.
- Jury, windows: `PANE { room 0.45, drape 0.3, hot 1.0 }` plus dark grime in the shared pane's frost slot. Seen: bars read, centre hotter than corners. Still more even than the approved's panes; the pane shader (`src/miniature/glow.ts`) is shared.

## Seen with my own eyes, and not seen

Seen, all at `--tier draft --format hd`: hero rest (many times, the last on 6ac1efd with fall_air3's `glass.ts` laid over as a diagnostic and once with main's own glass); interior rest (on 2945de7); macro rest (on daeeed5); landed hero and settled hero (on 507e651).

Not seen: base, surface and low cameras after 05:38; medium and low tiers; anything at review or final tier as a picture (only the M3 number at final); interior, macro, landed and settled after 6ac1efd (the change is to rim stones and soil colour only).

## Measures and tests

Last full run on my tip 6ac1efd (before the merge of main de1c404, which changed no source), `npm run measure -- --unit fall --only M1,M2,M3,M6 --tier draft`, 482 s, 19 lines, 1 red:

- M1 passes on all six views; `fall-interior`: "the miniature, 410661 pixels in the ids view, stays clear of the edge of the frame" (it touched at Round 13).
- M2 passes on all six views (0 soft pixels).
- M6 passes on all six views (`fall-shake` 6 of 102,000 particles inside a solid, 0.000059 against 0.002).
- M3 `fall-rest` FAILS: 0.4532 against 0.75; base 0.665 over 172,715 px, miniature 0.453 over 99,020 px. This is with main's own fog. Draft readings run above final ones on the base and the fog decides much of the miniature's.
- M3 at FINAL tier on main c3aab2a + fall_air3 2dd31bf + my 323cfce (local merge, 500 s): 0.407; base 0.407 over 172,715 px, miniature 0.572 over 103,397 px.
- `npm run determinism` on 6ac1efd: `determinism: pass · 3 pictures, 4 page loads, preview, draft, 344 s`.
- `npx tsc --noEmit` clean; `npx vitest run` 432 passed, 4 skipped (on 946f650).

## Triangles

- My files at the start 251,880 / 69,093 / 48,194; now 247,610 / 64,336 / 45,210 (village-fall 214,584 / 42,623 / 32,999; tree-fall 33,026 / 21,713 / 12,211).
- Season: 1,599,251 / 928,916 / 412,980 against 1,800,000 / 1,100,000 / 600,000 (on 6ac1efd, main's air and base).

## Looks

39 of 40 used. Every look at draft hd with the approved crop beside it.

## Not fixable in my files (owners)

- Trunk width below the fork, cottage size, yaw and place, slate and wall stone size, pond outline: shared geometry (`src/miniature/**`, `assets-src/village`, `assets-src/trunk`), read only.
- Pane recess and pane shader: shared `src/miniature/glow.ts`.
- The low fog band, the fog over the cottage and tree, the key light: `fall_air3`. Leaves, embers and bats in front of the miniature: `kinds3` and `fall_air3`.
- Main's own fog (c3aab2a) is much heavier over the miniature than fall_air3's branch: my replica of M3 at draft reads 0.475 with main's glass and 0.625 with fall_air3's 2dd31bf glass over the same build.
