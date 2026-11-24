import fs from 'node:fs'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { loadConfig, rel } from './paths.mjs'

const cfg = loadConfig()

const GOP_SECONDS = 2
const PEAK_RATIO = 1.5
const BUFFER_SECONDS = 2
// The encoder's bytes depend on its thread count, so it is pinned.
const ENCODER_THREADS = 2
const SCALER = 'flags=lanczos+accurate_rnd+full_chroma_int'
const TO_VIDEO = `scale=in_range=full:out_range=tv:out_color_matrix=bt709:${SCALER}`
const TO_PICTURE = `scale=in_range=tv:out_range=full:in_color_matrix=bt709:${SCALER},format=rgb24`
const TAGS = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv']
const EXACT = ['-map_metadata', '-1', '-fflags', '+bitexact']
const TIMING_SLACK_FRAMES = 0.02
const STILL_JPEG = { quality: 95, chromaSubsampling: '4:4:4' }

const VIDEO = {
  h264: {
    pixFmt: 'yuv420p',
    passes: 2,
    args: (s) => {
      const kbps = Math.round(s.mbps * 1000)
      const gop = String(Math.max(1, Math.round(s.fps * GOP_SECONDS)))
      return [
        '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
        '-b:v', `${kbps}k`, '-maxrate', `${Math.round(kbps * PEAK_RATIO)}k`, '-bufsize', `${Math.round(kbps * BUFFER_SECONDS)}k`,
        '-g', gop, '-keyint_min', gop, '-sc_threshold', '0', '-bf', '2', '-x264-params', 'aq-mode=3',
        '-threads', String(ENCODER_THREADS), '-flags:v', '+cgop+bitexact',
      ]
    },
  },
  prores_422_hq: {
    pixFmt: 'yuv422p10le',
    passes: 1,
    args: () => ['-c:v', 'prores_ks', '-profile:v', '3', '-vendor', 'apl0', '-pix_fmt', 'yuv422p10le', '-flags:v', '+bitexact'],
  },
}
const AUDIO = { aac: 'aac' }

export const stillJpeg = STILL_JPEG

export function videoSettings({ format, fps, local = false, mbps = null }) {
  const codec = local ? cfg.export.local.videoCodec : cfg.export.videoCodec
  if (!VIDEO[codec]) throw new Error(`no encoder for ${codec}`)
  const container = local ? cfg.export.local.container : cfg.export.container
  const rate = mbps ?? (format.id === cfg.formats.preview.id ? cfg.previewFilm.bitrateMbps : cfg.export.bitrateMbps)
  return { codec, container, fps, width: format.width, height: format.height, mbps: VIDEO[codec].passes > 1 ? rate : null, gopSeconds: VIDEO[codec].passes > 1 ? GOP_SECONDS : 0 }
}

export function tmpDir() {
  const dir = rel('out', 'work', 'tmp')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function ffmpeg(args, feed = null) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', ...(feed ? [] : ['-nostdin']), ...args], { stdio: [feed ? 'pipe' : 'ignore', 'ignore', 'pipe'] })
    let err = ''
    ff.stderr.on('data', (d) => (err = (err + d).slice(-4000)))
    ff.on('error', (e) => reject(new Error(e.code === 'ENOENT' ? 'ffmpeg was not found on this machine' : e.message)))
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ended with code ${code}: ${err.trim()}`))))
    if (!feed) return
    ff.stdin.on('error', () => {})
    feed(ff.stdin).then(
      () => ff.stdin.end(),
      (e) => {
        ff.kill()
        reject(e)
      }
    )
  })
}

const feedFiles = (files) => async (stdin) => {
  for (const f of files) {
    if (!stdin.write(fs.readFileSync(f))) await new Promise((r) => stdin.once('drain', r))
  }
}

async function encode({ input, feed, filter, settings, out, audio = [] }) {
  const codec = VIDEO[settings.codec]
  const video = [...codec.args(settings), ...TAGS]
  const tmp = `${out}.part`
  fs.mkdirSync(path.dirname(out), { recursive: true })
  const log = path.join(tmpDir(), `pass-${process.pid}-${path.basename(out)}`)
  try {
    if (codec.passes > 1) await ffmpeg([...input, '-an', '-vf', filter, ...video, '-pass', '1', '-passlogfile', log, '-f', 'null', '-'], feed)
    const pass = codec.passes > 1 ? ['-pass', '2', '-passlogfile', log] : []
    await ffmpeg([...input, ...(audio.length ? audio : ['-an']), '-vf', filter, ...video, ...pass, ...EXACT, '-f', settings.container, tmp], feed)
  } finally {
    for (const f of fs.readdirSync(path.dirname(log))) if (f.startsWith(path.basename(log))) fs.rmSync(path.join(path.dirname(log), f), { force: true })
  }
  fs.renameSync(tmp, out)
}

export async function encodeFrames({ files, settings, out }) {
  const codec = VIDEO[settings.codec]
  await encode({
    input: ['-f', 'image2pipe', '-framerate', String(settings.fps), '-c:v', 'png', '-i', 'pipe:0'],
    feed: feedFiles(files),
    filter: `${TO_VIDEO},format=${codec.pixFmt}`,
    settings,
    out,
  })
}

export async function scaleCopy({ src, settings, out }) {
  const codec = VIDEO[settings.codec]
  await encode({
    input: ['-i', src],
    filter: `scale=${settings.width}:${settings.height}:${SCALER},format=${codec.pixFmt}`,
    settings,
    out,
    audio: ['-c:a', 'copy'],
  })
}

export async function join({ parts, out, container, fps, sound = null }) {
  if (!parts.length) throw new Error('nothing to join')
  const list = path.join(tmpDir(), `join-${process.pid}-${path.basename(out)}.txt`)
  const seconds = parts.reduce((n, p) => n + p.frames, 0) / fps
  // Each part's length is given by its frame count, so the next part starts exactly on its frame.
  fs.writeFileSync(list, parts.map((p) => `file '${path.resolve(p.file).replace(/'/g, "'\\''")}'\nduration ${(p.frames / fps).toFixed(6)}`).join('\n') + '\n')
  const tmp = `${out}.part`
  fs.mkdirSync(path.dirname(out), { recursive: true })
  const args = ['-f', 'concat', '-safe', '0', '-i', list]
  if (sound) {
    const encoder = AUDIO[cfg.export.audioCodec]
    if (!encoder) throw new Error(`no encoder for ${cfg.export.audioCodec}`)
    const d = seconds.toFixed(6)
    if (sound.offsetSeconds > 0) args.push('-ss', sound.offsetSeconds.toFixed(6))
    args.push('-i', sound.file, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-af', `apad=whole_dur=${d},atrim=duration=${d}`, '-c:a', encoder, '-b:a', `${cfg.export.audioKbps}k`, '-ar', String(cfg.audio.sampleRate))
  } else args.push('-map', '0:v:0', '-c:v', 'copy', '-an')
  if (container === 'mp4' || container === 'mov') args.push('-movflags', '+faststart')
  try {
    await ffmpeg([...args, ...EXACT, '-f', container, tmp])
  } finally {
    fs.rmSync(list, { force: true })
  }
  fs.renameSync(tmp, out)
}

