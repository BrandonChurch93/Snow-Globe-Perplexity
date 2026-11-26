# Job: `strict_checker` · no branch of code, a report

Read `tools/briefs/p6/COMMON.md` (the part on the strict rule and "How to work"), `tools/README.md` on `strict`, and `tools/lib/strict.mjs`.

Clone `main`, `npm ci`, `npm run build`. Then, one render at a time:
1. `npm run strict` (all eight judged keys under `pow`, `all+smooth` and `all+smooth+noguard`, preview, draft). Keep everything it prints.
2. For every row that says `FAIL` or that moved more than 8 pixels: find out whether an open case is met or the wrappers alone moved a last digit. Run the same key with `--modes <mode>+dry` (the same wrappers answering what the plain function answers), with `<mode>+as0` and `<mode>+asbig` (an open case answers 0 or 1e30). An open case that reaches the picture gives three different pictures with steps far above one level; a moved last digit gives steps of one level in a handful of pixels in all of them. If an open case is met, narrow it with `pow~text` and `pow#a-b` as `tools/lib/strict.mjs` describes (or by adding the function's own narrowing on the pattern of pow), name the shader source file under `src/` and the line, and say what the fix is. Do not change anything under `src/`.
3. The same through the app's own path for the four rest keys: `node tools/strict.mjs` has no live flag yet; add `--live high` to it on the pattern of `tools/still.mjs` (this one tool file is yours: `tools/strict.mjs`), push it on the branch `agent/p6-strict`, and run it.
Report to `/root` in one message of at most 25 lines: the engine hash, the last line of each run word for word, the table of rows (key, mode, pixels that differ, largest step), every open case found with file and line, and what you did not run. Limit: 2 hours.
