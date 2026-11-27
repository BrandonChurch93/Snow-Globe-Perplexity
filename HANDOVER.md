# Fall's miniature, pass 6: handover

Branch `agent/p6-fall-scene`. Files touched: `assets-src/village-fall/build.mjs`, `src/seasons/fall/mini/village.ts`, `src/seasons/fall/mini/tree.ts`. Make target changed: `village-fall` only (`npm run make -- village-fall`; 288278 triangles, 640 leaves, 560 tufts, 20.50 MB, was 14.28 MB). `tree-fall` is unchanged.

## What changed, part by part

- Roof: fall has its own shingles in `decor` (8 staggered rows of thick slabs, each with its own width, thickness, rise and tone, a worn warm lower edge, and a ridge that sags toward the ends). The shared slates under them are bent dark.
- Walls: the shared stones are retoned per vertex to dark grey green with near black joints (`STONE`), mossed low (`MOSS`). Upright stone is broken up by the grain map read coarser through its levels (`CHIP`, a cover on the shared surface material).
- Chimney: the shared pale brick is turned to dark grey stone (`CHIMNEY`). The branch stands before the roof's branch in `autumn()`: in the other order the roof's test took half of the chimney and left it in pale stripes.
- Door: darker and greener (`DOOR`). Steps: finer mesh, speckled, darker.
- Ground: 640 leaves (were 230) with a wider tone range and a dark midrib, 560 grass tufts (were 360) with bright tips, more fill (`GROUND_FILL 8`), warmer lamp light on it (`NEAR.lamp.power 12`), a bounce on the bank and the cottage foot (`BOUNCE.bank`, `BOUNCE.side`).
- Rim stones and flags: finer mesh, stronger mottle, darker edges, brighter faces.
- Water: finer lapping and more lamp in it (`WATER`).
- Pumpkins: deeper ribs and skin mottle; halo smaller and fainter so it does not veil the door and steps (`HALO_KIND.pumpkin`).
- Fence: darker weathered wood with stronger grain, splits and end grain.
- Shrubs: per leaf tone and shade (`BUSH`).
- Tree: `BARK_RELIEF 1.25`, lamp and pumpkin light on the wood a little up. The tree's asset is untouched.

## What the number is made of

M3 is the mean squared high pass (sigma 1.5 px at hd) of the luma over the miniature's pixels, against the approved picture at the same size. It rises with features 2 to 6 px wide and with brightness squared.

- A run with the chimney half in pale stripes read about 0.74. The stripes alone carried about 0.07 of it and they are wrong against the approved chimney. They were removed, and the number fell to where it stands.
- A run with paler roof edges read 0.73; the edges were paler than the approved roof and were toned down.
- Brighter twigs and more ember light on the tree lowered the number and were taken back.
- A finer grain cover averaged out under a pixel at hd and was removed. The coarser one (`CHIP`) is kept; it adds little to the number and was looked at in one 3840 draft still, where it does not sparkle. It was not seen in motion.
- Wider shingle gaps, a wider shingle tone range and `BARK_RELIEF 1.5` changed neither the number nor the picture at hd and were not kept.

Where the number is still lost, by a 6 by 4 grid over the miniature (approved energy against build): the front wall and door 0.0062 against 0.0030; the ground in front of the door 0.0083 against 0.0034; the tree's crown 0.0038 against 0.0026; the right half of the trunk 0.0043 against 0.0018. The green fog band covers about half of the mask's bottom row and belongs to the air.

## What is still short of the approved picture

1. The wall's stones are the shared model's large stones. Their size is in `assets-src/village`, not in fall's files. Small stones in tight courses need fall's own wall mesh there, or a wall in `assets-src/village-fall` over the shared one.
2. The chimney is the shared thin brick courses in dark grey, not blocks of stone with a cap of its own.
3. The door is the shared door: it reads warm brown under the lamp and the pumpkin, not grey green planks deep in a stone arch.
4. The roof reads as thick rows more than as single shingles, and it is brighter and more orange than the approved dark brown violet.
5. The trunk shows pale diagonal glints, and its bark could only be judged through the air's ember cloud (`src/seasons/fall/veil.ts`), which lies over all of it.
6. The ground is seen at a flatter angle than in the approved picture, with the fog band over its front. Layout was left as it is.
7. The fence in front is dark and plain at hd.

