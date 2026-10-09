import { sampleOrbital } from '../physics/sampling'
import { buildDensityGrid, findThreshold } from '../physics/grid'
import { marchingCubes } from '../physics/marchingCubes'
import type { WorkerRequest, WorkerResponse } from './protocol'

const ctx = self as unknown as Worker

ctx.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data
  try {
    if (req.type === 'sample') {
      const r = sampleOrbital(req.orbital, req.count, req.seed)
      const res: WorkerResponse = { id: req.id, type: 'sample', ...r }
      ctx.postMessage(res, [r.positions.buffer, r.psi.buffer])
    } else {
      const grid = buildDensityGrid(req.orbital, req.size)
      const threshold = findThreshold(grid, req.fraction)
      const mesh = marchingCubes(grid, threshold)
      const res: WorkerResponse = { id: req.id, type: 'grid', ...mesh, threshold, rMax: grid.rMax }
      ctx.postMessage(res, [mesh.positions.buffer, mesh.normals.buffer, mesh.signs.buffer])
    }
  } catch (e) {
    const res: WorkerResponse = { id: req.id, type: 'error', message: (e as Error).message }
    ctx.postMessage(res)
  }
}
