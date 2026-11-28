# Render the film on this computer

This file is for a coding agent working on Brandon's own computer. Follow it from the top, alone.
Another agent leads the project from far away and cannot see this machine.

The film is Snow Globe Seasons. Its release files are drawn at 3840 x 2160, 60 frames a second, on the
graphics card of this computer. This file makes four files on the Desktop:

| file | what it is |
| --- | --- |
| `Snow Globe Seasons - With Prompt - 3840x2160.mp4` | the film with its opening, 4,467 frames, with sound |
| `Snow Globe Seasons - Without Prompt - 3840x2160.mp4` | the film alone, 3,600 frames, with sound |
| `Snow Globe Seasons - Portfolio Looping Video - 3840x2160.mp4` | the loop, 480 frames, no sound |
| `Snow Globe Seasons - Portfolio Screenshot - 3840x2160.png` | the first frame of the loop |

With Brandon's yes, step 2 also sends copies of them to the remote team (2.5).

On Windows, Chrome draws the film through Direct3D 11. Before this file existed, the film's pictures had been
measured on Linux only, drawn in software. Step 1 is the first time this film is drawn by a Windows graphics
card. That is why step 1 draws a little, compares it, reports and stops.

## What Brandon says to the agent

Brandon saves this file into a folder of his choice, starts the agent in that folder and says: "Follow the file
RENDER-ON-YOUR-PC.md in this folder from the top, alone and exactly as written. Do step 1 only, then stop and give
me its report."

If an agent ends in the middle of the work (its window was closed, it stopped answering, the computer was
restarted), nothing is lost. Brandon starts a new agent in the same folder and says: "Read the file
RENDER-ON-YOUR-PC.md in this folder. Do what its part If you are started in the middle says, and nothing else."

Which copy of this file rules. Brandon's saved copy starts you. The clone of 1.2 holds its own copy, in the folder
`Snow-Globe-Perplexity`. Once the clone is there, its copy rules: read it there, and read it again after the pull
of 2.1, which may bring a newer one. Carry on in the newer copy at the step you had reached.

## Rules for the agent

1. Do not edit any file of the repo. Do not repair code, shaders, settings or tests. A fault is mended by the remote
   team. A shader that does not compile is such a fault: copy its message whole into what you give Brandon.
2. Do not commit and do not push. One line of this file writes to GitHub: the upload of 2.5. Run it only after
   Brandon has said yes to it.
3. Run only the commands written in this file, exactly as written, one line at a time. Use no other switches,
   set no variables, and do not join lines with `&&` or `;`. Beyond these lines you do one thing only: you may
   open a report file this file names with your own file reader, to give its text to Brandon.
4. Ask Brandon only for a password, a sign in, or a system prompt that asks for his leave, and for what this file
   tells you, word for word, to ask him. Ask him nothing else and decide nothing for him.
5. When a line ends in `FAIL:`, look for its sentence in the table of the step you are in, and do the one thing
   that row names, as often as the row says and no more. If no row fits, or the row says stop: stop. Give Brandon
   the report whole, from the file whose whole path the tool printed in its line `THE REPORT`, and wait. Do not try
   another way.
6. Do step 1, then stop. Do step 2 only when Brandon says so in his own words, after step 1 has passed. You never
   decide that for him and you never write his words for him.
7. While a line answers `RUNNING:`, do not end your turn and do not start another line beside it. Run the same line
   again until it answers `PASS:` or `FAIL:`. If your turn ends against your will, nothing is lost: the work goes
   on, and the part "If you are started in the middle" brings a new agent back to it.
8. Change no setting of Windows, of the graphics driver or of Chrome, and no registry value. Where a report names a
   setting, it is for Brandon to change.
9. Never mix the work of two computers. Copy nothing from another machine into the clone's folder `out`. The tool
   refuses frames that another graphics card drew.

## How every command here behaves

- Work in Windows PowerShell: it is on every Windows machine. Git Bash does as well once Git is installed, and
  every line is the same in both.
- Give every command a time limit of 10 minutes (600000 ms). No command here needs more in one go.
- Each `node tools/handoff.mjs` line answers inside that limit, and its last line is one of three words and a
  sentence:

| last line starts with | exit code | what it means | what to do |
| --- | --- | --- | --- |
| `PASS:` | 0 | the step is done and good | go to the next line of this file |
| `RUNNING:` | 3 | the work goes on in the background and nothing is wrong | run the very same line again, as often as it takes. Start nothing else in between |
| `FAIL:` | 1 | the step did not pass | rule 5: the row that fits, or stop and give Brandon the report |

- Just above its last line each line prints where its files are, each by its whole path: always `THE REPORT`, and
  after the short test also `THE TEST FILM`, `THE SHEET OF PICTURES` and, when it failed, `THE FOLDER TO SEND`.
  When you tell Brandon where a file is, give him the path as it was printed. Never give a name or a folder you
  assume.
- The report is also printed, between `===== REPORT: ... =====` and `===== END OF REPORT =====`. The tool writes
  its reports itself, as plain UTF-8 text. Do not send a command's output into a file of your own.
- Long work (setup, test, render, check, upload) runs in a process of its own. If a line is cut off by a time
  limit, or the terminal is closed, the work goes on. The same line run again follows it. Nothing is started
  twice and nothing finished is done again.
