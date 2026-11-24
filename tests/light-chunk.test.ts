import { describe, expect, it } from 'vitest'
import { LIGHT_DONE, LIGHT_FRAG, LIGHT_FRAG_PARS, afterLight, lightUniforms } from '../src/core/chunks/light'
import { ROOM_GLSL, roomUniforms } from '../src/scene/room'

const declared = (glsl: string) => [...glsl.matchAll(/uniform\s+(?:highp\s+|mediump\s+|lowp\s+)?\w+\s+(\w+)\s*;/g)].map((m) => m[1]!)

describe('the light chunk', () => {
  it('keeps what the veil, the particles and the hooks call', () => {
    for (const name of ['vec3 stageGrid(vec3 local)', 'void stageGridLit(', 'vec3 stageGridToward(vec3 local)', 'float stageWrap(float ndl, float wrap)', 'vec3 stageWrapped(vec3 n, float wrap)', 'vec3 stageThrough(vec3 n, vec3 v, float thin, float tight)', 'float stageKeyShade(']) expect(LIGHT_FRAG_PARS).toContain(name)
    expect(LIGHT_FRAG).toContain('vec3 stageLit = vec3(0.0);')
    expect(LIGHT_FRAG.trimEnd().endsWith(LIGHT_DONE)).toBe(true)
  })

  it('has a uniform object for every uniform it declares', () => {
    const names = declared(LIGHT_FRAG_PARS)
    expect(names.length).toBeGreaterThan(20)
    expect(new Set(names).size).toBe(names.length)
    for (const n of names) expect(Object.keys(lightUniforms)).toContain(n)
  })

  it('reads the room under its own names, from the room\'s own values', () => {
    const room = declared(ROOM_GLSL)
    expect(room.length).toBeGreaterThan(0)
    const mine = lightUniforms as unknown as Record<string, unknown>
    const theirs = roomUniforms as unknown as Record<string, unknown>
    for (const n of room) {
      expect(LIGHT_FRAG_PARS).not.toMatch(new RegExp(`\\b${n}\\b`))
      expect(LIGHT_FRAG_PARS).toContain(`${n}Lit`)
      expect(mine[`${n}Lit`]).toBe(theirs[n])
    }
    expect(LIGHT_FRAG_PARS).toContain('stageRoomSoftLit(')
    expect(LIGHT_FRAG_PARS).toContain('stageRoomLightsLit(')
    expect(LIGHT_FRAG_PARS).not.toMatch(/\bstageRoomSoft\(/)
    expect(LIGHT_FRAG_PARS).not.toMatch(/\bstageRoomLights\(/)
  })

  it('lets a material add its own light after the rig', () => {
    const shader = { fragmentShader: `void main() {${LIGHT_FRAG}}` }
    afterLight(shader, 'reflectedLight.directDiffuse += stageWrapped(geometryNormal, 0.5);')
    const done = shader.fragmentShader.indexOf(LIGHT_DONE)
    expect(done).toBeGreaterThan(0)
    expect(shader.fragmentShader.indexOf('stageWrapped(geometryNormal, 0.5)')).toBeGreaterThan(done)
  })

  it('draws nothing from a clock or a die', () => {
    for (const word of ['Math.random', 'Date.now', 'performance.now']) {
      expect(LIGHT_FRAG_PARS).not.toContain(word)
      expect(LIGHT_FRAG).not.toContain(word)
    }
  })
})
