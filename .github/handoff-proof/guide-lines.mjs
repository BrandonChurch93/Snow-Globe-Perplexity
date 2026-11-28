import fs from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const bootstrapGuide = fileURLToPath(new URL('../../RENDER-ON-YOUR-PC.md', import.meta.url))
const prefixes = ['node ', 'git ', 'winget ', 'brew ', 'cd ']
const handoff = new Set(['status', 'setup', 'doctor', 'test', 'render', 'check', 'deliver', 'upload', 'clean', 'approve-render', 'approve-upload'])
const selectors = new Map([
  ['git-version', /^git +--version(?=\s|$)/],
  ['node-version', /^node +--version(?=\s|$)/],
  ['brew-version', /^brew +--version(?=\s|$)/],
  ['clone', /^git +clone(?=\s|$)/],
  ['cd', /^cd /],
  ['pull', /^git +pull(?=\s|$)/],
  ['winget-git', /^winget +install +--id +Git\.Git(?=\s|$)/],
  ['winget-node', /^winget +install +--id +OpenJS\.NodeJS\.LTS(?=\s|$)/],
  ['winget-ffmpeg', /^winget +install +--id +Gyan\.FFmpeg(?=\s|$)/],
  ['winget-chrome', /^winget +install +--id +Google\.Chrome(?=\s|$)/],
  ['winget-gh', /^winget +install +--id +GitHub\.cli(?=\s|$)/],
  ['brew-ffmpeg', /^brew +install +ffmpeg(?=\s|$)/],
  ['brew-chrome', /^brew +install +--cask +google-chrome(?=\s|$)/],
])
const proofWords = 'Approval for hosted proof only'

/** A command belongs to a closed fence, and punctuation within the trimmed line belongs to the command. */
export function guideCommands(markdown) {
  const commands = new Set()
  let pending = null
  for (const line of markdown.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (line.startsWith('```')) {
      if (pending) {
        for (const command of pending) commands.add(command)
        pending = null
      } else pending = []
    } else if (pending) {
      const command = line.trim()
      if (prefixes.some((p) => command.startsWith(p))) pending.push(command)
    }
  }
  return commands
}

export function chooseGuideLine(commands, key, optional = false) {
  // The two guarded render rows keep their readable selector, not a separately executed line.
  if (key === 'node tools/handoff.mjs render') key = 'render'
  const handoffWord = key.replace(/^approve-/, 'approve[ \\t]+')
  const match = selectors.get(key) ?? (handoff.has(key) ? new RegExp('^node +tools/handoff\\.mjs[ \\t]+' + handoffWord + '(?=[ \\t]|$)') : null)
  if (!match) throw new Error(`unknown guide command selector: ${key}`)
  const lines = [...commands].filter((line) => match.test(line))
  if (lines.length === 1) return lines[0]
  if (optional && lines.length === 0) return null
  throw new Error(`RENDER-ON-YOUR-PC.md has ${lines.length ? 'more than one distinct command' : 'no command'} for ${key}`)
}

export function planGuideLine(commands, selector, source, { branch = '', words = proofWords } = {}) {
  if (source !== 'bootstrap' && source !== 'clone') throw new Error('unknown guide source')
  const original = chooseGuideLine(commands, selector)
  if (!original) throw new Error('no guide command was selected')
  let actual = original
  let change = ''
  if (selector === 'clone' && branch) {
    if (!/^[A-Za-z0-9_][A-Za-z0-9_./-]*$/.test(branch)) throw new Error('the proof branch is not a plain branch name')
    const matches = [...original.matchAll(/(?:^|[ \t])--branch([ \t]+)([A-Za-z0-9_][A-Za-z0-9_./-]*)(?=[ \t]|$)/g)]
    if (matches.length !== 1) throw new Error('the guide clone must name a single plain branch')
    const [whole, , writtenBranch] = matches[0]
    if (writtenBranch !== branch) {
      const at = matches[0].index + whole.length - writtenBranch.length
      actual = original.slice(0, at) + branch + original.slice(at + writtenBranch.length)
      change = `replaced branch ${writtenBranch} with ${branch} to prove the branch of this job`
    }
  }
  if (selector === 'approve-render' || selector === 'approve-upload') {
    if (!/^[A-Za-z0-9]+(?: +[A-Za-z0-9]+)*$/.test(words)) throw new Error('the proof approval must be words made of letters, digits and spaces')
    const slot = /(<(?:his )?words>|&lt;(?:his )?words&gt;)$/.exec(original)
    if (!slot) throw new Error('the guide approval line has no words placeholder')
    actual = original.slice(0, slot.index) + words
    change = `replaced ${slot[0]} with proof-only words to exercise the hosted approval guard`
  }
  return { selector, source, original, actual, change, ...(selector === 'clone' ? { branch } : {}) }
}

function calledDirectly() {
  try { return import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href } catch { return false }
}
if (calledDirectly()) {
  try {
    const [action, file, selector, source] = process.argv.slice(2)
    const commands = guideCommands(fs.readFileSync(file, 'utf8'))
    if (action === 'has') console.log(chooseGuideLine(commands, selector, true) ? 'yes' : 'no')
    else if (action === 'select') {
      const plan = planGuideLine(commands, selector, source, { branch: process.env.PROOF_BRANCH })
      console.log(plan.actual)
      console.log(JSON.stringify(plan))
    } else throw new Error('unknown guide helper action')
  } catch (e) {
    console.error(e.message)
    process.exitCode = 1
  }
}
