// A small zip writer and reader for the records of a render. Node has none of its own, and the handoff starts no
// program a machine may lack: no zip, no tar, no PowerShell for this. Deflate comes from node's zlib.
// It writes plain zip (no zip64): at most 65,535 files and under 4 GB in all, which records never reach.
import fs from 'node:fs'
import zlib from 'node:zlib'

const TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

/** The CRC-32 of a buffer, as zip wants it. */
export function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const dosTime = (d) => ({
  time: ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() >> 1) & 31),
  date: (((Math.max(1980, d.getFullYear()) - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31),
})

export const ZIP_MOST_FILES = 65535
export const ZIP_MOST_BYTES = 0xffffffff

/**
 * Writes a zip. `entries` is [{ name, data }] or [{ name, file }]: names with forward slashes, in UTF-8.
 * @returns {{ file: string, entries: number, bytes: number }}
 */
export function zipWrite(outFile, entries) {
  if (entries.length > ZIP_MOST_FILES) throw new Error(`${entries.length} files are more than a plain zip holds (${ZIP_MOST_FILES})`)
  const seen = new Set()
  for (const e of entries) {
    if (!e.name || e.name.startsWith('/') || e.name.includes('\\') || e.name.split('/').includes('..')) throw new Error(`"${e.name}" is no name for a file in a zip`)
    if (seen.has(e.name)) throw new Error(`"${e.name}" is named twice for one zip`)
    seen.add(e.name)
  }
  const tmp = `${outFile}.${process.pid}.tmp`
  const fd = fs.openSync(tmp, 'w')
  const central = []
  let at = 0
  const put = (buf) => {
    fs.writeSync(fd, buf)
    at += buf.length
  }
  try {
    for (const e of entries) {
      const data = e.data !== undefined ? Buffer.from(e.data) : fs.readFileSync(e.file)
      const when = dosTime(e.time ?? (e.file ? fs.statSync(e.file).mtime : new Date()))
      const name = Buffer.from(e.name, 'utf8')
      const packed = zlib.deflateRawSync(data, { level: 9 })
      const store = packed.length >= data.length
      const body = store ? data : packed
      const crc = crc32(data)
      const offset = at
      const head = Buffer.alloc(30)
      head.writeUInt32LE(0x04034b50, 0)
      head.writeUInt16LE(20, 4)
      head.writeUInt16LE(0x0800, 6) // names are UTF-8
      head.writeUInt16LE(store ? 0 : 8, 8)
      head.writeUInt16LE(when.time, 10)
      head.writeUInt16LE(when.date, 12)
      head.writeUInt32LE(crc, 14)
      head.writeUInt32LE(body.length, 18)
      head.writeUInt32LE(data.length, 22)
      head.writeUInt16LE(name.length, 26)
      head.writeUInt16LE(0, 28)
      put(head)
      put(name)
      put(body)
      if (at > ZIP_MOST_BYTES) throw new Error('the files are more than a plain zip holds (4 GB)')
      central.push({ name, crc, packed: body.length, size: data.length, method: store ? 0 : 8, when, offset })
    }
    const start = at
    for (const c of central) {
      const h = Buffer.alloc(46)
      h.writeUInt32LE(0x02014b50, 0)
      h.writeUInt16LE(20, 4)
      h.writeUInt16LE(20, 6)
      h.writeUInt16LE(0x0800, 8)
      h.writeUInt16LE(c.method, 10)
      h.writeUInt16LE(c.when.time, 12)
      h.writeUInt16LE(c.when.date, 14)
      h.writeUInt32LE(c.crc, 16)
      h.writeUInt32LE(c.packed, 20)
      h.writeUInt32LE(c.size, 24)
      h.writeUInt16LE(c.name.length, 28)
      h.writeUInt32LE(c.offset, 42)
      put(h)
      put(c.name)
    }
    const end = Buffer.alloc(22)
    end.writeUInt32LE(0x06054b50, 0)
    end.writeUInt16LE(central.length, 8)
    end.writeUInt16LE(central.length, 10)
    end.writeUInt32LE(at - start, 12)
    end.writeUInt32LE(start, 16)
    put(end)
    if (at > ZIP_MOST_BYTES) throw new Error('the files are more than a plain zip holds (4 GB)')
  } catch (e) {
    fs.closeSync(fd)
    fs.rmSync(tmp, { force: true })
    throw e
  }
  fs.closeSync(fd)
  fs.rmSync(outFile, { force: true })
  fs.renameSync(tmp, outFile)
  return { file: outFile, entries: central.length, bytes: at }
}

/**
 * Reads a zip back whole: every file's name, size and content, each checked against its CRC-32.
 * @returns {{ name: string, size: number, data: Buffer }[]}
 */
export function zipRead(file) {
  const buf = fs.readFileSync(file)
  let end = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      end = i
      break
    }
  }
  if (end < 0) throw new Error(`${file} is no zip: it has no end record`)
  const count = buf.readUInt16LE(end + 10)
  let at = buf.readUInt32LE(end + 16)
  const out = []
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(at) !== 0x02014b50) throw new Error(`${file} is no whole zip: entry ${n + 1} of its list is broken`)
    const method = buf.readUInt16LE(at + 10)
    const crc = buf.readUInt32LE(at + 16)
    const packed = buf.readUInt32LE(at + 20)
    const size = buf.readUInt32LE(at + 24)
    const nameLen = buf.readUInt16LE(at + 28)
    const extraLen = buf.readUInt16LE(at + 30)
    const noteLen = buf.readUInt16LE(at + 32)
    const offset = buf.readUInt32LE(at + 42)
    const name = buf.toString('utf8', at + 46, at + 46 + nameLen)
    if (buf.readUInt32LE(offset) !== 0x04034b50) throw new Error(`${file} is no whole zip: "${name}" is not where its list says`)
    const from = offset + 30 + buf.readUInt16LE(offset + 26) + buf.readUInt16LE(offset + 28)
    const body = buf.subarray(from, from + packed)
    const data = method === 0 ? Buffer.from(body) : zlib.inflateRawSync(body)
    if (data.length !== size || crc32(data) !== crc) throw new Error(`${file}: "${name}" does not unpack to what its list says`)
    out.push({ name, size, data })
    at += 46 + nameLen + extraLen + noteLen
  }
  return out
}
