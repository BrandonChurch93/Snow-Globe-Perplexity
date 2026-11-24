# sheet_tools_builder · branch `agent/tools-sheet`

Also read: in `kit/07-QUALITY-BAR.md` "Judged stills and frames", "Packs", "R4 · Motion" and "R4 blockout"; `kit/02-SUBJECT.md` section 6.

You own: `tools/sheet.mjs`, `tools/seq.mjs`, `tools/lib/sheetlayout.mjs`.

- `tools/sheet.mjs`: a contact sheet of `critics.contactSheetFrames` frames, as the table in `kit/05-ARCHITECTURE.md` describes: `--shot ID`, `--film` (sheets across the whole film, one per shot, plus one overview), `--loop`, `--opening`, `--seasons` (the four at-rest keys), `--motion NAME`, `--tier`, `--format` (default `formats.preview`). `--motion` names: `lift`, `strokes`, `setdown`, `landing` (the first second after a landing) with `--shot` for a shake or `test` for the test shake; `arrival` with `--shot` for the hold after a shake; `move` with `--shot` for a camera move. A motion sheet shows consecutive frames at `film.previewFps` spacing, because its point is to show motion.
- Frames are rendered through `window.showcase` (`renderFilmFrame`, `renderLoopFrame`, `renderOpeningFrame`, `dev.renderTestShakeFrame`), reusing frames whose record matches.
- Layout: a grid read left to right, top to bottom, on a dark neutral ground that is not pure black. Under each frame a small plain line with the frame index and the time in seconds. That line is outside the picture, never over it. Every sheet respects the picture limits for models: `limits()` and `fitForModel` in `tools/lib/compose.mjs`, so a sheet arrives untouched. Sheets go to `out/work/sheets/` as JPEG with a record, and each is logged as a look with `addLook`.
- `tools/seq.mjs`: `--first N --last M --tier T [--format F]`, every film frame in that range as a separate picture under `out/work/seq/`, with records, logged as one look.

Test on the scene as it stands: one shot sheet, one motion sheet of the test shake, the seasons sheet, the film sheets at `draft`. Look at them yourself and fix what reads badly. Push the sheets to your looks branch.
