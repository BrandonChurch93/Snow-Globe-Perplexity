import os from 'node:os'
import * as L from './handoff.mjs'

const platformName = (platform) => ({ win32: 'Windows', darwin: 'macOS', linux: 'Linux' })[platform] ?? 'other platform'

/** @param {{ platform: string, cards?: { name: string, memoryBytes?: number }[], renderer?: string }} facts */
export function releaseMachine({ platform, cards = [], renderer = '' }) {
  const available = Array.isArray(cards) ? cards.filter((card) => typeof card?.name === 'string' && !!card.name.trim()) : []
  const rendererName = String(renderer ?? '')
  const seen = L.drawVerdict({ renderer: rendererName, cards: available })
  const known = available.find(({ name }) => L.modelWords(name).length && !L.wordsMissing(rendererName, name).length)
  const name = seen.software ? '' : seen.card ?? known?.name ?? (available.length === 1 ? available[0].name : '')
  return [platformName(platform), name.replace(/![ ]*|\u2014/g, ' ').replace(/\s+/g, ' ').trim()].filter(Boolean).join(' ')
}

export function releaseBody({ machine, engineHash, commit, renderTime }) {
  return `Made by "node tools/handoff.mjs upload". Platform and graphics card when known: ${machine}. STATED render record time ${renderTime}, engine hash ${engineHash}, commit ${commit}. This draft is visible to everyone with write access to this repository. It is not published and makes no tag. The file sums are in "${L.sumsName()}".`
}

export const safeDraftIdentity = (release, names, body) => release?.draft === true && release.tag_name === names.tag && release.name === names.title && release.body === body

export const privateRecord = (name) => name.split('/').some((part) => /^(?:approval-|job-approve|report-approve)|^(?:browser-profiles|browser-processes|failed-test-ownership)$/i.test(part))

const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function redactRecordText(text, home = os.homedir()) {
  const base = home.replace(/[\\/]+$/, '')
  if (!base || /^[A-Za-z]:$/.test(base)) return text
  const win = /^[A-Za-z]:[\\/]|^\\\\/.test(base)
  const roots = [base, ...(win ? [base.replace(/\\/g, '/'), base.replace(/\//g, '\\')] : [])]
  const forms = [...new Set(roots.flatMap((p) => [p, JSON.stringify(p).slice(1, -1), encodeURI(p)]))].sort((a, b) => b.length - a.length)
  const before = /(^|[\s"'\x60=([:,>{;]|file:\/\/\/?)/.source
  const after = /(?=[\\/"'\x60\r\n\t ,):;\]}]|%2F|%5C|$)/.source
  return text.replace(new RegExp(before + '(?:' + forms.map(escapeRe).join('|') + ')' + after, win ? 'gi' : 'g'), '$1~')
}
