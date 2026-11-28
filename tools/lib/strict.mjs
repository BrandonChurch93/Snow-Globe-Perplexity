// The strict rule for shader arithmetic.
//
// GLSL leaves some answers open: pow with a base below zero, the square root of a number below zero, normalize of a
// vector of no length, and so on. The software renderer every still and film frame is made with answers those cases
// with an ordinary number. Some graphics cards answer with no number at all, and one such answer in the glass's
// shader turned the whole globe into a flat bright sheet on an Apple tablet (decision 133 in kit/PROGRESS.md).
//
// STRICT_INIT is a script run in the page before the app: it rewrites every shader's source as it is handed to WebGL,
// so that each open case answers no number, as the strictest card would. `npm run strict` renders a picture with and
// without it. A build whose pictures are the same both ways does not rest on an open case.
//
// The modes, joined by `+`:
//   pow      pow(x, y) with x below zero, or x zero and y zero or below
//   all      pow and sqrt, inversesqrt, log, log2, normalize, atan, acos, asin, mod
//   smooth   smoothstep with both edges equal
//   noguard  isnan(), isinf() and the build's own tests of the bits (src/core/chunks/number.ts) always answer false
//   dry      the same wrappers, each answering what the plain function answers: it shows what the wrappers alone change
//   as0, asunit, asbig   an open case answers 0, 0.577 or 1e30 instead of no number
// Narrowing, for finding a call: `pow~text` (only calls whose text holds `text`), `pow#a-b` (only the calls numbered
// a up to b, not b itself, counted through every shader in the order handed over), `pow#a-b!k,m` (leaving out k and m).
export const STRICT_INIT = (mode) => {
  const POW = `
float sm_nan() { return intBitsToFloat(2143289344); }
float sm_pow(float x, float y) { return (x < 0.0 || (x == 0.0 && y <= 0.0)) ? sm_nan() : pow(x, y); }
vec2 sm_pow(vec2 x, vec2 y) { return vec2(sm_pow(x.x, y.x), sm_pow(x.y, y.y)); }
vec3 sm_pow(vec3 x, vec3 y) { return vec3(sm_pow(x.x, y.x), sm_pow(x.y, y.y), sm_pow(x.z, y.z)); }
vec4 sm_pow(vec4 x, vec4 y) { return vec4(sm_pow(x.x, y.x), sm_pow(x.y, y.y), sm_pow(x.z, y.z), sm_pow(x.w, y.w)); }
`
  const ALL = `
float sm_sqrt(float x) { return x < 0.0 ? sm_nan() : sqrt(x); }
vec2 sm_sqrt(vec2 x) { return vec2(sm_sqrt(x.x), sm_sqrt(x.y)); }
vec3 sm_sqrt(vec3 x) { return vec3(sm_sqrt(x.x), sm_sqrt(x.y), sm_sqrt(x.z)); }
vec4 sm_sqrt(vec4 x) { return vec4(sm_sqrt(x.x), sm_sqrt(x.y), sm_sqrt(x.z), sm_sqrt(x.w)); }
float sm_isqrt(float x) { return x <= 0.0 ? sm_nan() : inversesqrt(x); }
vec2 sm_isqrt(vec2 x) { return vec2(sm_isqrt(x.x), sm_isqrt(x.y)); }
vec3 sm_isqrt(vec3 x) { return vec3(sm_isqrt(x.x), sm_isqrt(x.y), sm_isqrt(x.z)); }
float sm_log(float x) { return x <= 0.0 ? sm_nan() : log(x); }
vec2 sm_log(vec2 x) { return vec2(sm_log(x.x), sm_log(x.y)); }
vec3 sm_log(vec3 x) { return vec3(sm_log(x.x), sm_log(x.y), sm_log(x.z)); }
float sm_log2(float x) { return x <= 0.0 ? sm_nan() : log2(x); }
vec2 sm_log2(vec2 x) { return vec2(sm_log2(x.x), sm_log2(x.y)); }
vec3 sm_log2(vec3 x) { return vec3(sm_log2(x.x), sm_log2(x.y), sm_log2(x.z)); }
vec2 sm_normalize(vec2 v) { return dot(v, v) > 0.0 ? normalize(v) : vec2(sm_nan()); }
vec3 sm_normalize(vec3 v) { return dot(v, v) > 0.0 ? normalize(v) : vec3(sm_nan()); }
vec4 sm_normalize(vec4 v) { return dot(v, v) > 0.0 ? normalize(v) : vec4(sm_nan()); }
float sm_atan(float y, float x) { return (x == 0.0 && y == 0.0) ? sm_nan() : atan(y, x); }
float sm_atan(float y) { return atan(y); }
vec2 sm_atan(vec2 y, vec2 x) { return vec2(sm_atan(y.x, x.x), sm_atan(y.y, x.y)); }
float sm_acos(float x) { return abs(x) > 1.0 ? sm_nan() : acos(x); }
float sm_asin(float x) { return abs(x) > 1.0 ? sm_nan() : asin(x); }
float sm_mod(float x, float y) { return y == 0.0 ? sm_nan() : mod(x, y); }
vec2 sm_mod(vec2 x, float y) { return y == 0.0 ? vec2(sm_nan()) : mod(x, y); }
vec3 sm_mod(vec3 x, float y) { return y == 0.0 ? vec3(sm_nan()) : mod(x, y); }
vec4 sm_mod(vec4 x, float y) { return y == 0.0 ? vec4(sm_nan()) : mod(x, y); }
vec2 sm_mod(vec2 x, vec2 y) { return vec2(sm_mod(x.x, y.x), sm_mod(x.y, y.y)); }
vec3 sm_mod(vec3 x, vec3 y) { return vec3(sm_mod(x.x, y.x), sm_mod(x.y, y.y), sm_mod(x.z, y.z)); }
vec4 sm_mod(vec4 x, vec4 y) { return vec4(sm_mod(x.x, y.x), sm_mod(x.y, y.y), sm_mod(x.z, y.z), sm_mod(x.w, y.w)); }
`
  const SMOOTH = `
float sm_smoothstep(float a, float b, float x) { return a == b ? sm_nan() : smoothstep(a, b, x); }
vec2 sm_smoothstep(float a, float b, vec2 x) { return a == b ? vec2(sm_nan()) : smoothstep(a, b, x); }
vec3 sm_smoothstep(float a, float b, vec3 x) { return a == b ? vec3(sm_nan()) : smoothstep(a, b, x); }
vec4 sm_smoothstep(float a, float b, vec4 x) { return a == b ? vec4(sm_nan()) : smoothstep(a, b, x); }
vec2 sm_smoothstep(vec2 a, vec2 b, vec2 x) { return vec2(sm_smoothstep(a.x, b.x, x.x), sm_smoothstep(a.y, b.y, x.y)); }
vec3 sm_smoothstep(vec3 a, vec3 b, vec3 x) { return vec3(sm_smoothstep(a.x, b.x, x.x), sm_smoothstep(a.y, b.y, x.y), sm_smoothstep(a.z, b.z, x.z)); }
`
  // 'noguard': isnan() and isinf() always answer false, as a compiler with fast maths may make them. A picture that is
  // the same with it proves that no guard of that kind was needed: nothing that is not a number reached one.
  // The build's guards read the bits through src/core/chunks/number.ts, which stands aside where NUMBER_TESTS is
  // defined, so the mode puts its own answers in their place.
  const NOGUARD = `
bool sm_never(float x) { return false; }
bvec2 sm_never(vec2 x) { return bvec2(false); }
bvec3 sm_never(vec3 x) { return bvec3(false); }
bvec4 sm_never(vec4 x) { return bvec4(false); }
#define NUMBER_TESTS
bool numberBroken(float x) { return false; }
bool numberBroken(vec3 v) { return false; }
bool numberBroken(vec4 v) { return false; }
bool numberNan(float x) { return false; }
bool numberInf(float x) { return false; }
`
  const DEF_NOGUARD = '#define isnan sm_never\n#define isinf sm_never\n'
  const DEF_POW = '#define pow sm_pow\n'
  const DEF_ALL = '#define sqrt sm_sqrt\n#define inversesqrt sm_isqrt\n#define log sm_log\n#define log2 sm_log2\n#define normalize sm_normalize\n#define atan sm_atan\n#define acos sm_acos\n#define asin sm_asin\n#define mod sm_mod\n'
  const DEF_SMOOTH = '#define smoothstep sm_smoothstep\n'
  // 'pow~text': only the pow calls whose own text (the 200 characters from the call on) holds `text` are made strict.
  // 'pow#a-b': only the pow calls numbered a up to b (not b itself), counted through every shader in the order they are handed over.
  const [modeOnly, site] = String(mode).split('~')
  const [modeBare, range] = modeOnly.split('#')
  // 'pow#a-b!k,m': as above, leaving out the calls numbered k and m.
  const [span, less] = range ? range.split('!') : ['', '']
  const [lo, hi] = range ? span.split('-').map(Number) : [0, Infinity]
  const skip = new Set((less || '').split(',').filter(Boolean).map(Number))
  const narrowed = site !== undefined || range !== undefined
  const parts = modeBare.split('+')
  // 'dry': the same wrappers with the same names, but each one always answers what the plain function answers.
  // A picture made with 'pow+dry' that equals the one made with 'pow' proves that no call met a case GLSL leaves open.
  const dry = (t) => !parts.includes('dry') ? t : t.split('\n').map((l) => {
    if (!l.includes('sm_nan()') || l.startsWith('float sm_nan()')) return l
    const m = l.match(/^(.*\{ return )(.*) \? (.*) : (.*)(; \})$/)
    if (!m) throw new Error('dry: cannot read ' + l)
    return m[1] + (m[3].includes('sm_nan()') ? m[4] : m[3]) + m[5]
  }).join('\n')
  // 'as0', 'asunit' and 'asbig': what a strict function answers in a case GLSL leaves open is 0, 0.577 or 1e30 instead
  // of no number. 0.577 is there because 0 and 1e30 may both fall to no number further on, where a plain number does not.
  // The proof that a picture does not rest on such a case: it is the same picture with every one of the answers.
  const answer = parts.includes('as0') ? 'return 0.0;' : parts.includes('asbig') ? 'return 1.0e30;' : parts.includes('asunit') ? 'return 0.57735027;' : 'return intBitsToFloat(2143289344);'
  let body = POW.replace('return intBitsToFloat(2143289344);', answer), defs = ''
  if ((parts.includes('pow') || parts.includes('all')) && !narrowed) defs += DEF_POW
  if (parts.includes('all')) { body += ALL; defs += DEF_ALL }
  if (parts.includes('smooth')) { body += SMOOTH; defs += DEF_SMOOTH }
  if (parts.includes('noguard')) { body += NOGUARD; defs += DEF_NOGUARD }
  const prelude = dry(body) + defs
  const state = (window.__strict = { mode, shaders: 0, missed: 0, sites: 0, taken: [] })
  const P = WebGL2RenderingContext.prototype
  const orig = P.shaderSource
  P.shaderSource = function (shader, src) {
    let s = String(src)
    if (narrowed) {
      const name = (s.match(/#define SHADER_NAME (\S+)/) || [])[1] || ''
      s = s.replace(/(?<![\w.])pow\(/g, (hit, at, whole) => {
        const k = state.sites++
        const text = whole.slice(at, at + 200)
        const take = k >= lo && k < hi && !skip.has(k) && (site === undefined || text.includes(site))
        if (take) state.taken.push(k + ' ' + name + ': ' + text.slice(0, 90).replace(/\s+/g, ' '))
        return take ? 'sm_pow(' : hit
      })
    }
    const m = s.match(/precision\s+(highp|mediump|lowp)\s+float\s*;/)
    if (m) {
      const at = m.index + m[0].length
      s = s.slice(0, at) + '\n' + prelude + s.slice(at)
      state.shaders++
    } else {
      const v = s.match(/#version[^\n]*\n/)
      if (v) { const at = v.index + v[0].length; s = s.slice(0, at) + prelude + s.slice(at); state.shaders++ } else state.missed++
    }
    return orig.call(this, shader, s)
  }
}