- Every `node tools/handoff.mjs` line is run inside the clone's folder `Snow-Globe-Perplexity`. If node answers
  `Cannot find module` with a path that ends in `tools\handoff.mjs` or `tools/handoff.mjs`, you are not inside
  the clone. Do what "If you are started in the middle" says; it finds the folder or tells you to stop. If your
  shell forgets the folder between two commands, name the clone's folder as the working folder of each command
  in your own tool. Do not join lines to get there.
- Do not use WSL. The tool refuses to run in any Linux layer on Windows, because the film must be drawn by the
  Windows graphics driver.

### Stop and recovery, one rule

A word was stopped when its last line says `FAIL: "<word>" was stopped before it ended` (the computer slept or
restarted, a window was closed, a process was ended), or when your own command was cut off before any last line
came. For each word this table is the whole rule. The tables of the steps name the same acts.

| word | the one line that carries on | how often | stop and report when |
| --- | --- | --- | --- |
| `setup` | `node tools/handoff.mjs setup` | once more | it is stopped a second time, or it ends in any other `FAIL:` |
| `doctor` | `node tools/handoff.mjs doctor` | once more | it is stopped a second time, or its `FAIL:` has no row in 1.4 |
| `test` | `node tools/handoff.mjs test` | once more, and only when it was stopped | it is stopped a second time. A test that ended in any other `FAIL:` is never run again (1.5) |
| `render` | `node tools/handoff.mjs render`. It carries on from the last finished frames | once more after each stop | it is stopped twice with no more frames done in between (every `RUNNING:` line says how many are done), or a row of 2.2 says stop |
| `check` | `node tools/handoff.mjs check` | once more | it is stopped a second time, or it ends in any other `FAIL:` |
| `deliver` | `node tools/handoff.mjs deliver` | once more, and once more after Brandon has closed a player (2.4) | any other `FAIL:` |
| `upload` | `node tools/handoff.mjs upload`. It sends only what is missing | up to two more times | it fails three times in a row, or a row of 2.5 says stop |
| `clean` | `node tools/handoff.mjs clean` | once more | any `FAIL:` |
| `status` | `node tools/handoff.mjs status`. It only reads, and may be run at any time | as often as needed | it answers `Cannot find module` inside the folder `Snow-Globe-Perplexity` |

Two answers are no stop:

- `RUNNING:` is the answer of work that goes on. Run the same line again.
- `FAIL: "<word>" is still at work in the background` says that another word of the tool is still at work, which
  can happen after a restart of the agent. Nothing is wrong. Run the line that sentence names until it ends, then
  go on where you were. This is the one `FAIL:` that needs no report.

## If you are started in the middle

Do this when you are a new agent and the work was begun before you (Brandon tells you so), or when you do not
know where the work stands. Start nothing by a guess: not the render, not the setup.

```
node tools/handoff.mjs status
```

- It ends with `PASS: this is the clone of the film, at ...`. You are inside the clone. Its report says how each
  word last ended here, and its line `NEXT LINE:` names the one line that carries on. Read the clone's copy of
  this file, go to the step that holds that line, and carry on there by its rules. If it says `NEXT LINE: none`,
  do what the sentence beside `WHERE THE WORK STANDS:` says. Mostly that is: give Brandon a report and wait.
- node answers `Cannot find module`. You are not inside the clone. Run the line below once, then the status line
  again.

```
cd Snow-Globe-Perplexity
```

- The `cd` line fails because there is no such folder: nothing was cloned here. Begin at 1.1.
- The status line answers `Cannot find module` inside that folder too: the folder is no whole clone. Stop and
  report. Delete nothing.

## Step 1 on Windows: install, check, short test, report, stop

Step 1 draws about two seconds of the film and nothing more. It may be run before the film is released.

### 1.1 The two programs everything else needs

```
git --version
node --version
```

Good: `git version 2.25` or newer, and `v20.19` or newer of 20, `v22.12` or newer of 22, or `v24` and up.

Bad, and what to do:

- git is not found or too old. Run:

```
winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
```

- node is not found or too old. Run:

```
winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements
```

A winget line is good when its last line is `Successfully installed`, or
`No newer package versions are available from the configured sources.` (the program was there already; winget
ends with an exit code that is not 0 then, and that is no failure). Windows may show a prompt that asks for leave
to install: that is for Brandon to answer.

After a good winget line, ask for the version again. A program installed a moment ago is found only by a terminal
opened after the install. If `git --version` or `node --version` still finds nothing, or still answers with a
version that is too old, do not install again and do not look for another copy. Stop and tell Brandon, word for
word: "Git or Node was installed just now, and this terminal does not see the new one yet. Close this terminal
window, open a new one, start the agent again and give it the same task. Nothing is lost." Then wait.

If the version is still not found or still too old after that new start, an older copy on this machine comes
first. Stop and report the line and its answer. Do not remove or move anything.

If a winget line ends in anything else than the two good last lines, stop and report its last lines. If `winget`
itself is not found, stop and report that.

### 1.2 The clone

First find out where you stand:

```
node tools/handoff.mjs status
```

- node answers `Cannot find module` with a path that ends in `tools\handoff.mjs` or `tools/handoff.mjs`: you are
  not inside a clone yet. At a first start that is the answer to expect. Go on with the three lines below.
