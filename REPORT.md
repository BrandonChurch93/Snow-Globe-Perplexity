# REPORT — spring_air3 (season spring: glass dressing, veil, rig, backdrop, particle rows, arrival timing)

Branch `agent/p4-spring_air3`, last commit `7e17e45` (merge of `origin/main` 790721d over `39f807c`). Looks branch `agent/p4-spring_air3-looks`. Make targets: none.

## Commits
- `c151e0a` film on the glass, first landed glow
- `c7b5273` landed storm thinned, crown veil
- `6682a25` Round 11 R1 issues 1, 2, 5, 6, 11 first pass (storm axis, wash broken with pond and trunk gaps, warm glow, rivulets, sheen, caustic, slate-blue backdrop with left oval)
- `0d69030` rivulet family on the key shoulder, crown veil thinner, pocket above the crown, larger warm flare, rest haze tighter
- `b8f3da3` shell: the oval bubble is winter's only (decision 90); winter rest and landed hero stills byte-identical before and after (rest f6a5bfd6…681bf9, landed 06ce7056…5bf0cd)
- `39f807c` R4 #4 flood thins inside the set down and is drawn as streaks; R4 #5 beats staggered; R4 #8 first burst on frame 720

## Issues, as they stand (what I saw at draft hd)
| Issue | State | Seen |
|---|---|---|
| R1 1 severe, landed storm | part | landed hero: scene, lamp post, trunk and pond glint read; pocket above the crown. Trails are still thin white crossing hairs with few petal heads (trail draw is kinds3's) |
| R1 2 severe, dome | part | crown oval gone (b8f3da3); shoulder sheen and lower-left caustic drawn. The broad white upper-right strip is the shared shell's, unchanged |
| R1 5 major, rivulets | part | a family of thin runoff lines on the upper right shoulder; few, thin, no pendant drops |
| R1 6 major, pink veil | part | warm haze localized at lamp and tree, dark depth above the landscape; lower globe still paler than approved boxes in places |
| R1 11 major, backdrop | fixed except right mass | slate-blue falloff and left oval back; right side sparser and whiter than the approved peach mass (shared disc layout) |
| R3 part 1 severe, peak swirl bands | not re-seen | my storm changes apply; no still at the set-B-01 camera rendered after them: unseen |
| R4 oval | fixed | b8f3da3 |
| R4 #4 major, flood flat fill | part | frames 688/704/720: 688 streaked but nearly closed, 704 scene visible, 720 scene and gaps. Frame 648 seen after the push: it is still winter's storm (a white swirl with streaks, winter frozen), so the white part of the fill is not spring's. Frames 660–683 (spring's side of the swap) not re-rendered: unseen; spring's cover there is unchanged in alpha, colour now streaked |
| R4 #5 major, beats | timing done | 0 s jump and first water; 0.6 s beads form; ~0.7 s first runs; 1 s mist rises. Seen at 720, 738, 756 only; later beats (bead growth, mist) not looked at in the film: unseen. Rest hero unchanged by it (boxes equal to before) |
| R4 #6 major, waterfall | not done | shape and `FLOW` timing are in base.ts (bases3); arrival.ts only passes the clock. Nothing changed |
| R4 #8 minor, floor-petal ring | done in timing | `JUMP_LEAD 0.05`: petals beside the base are off the surface on 720. Size of the jump is bases3's `setJump` |

## Not undone because the approved pair asks for it
- The pale crown cloud in the landed hero (approved shake image has a pale blown crown); kept, thinner.
- Cover inside the swap window (M4 needs it).

## Tests on 39f807c (merge added scorecards and status files only)
- `npx tsc --noEmit` clean; `npx vitest run` 32 files passed, 1 skipped (432 tests passed, 4 skipped)
- `npm run determinism`: `determinism: pass`
- `measure --unit change --only M4,M5 --tier draft`: M4 0.9448 / 0.977 / 0.9189 / 0.9627 (0.85); M5 0.9883 / 1 / 0.9925 / 0.9996 (0.6)
- `measure --unit spring --only M1,M2,M3,M6 --tier draft`: M1, M3 (rest 0.8115), M6 pass; M2 FAIL rest 0.0501, shake 0.0517, settled 0.0499 (0.03), surface 0.0256 pass. The soft pixels are part `surface-dressing-spring` (ids 96,251,121), slab.ts, bases3's.

## Triangles (G15), merged build at draft
My files 26,068 at every level (unchanged). Season: high 1,483,072 of 1,800,000; medium 859,779 of 1,100,000; low 389,352 of 600,000.

## Stand-ins and fallbacks
None in my files.

## Looks used (approximate)
veil-spring 29 of 40, glass-dressing-spring 26 of 40 (a fit render shows both). Besides: 3 film sheets (5, 4 and 3 frames), 2 base-camera renders for the M1 trap, macro and interior at rest, 4 winter hero stills for the bubble hashes.
