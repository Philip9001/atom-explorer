import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { IsoSurface } from '../isosurface'

describe('IsoSurface', () => {
  it('splits a triangle soup into positive and negative meshes by vertex sign', () => {
    const iso = new IsoSurface()
    // two triangles: first all +1, second all -1
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 0, 1, 1])
    const normals = new Float32Array(18).fill(0).map((_, i) => (i % 3 === 2 ? 1 : 0))
    const signs = new Int8Array([1, 1, 1, -1, -1, -1])
    iso.update(positions, normals, signs, new THREE.Color('#ff0000'), new THREE.Color('#0000ff'))
    expect(iso.positive.geometry.getAttribute('position').count).toBe(3)
    expect(iso.negative.geometry.getAttribute('position').count).toBe(3)
    expect(iso.negative.geometry.getAttribute('position').getX(0)).toBe(0)
    expect(iso.negative.geometry.getAttribute('position').getZ(0)).toBe(1)
  })
  it('replaces geometry on update and disposes the old one', () => {
    const iso = new IsoSurface()
    const empty = () => iso.update(new Float32Array(0), new Float32Array(0), new Int8Array(0), new THREE.Color(), new THREE.Color())
    empty()
    const g1 = iso.positive.geometry
    let disposed = false
    g1.addEventListener('dispose', () => { disposed = true })
    empty()
    expect(iso.positive.geometry).not.toBe(g1)
    expect(disposed).toBe(true)
  })
})
