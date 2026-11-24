import * as THREE from 'three'
import { lightUniforms } from '../core/chunks/light'
import type { Rgb } from '../core/materials'
import { flagStandIn } from '../core/standins'
import type { StageFrame } from './frame'
import { centreHeightMm, innerRadiusMm } from './layout'
import { gainOf, glowOf } from './lightgrid'

const mixRgb = (a: Rgb, b: Rgb, t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const CARD_SHARE = 0.14
const SHADOW_SOFTNESS = 3
const BLOOM_GAIN = 2.5
const GLOW_POWER = 0.12

export class Lighting {
  readonly rig = new THREE.Group()
  readonly key = new THREE.DirectionalLight(0xffffff, 1)
  readonly rim = new THREE.DirectionalLight(0xffffff, 1)
  readonly card = new THREE.DirectionalLight(0xffffff, 0)
  readonly fill = new THREE.HemisphereLight(0xffffff, 0x000000, 1)
  readonly glow = new THREE.PointLight(0xffffff, 0, 0, 0)

  constructor(shadowMapPx: number) {
    flagStandIn('light-engine')
    const { key } = this
    key.target.position.set(0, 70, 0)
    key.castShadow = true
    key.shadow.mapSize.set(shadowMapPx, shadowMapPx)
    const sc = key.shadow.camera
    sc.left = -130
    sc.right = 130
    sc.top = 150
    sc.bottom = -130
    sc.near = 100
    sc.far = 1200
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.6
    key.shadow.radius = SHADOW_SOFTNESS
    this.rig.add(key, key.target, this.rim, this.card, this.fill)
    this.glow.position.y = centreHeightMm
  }

  setShadowMap(px: number): void {
    if (px === this.key.shadow.mapSize.x) return
    this.key.shadow.mapSize.set(px, px)
    this.key.shadow.map?.dispose()
    this.key.shadow.map = null
  }

  shadowBytes(): number {
    const s = this.key.shadow.mapSize
    return s.x * s.y * 4
  }

  update(f: StageFrame): void {
    const a = f.from
    const b = f.to
    const t = f.mix.light
    const keyCol = mixRgb(a.rig.key.color, b.rig.key.color, t)
    const keyPower = lerp(a.rig.key.intensity, b.rig.key.intensity, t)
    const keyFrom = mixRgb(a.rig.key.from, b.rig.key.from, t)
    const rimCol = mixRgb(a.rig.rim.color, b.rig.rim.color, t)
    const rimPower = lerp(a.rig.rim.intensity, b.rig.rim.intensity, t)
    const rimFrom = mixRgb(a.rig.rim.from, b.rig.rim.from, t)
    const sky = mixRgb(a.rig.sky, b.rig.sky, t)
    const ground = mixRgb(a.rig.ground, b.rig.ground, t)
    const fill = lerp(a.rig.fill, b.rig.fill, t)
    this.key.color.setRGB(keyCol[0], keyCol[1], keyCol[2])
    this.key.intensity = keyPower
    this.key.position.set(keyFrom[0], keyFrom[1], keyFrom[2])
    this.rim.color.setRGB(rimCol[0], rimCol[1], rimCol[2])
    this.rim.intensity = rimPower
    this.rim.position.set(rimFrom[0], rimFrom[1], rimFrom[2])
    const skyPeak = Math.max(sky[0], sky[1], sky[2], 1e-4)
    this.card.color.setRGB(sky[0] / skyPeak, sky[1] / skyPeak, sky[2] / skyPeak)
    this.card.intensity = keyPower * CARD_SHARE
    this.card.position.set(-keyFrom[0] * 0.9, keyFrom[1] * 0.3, Math.abs(keyFrom[2]) * 1.1)
    this.fill.color.setRGB(sky[0], sky[1], sky[2])
    this.fill.groundColor.setRGB(ground[0], ground[1], ground[2])
    this.fill.intensity = fill

    const gainA = gainOf(a.innerLights, f.time, f.period)
    const gainB = gainOf(b.innerLights, f.time, f.period) * (1 + BLOOM_GAIN * f.mix.bloom)
    lightUniforms.uGridA.value = f.grids[0]
    lightUniforms.uGridB.value = f.grids[1]
    lightUniforms.uGrid.value.set(t, gainA, gainB, innerRadiusMm)
    const ga = glowOf(a.innerLights)
    const gb = glowOf(b.innerLights)
    const pool = mixRgb([ga[0] * gainA, ga[1] * gainA, ga[2] * gainA], [gb[0] * gainB, gb[1] * gainB, gb[2] * gainB], t)
    this.glow.color.setRGB(pool[0], pool[1], pool[2])
    this.glow.intensity = GLOW_POWER

    f.keyDir.set(keyFrom[0], keyFrom[1], keyFrom[2]).sub(this.key.target.position).normalize()
    f.rimDir.set(rimFrom[0], rimFrom[1], rimFrom[2]).sub(this.key.target.position).normalize()
    f.keyCol.setRGB(keyCol[0] * keyPower, keyCol[1] * keyPower, keyCol[2] * keyPower)
    f.rimCol.setRGB(rimCol[0] * rimPower, rimCol[1] * rimPower, rimCol[2] * rimPower)
    f.sky.setRGB(sky[0], sky[1], sky[2])
    f.ground.setRGB(ground[0], ground[1], ground[2])
    f.fill = fill
    f.ambient.setRGB(sky[0] * fill, sky[1] * fill, sky[2] * fill)
    f.pool.setRGB(pool[0], pool[1], pool[2])
    f.bloomTint.setRGB(gb[0] * f.mix.bloom, gb[1] * f.mix.bloom, gb[2] * f.mix.bloom)
  }
}
