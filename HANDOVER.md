# Fall's air, handover

Branch `agent/p6-fall-air`, with origin/main f4df90d1 merged.

## What is in it
- `src/particles/draw/looks.ts` and `src/particles/draw/cards.ts`: sparks at rest as fine points with a few soft discs near the glass, thinned by place in the picture; leaves smaller, fewer maple shapes, a gold share; bats smaller, level at rest, without the warm rim. The storm's values are kept and mixed in by the gust.
- `src/seasons/fall/glass.ts`: at rest a pale glow far behind the scene between the cottage and the tree (`hazeMid...`), zero in the storm since it scales with the rest haze. The storm's fog is as on main.
- `kinds.ts`, `veil.ts` and `config/showcase.json` are as on main.

## Read at hd, review tier (shares of warm pixels in three bands of luma, then the three boxes)
- Approved: 9.9, 4.9, 1.8; 69,71,60; 51,49,47; 56,54,43.
- Before: 14.4, 6.3, 2.3; 32,33,29; 76,59,42; 67,49,37.
- After (on main f4df90d1): 9.0, 5.7, 1.6; 70,71,61; 44,45,41; 50,45,39.

## Still short of the approved, worst first
1. The upper air is darker than the approved (about 37 against 48). The fog is drawn after the particles (renderOrder 5.5 against 5), so a grey air there veils the bats. The next step is a back haze drawn before the particles.
2. Fewer sparks than the approved (about 1600 peaks against 2372, the lower left thinnest), paler and more even than its orange points.
3. Leaves are still more, smaller and flatter lit than the approved's few.
4. The low fog at the left is saturated green where the approved is pale grey. Four bats against three.
## Not done
- The change into fall at film frame 2116: fall's tree shows pale through the fog (and the cottage and the fence at 2122), where winter's snow at 676 hides all. Tried in the fog's shader: `amp` plus `floodPeak` times the fourth power of `uFogTurn.y`. At 0.15 the crown still shows, at 0.35 a few flecks of it, at 0.6 nothing (frames 2116, 2120, 2124, draft), and the eight M4 and M5 lines stayed green. But the same term holds while fall leaves: at frame 2840 it lay green over winter and winter's miniature showed through, which main does not have. So it is reverted (9d7c815b). The mend is to let the term hold only for the season that comes (`moment.arrived < 1` in `update`, by a new uniform), then read shake-3 and shake-4 again. At 0.6 the globe is a flat green ball at the peak, since the fog is drawn over the leaves.
- On the head with the hand's inertia (f4df90d1) only fall at rest was drawn again (review) and tsc and vitest run. Strict, M3, the eight M4 and M5 lines, determinism, the landing, the shake sheets and the other seasons' bytes were read on earlier heads and not again on this one.
