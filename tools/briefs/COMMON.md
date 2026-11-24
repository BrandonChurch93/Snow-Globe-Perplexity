# Brief for every supporting build agent

You build one piece of a larger build. Work alone. Start no agents of your own. Ask no questions: decide, and say what you decided in your report.

## Setup

- `git clone --depth 1 https://github.com/BrandonChurch93/Snow-Globe-Perplexity && cd Snow-Globe-Perplexity && npm ci`. Install at the repo root only. Never run `npm install` in any other folder. Never add a package and never edit `package.json` or `package-lock.json`: the npm script lines you need are already there, pointing at the files you will write.
- `git checkout -b <your branch>`, `git config user.name "Brandon Church"`, `git config user.email "200545962+BrandonChurch93@users.noreply.github.com"`.
- Every commit message ends with the trailer line `Co-authored-by: Perplexity <noreply@perplexity.ai>`, exactly once.
- Push only your own branch. Never push to `main`. Never force push.
- Read first: in `AGENTS.md` the sections "The workspace", "Git", "Conventions", "Sound" and "Assets"; all of `kit/05-ARCHITECTURE.md`; `tools/README.md`, which lists what the page gives the tools; then the kit sections your own brief names.
- `npm run build` once, so the harness has a `dist/` to open. Build again after you change anything under `src/`.

## Rules

- You own only the files your brief lists. Edit nothing else. If something outside them has to change, say so in your report with the exact change.
- Every number, id and name that `config/showcase.json` holds is read from it: in tools with `loadConfig()` from `tools/lib/paths.mjs`, in `src` with `import { config } from './config'`. Never write one into code.
- Tools are Node 20 ESM files in `tools/`. Reuse `tools/lib/`: `page.mjs` (`Session`, `renderStill`, `stillSpec`, `writeWithRecord`, `recordMatches`), `paths.mjs`, `looks.mjs` (`addLook`), `compose.mjs` (`limits`, `fitForModel`), `pixels.mjs`, `hashes.mjs`, `browser.mjs`. Read an existing tool such as `tools/still.mjs`, `tools/crops.mjs` or `tools/determinism.mjs` before you write yours, and follow its shape.
- Every output goes under `out/work/`, which git ignores, with a record beside it as the existing tools write one. A command reuses an output only when its record matches the current engine hash. A command that can run longer than `sandbox.chunkBudgetMinutes` works in chunks and carries on where it stopped when it is run again. It checks free disk before it renders.
- `src` is TypeScript, strict, with `noUnusedLocals` and `noUnusedParameters`. Almost no code comments. No `Math.random`, `Date.now` or `performance.now` in anything that affects a computed pixel.
- No em dashes and no exclamation points in anything you write. No model names.
- One render process at a time in your VM. The browser is the pinned one the harness launches, with software WebGL.
- Before every push, `npx tsc --noEmit` and `npx vitest run` are clean.
- Heartbeat: push your branch at least every 25 minutes. If you rendered pictures in order to look at them, also push the newest of them, at most 4, as JPEG at most 1200 px on the long edge, with a `captions.txt`, to an orphan branch named `<your branch>-looks`.
- Time: aim for 60 to 90 minutes. The hard limit is 3 hours. At the limit, push what you have and report.

## Report

When you are done, or at the limit, send one message to `/root` with: your branch, the last commit hash, what you ran to test the work and what it printed, anything unfinished or uncertain, rows for `ASSETS.md` if you added a file you did not write yourself, and what you looked at. Keep it short. Your work is verified through the harness after you report, so say plainly what does not work yet.
