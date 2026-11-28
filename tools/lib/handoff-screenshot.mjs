import fs from 'node:fs'

export const LOOP_SCREENSHOT_MEASURE = 'BT.709 luma PSNR in dB'
const PNG = Buffer.from('89504e470d0a1a0a', 'hex')

export function validScreenshotSpec(spec, format) {
  return !!spec && Number.isSafeInteger(spec.width) && spec.width > 0 && spec.width === format?.width &&
    Number.isSafeInteger(spec.height) && spec.height > 0 && spec.height === format?.height &&
    [8, 16].includes(spec.bitDepth) && spec.measure === LOOP_SCREENSHOT_MEASURE &&
    Number.isFinite(spec.floorDb) && spec.floorDb > 0 && Number.isFinite(spec.measuredDb) &&
    Number.isFinite(spec.marginDb) && spec.marginDb > 0 && Math.abs(spec.measuredDb - spec.marginDb - spec.floorDb) < 1e-6 &&
    typeof spec.from === 'string' && !!spec.from.trim()
}

/** Reads the original PNG depth from IHDR, then decodes the full pixel buffer at that depth. */
export async function decodeScreenshot(file, expected) {
  try {
    const header = Buffer.alloc(29)
    const fd = fs.openSync(file, 'r')
    let bytes
    try { bytes = fs.readSync(fd, header, 0, header.length, 0) } finally { fs.closeSync(fd) }
    if (bytes !== header.length || !header.subarray(0, PNG.length).equals(PNG) || header.readUInt32BE(8) !== 13 || header.toString('ascii', 12, 16) !== 'IHDR') {
      return { ok: false, said: 'not a PNG with a whole picture header' }
    }
    const [width, height, bitDepth] = [header.readUInt32BE(16), header.readUInt32BE(20), header[24]]
    const size = `MEASURED: ${width} x ${height}, ${bitDepth}-bit PNG`
    if (width !== expected.width || height !== expected.height || bitDepth !== expected.bitDepth) return { ok: false, said: size }
    const sharp = (await import('sharp')).default
    const image = sharp(file, { failOn: 'warning', limitInputPixels: expected.width * expected.height })
    const { data, info } = await image.raw({ depth: bitDepth === 16 ? 'ushort' : 'uchar' }).toBuffer({ resolveWithObject: true })
    const ok = info.width === width && info.height === height && data.length === width * height * info.channels * (bitDepth === 16 ? 2 : 1)
    return { ok, said: ok ? `${size}, every pixel decoded` : `${size}, no whole decoded pixel buffer` }
  } catch {
    return { ok: false, said: 'the decoder could not read the entire PNG' }
  }
}

/** Compares the current MP4 and PNG by decoding them, never by using the earlier encode record. */
export async function compareLoopScreenshot({ file, png, fps, pixFmt, floorDb }) {
  const check = "screenshot: against the loop film's first frame"
  const wanted = floorDb === null ? 'a measured comparison on this small test; the release floor is for the master size' : `at least STATED ${floorDb} dB in luma (brightness)`
  try {
    const { framePsnr } = await import('./encode.mjs')
    const values = await framePsnr({ file, files: [png], fps, pixFmt, frames: 1 })
    const measured = values.length === 1 && Number.isFinite(values[0])
    return { check, wanted, found: measured ? `MEASURED: ${values[0].toFixed(2)} dB in luma (brightness)` : 'no complete comparison was measured', pass: measured && (floorDb === null || values[0] >= floorDb) }
  } catch {
    return { check, wanted, found: 'the first decoded film frame could not be compared with the PNG', pass: false }
  }
}
