import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { SphereCloud } from '../sphereCloud'

describe('SphereCloud phase hue', () => {
  it('colors by phase angle when a part carries phases', () => {
    const cloud = new SphereCloud(4)
    cloud.updateMany([{
      positions: new Float32Array(9), psi: new Float32Array([1, 1, 1]),
      pos: new THREE.Color(1, 1, 1), neg: new THREE.Color(0, 0, 0),
      phase: new Float32Array([0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]),
    }], 1)
    const c = cloud.mesh.instanceColor!.array
    const hsl = { h: 0, s: 0, l: 0 }
    new THREE.Color(c[0], c[1], c[2]).getHSL(hsl)
    expect(hsl.h).toBeCloseTo(0, 2)
    new THREE.Color(c[3], c[4], c[5]).getHSL(hsl)
    expect(hsl.h).toBeCloseTo(1 / 3, 2)
    new THREE.Color(c[6], c[7], c[8]).getHSL(hsl)
    expect(hsl.h).toBeCloseTo(2 / 3, 2)
  })
})