- It ends with `PASS: this is the clone of the film, at ...`: you are inside the clone already, because you were
  started again. Skip the three lines below and go to 1.3.

```
git clone --filter=blob:none --single-branch --branch main https://github.com/BrandonChurch93/Snow-Globe-Perplexity.git Snow-Globe-Perplexity
cd Snow-Globe-Perplexity
node tools/handoff.mjs status
```

Good, all three together: the clone line ends with exit code 0 (it takes a minute or two), the `cd` line gives
no error, and the status line ends with `PASS: this is the clone of the film, at ...` and the folder. That last
line is the proof that the tool stands in the folder. The clone is not judged by the words git prints.

Bad, each with the one thing to do:

| what you see | do this |
| --- | --- |
| the clone line says `fatal: destination path 'Snow-Globe-Perplexity' already exists and is not an empty directory` | the folder is here from an earlier start. Run the `cd` line and the status line. The status line says whether it is whole |
| the status line, run inside the folder, answers `Cannot find module` | the folder holds no tool: a clone that was cut off, or a folder of another kind. Stop and report. Delete nothing and do not clone again |
| the clone line says `fatal: Authentication failed`, `fatal: repository ... not found` or `fatal: could not read Username` | the sign in, below |
| the clone line ends with any other `fatal:` line or any other exit code than 0 | stop and report its last lines. Delete nothing |
| the `cd` line fails | there is no folder, so the clone did not happen. Stop and report |

Run the clone in the folder you were started in. A folder with spaces in its name is fine. Everything the render
writes goes into the clone, so the clone must lie on a drive with room: the doctor of 1.4 says how much is needed
and how much is free there. If it is too little, that is for Brandon: he starts you again in a folder on a larger
drive, and you begin at 1.2 there.

The sign in. The repo may be private by the time you read this. Then git needs Brandon's GitHub account once:

- Git for Windows opens a small window by itself that says `Connect to GitHub`. Tell Brandon, word for word:
  "A GitHub sign in window has opened. Please sign in." Wait for the clone to end. Git keeps the sign in, and no
  later line asks again.
- If no window opens and the clone ends with one of the three `fatal:` lines of the table, stop and tell Brandon,
  word for word: "The clone needs your GitHub sign in and no window opened here. Please open a PowerShell window
  of your own in this folder, run the clone line below, sign in when it asks, and tell me when it has ended."
  Give him the clone line and the whole path of the folder you are in. When he says it is done, run the `cd` line
  and the status line, and judge them as above.
- After a sign in that failed, git takes its unfinished folder away by itself. If a folder is left all the same,
  the first two rows of the table say what you see and what to do. You delete nothing; a broken folder is for
  Brandon to remove.
- What is known of this: the clone of the public repo was run on Windows and macOS test machines and asked for no
  sign in. The sign in of a private repo was tried on no test machine, because it needs Brandon's own account.

### 1.3 Setup: the packages and the build

```
node tools/handoff.mjs setup
```

Good: `PASS: the packages are installed and the build is made, engine <16 signs>, the stamp's`. A few minutes.
The 16 signs are the engine hash: a sum over everything that draws the film. `the stamp's` says it is the same
hash that `render/STAMP.json` in the clone records, so this clone draws the film the references were made from.

Bad: `FAIL:` with the reason. Stop and report.

### 1.4 The doctor: what this machine is

```
node tools/handoff.mjs doctor
```

It reads the processor, the memory, every video card with its driver, the system, the tools and the free disk from
the machine itself and prints them. It opens Chrome in a window, as the render will, and prints what draws the page.
A Chrome window opens and closes by itself. Do not touch it.

Good: `PASS: this machine can draw the film: ...` with the name of the graphics card that draws.

The doctor reads the video cards from Windows and the name of what draws from the page itself. The page must draw
on the strong card of this machine (an NVIDIA card before an AMD one, and of two cards of one maker the one with
more memory), named by the model words the system gives it. Nothing about the card is written into the tool.

A report may end with a block `TO LOOK AT`, each of its lines beginning with `LOOK`. That is no failure and you go
on. Give the block to Brandon with the report, as it is.

Under its table the doctor also prints what the shader compiler of this machine wrote about the film's shaders,
and what the graphics card answers to a list of small sums (the maths probe). Both are for the remote team. They
are marked `noted` and fail nothing: a shader that warns still compiles and draws. Only a shader that does not
compile fails the doctor, and then its message is in the report in full.

Bad, each with the one thing to do:

| the FAIL says | do this |
| --- | --- |
| ffmpeg or ffprobe is missing or too old | run the ffmpeg line below, then the doctor again |
| Chrome is missing or too old | run the Chrome line below, then the doctor again |
| the page draws in software | stop and report. The film is never drawn in software |
| the page draws on another card than the strong one | stop and report. The report says which Windows setting Brandon can change. When Brandon says he has changed it, run the doctor line again and go on from there |
| too little free disk | stop and report. The report says how much is needed |
| the engine hash differs from the stamp's | stop and report. Do not pull, reset or edit anything |
| this is WSL or another Linux layer | stop and report. Open PowerShell or Git Bash on Windows itself |
| `"<word>" is still at work in the background` | no stop: run the line that sentence names until it ends, then the doctor again |
| anything else | stop and report |

