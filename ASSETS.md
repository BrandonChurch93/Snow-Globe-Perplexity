# Assets

Every file in this repo that the build did not make itself, and the terms of every tool whose output ships. `kit/06-ASSETS.md` has the rules.

## Approved images

Made by the reference run on 2026-11-23 with Seedream 5 Pro, approved by Brandon the same day. Listed in `references/approved/README.md`. Their prompts and inputs are in `references/drafts/round2/`.

## Generated images

The terms of each image model, read in Phase 0.

| Model | Source of the terms | Date read | Published video | Public website |
| --- | --- | --- | --- | --- |
| Seedream 5 Pro (made the approved images) | BytePlus General Terms for AI Services, Service Specific Terms and Acceptable Use Policy. Volcano Engine Ark terms read as the other possible route | 2026-11-24 | Not clear. Allowed with conditions if the calls go through BytePlus (keep AI labels, say that the content is AI generated). Not clear if they go through Volcano Engine. Which route the tool uses is unknown | Same as video |
| Nano Banana 2.1 and Nano Banana Pro | Gemini API Additional Terms, Google APIs Terms, Generative AI Prohibited Use Policy, Google Cloud Service Specific Terms section 20 | 2026-11-24 | Allowed with conditions: follow the Prohibited Use Policy, and an invisible watermark is in every image | Same as video |
| GPT Image 2.6 Flare and Sunburst | OpenAI Services Agreement, Service Terms, Usage Policies, Sharing and Publication Policy | 2026-11-24 | Allowed with conditions: for social media, review each picture, attribute it to the company, and show that it is AI generated | Allowed with conditions. Whether the disclosure rule covers a website is not clear |
| Every model, through the image tool of this product | Perplexity Enterprise Terms, Enterprise Agentic-Specific Terms, Terms of Service for individual plans, Acceptable Use Policy, Help Center article on images | 2026-11-24 | On an Enterprise Pro or Enterprise Max account: allowed with conditions (do not remove watermarks or metadata, do not claim the pictures are made by hand, follow the model providers' terms). On an individual plan: personal, non-commercial use only | Same as video |

Every quote, with its URL and the page's own date, is in `references/terms/images/TERMS.md`. This is a record of what the terms say, not legal advice.

- No provider claims ownership of the output (stated). None says in so many words that commercial use is allowed, and none forbids it for pictures.
- The model the build prefers for everything new that ships: Nano Banana Pro and GPT Image 2.6, whose terms allow both uses with conditions. Seedream 5 Pro is used only where a picture has to match the approved images closely, and that is logged in the part's recipe.
- The account this build runs on has organization skills, so it belongs to an organization (measured). Which plan that organization is on was not measured.

### Generated pictures that feed shipped files

Each has its recipe, with the full prompt, beside it. None shows a person, a hand, text or a logo.

| Picture | What it feeds | Model | Reference crop | Takes | Recipe | Date |
| --- | --- | --- | --- | --- | --- | --- |
| `assets-src/trunk/bark-take1.png` | The bark sheet of the tree's trunk and limbs (colour and the height the normal map is taken from) | Nano Banana Pro through the image tool of this product | `references/approved/winter-rest.png`, x 1490, y 700, 170 by 190 px | 1 made, take 1 kept | `assets-src/trunk/RECIPE.md` | 2026-11-24 |
| `assets-src/tree-winter/needles-take1.png` | The foliage sheet of winter's tree | Nano Banana Pro through the image tool of this product | `references/approved/winter-rest.png`, x 1340, y 360, 440 by 340 px | 1 made, take 1 kept | `assets-src/tree-winter/RECIPE.md` | 2026-11-24 |

## Generated sounds

The terms of the sound tool, read in Phase 0, each line marked as stated by the terms, measured, or unknown. Then one row for every kept sound.

The tool is ElevenLabs, on the Creator plan (measured from the account on 2026-11-24). Pages read 2026-11-24, contract pages dated 2026-10-09. Every quote is in `references/terms/sound/QUOTES.md`, with a summary in `references/terms/sound/SUMMARY.md`.

- A. Sound effects inside a film and inside an app: allowed on a paid plan, as long as the sound is combined with other material. Stated.
- B. Sound effects kept as separate files in a public repository: not allowed. The terms forbid making output available "as isolated audio files or samples". Stated. This repo is public (measured), so no generated sound file is committed. The app ships its short sounds as one packed file.
- C. Music in a video a company posts on social media: not clearly allowed on this plan. The plan allows commercial use "except film, TV, radio, and Studio Games", and "film" is not defined. The same table marks the plan as for individual use only. Stated for both limits. Unknown: whether a company's social video counts as "film", and what individual use covers. Listed under "For Brandon to decide".

| Cue | File | Tool and model | Takes | Date |
| --- | --- | --- | --- | --- |
| `glass-clink` | `audio/kept/glass-clink.wav` | ElevenLabs sound effects, POST /v1/sound-generation, the default model (eleven_text_to_sound_v2), PCM at 48 kHz | 2 | 2026-11-24 |
| `ui-sound-on` | `audio/kept/ui-sound-on.wav` | ElevenLabs sound effects, POST /v1/sound-generation, the default model (eleven_text_to_sound_v2), PCM at 48 kHz | 1 | 2026-11-24 |
| `ui-tick` | `audio/kept/ui-tick.wav` | ElevenLabs sound effects, POST /v1/sound-generation, the default model (eleven_text_to_sound_v2), PCM at 48 kHz | 1 | 2026-11-24 |

## Third-party files

| File | What it is | Source URL | License | Date added |
| --- | --- | --- | --- | --- |
| `public/fonts/jost-latin-wght-normal.woff2` | Jost variable font, weight axis 100 to 900, latin subset, font version 3.710, 232 glyphs, 26576 bytes, sha256 7726a5cd6f3c0e876c028ea2a643d45f7aad4b0f164b70966c669f4a4668f4b9. The typeface of the interface and the probe page. Not subset or converted here: it is the file as the package publishes it | https://cdn.jsdelivr.net/npm/@fontsource-variable/jost@5.3.0/files/jost-latin-wght-normal.woff2 (npm package `@fontsource-variable/jost`, version 5.3.0, file `files/jost-latin-wght-normal.woff2`) | SIL Open Font License 1.1, text in `public/fonts/OFL.txt` | 2026-11-24 |
| `public/fonts/OFL.txt` | The license text for Jost: "Copyright 2020 The Jost Project Authors" followed by the SIL Open Font License 1.1. 4384 bytes, sha256 1af3438a4d5f0ed2bdbc5751a5a67ebf6d537334161184b7fbb68503ef0ea0c5 | https://raw.githubusercontent.com/google/fonts/392d8403c9bcff1bdb011c16a24b0d5436eb35d0/ofl/jost/OFL.txt (repo `google/fonts`, path `ofl/jost/OFL.txt`, pinned to the last commit that changed the file) | SIL Open Font License 1.1, this file is the text | 2026-11-24 |

Both downloads were compared with the files here on 2026-11-24 05:35 UTC and are byte for byte the same. The font was looked at in the interface stills before it shipped.
