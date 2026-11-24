# audiomap_builder · branch `agent/tools-audiomap`

Also read: "The audio map" in `kit/05-ARCHITECTURE.md`; in `kit/01-FILM.md` "Timing" and "Music".

You own: `tools/audiomap.mjs`, `tools/lib/beats.mjs`, `tests/audiomap.test.ts`.

- `tools/audiomap.mjs --file F [--approved]`: decode with `ffmpeg` to mono PCM, then in pure Node: a spectral flux onset curve, a tempo from its autocorrelation and a second tempo from a comb filter or the inter-onset histogram, a beat tracker by dynamic programming, bar lines from the accent pattern at `film.beatsPerBar`, sections from loudness and spectral change, each with its start, end and average loudness, and the start of the loudest section. No Python library is needed and none is installed.
- The two checks that need no ears: the beat spacing is steady inside each section, and the two tempo methods agree. If they do not agree after three tries with different settings, write a grid at the tempo that fits the music's length in whole bars and mark the map `grid`.
- Output: `{version, file, sha256, seconds, method: 'tracked' | 'grid', bpm, beatsPerBar, beats: number[], barLines: number[], bars: number, sections: [{start, end, loudness}], loudestSectionStart, checks: {...}}`, times in seconds. With `--approved` it writes `cut/AUDIO-MAP.json`. Otherwise `out/work/audio/maps/<name>.json`.
- The test of Phase 2: make click tracks with `ffmpeg` at known tempos (for example 100 and 87 beats a minute, one with an accent on every fourth click, one with a quiet section in the middle) and show the map finds the tempo within half a beat a minute, every beat within 20 ms, and the bar lines on the accents. `tests/audiomap.test.ts` runs the pure parts on synthesized samples made in code, so the unit tests need no `ffmpeg`.

Report the commands, the tempos found and the largest beat error.
