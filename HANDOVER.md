# HANDOVER — spring_air3 (Snow Globe, Phase 4, season spring: glass dressing, veil, rig, backdrop, particle rows, arrival timing)

Branch `agent/p4-spring_air3` (code), `agent/p4-spring_air3-looks` (this branch). Make targets: none (shader and value work only).

## Files and what lives where
- `src/seasons/spring/veil.ts` — the storm of the shake (STORM shader, `stormAt`), the mist at rest (`updateMist`, `mistAt`), the warm glow round lamp and tree, the pocket above the crown, the trunk window.
  - Flood release: `releaseLanding 0.88`, `releaseEarly 0.6` — the cover the swap needs holds inside the swap window (frames 648–683) and is let go mostly within the set down. `floodDrawn 0.8` makes the flood's colour follow streaks and lanes (alpha untouched, so M4 holds).
  - Landed storm: `upright`, `axisAt`, `layer`, `top`, `near`, wash (`washEven`, `washGap`, `washPond`, `washTrunk`), crown veil (`crown*`), flare (`lamp*`, `flareTint`, `flareZ` keeps the glow behind lamp post and trunk), `pocket*`, `trunk*`.
  - Mist beat: `riseAfter 1` s, then `riseSeconds 5`, `thinSeconds 7`.
- `src/seasons/spring/glass.ts` — dew, beads, runs, the film with `rill` (runoff lines on the key shoulder), `sheen`, `caustic`. `afterLanding 0.6` s delays every glass beat after the landing.
- `src/seasons/spring/backdrop.ts` — slate-blue falloff (`room`, `floor`), left-shoulder `OVAL` projected for the hero camera, warm right spill.
- `src/seasons/spring/arrival.ts` — order and timing of the beats only. `JUMP_LEAD 0.05` s puts the petals' first burst on the landing frame. `setJump`, `setPool`, `FLOW`, `trickle` are bases3's (slab.ts, base.ts).
- `src/globe/shell.ts` — only `glassLook.bubble.seasons: ['winter']` and the `visible` line (decision 90). Winter rest and landed hero stills are byte-identical before and after.
- `src/particles/engine/kinds.ts` — rows `petal`, `mote` only. The row has no trail length field; trail draw is `src/particles/draw/**` (kinds3).

## Beats after the landing (kit/02, spring), as built
0 s: petals on the table jump (lead 0.05 s) and the first water runs (`FLOW.startSeconds 0.12`, bases3). 0.6 s: dew and beads begin to form, first runs slide from about 0.7 s. 1 s: mist begins to rise. Storm thins from the end of the swap window through 0.5 s after the landing.

## Lessons
- GLSL reserved words (`patch`) break a shader silently; run `node out/work/bin/dbg.mjs 2>&1 | grep -i error` after shader edits.
- Runoff lines seen face-on read as white wires; they read as water only at the grazing shoulder toward the key, dark and bright edged, as a family.
- A gain on mist colour saturates; cover is what matters. The glow must sit behind lamp post and trunk so they silhouette.
- The crown "cloud" in the landed hero is the crown veil of veil.ts (without it the tree shows branches); the approved image asks for the pale crown, so it stays, thinner.
- Tried and failed (spring_air2 and here): shared veil as storm mist, long sinuous trails, thick dawn mist at rest, even haze everywhere, fog ball between cottage and tree, fast petal sink, dark curling run lines.

## Tools (in the clone, not committed): `out/work/bin/` `tris.mjs`, `dbg.mjs`, `side.py`, `boxes.py`, `top.py`.
Commands: `npm run -s fit -- --season spring --tier draft --format hd --state rest|landed --box 858,99,1964,1205 --name <n> --force`; `npm run -s seq -- --first N --last M --step K --tier draft --format hd --look no`.
