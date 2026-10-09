import { describe, it, expect } from 'vitest'
import { COLORMAPS, colormapLookup } from '../colormaps'

describe('colormaps', () => {
  it('has three 256-entry maps with inferno dark at 0 and bright at 1', () => {
    for (const k of ['inferno', 'magma', 'viridis'] as const) expect(COLORMAPS[k].length).toBe(768)
    const out = new Float32Array(6)
    colormapLookup(COLORMAPS.inferno, 0, out, 0)
    colormapLookup(COLORMAPS.inferno, 1, out, 3)
    expect(out[0] + out[1] + out[2]).toBeLessThan(0.1)
    expect(out[3] + out[4] + out[5]).toBeGreaterThan(2.5)
  })
})
