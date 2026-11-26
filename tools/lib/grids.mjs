import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { createServer } from 'vite'
import { loadConfig, rel } from './paths.mjs'

// The colliders of the four seasons, made by the build and not by the page.
//
// A season's collider is a grid of 64 x 64 x 64 distances (src/scene/layout.ts, `gridOf`), read from the season's own shapes
// and from what its models say of themselves. Made on the page it stopped the picture for two to three seconds a season. The
// layout never changes, so the build makes each grid once, in Node, from the same code and the same models, and the page
// fetches it beside the assets (src/scene/gridfile.ts says how it is packed; src/scene/stage.ts fetches it).
//
// `npm run build` needs nothing for this but the repo's packages: the code is loaded through Vite as tools/poster.mjs loads
// the framing, and the models are the tracked files of the web set.

export const GRID_FOLDER = 'assets/grids'
const SOURCES = { assets: '/src/core/assets.ts', textures: '/src/core/textures.ts', models: '/src/core/models.ts', seasons: '/src/seasons/index.ts', file: '/src/scene/gridfile.ts' }

const modelsOf = (root, group) =>
  fs.existsSync(path.join(root, group))
    ? fs
        .readdirSync(path.join(root, group))
        .filter((f) => f.endsWith('.glb'))
        .sort()
        .map((f) => ({ path: `${group}/${f}`, bytes: 0, sha: '' }))
    : []

/**
 * The collider of each season as its kit makes it, with the models read from the folder of a set. `src` holds the modules of
 * the app it needs (SOURCES), however they were loaded. A collider reads models and nothing else of the assets: one that asked
 * for a picture would fail here, loudly, and not make another grid than the page's.
 */
export async function seasonGrids(src, root = rel('public', 'assets'), seasons = loadConfig().seasons) {
  const groups = ['shared', ...seasons]
  const assets = new src.assets.Assets()
  assets.use({ version: 1, sets: { web: Object.fromEntries(groups.map((g) => [g, modelsOf(root, g)])) }, seasonHashes: {} }, 'web')
  assets.fetchFile = async (file) => {
    const b = await fs.promises.readFile(path.join(root, file))
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
  }
  await src.textures.prepareGroup(assets, 'shared')
  const out = {}
  for (const season of seasons) {
    await src.textures.prepareGroup(assets, season)
    await Promise.all([...assets.files('shared'), ...assets.files(season)].map((f) => src.models.prepareModel(f.path)))
    out[season] = src.seasons.kitOf(season).collider()
  }
  return out
}

/** The file of a grid as the host keeps it. */
export const gridFile = (src, grid) => zlib.gzipSync(src.file.packGrid(grid), { level: 9 })

const sameBits = (a, b) => a.n === b.n && a.sizeMm === b.sizeMm && Buffer.compare(Buffer.from(a.data.buffer, a.data.byteOffset, a.data.byteLength), Buffer.from(b.data.buffer, b.data.byteOffset, b.data.byteLength)) === 0

async function withSource(run) {
  const server = await createServer({ configFile: rel('vite.config.ts'), root: rel(), server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
  try {
    const src = {}
    for (const [name, file] of Object.entries(SOURCES)) src[name] = await server.ssrLoadModule(file)
    return await run(src)
  } finally {
    await server.close()
  }
}

/** Every season's grid file, each read back and held against the grid it was made from before it is given out. */
export function bakeGridFiles(seasons = loadConfig().seasons) {
  return withSource(async (src) => {
    const grids = await seasonGrids(src, rel('public', 'assets'), seasons)
    const files = {}
    for (const season of seasons) {
      const file = gridFile(src, grids[season])
      if (!sameBits(src.file.unpackGrid(new Uint8Array(zlib.gunzipSync(file))), grids[season])) throw new Error(`the grid file of ${season} does not give its grid back to the bit`)
      files[season] = file
    }
    return files
  })
}

/**
 * The build writes the four files into `dist/assets/grids/`. The development server makes a season's file when the page first
 * asks for it and keeps it until the server ends.
 */
export function grids() {
  const made = new Map()
  return {
    name: 'showcase-grids',
    async generateBundle() {
      const t = Date.now()
      const files = await bakeGridFiles()
      for (const [season, file] of Object.entries(files)) this.emitFile({ type: 'asset', fileName: `${GRID_FOLDER}/${season}.bin`, source: file })
      const kb = Object.values(files).reduce((n, f) => n + f.length, 0) / 1024
      this.info(`colliders: ${Object.keys(files).length} grids, ${kb.toFixed(0)} kB, made in ${((Date.now() - t) / 1000).toFixed(1)} s`)
    },
    configureServer(server) {
      const seasons = loadConfig().seasons
      server.middlewares.use((req, res, next) => {
        const m = new RegExp(`/${GRID_FOLDER}/([a-z]+)\\.bin(\\?|$)`).exec(req.url ?? '')
        const season = m?.[1]
        if (!season || !seasons.includes(season)) return next()
        let file = made.get(season)
        if (!file) made.set(season, (file = bakeGridFiles([season]).then((f) => f[season])))
        file.then(
          (bytes) => {
            res.writeHead(200, { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' })
            res.end(bytes)
          },
          (e) => {
            made.delete(season)
            res.writeHead(500, { 'content-type': 'text/plain' })
            res.end(String(e?.message ?? e))
          },
        )
      })
    },
  }
}
