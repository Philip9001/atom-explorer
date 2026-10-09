import { describe, it, expect } from 'vitest'
import { OrbitalWorkerClient, type WorkerLike } from '../client'
import type { WorkerRequest, WorkerResponse } from '../protocol'

/** Fake worker: records requests; replies only when `reply()` is called. */
class FakeWorker implements WorkerLike {
  onmessage: ((ev: MessageEvent) => void) | null = null
  onerror: ((ev: ErrorEvent) => void) | null = null
  requests: WorkerRequest[] = []
  postMessage(msg: unknown) { this.requests.push(msg as WorkerRequest) }
  terminate() {}
  reply(res: WorkerResponse) { this.onmessage?.({ data: res } as MessageEvent) }
}
const o = { n: 1, l: 0, m: 0, Z: 1, real: true }
const sampleReply = (id: number): WorkerResponse => ({
  id, type: 'sample', positions: new Float32Array(30), psi: new Float32Array(10), phase: new Float32Array(10), maxDensity: 1, rMax: 5,
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
    const w = new FakeWorker(), c = new OrbitalWorkerClient(w, { maxEntries: 2 })
    for (let i = 0; i < 3; i++) {
      const p = c.sample(o, 10 + i, 1)
      w.reply(sampleReply(w.requests[i].id))
      await p
    }
    c.sample(o, 10, 1) // evicted -> new request
    expect(w.requests.length).toBe(4)
  })
})

describe('OrbitalWorkerClient queueing', () => {
  const o = { n: 1, l: 0, m: 0, Z: 1, real: true }
  const reply = (id: number, n = 10): WorkerResponse => ({ id, type: 'sample', positions: new Float32Array(n * 3), psi: new Float32Array(n), phase: new Float32Array(n), maxDensity: 1, rMax: 5 })

  it('posts at most one request at a time and cancelAll discards queued work', async () => {
    const w = new FakeWorker(), c = new OrbitalWorkerClient(w)
    const p1 = c.sample(o, 10, 1)
    const p2 = c.sample(o, 20, 1)
    const p3 = c.sample(o, 30, 1)
    expect(w.requests.length).toBe(1)
    c.cancelAll()
    await expect(p1).rejects.toThrow('cancelled')
    await expect(p2).rejects.toThrow('cancelled')
    await expect(p3).rejects.toThrow('cancelled')
    w.reply(reply(w.requests[0].id))
    expect(w.requests.length).toBe(1) // nothing queued was ever posted
  })
  it('dedupes identical keys in flight', async () => {
    const w = new FakeWorker(), c = new OrbitalWorkerClient(w)
    const a = c.sample(o, 10, 1), b = c.sample(o, 10, 1)
    expect(w.requests.length).toBe(1)
    w.reply(reply(w.requests[0].id))
    expect(await a).toBe(await b)
  })
  it('evicts by byte budget', async () => {
    const w = new FakeWorker(), c = new OrbitalWorkerClient(w, { maxBytes: 1000 })
    for (let i = 0; i < 3; i++) {
      const p = c.sample(o, 10 + i, 1)
      w.reply(reply(w.requests[i].id, 25)) // 25*3*4 + 25*4 + 25*4 = 500 bytes each
      await p
    }
    c.sample(o, 10, 1) // first entry evicted -> re-requested
    expect(w.requests.length).toBe(4)
  })
  it('worker errors reject pending requests and notify', async () => {
    const w = new FakeWorker(), c = new OrbitalWorkerClient(w)
    let notified = ''
    c.onError = (m) => { notified = m }
    const p = c.sample(o, 10, 1)
    w.onerror?.(new ErrorEvent('error', { message: 'failed to load' }))
    await expect(p).rejects.toThrow('failed to load')
    expect(notified).toContain('failed to load')
  })
})
