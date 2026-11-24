import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { transformWithOxc } from 'vite'
import { rel } from '../../tools/lib/paths.mjs'

export async function loadLayout() {
  const dir = rel('out', 'work', 'village')
  fs.mkdirSync(dir, { recursive: true })
  const source = fs.readFileSync(rel('src', 'scene', 'layout.ts'), 'utf8')
  const js = (await transformWithOxc(source, 'layout.ts', {})).code
  const configLine = /import \{ config \} from ['"]\.\.\/config['"];?/
  if (!configLine.test(js)) throw new Error('the layout no longer imports the config the way this loader expects')
  const out = js.replace(configLine, `import fs from 'node:fs'\nconst config = JSON.parse(fs.readFileSync(${JSON.stringify(rel('config', 'showcase.json'))}, 'utf8'))`)
  const file = rel('out', 'work', 'village', 'layout.generated.mjs')
  fs.writeFileSync(file, out)
  return import(`${pathToFileURL(file).href}?t=${Date.now()}`)
}
