import { describe, expect, it } from 'vitest'
import { framingSource, m1 } from '../tools/lib/measures.mjs'

type Line = { pass: boolean; framed?: boolean }

// Check M1 asks whether the globe and its base lie inside the frame. A screen still (the app's view, with the controls) is
// drawn from the app's own framing, which stands further back than the film's camera of the same name, so it has to be
// measured with the numbers of the camera that drew it. Until Round 18 it was measured with the film's camera.
describe('the framing a judged still is measured with', () => {
  it('is the drawing camera for a screen still and the named camera for every other still', () => {
    expect(framingSource({ id: 'screen-phone', kind: 'still', camera: 'hero', interface: true })).toBe('still')
    expect(framingSource({ id: 'live-high', kind: 'live', camera: 'hero', level: 'high' })).toBe('still')
    expect(framingSource({ id: 'winter-rest', kind: 'key', camera: 'hero' })).toBe('camera')
    expect(framingSource({ id: 'spring-interior', kind: 'view', camera: 'interior' })).toBe('camera')
    expect(framingSource({ id: 'film-0666', kind: 'film', frame: 666 })).toBe('none')
  })

  const size = { width: 390, height: 844 }
  const record = (framing: unknown) => ({ measured: { sanity: { invalid: 0, pixels: size.width * size.height } }, framing })
  const entry = { id: 'screen-phone', kind: 'still', camera: 'hero', interface: true }

  it('still fails a screen still whose base is wider than the screen', () => {
    const wide = { globe: { cx: 195, cy: 400, r: 180 }, base: { left: -12, right: 402, top: 560, foot: 700 } }
    const line = m1(entry, record(wide), size, null) as Line
    expect(line.pass).toBe(false)
    expect(line.framed).toBe(false)
  })

  it('passes a screen still whose globe and base lie inside the screen', () => {
    const inside = { globe: { cx: 195, cy: 400, r: 150 }, base: { left: 20, right: 370, top: 530, foot: 650 } }
    const line = m1(entry, record(inside), size, null) as Line
    expect(line.pass).toBe(true)
    expect(line.framed).toBe(true)
  })
})
