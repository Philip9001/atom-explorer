import { describe, it, expect } from 'vitest'
import { OrbitalWorkerClient, type WorkerLike } from '../client'
import type { WorkerRequest, WorkerResponse } from '../protocol'

/** Fake worker: records requests; replies only when `reply()` is called. */
class FakeWorker implements WorkerLike {
  onmessage: ((ev: MessageEvent) => void) | null = null
  requests: WorkerRequest[] = []
  postMessage(msg: unknown) { this.requests.push(msg as WorkerRequest) }
  terminate() {}
  reply(res: WorkerResponse) { this.onmessage?.({ data: res } as MessageEvent) }
}
const o = { n: 1, l: 0, m: 0, Z: 1, real: true }
const sampleReply = (id: number): WorkerResponse => ({
  id, type: 'sample', positions: new Float32Array(30), psi: new Float32Array(10), maxDensity: 1, rMax: 5,
})

describe('OrbitalWorkerClient', () => {
  it('posts a request and resolves with the response', async () => {
    const w = new FakeWorker(), c = new OrbitalWorkerClient(w)
    const p = c.sample(o, 10, 1)
    expect(w.requests.length).toBe(1)
    w.reply(sampleReply(w.requests[0].id))
    expect((await p).psi.length).toBe(10)
  })
  it('caches identical requests', async () => {
    const w = new FakeWorker(), c = new OrbitalWorkerClient(w)
    const p = c.sample(o, 10, 1)
    w.reply(sampleReply(w.requests[0].id))
    await p
    await c.sample(o, 10, 1)
    expect(w.requests.length).toBe(1)
  })
  it('cancelAll rejects pending and ignores late replies', async () => {
    const w = new FakeWorker(), c = new OrbitalWorkerClient(w)
    const p = c.sample(o, 10, 1)
    c.cancelAll()
    await expect(p).rejects.toThrow('cancelled')
    w.reply(sampleReply(w.requests[0].id))
    const p2 = c.sample(o, 10, 1)
    expect(w.requests.length).toBe(2) // the stale reply did not populate the cache
    w.reply(sampleReply(w.requests[1].id))
    await p2
  })
  it('rejects on error responses', async () => {
    const w = new FakeWorker(), c = new OrbitalWorkerClient(w)
    const p = c.grid(o, 8, 0.9)
    w.reply({ id: w.requests[0].id, type: 'error', message: 'boom' })
    await expect(p).rejects.toThrow('boom')
  })
  it('evicts the oldest cache entry beyond the limit', async () => {
    const w = new FakeWorker(), c = new OrbitalWorkerClient(w, 2)
    for (let i = 0; i < 3; i++) {
      const p = c.sample(o, 10 + i, 1)
      w.reply(sampleReply(w.requests[i].id))
      await p
    }
    c.sample(o, 10, 1) // evicted -> new request
    expect(w.requests.length).toBe(4)
  })
})
