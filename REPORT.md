# Report: fall miniature (`miniature-fall`), by `fall_mini`, 25 Nov 2026, 02:42 UTC

- Branch `agent/p4-fall_mini`, last commit `5e12700` (merge of `origin/main` at `192ccf3`), pushed 02:33. Looks branch `agent/p4-fall_mini-looks`; its tip holds this file and `HANDOVER.md`.
- Stand-ins and fallbacks: none left. `standIns` is empty, nothing carries `userData.standIn`, the stand-in view is black over the part (0 of 94,111 pixels). No generated picture, no photograph.

## Still wrong, worst first, as a viewer would rank it
1. Pale, soft ember puffs lie over the miniature: they hide the cottage front and trunk in the macro and sit as a cloud in the crown in the hero (pictures 09, 07). Not my files (particle drawing and kinds): first seen after I merged `main` at `5d9b6fe`; my hero look of 02:14 did not show them.
2. Ground and pond are dim and soft; the approved ground is crisp with a pale stone path, a tall dark fence and rock (picture 07). Most of the M3 gap.
3. Trunk reads as a smooth dark cone; the approved trunk has deep lit ridges. Shared trunk, shared bark map.
4. Limbs thinner and straighter than approved (shared limbs under my boughs and twigs).
5. Dark contour stripes on the sloping ground at both front corners: the fog's sheets cutting my slope (`fall_air` told 01:36).
6. Lamp glow smaller and paler than the approved amber lantern; pond wider and plainer than approved.

## What I built
- Tree: boughs, twigs and spikes with real thickness on the shared limbs, 58 ember bulbs with halos that light the twigs near them, 9 tree lights in the light grid.
- Village: purple and green panes (gable, side, attic), two carved pumpkins lit from within (by the door, under the tree), lit lamp, leaning fence, lighter mossy stone and shingle tones, pale path stones, two gravestones, 1700 fallen leaves and a litter map, 190 grass tufts, dark pond with a green light and the lamp's reflection, skirt to radius 56.4 mm.
- Distance field: village and tree solids, ground and fence in it. M6: 0 of 102,000 particles inside a solid at rest.

## Make targets, in order
`npm run make -- village`, `npm run make -- trunk` (shared), `npm run make -- village-fall`, `npm run make -- tree-fall`, then `npm run texpack` and `npm run build`.

## Tests run and what they printed
- `npx tsc --noEmit`: clean. `npx vitest run` (02:32): 32 files passed, 1 skipped; 432 tests passed, 4 skipped.
- `npm run determinism` (02:22): `determinism: pass · 3 pictures, 4 page loads, preview, draft, 341 s`.
- `npm run measure -- --unit fall --only M2,M3,M6 --tier draft` (02:28): `13 of 19 lines, 6 red`. M6 passes in all six stills. M3 miniature 0.537 against 0.75, red (base 0.606). M2 red in five stills, every soft pixel on the slab, none on the miniature.
- Sizes: miniature files 7.76 MiB of 9.5; village-fall 247,818 triangles, tree-fall 36,546 (88 more than at the 00:57 notice).

Looks used: 37 of 40. Everything else is in `HANDOVER.md`.
