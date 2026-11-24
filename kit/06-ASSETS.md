# 06 · Assets

## The approved images

Brandon approved these on 2026-11-23, as round 2 of the reference run kept them. They are pinned by hash in `references/approved/MANIFEST.sha256`.

| File | What it is the target for |
| --- | --- |
| `winter-rest.png` | Winter at rest. Key `winter-rest`. Also the anchor of the whole set: the glass, the surface, the lens and the grade are locked against it |
| `winter-shake.png` | Winter just after a landing. Key `winter-shake`. The first target for the storm |
| `spring-rest.png`, `spring-shake.png` | Spring. Keys `spring-rest` and `spring-shake` |
| `summer-rest.png`, `summer-shake.png` | Summer. Keys `summer-rest` and `summer-shake` |
| `fall-rest.png`, `fall-shake.png` | Fall. Keys `fall-rest` and `fall-shake` |
| `contact-sheet.jpg` | All eight on one sheet. Used for the first status. Not a target |

What each one fixes:

- An at-rest image fixes its season's base, glass, miniature, particles at rest, dressing, light and backdrop.
- A mid-shake image fixes how its season's storm looks half a second after a landing: how much is hidden, how the particles streak, how the inside lights show through. Everything outside the glass in it is the same as in the at-rest image.
- No approved image shows the globe in the air. The lift, the strokes and the set down have no picture. `kit/02-SUBJECT.md` section 6 and real footage are their target.

Rules:

- They are never regenerated, replaced, retouched or toned down. Stop condition 1 checks the hashes in every task.
- No pixel of an approved image is ever drawn in a frame of the app, the films or the loop as it is. An approved image may be projected onto geometry as a starting texture, as `kit/03-METHOD.md` section 4 says, and as the last resort of the fallback chain. The rough cut is the one place they are shown whole.
- `references/drafts/` is the record of the reference run. Read it, never change it. Round 1, with the globe in a room, was not approved.

### Settled differences

The reference run listed the faults of its own images. The build must not copy them.

- A key in the config may carry `settled` lines, and `settledAll` holds lines that apply to every key. Each names one point where the build differs from the approved image on purpose.
- On that point the kit wins over the image. Everywhere else the image wins.
- The match critic is given the lines word for word and told not to count them.
- Only Brandon adds a settled line, through an addendum or a note in the thread. The lines in the config now come from the faults listed in `references/drafts/round2/NOTES.md` and from what Brandon agreed in the planning chat. If you find a real conflict the kit did not foresee, pick the reading closest to the approved image, log it under "Decisions made by the Builder", and list it in the `REVIEW` block.

## Generated pictures

The approved images show each season from one side at one size. Building the parts needs more: materials close up, other sides, height.

- For a part, generate what its method in `kit/03-METHOD.md` asks for: material sheets, extra views inside the orbit limit, height pictures, patterns.
- Always pass the season's approved image as a reference, and say what must stay the same.
- At most `assets.maxTakesPerAsset` takes per asset. Pick the best, show it inline with a status, and move on.
- These are working pictures, not targets. The approved image stays the target for the part they feed.
- Keep each kept picture and its prompt under `assets-src/<part>/`.
- No picture you generate shows a person, a hand, text or a logo.

## Terms of the image tools

Generated pictures end up in shipped files here, as textures.

- In Phase 0, read the output terms of each image model you will use and write what they say into `ASSETS.md` under "Generated images": the model, the source of the terms, the date, and whether they clearly allow outputs in a published video and on a public website.
- Prefer a model whose terms clearly allow both for everything new you generate that ships.
- Do not swap, regenerate or drop anything already approved because of what you find. Build with it.
- If the terms of the model that made the approved images do not clearly allow both, list it under "For Brandon to decide" in `kit/PROGRESS.md` and in the `REVIEW` block. Nothing waits on it.

## Sounds

- In Phase 0, read the current output terms of the sound tool for the plan this account is on, with a supporting agent that keeps every quote and its source in `references/terms/`. Write what they say into `ASSETS.md` under "Generated sounds", marking each line as stated by the terms, measured, or unknown.
- Three points matter and each gets its own line: whether sound effects may be published inside a film and inside an app; whether they may be kept as separate files in a public repository; and what the music terms allow for a video posted by a company on social media.
- `AGENTS.md` under "Sound" gives an earlier reading of those terms and says where the files live in each case.
- Whatever the terms say about music, both candidates are made and offered. The reading goes under "For Brandon to decide" and into the `REVIEW` block in plain words, so he can choose with it in front of him. A track he supplies himself replaces generated music with no other change.
- The app ships its short sounds as one packed file with an index, not as separate files with addresses of their own.
- Every kept sound has a row in `ASSETS.md` and a record beside it, as `kit/03-METHOD.md` section 12 says.

## Built assets

### Sizes and formats

- Geometry: binary glTF with mesh compression where it helps. One file per part.
- Textures: the `full` set at the sizes in `assetSets.full` for the films and the judged stills, the `web` set at the sizes in `assetSets.web` for the app, in a compressed GPU format with a fallback every target browser reads.
- Distance fields, light grids and cover maps: small binary volumes or pictures, one per season.
- Colour pictures are stored in sRGB. Height, normal, roughness and every data picture are stored linear.

### Recipes

Every generated or built asset has a recipe in `assets-src/<part>/RECIPE.md`, text only, in this form:

```
## <file or group of files>
Made by: <the tool or script, and its version>
From: <every input file, with paths>
Prompt or command: <exact>
Takes: <how many were made, and which was kept>
Why this one: <one line>
Date: <the day it was made>
```

The scripts and the committed inputs must be enough to make every shipped file again.

## Third-party files

Nothing in this build has to come from outside. If something does, a font, an environment picture, a small texture:

### Where to look

- Public domain and CC0 collections first.
- Fonts under the SIL Open Font License.
- The six real photographs the reference run studied, listed in `references/drafts/round2/NOTES.md`, are for study only. Two are marked CC0 or CC BY-SA there. None is used in a frame.

### Rules

- Every file you did not make is listed in `ASSETS.md` with its source URL and license before it is used.
- Allowed: public domain, CC0, or a license that clearly permits commercial use in a published video and on a public website.
- Nothing extracted from a game, a film or a paid pack. No real brand or logo.
- Look at each one once before it ships.

## What is committed

| Kind | Committed |
| --- | --- |
| Scripts, configs, recipes, prompts | Yes |
| Shipped files under `public/assets/` | Yes, once per round after the best is chosen |
| The full asset set under `assets-full/` | Yes, inside `repo.maxFileMb` per file. A file over that is rebuilt from its recipe and not committed |
| Kept sounds, mixes, the app's sound files | As "Sound" in `AGENTS.md` says |
| Takes not kept, caches, checkpoints, frames | No. They live under `out/work/` |
| Kept stills, comparison images, sheets, the preview films | Yes, through `npm run keep` |
| Photographs from the web | Never. They live in `references/cache/` |
