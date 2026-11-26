import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { loadConfig, readJson, rel, writeJson } from './paths.mjs'
import { M, branchFolder, branchMatches } from './master.mjs'

const cfg = loadConfig()
const TRAILER = 'Co-authored-by: Perplexity <noreply@perplexity.ai>'
const IDENT = ['GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL']
/** Seconds between two tries at the remote. The sign-in of a machine comes and goes, and one refusal must not end a run of hours. */
export const REMOTE_WAITS = [5, 15, 30]

/**
 * The environment git is started with. An identity variable that is set and empty wins over the clone's user.name and makes a commit die, so it is taken out; one that holds a value stays. Git never stands at a prompt.
 * @param {Record<string, string | undefined>} [env]
 */
export function gitEnv(env = process.env) {
  const out = { ...env, GIT_TERMINAL_PROMPT: '0' }
  for (const k of IDENT) if (typeof out[k] === 'string' && out[k].trim() === '') delete out[k]
  return out
}

const sleepSync = (ms) => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}
const lastLine = (text) => String(text ?? '').split('\n').filter(Boolean).slice(-1)[0] ?? ''

/**
 * Runs `once` until it returns without throwing, with a wait between two tries. After the last wait's try it throws what the last try threw.
 * @param {() => any} once
 * @param {{ what?: string, waits?: number[], sleep?: (ms: number) => void, say?: (line: string) => void }} [how]
 */
export function withWaits(once, { what = 'the remote', waits = REMOTE_WAITS, sleep = sleepSync, say = () => {} } = {}) {
  for (let i = 0; ; i++) {
    try {
      const value = once()
      if (i > 0) say(`${what}: answered at try ${i + 1}`)
      return value
    } catch (e) {
      if (i >= waits.length) throw new Error(`${e.message} (${waits.length + 1} tries, ${waits.join(', ')} s apart)`)
      say(`${what}: refused (${lastLine(e.message)}). Try ${i + 2} of ${waits.length + 1} in ${waits[i]} s.`)
      sleep(waits[i] * 1000)
    }
  }
}

function git(cwd, args, { ok = false } = {}) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 26, env: gitEnv() })
  if (r.error) throw new Error(`git could not be started: ${r.error.message}`)
  if (r.status !== 0 && !ok) throw new Error(`git ${args.join(' ')} failed: ${(r.stderr || r.stdout).trim().split('\n').slice(-3).join(' ')}`)
  return { status: r.status, out: r.stdout.trim(), err: r.stderr.trim() }
}

export function repoFacts(root = rel()) {
  const get = (args) => git(root, args, { ok: true }).out
  return {
    url: get(['remote', 'get-url', 'origin']) || cfg.repo.url,
    commit: get(['rev-parse', 'HEAD']) || 'unknown',
    name: get(['config', 'user.name']),
    email: get(['config', 'user.email']),
  }
}

const person = (text) => {
  const m = /^(.*) <([^>]*)>/.exec(text)
  return m ? { name: m[1], email: m[2] } : null
}

/** The author of the head of origin's code branch as this clone knows it, or of HEAD when the clone holds no such ref. */
export function mainAuthor(root = rel()) {
  const read = (ref) => person(git(root, ['log', '-1', '--format=%an <%ae>', ref], { ok: true }).out)
  const ref = `origin/${cfg.repo.branch}`
  const main = read(`refs/remotes/${ref}`)
  if (main) return { ...main, of: `the head of ${ref}` }
  const head = read('HEAD')
  return head ? { ...head, of: `HEAD (this clone holds no ${ref})` } : null
}

const same = (a, b) => !!a && !!b && a.name === b.name && a.email === b.email
const shown = (p) => (p ? `${p.name} <${p.email}>` : 'nobody git can name')
/**
 * One plain line when a commit made here would not carry the name and e-mail of `wanted` as author and committer, else null.
 * @param {{ name: string, email: string, of?: string } | null} wanted
 * @param {{ author: { name: string, email: string } | null, committer: { name: string, email: string } | null, why?: string }} would
 * @param {Record<string, string | undefined>} [env]
 */
