import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { SphereCloud } from '../sphereCloud'
import { GlowCloud } from '../glowCloud'
import { IsoSurfaceSet } from '../isosurface'
import { COLORMAPS } from '../../physics/colormaps'

describe('SphereCloud.updateMany', () => {
  it('concatenates parts with their own color pairs', () => {
    const cloud = new SphereCloud(10)
    cloud.updateMany([
      { positions: new Float32Array([1, 0, 0]), psi: new Float32Array([1]), pos: new THREE.Color(1, 0, 0), neg: new THREE.Color(0.5, 0, 0) },
      { positions: new Float32Array([0, 2, 0, 0, 3, 0]), psi: new Float32Array([-1, 1]), pos: new THREE.Color(0, 1, 0), neg: new THREE.Color(0, 0.5, 0) },
    ], 0.5)
    expect(cloud.mesh.count).toBe(3)
    const m = cloud.mesh.instanceMatrix.array, c = cloud.mesh.instanceColor!.array
    expect(m[16 + 13]).toBe(2)
    expect(m[32 + 13]).toBe(3)
    expect(Array.from(c.slice(3, 6))).toEqual([0, 0.5, 0])
    expect(Array.from(c.slice(6, 9))).toEqual([0, 1, 0])
  })
})

describe('GlowCloud.updateMany', () => {
  it('normalizes each part by its own max density', () => {
    const cloud = new GlowCloud(10)
    cloud.updateMany([
      { positions: new Float32Array(3), psi: new Float32Array([1]), maxDensity: 1 },
      { positions: new Float32Array(3), psi: new Float32Array([0.1]), maxDensity: 0.01 },
    ], COLORMAPS.inferno, 1)
    const c = cloud.points.geometry.getAttribute('color').array as Float32Array
    // both points are at their part's maximum -> both near white
    expect(c[0] + c[1] + c[2]).toBeGreaterThan(2.5)
    expect(c[3] + c[4] + c[5]).toBeGreaterThan(2.5)
    expect(cloud.points.geometry.drawRange.count).toBe(2)
  })
})

describe('IsoSurfaceSet', () => {
  it('keeps one surface per key, removing stale ones', () => {
    const set = new IsoSurfaceSet()
    const empty = { positions: new Float32Array(0), normals: new Float32Array(0), signs: new Int8Array(0) }
    set.update([{ key: '1s', ...empty, color: '#ff0000' }, { key: '2p', ...empty, color: '#00ff00' }])
    expect(set.group.children.length).toBe(2)
    set.update([{ key: '2p', ...empty, color: '#00ff00' }])
    expect(set.group.children.length).toBe(1)
    expect(set.surfaces.has('1s')).toBe(false)
  })
})
