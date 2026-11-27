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

## After the sixth list (c90d6ed2 on main 35d00e1b)

Pictures 20 to 25 (20 and 21 were work in progress). Tone and shading only; the made village and tree keep their counts at every level. Proof run on c90d6ed2 itself.

- Trunk: `RIM.fade` in `mini/tree.ts` ends the rim at the first fork (trunk heights 10 to 13), so the foot's far side is as dark as the body. The edge light sits higher and is tighter (`EDGE_ON_WOOD`, `EDGE_FROM`).
- Fence: the make marks every second picket black (`PICKETS[1].shown` in `mini/props.ts`, colour only in `build.mjs`), and `thinned()` in `mini/village.ts` folds black wood to one point under the ground at load. Hiding them in the make changed the medium and low counts, so it is done at load. The boards left are lowered by a third at load (`FENCE.keep`), and the landing field uses the lowered boards. Wood is grey and dark with a pale worn edge.
- Wall: `STONE` holds joints at `floor` of `top` and takes their hue away; the gable has its own tint, darker below the purple window's head and lighter toward the side wall's corner. Gable stones above the wall's top used to fall into the roof's tone branch by their upward normals; they are now stones.
- Ground: the soil's map is read through a square root so the pale specks do not stand out, and its level is down (`GROUND.soil`, `GROUND.tint`, `leaf`, `grey`). The fifth list's ground boxes sat on a fence board and on pond rocks, not on ground; the honest boxes are in the report and below.
- Green ring: a second small source at the side window (`NEAR_WALL.greenRing`) lifts the near ring only.

Measures with the air, review tier, hd (approved against build): ground 79,62,38 and 86,53,31 against 104,60,31 and 75,40,18 (build boxes 783,641 to 797,649 and 742,655 to 756,665); by the pond 28,39,27 against 31,34,19. Fence bodies 31,32,23 against 34,27,16. Gable left of the attic pane stone 52,61,48 and joint 16,24,17 against 45,65,50 and 19,23,19; right of it 46,60,41 and 16,28,11 against 51,58,39 and 30,27,18; beside the purple window 33,31,29 and 22,22,19 against 39,34,35 and 22,13,13. Side pane's rings 14.0, 5.3, 3.0, 2.3 (approved 15.9, 9.5, 3.6, 1.2).

M3 at review: miniature 0.754 (0.875 on main 35d00e1b), base 0.797. Parts: crown 1.31, trunk 1.15, roof 0.81, wall 0.56, fence 0.73, litter 0.54, chimney 0.83, the rest 0.55.

Still short of the approved picture:
- M3's miniature share is 0.004 over the bar. The wall lost almost half of its fine energy with the quieter joints and the ground a quarter with the darker soil. The next gain has to come from fine relief in the stones' own map and from the litter, not from contrast between stone and joint.
- The ground behind the fence is still 25 red over at one box and 11 to 13 under in green and blue at the other; a warm halo from the air sits on the first box.
- The upper gable reads cooler (more teal) than the approved's grey green, and its joints right of the attic pane are 14 red over.
- The fence's rails are thinner than the approved's after the lowering, and the boards' worn edge is paler and less warm (164,116,70 against 145,115,95 for the brightest tenth).
- The trunk's lit flank is 10 red over; the body under the fork is a little darker than the approved's.

## After the seventh list (671968d3 on main 7cd99d2b)

Pictures 26 to 31 (26 and 27 were work in progress). The detail is won back by form, not by contrast. No triangle is added: the made village and tree keep their counts at every level and G15 reads 1,799,613 at high as on main. Proof run on the pushed commit itself.

