import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { QUAD_HALF_PX, SPRITE_POINT_PX, pointMesh } from '../src/particles/draw/points'

const SOURCE = readFileSync(join(__dirname, '..', 'src', 'particles', 'draw', 'points.ts'), 'utf8')

describe('which mesh draws the particles', () => {
  it('the film path keeps its point sprites and their cut where the largest point is 1023 px or more', () => {
    expect(SPRITE_POINT_PX).toBe(1023)
    expect(pointMesh(false, 1023)).toEqual({ quads: false, halfPx: 511.5 })
    expect(pointMesh(false, 1024)).toEqual({ quads: false, halfPx: 512 })
  })

  it('the film path draws quads where the largest point is smaller, so no shape is cut to a small square', () => {
    for (const most of [1, 63, 256, 511, 1022]) expect(pointMesh(false, most)).toEqual({ quads: true, halfPx: QUAD_HALF_PX })
  })

  it('the live app draws quads on every machine, cut to one size', () => {
    for (const most of [1, 256, 1023, 1024]) expect(pointMesh(true, most)).toEqual({ quads: true, halfPx: QUAD_HALF_PX })
    expect(QUAD_HALF_PX).toBe(512)
  })

  it('a sprite is never asked to be larger than the machine draws it', () => {
    for (const most of [1023, 1024]) expect(2 * pointMesh(false, most).halfPx).toBeLessThanOrEqual(most)
  })

  it('the mesh shown, the buffers sent and the cut all follow the one choice', () => {
    expect(SOURCE).toContain('this.sprites.visible = !mesh.quads')
    expect(SOURCE).toContain('this.quads.visible = mesh.quads')
    expect(SOURCE).toContain('for (const a of quads ? this.instanced : this.single) a.needsUpdate = true')
    expect(SOURCE).toContain('limit.y = pointMesh(f.live, this.maxPointPx).halfPx')
    expect(SOURCE).not.toContain('this.maxPointPx / 2')
    expect(SOURCE).toContain('u.uWhole!.value = f.live ? 1 : 0')
  })
})
