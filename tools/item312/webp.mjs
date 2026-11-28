// node tools/item312/webp.mjs
// Decision 312, T6, the second trial: spring's far picture as a lossless WebP beside the page, for the trials alone.
// The file is made anew by each job and is never committed. It is written only if every byte of its pixels is the
// byte of the PNG's, the colour under an alpha of 0 too.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import sharp from 'sharp'

const from = 'public/assets/spring/slab-far.srgb.w2048.png'
const to = 'public/trial312/slab-far.webp'
const a = await sharp(from).raw().toBuffer({ resolveWithObject: true })
const file = await sharp(from).webp({ lossless: true, exact: true }).toBuffer()
const b = await sharp(file).raw().toBuffer({ resolveWithObject: true })
let differ = a.info.width === b.info.width && a.info.height === b.info.height && a.info.channels === b.info.channels ? 0 : -1
if (differ === 0) for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) differ++
if (differ !== 0) {
  console.error(`the WebP is not the PNG's pixels: ${differ < 0 ? 'another size or kind' : `${differ} bytes differ`}; nothing is written`)
  process.exit(1)
}
fs.mkdirSync(path.dirname(to), { recursive: true })
fs.writeFileSync(to, file)
console.log(`${to}: ${file.length} bytes, ${a.info.width}x${a.info.height}, ${a.info.channels} channels, 0 bytes of the pixels differ from ${from} (${fs.statSync(from).size} bytes); sha256 of the pixels from the top down ${crypto.createHash('sha256').update(a.data).digest('hex')}`)