- Wall: the shared stones are real pillow meshes, so their size cannot change without triangles. At load the normals of each stone's face are turned to the wall's plane with a small lean to the nearer flank (`FACE` in `mini/village.ts`, in `autumn()`); the shader then reads the pillow's own normal for a thin lit upper edge, a shade under, darker flanks, a crack where the lean changes sign, and a rough face from the grain map. The cracks part some of the wide stones in two.
- Roof: in the make's colour only (`SHINGLE` in `assets-src/village-fall/build.mjs`): a dark gap under each row, a dark gap at each shingle's sides so a row reads as single shingles, and a worn lower edge of its own strength on every shingle. No new random draw, so the geometry does not move.
- Litter: a map of 760 small leaves in twelve tones; the ground's cover weight (`COVER`, `coverAt`) is separate from the leaf props' field so the props stay where they were. The open soil between fence and path now has the fence strip's density.
- Path: the path stones are part of the made decor (cobbles and three door flags), flattened at load by vertex to 0.36 of their height (`PATH`, `flattened()`), cooled toward the approved's grey brown, with dark sides. The leaves' landing field never held these stones; leaves land on the shared layout's path boxes, and the flattened tops now sit at that level.
- Fence: the posts keep 0.62 of their width at load and run to a point (`POST`, `narrowed()` in `thinned()`); their landing boards narrow with them. The pale crown is taken down in the make's colour.
- Gable: `STONE.high`, `corner`, `low`, a raised dark floor on the upper gable (`gableFloor`) and a green lift in the lower gable's joints only (`mossed`).

Counts on the approved against the build (hd):
- Courses between the purple window's sill and the eave: 7 to 8 against 7 to 8 (8.5 to 9 px each against 8 to 10).
- Side wall, joints between eave and ground: 8 to 10 in 74 px against 8 to 10 in 76 px when every dark minimum is counted; with a threshold of 2 levels the approved gives only 3 to 7, because its side wall is nearly black there. The count is not sure on the approved.
- Stones across the gable at the attic pane's height, right of the pane: 5 in 45 px against 4 to 5 in 47 px where a crack parts one (3 to 4 on the sixth list).
- Roof rows on the near slope: about 6 against 8. Shingles: about 35 px wide against 12 to 20. Both are the make's geometry and stay.
- Fence posts between the corner and the gate: 4 with one thin picket between each pair, on both. Post width 8 to 9 px against 7 to 8 (12 to 14 before).

Measures with the air, review tier, hd (approved against build):
- Gable left of the attic pane: stone 52,61,48 against 56,70,51, joint 16,24,17 against 20,19,16. Right of the pane: stone 46,60,41 against 54,56,41, joint 16,28,11 against 31,26,18 (13,16,15 without the air). Beside the purple window: stone 33,31,29 against 40,38,36, joint 22,22,19 against 22,14,13.
- Six stones of the upper gable: mean 68,78,58 against 67,76,56. Three pairs: 52,69,49 against 50,73,46; 72,76,51 against 76,72,48; 70,83,67 against 76,89,66.
- Path slabs, four boxes each: mean 134,104,85 against 135,106,86.
- Fence post tops against bodies: approved 44,22,16 over 29,29,22 and 36,29,21 over 25,28,24; build 21,17,13 over 35,28,17 and 14,12,9 over 57,34,16.
- Ground: 86,53,31 and 79,62,38 against 112,58,31 and 101,61,20. The air's halo adds 0,1,1 at the first box; the red is the litter's own.

M3 at review: miniature 0.890 (0.754 on the sixth list, 0.868 on main), base 0.805. Parts: crown 1.29, trunk 1.13, roof 0.93, wall 0.84, fence 0.99, litter 0.79, chimney 0.68, the rest 0.62. Draft stills: fall-rest 1c2ab6d89fd700c9, fall-landed b9cd8afbd474c7b7; the other six are main 82d0b882's. G15 high 1,799,613.

Still short of the approved picture:
- The wall reads 0.84 against the 0.85 aimed and the roof 0.93 against 0.95. The stones are still about 1.3 times as wide as the approved's on the gable: they are shared pillow meshes and only the cracks part them. The roof has 8 rows of narrow shingles where the approved has about 6 rows of wide ones.
- The chimney fell from 0.83 to 0.68: the flat face shading takes the pale brick faces down with the wall's. It needs its own exemption in `autumn()`.
- The ground is 22 to 26 red over at both boxes: the litter is more orange and brighter than the approved's brown leaf mould.
- Right of the attic pane the joints are 15 red over with the air and inside 10 without it; a warm glow of the air sits there.
- A band of stones over the door still reads teal against the approved's warm lit arch.
- The corner post is seen from its thin side, which is all worn edge and reads pale. The posts are pointed by a slant; at 7 times the approved's tops look rounded with a pale rim to me, so the point may be more than the picture asks.
- Fall's two draft stills on main before this change were not drawn again here; the guard list's two are taken from the root's note.