```
winget install --id Gyan.FFmpeg -e --source winget --accept-package-agreements --accept-source-agreements
winget install --id Google.Chrome -e --source winget --accept-package-agreements --accept-source-agreements
```

The doctor names one missing program at a time. If both are missing, it names ffmpeg first and Chrome after it:
install what it names, then run the doctor again, each time.

The tool looks in the places winget installs to, so after a good winget line run the doctor again in the same
terminal. If the doctor says the same thing again after a good winget line (the program is still not found, or an
older copy still comes first), do not install a second time: stop and report. A winget line that ends in anything
else than the two good last lines of 1.1 is also a stop and report.

### 1.5 The short test

```
node tools/handoff.mjs test
```

It draws a few single frames and about two seconds of the film at 3840 x 2160, at the quality of the final
render and through the same code. It compares the frames with reference pictures, joins the two seconds into a
short film, and measures how long the whole render will take here. Before it draws it prints how long the test
itself is expected to take. Chrome windows open and close by themselves. Do not touch them. The tool keeps the
computer awake by itself while it draws; you change no power setting.

It answers `RUNNING:` every few minutes: run the same line again each time.

Before you run it, tell Brandon, word for word: "The test opens Chrome windows for some minutes. Please do not
minimize them, do not lock the screen and do not start a game until I say it is done."

How the frames are compared, and why so:

- The reference pictures were drawn on a Linux machine in software. A graphics card under Direct3D 11 (Windows)
  or Metal (macOS) rounds its sums a little differently, so the same frame comes out a level or two apart in many
  pixels and further apart along thin bright edges. A frame is therefore never asked to be equal to its reference.
- Each frame is measured three ways. The whole picture at half size, and two cuts of 960 x 540 at full size, must
  each reach a floor in PSNR (how close the pixels are, in dB, higher is closer). The same pieces must reach a
  floor in a coarser measure, the PSNR of the means of 8 x 8 pixel blocks, which a shift of one pixel hardly
  moves. A region of the glass must keep its mean brightness and must not turn white.
- The floors are written in `render/STAMP.json` and printed in the report beside every number: 38 dB for the
  whole picture and 40 dB for it in blocks, 40 dB for a cut and 44 dB for it in blocks. The glass region may lie
  0.01 from its reference in brightness (on a scale of 0 to 1) and may hold half a percentage point more of near white
  (of every 1,000 pixels of the region, 5 more than in the reference).
- Why these: the same frames were drawn at 3840 x 2160 on two test machines, through Direct3D 11 on Windows and
  through Metal on macOS, and compared with the references. Each of the four floors in dB is the midpoint,
  rounded to a whole dB, between a wrong picture and the careful case of a right one, both at film B frame 720:

  | measure, in dB | wrong picture | careful case | midpoint | floor |
  | --- | --- | --- | --- | --- |
  | the whole picture | 36.83 | 39.15 | 37.99 | 38 |
  | the whole picture in blocks | 38.44 | 42.08 | 40.26 | 40 |
  | a cut | 38.42 | 41.84 | 40.13 | 40 |
  | a cut in blocks | 40.68 | 46.99 | 43.84 | 44 |

  The wrong picture is that frame from an engine one small mend apart. It fails all four floors. The careful case
  is a card that stands as far from one test machine as the other test machine does, with that distance on top of
  the one measured to the reference. On the two test machines themselves a right picture reached 40.5 dB or more
  for the whole picture, 43.1 in blocks, 43.1 for a cut and 47.9 for a cut in blocks, and its glass lay within
  0.001 of the reference. A frame that is wrong in a bigger way (a layer missing, white glass, a flat or empty
  picture) falls far under the floors. Every measure behind the table, the run that made it and how the careful
  case is worked out stand in `render/STAMP.json` under `floorsFrom`, so the floors can be worked out again.
- Some fine noise in the film (the runs of water on spring's glass, the grain of moss, the lumps of the table,
  sparkles) is worked out by the graphics card itself, and each kind of card works it out a little differently.
  Such a place looks the same in kind on every machine and has its streaks and grains at other places. So the
  film this computer renders carries its own card's pattern there, not the cloud's. Of the frames measured, the
  one with spring's wet glass stood nearest its floors, on both test machines.
- Those two test machines have no real graphics card, so no NVIDIA card was measured. No real graphics card has
  drawn a reference of this film yet: step 1 on this computer is the first time, and that is not known to go well.
- Which frames this test compares is written in `render/STAMP.json`, and the test prints it in two lines of its
  report, which begin `references kept:` and `what a pass of this test rests on:`. Give Brandon those two lines as
  they are printed. Put no number of your own in their place.
- On the two test machines these frames were measured: film B frame 120, film B frame 720, and the first frame
  of the loop on macOS alone. Every other frame was compared on Linux alone, or stands under `still to be drawn`
  in those lines and was compared nowhere. When a frame fails here by a little, the floor may be at fault and not
  the picture. You do not decide that: do what stands under `Bad` below, and the remote team reads the numbers
  and the sheet of pictures.
- What was run where. The Windows and macOS test machines last ran the commands of this file in run 46130923210
  of the workflow `handoff-proof`, at commit 463ed0cd of the repo, whose engine hash is 74660360c1965b4f. The
  setup line of 1.3 prints the engine hash of this clone. If it prints that same hash, this very build ran
  there. If it prints another, this clone holds a newer build, which was drawn and compared on Linux only and
  ran on no Windows and no macOS test machine. The remote team has said that it runs the test machines once more
  on the final build before it releases the full render.
