# render/: the stamp of the render handoff

This folder is what `RENDER-ON-YOUR-PC.md` and `tools/handoff.mjs` check a machine against.
Nothing here is read by the page or the build, and nothing here changes the engine hash.

| file | what it is |
| --- | --- |
| `PLAN.json` | written by hand: the reference frames with their boxes, the stretch of the short test, the floors, the sha256 of the two final mixes, where the opening pack comes from, the sizes the disk plan counts with |
| `STAMP.json` | written by the tool: engine hash, commit, tier and samples, what drew the references, every reference with its files and sha256, the floors, the opening pack and the mixes by sha256, the delivery names, the sample count of every frame, and `releasedForFinalRender` |
| `refs/` | the reference pictures, lossless WebP: for each frame one half size whole picture (1920 x 1080, each pixel the mean of its 2 x 2 block), two full size cuts of 960 x 540, and a small record |
| `opening-pack/` | the two files of the opening pack, copied byte for byte from the commit the plan names |

## Who runs what

The machine that renders runs only the seven words of `RENDER-ON-YOUR-PC.md`. It never runs `stamp`.

The one who releases the film runs `stamp`, in the cloud, on Linux, in a clone with `npm ci` and a build done.

## The one command

```
node tools/handoff.mjs stamp
```

It draws every reference frame that is not in `refs/` for the engine hash of this tree, at 3840 x 2160 and the
masters' tier, with the count of samples the master tool gives that frame (`tools/shutter-frame.mjs`, which keeps the whole PNG; the master tool
deletes its PNGs). It reads the opening's frame from the pack. It copies the pack's two files from the commit named
in `PLAN.json`. It writes `STAMP.json` with `"releasedForFinalRender": false`. It prints what it wrote and ends with
PASS or FAIL.

On a cloud helper of four cores a frame of 24 samples took two to three minutes and a frame of 96 samples a little
over six (measured when this was written). Eleven frames in one go are about an hour. To split the work over helpers, give each helper its frames:

```
node tools/handoff.mjs stamp --only film-b:120,film-b:675,film-b:720
node tools/handoff.mjs stamp --only film-b:1000,film-b:1440,film-b:1720
node tools/handoff.mjs stamp --only film-b:2160,film-b:2440,film-b:2880,loop:0,opening:450
```

Each helper commits its files of `render/refs/` and nothing else. When all are merged, one more
`node tools/handoff.mjs stamp` finds every frame there, draws nothing, and writes the stamp (about ten seconds).

## The switches of `stamp`

| switch | what it does |
| --- | --- |
| `--only what:frame,what:frame` | makes the references of these frames only and writes no stamp |
| `--again` | draws the frames again though their references are there for this engine hash. References of another engine hash are always drawn again, with or without it |
| `--proof` | writes a stamp though frames are missing, and lists them under `stillToDraw`. The render refuses such a stamp, whatever else it says |
| `--released true` | sets `releasedForFinalRender` to true. Refused while a frame of the plan has no reference of this engine hash |
| `--released false` | sets it back |
| `--local` | draws in the installed Chrome instead of the pinned browser. Not for the references of the release |

## At the freeze, in order

1. Merge everything that moves a picture. Run `npm ci`, the build, and read the engine hash.
2. `node tools/handoff.mjs stamp` (or the split above on helpers, then one plain `stamp`). Every reference is drawn
   again by itself, because the engine hash is a new one.
3. Look at `render/refs/*-half.webp`. They are the pictures the render must match.
4. Check the floors in `PLAN.json` (`floors`, and `floorsFrom`, which says what they were measured on).
5. `node tools/handoff.mjs stamp --released true`
6. Commit `render/` and push. The commit that holds the released stamp is the one the machine clones.

`releasedForFinalRender` is a hard gate in the tool: while it is false, `node tools/handoff.mjs render` refuses with
"the film is not released for its final render yet; step 1 only". The engine hash of the clone must equal the stamp's,
so a stamp cannot be released for one tree and used on another.

## Limits

All of `refs/` is at most 40 MB, and no file here is over 45 MB. The tool refuses to write more.

## The floors

`floors` in `PLAN.json` are what a frame drawn on the render machine must reach against its reference:

| floor | what it holds |
| --- | --- |
| `psnrWhole` | PSNR in dB of the half size whole picture |
| `coarseWhole` | PSNR in dB of the means of 8 x 8 blocks of that picture, which forgives a shift of one pixel |
| `psnrCut`, `coarseCut` | the same two for each full size cut |
| `glassLuma` | how far the mean brightness of a glass region may lie from the reference's (0 to 1) |
| `glassWhite` | how much more of a glass region may be near white than in the reference (0 to 1) |

`floorsFrom` says which runs on which renderers they were set from, and with what margin. Each floor lies between
the lowest a right picture reached on the test renderers and what a picture from an engine one small mend apart
reached. When the floors are changed, the numbers in step 1.5 of `RENDER-ON-YOUR-PC.md` are changed with them (a
test of `tests/handoff.test.ts` holds the two together), and the stamp is written again.
