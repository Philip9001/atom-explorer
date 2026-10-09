import { radialR } from './radial'

/** Radial distribution r^2 R_nl^2(r) on `points` samples of [0, rMax]; integrates to 1 over r. */
export function radialCurve(n: number, l: number, Z: number, rMax: number, points: number): { r: Float32Array; y: Float32Array } {
  const r = new Float32Array(points), y = new Float32Array(points)
  for (let i = 0; i < points; i++) {
    const ri = (rMax * i) / (points - 1)
    const R = radialR(n, l, Z, ri)
    r[i] = ri
    y[i] = ri * ri * R * R
  }
  return { r, y }
}