- The report also says, for every frame, how far the picture stands from its reference: the largest and the mean
  difference in levels of 255, how many pixels are more than 8 levels apart, and where in the picture they lie.
  These lines are marked `noted` and fail nothing. They tell the remote team where to look.
- What this machine drew is kept in `out/work/handoff/compared`, and a sheet of pictures shows each frame beside
  its reference: the reference on the left, this machine on the right, with a row of cuts at full size.
- While the frames are drawn the test asks the NVIDIA card every two seconds how busy it is (with `nvidia-smi`,
  which comes with the driver) and prints the busiest reading and the most memory in use. A card that stayed idle
  while the page says it draws there is written as a `LOOK` line.
- After the two seconds of film are drawn, the test reads from each chunk's own record what drew it. It must be the
  card the doctor named. So a test that drew nothing, or drew elsewhere, cannot pass as proof of the card.
- The calibration picture. Before the test draws anything else it looks for one still picture that this machine
  draws once for a build of the film and keeps in `out/work/master`. Every finished piece of the film (a chunk)
  names that picture, and the films are joined only from chunks that all name the same one. So it is drawn once,
  by the first test, and kept. No later test and no render draws it anew or replaces it, however often the lines
  of this file are run, in whatever order, and after a restart of the computer too. You never delete it.
- The test also says, in one line of its report, whether this machine draws that picture the same twice. It draws
  a second one into its own folder, compares it with the kept one, and prints how many pixels differ and the
  largest difference in levels of any channel. The line is marked `noted`. It is no pass and no fail, and the
  second picture never replaces the kept one. What is known of it:
  - Measured: on the Windows test machines (Direct3D 11, in software) the picture came out the same every time,
    24 drawings on ten machines. On the macOS test machines (Metal) it came out another one every time, 8
    drawings and 8 different pictures. That is why it is kept and not drawn again.
  - Measured: on both kinds of test machine the short test was run again in the middle of a render, with
    finished chunks on disk, and the render line then went to its end and its films were joined and proven. On
    Windows the row for a Chrome that updated itself (2.2) was followed the same way, with chunks on disk.
  - Not known: whether an NVIDIA card or the MacBook's own card draws it the same twice. The line of this test
    says it for this machine. Whatever it says, the film is whole, because the kept picture is the one in use.

Good: the last line is one of these two.

- `PASS: the short test passed on <the graphics card>: ...`. The picture is proven and nothing stands in the way
  of the render but Brandon's word.
- `PASS: the picture passed on <the graphics card>: ... and the render is not ready: ...`. The picture is proven,
  and the full render could not start yet. The sentence says why: the film is not released yet, references are
  still to be drawn, or a final sound mix is not in the clone or is not the one the stamp names. Before the
  remote team has released the film this is the answer to expect. Say the sentence to Brandon as it is.

Above the last line the tool prints `THE TEST FILM` and `THE SHEET OF PICTURES`, each with its whole path. They
are on the Desktop. If an older one was open in a player, the new one lies beside it with `(new)` in its name,
and the printed path names it.

The sound. The two final sound mixes come with the clone: the remote team puts them into the repository when it
releases the film. The test checks both against the stamp and prints one line for each, and its film says which
sound it carries. You never ask Brandon to put a file into the clone, and you put none there yourself.

Bad, each with the one thing to do:

| the last line says | do this |
| --- | --- |
| `FAIL: "test" was stopped before it ended` (sleep, a restart, a closed window), or your command was cut off | run the same line once more. If it is stopped a second time, stop and report |
| `FAIL: "<word>" is still at work in the background` | no stop: run the line that sentence names until it ends, then the test line |
| any other `FAIL:` | the test has failed. Do what stands under this table. Change no floor and no file. Do not run the test again to see whether it passes. Step 1 ends here, and you do not go on to 1.6 |

When the test has failed, the tool has put what the remote team needs into one folder and printed its whole path
in the line `THE FOLDER TO SEND`. It is one folder on the Desktop, `Snow Globe Seasons - Test - Failed`. If the
Desktop could not be written, it is the folder `out/work/handoff/test-failed` inside the clone, and the printed
path says which of the two it is. The report says the same in its block `TO SEND`. The folder holds the report,
the numbers of the test (`test.json`) and, when the test got as far as drawing, the sheet of pictures and what
this machine drew. If the tool printed no line `THE FOLDER TO SEND`, no folder could be written: give Brandon
the report alone.

Give Brandon the whole text of the report (its path is the line `THE REPORT`) as one block. Then say to him,
word for word, with the printed path in the place of the three dots: "The short test failed. No full render was
started. Please bring this folder into the build thread: ... Whether the picture or the floor is at fault is
ruled on there." Then stop and wait.

### 1.6 Report and STOP

Give Brandon the whole text of the report of the test (its path is the line `THE REPORT`) as one block, with its
`TO LOOK AT` block if it has one. Its first three lines say in plain words whether the test passed, what that
means and what he does next. Then give him the two printed paths, of `THE TEST FILM` and of
`THE SHEET OF PICTURES`, and ask him to open both and look. Say to him, word for word: "The short test is done.
No full render was started."

