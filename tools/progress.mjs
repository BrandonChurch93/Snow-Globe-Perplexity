import fs from 'node:fs'
import { rel, parseArgs, replaceSection, readSection } from './lib/paths.mjs'

const args = parseArgs(process.argv.slice(2))
const file = rel('kit', 'PROGRESS.md')
let md = fs.readFileSync(file, 'utf8')
const text = () => (args.file ? fs.readFileSync(String(args.file), 'utf8') : String(args.text ?? '')).trimEnd()

function lead(section) {
  const body = readSection(md, section) ?? ''
  const lines = body.split('\n')
  const intro = []
  for (const l of lines) {
    if (l.trim() === 'none') break
    intro.push(l)
  }
  return { body, lines, intro }
}

if (args.set) {
  const [key, ...rest] = String(args.set).split('=')
  const value = rest.join('=')
  const re = new RegExp(`^- ${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: .*$`, 'm')
  if (!re.test(md)) throw new Error(`status key not found: ${key}`)
  md = md.replace(re, `- ${key}: ${value}`)
} else if (args.append) {
  const section = String(args.append)
  const { body } = lead(section)
  const cleaned = body
    .split('\n')
    .filter((l) => l.trim() !== 'none')
    .join('\n')
    .trimEnd()
  md = replaceSection(md, section, `${cleaned}\n\n${text()}`.trim())
} else if (args.replace) {
  const section = String(args.replace)
  const keepIntro = args.intro !== 'drop'
  const { lines } = lead(section)
  let intro = ''
  if (keepIntro && lines.length && !lines[0].startsWith('|') && !lines[0].startsWith('-') && !lines[0].startsWith('#') && lines[0].trim() !== 'none') intro = lines[0] + '\n\n'
  md = replaceSection(md, section, `${intro}${text()}`)
} else if (args.phase) {
  const [n, state, when] = String(args.phase).split('=')[0] ? [String(args.phase), String(args.state), args.when ? String(args.when) : null] : []
  const re = new RegExp(`^\\| ${n} · ([^|]*)\\| ([^|]*)\\| ([^|]*)\\| ([^|]*)\\| ([^|]*)\\|$`, 'm')
  const m = md.match(re)
  if (!m) throw new Error(`phase row not found: ${n}`)
  const cell = (given, was) => {
    const v = given && given !== true ? String(given).trim() : was.trim()
    return v ? ` ${v} ` : ' '
  }
  md = md.replace(re, () => `| ${n} · ${m[1]}| ${state ?? m[2].trim()} |${cell(args.started, m[3])}|${cell(args.ended, m[4])}|${cell(args.evidence, m[5])}|`)
  if (state === 'in progress') md = md.replace(/^- Phase: .*$/m, `- Phase: ${n}`)
} else if (args.read) {
  console.log(readSection(md, String(args.read)))
  process.exit(0)
} else {
  console.error('usage: progress --set "Key=value" | --append SECTION --text T | --replace SECTION --file F | --phase N --state S | --read SECTION')
  process.exit(2)
}
fs.writeFileSync(file, md)
