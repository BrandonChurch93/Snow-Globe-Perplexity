// What a tool says beside a lost drawing: a lost WebGL context, a page or browser that went away, a flat picture.
// The frame is refused in every case; this is only the word about what to do next, said for the machine it is on.
// Linux keeps its own word: there dmesg names a process that was killed for memory. Windows and macOS have no
// such thing, so the word there is what holds on those machines.

const OTHER = 'close other programs that use the card and run the same line again, it carries on where it stopped; if it happens twice in a row, stop and give Brandon the report'

/** Beside a lost WebGL context. */
export const lostHint = (platform = process.platform) => (platform === 'linux' ? 'the graphics process may have been killed for memory: look at dmesg' : `the graphics card dropped the drawing: ${OTHER}`)

/** Beside a page that crashed or a browser that went away. */
export const goneHint = (platform = process.platform) => (platform === 'linux' ? 'the machine may be out of memory: look at dmesg' : `the machine or its graphics card may be out of memory: ${OTHER}`)

/** Beside a picture that came back as one flat value. A sentence of its own. */
export const flatHint = (platform = process.platform) => (platform === 'linux' ? 'The graphics process may have been killed for memory: look at dmesg.' : `The graphics card may have dropped the drawing: ${OTHER}.`)

/** The master's word for a flat frame. A sentence of its own. */
export const flatFrameHint = (platform = process.platform) => (platform === 'linux' ? 'Look at dmesg for a killed chrome process.' : `The graphics card may have dropped the drawing: ${OTHER}.`)

/** The master's last word after a stop on a lost context; procs is '' or ' than N'. */
export const goOnHint = (procs = '', platform = process.platform) =>
  platform === 'linux' ? ` A lost context is most often a browser killed for memory (dmesg says so): if it was, go on with a smaller --procs${procs}.` : ` A lost context here most often means that the graphics card dropped the drawing: ${OTHER}.`
