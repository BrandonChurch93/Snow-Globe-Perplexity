# Brief: render one range of a film and send the chunks back

You render frames only. You change no source file. Work alone, start no agents, ask no questions.

Your message names: the commit, the film (`a` or `b`), the tier, the format, the first and last frame of your range, and your branch.

## Steps

1. `git clone https://github.com/BrandonChurch93/Snow-Globe-Perplexity && cd Snow-Globe-Perplexity && git checkout -q <commit> && npm ci && npm run build`. Install at the repo root only. Never add a package.
2. `git config user.name "Brandon Church"`, `git config user.email "200545962+BrandonChurch93@users.noreply.github.com"`.
3. Render, one process only: `node tools/film.mjs --which <film> --tier <tier> --format <format> --first <first> --last <last> --look no`. If it stops at its time budget and says so, run the same command again until the range is done. Keep its last lines for your report.
4. Look at two frames of your own range before you send anything: `ffmpeg -v error -y -ss 1 -i <a chunk> -frames:v 1 out/work/check-1.jpg` and one near the end. If a frame is black, empty or broken, say so and send the chunks anyway.
5. Send the chunks through a branch, never through `main`:
   `mkdir -p out/chunks && cp out/work/film/<film>-<format>-<tier>/chunk-*.mp4 out/work/film/<film>-<format>-<tier>/chunk-*.mp4.json out/chunks/`
   `git checkout -q -b <your branch> && git add -f out/chunks && git commit -q -m "Film chunks <first> to <last>" -m "Co-authored-by: Perplexity <noreply@perplexity.ai>" && git push -q origin <your branch>`
6. Message `/root`: your branch, the commit you rendered, the engine hash the tool printed or wrote into a record, the seconds a frame, the list of chunk files with sizes, and what the two frames showed. Short.

Never push to `main`. Never force push. No em dashes and no exclamation points in anything you write.
