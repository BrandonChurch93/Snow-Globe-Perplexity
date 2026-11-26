import { describe, expect, it } from 'vitest'
import { isReadbackNotice } from '../tools/lib/browser.mjs'

const notice = '[.WebGL-0x3a4400127200]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels'

describe('page messages: what a tool passes over', () => {
  it('passes over the browser notice of a waited read of the frame, by its whole wording and only as a warning', () => {
    expect(isReadbackNotice('warning', notice)).toBe(true)
    expect(isReadbackNotice('warning', notice.replace('0x3a4400127200', '0x38c400140e00'))).toBe(true)
    expect(isReadbackNotice('error', notice)).toBe(false)
  })

  it('keeps every other line', () => {
    expect(isReadbackNotice('warning', `${notice} and more`)).toBe(false)
    expect(isReadbackNotice('warning', 'THREE.WebGLRenderer: EXT_color_buffer_float extension not supported.')).toBe(false)
    expect(isReadbackNotice('warning', '[.WebGL-0x1]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels (this message will no longer repeat)')).toBe(false)
    expect(isReadbackNotice('warning', 'GL_INVALID_OPERATION: glDrawArrays: no buffer bound')).toBe(false)
  })
})