## Scratch tools (not in the repo)

A replica of M3 with a per cell grid, a tone reader per box and a pair maker lived in `out/work/mine/`; they are not committed. The replica reads about 1 percent under the official number.

## Checks on the merged tree (d260e9b2, main 58687dc1 merged)

- `npx tsc --noEmit` clean; `npx vitest run`: 59 files passed, 1 skipped; 805 tests passed, 8 skipped.
- M3 before: miniature 0.534, base 0.700. M3 after: miniature 0.709, base 0.700. The line still fails: 0.6996 against 0.75.
- G15: pass, high 1714204 of 1800000 triangles in the fullest season. Fall's own count in the rest still's record at hd: 1288815 before, 1445415 after.
- `npm run determinism`: pass, 3 pictures, 4 page loads.
- The still with `--diag standins` is black (largest value 0 over the whole frame).
- Winter, spring and summer at rest, draft, hd: sha256 equal to main 58687dc1.
- Fall at `--state landed` (draft, hd) and the sheet `shake-3` (draft, 12 frames) were looked at; nothing new seen wrong at their size.

## Second list, first push (3f8a931d, on main f4df90d1)

Done: the water (dark green, one soft reflection under the lamp, no rows of glints), the leaf litter (browner, leaf by leaf) with the path's slabs lit, the door (planks, a warmer tone, warm light at its foot), the pane toward magenta, the trunk lit from the lamp's side, worn edges on the fence boards.

M3 at review fell to 0.6174 for the miniature (0.722 on main). The rows of glints on the water, the pale streaks on the bark and the flat orange carpet carried part of the earlier number; they are gone and nothing fine has yet taken their place. The loss sits on the tree (the bark) and on the water.

Still to do: the chimney's cap, rougher shingle edges, gnarled bark, the fence's uneven pickets, the pane's level and its spill, more grain on the door.

The second box of the leaves (850,615,900,640 in the built still) lies on the left pumpkin's face, so its number does not move with the leaves.

## Second list, second push (on main ad011f2b)

Added since the first push: bark ridges in the sleeve's geometry (three scales of ridge, knots, 192 around) with the lamp's gloss on the ridges and limbs, a capped and taller chimney, rougher shingle edges with more spread of tone, a lighter door with grain along its planks, smaller and darker litter, a deeper pane with more spill on the wall. The ground went from 110 to 100 rings to pay for the bark and the cap: village-fall 283,454 triangles, tree-fall 37,058; G15 reads high 1,791,317 of 1,800,000.

M3 at review: miniature 0.798 (main ad011f2b reads 0.789); the line itself still fails at 0.6996 on the base, which is not in these files.

Both generators changed: run `npm run make -- village-fall`, `npm run make -- tree-fall`, then `npm run texpack -- --group fall`.

Still short of the approved picture:
- The trunk is lit brown across its whole width; the approved one is black on its right flank with a cool rim.
- The fence is posts and rails, not pickets of uneven height; its boards have worn lit edges only.
- The pane has one cross, the approved one two bars across.
- The litter near the left pumpkin is still more orange than the approved brown.
- No leaves float on the pond. A first try at them did not show on the water and was taken out.
- The wall's stones and the door's arch are the shared model's.

## Second list, third push (on main 9c5c595c)

The trunk's flank away from the lamp is darker (less fill, less of the pumpkin's light on the wood) and the pumpkin throws less light on the litter. M3 at review: miniature 0.804. The list of what is still short in the section above stands, except that the trunk's right flank is now dark, though not black with a cool rim as approved.

## Third list (57ca3da3 on main 7e543b87)

