// Diagnosis of film frame 2828 (order diag-2828, decision 286). Branch agent/p6-diag-2828, never merged.
// This script runs in the page before any script of the page. It watches the WebGL2 calls and keeps what the stages S, U, T, P, A and C need.
// It calls nothing of its own on the card in the modes "full" and "lite", but for one read of the canvas when the picture is handed over.
// In the mode "trace" it reads the watched pixel after every drawing into the sample and so is no part of the count.
(() => {
  if (window.__d2828) return
  const CFG = window.__D_CFG || { mode: 'full', x: 731, y: 694 }
  const proto = WebGL2RenderingContext.prototype
  const O = {}
  const D = (window.__d2828 = {
    cfg: CFG,
    lines: [],
    ids: new WeakMap(),
    next: {},
    locName: new WeakMap(),
    shaderInfo: new WeakMap(),
    progInfo: new WeakMap(),
    curProg: null,
    drawFb: null,
    sample: -1,
    inSample: false,
    sampleDraw: 0,
    sampleUp: 0,
    drawNo: 0,
    reads: [],
    ups: [],
    raws: [],
    tags: new WeakMap(),
    respUrl: new WeakMap(),
    fetches: [],
    bitmaps: [],
    px: [],
    S: [],
    C: null,
    src: {},
    notes: [],
  })

  const hex = (h) => (h >>> 0).toString(16).padStart(8, '0')
  const bytesOf = (src) => (src instanceof ArrayBuffer ? new Uint8Array(src) : new Uint8Array(src.buffer, src.byteOffset, src.byteLength))
  const hashBytes = (src) => {
    const u8 = bytesOf(src)
    const n = u8.length
    let h1 = 0x811c9dc5 | 0
    let h2 = 0x9e3779b9 | 0
    const words = n >>> 2
    let i = 0
    if (words > 0) {
      const u32 = (u8.byteOffset & 3) === 0 ? new Uint32Array(u8.buffer, u8.byteOffset, words) : new Uint32Array(u8.slice(0, words * 4).buffer)
      for (let k = 0; k < words; k++) {
        const w = u32[k]
        h1 = Math.imul(h1 ^ w, 0x01000193)
        h1 ^= h1 >>> 15
        h2 = Math.imul((h2 + w) | 0, 0x85ebca6b)
        h2 ^= h2 >>> 13
      }
      i = words * 4
    }
    for (; i < n; i++) {
      h1 = Math.imul(h1 ^ u8[i], 0x01000193)
      h1 ^= h1 >>> 15
      h2 = Math.imul((h2 + u8[i]) | 0, 0x85ebca6b)
      h2 ^= h2 >>> 13
    }
    h1 = Math.imul(h1 ^ n, 0x01000193)
    h2 = Math.imul((h2 + n) | 0, 0x85ebca6b)
    return hex(h1) + hex(h2)
  }
  D.hashBytes = hashBytes
  const enc = new TextEncoder()
  const hashStr = (s) => hashBytes(enc.encode(s))
  D.hashStr = hashStr

  const idOf = (o) => {
    if (o === null || o === undefined) return 'null'
    let i = D.ids.get(o)
    if (!i) {
      const k = (o.constructor && o.constructor.name ? o.constructor.name : 'Obj').replace('WebGL', '')
      D.next[k] = (D.next[k] || 0) + 1
      i = k + D.next[k]
      D.ids.set(o, i)
    }
    return i
  }
  D.idOf = idOf

  const ser = (a) => {
    if (a === null || a === undefined) return 'null'
    const t = typeof a
    if (t === 'number' || t === 'boolean') return String(a)
    if (t === 'string') return a.length > 80 ? `str${a.length}:${hashStr(a)}` : JSON.stringify(a)
    if (ArrayBuffer.isView(a) || a instanceof ArrayBuffer) return `${a.constructor.name}[${a.byteLength}]:${hashBytes(a)}`
    if (Array.isArray(a)) return '[' + a.map(ser).join(',') + ']'
    if (a instanceof WebGLUniformLocation) return 'loc:' + (D.locName.get(a) || '?')
    if (typeof ImageBitmap !== 'undefined' && a instanceof ImageBitmap) return `bitmap(${a.width}x${a.height})${D.tags.get(a) || ''}`
    if (a instanceof HTMLCanvasElement || (typeof OffscreenCanvas !== 'undefined' && a instanceof OffscreenCanvas)) return `canvas(${a.width}x${a.height})`
    if (a instanceof ImageData) return `imagedata(${a.width}x${a.height}):${hashBytes(a.data)}`
    if (a instanceof HTMLImageElement) return `img(${a.naturalWidth}x${a.naturalHeight})`
    return idOf(a)
  }

  const want = (op, pick) => (CFG.whatif || []).find((w) => w.op === op && pick(w))
  const BIND = { 0x8892: 0x8894, 0x8893: 0x8895, 0x8a11: 0x8a28, 0x88eb: 0x88ed, 0x88ec: 0x88ef, 0x8f36: 0x8f36, 0x8f37: 0x8f37, 0x8c8e: 0x8c8f }
  const READ_FB = 0x8ca8
  const READ_FB_BINDING = 0x8caa
  const RGBA = 0x1908
  const FLOAT = 0x1406

  // the framebuffer of the accumulator's sample target, as three.js keeps it; null until it is made
  const sampleFb = () => {
    const d = window.__diag
    if (!d) return null
    const p = d.gfx.renderer.properties.get(d.acc().sample)
    return (p && p.__webglFramebuffer) || null
  }
  const readAt = (gl, x, y, w, h) => {
    const prev = O.getParameter.call(gl, READ_FB_BINDING)
    if (prev !== D.drawFb) O.bindFramebuffer.call(gl, READ_FB, D.drawFb)
    const out = new Float32Array(w * h * 4)
    O.readPixels.call(gl, x, y, w, h, RGBA, FLOAT, out)
    if (prev !== D.drawFb) O.bindFramebuffer.call(gl, READ_FB, prev)
    return Array.from(out)
  }
  const same = (p, q) => p.every((v, i) => Object.is(v, q[i]))

  // which instances (or points) of one drawing leave a mark on the watched pixel: prefixes of the drawing under a scissor of that one pixel, depth not written, the pixel put back after
  const cover = (gl, orig, a, name, centre) => {
    let at = -1
    if (name === 'drawElementsInstanced') at = 4
    else if (name === 'drawArraysInstanced') at = 3
    else if (name === 'drawArrays' && a[0] === 0) at = 2
    if (at < 0 || !(a[at] > 1)) return null
    const total = a[at]
    const gy = CFG.h - 1 - CFG.y
    const sc = O.isEnabled.call(gl, 0x0c11)
    const box = O.getParameter.call(gl, 0x0c10)
    const dm = O.getParameter.call(gl, 0x0b72)
    const cm = O.getParameter.call(gl, 0x0c23)
    O.enable.call(gl, 0x0c11)
    O.scissor.call(gl, CFG.x, gy, 1, 1)
    O.depthMask.call(gl, false)
    O.colorMask.call(gl, true, true, true, true)
    const ground = new Float32Array([0.5, 0.25, 0.125, 0.5])
    let tries = 0
    const prefix = (m) => {
      tries++
      O.clearBufferfv.call(gl, 0x1800, 0, ground)
      if (m > 0) {
        const b = a.slice()
        b[at] = m
        orig.apply(gl, b)
      }
      return readAt(gl, CFG.x, gy, 1, 1)
    }
    const found = []
    let base = prefix(0)
    let from = 0
    const full = prefix(total)
    while (found.length < 16 && !same(base, full)) {
      let lo = from
      let hi = total
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1
        if (same(prefix(mid), base)) lo = mid
        else hi = mid
      }
      const v = prefix(hi)
      found.push({ index: hi - 1, onGround: v })
      base = v
      from = hi
    }
    O.clearBufferfv.call(gl, 0x1800, 0, new Float32Array(centre))
    O.colorMask.call(gl, cm[0], cm[1], cm[2], cm[3])
    O.depthMask.call(gl, dm)
    O.scissor.call(gl, box[0], box[1], box[2], box[3])
    if (!sc) O.disable.call(gl, 0x0c11)
    return { total, tries, found, ground: Array.from(ground), full }
  }

  const traced = (gl, orig, a, name, k, tag, info) => {
    const fb = sampleFb()
    if (!fb || D.drawFb !== fb) {
      D.lines.push(tag)
      return orig.apply(gl, a)
    }
    const gy = CFG.h - 1 - CFG.y
    const before = readAt(gl, CFG.x - 1, gy - 1, 3, 3)
    const r = orig.apply(gl, a)
    const after = readAt(gl, CFG.x - 1, gy - 1, 3, 3)
    D.lines.push(tag)
    const c0 = before.slice(16, 20)
    const c1 = after.slice(16, 20)
    const rec = { sample: D.sample, k, name: info.name || '?', prog: idOf(D.curProg), call: name, args: a.slice(), centre: !same(c0, c1), block: !same(before, after), before: c0, after: c1 }
    if (rec.block && !rec.centre) {
      rec.blockBefore = before
      rec.blockAfter = after
    }
    if (rec.centre) rec.units = cover(gl, orig, a, name, c1)
    D.px.push(rec)
    return r
  }

  const DRAWS = new Set(['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements'])
  const QUIET = (name) => name.startsWith('get') || name.startsWith('is') || name === 'checkFramebufferStatus' || name === 'makeXRCompatible'

  for (const name of Object.getOwnPropertyNames(proto)) {
    const d = Object.getOwnPropertyDescriptor(proto, name)
    if (!d || typeof d.value !== 'function' || name === 'constructor') continue
    const orig = d.value
    O[name] = orig
    let f
    if (name === 'getUniformLocation') {
      f = function (p, n) {
        const loc = orig.call(this, p, n)
        if (loc) D.locName.set(loc, n)
        return loc
      }
    } else if (QUIET(name)) continue
    else if (name.startsWith('create')) {
      f = function (...a) {
        const o = orig.apply(this, a)
        const id = idOf(o)
        if (name === 'createShader' && o) D.shaderInfo.set(o, { type: a[0] })
        D.lines.push(`${name} ${a.join(' ')} -> ${id}`)
        return o
      }
    } else if (name === 'shaderSource') {
      f = function (s, src) {
        const info = D.shaderInfo.get(s) || {}
        const m = /#define SHADER_NAME (\S+)/.exec(src)
        const t = /#define SHADER_TYPE (\S+)/.exec(src)
        info.name = m ? m[1] : t ? t[1] : ''
        info.hash = hashStr(src)
        D.shaderInfo.set(s, info)
        if (CFG.keepSrc) D.src[idOf(s)] = src
        D.lines.push(`shaderSource ${idOf(s)} ${info.name} ${info.hash}`)
        return orig.call(this, s, src)
      }
    } else if (name === 'attachShader') {
      f = function (p, s) {
        const si = D.shaderInfo.get(s) || {}
        const pi = D.progInfo.get(p) || {}
        if (si.type === 0x8b30) {
          pi.name = si.name
          pi.fs = si.hash
          pi.fsId = idOf(s)
        } else {
          pi.vs = si.hash
          pi.vsId = idOf(s)
          if (!pi.name) pi.name = si.name
        }
        D.progInfo.set(p, pi)
        D.lines.push(`attachShader ${idOf(p)} ${idOf(s)}`)
        return orig.call(this, p, s)
      }
    } else if (name === 'useProgram') {
      f = function (p) {
        D.curProg = p
        D.lines.push(`useProgram ${idOf(p)}`)
        return orig.call(this, p)
      }
    } else if (name === 'bindFramebuffer') {
      f = function (target, fb) {
        if (target === 0x8d40 || target === 0x8ca9) D.drawFb = fb
        D.lines.push(`bindFramebuffer ${target} ${idOf(fb)}`)
        return orig.call(this, target, fb)
      }
    } else if (DRAWS.has(name)) {
      f = function (...a) {
        const info = D.progInfo.get(D.curProg) || {}
        D.drawNo++
        const tag = `${name} ${a.join(' ')} prog=${idOf(D.curProg)}:${info.name || '?'} fb=${idOf(D.drawFb)}`
        if (D.inSample) {
          const k = D.sampleDraw++
          if (want('skipDraw', (w) => (w.sample === -1 || w.sample === D.sample) && w.k === k)) {
            D.lines.push('#left out: ' + tag)
            D.notes.push(`left out drawing ${k} of sample ${D.sample}: ${tag}`)
            return undefined
          }
          if (CFG.mode === 'trace') return traced(this, orig, a, name, k, tag, info)
        }
        D.lines.push(tag)
        return orig.apply(this, a)
      }
    } else if (name === 'readPixels') {
      f = function (...a) {
        const r = orig.apply(this, a)
        const dst = a[6]
        let hash = 'none'
        if (dst && ArrayBuffer.isView(dst)) {
          hash = hashBytes(dst)
          const rec = { sample: D.inSample ? D.sample : -1, after: D.sample, x: a[0], y: a[1], w: a[2], h: a[3], format: a[4], type: a[5], bytes: dst.byteLength, hash }
          if (a[2] === CFG.w && a[3] === CFG.h && D.inSample) {
            // one sample whole: a hash for every row as well, the bottom row first, and the watched pixel with its neighbours
            const row = dst.byteLength / a[3]
            const u8 = bytesOf(dst)
            rec.rows = []
            for (let y = 0; y < a[3]; y++) rec.rows.push(hashBytes(u8.subarray(y * row, (y + 1) * row)))
            if (CFG.keepRaw || (CFG.refReads && !CFG.refReads.includes(hash))) D.raws.push({ what: 'P', sample: D.sample, w: a[2], h: a[3], type: a[5], data: u8.slice() })
          } else if (a[2] === CFG.w && a[3] > 1 && dst.byteLength >= 1 << 20) {
            if (CFG.keepRaw || (CFG.refReads && !CFG.refReads.includes(hash))) D.raws.push({ what: 'A', sample: -1, y: a[1], w: a[2], h: a[3], type: a[5], data: bytesOf(dst).slice() })
          }
          D.reads.push(rec)
        }
        D.lines.push(`readPixels ${a.slice(0, 6).join(' ')} -> ${hash}`)
        return r
      }
    } else if (name === 'bufferData' || name === 'bufferSubData') {
      f = function (...a) {
        const sub = name === 'bufferSubData'
        const data = sub ? a[2] : a[1]
        const srcOffset = (sub ? a[3] : a[3]) || 0
        const length = (sub ? a[4] : a[4]) || 0
        const buf = O.getParameter.call(this, BIND[a[0]] || 0x8894)
        let part = null
        if (data && typeof data !== 'number') {
          if (ArrayBuffer.isView(data) && !(data instanceof DataView)) part = srcOffset || length ? data.subarray(srcOffset, length ? srcOffset + length : undefined) : data
          else part = data
        }
        const rec = { sample: D.inSample ? D.sample : -1, n: -1, call: name, target: a[0], buf: idOf(buf), off: sub ? a[1] : 0, bytes: part ? part.byteLength : data, hash: part ? hashBytes(part) : 'size', srcOffset, length }
        if (D.inSample) {
          rec.n = D.sampleUp++
          if (want('skipUpload', (w) => (w.sample === -1 || w.sample === D.sample) && w.n === rec.n)) {
            D.lines.push(`#left out: ${name} ${rec.buf} n=${rec.n}`)
            D.notes.push(`left out upload ${rec.n} of sample ${D.sample}: ${name} ${rec.buf} off=${rec.off} bytes=${rec.bytes} hash=${rec.hash}`)
            return undefined
          }
        }
        if (part && part.byteLength >= 1 << 16) {
          const u8 = bytesOf(part)
          const step = Math.ceil(u8.length / 32 / 4) * 4
          rec.chunks = []
          for (let o = 0; o < u8.length; o += step) rec.chunks.push(hashBytes(u8.subarray(o, Math.min(u8.length, o + step))))
          rec.chunkBytes = step
          if (D.inSample && (CFG.keepRaw || (CFG.refUps && !CFG.refUps.includes(rec.hash)))) D.raws.push({ what: 'U', sample: D.sample, n: rec.n, buf: rec.buf, off: rec.off, data: u8.slice() })
        }
        D.ups.push(rec)
        D.lines.push(`${name} ${a[0]} buf=${rec.buf} off=${rec.off} bytes=${rec.bytes} hash=${rec.hash}${sub ? '' : ' usage=' + a[2]}`)
        return orig.apply(this, a)
      }
    } else {
      f = function (...a) {
        D.lines.push(`${name} ${a.map(ser).join(' ')}`)
        return orig.apply(this, a)
      }
    }
    proto[name] = f
  }

  // the canvas as it stands when the picture is handed over (stage C, between A and F)
  const tdu = HTMLCanvasElement.prototype.toDataURL
  HTMLCanvasElement.prototype.toDataURL = function (...a) {
    if (this.id === 'view' && !CFG.noC) {
      const gl = this.getContext('webgl2')
      const w = gl.drawingBufferWidth
      const h = gl.drawingBufferHeight
      const buf = new Uint8Array(w * h * 4)
      const prev = O.getParameter.call(gl, READ_FB_BINDING)
      if (prev !== null) O.bindFramebuffer.call(gl, READ_FB, null)
      O.readPixels.call(gl, 0, 0, w, h, RGBA, 0x1401, buf)
      if (prev !== null) O.bindFramebuffer.call(gl, READ_FB, prev)
      const o = ((h - 1 - CFG.y) * w + CFG.x) * 4
      D.C = { hash: hashBytes(buf), at: Array.from(buf.subarray(o, o + 4)), w, h }
      D.lines.push('#grab')
    }
    return tdu.apply(this, a)
  }

  // the order in which loads begin and end, and the name of the file a picture came from
  const fetch0 = window.fetch
  let fseq = 0
  window.fetch = function (input, init) {
    const url = String(input && input.url ? input.url : input).replace(location.origin, '')
    const rec = { url, start: fseq++, end: -1, method: (init && init.method) || 'GET' }
    D.fetches.push(rec)
    const p = fetch0.apply(this, arguments)
    p.then(
      (r) => {
        rec.end = fseq++
        rec.status = r.status
        D.respUrl.set(r, url)
      },
      () => {
        rec.end = fseq++
        rec.status = 'failed'
      },
    )
    return p
  }
  const ab0 = Response.prototype.arrayBuffer
  Response.prototype.arrayBuffer = function () {
    const p = ab0.call(this)
    const url = D.respUrl.get(this)
    if (url) p.then((buf) => D.tags.set(buf, ':' + url), () => {})
    return p
  }
  const Blob0 = window.Blob
  const BlobX = function Blob(parts, opts) {
    const b = new Blob0(parts, opts)
    if (parts && parts.length === 1 && parts[0] && typeof parts[0] === 'object') {
      const t = D.tags.get(parts[0]) || (parts[0].buffer ? D.tags.get(parts[0].buffer) : undefined)
      if (t) D.tags.set(b, t)
    }
    return b
  }
  BlobX.prototype = Blob0.prototype
  window.Blob = BlobX
  const cib0 = window.createImageBitmap
  window.createImageBitmap = function (src, ...rest) {
    const p = cib0.call(this, src, ...rest)
    const tag = (src && typeof src === 'object' && D.tags.get(src)) || ''
    const rec = { asked: D.bitmaps.length, tag, w: 0, h: 0, done: -1 }
    D.bitmaps.push(rec)
    p.then(
      (bm) => {
        rec.w = bm.width
        rec.h = bm.height
        rec.done = D.bitmaps.filter((b) => b.done >= 0).length
        if (tag) D.tags.set(bm, tag)
      },
      () => {},
    )
    return p
  }

  // called by the runner when the page is ready: the two calls of the page that bound a sample are wrapped, so that every line kept above is known by its sample
  D.install = () => {
    const d = window.__diag
    if (!d) throw new Error('this build does not show __diag')
    const src = d.particles
    const stage = d.stage
    const info = d.gfx.renderer.info
    const A = Object.getPrototypeOf(d.acc())
    const add0 = A.add
    const draw0 = stage.drawSample
    const h = (a) => (a ? hashBytes(a) : 'none')
    D.kept = []
    // the order in which the seasons' sets were made, as the numbers three.js gave their objects and materials tell it
    D.made = () => {
      const out = []
      for (const [season, set] of stage.sets) {
        const ids = []
        const mats = []
        for (const root of set.objects)
          root.traverse((o) => {
            ids.push(o.id)
            if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) mats.push(m.id)
          })
        const things = []
        for (const root of set.objects)
          root.traverse((o) => {
            if (!o.geometry) return
            const names = []
            for (let q = o; q && names.length < 5; q = q.parent) names.push(q.name || q.type)
            const g = o.geometry
            things.push({
              id: o.id,
              names: names.join(' < '),
              type: o.type,
              visible: o.visible,
              renderOrder: o.renderOrder,
              count: g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0,
              mats: (Array.isArray(o.material) ? o.material : [o.material]).map((m) => ({ id: m.id, type: m.type, name: m.name, transparent: m.transparent, depthWrite: m.depthWrite, depthTest: m.depthTest, depthFunc: m.depthFunc, side: m.side, offset: m.polygonOffset ? [m.polygonOffsetFactor, m.polygonOffsetUnits] : null, opacity: m.opacity })),
            })
          })
        out.push({ season, shown: set.shown, objects: ids.length, idMin: Math.min(...ids), idMax: Math.max(...ids), materials: new Set(mats).size, matMin: Math.min(...mats), matMax: Math.max(...mats), things })
      }
      return out
    }
    // what-if: the seasons' sets made in another order. The numbers of their objects and materials are dealt anew over the same places, set by set in the order given, and the two sorts of three.js read the new numbers.
    D.applySorts = () => {
      const w = (CFG.whatif || []).find((x) => x.op === 'madeOrder')
      const r = d.gfx.renderer
      if (!w) {
        r.setOpaqueSort(null)
        r.setTransparentSort(null)
        return
      }
      const objs = []
      const mats = []
      for (const season of w.order) {
        const set = stage.sets.get(season)
        if (!set) continue
        const own = []
        for (const root of set.objects) root.traverse((o) => own.push(o))
        own.sort((p, q) => p.id - q.id)
        for (const o of own) {
          objs.push(o.id)
          if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (!mats.includes(m.id)) mats.push(m.id)
        }
      }
      const deal = (list) => {
        const places = [...list].sort((p, q) => p - q)
        return new Map(list.map((id, i) => [id, places[i]]))
      }
      const om = deal(objs)
      const mm = deal(mats)
      const O2 = (id) => om.get(id) ?? id
      const M2 = (id) => mm.get(id) ?? id
      r.setOpaqueSort((p, q) => (p.groupOrder !== q.groupOrder ? p.groupOrder - q.groupOrder : p.renderOrder !== q.renderOrder ? p.renderOrder - q.renderOrder : p.material.id !== q.material.id ? M2(p.material.id) - M2(q.material.id) : p.materialVariant !== q.materialVariant ? p.materialVariant - q.materialVariant : p.z !== q.z ? p.z - q.z : O2(p.id) - O2(q.id)))
      r.setTransparentSort((p, q) => (p.groupOrder !== q.groupOrder ? p.groupOrder - q.groupOrder : p.renderOrder !== q.renderOrder ? p.renderOrder - q.renderOrder : p.z !== q.z ? q.z - p.z : O2(p.id) - O2(q.id)))
      D.notes.push(`the sets taken as made in the order ${w.order.join(', ')}: ${objs.length} objects and ${mats.length} materials numbered anew`)
    }
    D.applySorts()
    stage.drawSample = function (target, pose, sample, moment, shadows) {
      const k = ++D.sample
      D.sampleDraw = 0
      D.sampleUp = 0
      const arrays = { pos: h(src.pos), prev: h(src.prev), sizes: h(src.sizes), opacity: h(src.opacity), phase: h(src.phase), kindOf: h(src.kindOf), state: h(src.state), liquid: h(src.liquid), cover: src.cover ? h(src.cover.mm) : 'none' }
      const meta = { sample: sample ? { ...sample } : null, moment: JSON.parse(JSON.stringify(moment)), pose: JSON.parse(JSON.stringify(pose)), shadows }
      D.S.push({ k, count: src.count, step: src.step, kinds: Array.from(src.kinds), arrays, liquid: Array.from(src.liquid), cover: src.cover ? { n: src.cover.n, spanMm: src.cover.spanMm } : null, meta, metaHash: hashStr(JSON.stringify(meta)), owed: d.owed(), memory: { ...info.memory }, programs: info.programs ? info.programs.length : -1 })
      if (CFG.keepArrays) D.kept.push({ pos: src.pos.slice(), prev: src.prev.slice(), sizes: src.sizes.slice(), opacity: src.opacity ? src.opacity.slice() : null, phase: src.phase ? src.phase.slice() : null, kindOf: src.kindOf.slice(), state: src.state.slice() })
      // what-ifs on single particles: left out of this sample, or drawn in this sample as given
      const undo = []
      const put = (arr, i, v) => {
        if (!arr) return
        const old = arr[i]
        undo.push(() => (arr[i] = old))
        arr[i] = v
      }
      for (const w of CFG.whatif || []) {
        if (w.sample !== -1 && w.sample !== k) continue
        if (w.op === 'hide') {
          put(src.sizes, w.index, 0)
          put(src.opacity, w.index, 0)
          D.notes.push(`particle ${w.index} left out of sample ${k}`)
        } else if (w.op === 'set') {
          const i = w.index
          const v = w.vals
          if (v.pos) for (let c = 0; c < 3; c++) put(src.pos, i * 3 + c, v.pos[c])
          if (v.prev) for (let c = 0; c < 3; c++) put(src.prev, i * 3 + c, v.prev[c])
          if (v.size !== undefined) put(src.sizes, i, v.size)
          if (v.opacity !== undefined) put(src.opacity, i, v.opacity)
          if (v.state !== undefined) put(src.state, i, v.state)
          if (v.phase !== undefined) put(src.phase, i, v.phase)
          D.notes.push(`particle ${i} drawn in sample ${k} as given: ${JSON.stringify(v)}`)
        }
      }
      D.lines.push(`#sample ${k} begin`)
      D.inSample = true
      try {
        return draw0.apply(this, arguments)
      } finally {
        for (const u of undo.reverse()) u()
        D.lines.push(`#sample ${k} drawn`)
      }
    }
    A.add = function () {
      try {
        return add0.apply(this, arguments)
      } finally {
        D.inSample = false
        D.lines.push(`#sample ${D.sample} added`)
      }
    }
    return true
  }

  // a new picture in the same page: what was kept of the last one is let go
  D.again = (whatif) => {
    CFG.whatif = whatif || []
    D.linesBefore = (D.linesBefore || 0) + D.lines.length
    D.lines = []
    D.sample = -1
    D.inSample = false
    D.reads = []
    D.ups = []
    D.raws = []
    D.px = []
    D.S = []
    D.kept = []
    D.C = null
    D.notes = []
    if (D.applySorts) D.applySorts()
  }
})()
