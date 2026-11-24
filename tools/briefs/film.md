# film_tools_builder · branch `agent/tools-film`

Also read: `kit/01-FILM.md`, and in `kit/07-QUALITY-BAR.md` the deliverable checks D2 to D6 and "R7 · Compression".

You own: `tools/film.mjs`, `tools/loop.mjs`, `tools/stress.mjs`, `tools/render-local.mjs`, `tools/lib/encode.mjs`, `tools/lib/frames.mjs`.

Build the commands of `kit/05-ARCHITECTURE.md`, exactly as its table and its sections "Films, chunks and disk" and "The local render" describe them.

- `tools/film.mjs`: `--which a|b`, `--tier`, `--format`, `--first`, `--last`, `--shot ID`, `--join`, `--from-hd`, `--review [--candidate NAME]`, `--mix FILE`. Frames come from `window.showcase.renderFilmFrame(i, tier)` and, for film A, `renderOpeningFrame(i)` for the frames of `opening()`. Here a film is rendered at `film.previewFps`: every frame index that is a multiple of `film.fps / film.previewFps`. One chunk per shot (or per `--first`/`--last` range) under `out/work/film/<which>-<format>-<tier>/chunk-<first>-<last>.mp4`, each with its record, encoded with the film's settings and a closed group of pictures so chunks join by stream copy. Frames are deleted once their chunk is encoded, and never more than `sandbox.maxFramesOnDisk` are on disk. A chunk whose record matches is not rendered again. The joined film is `out/work/film-<which>-<format>-<tier>.mp4`. Sound is added at the join: `--mix FILE` if given, else `audio/final/film-<which>.wav`, else `audio/mix/blockout.wav` for film B, else silent, and the last line printed says which. Film A is its opening's chunk joined in front of film B's chunks, never a second render of B. `--review` writes `out/work/review-<candidate>.mp4` (or `review-silent.mp4`) as `kit/01-FILM.md` "The review cut" defines it. A long run adds a look (one frame, with `addLook`) at least every 30 minutes, and prints one progress line per chunk with frames done, seconds per frame and the time left.
- `tools/loop.mjs`: the card loop from `renderLoopFrame`, at `deliver.cardLoop.fps` here, with `--first`, `--last` and `--join`; the loop, its web copy and the card still (frame 0) under `out/work/loop/`, named from `export.files`.
- `tools/stress.mjs`: as the table says, with stills taken from both encodes.
- `tools/render-local.mjs`: `--what film-b|film-a|loop`, `--test`, `--go`, `--proof`, as "The local render" says. `--proof` writes `out/work/local/proof.json`: the engine hash, the time, and for each result its file and what `ffprobe` reports (size, rate, frame count, codec). Opening frames may not exist yet (`opening().frameCount` may be 0): handle that by saying so, not by failing.
- `tools/lib/encode.mjs` and `tools/lib/frames.mjs` hold what these share.

Test against the scene as it stands (it is a blockout and will change): a short range of film B in `formats.preview` at `draft`, two chunks joined, `ffprobe` on the result; a few loop frames joined; `--proof`. Give the exact commands and their output in your report.
