import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { rel } from './paths.mjs'

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.ktx2': 'image/ktx2', '.wasm': 'application/wasm' }

const safe = (root, p) => {
  const full = path.normalize(path.join(root, p))
  return full.startsWith(root) ? full : null
}

export async function serve({ dist = rel('dist'), simcache = rel('out', 'work', 'simcache'), port = 0 } = {}) {
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('dist/ is missing. Run npm run build first.')
  const mounts = [['/assets-full/', rel('assets-full')]]
  const server = http.createServer((req, res) => {
    let url
    try {
      url = new URL(req.url.replace(/^\/+/, '/'), 'http://x')
    } catch {
      res.writeHead(400)
      return res.end('bad request')
    }
    let p = decodeURIComponent(url.pathname)
    const send = (code, body, type = 'text/plain') => {
      res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' })
      res.end(body)
    }
    if (p.startsWith('/__simcache/')) {
      const parts = p.slice('/__simcache/'.length).split('/')
      const key = (parts[0] ?? '').replace(/[^a-zA-Z0-9_-]/g, '')
      const dir = path.join(simcache, key)
      if (!key) return send(400, 'bad key')
      if (!parts[1]) {
        const steps = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.bin')).map((f) => Number(f.slice(0, -4))) : []
        return send(200, JSON.stringify(steps.sort((a, b) => a - b)), TYPES['.json'])
      }
      const name = parts[1].replace(/[^0-9]/g, '')
      const file = path.join(dir, `${name}.bin`)
      if (req.method === 'PUT') {
        const chunks = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', () => {
          fs.mkdirSync(dir, { recursive: true })
          fs.writeFileSync(`${file}.tmp`, Buffer.concat(chunks))
          fs.renameSync(`${file}.tmp`, file)
          send(200, 'ok')
        })
        return
      }
      if (!fs.existsSync(file)) return send(404, 'none')
      return send(200, fs.readFileSync(file), TYPES['.bin'])
    }
    let root = dist
    for (const [prefix, dir] of mounts) {
      if (p.startsWith(prefix)) {
        root = dir
        p = p.slice(prefix.length - 1)
      }
    }
    if (p.endsWith('/')) p += 'index.html'
    const file = safe(root, p)
    if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(404, 'not found')
    const stat = fs.statSync(file)
    const type = TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
    const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range)
    if (range) {
      const start = range[1] ? Number(range[1]) : 0
      const end = range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1
      res.writeHead(206, { 'content-type': type, 'content-range': `bytes ${start}-${end}/${stat.size}`, 'accept-ranges': 'bytes', 'content-length': end - start + 1 })
      return fs.createReadStream(file, { start, end }).pipe(res)
    }
    res.writeHead(200, { 'content-type': type, 'content-length': stat.size, 'accept-ranges': 'bytes', 'cache-control': 'no-store' })
    fs.createReadStream(file).pipe(res)
  })
  await new Promise((r) => server.listen(port, '127.0.0.1', r))
  const url = `http://127.0.0.1:${server.address().port}/`
  return { url, close: () => new Promise((r) => server.close(r)) }
}