export function identityProblem(wanted, would, env = process.env) {
  if (!wanted) return '--ship cannot tell whose name its commits must carry: this clone holds no commit git can read. Nothing is drawn.'
  if (same(wanted, would.author) && same(wanted, would.committer)) return null
  const set = IDENT.filter((k) => typeof env[k] === 'string' && env[k].trim() !== '')
  const shell = set.length ? ` The shell sets ${set.join(', ')}, which ${set.length === 1 ? 'wins' : 'win'} over the clone's config: unset ${set.length === 1 ? 'it' : 'them'} first.` : ''
  return `--ship would commit as ${shown(would.author)} (author) and ${shown(would.committer)} (committer)${would.why ? ` (${would.why})` : ''}, and ${wanted.of ?? 'the head of the code branch'} is by ${shown(wanted)}. Nothing is drawn.${shell} Run these two in this clone and start again: git config user.name "${wanted.name}" && git config user.email "${wanted.email}"`
}

function remoteTip(dir, url, branch) {
  const r = git(dir, ['ls-remote', url, `refs/heads/${branch}`])
  return r.out ? r.out.split(/\s+/)[0] : null
}

/** Chunks go to an orphan branch through a clone of its own, so the code branch never holds one. */
export class Shipper {
  constructor({ branch, say = console.log, root = rel('out', 'work', 'master', 'ship'), facts = repoFacts(), waits = REMOTE_WAITS, sleep = sleepSync }) {
    if (!branch || /\s/.test(branch) || branch === cfg.repo.branch) throw new Error('--ship takes the name of a chunk branch, never the code branch')
    this.branch = branch
    this.say = say
    this.dir = path.join(root, branchFolder(branch))
    this.facts = facts
    this.unpushed = false
    this.matches = branchMatches(branch)
    this.waits = waits
    this.sleep = sleep
    this.tries = 0
  }

  remote(what, once) {
    return withWaits(once, { what: `${what} of ${this.branch}`, waits: this.waits, sleep: this.sleep, say: this.say })
  }

  open() {
    const d = this.dir
    if (!fs.existsSync(path.join(d, '.git'))) {
      fs.mkdirSync(d, { recursive: true })
      git(d, ['init', '-q'])
      git(d, ['remote', 'add', 'origin', this.facts.url])
    }
    for (const [key, value] of [['user.name', this.facts.name], ['user.email', this.facts.email]]) {
      if (value) git(d, ['config', key, value])
      else git(d, ['config', '--unset', key], { ok: true })
    }
  }

  /** Who a commit made by this shipper would carry, asked of git itself, with no word to the remote. */
  identity() {
    this.open()
    const ask = (what) => git(this.dir, ['var', what], { ok: true })
    const a = ask('GIT_AUTHOR_IDENT')
    const c = ask('GIT_COMMITTER_IDENT')
    const why = [a, c].map((r) => (r.status === 0 ? '' : lastLine(r.err))).filter(Boolean)[0]
    return { author: person(a.out), committer: person(c.out), ...(why ? { why } : {}) }
  }

  prepare() {
    const d = this.dir
    this.open()
    const tip = this.remote('the look at the remote tip', () => remoteTip(d, this.facts.url, this.branch))
    const local = git(d, ['rev-parse', '-q', '--verify', `refs/heads/${this.branch}`], { ok: true }).out
    if (tip) {
      this.remote('the fetch', () => git(d, ['fetch', '-q', '--depth', '1', 'origin', `+refs/heads/${this.branch}:refs/remotes/origin/${this.branch}`]))
      if (!local) git(d, ['checkout', '-q', '-B', this.branch, `origin/${this.branch}`])
      else if (local !== tip) this.merge()
    } else if (!local) {
      git(d, ['checkout', '-q', '--orphan', this.branch])
    }
    this.unpushed = !!git(d, ['rev-parse', '-q', '--verify', 'HEAD'], { ok: true }).out && git(d, ['rev-parse', 'HEAD']).out !== tip
    if (!this.matches) this.say(`note: ${this.branch} does not match deliver.master.chunkBranches (${M.chunkBranches}), so --collect will not find it`)
  }

  merge() {
    const r = git(this.dir, ['merge', '-q', '--no-edit', '--allow-unrelated-histories', '-m', `Merge the remote ${this.branch}\n\n${TRAILER}`, `origin/${this.branch}`], { ok: true })
    if (r.status !== 0) {
      git(this.dir, ['merge', '--abort'], { ok: true })
      throw new Error(`the remote ${this.branch} holds other files under the same names, so it cannot be merged: ${r.err.split('\n')[0]}`)
    }
  }

  holds(to, src) {
    const f = path.join(this.dir, to)
    return fs.existsSync(f) && fs.statSync(f).size === fs.statSync(src).size && fs.readFileSync(f).equals(fs.readFileSync(src))
  }

