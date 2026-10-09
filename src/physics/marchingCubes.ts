import type { DensityGrid } from './grid'
import { gridIndex } from './grid'
import { EDGE_TABLE, TRI_TABLE } from './mcTables'

export interface IsoMesh {
  /** Non-indexed triangle soup, xyz per vertex. */
  positions: Float32Array
  /** Unit normals per vertex, pointing outward (toward lower density). */
  normals: Float32Array
  /** +1 / -1 sign of psi per vertex. */
  signs: Int8Array
}

// Corner offsets and edge->corner pairs in the Lorensen & Cline (1987) / Bourke numbering.
const CORNERS = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] as const
const EDGES = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]] as const

/**
 * Marching cubes (Lorensen & Cline, SIGGRAPH 1987) on the scalar field psi^2 at
 * `threshold`. "Inside" is density >= threshold. Bourke's tables assume inside =
 * below the isovalue, so each triangle's vertex order is reversed here to keep
 * counter-clockwise winding when seen from outside.
 */
export function marchingCubes(grid: DensityGrid, threshold: number): IsoMesh {
  const { size, rMax, psi } = grid
  const pos: number[] = []
  const nrm: number[] = []
  const sgn: number[] = []
  if (!Number.isFinite(threshold)) return pack(pos, nrm, sgn)
  const h = (2 * rMax) / size
  const clampIdx = (v: number) => (v < 0 ? 0 : v >= size ? size - 1 : v)
  const dens = (i: number, j: number, k: number) => {
    const v = psi[gridIndex(size, clampIdx(i), clampIdx(j), clampIdx(k))]
    return v * v
  }
  // Outward normal = -grad(psi^2) by central differences (the surface encloses the high-density region).
  const gradient = (i: number, j: number, k: number, out: number[]) => {
    out[0] = -(dens(i + 1, j, k) - dens(i - 1, j, k))
    out[1] = -(dens(i, j + 1, k) - dens(i, j - 1, k))
    out[2] = -(dens(i, j, k + 1) - dens(i, j, k - 1))
  }
  const cd = new Float64Array(8)
  const cs = new Int8Array(8)
  const vert = new Float64Array(36)
  const vnrm = new Float64Array(36)
  const vsgn = new Int8Array(12)
  const ga = [0, 0, 0]
  const gb = [0, 0, 0]
  for (let k = 0; k < size - 1; k++) {
    for (let j = 0; j < size - 1; j++) {
      for (let i = 0; i < size - 1; i++) {
        let cubeIndex = 0
        for (let c = 0; c < 8; c++) {
          const [di, dj, dk] = CORNERS[c]
          const v = psi[gridIndex(size, i + di, j + dj, k + dk)]
          cd[c] = v * v
          cs[c] = v >= 0 ? 1 : -1
          if (cd[c] >= threshold) cubeIndex |= 1 << c
        }
        const edges = EDGE_TABLE[cubeIndex]
        if (edges === 0) continue
        for (let e = 0; e < 12; e++) {
          if (!(edges & (1 << e))) continue
          const [a, b] = EDGES[e]
          const da = cd[a], db = cd[b]
          const t = da === db ? 0.5 : (threshold - da) / (db - da)
          const [ai, aj, ak] = CORNERS[a]
          const [bi, bj, bk] = CORNERS[b]
          vert[3 * e] = -rMax + (i + ai + 0.5 + (bi - ai) * t) * h
          vert[3 * e + 1] = -rMax + (j + aj + 0.5 + (bj - aj) * t) * h
          vert[3 * e + 2] = -rMax + (k + ak + 0.5 + (bk - ak) * t) * h
          gradient(i + ai, j + aj, k + ak, ga)
          gradient(i + bi, j + bj, k + bk, gb)
          const nx = ga[0] + (gb[0] - ga[0]) * t
          const ny = ga[1] + (gb[1] - ga[1]) * t
          const nz = ga[2] + (gb[2] - ga[2]) * t
          const len = Math.hypot(nx, ny, nz) || 1
          vnrm[3 * e] = nx / len
          vnrm[3 * e + 1] = ny / len
          vnrm[3 * e + 2] = nz / len
          vsgn[e] = da >= db ? cs[a] : cs[b]
        }
        for (let t = cubeIndex * 16; TRI_TABLE[t] !== -1; t += 3) {
          for (let q = 2; q >= 0; q--) {
            const e = TRI_TABLE[t + q]
            pos.push(vert[3 * e], vert[3 * e + 1], vert[3 * e + 2])
            nrm.push(vnrm[3 * e], vnrm[3 * e + 1], vnrm[3 * e + 2])
            sgn.push(vsgn[e])
          }
        }
      }
    }
  }
  return pack(pos, nrm, sgn)
}

function pack(p: number[], n: number[], s: number[]): IsoMesh {
  return { positions: Float32Array.from(p), normals: Float32Array.from(n), signs: Int8Array.from(s) }
}
