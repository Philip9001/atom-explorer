import type { Orbital } from '../physics/orbital'
import { gridKey, sampleKey, type GridResponse, type SampleResponse, type WorkerRequest, type WorkerResponse } from './protocol'

/** The subset of Worker the client uses; lets tests substitute a fake. */
export interface WorkerLike {
  postMessage(msg: unknown, transfer?: Transferable[]): void
  onmessage: ((ev: MessageEvent) => void) | null
  terminate(): void
}

interface Pending {
  key: string
  resolve: (r: WorkerResponse) => void
  reject: (e: Error) => void
}

/** Promise wrapper over the orbital worker with an LRU result cache and cancellation. */
export class OrbitalWorkerClient {
  private nextId = 1
  private pending = new Map<number, Pending>()
  private cache = new Map<string, WorkerResponse>()
  private worker: WorkerLike
  private cacheLimit: number

  constructor(worker: WorkerLike, cacheLimit = 64) {
    this.worker = worker
    this.cacheLimit = cacheLimit
    worker.onmessage = (ev: MessageEvent) => this.onMessage(ev.data as WorkerResponse)
  }

  sample(orbital: Orbital, count: number, seed: number): Promise<SampleResponse> {
    const key = sampleKey(orbital, count, seed)
    return this.request(key, { id: 0, type: 'sample', orbital, count, seed }) as Promise<SampleResponse>
  }

  grid(orbital: Orbital, size: number, fraction: number): Promise<GridResponse> {
    const key = gridKey(orbital, size, fraction)
    return this.request(key, { id: 0, type: 'grid', orbital, size, fraction }) as Promise<GridResponse>
  }

  /** Reject every in-flight request; their replies, when they arrive, are dropped. */
  cancelAll(): void {
    for (const p of this.pending.values()) p.reject(new Error('cancelled'))
    this.pending.clear()
  }

  dispose(): void {
    this.cancelAll()
    this.cache.clear()
    this.worker.terminate()
  }

  private request(key: string, req: WorkerRequest): Promise<WorkerResponse> {
    const hit = this.cache.get(key)
    if (hit) {
      this.cache.delete(key)
      this.cache.set(key, hit) // refresh LRU position
      return Promise.resolve(hit)
    }
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { key, resolve, reject })
      this.worker.postMessage({ ...req, id })
    })
  }

  private onMessage(res: WorkerResponse): void {
    const p = this.pending.get(res.id)
    if (!p) return // cancelled or unknown: drop
    this.pending.delete(res.id)
    if (res.type === 'error') {
      p.reject(new Error(res.message))
      return
    }
    this.cache.set(p.key, res)
    while (this.cache.size > this.cacheLimit) {
      const oldest = this.cache.keys().next().value
      if (oldest === undefined) break
      this.cache.delete(oldest)
    }
    p.resolve(res)
  }
}