On the sheet each frame stands twice: on the left the picture drawn in the cloud, on the right the one this
computer drew. Tell Brandon what to look for, word for word:

"Left is the cloud's picture, right is what this computer drew. Some things differ and that is expected: where
the runs of water stand on spring's glass, and the fine grain of the moss, of the lumps on the table and of the
sparkles. They look the same in kind and stand at other places. Four things are not expected: stripes or blocks
in that grain, an area that is flat or blank, a thing that is missing, a colour cast over the picture. If you see
one of the four, the render is not started: bring the sheet and the test film into the build thread."

If Brandon says he sees one of the four, do not go on to step 2. Whether the render is started is then ruled on
in the build thread, and you wait for his word after that.

If the report holds a line that begins `MORE THAN 10 HOURS`, say that line to Brandon first, before the block.
The test has passed all the same. Whether a render that long is started on this machine is for the remote team
to decide, not for you.

If the test could not put the test film or the sheet of pictures where it names them, it ends in `FAIL:` and
says which one. That is the last row of the table in 1.5.

STOP here. Do not go on to step 2 by yourself, whatever the report says.

## Step 2 on Windows: the full render, only on Brandon's word

Run step 2 only when Brandon has said to, and only after step 1 passed on this machine.
The render takes hours. The report of the short test says how many. Keep the computer on mains power.

### 2.1 Bring the clone up to date, then check again

```
git pull --ff-only
node tools/handoff.mjs setup
node tools/handoff.mjs doctor
node tools/handoff.mjs test
```

Good: the pull ends with exit code 0, the setup line and the doctor line each end with `PASS:`, and the test
line ends with `PASS: the short test passed on ...`. The setup line prints the engine hash of the build the pull
brought; the test is then a test of that build.

After the pull, read the clone's copy of this file again from "Step 2" on, and follow that copy from here. The
pull may have brought a newer one than the copy you were reading.

When the pull brought a new build of the film, this test draws the calibration picture (1.5) for that build,
once, and keeps it. When it brought none, the test keeps the one it has.

Bad, each with the one thing to do:

| what you see | do this |
| --- | --- |
| the pull ends with another exit code than 0 (it says `fatal`, `error`, `Not possible to fast-forward`, or it asks to merge) | stop and report its last lines. Do not merge, stash, reset or pull in another way. The remote team mends a clone that has gone apart from the repo; you do not |
| git asks for a sign in | that is for Brandon, as in 1.2 |
| setup, doctor or test end in `FAIL:` | the tables of 1.3, 1.4 and 1.5 hold here too |
| the test ends with `... and the render is not ready: ...` | do not run 2.2. Say that sentence to Brandon as it is, and that the remote team has not released the film or has not put the sound mixes into the repository yet. Wait for his word. When he says the remote team has done it, begin 2.1 again |

If the test film of step 1 is still open in a player, this test writes its film beside it with `(new)` in the
name and says so in a `LOOK` line. That is no failure.

### 2.2 The render

```
node tools/handoff.mjs render
```

It answers `RUNNING:` every few minutes with a line that says how many frames are done and when it expects to
end. Run the same line again each time, for as long as it takes. Do nothing else on this machine with the
graphics card meanwhile, and leave the Chrome windows alone.

Before you run it, tell Brandon, word for word: "The render opens Chrome windows for hours. Please do not minimize
them, do not lock the screen and do not start a game until I say it is done. If Chrome asks to restart for an
update, choose later. If you can, pause Windows updates for tonight, so that Windows does not restart the
computer in the middle. If I stop answering, nothing is lost: start a new agent in this folder and say to it:
Read the file RENDER-ON-YOUR-PC.md in this folder. Do what its part If you are started in the middle says, and
nothing else."

The tool keeps the computer awake by itself while it draws and lets it sleep again when it ends. It changes no
power setting. It never draws a finished frame twice, and it never joins frames of two graphics cards into one film.

The render draws no new calibration picture: it uses the one the test kept (1.5), on every start. Two lines of
its output say that it mended something by itself. They are no failures and need nothing from you. Give both to
Brandon in the report of 2.7 if you see them:

- `the record of the calibration picture was gone or could not be read ...: the record is written again from them`.
  The record was lost while finished chunks lay on disk. The tool wrote it again from what those chunks say and
  drew no new picture, so every chunk goes on naming one picture.
- `... finished chunks (...) on disk name another build or another calibration picture, and are drawn again
  before the films are joined`. This is the one case in which finished chunks are drawn again: they do not
  belong to this build and its kept picture. It costs their time once more, and the film comes out whole.

Good: `PASS: the two films, the loop and the screenshot are made in ...`.

Bad, each with the one thing to do:

