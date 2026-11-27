import { describe, expect, it } from 'vitest'
import { chunkVideoArgs, finalVideoArgs, masterVideoArgs } from '../tools/lib/encode.mjs'

const after = (a: string[], flag: string) => a[a.indexOf(flag) + 1]

describe('a coding that two machines must give alike', () => {
  it('has one thread wherever it has a rate cap', () => {
    const a: string[] = chunkVideoArgs({ codec: 'h264', mbps: 2.5, fps: 30 })
    expect(a).toContain('-maxrate')
    expect(a).toContain('-bufsize')
    expect(after(a, '-threads')).toBe('1')
    expect(a.join(' ')).toContain('+bitexact')
  })

  it('has no rate cap in a master chunk, whose two pinned threads then repeat', () => {
    const a: string[] = masterVideoArgs({ codec: 'libx264', preset: 'slow', profile: 'high', level: '5.2', pixFmt: 'yuv420p', crf: 12 }, 30)
    for (const flag of ['-maxrate', '-bufsize', '-b:v']) expect(a).not.toContain(flag)
    expect(after(a, '-threads')).toBe('2')
    expect(a.join(' ')).toContain('+bitexact')
  })

  it('does not call the one encode of a whole master exact, since it has a cap and every thread', () => {
    const video = { codec: 'libx264', profile: 'high', level: '5.2', pixFmt: 'yuv420p', maxrateMbps: 80, bufsizeMbps: 120 }
    const final = { aqMode: 3, params: '', preset: 'slow', keyint: 120, minKeyint: 60, bframes: 2, refs: 4 }
    const a: string[] = finalVideoArgs(video, final, { kbps: 60000, threads: 4 })
    expect(a).toContain('-maxrate')
    expect(a.join(' ')).not.toContain('bitexact')
  })
})