  /** `files` is [{ src, to }], `to` a path inside the branch. Returns true when a commit was made. */
  add(files, title) {
    const fresh = files.filter((f) => !this.holds(f.to, f.src))
    if (!fresh.length) return false
    for (const f of fresh) {
      const to = path.join(this.dir, f.to)
      fs.mkdirSync(path.dirname(to), { recursive: true })
      fs.copyFileSync(f.src, to)
    }
    git(this.dir, ['add', '--', ...fresh.map((f) => f.to)])
    if (git(this.dir, ['diff', '--cached', '--quiet'], { ok: true }).status === 0) return false
    git(this.dir, ['commit', '-q', '-m', `${title}\n\n${TRAILER}`])
    this.unpushed = true
    return true
  }

  /** One try, then one more after each wait. A remote that is ahead is merged in and the push tried again at once; any other refusal waits first. `tries` holds how many the last push took. */
  push() {
    this.tries = 0
    if (!this.unpushed) return true
    const most = this.waits.length + 1
    let why = ''
    for (let i = 1; i <= most; i++) {
      this.tries = i
      const r = git(this.dir, ['push', '-q', 'origin', `HEAD:refs/heads/${this.branch}`], { ok: true })
      if (r.status === 0) {
        this.unpushed = false
        return true
      }
      why = lastLine(r.err)
      let merged = false
      try {
        const tip = remoteTip(this.dir, this.facts.url, this.branch)
        const known = git(this.dir, ['rev-parse', '-q', '--verify', `refs/remotes/origin/${this.branch}`], { ok: true }).out
        if (tip && tip !== known) {
          git(this.dir, ['fetch', '-q', '--depth', '1', 'origin', `+refs/heads/${this.branch}:refs/remotes/origin/${this.branch}`])
          this.merge()
          merged = true
        }
      } catch (e) {
        why = lastLine(e.message)
      }
      if (i === most) break
      if (merged) continue
      this.say(`the push to ${this.branch} was refused (${why}). Try ${i + 1} of ${most} in ${this.waits[i - 1]} s.`)
      this.sleep(this.waits[i - 1] * 1000)
    }
    this.say(`the push to ${this.branch} was refused ${most} times (${why}). The chunks stay on disk and the push is tried again after the next chunk.`)
    return false
  }
}

/** Fetches the tip of every chunk branch into a clone of its own under `dir` and lays its files out by branch. */
export function collectBranches({ dir, say = console.log, facts = repoFacts(), pattern = M.chunkBranches, waits = REMOTE_WAITS, sleep = sleepSync }) {
  const remote = (what, once) => withWaits(once, { what, waits, sleep, say })
  fs.mkdirSync(dir, { recursive: true })
  const stateFile = path.join(dir, 'collected.json')
  const state = fs.existsSync(stateFile) ? readJson(stateFile) : { branches: {} }
  const listed = remote('the list of the remote branches', () => git(dir, ['ls-remote', facts.url, 'refs/heads/*'])).out.split('\n').filter(Boolean).map((l) => l.split(/\s+/))
  const found = listed.map(([sha, ref]) => ({ sha, branch: ref.replace(/^refs\/heads\//, '') })).filter((b) => branchMatches(b.branch, pattern))
  const clone = path.join(dir, '.clone')
  for (const b of found) {
    const folder = path.join(dir, branchFolder(b.branch))
    if (state.branches[b.branch] === b.sha && fs.existsSync(folder)) {
      say(`${b.branch}: unchanged at ${b.sha.slice(0, 8)}`)
      continue
    }
    fs.rmSync(clone, { recursive: true, force: true })
    fs.mkdirSync(clone, { recursive: true })
    git(clone, ['init', '-q'])
    remote(`the fetch of ${b.branch}`, () => git(clone, ['fetch', '-q', '--depth', '1', facts.url, `refs/heads/${b.branch}`]))
    git(clone, ['checkout', '-q', '--detach', 'FETCH_HEAD'])
    fs.rmSync(path.join(clone, '.git'), { recursive: true, force: true })
    fs.rmSync(folder, { recursive: true, force: true })
    fs.renameSync(clone, folder)
    state.branches[b.branch] = b.sha
    writeJson(stateFile, state)
    say(`${b.branch}: fetched ${b.sha.slice(0, 8)}`)
  }
  fs.rmSync(clone, { recursive: true, force: true })
  if (!found.length) say(`no remote branch matches ${pattern}`)
  return found
}
