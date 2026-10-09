import type { Orbital } from '../physics/orbital'
import { gridKey, sampleKey, type GridResponse, type SampleResponse, type WorkerRequest, type WorkerResponse } from './protocol'

/** The subset of Worker the client uses; lets tests substitute a fake. */
export interface WorkerLike {
  postMessage(msg: unknown, transfer?: Transferable[]): void
  onmessage: ((ev: MessageEvent) => void) | null
  onerror: ((ev: ErrorEvent) => void) | null
  terminate(): void
}

export interface ClientOptions {
  /** Maximum cached results (default 64). */
  maxEntries?: number
  /** Maximum cached typed-array bytes (default 192 MB). */
  maxBytes?: number
}

interface Pending {
  key: string
  req: WorkerRequest
  resolvers: { resolve: (r: WorkerResponse) => void; reject: (e: Error) => void }[]
}

function responseBytes(r: WorkerResponse): number {
  if (r.type === 'sample') return r.positions.byteLength + r.psi.byteLength + r.phase.byteLength
  if (r.type === 'grid') return r.positions.byteLength + r.normals.byteLength + r.signs.byteLength
  return 0
}

/**
 * Promise wrapper over the orbital worker. One request is in flight at a time;
 * the rest wait in a queue so `cancelAll` can discard work the worker never started.
 * Identical keys share one request. Results are cached in an LRU bounded by both
 * entry count and bytes.
 */
export class OrbitalWorkerClient {
  private nextId = 1
  private inFlight: { id: number; pending: Pending } | null = null
  private queue: Pending[] = []
  private cache = new Map<string, WorkerResponse>()
  private cacheBytes = 0
  private worker: WorkerLike
  private maxEntries: number
  private maxBytes: number
  /** Called with a message when the worker itself fails (e.g. it could not load). */
  onError?: (message: string) => void

  constructor(worker: WorkerLike, options: ClientOptions = {}) {
    this.worker = worker
    this.maxEntries = options.maxEntries ?? 64
    this.maxBytes = options.maxBytes ?? 192 * 1024 * 1024
    worker.onmessage = (ev: MessageEvent) => this.onMessage(ev.data as WorkerResponse)
    worker.onerror = (ev: ErrorEvent) => this.onWorkerError(ev.message || 'worker error')
  }

  sample(orbital: Orbital, count: number, seed: number): Promise<SampleResponse> {
    const key = sampleKey(orbital, count, seed)
    return this.request(key, { id: 0, type: 'sample', orbital, count, seed }) as Promise<SampleResponse>
  }

  grid(orbital: Orbital, size: number, fraction: number): Promise<GridResponse> {
    const key = gridKey(orbital, size, fraction)
    return this.request(key, { id: 0, type: 'grid', orbital, size, fraction }) as Promise<GridResponse>
  }

  /** Reject every waiting and in-flight request; the in-flight reply, when it arrives, is dropped. */
  cancelAll(): void {
    const all = [...this.queue, ...(this.inFlight ? [this.inFlight.pending] : [])]
    this.queue = []
    if (this.inFlight) this.inFlight = { id: this.inFlight.id, pending: { ...this.inFlight.pending, resolvers: [] } }
    for (const p of all) for (const r of p.resolvers) r.reject(new Error('cancelled'))
  }

  dispose(): void {
    this.cancelAll()
    this.cache.clear()
    this.cacheBytes = 0
    this.worker.terminate()
  }

  private request(key: string, req: WorkerRequest): Promise<WorkerResponse> {
    const hit = this.cache.get(key)
    if (hit) {
      this.cache.delete(key)
      this.cache.set(key, hit) // refresh LRU position
      return Promise.resolve(hit)
    }
    return new Promise((resolve, reject) => {
      const existing = this.inFlight?.pending.key === key ? this.inFlight.pending : this.queue.find((p) => p.key === key)
      if (existing) {
        existing.resolvers.push({ resolve, reject })
        return
      }
      this.queue.push({ key, req, resolvers: [{ resolve, reject }] })
      this.pump()
    })
  }

  private pump(): void {
    if (this.inFlight || this.queue.length === 0) return
    const pending = this.queue.shift()!
    const id = this.nextId++
    this.inFlight = { id, pending }
    this.worker.postMessage({ ...pending.req, id })
  }

  private onMessage(res: WorkerResponse): void {
    if (!this.inFlight || this.inFlight.id !== res.id) return // stale or unknown: drop
    const { pending } = this.inFlight
    this.inFlight = null
    if (res.type === 'error') {
      for (const r of pending.resolvers) r.reject(new Error(res.message))
    } else {
      if (pending.resolvers.length > 0) this.store(pending.key, res)
      for (const r of pending.resolvers) r.resolve(res)
    }
    this.pump()
  }

  private onWorkerError(message: string): void {
    const all = [...this.queue, ...(this.inFlight ? [this.inFlight.pending] : [])]
    this.queue = []
    this.inFlight = null
    for (const p of all) for (const r of p.resolvers) r.reject(new Error(message))
    this.onError?.(message)
  }

  private store(key: string, res: WorkerResponse): void {
    const bytes = responseBytes(res)
    if (bytes > this.maxBytes) return
    this.cache.set(key, res)
    this.cacheBytes += bytes
    while (this.cache.size > this.maxEntries || this.cacheBytes > this.maxBytes) {
      const oldest = this.cache.keys().next().value
      if (oldest === undefined) break
      this.cacheBytes -= responseBytes(this.cache.get(oldest)!)
      this.cache.delete(oldest)
    }
  }
}
