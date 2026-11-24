import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { transformWithOxc } from 'vite'
import { rel } from '../../tools/lib/paths.mjs'

const dir = () => {
  const d = rel('out', 'work', 'village')
  fs.mkdirSync(d, { recursive: true })
  return d
}

async function writeLayout() {
  dir()
  const source = fs.readFileSync(rel('src', 'scene', 'layout.ts'), 'utf8')
  const js = (await transformWithOxc(source, 'layout.ts', {})).code
  const configLine = /import \{ config \} from ['"]\.\.\/config['"];?/
  if (!configLine.test(js)) throw new Error('the layout no longer imports the config the way this loader expects')
  const out = js.replace(configLine, `import fs from 'node:fs'\nconst config = JSON.parse(fs.readFileSync(${JSON.stringify(rel('config', 'showcase.json'))}, 'utf8'))`)
  const file = rel('out', 'work', 'village', 'layout.generated.mjs')
  fs.writeFileSync(file, out)
  return file
}

export async function loadLayout() {
  const file = await writeLayout()
  return import(`${pathToFileURL(file).href}?t=${Date.now()}`)
}

export async function loadRoof() {
  const layout = await writeLayout()
  const source = fs.readFileSync(rel('src', 'miniature', 'roof.ts'), 'utf8')
  const js = (await transformWithOxc(source, 'roof.ts', {})).code
  const line = /from ['"]\.\.\/scene\/layout['"]/
  if (!line.test(js)) throw new Error('roof.ts no longer imports the layout the way this loader expects')
  const file = rel('out', 'work', 'village', 'roof.generated.mjs')
  fs.writeFileSync(file, js.replace(line, `from ${JSON.stringify(pathToFileURL(layout).href)}`))
  return import(`${pathToFileURL(file).href}?t=${Date.now()}`)
}
