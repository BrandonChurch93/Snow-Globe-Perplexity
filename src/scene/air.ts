import type * as THREE from 'three'
import { handleOf, stageUniforms } from '../core/materials'

// The air of a picture, for the one still that leaves it out (`npm run still -- --no-air`). A builder reads the tone of wood,
// walls and lawn there, which the plain still shows through seed heads, lights and haze. Nothing that is judged is drawn so.

/**
 * What a season hangs in the liquid as air of its own: the meshes of its glass dressing whose material is the liquid's
 * (spring's mist, fall's pooled fog). What it lays on the glass or draws as the far wall is not, and stays.
 */
export function seasonAir(glass: readonly THREE.Object3D[]): THREE.Object3D[] {
  const out: THREE.Object3D[] = []
  for (const root of glass) root.traverse((o) => {
    const m = (o as THREE.Mesh).material
    if (m && !Array.isArray(m) && m.userData.stage && handleOf(m).uFlags.value.z > 0) out.push(o)
  })
  return out
}

/**
 * The season's own air hidden for one frame and given back after it. What was not on show when it was hidden stays as it was,
 * and what a frame that failed left hidden is given back by the next call, so nothing stays out of a later picture.
 */
export class AirHold {
  private held: THREE.Object3D[] = []

  hide(glass: readonly THREE.Object3D[]): void {
    for (const o of seasonAir(glass)) {
      if (!o.visible) continue
      o.visible = false
      this.held.push(o)
    }
  }

  back(): void {
    for (const o of this.held) o.visible = true
    this.held = []
  }
}

/**
 * The shared veil with nothing in it: with these four at 0 its path ends before it marches, and a surface keeps its own colour.
 * It is called after the kits have had the frame, because a season adds to them there (summer holds its storm).
 */
export function clearVeil(): void {
  const u = stageUniforms
  u.uVeil.value.w = 0
  u.uVeilRoll.value.z = 0
  u.uVeilBank.value.z = 0
  u.uVeilDrift.value.x = 0
}