Files touched: `src/seasons/fall/mini/tree.ts`, `src/seasons/fall/mini/props.ts`, `src/seasons/fall/mini/village.ts`, `assets-src/village-fall/build.mjs`, `assets-src/village-fall/RECIPE.md`. Make target changed: `village-fall` (282,938 triangles, was 283,454). `tree-fall` is unchanged (37,058).

- Trunk and boughs: the lamp on the wood is weaker and stands level with the trunk so it lights the lamp's flank only (`LAMP_ON_WOOD`, `LAMP_SHIFT`). The fill is a near grey green light low on the far side that fades up the crown (`FILL_FROM`, `FILL_ON_WOOD`, `SKY`). A rim is added per fragment on edges that face away from the lamp (`RIM`), fading with distance from the lamp so the twigs do not go pale. Lamp glints are a little weaker (`GLINT_LAMP.power 1.15`).
- The orange over the trunk came from fall's own lamp in the air: `LAMP` in `village.ts` lit the air 14 mm out, which reached the trunk. It is now `power 3, reachMm 10`. With it at 14 the trunk's body could not read under about 41 red with the air on, whatever the bark did.
- Fence: seven flat boards 1.95 to 2.25 mm wide and 0.6 mm thick with rounded tops (the top rows of each slab are pressed under an arc), heights 9.2 to 12.1 mm, each with its own lean. The two rails run behind the boards and tilt from board to board. Wood is darker with pale worn edges. The fence's line on the ground is unchanged. The count of random draws in the maker is the same as before, so nothing else in the village moved because of the fence.
- Litter: less of it (`LITTER`, 520 loose leaves, were 640), leaf tones in brown and rust with a few orange (`LEAF_TONES`, the tile's tones), the pumpkin lights the ground less (`NEAR.pumpkin.power 8`), the soil is a little lighter (`GROUND.soil 2.3`).
- Purple window: not changed. All three fall panes are drawn by the shared pane with one upright and two cross bars (`src/miniature/glow.ts` line 228, `fract(vUv * vec2(2.0, 3.0))`). To give the green panes one cross bar that line needs a row count from the look.

Reads, my boxes, approved against the hd review still with the air (median RGB): trunk body 25,37,24 against 25,33,21; lamp flank 83,46,24 against 72,45,23; right edge 74,77,58 against 42,48,36. The with air reads move by a few levels from run to run of the proof with the leaves in the air.

Still short: the rim on the far side is a broken line of pale ridge edges, not the even soft edge of the approved, and its median is 30 levels under. The lamp flank's ridges are broader than the approved's thin glints. The fence has no short thin pickets between the boards and is seen more end on than in the approved (the shared layout). The ground under the tree and behind the fence is darker and greyer than the approved's red brown earth. M3's miniature number rose to 1.330; what carries it was not broken down.

## After the third list: panes, M3's miniature share (f238a92e on main fe261991)

Files touched: `src/miniature/glow.ts` (by leave, the pane's bar count only), `src/seasons/fall/mini/village.ts`, `src/seasons/fall/mini/tree.ts`, `src/seasons/fall/mini/palette.ts`, `assets-src/village-fall/build.mjs`. Make target changed: `village-fall` (282,938 triangles, as before). Run `npm run make -- village-fall`, `npm run make -- tree-fall`, then `npm run texpack -- --group fall`.

- Panes: `GlowLook.lights` is the count of lights across and up; without it a look gets 2 by 3 as before, and the shader text for every other look is the same. Fall passes 2 by 2 for all three panes, because the approved shows one upright and one cross bar on the purple, the side green and the attic green pane alike. The drape's pale streaks are a second mesh over each pane (`drapeMaterial`, `purpleFolds`, `greenFolds`), kept off the bars. The casings of the two lower windows are darkened in `autumn()` (`CASING`), the attic frame in the generator (`FRAME`).
- M3's miniature share was 1.330 because of the crown and the trunk, not the fence: the pale cool rim and the blue fill sat on every bough of fall's own `twigs` mesh, and the trunk's ridges took pale edges. `barkHook` acts on `twigs` only; the trunk's body is the shared trunk mesh, lit through the baked lights list. The rim is now confined near one point (`RIM.at`, `RIM.reachMm`) and smoothed (`RIM.relief`); the body takes a near fill (`FILL_ON_WOOD`) and one edge light (`EDGE_ON_WOOD`).
- Roof: the thin pale line along each course was the worn tone painted at 0.8 on the last sixth of each shingle in `assets-src/village-fall/build.mjs`. It is now a soft band over the lower half at 0.38 (`SHINGLE.wear`) and the shingles' own tone is a little lighter. The shared slates under them are not seen, so nothing in `autumn()` changes the roof you see.

M3 at review: miniature 0.867 (was 1.330 at 57ca3da3, 1.361 on main with its air). Parts, the build's energy over the approved's inside M3's own mask: crown 1.02, trunk 1.14, roof 0.92, wall 0.83, fence 0.99, litter 0.73, chimney 0.75, the rest 0.66.

Still short of the approved picture:
- The trunk's far edge is about 25 levels under the approved's and its body about 10 red over with the air. The lit ridges are broader than the approved's thin glints; the approved has its fine light in embers and one thin edge line.
- The purple pane's darkest fifth is lighter and its brightest fifth dimmer than the approved's (95,21,88 and 220,139,218 against 80,6,83 and 244,134,236, with the air).
- Wall, litter and chimney now carry less fine energy than the approved's. The fence's boards read thin end on; no short pickets. The ground is darker and greyer. Door, wall stones and arch are the shared model's.
- The two fold meshes add 6 triangles and two draws to fall at high (G15 reads 1,789,089 where main reads 1,789,083; its largest draw count over the seasons stays 71 of 140). To take them back the folds would have to live in the shared pane shader.

## After the fifth list (b5f2f01f on main a7f9032b)

Pictures 16 to 19. Proof run on b5f2f01f itself, which holds main a7f9032b.

- Trunk: the bark's crests are narrower in the make (`RIDGE` in `assets-src/tree-fall/build.mjs`), the lamp on the wood is warmer and tighter, and a rim light fixed to the trunk's own round lifts the far edge (`RIM` in `mini/tree.ts`). With the air: flank 88,51,22, body 28,36,20, far edge 68,78,53 against the approved's 83,46,24, 25,37,24 and 74,77,58. Share of fine energy 1.09. The air of b4bc96c0 adds about 18 red and 8 green on the trunk, so the rim and the fill were cut once more after that merge.
- Purple pane: darkest fifth 85,14,80, brightest fifth 242,135,235 (approved 80,6,83 and 244,134,236). The drape has cloud patches and a thread so the streaks do not run white.
- Green panes: the side pane's glow on the stones reads 7.6, 5.8, 3.1, 2.1 at 3 to 6, 6 to 10, 10 to 15 and 15 to 22 px (approved 15.9, 9.5, 3.6, 1.2; before 12.3, 7.0, 5.0, 2.6). It is narrower at the far rings and now weaker than the approved's at the near ring.
- Ground: the approved beside the path reads 88,70,45. The build read 102,46,15 by the last post, 117,63,13 behind the fence and 112,63,19 by the pond: not darker but more orange. It now reads 42,27,16, 68,46,21 and 78,52,25. The orange is gone from the soil but the ground is now under the approved's level and still low in green and blue. This is open.
- Fence: 12 short pickets, two a gap, 44 triangles each, 528 in all, which G15 counts as 1,584 at high. Boards have a wider grain and split.
- Wall 0.95, chimney 0.96 by a steeper curve on the stones' own map. Litter stays 0.71: its box is ruled by the decor leaves and tufts, not the ground's shader, and it needs geometry there, which the triangle room does not allow now.
- Crown 1.30 and roof 1.03 rose with main's new air, not with this list.
