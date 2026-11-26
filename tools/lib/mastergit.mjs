import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { loadConfig, readJson, rel, writeJson } from './paths.mjs'
import { M, branchFolder, branchMatches } from './master.mjs'

const cfg = loadConfig()
const TRAILER = 'Co-authored-by: Perplexity <noreply@perplexity.ai>'
const PUSH_TRIES = 3

function git(cwd, args, { ok = false } = {}) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 26 })
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

function remoteTip(dir, url, branch) {
  const r = git(dir, ['ls-remote', url, `refs/heads/${branch}`])
  return r.out ? r.out.split(/\s+/)[0] : null
}

/** Chunks go to an orphan branch through a clone of its own, so the code branch never holds one. */
export class Shipper {
  constructor({ branch, say = console.log, root = rel('out', 'work', 'master', 'ship'), facts = repoFacts() }) {
    if (!branch || /\s/.test(branch) || branch === cfg.repo.branch) throw new Error('--ship takes the name of a chunk branch, never the code branch')
    if (!facts.name || !facts.email) throw new Error('git user.name and user.email are not set in this clone, so a chunk cannot be committed. Set them first.')
    this.branch = branch
    this.say = say
    this.dir = path.join(root, branchFolder(branch))
    this.facts = facts
    this.unpushed = false
    this.matches = branchMatches(branch)
  }

  prepare() {
    const d = this.dir
    if (!fs.existsSync(path.join(d, '.git'))) {
      fs.mkdirSync(d, { recursive: true })
      git(d, ['init', '-q'])
      git(d, ['remote', 'add', 'origin', this.facts.url])
    }
    git(d, ['config', 'user.name', this.facts.name])
    git(d, ['config', 'user.email', this.facts.email])
    const tip = remoteTip(d, this.facts.url, this.branch)
    const local = git(d, ['rev-parse', '-q', '--verify', `refs/heads/${this.branch}`], { ok: true }).out
    if (tip) {
      git(d, ['fetch', '-q', '--depth', '1', 'origin', `+refs/heads/${this.branch}:refs/remotes/origin/${this.branch}`])
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

  push() {
    if (!this.unpushed) return true
    let why = ''
    for (let i = 1; i <= PUSH_TRIES; i++) {
      const r = git(this.dir, ['push', '-q', 'origin', `HEAD:refs/heads/${this.branch}`], { ok: true })
      if (r.status === 0) {
        this.unpushed = false
        return true
      }
      why = r.err.split('\n').filter(Boolean).slice(-1)[0] ?? ''
      try {
        if (remoteTip(this.dir, this.facts.url, this.branch)) {
          git(this.dir, ['fetch', '-q', '--depth', '1', 'origin', `+refs/heads/${this.branch}:refs/remotes/origin/${this.branch}`])
          this.merge()
        }
      } catch (e) {
        why = e.message
      }
    }
    this.say(`the push to ${this.branch} was refused ${PUSH_TRIES} times (${why}). The chunks stay on disk and the push is tried again after the next chunk.`)
    return false
  }
}

/** Fetches the tip of every chunk branch into a clone of its own under `dir` and lays its files out by branch. */
export function collectBranches({ dir, say = console.log, facts = repoFacts(), pattern = M.chunkBranches }) {
  fs.mkdirSync(dir, { recursive: true })
  const stateFile = path.join(dir, 'collected.json')
  const state = fs.existsSync(stateFile) ? readJson(stateFile) : { branches: {} }
  const listed = git(dir, ['ls-remote', facts.url, 'refs/heads/*']).out.split('\n').filter(Boolean).map((l) => l.split(/\s+/))
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
    git(clone, ['fetch', '-q', '--depth', '1', facts.url, `refs/heads/${b.branch}`])
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
