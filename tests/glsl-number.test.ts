import { closeSync, openSync, readdirSync, readFileSync, readSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ShaderChunk } from 'three'
import { describe, expect, it } from 'vitest'
import { NUMBER_GLSL } from '../src/core/chunks/number'

/**
 * Under Direct3D every shader is built by Microsoft's compiler, which takes each number for a clean one and may leave
 * isnan() and isinf() out (its warning X3577). A guard left out lets one sample that is not a number into the frame's
 * sum, and a blur spreads it over a block of the picture. So no shader of this build asks isnan() or isinf(): each
 * guard reads the bits through the one shared text in src/core/chunks/number.ts.
 */

const BARE = /(?<![\w.])is(?:nan|inf)\s*\(/g
const SHARED = join('core', 'chunks', 'number.ts')
/** The probe's own question to the card, which is asked on purpose and draws nothing of the picture. */
const ASKS = join('core', 'maths.ts')
const QUESTION = "  ['isnan(nan)', 'isnan(uZero / uZero) ? 1.0 : 0.0'],"

function files(dir: string, ending: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path, ending) : path.endsWith(ending) ? [path] : []
  })
}

/** Every line of `text` that asks isnan( or isinf( itself, with its number. */
function bare(text: string): Array<[number, string]> {
  return text.split('\n').flatMap((line, i): Array<[number, string]> => (line.match(BARE) ? [[i + 1, line]] : []))
}

/** The JSON part of a .glb file, which names the extensions its materials use. */
function glbJson(path: string): string {
  const fd = openSync(path, 'r')
  try {
    const head = Buffer.alloc(20)
    readSync(fd, head, 0, 20, 0)
    const body = Buffer.alloc(head.readUInt32LE(12))
    readSync(fd, body, 0, body.length, 20)
    return body.toString('utf8')
  } finally {
    closeSync(fd)
  }
}

/** The forms of the shared test as its text gives them: the name, the type, the mask, how it compares and with what. */
const FORMS = [...NUMBER_GLSL.matchAll(/^bool (\w+)\(highp (float|vec3|vec4) \w+\) \{ return (.*); \}$/gm)].map((m) => {
  const read = m[3]!.match(/^(?:any\(greaterThanEqual\(floatBitsToUint\(\w+\) & (0x[0-9a-f]+)u, uvec[34]\((0x[0-9a-f]+)u\)\)\)|\(floatBitsToUint\(\w+\) & (0x[0-9a-f]+)u\) (>=|>|==) (0x[0-9a-f]+)u)$/)
  return { name: m[1]!, type: m[2]!, mask: Number(read?.[1] ?? read?.[3]), how: read ? (read[4] ?? '>=') : '', limit: Number(read?.[2] ?? read?.[5]) }
})

