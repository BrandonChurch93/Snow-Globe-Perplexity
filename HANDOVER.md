# Handover: spring's base (phase 6, second list)

Branch `agent/p6-spring-base`. Files: `src/seasons/spring/base.ts`, `assets-src/base-spring/build.mjs`, `layout.mjs`, `RECIPE.md`. Assets to make again: `npm run make -- base-spring`, then `npm run texpack -- --group spring` (texpack also rewrites `public/assets/spring/village-spring.glb`, which is not this job's; restore it with `git checkout`).

## What stands
- Cobbles: cells of about 9.4 by 6.6 mm in `voronoi`, domed by distance to the seed, blurred 0.75 mm. Dark and damp in the shader (`baseStone`, `ROCK.fill` 0.7, `ROCK.lustre` 0.15 for the soft sheen on their upper faces).
- Moss on the whole flank: three sources in `build.mjs`, the greater of them wins. `patch` (noise at 26 by 4 a turn plus the joints), `seam` (the joints alone, at 0.55), and `shelf` (whole cobbles capped where `lies` is over 0.63). The lip's band is `drape` with the tongues of `DRIPS`. The cover map is mostly moss with stones showing through; lower the three thresholds for more stone.
- Moss shade: the fill (`ROCK.mossFill` 4.2) has a floor of 0.3 and follows the moss sheet's height, so the shaded moss stays green instead of black. The low sun on the right is tinted green on moss so it does not read as warm.
- Flecks: the moss's share of the low sun is `(0.8 + 1.8 * liveTuft) * 1.6` (was `0.3 + 7.0 * liveTuft`) and the lit tip is `1.7 + 2.1 * liveTuft + 1.5 * liveFuzz` (was `1.0 + 14.0 * liveTuft`). The dew's lines are the mender's and untouched.
- Roots: only the twigs of `ROOTS`, thicker (stout ones by 1.3), long curves with little fine wiggle, four wanderers in front; dark grey brown wood with moss on their backs (`baseRootMoss`).
- Trickle: `TRICKLE_WIDTH` 3.4 to 5.6 mm. The channel under it is dark wet stone and the moss grows ragged into it; the ribbon itself is nearly clear with thin bright edges (`rimline`, added after the edge fade) and streaks.

## What is short of the approved picture
- The base's outline is a drum; the approved one tapers and bulges. Not in this job.
- The lip's lit band is still broader and brighter than the approved thin rim (brightest row about 105 117 60 against 70 73 45), and it has no row of bright beads. Lowering it further costs the M3 line: the lip's moss carries much of it, where the approved has its fine detail in the sunlit right side.
- The flank's p90 and warm bright share are above the approved (77 against 66, 0.14 against 0.12).
- The roots on the sunlit right are darker than the approved tan ones.
- The trickle has few glints at its foot.
- The stones read a little even and olive beside the approved dark wet cobbles.

## How to look
`npm run still -- --season spring --state rest --camera hero --tier review --format hd --force`, then crop (560,640,1380,1020) beside the approved picture scaled to 1920. The detail line: `npm run measure -- --unit spring --only M3 --force --tier review`.

## At 3840 in motion (film frames 1100 to 1103, final)
The camera moves the base by 1 to 3 pixels a frame there. Each box laid on its neighbour by whole pixels, luminance; mean change a frame, the 99th percentile of the change, and the share of pixels that change by more than 24 levels. Before is df49a7e6, after is the second list.
- moss at the lip: before 9.3 to 10.3, p99 58 to 62, 10.3 to 12.1 percent; after 5.5 to 6.4, p99 38 to 44, 3.3 to 4.9 percent
- lit moss on the right: before 9.8 to 10.4, p99 59 to 62, 10.6 to 12.0 percent; after 8.2 to 8.6, p99 48 to 49, 7.0 to 7.7 percent
- stones: before 1.4 to 1.8; after 2.1 to 2.5. Roots: before 2.9 to 3.2; after 2.7 to 3.0
- water: before 3.3 to 3.9, p99 35 to 42; after 4.5 to 5.1, p99 60 to 63 (the bright edges and streaks of the trickle are one to two pixels wide)
In picture 04 the same leaflets keep their place and their brightness through the four frames. Four frames are not the film: nobody has watched this at 60 a second. If the right flank still crawls there, lower `(0.8 + 1.8 * liveTuft) * 1.6` in `base.ts` again; the M3 line then needs form on the sunlit right (lit roots against dark gaps, as the approved has) to stay over 0.75.
