import { describe, it, expect } from 'vitest'
import { laguerre } from '../laguerre'
import { legendreP } from '../legendre'
import { factorial } from '../factorial'

describe('factorial', () => {
  it('matches known values', () => {
    expect(factorial(0)).toBe(1)
    expect(factorial(5)).toBe(120)
    expect(factorial(13)).toBe(6227020800)
  })
})

describe('laguerre', () => {
  // Abramowitz & Stegun 22.3.9: L^a_0 = 1, L^a_1 = 1 + a - x,
  // L^a_2 = (x^2 - 2(a+2)x + (a+1)(a+2)) / 2
  it('matches closed forms', () => {
    expect(laguerre(0, 1, 2.5)).toBeCloseTo(1, 12)
    expect(laguerre(1, 1, 2.5)).toBeCloseTo(1 + 1 - 2.5, 12)
    const a = 3, x = 0.7
    expect(laguerre(2, a, x)).toBeCloseTo((x * x - 2 * (a + 2) * x + (a + 1) * (a + 2)) / 2, 12)
  })
  it('L^1_1(x) has its root at x = 2 (the 2s radial node)', () => {
    expect(laguerre(1, 1, 2)).toBeCloseTo(0, 12)
  })
})

describe('legendreP', () => {
  it('matches closed forms (no Condon-Shortley phase)', () => {
    const x = 0.3
    expect(legendreP(0, 0, x)).toBeCloseTo(1, 12)
    expect(legendreP(1, 0, x)).toBeCloseTo(x, 12)
    expect(legendreP(1, 1, x)).toBeCloseTo(Math.sqrt(1 - x * x), 12)
    expect(legendreP(2, 0, x)).toBeCloseTo((3 * x * x - 1) / 2, 12)
    expect(legendreP(2, 1, x)).toBeCloseTo(3 * x * Math.sqrt(1 - x * x), 12)
    expect(legendreP(2, 2, x)).toBeCloseTo(3 * (1 - x * x), 12)
    expect(legendreP(3, 0, x)).toBeCloseTo((5 * x ** 3 - 3 * x) / 2, 12)
  })
})