export function timing(file, fps) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts_time', '-of', 'csv=p=0', file], { encoding: 'utf8', maxBuffer: 1 << 28 })
  if (r.status !== 0) throw new Error(`ffprobe failed on ${file}: ${r.stderr}`)
  const pts = r.stdout.split('\n').filter(Boolean).map(Number).sort((a, b) => a - b)
  let worst = 0
  for (let i = 0; i < pts.length; i++) worst = Math.max(worst, Math.abs(pts[i] - pts[0] - i / fps))
  return { packets: pts.length, start: pts[0] ?? 0, worstMs: worst * 1000, even: worst * fps < TIMING_SLACK_FRAMES }
}

export async function framePicture({ file, n, out }) {
  fs.mkdirSync(path.dirname(out), { recursive: true })
  await ffmpeg(['-i', file, '-vf', `select=eq(n\\,${n}),${TO_PICTURE}`, '-frames:v', '1', '-fps_mode', 'passthrough', '-c:v', 'png', '-f', 'image2', out])
}

export function probe(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'stream=codec_type,codec_name,profile,pix_fmt,width,height,r_frame_rate,nb_read_frames,sample_rate,channels:format=duration,size,bit_rate', '-of', 'json', file], { encoding: 'utf8', maxBuffer: 1 << 26 })
  if (r.error) throw new Error(r.error.code === 'ENOENT' ? 'ffprobe was not found on this machine' : r.error.message)
  if (r.status !== 0) throw new Error(`ffprobe failed on ${file}: ${r.stderr}`)
  const j = JSON.parse(r.stdout)
  const v = j.streams.find((s) => s.codec_type === 'video')
  const a = j.streams.find((s) => s.codec_type === 'audio')
  if (!v) throw new Error(`${file} holds no picture stream`)
  const [num, den] = v.r_frame_rate.split('/').map(Number)
  return {
    codec: v.codec_name,
    profile: v.profile ?? '',
    pixFmt: v.pix_fmt,
    width: v.width,
    height: v.height,
    fps: num / (den || 1),
    frames: Number(v.nb_read_frames),
    seconds: Number(j.format.duration),
    bytes: Number(j.format.size),
    mbps: Math.round(Number(j.format.bit_rate) / 10000) / 100,
    streams: j.streams.length,
    audio: a ? { codec: a.codec_name, sampleRate: Number(a.sample_rate), channels: a.channels } : null,
  }
}

export function probeLine(p) {
  const sound = p.audio ? `, sound ${p.audio.codec} ${p.audio.sampleRate} Hz ${p.audio.channels} ch` : ', no sound stream'
  return `${p.width} x ${p.height}, ${p.fps} fps, ${p.frames} frames, ${p.seconds.toFixed(3)} s, ${p.codec} ${p.pixFmt}, ${p.mbps} Mbps, ${(p.bytes / 1e6).toFixed(2)} MB${sound}`
}

export function soundSeconds(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', file], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`ffprobe failed on ${file}: ${r.stderr}`)
  return Number(JSON.parse(r.stdout).format.duration)
}

export function haveFfmpeg() {
  for (const bin of ['ffmpeg', 'ffprobe']) {
    const r = spawnSync(bin, ['-version'], { encoding: 'utf8' })
    if (r.error || r.status !== 0) return false
  }
  return true
}
