# summer_air3 — handover

## Where things are

- Branch `agent/p4-summer_air3` (merge `origin/main` before every push; it also holds `origin/agent/p4-change2` since
  `4fe6a11`, for `arrival.ts`). Looks branch `agent/p4-summer_air3-looks` (orphan): pictures 01–15, `captions.txt`,
  `REPORT.md`, this file.
- Make targets for my files: none.
- Triangles: my files draw 6 (the wall quad, the flare quad, the pool quad). Never add one.

## How to look

- Hero stills: `npm run build`, then `npm run still -- --season summer --state rest|landed --camera hero --tier draft
  --format hd --force` (about 60 s each; rest is 12 s after the test shake's landing, landed is 0.5 s after it).
- Against the approved pair: `npm run fit -- --season summer --state rest|landed --tier draft --box 780,40,2040,1260
  --name <n> --force` writes `out/work/fit/<n>-pair.jpg` (approved on top, ours below).
- The landing in motion: `npm run sheet -- --motion landing --shot shake-2 --seconds 4.5 --fit --tier draft --look no`
  (about 4 minutes, 12 frames).
- Measures: `npm run measure -- --unit summer --only M3 --tier draft` (90 s); `--unit change --only M4,M5` (265 s).
- One render at a time; never build or texpack while a still renders.

## The knobs, and what each one moves

- `veil.ts` `STORM.share`: how much of the storm is in the veil over the miniature while summer holds it. 0.8 leaves the
  miniature nearly clear, 1.3 ghosts it a little; the approved mid-shake is more ghosted still. M4 does not depend on it
  (the cover at the swap comes from the shared flood). `STORM.calms`: do not lower it, the shared drift bank returns as a
  cream slab over the ground.
- `veil.ts` `veil.rest`: negative on purpose. Raising the shared rest haze fogs the miniature and turns M3 red.
- `glass.ts` `look.wall.haze*`: the warm air behind the miniature at rest. The layer is drawn before the miniature
  (render order −0.25, opaque, depth test off); do not move it back into the transparent queue.
- `glass.ts` `look.wall.storm`, `stormClears`: the dome's tone in the storm. Approved upper boxes are the same at rest
  and mid-shake, so the storm adds almost nothing here.
- `glass.ts` `look.flare`: `rays`, `rayWide`, `spikes`, `bloom`. The approved image has a star on the rim, so it stays.
- `glass.ts` `look.pool.afterSeconds`, `settleSeconds`: when the pool of light arrives after the landing. They go with
  summer_mini3's `LANTERN.stepS`, `rampS` in `mini/tree.ts` (ten lanterns, last up at 2.49 s).
- `backdrop.ts` `dim()`, `CLUSTER.lift`, `room`, `floor`: colours and levels only; sizes and layout are shared
  (`src/scene/backdrop.ts`). Colour index = floor(len × (0.55·level + 0.45·pick)), list runs dimmest to brightest.
- `kinds.ts` seed row `floats`: share of the pool afloat at rest. With kinds3's drawing about a third of them show.

## Engine facts that cost me time

- Per-frame order: `updateVeil` → `draw.frame` → `kit.update` → `glass.update` → `holdStorm`. `holdStorm` therefore
  overwrites the shared veil's uniforms after they are set.
- The shared veil's haze is a ring about the view axis and fogs the miniature too; its drift, flood and bank are all
  proportional to the kit's `density`.
- `public/assets/*` show as modified after `npm run texpack`: never commit them; `git checkout -- assets-full
  public/assets` before merging.
- The clone tracks only `main`; fetch another branch by name and merge `FETCH_HEAD`.

## Open, for whoever comes next

1. Storm at the landing: decide between the critics' "solid" and the approved image's ghosted miniature, then set
   `STORM.share` (and recheck M3 at rest, M4/M5).
2. With kinds3's head drawing on main: confirm the seed count at rest (`floats 0.03`: three to four dozen) and that none
   sits before the cottage.
3. The pool's arrival in motion, with summer_mini3's lanterns, in the film's landing frames 1440–1704.
4. The upper dome at rest: the approved has darker clear areas between the reflections; mine is an even gradient.
5. The white blade and the apex oval belong to the shared shell.
