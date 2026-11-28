import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { rel } from './paths.mjs'

export const sha256Hex = (hash) => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash)

/**
 * Hash the response pipe as it arrives. Do not retain the asset or count a broken pipe as complete.
 * @param {(file: string, args: string[], options: import('node:child_process').SpawnOptionsWithStdioTuple<'ignore', 'pipe', 'pipe'>) => import('node:child_process').ChildProcessByStdio<null, import('node:stream').Readable, import('node:stream').Readable>} [start]
 * @returns {Promise<{ sha256: string | null, bytes: number, why: string }>}
 */
export async function readAssetStream(ctx, E, id, start = spawn) {
  const args = ['api', '--method', 'GET', '-H', 'Accept: application/octet-stream', `repos/${E.slug}/releases/assets/${id}`]
  ctx.note(`STATED command: gh ${args.join(' ')}`)
  return new Promise((resolve) => {
    let child
    try {
      child = start(E.gh, args, { cwd: rel(), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, env: { ...process.env, GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1', NO_COLOR: '1' } })
    } catch {
      resolve({ sha256: null, bytes: 0, why: 'the download could not start' })
      return
    }
    const hash = crypto.createHash('sha256')
    let bytes = 0
    let failure = ''
    child.stdout.on('data', (chunk) => {
      bytes += chunk.length
      hash.update(chunk)
    })
    child.stdout.on('error', () => { failure = 'the download pipe stopped early' })
    child.stderr.on('error', () => { failure = 'the download could not be confirmed' })
    child.stderr.resume()
    child.on('error', () => { failure = 'the download could not run' })
    child.on('close', (code, signal) => {
      if (failure || code !== 0 || signal || !child.stdout.readableEnded) resolve({ sha256: null, bytes, why: failure || 'the download did not complete' })
      else resolve({ sha256: hash.digest('hex'), bytes, why: '' })
    })
  })
}
