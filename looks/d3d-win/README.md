# Pictures from a hosted Windows machine, Direct3D 11

Kept for the eye of the build thread. Nothing here is a reference and nothing here goes to main.

| file | what it is |
| --- | --- |
| `fall-rest-hero-hd-draft.png` | the guard still of fall at rest, as the still tool wrote it, 1920 x 1080 |
| `fall-rest-hero-hd-draft.png.json` | the record the still tool wrote beside it |
| `film-b-002160-walk.png` | film B frame 2160 from the shader walk, 960 x 540, one sample |
| `film-b-002440-walk.png` | film B frame 2440 from the shader walk, 960 x 540, one sample |
| `film-b-00....png.json` | the record of each walk picture |

- drawn from: branch `agent/p6-handoff`, commit `efc79dfbe30e7a596b81145653955d3d3631043c` (main `c369d390c49912310002f15f1b1154ff91f7cb02` merged, which holds `c481d73e`)
- engine hash read in that clone on the Windows machine: `144059cb99b0d134`
- run: GitHub Actions run 46105654728, job windows-shaders, machine `windows-latest` (win25-vs2026 20261123.321.1), no graphics card
- drawn by, as the shader walk of the same job read it: `ANGLE (Microsoft, Microsoft Basic Render Driver (0x0000008C) Direct3D11 vs_5_0 ps_5_0, D3D11)`
- browser: Google Chrome for Testing 158.0.8127.89
- the still's line: `npm run -s still -- --season fall --state rest --camera hero --tier draft --format hd --force --local`
- sha256 of `fall-rest-hero-hd-draft.png`: `8bf6c29be01c38d8e4cacabe1ea42893e6e76c0dad206f3390fa621bdb6738cf` (3,659,464 bytes)

The still tool's record does not hold the card's own string. The string above is the one the shader walk read
minutes earlier in the same job, on the same machine, in the same browser. The still's own output carries the
warnings of the Direct3D shader compiler (X4000, X3595), which no other compiler writes.