describe('shader arithmetic: the test for a broken number', () => {
  it('finds isnan( and isinf( where they are called and nowhere else', () => {
    expect(bare('a = isnan(x) ? 0.0 : x;\nb = any(isinf (v));\nc = Number.isNaN(x) || numberNan(x) || v.isinf(x);')).toEqual([
      [1, 'a = isnan(x) ? 0.0 : x;'],
      [2, 'b = any(isinf (v));'],
    ])
  })

  it('is asked by no shader text of the build itself, the probe\'s one question apart', () => {
    const open: string[] = []
    let read = 0
    for (const file of [...files('src', ''), 'index.html']) {
      read++
      if (file.endsWith(SHARED)) continue
      for (const [n, line] of bare(readFileSync(file, 'utf8'))) {
        if (file.endsWith(ASKS) && line === QUESTION) continue
        open.push(`${file}:${n}: ${line.trim().slice(0, 100)}`)
      }
    }
    expect(read).toBeGreaterThan(150)
    expect(open).toEqual([])
    expect(readFileSync(join('src', ASKS), 'utf8').split('\n')).toContain(QUESTION)
  })

  /**
   * three's own text holds one isinf(), in the part of its physical material that draws transmission. The compiler
   * never sees it while no material switches transmission on: three then leaves USE_TRANSMISSION undefined.
   */
  it('is asked by three only inside the transmission that no material of the build switches on', () => {
    const asking = Object.entries(ShaderChunk).filter(([, text]) => bare(text).length > 0).map(([name]) => name)
    expect(asking).toEqual(['transmission_pars_fragment'])
    const lines = ShaderChunk.transmission_pars_fragment.trim().split('\n').map((l) => l.trim())
    expect(lines[0]).toBe('#ifdef USE_TRANSMISSION')
    let depth = 0
    const closed = lines.findIndex((l) => {
      if (/^#if/.test(l)) depth++
      else if (/^#endif/.test(l)) depth--
      return depth === 0
    })
    expect(closed).toBe(lines.length - 1)
    for (const build of ['three.module.js', 'three.core.js']) {
      const text = readFileSync(join('node_modules', 'three', 'build', build), 'utf8')
      expect(bare(text).length, build).toBe(build === 'three.module.js' ? 1 : 0)
    }
    for (const file of files('src', '.ts')) expect(/\btransmission\b/.test(readFileSync(file, 'utf8')), file).toBe(false)
    const models = [...files(join('public', 'assets'), '.glb'), ...files('assets-full', '.glb')]
    expect(models.length).toBeGreaterThan(20)
    for (const model of models) expect(glbJson(model).includes('KHR_materials_transmission'), model).toBe(false)
  })

  it('reads the bits: an infinity is 0x7f800000 under the sign, what is not a number lies above it', () => {
    expect(bare(NUMBER_GLSL)).toEqual([])
    expect(FORMS.map((f) => `${f.name} ${f.type} ${f.how}`)).toEqual(['numberBroken float >=', 'numberBroken vec3 >=', 'numberBroken vec4 >=', 'numberNan float >', 'numberInf float =='])
    const bits = [0x00000000, 0x80000000, 0x00000001, 0x807fffff, 0x3f800000, 0xbf800000, 0x7f7fffff, 0xff7fffff, 0x7f800000, 0xff800000, 0x7f800001, 0x7fc00000, 0xffc00000, 0xffffffff]
    const view = new DataView(new ArrayBuffer(4))
    for (const u of bits) {
      view.setUint32(0, u)
      const x = view.getFloat32(0)
      for (const f of FORMS) {
        expect([f.mask, f.limit]).toEqual([0x7fffffff, 0x7f800000])
        const under = (u & f.mask) >>> 0
        const says = f.how === '>=' ? under >= f.limit : f.how === '>' ? under > f.limit : under === f.limit
        const truth = f.name === 'numberBroken' ? !Number.isFinite(x) : f.name === 'numberNan' ? Number.isNaN(x) : x === Infinity || x === -Infinity
        expect(says, `${f.name} of 0x${u.toString(16)}`).toBe(truth)
      }
    }
  })

  it('reaches every shader that a guard stands in, once', () => {
    expect(NUMBER_GLSL.startsWith('#ifndef NUMBER_TESTS\n#define NUMBER_TESTS\n')).toBe(true)
    expect(NUMBER_GLSL.endsWith('#endif\n')).toBe(true)
    expect(readFileSync(join('src', 'core', 'fullscreen.ts'), 'utf8')).toContain('precision highp sampler2D;\\n${NUMBER_GLSL}${fragment}')
    expect(readFileSync(join('src', 'core', 'materials.ts'), 'utf8')).toContain('fragmentShader: `#include <common>\n${NUMBER_GLSL}${STAGE_FRAG_PARS}')
    expect(readFileSync(join('src', ASKS), 'utf8')).toContain('precision highp float;\n${NUMBER_GLSL}uniform float uZero;')
  })

  it('answers false in every form under the strict run\'s noguard mode', () => {
    const tool = readFileSync(join('tools', 'lib', 'strict.mjs'), 'utf8')
    expect(tool).toContain('\n#define NUMBER_TESTS\n')
    for (const f of FORMS) expect(tool, `${f.name} ${f.type}`).toMatch(new RegExp(`\\nbool ${f.name}\\(${f.type} \\w+\\) \\{ return false; \\}\\n`))
  })

  it('is painted by the strict run where the glass writes its guard', () => {
    const guard = readFileSync(join('src', 'globe', 'shell.ts'), 'utf8').match(/^const NUMBER_GUARD = ' {2}(.*)'$/m)?.[1]
    expect(guard).toBe('if (numberBroken(gl_FragColor)) gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);')
    expect(readFileSync(join('tools', 'strict.mjs'), 'utf8')).toContain(`const guard = '${guard}'`)
  })
})
