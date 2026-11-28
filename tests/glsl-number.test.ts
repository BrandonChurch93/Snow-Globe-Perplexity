import { closeSync, openSync, readdirSync, readFileSync, readSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ShaderChunk } from 'three'
import { describe, expect, it } from 'vitest'
import { MEAN_STEP_GLSL, NUMBER_GLSL } from '../src/core/chunks/number'

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

  /**
   * The mean of a picture's samples has its guard in the step itself. The step's text is plain arithmetic, so it is
   * read here as it stands, for one channel of one pixel through the samples of a frame.
   */
  it('lets no broken sample into the mean of a picture, and the samples after it still enter', () => {
    const step = MEAN_STEP_GLSL.match(/^vec4 meanStep\(vec4 m, vec4 s, float w\) \{ return (.*); \}\n$/)?.[1]
    expect(step).toBe('numberBroken(s) ? m : (numberBroken(m) ? s : m + (s - m) * w)')
    const accumulator = readFileSync(join('src', 'core', 'accumulator.ts'), 'utf8')
    expect(accumulator).toContain('const MEAN = `${MEAN_STEP_GLSL}uniform sampler2D uMean;')
    expect(accumulator).toContain('  if (uWeight >= 1.0) { o = s; return; }\n  vec4 m = texelFetch(uMean, p, 0);\n  o = meanStep(m, s, uWeight);\n}`')
    const run = new Function('numberBroken', 'm', 's', 'w', `return ${step}`) as (broken: (x: number) => boolean, m: number, s: number, w: number) => number
    const mean = (samples: number[]) => samples.reduce((m, s, i) => (i === 0 ? s : run((x) => !Number.isFinite(x), m, s, 1 / (i + 1))), 0)
    expect(mean([2, 4, 6, 8])).toBeCloseTo(5, 12)
    // A broken sample counts as the mean before it: (2 + 4 + 3 + 8) / 4.
    expect(mean([2, 4, NaN, 8])).toBeCloseTo(4.25, 12)
    expect(mean([2, 4, Infinity, 8])).toBeCloseTo(4.25, 12)
    expect(mean([2, 4, 6, -Infinity])).toBeCloseTo(4, 12)
    // A broken first sample is copied as it is, and the first whole sample then takes its place: (4 + 4 + 6 + 8) / 4.
    expect(mean([NaN, 4, 6, 8])).toBeCloseTo(5.5, 12)
    expect(mean([NaN, Infinity, 6, 8])).toBeCloseTo(6.5, 12)
    expect(mean([NaN, NaN])).toBeNaN()
  })

  /**
   * The step drops a broken sample, so the mean alone would hide it from the count the masters are gated by. A tally
   * kept apart from the mean holds a mark for every value that broke in any sample of the picture, and the count reads
   * both. The tally's pass reads the sample alone: a whole pixel it throws away, of a broken one it writes the marks, and
   * the card keeps the greater of the mark written and the mark that stands there. Read here as the texts stand, for one
   * value of one pixel: the count says of every list of samples what the mean said of it before it had its guard.
   */
  it('still counts a broken sample that the mean left out, by a tally kept apart from the mean', () => {
    const accumulator = readFileSync(join('src', 'core', 'accumulator.ts'), 'utf8')
    const from = accumulator.indexOf('\nconst TALLY = `uniform sampler2D uSample;\nout vec4 o;\n')
    expect(from).toBeGreaterThan(accumulator.indexOf('\nconst MEAN = '))
    const tally = accumulator.slice(from, accumulator.indexOf('}`\n', from))
    expect(bare(tally)).toEqual([])
    // One value's mark, by the shared tests on the bits: 1 what is not a number, 2 plus infinite, 3 minus infinite, 0 none.
    // The sign is read by a shift: the text sets no number against the bits for the sign's sake.
    const mark = tally.match(/^float tallyOf\(float v\) \{ return (.*); \}$/m)?.[1] ?? ''
    expect(mark).toBe('numberNan(v) ? 1.0 : (numberInf(v) ? 2.0 + float(floatBitsToUint(v) >> 31) : 0.0)')
    // The pass reads the sample once and nothing else, throws a whole pixel away and writes the marks of a broken one.
    expect(tally).toContain('void main() {\n  vec4 s = texelFetch(uSample, ivec2(gl_FragCoord.xy), 0);\n  if (!numberBroken(s)) discard;\n  o = vec4(tallyOf(s.r), tallyOf(s.g), tallyOf(s.b), tallyOf(s.a)) / 255.0;\n')
    expect(tally.match(/\buniform\b/g)).toHaveLength(1)
    expect(tally.match(/\btexelFetch\(/g)).toHaveLength(1)
    // After the mean's step it reads the texture that step has just read, into one target of a byte a value. The marks are
    // wiped at a picture's first sample; the card keeps the greater mark for this one draw; then all is put back.
    expect(accumulator).toContain('    this.pass.render(this.gfx.renderer, to)\n    const tally = this.tally\n')
    expect(accumulator).toContain(
      [
        '      tally.pass.material.uniforms.uSample.value = u.uSample.value',
        '      renderer.setRenderTarget(tally.marks)',
        '      if (this.count === 0) gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0])',
        '      const auto = renderer.autoClear',
        '      renderer.autoClear = false',
        '      gl.enable(gl.BLEND)',
        '      gl.blendEquation(gl.MAX)',
        '      tally.pass.render(renderer, tally.marks)',
        '      gl.blendEquation(gl.FUNC_ADD)',
        '      gl.disable(gl.BLEND)',
        '      renderer.autoClear = auto',
        '      renderer.setRenderTarget(to)',
        '    }\n    this.flip = 1 - this.flip\n',
      ].join('\n'),
    )
    expect(accumulator).toContain('    const marks = (): THREE.WebGLRenderTarget =>\n      new THREE.WebGLRenderTarget(width, height, {\n        type: THREE.UnsignedByteType,\n        format: THREE.RGBAFormat,\n')
    expect(accumulator).toContain("this.tally = this.precision === 'byte' ? null : { marks: marks(), pass: new Pass(TALLY, { uSample: { value: null } }) }")
    // The count takes a value that is broken in the mean or marked in the tally, and names the mark where there is one.
    expect(accumulator).toContain('        if (whole && mark === 0) continue\n        invalid++\n')
    expect(accumulator).toContain('mark !== 0 ? markKind(mark) : half ? halfKind(v) : floatKind(v))')
    expect(accumulator).toContain("const markKind = (m: number): OddKind => (m === 2 ? 'plus infinite' : m === 3 ? 'minus infinite' : 'no number')")
    const bits = (x: number) => new Uint32Array(new Float32Array([x]).buffer)[0]!
    // In the shader the bits are unsigned and the shift fills with zeros: here that is >>>.
    const marked = new Function('numberNan', 'numberInf', 'floatBitsToUint', 'float', 'v', `return ${mark.replace('>> 31', '>>> 31')}`) as (nan: (x: number) => boolean, inf: (x: number) => boolean, bits: (x: number) => number, float: (x: number) => number, v: number) => number
    const markOf = (v: number) => marked(Number.isNaN, (x) => Math.abs(x) === Infinity, bits, Number, v)
    expect([1, 0, -0, -3.5, NaN, -NaN, Infinity, -Infinity].map(markOf)).toEqual([0, 0, 0, 0, 1, 1, 2, 3])
    const step = MEAN_STEP_GLSL.match(/\{ return (.*); \}\n$/)?.[1]
    const broken = (x: number) => !Number.isFinite(x)
    const guarded = new Function('numberBroken', 'm', 's', 'w', `return ${step}`) as (broken: (x: number) => boolean, m: number, s: number, w: number) => number
    /** One value through the samples of a frame: the mean with its guard, and the mark the target holds after each pass. */
    const now = (samples: number[]): { counted: number; mark: number } => {
      let m = 0
      // The target is cleared once a picture.
      let kept = 0
      samples.forEach((s, i) => {
        m = i === 0 ? s : guarded(broken, m, s, 1 / (i + 1))
        // `if (!numberBroken(s)) discard;` and, of what is written, the greater of it and what stands there.
        if (broken(s)) kept = Math.max(kept, markOf(s))
      })
      return { counted: broken(m) || kept !== 0 ? 1 : 0, mark: kept }
    }
    /** The count as it was when the mean had no guard: a broken sample stayed in the mean to the frame's end. */
    const before = (samples: number[]): number => (broken(samples.reduce((m, s, i) => (i === 0 ? s : m + (s - m) * (1 / (i + 1))), 0)) ? 1 : 0)
    const lists = [[2, 4, 6, 8], [2], [0, 0, 0], [2, 4, NaN, 8], [2, 4, Infinity, 8], [2, 4, 6, -Infinity], [NaN, 4, 6, 8], [NaN, Infinity, 6, 8], [NaN, NaN], [NaN], [Infinity, -Infinity, 1], [2, NaN, 4, NaN, 6], [NaN, -Infinity], [-Infinity, NaN, 3]]
    for (const list of lists) expect(now(list).counted, JSON.stringify(list)).toBe(before(list))
    expect(lists.map((list) => now(list).counted)).toEqual([0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])
    // The kind named is the greatest mark met, whatever the order of the samples.
    expect(lists.map((list) => now(list).mark)).toEqual([0, 0, 0, 1, 2, 3, 1, 2, 1, 1, 3, 1, 3, 3])
  })

  /**
   * The tally's draw switches the card's blending on with the rule "the greater", by the card's own calls, and puts it
   * back to off and "the sum". That is how the mean's step left it only while no material of the build asks for another
   * rule: three.js sets the sum for each of its own ways of blending, and a material of the build's own names its rule.
   */
  it('leaves the card with the one blend rule the build ever asks for, the sum', () => {
    let read = 0
    for (const file of files('src', '.ts')) {
      const text = readFileSync(file, 'utf8')
      read++
      expect(/\b(?:Subtract|ReverseSubtract|Min|Max)Equation\b/.test(text), file).toBe(false)
      for (const m of text.matchAll(/\bblendEquation(?:Alpha)?\s*[:=]\s*([\w.]+)/g)) expect(m[1], file).toBe('THREE.AddEquation')
      const calls = [...text.matchAll(/\bgl\.blendEquation(?:Separate)?\(([^)]*)\)/g)].map((m) => m[1])
      expect(calls, file).toEqual(file.endsWith(join('core', 'accumulator.ts')) ? ['gl.MAX', 'gl.FUNC_ADD'] : [])
    }
    expect(read).toBeGreaterThan(150)
  })

  /**
   * Under Direct3D only a shader that asks isnan() is built with the strict rules for numbers. The probe's second
   * shader asks it nowhere, as the build's own shaders, and takes its broken values from a uniform's bits.
   */
  it('is asked of the card a second time in a shader that holds no isnan(), and with it the step of the mean', () => {
    const probe = readFileSync(join('src', ASKS), 'utf8')
    const from = probe.indexOf('\nconst PLAIN: ')
    const to = probe.indexOf('\nconst VERT = ')
    expect(from).toBeGreaterThan(probe.indexOf(QUESTION))
    expect(to).toBeGreaterThan(from)
    const plain = probe.slice(from, to)
    expect(bare(plain)).toEqual([])
    expect(bare(probe.slice(to))).toEqual([])
    expect(bare(MEAN_STEP_GLSL)).toEqual([])
    for (const asked of ["  ['numberBroken(nan bits)', 'numberBroken(nanBits()) && ", "  ['numberBroken(inf bits)', 'numberBroken(infBits()) && ", "  ['mean past a broken sample', 'same(meanStep(held(), vec4(uOne, nanBits(), uOne, uOne), ", "  ['mean after a broken first sample', 'same(meanStep(vec4(uOne, nanBits(), uOne, uOne), held(), "]) expect(plain).toContain(asked)
    expect(plain).toContain('const PLAIN_PARS = `${MEAN_STEP_GLSL}uniform uint uNan;\nuniform uint uInf;\nfloat nanBits() { return uintBitsToFloat(uNan); }\nfloat infBits() { return uintBitsToFloat(uInf); }\n')
    expect(probe).toContain("gl.uniform1ui(gl.getUniformLocation(program, 'uNan'), 0x7fc00000)")
    expect(probe).toContain("gl.uniform1ui(gl.getUniformLocation(program, 'uInf'), 0x7f800000)")
    expect(probe).toContain("return [...ask(gfx, CASES, ''), ...ask(gfx, PLAIN, PLAIN_PARS)]")
  })

  it('is painted by the strict run where the glass writes its guard', () => {
    const guard = readFileSync(join('src', 'globe', 'shell.ts'), 'utf8').match(/^const NUMBER_GUARD = ' {2}(.*)'$/m)?.[1]
    expect(guard).toBe('if (numberBroken(gl_FragColor)) gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);')
    expect(readFileSync(join('tools', 'strict.mjs'), 'utf8')).toContain(`const guard = '${guard}'`)
  })
})
