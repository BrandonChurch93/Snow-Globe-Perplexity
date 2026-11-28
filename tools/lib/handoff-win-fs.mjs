// Windows only. A file that another program holds open cannot be renamed, and cannot be put in the place of
// another: Node answers EPERM, EACCES or EBUSY at once. On Windows a virus scanner and the search index open every
// new file for a moment, and the line that follows a long word reads its job file every second. Measured on a
// hosted Windows machine: the first write of the job file of "setup" ended that way, once in six machines.
//
// This module makes fs.renameSync wait and try again for some seconds, and gives fs.rmSync of a folder the tries
// that Node offers. tools/handoff.mjs loads it and names it in NODE_OPTIONS, so that every node process the tool
// starts (the master tool and its workers) has it too. On Linux and macOS nothing is changed and nothing is set.
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const HELD = ['EPERM', 'EACCES', 'EBUSY']
export const WAIT_MS = 10000
const napFor = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

/** `fn`, tried again while it answers that the file is held by another program, for `waitMs` at most. Any other error is thrown at once. */
export function patient(fn, { waitMs = WAIT_MS, nap = napFor, now = Date.now } = {}) {
  return function (...args) {
    const t0 = now()
    for (let pause = 10; ; pause = Math.min(pause * 2, 250)) {
      try {
        return fn.apply(this, args)
      } catch (e) {
        if (!HELD.includes(e?.code) || now() - t0 >= waitMs) throw e
        nap(pause)
      }
    }
  }
}

/** The options of fs.rmSync with the tries Node offers for a folder that something still holds. What the caller set stays. */
export function rmOptions(options) {
  if (!options || typeof options !== 'object' || !options.recursive) return options
  return { maxRetries: 20, retryDelay: 250, ...options }
}

let installed = false
/** Puts the patient rename in place. Returns what it did, as one sentence. */
export function install(platform = process.platform, env = process.env) {
  if (platform !== 'win32') return 'not Windows: nothing is changed'
  if (!installed) {
    installed = true
    const rename = fs.renameSync
    const rm = fs.rmSync
    fs.renameSync = patient(rename)
    fs.rmSync = function (p, options) {
      return rm.call(this, p, rmOptions(options))
    }
    syncBuiltinESMExports()
  }
  // every node process started from here loads this file first
  const flag = `--import=${pathToFileURL(fileURLToPath(import.meta.url)).href}`
  if (!String(env.NODE_OPTIONS ?? '').includes(flag)) env.NODE_OPTIONS = [env.NODE_OPTIONS, flag].filter(Boolean).join(' ')
  return `Windows: a rename waits up to ${WAIT_MS / 1000} s for a file that another program holds`
}

install()