| the FAIL says | do this |
| --- | --- |
| `the film is not released for its final render yet; step 1 only` | stop and tell Brandon. The remote team releases the film; nothing here can |
| a final mix is missing or is not the one the stamp names | stop and tell Brandon that the remote team has not put the sound mixes into the repository yet, or that the file in the clone is not the one the stamp names. Do not ask him for the files |
| `"render" was stopped before it ended` (sleep, a restart, a closed window) | run the same line again. It carries on from the last finished frames. If it is stopped a second time with no more frames done in between, stop and report |
| `the render stopped at ...` with `browser has been closed`, `the browser went away` or `the page crashed or closed` (a Chrome window was closed or Chrome ended) | run the same line again, once. It carries on from the last finished frames, and what was drawn is kept. If it stops a second time with no more frames done in between, stop and report. Change no setting (rule 8) |
| `the WebGL context was lost` (the driver reset the card, or the card ran out of memory) | run the same line again, once. It carries on. If it is lost a second time with no more frames done in between, stop and report. Change no setting (rule 8) |
| `Chrome is now version ...: the browser was updated` | Chrome updated itself in the middle. Run `node tools/handoff.mjs test` again. It keeps the calibration picture (1.5), so what was drawn before the update and what is drawn after it are joined into one film. When it ends with `PASS:`, run the render line again: it carries on from the last finished frames, and the report names both versions of Chrome. When the test ends with `FAIL:`, do not run the render line: nothing more is drawn with a browser the test did not pass on (the tool refuses it too). Stop and give Brandon the report of the test |
| the page draws in software, or on another card | stop and report. Nothing drawn is lost |
| too little free disk | stop and report. Nothing drawn is lost |
| `"<word>" is still at work in the background` | no stop: run the line that sentence names until it ends, then the render line |
| anything else | stop and report |

The tool itself tries nothing a second time: when a picture cannot be drawn it stops at once, keeps every
finished frame and says where it stopped. The second try is yours, by the rows above, and never more than they
say.

### 2.3 Check the four files

```
node tools/handoff.mjs check
```

Good: `PASS: the two films, the loop and the screenshot pass every check ...`.

Bad: `FAIL:` with the checks that failed. Stop and report. Do not render again by yourself.

### 2.4 Deliver to the Desktop

```
node tools/handoff.mjs deliver
```

Good: `PASS: the four files and the report are in ...` with the whole path of the folder `Snow Globe Seasons` on
the Desktop. Give Brandon that path as it is printed.

Bad, each with the one thing to do:

| the FAIL says | do this |
| --- | --- |
| a file on the Desktop `could not be written, because another program holds it open` | tell Brandon, word for word: "A film from an earlier run is open in a player on your Desktop. Please close the player and tell me." When he has, run the same line again, once |
| anything else | stop and report |

What the files weigh: each film at most 500 MB, the loop under 2,000 MB (2.3 checks it), the screenshot some tens
of MB. They stay in that folder. 2.5 sends copies of them, and only if Brandon says yes.

### 2.5 Send the files to the remote team, only when Brandon says yes

This line writes to Brandon's repo on GitHub. Before you run it, ask Brandon, word for word: "The files are on your
Desktop. May I send copies to the remote team now, as a draft release of the repo? A draft is shown to no one
else." Run the line only after he says yes. If he says no, go on with 2.6.

```
node tools/handoff.mjs upload
```

It makes a draft release in the repo, named for the day, the engine hash and this machine. Into it go the two
films, the loop, the screenshot, a file of sums (sha256, bytes, frames, seconds and size in pixels of each) and
the records of the render as one zip. A draft is published to no one and makes no tag. The line answers
`RUNNING:` while it sends; run the same line again each time. After the last file it reads the release back from
GitHub and compares every name, size and sum.

Good: `PASS: the draft release "..." holds the 6 files, each read back by its name, its bytes and its sum: ...`
with the address of the release. Give Brandon that address.

Bad, each with the one thing to do:

| the FAIL says | do this |
| --- | --- |
| `gh, the GitHub program that sends the files, is not on this machine` | run the install line below, then the upload line again |
| `gh, the GitHub program, is not signed in on this machine` | tell Brandon, word for word: "The upload needs your GitHub sign in. Please open a terminal yourself, run `gh auth login`, answer what it asks, and tell me when it is done." Then run the upload line again |
| the sign in `does not see the repo` or `may not write to it` | the same words to Brandon, and add: "It must be the account that owns the repo." Then run the upload line again |
| `the repo ... is not private, so nothing is sent` | stop and tell Brandon. The remote team makes the repo private; nothing here can |
| `the check has not passed` or a file `is not the file that was checked` | run the line of 2.3 again, then the upload line. If it says the same again, stop and report |
| a file `did not go through`, or GitHub `could not be asked` (the connection dropped) | run the same line again. It sends only what is missing or short. If it fails three times in a row, stop and report |
| a file is 2,000 MB or more | stop and report. The remote team names another way |
| anything else | stop and report |

```
winget install --id GitHub.cli -e --source winget --accept-package-agreements --accept-source-agreements
```

What was tried: sending, carrying on after a cut connection and reading back were run with stand-in files of a
few bytes, on Linux and on a hosted Windows machine. The refusal for a missing sign in was run on the hosted
Windows and macOS machines, after a small render there. The refusal for a repo that is not private was run on
Linux only, while the repo was public. `gh auth login` was run on no test machine, and no whole film was sent by
this line before Brandon's own run.

### 2.6 Clean up, only after the delivery passed

```
node tools/handoff.mjs clean
```

Good: `PASS: the work files are deleted and ... GB of disk is regained ...`. The files on the Desktop, the reports
and the clone stay.

Bad: `FAIL:`. Stop and report. Delete nothing by hand.

### 2.7 Report

