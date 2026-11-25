# Handover: summer miniature (summer_mini3, third set, Phase 4)

Branch `agent/p4-summer_mini3`; looks `agent/p4-summer_mini3-looks`. Files: `assets-src/village-summer/**`,
`assets-src/tree-summer/**`, `src/seasons/summer/miniature.ts`, `src/seasons/summer/mini/**`.

## Make targets, in order
`npm run make -- tree-summer`, `npm run make -- village-summer`, `npm run texpack`, `npm run build`.
(Before merging main: `git checkout -- assets-full public/assets`.)

## Where things are
- `src/seasons/summer/mini/tree.ts`: crown (`LEAF`, `LEAF_VARY`, gold rim light), wood, lanterns (`LANTERN`: `rib`, `ring`,
  `body`, `core`, `tight` shape the paper and its hot core; `dim`, `stepS`, `rampS` are the timing after a landing: floor
  0.4, one lantern every 0.23 s, each over 0.42 s, the last of ten fully up at 2.49 s; summer_air3's pool of light begins
  at 2.4 s). `update()` turns `moment.sinceLanding` into the level; nothing else moves it.
- `src/seasons/summer/mini/village.ts`: sand bed (`SAND`: mid grain, relief from `sandRelief` through `dFdx/dFdy`, lip),
  turf (`GRASS_LOOK`), the pond bank's stones (`PEBBLE`, `turfPebble`, `turfBankAt`: Worley stones in the turf shader, lit
  with their own tone `turfPebTone` because vertex colour multiplies `diffuseColor` after `map_fragment`), water (`WATER`:
  shore film `shoreFrom`/`shoreTo`), roof and chimney (`ROOF`), wall and fence variation (`stoneVary`), windows
  (`DARK_PANE`, the `look` passed in `lights()`), lantern light on the wall (`NEAR_WALL.paper`).
- `assets-src/village-summer/build.mjs`: ground (`topAt`, `TURF.sandMm` and its fbm make the ragged lip), grass tufts
  (per-tuft `own()` hash gives `lit` and `deep`), roses and climbers, stepping stones, sunflowers (`sunflower()`).
  Changing how many times `R()` is called moves everything generated after it; use position hashes for new variation.

## M3 (the measured item)
`out/work/bin/m3map.py` (not in the repo; copy in `tools-not-in-repo/` on this branch) reproduces the miniature's M3
ratio from a still and the ids view and prints it by region. Detail under about 2 px (0.3 mm at hero hd) is gone at the
final tier's 24 samples; features must be 3 px or more. The mask leaves out trunk, lanterns and lamp post. Draft reads
about 0.1 higher than final; only final counts.

## Not mine, still wrong (told to /root)
- The air behind the crown is dark where the approved image is bright haze (summer_air3's backdrop); much of the
  approved image's fine energy is leaf silhouette against that haze.
- Chimney height, roof rows, wall courses, the fence's open rails, the arch, the lamp post's shape: the shared model.
- A clipped red-white dot in the pond's reflection at rest is a particle (absent at settled).

## Traps
- An undeclared GLSL name breaks a shader silently: look at a still after every shader edit.
- One render at a time; never make/texpack/build while a still or a measure renders.
