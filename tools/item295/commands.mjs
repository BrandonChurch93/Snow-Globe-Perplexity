// node tools/item295/commands.mjs <folder of one arm's artifact> [--load <tag part>] [--gap 200] [--tail 40]
//
// Item 295: reads the lines Chrome's graphics process writes for every command it is handed when the browser is begun
// with --enable-gpu-command-logging (an arm of tools/item295/listen.mjs with that flag), for one load or all of an arm.
// It prints, by the second after the page's first picture, how many commands of each name the page's own context was
// handed; every wait of --gap ms and more between two commands with the command the wait came after (the line is
// written before the command is done, so the wait is that command's own time or the time until the next was sent);
// and the last commands before the card was lost. Such a load has a tool beside the card (the logging), so it is
// never counted with the listening loads. It measures nothing itself.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const dir = path.resolve(process.argv[2] ?? '.')
const opt = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
const only = opt('--load', null)
const gapMs = Number(opt('--gap', '200'))
const tail = Number(opt('--tail', '40'))
const files = fs.readdirSync(dir)
const jsonFile = files.find((f) => f.endsWith('.json'))
const results = JSON.parse(fs.readFileSync(path.join(dir, jsonFile), 'utf8'))

const readLog = (tag) => {
  const plain = path.join(dir, `${tag}-chrome.log`)
  if (fs.existsSync(plain)) return fs.readFileSync(plain, 'utf8')
  if (fs.existsSync(`${plain}.gz`)) return zlib.gunzipSync(fs.readFileSync(`${plain}.gz`)).toString('utf8')
  return ''
}
// Chrome's own stamp: [pid:tid:MMDD/HHMMSS.uuuuuu:LEVEL:file(line)]
const STAMP = /\[(\d+):(\d+):(\d\d)(\d\d)\/(\d\d)(\d\d)(\d\d)\.(\d+):/
const year = new Date().getUTCFullYear()

for (const r of results) {
  if (only && !r.tag.includes(only)) continue
  if (r.failed) continue
  const first = r.marks.find((m) => m.mark === 'first-picture' && m.value === '1')?.at ?? null
  if (first === null) continue
  const firstWall = r.wall0 + (first - r.page0)
  const lossWall = r.lost.length ? r.wall0 + (r.lost[0].at - r.page0) : null
  const text = readLog(r.tag)
  const lines = text.split('\n')
  // The offset between Chrome's stamp (the machine's own zone) and the driver's (UTC), from the lines that carry both.
  let zone = null
  const cmds = []
  const contexts = new Map()
  for (const l of lines) {
    const s = STAMP.exec(l)
    if (!s) continue
    const own = Date.UTC(year, Number(s[3]) - 1, Number(s[4]), Number(s[5]), Number(s[6]), Number(s[7])) + Number(`0.${s[8]}`) * 1000
    if (zone === null) {
      const d = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d+Z)/.exec(l)
      if (d) zone = Math.round((Date.parse(d[1]) - own) / 900000) * 900000
    }
    const c = /\[([^\]]*)\]cmd: (\w+)/.exec(l)
    if (!c) continue
    const at = own + (zone ?? 0)
    const ctx = c[1]
    contexts.set(ctx, (contexts.get(ctx) ?? 0) + 1)
    cmds.push({ at, ctx, name: c[2], pid: Number(s[1]) })
  }
  console.log(`\n${r.tag}: first picture at ${first} ms of the page; lost ${r.lost.length ? r.lost.map((l) => `+${l.at - first}`).join(', ') : 'never'}; lines ${lines.length}; command lines ${cmds.length}; zone offset ${zone} ms`)
  console.log(`  contexts by their own names: ${[...contexts].map(([k, n]) => `${k || '(none)'} ${n}`).join('; ')}`)
  // The page's context: the one named WebGL where one is, else the one with the most commands.
  const page = [...contexts.keys()].filter((k) => /WebGL/i.test(k))
  const mine = cmds.filter((c) => (page.length ? page.includes(c.ctx) : true))
  const rel = (at) => Math.round(at - firstWall)
  const seconds = new Map()
  for (const c of mine) {
    const s = Math.floor((c.at - firstWall) / 1000)
    if (!seconds.has(s)) seconds.set(s, new Map())
    const m = seconds.get(s)
    m.set(c.name, (m.get(c.name) ?? 0) + 1)
  }
  console.log('  the page\'s context, by the second after the first picture: commands, then the names that are not of every frame')
  const MAKING = /Tex(Image|Storage|SubImage)|CompressedTex|CopyTex|CopySubTexture|GenerateMipmap|Renderbuffer|Framebuffer(?!$)|BlitFramebuffer|ShaderSource|CompileShader|LinkProgram|CreateProgram|GetProgram|GetShader|BufferData|BufferSubData|ReadPixels|Fence|ClientWait|Finish|Flush|InvalidateFramebuffer|Query|GetError|GenTextures|DeleteTextures|TransformFeedback|GetUniformLocation|GetActive|BindUniformLocation|GetUniformBlock|MaxShaderCompilerThreads|ValidateProgram/
  for (const s of [...seconds.keys()].sort((a, b) => a - b)) {
    if (s < -3 || s > 70) continue
    const m = seconds.get(s)
    const total = [...m.values()].reduce((x, y) => x + y, 0)
    const draws = [...m].filter(([k]) => /Draw(Arrays|Elements)/.test(k)).reduce((x, [, n]) => x + n, 0)
    const making = [...m].filter(([k]) => MAKING.test(k)).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k.replace(/^k/, '')} ${n}`).join(', ')
    console.log(`    ${String(s).padStart(3)} s: ${String(total).padStart(6)} commands, ${String(draws).padStart(5)} draws; ${making.slice(0, 900)}`)
  }
  console.log(`  waits of ${gapMs} ms and more between two commands of any context, from 1 s before the first picture:`)
  let n = 0
  for (let i = 1; i < cmds.length; i++) {
    const wait = cmds[i].at - cmds[i - 1].at
    if (wait < gapMs || cmds[i - 1].at < firstWall - 1000) continue
    if (n++ < 60) console.log(`    ${String(Math.round(wait)).padStart(6)} ms after ${cmds[i - 1].name} [${cmds[i - 1].ctx}] at ${rel(cmds[i - 1].at) >= 0 ? '+' : ''}${rel(cmds[i - 1].at)}, before ${cmds[i].name} [${cmds[i].ctx}]${cmds[i].pid !== cmds[i - 1].pid ? ` (ANOTHER PROCESS: ${cmds[i - 1].pid} then ${cmds[i].pid})` : ''}`)
  }
  if (n > 60) console.log(`    and ${n - 60} more`)
  if (lossWall !== null) {
    const before = cmds.filter((c) => c.at <= lossWall + 50)
    console.log(`  the last ${tail} commands before the loss (+${rel(lossWall)}), with ms after the first picture:`)
    for (const c of before.slice(-tail)) console.log(`    ${rel(c.at) >= 0 ? '+' : ''}${rel(c.at)} ${c.name} [${c.ctx}] pid ${c.pid}`)
    const after = cmds.filter((c) => c.at > lossWall + 50)
    console.log(`  commands after the loss: ${after.length}${after.length ? `, the first ${after.slice(0, 5).map((c) => `${c.name} +${rel(c.at)} pid ${c.pid}`).join(', ')}` : ''}`)
  }
}