Give Brandon the whole text of `Snow Globe Seasons - Render Report.txt` as one block. It lies in the folder
whose path the deliver line printed. Give him the last line of each command of 2.1 to 2.6 that was run. If 2.5
was run and passed, give him the address of the draft release too. If 2.5 was not run because Brandon said no,
say so in these words: "The files were not sent, by your word." A skipped upload is no failure. If 2.5 was run
and did not pass, say that its last line was a `FAIL:` and give him its report: what was sent so far stays in
the draft release, which only the remote team removes.

## macOS: the fallback, same commands

Use this only if Brandon says to render on the MacBook Pro. The rules, the two steps, the tables and the answers
are the same as on Windows. What differs stands here. Work in Terminal.

### What a prepared Mac has

Five things. Check them in this order, one line at a time:

```
git --version
brew --version
node --version
```

| what | its check | good | if it is missing or too old |
| --- | --- | --- | --- |
| the Command Line Tools of macOS, which bring git | `git --version` | `git version 2.25` or newer | see "The Command Line Tools" below |
| Homebrew, which installs the rest | `brew --version` | a line that begins `Homebrew` | see "Homebrew" below |
| Node | `node --version` | `v20.19` or newer of 20, `v22.12` or newer of 22, or `v24` and up | `brew install node` |
| ffmpeg with the picture encoder libx264 and the sound encoder aac | the doctor of 1.4 reads it | the doctor's row for ffmpeg passes | `brew install ffmpeg`, then the doctor again |
| Google Chrome | the doctor of 1.4 reads it | the doctor's row for Chrome passes | `brew install --cask google-chrome`, then the doctor again |

The install lines, one for each thing that is missing or too old:

```
brew install git
brew install node
brew install ffmpeg
brew install --cask google-chrome
```

A brew line is good when it ends with exit code 0. After it, ask for the version again (or run the doctor
again). If the version is still not found or still too old, an older copy on this Mac comes first, or this
terminal was opened before the install. Do not install again and do not look for the other copy. Stop and tell
Brandon, word for word: "A program was installed just now, and this terminal does not see the new one yet.
Close this Terminal window, open a new one, start the agent again and give it the same task. Nothing is lost."
If it is the same after that new start, stop and report the line and its answer. A brew line that ends with
another exit code than 0: stop and report its last lines.

The Command Line Tools. On a Mac that never had them, `git --version` opens a window of macOS that says the
command needs the command line developer tools. That is a system prompt, and it is for Brandon. Tell him, word
for word: "macOS asks to install the command line developer tools. Please click Install, wait until it says it is
done, and tell me." Then run `git --version` again.

Homebrew. If `brew --version` answers `command not found`, Homebrew is not on this Mac. Installing it is
Brandon's own act, with his password, and you do not run its install line. Stop and tell him, word for word:
"This Mac needs Homebrew. Its install line stands at the top of the page https://brew.sh, under the words
Install Homebrew. Please copy that line from the page into a Terminal window of your own, give your password
when it asks, and do what its last lines under Next steps tell you. Then open a new Terminal window, start the
agent again and give it the same task." Then wait.

### What of the Windows part does not hold on the Mac

- 1.1: the winget lines and the sentences about winget. The brew lines above stand in their place.
- 1.2: the window `Connect to GitHub` of Git for Windows. The sign in on the Mac stands below.
- 1.4: the rows for WSL and for a Windows graphics setting. A MacBook with Apple's own chip has one card. If the
  doctor says the page draws in software or on another card there: stop and report.
- 1.5: the reading of an NVIDIA card with `nvidia-smi`. The test prints no such reading on a Mac.
- 2.2: the words to Brandon about Windows updates. Say in their place: "Please keep the MacBook on its charger
  and its lid open until I say it is done."
- 2.5: the winget line for `gh`. On the Mac the line is `brew install gh`.

The sign in on the MacBook, if the repo is private: the first clone can fail in the agent's own shell, because no
sign in window can open there. If the clone line below ends with `fatal: Authentication failed`, with
`fatal: repository ... not found` or with `fatal: could not read Username`, stop and tell Brandon, word for word:
"The clone needs your GitHub sign in. Please open Terminal yourself, run `gh auth login`, then `gh auth setup-git`,
and tell me when both are done." If he says `gh` is not found, he runs `brew install gh` first. Then run the clone
line again. This was tried on no test machine, because it needs Brandon's own account.

### The lines, in their order

Step 1, with the same good and bad answers as in 1.2 to 1.6:

```
node tools/handoff.mjs status
git clone --filter=blob:none --single-branch --branch main https://github.com/BrandonChurch93/Snow-Globe-Perplexity.git Snow-Globe-Perplexity
cd Snow-Globe-Perplexity
node tools/handoff.mjs status
node tools/handoff.mjs setup
node tools/handoff.mjs doctor
node tools/handoff.mjs test
```

STOP here and report as in 1.6. Then, only on Brandon's word, step 2 as in 2.1 to 2.7:

```
git pull --ff-only
node tools/handoff.mjs setup
node tools/handoff.mjs doctor
node tools/handoff.mjs test
node tools/handoff.mjs render
node tools/handoff.mjs check
node tools/handoff.mjs deliver
node tools/handoff.mjs upload
node tools/handoff.mjs clean
```

The upload line is run only after Brandon has said yes to it, as in 2.5. If he says no, leave it out.

Keep the MacBook on its charger and its lid open for the whole render.
