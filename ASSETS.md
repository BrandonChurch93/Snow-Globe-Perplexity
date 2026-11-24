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

## Third-party files

| File | What it is | Source URL | License | Date added |
| --- | --- | --- | --- | --- |

None yet.
