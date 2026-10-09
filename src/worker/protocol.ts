import type { Orbital } from '../physics/orbital'

export type SampleRequest = { id: number; type: 'sample'; orbital: Orbital; count: number; seed: number }
export type GridRequest = { id: number; type: 'grid'; orbital: Orbital; size: number; fraction: number }
export type WorkerRequest = SampleRequest | GridRequest

export type SampleResponse = {
  id: number
  type: 'sample'
  positions: Float32Array
  psi: Float32Array
  maxDensity: number
  rMax: number
}
export type GridResponse = {
  id: number
  type: 'grid'
  positions: Float32Array
  normals: Float32Array
  signs: Int8Array
  threshold: number
  rMax: number
}
export type ErrorResponse = { id: number; type: 'error'; message: string }
export type WorkerResponse = SampleResponse | GridResponse | ErrorResponse

const orbitalKey = (o: Orbital) => `${o.n},${o.l},${o.m},${o.Z.toFixed(4)},${o.real ? 1 : 0}`
export const sampleKey = (o: Orbital, count: number, seed: number): string => `${orbitalKey(o)},s${count},${seed}`
export const gridKey = (o: Orbital, size: number, fraction: number): string => `${orbitalKey(o)},g${size},${fraction.toFixed(3)}`
