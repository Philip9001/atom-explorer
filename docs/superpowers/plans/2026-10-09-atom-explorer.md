# Atom Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser app that shows hydrogen-like electron orbitals of elements Z=1..36 as lit sphere clouds, glow clouds, or isosurfaces, with a periodic table picker and a single-orbital n/l/m mode.

**Architecture:** Pure physics in `src/physics/` (tested with Vitest) feeds a Web Worker that samples points and builds marching-cubes meshes, returning typed arrays. A thin render layer on three.js 0.186 (built-in materials only, EffectComposer with GTAO or Bloom) draws them. A single `AppState` object drives the UI (lil-gui + plain HTML) and URL state.

**Tech Stack:** Vite 8.3, TypeScript ~6.0, three 0.186.1 + @types/three 0.186.0, lil-gui 0.21.0, Vitest 5.0.3, Node 26.

**Spec:** `docs/superpowers/specs/2026-10-09-atom-explorer-design.md`

## Global Constraints

- Dependencies are exactly: three@0.186.1, lil-gui@0.21.0, @types/three@0.186.0, vitest@5.0.3, typescript ~6.0.2, vite ^8.3.0. No new dependency without asking the user (name, version, license, last release).
- `src/physics/` never imports three or DOM APIs.
- Every formula gets a short comment naming its source.
- Only built-in three materials; no ShaderMaterial / RawShaderMaterial / onBeforeCompile.
- No network calls at runtime.
- No third-party element JSON; element table typed by hand. Colormap tables generated from the CC0 BIDS/colormap `colormaps.py` with attribution.
- Marching-cubes edge/tri tables copied from three's MIT `MarchingCubes.js` into `src/physics/mcTables.ts` with attribution; the meshing loop is written here.
- Commit after each task; `npm test` and `npx tsc --noEmit` must pass before each commit.

## Review Focus

1. n/l/m inputs out of range (l>=n, |m|>l, n>7) from the URL or GUI: the app must clamp to a valid orbital and not throw. Pinned in Task 15 (urlState tests in Task 20).
2. Very large N (150k spheres, 500k points) switched rapidly: stale worker responses must be dropped (latest-request-wins) and GPU buffers disposed. Pinned in Task 9 (client cancellation test) and Task 11 (dispose).
3. Zero-electron or tiny subshells (1s of Kr gets few points): per-subshell N must have a floor so toggling a subshell always shows something. Pinned in Task 16.
4. Isosurface fraction near 0 or 1, and grid sizes where no cell exceeds the threshold: `findThreshold` must return a finite threshold and marching cubes must return an empty mesh, not NaN geometry. Pinned in Task 7 and Task 8.
5. WebGL context loss / no WebGL2: the app must show a readable message instead of a blank page. Pinned in Task 10.

---

## Milestone 1: physics library

### Task 1: Laguerre and Legendre polynomials

**Files:**
- Create: `src/physics/laguerre.ts`, `src/physics/legendre.ts`, `src/physics/factorial.ts`
- Test: `src/physics/__tests__/polynomials.test.ts`

**Interfaces:**
- Produces: `laguerre(k: number, alpha: number, x: number): number` (generalized Laguerre L^alpha_k(x)), `legendreP(l: number, m: number, x: number): number` (associated Legendre, m>=0, no Condon-Shortley phase), `factorial(n: number): number` (0..20, table).

- [ ] **Step 1: Write the failing tests**

```ts
// src/physics/__tests__/polynomials.test.ts
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
  // L^a_2 = ((x^2) - 2(a+2)x + (a+1)(a+2)) / 2
  it('matches closed forms', () => {
    expect(laguerre(0, 1, 2.5)).toBeCloseTo(1, 12)
    expect(laguerre(1, 1, 2.5)).toBeCloseTo(1 + 1 - 2.5, 12)
    const a = 3, x = 0.7
    expect(laguerre(2, a, x)).toBeCloseTo((x * x - 2 * (a + 2) * x + (a + 1) * (a + 2)) / 2, 12)
  })
  it('L^1_1(x) has its root at x = 2 (needed for the 2s radial node)', () => {
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/physics/__tests__/polynomials.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

```ts
// src/physics/factorial.ts
const TABLE: number[] = [1]
for (let i = 1; i <= 20; i++) TABLE[i] = TABLE[i - 1] * i
/** n! for 0 <= n <= 20 (exact in double precision up to 18!, adequate here). */
export function factorial(n: number): number {
  if (n < 0 || n > 20 || !Number.isInteger(n)) throw new RangeError(`factorial(${n})`)
  return TABLE[n]
}
```

```ts
// src/physics/laguerre.ts
/**
 * Generalized (associated) Laguerre polynomial L^alpha_k(x).
 * Three-term recurrence, Abramowitz & Stegun 22.7.12:
 *   (k+1) L_{k+1} = (2k+1+alpha-x) L_k - (k+alpha) L_{k-1}
 * with L_0 = 1, L_1 = 1 + alpha - x. Convention: leading coefficient (-1)^k / k!.
 */
export function laguerre(k: number, alpha: number, x: number): number {
  if (k === 0) return 1
  let prev = 1
  let cur = 1 + alpha - x
  for (let i = 1; i < k; i++) {
    const next = ((2 * i + 1 + alpha - x) * cur - (i + alpha) * prev) / (i + 1)
    prev = cur
    cur = next
  }
  return cur
}
```

```ts
// src/physics/legendre.ts
/**
 * Associated Legendre function P_l^m(x) for m >= 0, |x| <= 1, WITHOUT the
 * Condon-Shortley phase (-1)^m. Recurrences from Numerical Recipes 3rd ed. 6.7:
 *   P_m^m   = (2m-1)!! (1-x^2)^{m/2}
 *   P_{m+1}^m = x (2m+1) P_m^m
 *   (l-m) P_l^m = x (2l-1) P_{l-1}^m - (l+m-1) P_{l-2}^m
 */
export function legendreP(l: number, m: number, x: number): number {
  if (m < 0 || m > l) throw new RangeError(`legendreP(${l},${m})`)
  let pmm = 1
  if (m > 0) {
    const somx2 = Math.sqrt((1 - x) * (1 + x))
    let fact = 1
    for (let i = 1; i <= m; i++) {
      pmm *= fact * somx2
      fact += 2
    }
  }
  if (l === m) return pmm
  let pmmp1 = x * (2 * m + 1) * pmm
  if (l === m + 1) return pmmp1
  let pll = 0
  for (let ll = m + 2; ll <= l; ll++) {
    pll = (x * (2 * ll - 1) * pmmp1 - (ll + m - 1) * pmm) / (ll - m)
    pmm = pmmp1
    pmmp1 = pll
  }
  return pll
}
```

- [ ] **Step 4: Run tests, expect PASS.** Also run `npx tsc --noEmit`.

- [ ] **Step 5: Commit** `git add src/physics && git commit -m "Add Laguerre, Legendre and factorial helpers"`

### Task 2: Radial function R_nl and real/complex Y_lm

**Files:**
- Create: `src/physics/radial.ts`, `src/physics/harmonics.ts`, `src/physics/quadrature.ts`
- Test: `src/physics/__tests__/radial.test.ts`, `src/physics/__tests__/harmonics.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `radialR(n: number, l: number, Z: number, r: number): number`
  - `radialNorm(n: number, l: number, Z: number): number` (the prefactor)
  - `realY(l: number, m: number, cosTheta: number, phi: number): number`
  - `complexY(l: number, m: number, cosTheta: number, phi: number): { re: number; im: number }`
  - `angularNorm(l: number, m: number): number` = sqrt((2l+1)/(4π) (l-|m|)!/(l+|m|)!)
  - `simpson(f: (x: number) => number, a: number, b: number, n: number): number` (n even)

- [ ] **Step 1: Write the failing tests**

```ts
// src/physics/__tests__/radial.test.ts
import { describe, it, expect } from 'vitest'
import { radialR } from '../radial'
import { simpson } from '../quadrature'

function countSignChanges(f: (r: number) => number, a: number, b: number, steps: number): number {
  let changes = 0
  let prev = f(a + (b - a) / steps)
  for (let i = 2; i < steps; i++) {
    const v = f(a + ((b - a) * i) / steps)
    if (v * prev < 0) changes++
    if (v !== 0) prev = v
  }
  return changes
}

describe('radialR', () => {
  it('R_10(0) = 2 Z^(3/2)', () => {
    expect(radialR(1, 0, 1, 0)).toBeCloseTo(2, 12)
    expect(radialR(1, 0, 3, 0)).toBeCloseTo(2 * Math.pow(3, 1.5), 10)
  })
  it('R_21 matches Griffiths Table 4.7: (1/(2 sqrt6)) Z^(3/2) (Z r) e^{-Zr/2}', () => {
    const Z = 2, r = 1.3
    const expected = (1 / (2 * Math.sqrt(6))) * Math.pow(Z, 1.5) * (Z * r) * Math.exp(-Z * r / 2)
    expect(radialR(2, 1, Z, r)).toBeCloseTo(expected, 12)
  })
  it('integral r^2 R^2 dr = 1 for all n<=7, l<n, Z in {1, 2.2, 6.25}', () => {
    for (const Z of [1, 2.2, 6.25]) {
      for (let n = 1; n <= 7; n++) {
        for (let l = 0; l < n; l++) {
          const rMax = (40 * n * n) / Z
          const I = simpson((r) => r * r * radialR(n, l, Z, r) ** 2, 0, rMax, 4000)
          expect(Math.abs(I - 1), `n=${n} l=${l} Z=${Z}`).toBeLessThan(1e-3)
        }
      }
    }
  })
  it('has n-l-1 radial nodes', () => {
    for (let n = 1; n <= 7; n++) {
      for (let l = 0; l < n; l++) {
        const rMax = (8 * n * n) / 1
        expect(countSignChanges((r) => radialR(n, l, 1, r), 0, rMax, 20000), `n=${n} l=${l}`).toBe(n - l - 1)
      }
    }
  })
})
```

```ts
// src/physics/__tests__/harmonics.test.ts
import { describe, it, expect } from 'vitest'
import { realY, complexY } from '../harmonics'
import { simpson } from '../quadrature'

/** Integral over the unit sphere of f(cosTheta, phi). */
function sphereIntegral(f: (ct: number, phi: number) => number): number {
  return simpson((ct) => simpson((phi) => f(ct, phi), 0, 2 * Math.PI, 400), -1, 1, 400)
}

describe('realY', () => {
  it('is normalized on the sphere for all l<=6, |m|<=l', () => {
    for (let l = 0; l <= 6; l++) {
      for (let m = -l; m <= l; m++) {
        const I = sphereIntegral((ct, phi) => realY(l, m, ct, phi) ** 2)
        expect(Math.abs(I - 1), `l=${l} m=${m}`).toBeLessThan(1e-3)
      }
    }
  })
  it('pairs are orthogonal', () => {
    const pairs: [number, number, number, number][] = [[1, 0, 1, 1], [2, 2, 2, -2], [2, 0, 0, 0], [3, 1, 1, 1]]
    for (const [l1, m1, l2, m2] of pairs) {
      const I = sphereIntegral((ct, phi) => realY(l1, m1, ct, phi) * realY(l2, m2, ct, phi))
      expect(Math.abs(I)).toBeLessThan(1e-3)
    }
  })
  it('uses the standard real-orbital naming: m=+1 is x-type, m=-1 is y-type, m=0 is z-type', () => {
    // p orbitals: value along +x, +y, +z axes
    expect(realY(1, 1, 0, 0)).toBeGreaterThan(0)            // px at (1,0,0)
    expect(realY(1, -1, 0, Math.PI / 2)).toBeGreaterThan(0) // py at (0,1,0)
    expect(realY(1, 0, 1, 0)).toBeGreaterThan(0)            // pz at (0,0,1)
    expect(realY(1, 1, 0, Math.PI / 2)).toBeCloseTo(0, 12)  // px vanishes on y axis
    // Y_00 = 1/sqrt(4 pi)
    expect(realY(0, 0, 0.3, 1.1)).toBeCloseTo(1 / Math.sqrt(4 * Math.PI), 12)
  })
  it('has l - |m| nodes in theta and |m| nodal planes in phi', () => {
    for (let l = 0; l <= 4; l++) {
      for (let m = -l; m <= l; m++) {
        const phi0 = 0.123
        let thetaChanges = 0
        let prev = realY(l, m, Math.cos(0.001), phi0)
        for (let i = 2; i < 2000; i++) {
          const v = realY(l, m, Math.cos((Math.PI * i) / 2000), phi0)
          if (v * prev < 0) thetaChanges++
          if (v !== 0) prev = v
        }
        expect(thetaChanges, `theta l=${l} m=${m}`).toBe(l - Math.abs(m))
        let phiChanges = 0
        const ct0 = 0.37
        prev = realY(l, m, ct0, 0.001)
        for (let i = 2; i < 2000; i++) {
          const v = realY(l, m, ct0, (2 * Math.PI * i) / 2000)
          if (v * prev < 0) phiChanges++
          if (v !== 0) prev = v
        }
        expect(phiChanges, `phi l=${l} m=${m}`).toBe(2 * Math.abs(m))
      }
    }
  })
})

describe('complexY', () => {
  it('|Y|^2 is normalized and independent of phi', () => {
    const I = sphereIntegral((ct, phi) => { const y = complexY(2, 1, ct, phi); return y.re ** 2 + y.im ** 2 })
    expect(Math.abs(I - 1)).toBeLessThan(1e-3)
    const a = complexY(3, 2, 0.4, 0.2), b = complexY(3, 2, 0.4, 2.9)
    expect(a.re ** 2 + a.im ** 2).toBeCloseTo(b.re ** 2 + b.im ** 2, 12)
  })
})
```

- [ ] **Step 2: Run, expect FAIL (modules missing).**

- [ ] **Step 3: Implement**

```ts
// src/physics/quadrature.ts
/** Composite Simpson's rule on [a,b] with n (even) intervals. Numerical Recipes 4.1.4. */
export function simpson(f: (x: number) => number, a: number, b: number, n: number): number {
  if (n % 2 !== 0) n++
  const h = (b - a) / n
  let s = f(a) + f(b)
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 === 0 ? 2 : 4)
  return (s * h) / 3
}
```

```ts
// src/physics/radial.ts
import { factorial } from './factorial'
import { laguerre } from './laguerre'

/**
 * Hydrogen-like radial function in atomic units (a0 = 1), Griffiths QM 2nd ed. eq. 4.89:
 *   R_nl(r) = sqrt( (2Z/n)^3 (n-l-1)! / (2n (n+l)!) ) e^{-rho/2} rho^l L^{2l+1}_{n-l-1}(rho),
 *   rho = 2 Z r / n,
 * with the Laguerre convention of Abramowitz & Stegun (leading coefficient (-1)^k/k!),
 * which is what laguerre() implements. Normalized so that integral r^2 R^2 dr = 1.
 */
export function radialNorm(n: number, l: number, Z: number): number {
  return Math.sqrt(Math.pow((2 * Z) / n, 3) * factorial(n - l - 1) / (2 * n * factorial(n + l)))
}

export function radialR(n: number, l: number, Z: number, r: number): number {
  const rho = (2 * Z * r) / n
  return radialNorm(n, l, Z) * Math.exp(-rho / 2) * Math.pow(rho, l) * laguerre(n - l - 1, 2 * l + 1, rho)
}
```

```ts
// src/physics/harmonics.ts
import { factorial } from './factorial'
import { legendreP } from './legendre'

/** N_lm = sqrt( (2l+1)/(4 pi) (l-|m|)! / (l+|m|)! ), Griffiths eq. 4.32. */
export function angularNorm(l: number, m: number): number {
  const am = Math.abs(m)
  return Math.sqrt(((2 * l + 1) / (4 * Math.PI)) * factorial(l - am) / factorial(l + am))
}

/**
 * Real spherical harmonics (tesseral harmonics), Blanco, Florez & Bermejo,
 * J. Mol. Struct. THEOCHEM 419 (1997) 19, eq. 3, written without the
 * Condon-Shortley phase so px, py, pz are positive along +x, +y, +z:
 *   m > 0:  sqrt2 N_lm P_l^m(cos t) cos(m phi)   (x-type)
 *   m = 0:        N_l0 P_l^0(cos t)
 *   m < 0:  sqrt2 N_l|m| P_l^|m|(cos t) sin(|m| phi)   (y-type)
 */
export function realY(l: number, m: number, cosTheta: number, phi: number): number {
  const am = Math.abs(m)
  const base = angularNorm(l, m) * legendreP(l, am, cosTheta)
  if (m === 0) return base
  const SQRT2 = Math.SQRT2
  return m > 0 ? SQRT2 * base * Math.cos(am * phi) : SQRT2 * base * Math.sin(am * phi)
}

/** Complex Y_lm = N_lm P_l^|m|(cos t) e^{i m phi} (Condon-Shortley phase omitted; |Y|^2 is unaffected). */
export function complexY(l: number, m: number, cosTheta: number, phi: number): { re: number; im: number } {
  const base = angularNorm(l, m) * legendreP(l, Math.abs(m), cosTheta)
  return { re: base * Math.cos(m * phi), im: base * Math.sin(m * phi) }
}
```

- [ ] **Step 4: Run tests, expect PASS. tsc clean.**
- [ ] **Step 5: Commit** `git commit -am "Add hydrogenic radial functions and spherical harmonics"`

### Task 3: Wavefunction, orbital types, extent

**Files:**
- Create: `src/physics/orbital.ts`, `src/physics/wavefunction.ts`, `src/physics/extent.ts`
- Test: `src/physics/__tests__/wavefunction.test.ts`

**Interfaces:**
- Produces:
  - `interface Orbital { n: number; l: number; m: number; Z: number; real: boolean }`
  - `isValidOrbital(o: {n,l,m}): boolean` (1<=n<=7, 0<=l<n, |m|<=l), `clampOrbital(n,l,m): {n,l,m}`
  - `SUBSHELL_LETTERS = 'spdfghi'`, `orbitalLabel(o): string` e.g. `3d(z²)`, `2p(x)`; `subshellLabel(n,l)` e.g. `3d`
  - `realOrbitalName(l,m): string` ('s', 'px', 'py', 'pz', 'dz2', 'dxz', 'dyz', 'dx2-y2', 'dxy', f: 'fz3', 'fxz2', 'fyz2', 'fz(x2-y2)', 'fxyz', 'fx(x2-3y2)', 'fy(3x2-y2)', else `l=${l},m=${m}`)
  - `psi(o: Orbital, x: number, y: number, z: number): number` (real part for real orbitals; for complex returns Re)
  - `psiSpherical(o, r, cosTheta, phi): number`
  - `density(o, x, y, z): number` (= psi² for real; |Y|²R² for complex)
  - `orbitalExtent(o: Orbital): number` (r_max with >99.5% enclosure)
  - `radialCdfEnclosed(n,l,Z,rMax): number`

- [ ] **Step 1: Write failing tests**

```ts
// src/physics/__tests__/wavefunction.test.ts
import { describe, it, expect } from 'vitest'
import { density, psi } from '../wavefunction'
import { orbitalExtent, radialCdfEnclosed } from '../extent'
import { clampOrbital, isValidOrbital, realOrbitalName, orbitalLabel } from '../orbital'
import { simpson } from '../quadrature'

describe('psi', () => {
  it('|psi|^2 integrates to 1 over space (1s, 2pz, 3dxy, 4fz3)', () => {
    const cases = [
      { n: 1, l: 0, m: 0 }, { n: 2, l: 1, m: 0 }, { n: 3, l: 2, m: -2 }, { n: 4, l: 3, m: 0 },
    ]
    for (const c of cases) {
      const o = { ...c, Z: 1.5, real: true }
      const rMax = orbitalExtent(o) * 1.6
      const I = simpson((r) => r * r * simpson((ct) => simpson((phi) => {
        const st = Math.sqrt(1 - ct * ct)
        return density(o, r * st * Math.cos(phi), r * st * Math.sin(phi), r * ct)
      }, 0, 2 * Math.PI, 48), -1, 1, 48), 0, rMax, 400)
      expect(Math.abs(I - 1), JSON.stringify(c)).toBeLessThan(2e-3)
    }
  })
  it('2pz is antisymmetric in z', () => {
    const o = { n: 2, l: 1, m: 0, Z: 1, real: true }
    expect(psi(o, 0.3, 0.2, 1.1)).toBeCloseTo(-psi(o, 0.3, 0.2, -1.1), 12)
  })
})

describe('extent', () => {
  it('encloses at least 99.5% probability', () => {
    for (const o of [{ n: 1, l: 0, m: 0, Z: 1, real: true }, { n: 4, l: 2, m: 0, Z: 3.75, real: true }, { n: 7, l: 0, m: 0, Z: 1, real: true }]) {
      const r = orbitalExtent(o)
      expect(radialCdfEnclosed(o.n, o.l, o.Z, r)).toBeGreaterThan(0.995)
      expect(radialCdfEnclosed(o.n, o.l, o.Z, r / 1.25)).toBeLessThan(0.9995)
    }
  })
})

describe('orbital helpers', () => {
  it('validates and clamps', () => {
    expect(isValidOrbital({ n: 3, l: 2, m: -2 })).toBe(true)
    expect(isValidOrbital({ n: 3, l: 3, m: 0 })).toBe(false)
    expect(isValidOrbital({ n: 8, l: 0, m: 0 })).toBe(false)
    expect(clampOrbital(9, 5, 9)).toEqual({ n: 7, l: 5, m: 5 })
    expect(clampOrbital(2, 3, -4)).toEqual({ n: 2, l: 1, m: -1 })
    expect(clampOrbital(NaN, NaN, NaN)).toEqual({ n: 1, l: 0, m: 0 })
  })
  it('names real orbitals', () => {
    expect(realOrbitalName(1, 1)).toBe('px')
    expect(realOrbitalName(2, 0)).toBe('dz2')
    expect(realOrbitalName(2, 2)).toBe('dx2-y2')
    expect(orbitalLabel({ n: 3, l: 2, m: -2, Z: 1, real: true })).toBe('3dxy')
  })
})
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/physics/orbital.ts
export interface Orbital { n: number; l: number; m: number; Z: number; real: boolean }
export const MAX_N = 7
export const SUBSHELL_LETTERS = 'spdfghi'

export function isValidOrbital(o: { n: number; l: number; m: number }): boolean {
  return Number.isInteger(o.n) && Number.isInteger(o.l) && Number.isInteger(o.m)
    && o.n >= 1 && o.n <= MAX_N && o.l >= 0 && o.l < o.n && Math.abs(o.m) <= o.l
}

export function clampOrbital(n: number, l: number, m: number): { n: number; l: number; m: number } {
  const cn = Number.isFinite(n) ? Math.min(MAX_N, Math.max(1, Math.round(n))) : 1
  const cl = Number.isFinite(l) ? Math.min(cn - 1, Math.max(0, Math.round(l))) : 0
  const cm = Number.isFinite(m) ? Math.min(cl, Math.max(-cl, Math.round(m))) : 0
  return { n: cn, l: cl, m: cm }
}

const REAL_NAMES: Record<number, Record<number, string>> = {
  0: { 0: 's' },
  1: { 0: 'pz', 1: 'px', [-1]: 'py' },
  2: { 0: 'dz2', 1: 'dxz', [-1]: 'dyz', 2: 'dx2-y2', [-2]: 'dxy' },
  3: { 0: 'fz3', 1: 'fxz2', [-1]: 'fyz2', 2: 'fz(x2-y2)', [-2]: 'fxyz', 3: 'fx(x2-3y2)', [-3]: 'fy(3x2-y2)' },
}
export function realOrbitalName(l: number, m: number): string {
  return REAL_NAMES[l]?.[m] ?? `${SUBSHELL_LETTERS[l] ?? `l${l}`}(m=${m})`
}
export function subshellLabel(n: number, l: number): string { return `${n}${SUBSHELL_LETTERS[l] ?? `l${l}`}` }
export function orbitalLabel(o: { n: number; l: number; m: number; real?: boolean }): string {
  if (o.real === false) return `${subshellLabel(o.n, o.l)} m=${o.m}`
  return `${o.n}${realOrbitalName(o.l, o.m)}`
}
```

```ts
// src/physics/wavefunction.ts
import type { Orbital } from './orbital'
import { radialR } from './radial'
import { realY, complexY, angularNorm } from './harmonics'
import { legendreP } from './legendre'

/** psi_nlm = R_nl(r) Y_lm(theta, phi); Griffiths eq. 4.89. Real mode uses tesseral Y. */
export function psiSpherical(o: Orbital, r: number, cosTheta: number, phi: number): number {
  const R = radialR(o.n, o.l, o.Z, r)
  return o.real ? R * realY(o.l, o.m, cosTheta, phi) : R * complexY(o.l, o.m, cosTheta, phi).re
}

export function toSpherical(x: number, y: number, z: number): { r: number; cosTheta: number; phi: number } {
  const r = Math.hypot(x, y, z)
  return { r, cosTheta: r === 0 ? 1 : z / r, phi: Math.atan2(y, x) }
}

export function psi(o: Orbital, x: number, y: number, z: number): number {
  const s = toSpherical(x, y, z)
  return psiSpherical(o, s.r, s.cosTheta, s.phi)
}

/** |psi|^2. For complex orbitals this is R^2 |N P_l^|m||^2 (phi-independent). */
export function density(o: Orbital, x: number, y: number, z: number): number {
  const s = toSpherical(x, y, z)
  const R = radialR(o.n, o.l, o.Z, s.r)
  if (o.real) { const y = realY(o.l, o.m, s.cosTheta, s.phi); return R * R * y * y }
  const a = angularNorm(o.l, o.m) * legendreP(o.l, Math.abs(o.m), s.cosTheta)
  return R * R * a * a
}

/** Phase angle of a complex orbital at a point, in radians; 0 or pi for real orbitals. */
export function phase(o: Orbital, x: number, y: number, z: number): number {
  const s = toSpherical(x, y, z)
  if (o.real) return psiSpherical(o, s.r, s.cosTheta, s.phi) >= 0 ? 0 : Math.PI
  const R = radialR(o.n, o.l, o.Z, s.r) * angularNorm(o.l, o.m) * legendreP(o.l, Math.abs(o.m), s.cosTheta)
  let ph = o.m * s.phi + (R < 0 ? Math.PI : 0)
  ph = ph % (2 * Math.PI); if (ph < 0) ph += 2 * Math.PI
  return ph
}
```

```ts
// src/physics/extent.ts
import type { Orbital } from './orbital'
import { radialR } from './radial'
import { simpson } from './quadrature'

/** Probability enclosed inside radius rMax: integral_0^rMax r^2 R_nl^2 dr. */
export function radialCdfEnclosed(n: number, l: number, Z: number, rMax: number): number {
  return simpson((r) => r * r * radialR(n, l, Z, r) ** 2, 0, rMax, 2000)
}

/**
 * Box half-size for sampling/gridding: start at 2.5 n^2 / Z (about 1.7x the
 * hydrogenic mean radius <r> = (3n^2 - l(l+1)) / (2Z), Griffiths problem 4.13)
 * and grow by 25% until >99.5% of the radial probability is enclosed.
 */
export function orbitalExtent(o: Orbital): number {
  let r = (2.5 * o.n * o.n) / o.Z
  for (let i = 0; i < 40 && radialCdfEnclosed(o.n, o.l, o.Z, r) < 0.995; i++) r *= 1.25
  return r
}
```

- [ ] **Step 4: Run tests, expect PASS. tsc clean.**
- [ ] **Step 5: Commit** `git commit -am "Add wavefunction, orbital helpers and extent"`

### Task 4: Element table

**Files:**
- Create: `src/physics/elements.ts`
- Test: `src/physics/__tests__/elements.test.ts`

**Interfaces:**
- Produces: `interface Element { Z: number; symbol: string; name: string; group: number; period: number; block: 's'|'p'|'d'|'f'; cpk: string }`, `ELEMENTS: readonly Element[]` (index Z-1, Z=1..36), `elementByZ(Z): Element | undefined`, `MAX_Z = 36`.

- [ ] **Step 1: Failing test**

```ts
// src/physics/__tests__/elements.test.ts
import { describe, it, expect } from 'vitest'
import { ELEMENTS, elementByZ, MAX_Z } from '../elements'

describe('elements', () => {
  it('has Z=1..36 in order with unique symbols', () => {
    expect(ELEMENTS.length).toBe(MAX_Z)
    ELEMENTS.forEach((e, i) => expect(e.Z).toBe(i + 1))
    expect(new Set(ELEMENTS.map((e) => e.symbol)).size).toBe(MAX_Z)
  })
  it('spot checks', () => {
    expect(elementByZ(26)).toMatchObject({ symbol: 'Fe', name: 'Iron', group: 8, period: 4, block: 'd' })
    expect(elementByZ(10)).toMatchObject({ symbol: 'Ne', group: 18, period: 2, block: 'p' })
    expect(elementByZ(2)).toMatchObject({ symbol: 'He', group: 18, period: 1, block: 's' })
    expect(elementByZ(37)).toBeUndefined()
    for (const e of ELEMENTS) expect(e.cpk).toMatch(/^#[0-9a-f]{6}$/i)
  })
})
```

- [ ] **Step 2: Run, FAIL.**
- [ ] **Step 3: Implement** a hand-typed table. Groups: He 18; Li-Ne 1,2,13..18; Na-Ar same; K-Kr 1..18. Blocks: s for groups 1-2 and He, d for 3-12, p for 13-18. CPK colors are the standard Jmol/CPK hex values (facts, e.g. H #ffffff, C #909090, N #3050f8, O #ff0d0d, Fe #e06633, Cu #c88033).

```ts
// src/physics/elements.ts
export interface Element { Z: number; symbol: string; name: string; group: number; period: number; block: 's' | 'p' | 'd' | 'f'; cpk: string }
export const MAX_Z = 36
// [symbol, name, group, period, block, cpk]. CPK colors: standard Jmol element colors.
const RAW: [string, string, number, number, Element['block'], string][] = [
  ['H', 'Hydrogen', 1, 1, 's', '#ffffff'], ['He', 'Helium', 18, 1, 's', '#d9ffff'],
  ['Li', 'Lithium', 1, 2, 's', '#cc80ff'], ['Be', 'Beryllium', 2, 2, 's', '#c2ff00'],
  ['B', 'Boron', 13, 2, 'p', '#ffb5b5'], ['C', 'Carbon', 14, 2, 'p', '#909090'],
  ['N', 'Nitrogen', 15, 2, 'p', '#3050f8'], ['O', 'Oxygen', 16, 2, 'p', '#ff0d0d'],
  ['F', 'Fluorine', 17, 2, 'p', '#90e050'], ['Ne', 'Neon', 18, 2, 'p', '#b3e3f5'],
  ['Na', 'Sodium', 1, 3, 's', '#ab5cf2'], ['Mg', 'Magnesium', 2, 3, 's', '#8aff00'],
  ['Al', 'Aluminium', 13, 3, 'p', '#bfa6a6'], ['Si', 'Silicon', 14, 3, 'p', '#f0c8a0'],
  ['P', 'Phosphorus', 15, 3, 'p', '#ff8000'], ['S', 'Sulfur', 16, 3, 'p', '#ffff30'],
  ['Cl', 'Chlorine', 17, 3, 'p', '#1ff01f'], ['Ar', 'Argon', 18, 3, 'p', '#80d1e3'],
  ['K', 'Potassium', 1, 4, 's', '#8f40d4'], ['Ca', 'Calcium', 2, 4, 's', '#3dff00'],
  ['Sc', 'Scandium', 3, 4, 'd', '#e6e6e6'], ['Ti', 'Titanium', 4, 4, 'd', '#bfc2c7'],
  ['V', 'Vanadium', 5, 4, 'd', '#a6a6ab'], ['Cr', 'Chromium', 6, 4, 'd', '#8a99c7'],
  ['Mn', 'Manganese', 7, 4, 'd', '#9c7ac7'], ['Fe', 'Iron', 8, 4, 'd', '#e06633'],
  ['Co', 'Cobalt', 9, 4, 'd', '#f090a0'], ['Ni', 'Nickel', 10, 4, 'd', '#50d050'],
  ['Cu', 'Copper', 11, 4, 'd', '#c88033'], ['Zn', 'Zinc', 12, 4, 'd', '#7d80b0'],
  ['Ga', 'Gallium', 13, 4, 'p', '#c28f8f'], ['Ge', 'Germanium', 14, 4, 'p', '#668f8f'],
  ['As', 'Arsenic', 15, 4, 'p', '#bd80e3'], ['Se', 'Selenium', 16, 4, 'p', '#ffa100'],
  ['Br', 'Bromine', 17, 4, 'p', '#a62929'], ['Kr', 'Krypton', 18, 4, 'p', '#5cb8d1'],
]
export const ELEMENTS: readonly Element[] = RAW.map(([symbol, name, group, period, block, cpk], i) => ({ Z: i + 1, symbol, name, group, period, block, cpk }))
export function elementByZ(Z: number): Element | undefined { return ELEMENTS[Z - 1] }
```

- [ ] **Step 4: PASS, tsc clean.**
- [ ] **Step 5: Commit** `git commit -am "Add typed element table Z=1..36"`

### Task 5: Electron configurations and Slater's rules

**Files:**
- Create: `src/physics/configuration.ts`, `src/physics/slater.ts`
- Test: `src/physics/__tests__/configuration.test.ts`, `src/physics/__tests__/slater.test.ts`

**Interfaces:**
- Produces:
  - `interface Subshell { n: number; l: number; electrons: number }`
  - `groundStateConfiguration(Z: number): Subshell[]` in Madelung fill order (nonzero only)
  - `configurationString(cfg: Subshell[]): string` e.g. `"1s2 2s2 2p6 3s2 3p6 4s2 3d6"`
  - `shellCounts(cfg): number[]` index n-1 (e.g. Fe -> [2, 8, 14, 2])
  - `isValenceSubshell(cfg, s: Subshell): boolean`
  - `occupiedOrbitals(s: Subshell): { m: number; electrons: number }[]` Hund filling in m order 0, +1, -1, +2, -2, +3, -3
  - `slaterZeff(cfg: Subshell[], n: number, l: number): number`
  - `slaterShielding(cfg, n, l): number`

- [ ] **Step 1: Failing tests**

```ts
// src/physics/__tests__/configuration.test.ts
import { describe, it, expect } from 'vitest'
import { groundStateConfiguration, configurationString, shellCounts, isValenceSubshell, occupiedOrbitals } from '../configuration'

const EXPECTED: Record<number, string> = {
  1: '1s1', 2: '1s2', 3: '1s2 2s1', 4: '1s2 2s2', 5: '1s2 2s2 2p1', 6: '1s2 2s2 2p2', 7: '1s2 2s2 2p3',
  8: '1s2 2s2 2p4', 9: '1s2 2s2 2p5', 10: '1s2 2s2 2p6',
  11: '1s2 2s2 2p6 3s1', 12: '1s2 2s2 2p6 3s2', 13: '1s2 2s2 2p6 3s2 3p1', 14: '1s2 2s2 2p6 3s2 3p2',
  15: '1s2 2s2 2p6 3s2 3p3', 16: '1s2 2s2 2p6 3s2 3p4', 17: '1s2 2s2 2p6 3s2 3p5', 18: '1s2 2s2 2p6 3s2 3p6',
  19: '1s2 2s2 2p6 3s2 3p6 4s1', 20: '1s2 2s2 2p6 3s2 3p6 4s2',
  21: '1s2 2s2 2p6 3s2 3p6 4s2 3d1', 22: '1s2 2s2 2p6 3s2 3p6 4s2 3d2', 23: '1s2 2s2 2p6 3s2 3p6 4s2 3d3',
  24: '1s2 2s2 2p6 3s2 3p6 4s1 3d5', 25: '1s2 2s2 2p6 3s2 3p6 4s2 3d5', 26: '1s2 2s2 2p6 3s2 3p6 4s2 3d6',
  27: '1s2 2s2 2p6 3s2 3p6 4s2 3d7', 28: '1s2 2s2 2p6 3s2 3p6 4s2 3d8', 29: '1s2 2s2 2p6 3s2 3p6 4s1 3d10',
  30: '1s2 2s2 2p6 3s2 3p6 4s2 3d10', 31: '1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p1', 32: '1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p2',
  33: '1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p3', 34: '1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p4', 35: '1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p5',
  36: '1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p6',
}

describe('groundStateConfiguration', () => {
  it('matches the expected list for Z=1..36', () => {
    for (let Z = 1; Z <= 36; Z++) expect(configurationString(groundStateConfiguration(Z)), `Z=${Z}`).toBe(EXPECTED[Z])
  })
  it('electron totals equal Z', () => {
    for (let Z = 1; Z <= 36; Z++) expect(groundStateConfiguration(Z).reduce((s, x) => s + x.electrons, 0)).toBe(Z)
  })
  it('shell counts', () => {
    expect(shellCounts(groundStateConfiguration(26))).toEqual([2, 8, 14, 2])
    expect(shellCounts(groundStateConfiguration(36))).toEqual([2, 8, 18, 8])
  })
  it('valence subshells', () => {
    const fe = groundStateConfiguration(26)
    expect(fe.filter((s) => isValenceSubshell(fe, s)).map((s) => `${s.n}${'spdf'[s.l]}`)).toEqual(['4s', '3d'])
    const kr = groundStateConfiguration(36)
    expect(kr.filter((s) => isValenceSubshell(kr, s)).map((s) => `${s.n}${'spdf'[s.l]}`)).toEqual(['4s', '4p'])
    const na = groundStateConfiguration(11)
    expect(na.filter((s) => isValenceSubshell(na, s)).map((s) => `${s.n}${'spdf'[s.l]}`)).toEqual(['3s'])
  })
  it('fills orbitals Hund-style', () => {
    expect(occupiedOrbitals({ n: 2, l: 1, electrons: 2 })).toEqual([{ m: 0, electrons: 1 }, { m: 1, electrons: 1 }])
    expect(occupiedOrbitals({ n: 2, l: 1, electrons: 4 })).toEqual([{ m: 0, electrons: 2 }, { m: 1, electrons: 1 }, { m: -1, electrons: 1 }])
    expect(occupiedOrbitals({ n: 3, l: 2, electrons: 10 }).length).toBe(5)
  })
})
```

```ts
// src/physics/__tests__/slater.test.ts
import { describe, it, expect } from 'vitest'
import { groundStateConfiguration } from '../configuration'
import { slaterZeff } from '../slater'

describe('slaterZeff', () => {
  // Reference values: Slater, Phys. Rev. 36, 57 (1930); standard textbook worked examples.
  it('matches known values', () => {
    expect(slaterZeff(groundStateConfiguration(1), 1, 0)).toBeCloseTo(1, 10)
    expect(slaterZeff(groundStateConfiguration(2), 1, 0)).toBeCloseTo(1.70, 10)
    expect(slaterZeff(groundStateConfiguration(6), 2, 1)).toBeCloseTo(3.25, 10)
    expect(slaterZeff(groundStateConfiguration(11), 3, 0)).toBeCloseTo(2.20, 10)
    expect(slaterZeff(groundStateConfiguration(26), 3, 2)).toBeCloseTo(6.25, 10)
    expect(slaterZeff(groundStateConfiguration(26), 4, 0)).toBeCloseTo(3.75, 10)
    expect(slaterZeff(groundStateConfiguration(30), 4, 0)).toBeCloseTo(4.35, 10)
  })
  it('is at least 1 for every occupied subshell of Z=1..36', () => {
    for (let Z = 1; Z <= 36; Z++) for (const s of groundStateConfiguration(Z)) expect(slaterZeff(groundStateConfiguration(Z), s.n, s.l)).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 2: Run, FAIL.**
- [ ] **Step 3: Implement**

```ts
// src/physics/configuration.ts
import { SUBSHELL_LETTERS } from './orbital'

export interface Subshell { n: number; l: number; electrons: number }

/** Madelung (n+l, then n) order. Any textbook, e.g. Atkins Physical Chemistry, aufbau principle. */
export const MADELUNG_ORDER: readonly { n: number; l: number }[] = (() => {
  const out: { n: number; l: number }[] = []
  for (let n = 1; n <= 8; n++) for (let l = 0; l < n; l++) out.push({ n, l })
  return out.sort((a, b) => (a.n + a.l) - (b.n + b.l) || a.n - b.n)
})()

/** Elements whose ground state breaks the Madelung rule (NIST Atomic Spectra Database ground levels). */
const EXCEPTIONS: Record<number, [number, number, number][]> = {
  24: [[4, 0, 1], [3, 2, 5]], 29: [[4, 0, 1], [3, 2, 10]],
  41: [[5, 0, 1], [4, 2, 4]], 42: [[5, 0, 1], [4, 2, 5]], 44: [[5, 0, 1], [4, 2, 7]], 45: [[5, 0, 1], [4, 2, 8]],
  46: [[5, 0, 0], [4, 2, 10]], 47: [[5, 0, 1], [4, 2, 10]], 78: [[6, 0, 1], [5, 2, 9]], 79: [[6, 0, 1], [5, 2, 10]],
}

export function groundStateConfiguration(Z: number): Subshell[] {
  const cfg: Subshell[] = []
  let left = Z
  for (const { n, l } of MADELUNG_ORDER) {
    if (left <= 0) break
    const take = Math.min(left, 2 * (2 * l + 1))
    cfg.push({ n, l, electrons: take })
    left -= take
  }
  for (const [n, l, e] of EXCEPTIONS[Z] ?? []) {
    const s = cfg.find((x) => x.n === n && x.l === l)
    if (s) s.electrons = e; else cfg.push({ n, l, electrons: e })
  }
  return cfg.filter((s) => s.electrons > 0)
}

export function configurationString(cfg: Subshell[]): string {
  return cfg.map((s) => `${s.n}${SUBSHELL_LETTERS[s.l]}${s.electrons}`).join(' ')
}

export function shellCounts(cfg: Subshell[]): number[] {
  const out: number[] = []
  for (const s of cfg) out[s.n - 1] = (out[s.n - 1] ?? 0) + s.electrons
  for (let i = 0; i < out.length; i++) out[i] ??= 0
  return out
}

/** Valence: highest-n subshells plus a partially filled (n-1)d subshell. */
export function isValenceSubshell(cfg: Subshell[], s: Subshell): boolean {
  const nMax = Math.max(...cfg.map((x) => x.n))
  if (s.n === nMax) return true
  return s.l === 2 && s.n === nMax - 1 && s.electrons < 10
}

/** Hund's rule filling across real orbitals in the order m = 0, +1, -1, +2, -2, ... */
export function occupiedOrbitals(s: Subshell): { m: number; electrons: number }[] {
  const ms: number[] = [0]
  for (let m = 1; m <= s.l; m++) ms.push(m, -m)
  const occ = ms.map((m) => ({ m, electrons: 0 }))
  for (let e = 0; e < s.electrons; e++) occ[e % ms.length].electrons++
  return occ.filter((o) => o.electrons > 0)
}
```

```ts
// src/physics/slater.ts
import type { Subshell } from './configuration'

/**
 * Slater's rules, J. C. Slater, Phys. Rev. 36, 57 (1930), as summarized in
 * most inorganic chemistry texts. Groups in order:
 * [1s] [2s2p] [3s3p] [3d] [4s4p] [4d] [4f] [5s5p] [5d] [5f] [6s6p] ...
 * For an electron in an [ns np] group: others in the same group 0.35 (0.30 for 1s),
 * electrons with principal quantum number n-1: 0.85, n-2 or less: 1.00.
 * For [nd] or [nf]: same group 0.35, everything in groups to the left 1.00.
 * Groups to the right contribute 0.
 */
function groupKey(n: number, l: number): number {
  // Sortable position of the group: s/p share a group; d and f are separate.
  // Order value: (n, l>=2 ? l : 0) sorted by n+l rule? No: Slater's order is literal:
  // 1s, 2sp, 3sp, 3d, 4sp, 4d, 4f, 5sp, 5d, 5f, 6sp ...  => sort by (n, min(l,2)) with d/f after sp of same n.
  return n * 10 + (l <= 1 ? 0 : l)
}

export function slaterShielding(cfg: Subshell[], n: number, l: number): number {
  const key = groupKey(n, l)
  let S = 0
  for (const s of cfg) {
    const k = groupKey(s.n, s.l)
    let count = s.electrons
    if (k === key) {
      if (s.n === n && s.l === l) count -= 1 // the electron itself
      S += count * (n === 1 ? 0.30 : 0.35)
    } else if (k < key) {
      if (l <= 1) S += count * (s.n === n - 1 ? 0.85 : s.n <= n - 2 ? 1.0 : 0.85)
      else S += count * 1.0
    }
  }
  return S
}

export function slaterZeff(cfg: Subshell[], n: number, l: number): number {
  const Z = cfg.reduce((a, s) => a + s.electrons, 0)
  return Math.max(1, Z - slaterShielding(cfg, n, l))
}
```

Note on the `l <= 1` branch: for an ns/np electron, electrons in a group to the left with the same n can only be... none (sp is the first group of its n), so the remaining cases are n-1 (0.85) and <= n-2 (1.0). The fallback 0.85 handles (n-1)d, which is to the left of nsp in the ordering. Zn 4s: S = 1·0.35 + (8+10)·0.85 + 10·1.0 = 25.65, Zeff 4.35.

- [ ] **Step 4: PASS, tsc clean.**
- [ ] **Step 5: Commit** `git commit -am "Add electron configurations (Madelung + exceptions) and Slater Zeff"`

### Task 6: Inverse-CDF point sampler and colormaps

**Files:**
- Create: `src/physics/rng.ts`, `src/physics/sampling.ts`, `src/physics/colormaps.ts` (generated), `scripts/gen-colormaps.mjs`
- Test: `src/physics/__tests__/sampling.test.ts`, `src/physics/__tests__/colormaps.test.ts`

**Interfaces:**
- Produces:
  - `mulberry32(seed: number): () => number`
  - `interface SampleResult { positions: Float32Array; psi: Float32Array; maxDensity: number; rMax: number }`
  - `sampleOrbital(o: Orbital, count: number, seed: number): SampleResult`
  - `buildInverseCdf(f: (x: number) => number, a: number, b: number, size: number): { x: Float32Array; cdf: Float32Array }` and `sampleInverseCdf(table, u: number): number`
  - `COLORMAPS: Record<'inferno'|'magma'|'viridis', Float32Array>` (256*3, 0..1), `colormapLookup(map, t: number, out: Float32Array, offset: number)`

- [ ] **Step 1: Failing tests**

```ts
// src/physics/__tests__/sampling.test.ts
import { describe, it, expect } from 'vitest'
import { sampleOrbital } from '../sampling'

describe('sampleOrbital', () => {
  it('1s: mean r = 1.5/Z within 1%', () => {
    const Z = 2
    const { positions } = sampleOrbital({ n: 1, l: 0, m: 0, Z, real: true }, 200000, 1)
    let sum = 0
    for (let i = 0; i < positions.length; i += 3) sum += Math.hypot(positions[i], positions[i + 1], positions[i + 2])
    expect(sum / (positions.length / 3)).toBeCloseTo(1.5 / Z, 1)
    expect(Math.abs(sum / (positions.length / 3) - 1.5 / Z) / (1.5 / Z)).toBeLessThan(0.01)
  })
  it('2pz: symmetric about z=0, almost nothing in the nodal plane, psi sign matches z', () => {
    const { positions, psi } = sampleOrbital({ n: 2, l: 1, m: 0, Z: 1, real: true }, 100000, 7)
    let up = 0, near = 0, signOk = 0
    const N = positions.length / 3
    for (let i = 0; i < N; i++) {
      const z = positions[3 * i + 2]
      if (z > 0) up++
      if (Math.abs(z) < 0.05 * Math.hypot(positions[3 * i], positions[3 * i + 1], z)) near++
      if ((z > 0) === (psi[i] > 0)) signOk++
    }
    expect(Math.abs(up / N - 0.5)).toBeLessThan(0.01)
    expect(near / N).toBeLessThan(0.002)
    expect(signOk).toBe(N)
  })
  it('is deterministic for a seed and reports maxDensity >= every sample density', () => {
    const o = { n: 3, l: 2, m: 2, Z: 1.3, real: true }
    const a = sampleOrbital(o, 1000, 42), b = sampleOrbital(o, 1000, 42)
    expect(a.positions).toEqual(b.positions)
    for (let i = 0; i < 1000; i++) expect(a.psi[i] * a.psi[i]).toBeLessThanOrEqual(a.maxDensity * 1.0001)
  })
})
```

```ts
// src/physics/__tests__/colormaps.test.ts
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
```

- [ ] **Step 2: Run, FAIL.**
- [ ] **Step 3: Implement**

`scripts/gen-colormaps.mjs` reads a path to `colormaps.py` (argv[2]), extracts `_inferno_data`, `_magma_data`, `_viridis_data` with a regex over `\[\s*([0-9.]+),\s*([0-9.]+),\s*([0-9.]+)\s*\]`, and writes `src/physics/colormaps.ts` with this header:

```ts
// Generated by scripts/gen-colormaps.mjs from BIDS/colormap colormaps.py.
// Colormaps by Nathaniel J. Smith, Stefan van der Walt and Eric Firing,
// released under CC0 / public domain (https://github.com/BIDS/colormap).
export type ColormapName = 'inferno' | 'magma' | 'viridis'
export const COLORMAPS: Record<ColormapName, Float32Array> = {
  inferno: new Float32Array([ ...768 numbers... ]),
  magma: ..., viridis: ...,
}
/** Linear lookup; t clamped to [0,1]; writes r,g,b into out[offset..offset+2]. */
export function colormapLookup(map: Float32Array, t: number, out: Float32Array, offset: number): void {
  const x = (t <= 0 ? 0 : t >= 1 ? 1 : t) * 255
  const i = Math.floor(x), f = x - i, j = Math.min(255, i + 1)
  out[offset] = map[3 * i] + (map[3 * j] - map[3 * i]) * f
  out[offset + 1] = map[3 * i + 1] + (map[3 * j + 1] - map[3 * i + 1]) * f
  out[offset + 2] = map[3 * i + 2] + (map[3 * j + 2] - map[3 * i + 2]) * f
}
```

```ts
// src/physics/rng.ts
/** mulberry32, a 32-bit seeded PRNG by Tommy Ettinger (public domain). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
```

```ts
// src/physics/sampling.ts
import type { Orbital } from './orbital'
import { radialR } from './radial'
import { angularNorm } from './harmonics'
import { legendreP } from './legendre'
import { orbitalExtent } from './extent'
import { mulberry32 } from './rng'

export interface InverseCdf { x: Float32Array; cdf: Float32Array }

/** Tabulate density f on [a,b] (size points), cumulative trapezoid, normalized to 1. */
export function buildInverseCdf(f: (x: number) => number, a: number, b: number, size: number): InverseCdf {
  const x = new Float32Array(size), cdf = new Float32Array(size)
  const h = (b - a) / (size - 1)
  let acc = 0, prev = Math.max(0, f(a))
  x[0] = a; cdf[0] = 0
  for (let i = 1; i < size; i++) {
    const xi = a + i * h, fi = Math.max(0, f(xi))
    acc += 0.5 * (prev + fi) * h
    x[i] = xi; cdf[i] = acc; prev = fi
  }
  for (let i = 1; i < size; i++) cdf[i] /= acc
  return { x, cdf }
}

/** Inverse transform sampling with linear interpolation between table nodes (Devroye 1986, ch. II.2). */
export function sampleInverseCdf(t: InverseCdf, u: number): number {
  const { x, cdf } = t
  let lo = 0, hi = cdf.length - 1
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cdf[mid] <= u) lo = mid; else hi = mid }
  const span = cdf[hi] - cdf[lo]
  const f = span > 0 ? (u - cdf[lo]) / span : 0
  return x[lo] + (x[hi] - x[lo]) * f
}

export interface SampleResult { positions: Float32Array; psi: Float32Array; maxDensity: number; rMax: number }

/**
 * Sample |psi|^2 = r^2 R^2(r) * |Y|^2(cos t, phi) which, for real or complex
 * hydrogenic orbitals, factorizes into three 1D densities:
 *   radial  : r^2 R_nl^2(r)
 *   polar   : [N P_l^|m|(cos t)]^2 in cos t   (uniform measure in cos t = sin t dt)
 *   azimuth : cos^2(m phi) (m>0), sin^2(|m| phi) (m<0), 1 (m=0 or complex)
 * Each is inverse-CDF sampled from a table. No rejection sampling.
 */
export function sampleOrbital(o: Orbital, count: number, seed: number): SampleResult {
  const rMax = orbitalExtent(o)
  const radial = buildInverseCdf((r) => { const R = radialR(o.n, o.l, o.Z, r); return r * r * R * R }, 0, rMax, 4096)
  const am = Math.abs(o.m)
  const polarFn = (ct: number) => { const p = angularNorm(o.l, o.m) * legendreP(o.l, am, ct); return p * p }
  const polar = buildInverseCdf(polarFn, -1, 1, 2048)
  const azFn = (phi: number) => o.real && o.m > 0 ? Math.cos(am * phi) ** 2 : o.real && o.m < 0 ? Math.sin(am * phi) ** 2 : 1
  const azimuth = buildInverseCdf(azFn, 0, 2 * Math.PI, 2048)
  const azScale = o.real && o.m !== 0 ? 2 : 1 // sqrt2 factor squared in the real harmonics
  const rng = mulberry32(seed)
  const positions = new Float32Array(count * 3), psi = new Float32Array(count)
  let maxR2 = 0
  for (let i = 0; i < 4096; i++) { const r = radial.x[i]; const R = radialR(o.n, o.l, o.Z, r); maxR2 = Math.max(maxR2, R * R) }
  let maxP2 = 0
  for (let i = 0; i < 2048; i++) maxP2 = Math.max(maxP2, polarFn(polar.x[i]))
  const maxDensity = maxR2 * maxP2 * azScale
  for (let i = 0; i < count; i++) {
    const r = sampleInverseCdf(radial, rng())
    const ct = sampleInverseCdf(polar, rng())
    const phi = sampleInverseCdf(azimuth, rng())
    const st = Math.sqrt(Math.max(0, 1 - ct * ct))
    positions[3 * i] = r * st * Math.cos(phi)
    positions[3 * i + 1] = r * st * Math.sin(phi)
    positions[3 * i + 2] = r * ct
    const R = radialR(o.n, o.l, o.Z, r)
    const P = angularNorm(o.l, o.m) * legendreP(o.l, am, ct)
    const A = !o.real || o.m === 0 ? 1 : o.m > 0 ? Math.SQRT2 * Math.cos(am * phi) : Math.SQRT2 * Math.sin(am * phi)
    psi[i] = R * P * A
  }
  return { positions, psi, maxDensity, rMax }
}
```

Coordinates follow the x = r sin t cos phi convention so psi matches `wavefunction.ts`.

- [ ] **Step 4: Generate colormaps** `node scripts/gen-colormaps.mjs <path to colormaps.py>`; run tests, expect PASS; tsc clean.
- [ ] **Step 5: Commit** `git add -A && git commit -m "Add inverse-CDF orbital sampler, seeded RNG and CC0 colormaps"`

### Task 7: Density grid and enclosure threshold

**Files:**
- Create: `src/physics/grid.ts`
- Test: `src/physics/__tests__/grid.test.ts`

**Interfaces:**
- Produces:
  - `interface DensityGrid { size: number; rMax: number; psi: Float32Array /* size^3, x fastest */ }`
  - `buildDensityGrid(o: Orbital, size: number): DensityGrid` (cell centers at `-rMax + (i+0.5) * 2rMax/size`)
  - `findThreshold(grid: DensityGrid, fraction: number): number` density value such that cells with psi² >= threshold hold `fraction` of the grid's total probability; fraction clamped to [0.01, 0.999]; returns `Infinity` if the grid is all zero.
  - `gridIndex(size, i, j, k) = i + size * (j + size * k)`

- [ ] **Step 1: Failing test**

```ts
// src/physics/__tests__/grid.test.ts
import { describe, it, expect } from 'vitest'
import { buildDensityGrid, findThreshold } from '../grid'

describe('density grid', () => {
  it('enclosed fraction above threshold matches the request within 1%', () => {
    const g = buildDensityGrid({ n: 2, l: 1, m: 0, Z: 1, real: true }, 64)
    const cell = Math.pow((2 * g.rMax) / g.size, 3)
    let total = 0
    for (let i = 0; i < g.psi.length; i++) total += g.psi[i] * g.psi[i] * cell
    expect(total).toBeGreaterThan(0.99)
    for (const f of [0.5, 0.9]) {
      const thr = findThreshold(g, f)
      let inside = 0
      for (let i = 0; i < g.psi.length; i++) if (g.psi[i] * g.psi[i] >= thr) inside += g.psi[i] * g.psi[i] * cell
      expect(Math.abs(inside / total - f)).toBeLessThan(0.01)
    }
  })
  it('handles degenerate inputs', () => {
    const g = { size: 4, rMax: 1, psi: new Float32Array(64) }
    expect(findThreshold(g, 0.9)).toBe(Infinity)
    const g2 = buildDensityGrid({ n: 1, l: 0, m: 0, Z: 1, real: true }, 16)
    expect(Number.isFinite(findThreshold(g2, 0))).toBe(true)
    expect(Number.isFinite(findThreshold(g2, 1))).toBe(true)
  })
})
```

- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement**

```ts
// src/physics/grid.ts
import type { Orbital } from './orbital'
import { orbitalExtent } from './extent'
import { psi } from './wavefunction'

export interface DensityGrid { size: number; rMax: number; psi: Float32Array }
export const gridIndex = (size: number, i: number, j: number, k: number) => i + size * (j + size * k)

export function buildDensityGrid(o: Orbital, size: number): DensityGrid {
  const rMax = orbitalExtent(o)
  const h = (2 * rMax) / size
  const out = new Float32Array(size * size * size)
  for (let k = 0; k < size; k++) {
    const z = -rMax + (k + 0.5) * h
    for (let j = 0; j < size; j++) {
      const y = -rMax + (j + 0.5) * h
      for (let i = 0; i < size; i++) out[gridIndex(size, i, j, k)] = psi(o, -rMax + (i + 0.5) * h, y, z)
    }
  }
  return { size, rMax, psi: out }
}

/**
 * Density threshold enclosing `fraction` of the total grid probability: sort
 * cell densities descending and accumulate until the fraction is reached.
 */
export function findThreshold(grid: DensityGrid, fraction: number): number {
  const f = Math.min(0.999, Math.max(0.01, fraction))
  const d = new Float32Array(grid.psi.length)
  let total = 0
  for (let i = 0; i < d.length; i++) { d[i] = grid.psi[i] * grid.psi[i]; total += d[i] }
  if (total === 0) return Infinity
  d.sort().reverse()
  let acc = 0
  for (let i = 0; i < d.length; i++) { acc += d[i]; if (acc >= f * total) return d[i] }
  return d[d.length - 1]
}
```

- [ ] **Step 4: PASS, tsc clean.**
- [ ] **Step 5: Commit** `git commit -am "Add density grid and probability-enclosure threshold"`

### Task 8: Marching cubes

**Files:**
- Create: `src/physics/mcTables.ts` (edgeTable, triTable copied from `node_modules/three/examples/jsm/objects/MarchingCubes.js`, MIT, with attribution header), `src/physics/marchingCubes.ts`, `scripts/gen-mctables.mjs`
- Test: `src/physics/__tests__/marchingCubes.test.ts`

**Interfaces:**
- Produces:
  - `interface IsoMesh { positions: Float32Array; normals: Float32Array; signs: Int8Array /* per vertex +1/-1 */ }`
  - `marchingCubes(grid: DensityGrid, threshold: number): IsoMesh` on the field psi², vertex sign from the corner with the larger density, normals from the central-difference gradient of psi² (negated so they point outward, toward decreasing density), trilinearly interpolated.

- [ ] **Step 1: Failing test**

```ts
// src/physics/__tests__/marchingCubes.test.ts
import { describe, it, expect } from 'vitest'
import { marchingCubes } from '../marchingCubes'
import { gridIndex } from '../grid'

function triangleArea(p: Float32Array, i: number): number {
  const ax = p[i + 3] - p[i], ay = p[i + 4] - p[i + 1], az = p[i + 5] - p[i + 2]
  const bx = p[i + 6] - p[i], by = p[i + 7] - p[i + 1], bz = p[i + 8] - p[i + 2]
  const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx
  return 0.5 * Math.hypot(cx, cy, cz)
}

describe('marchingCubes', () => {
  it('a radial gaussian field gives a sphere whose area is within 3% of 4 pi r^2', () => {
    const size = 64, rMax = 2
    const psi = new Float32Array(size ** 3)
    const h = (2 * rMax) / size
    for (let k = 0; k < size; k++) for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const x = -rMax + (i + 0.5) * h, y = -rMax + (j + 0.5) * h, z = -rMax + (k + 0.5) * h
      psi[gridIndex(size, i, j, k)] = Math.exp(-(x * x + y * y + z * z) / 2) // psi^2 = e^{-r^2}
    }
    const r0 = 1.1
    const mesh = marchingCubes({ size, rMax, psi }, Math.exp(-r0 * r0))
    let area = 0
    for (let i = 0; i < mesh.positions.length; i += 9) area += triangleArea(mesh.positions, i)
    expect(Math.abs(area / (4 * Math.PI * r0 * r0) - 1)).toBeLessThan(0.03)
    expect(mesh.normals.length).toBe(mesh.positions.length)
    expect(mesh.signs.length).toBe(mesh.positions.length / 3)
    // normals point outward: dot(n, p) > 0 on a sphere about the origin
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const d = mesh.normals[i] * mesh.positions[i] + mesh.normals[i + 1] * mesh.positions[i + 1] + mesh.normals[i + 2] * mesh.positions[i + 2]
      expect(d).toBeGreaterThan(0)
    }
  })
  it('returns an empty mesh when nothing crosses the threshold', () => {
    const mesh = marchingCubes({ size: 8, rMax: 1, psi: new Float32Array(512) }, 0.5)
    expect(mesh.positions.length).toBe(0)
    const inf = marchingCubes({ size: 8, rMax: 1, psi: new Float32Array(512).fill(1) }, Infinity)
    expect(inf.positions.length).toBe(0)
  })
})
```

- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement.** `scripts/gen-mctables.mjs` reads the three.js file, extracts the two `new Int32Array([...])` literals after `const edgeTable` and `const triTable`, and writes `src/physics/mcTables.ts`:

```ts
// Marching cubes lookup tables, copied from three.js examples/jsm/objects/MarchingCubes.js
// (MIT License, Copyright 2010-2026 three.js authors); originally from Paul Bourke's
// "Polygonising a scalar field" (1994). Generated by scripts/gen-mctables.mjs.
export const EDGE_TABLE = new Int32Array([ ... 256 ... ])
export const TRI_TABLE = new Int32Array([ ... 4096 ... ])
```

```ts
// src/physics/marchingCubes.ts
import type { DensityGrid } from './grid'
import { gridIndex } from './grid'
import { EDGE_TABLE, TRI_TABLE } from './mcTables'

export interface IsoMesh { positions: Float32Array; normals: Float32Array; signs: Int8Array }

// Corner offsets and edge->corner pairs in the Lorensen & Cline (1987) / Bourke numbering.
const CORNERS = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] as const
const EDGES = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]] as const

/** Marching cubes on the scalar field psi^2 at `threshold` (Lorensen & Cline, SIGGRAPH 1987). */
export function marchingCubes(grid: DensityGrid, threshold: number): IsoMesh {
  const { size, rMax, psi } = grid
  const pos: number[] = [], nrm: number[] = [], sgn: number[] = []
  if (!Number.isFinite(threshold)) return pack(pos, nrm, sgn)
  const h = (2 * rMax) / size
  const dens = (i: number, j: number, k: number) => { const v = psi[gridIndex(size, i, j, k)]; return v * v }
  const densClamped = (i: number, j: number, k: number) => dens(Math.max(0, Math.min(size - 1, i)), Math.max(0, Math.min(size - 1, j)), Math.max(0, Math.min(size - 1, k)))
  // Outward normal = -grad(psi^2) by central differences (surface encloses the high-density region).
  const gradient = (i: number, j: number, k: number, out: number[]) => {
    out[0] = -(densClamped(i + 1, j, k) - densClamped(i - 1, j, k))
    out[1] = -(densClamped(i, j + 1, k) - densClamped(i, j - 1, k))
    out[2] = -(densClamped(i, j, k + 1) - densClamped(i, j, k - 1))
  }
  const cd = new Float64Array(8), cs = new Int8Array(8)
  const vert = new Float64Array(36), vnrm = new Float64Array(36), vsgn = new Int8Array(12)
  const ga: number[] = [0, 0, 0], gb: number[] = [0, 0, 0]
  for (let k = 0; k < size - 1; k++) for (let j = 0; j < size - 1; j++) for (let i = 0; i < size - 1; i++) {
    let cubeIndex = 0
    for (let c = 0; c < 8; c++) {
      const [di, dj, dk] = CORNERS[c]
      const v = psi[gridIndex(size, i + di, j + dj, k + dk)]
      cd[c] = v * v; cs[c] = v >= 0 ? 1 : -1
      if (cd[c] >= threshold) cubeIndex |= 1 << c
    }
    const edges = EDGE_TABLE[cubeIndex]
    if (edges === 0) continue
    for (let e = 0; e < 12; e++) {
      if (!(edges & (1 << e))) continue
      const [a, b] = EDGES[e]
      const da = cd[a], db = cd[b]
      const t = da === db ? 0.5 : (threshold - da) / (db - da)
      const [ai, aj, ak] = CORNERS[a], [bi, bj, bk] = CORNERS[b]
      vert[3 * e] = -rMax + (i + ai + 0.5 + (bi - ai) * t) * h
      vert[3 * e + 1] = -rMax + (j + aj + 0.5 + (bj - aj) * t) * h
      vert[3 * e + 2] = -rMax + (k + ak + 0.5 + (bk - ak) * t) * h
      gradient(i + ai, j + aj, k + ak, ga); gradient(i + bi, j + bj, k + bk, gb)
      const nx = ga[0] + (gb[0] - ga[0]) * t, ny = ga[1] + (gb[1] - ga[1]) * t, nz = ga[2] + (gb[2] - ga[2]) * t
      const len = Math.hypot(nx, ny, nz) || 1
      vnrm[3 * e] = nx / len; vnrm[3 * e + 1] = ny / len; vnrm[3 * e + 2] = nz / len
      vsgn[e] = da >= db ? cs[a] : cs[b]
    }
    for (let t = cubeIndex * 16; TRI_TABLE[t] !== -1; t += 3) {
      for (let q = 0; q < 3; q++) {
        const e = TRI_TABLE[t + q]
        pos.push(vert[3 * e], vert[3 * e + 1], vert[3 * e + 2])
        nrm.push(vnrm[3 * e], vnrm[3 * e + 1], vnrm[3 * e + 2])
        sgn.push(vsgn[e])
      }
    }
  }
  return pack(pos, nrm, sgn)
}

function pack(p: number[], n: number[], s: number[]): IsoMesh {
  return { positions: Float32Array.from(p), normals: Float32Array.from(n), signs: Int8Array.from(s) }
}
```

Check triangle winding against the test's outward-normal expectation: Bourke's table yields counter-clockwise triangles seen from outside when "inside" = below the isovalue. Here inside = above threshold, so if the area test passes but three renders back faces, reverse each triangle's vertex order (`push` the vertices in order q = 2,1,0). The plan's isosurface material uses `DoubleSide`, so this is cosmetic; fix it in this task anyway and note the choice in a comment.

- [ ] **Step 4: Generate tables** `node scripts/gen-mctables.mjs`; tests PASS; tsc clean.
- [ ] **Step 5: Commit** `git add -A && git commit -m "Add marching cubes with MIT lookup tables from three.js"`

**Milestone 1 done:** `npm test` green. Tag: `git tag m1-physics`.

---

## Milestone 2: single-orbital viewer

### Task 9: Worker protocol, worker, and client

**Files:**
- Create: `src/worker/protocol.ts`, `src/worker/orbital.worker.ts`, `src/worker/client.ts`
- Test: `src/worker/__tests__/client.test.ts` (uses a fake `Worker` with the same `postMessage`/`onmessage` shape)

**Interfaces:**
```ts
// protocol.ts
import type { Orbital } from '../physics/orbital'
export type SampleRequest = { id: number; type: 'sample'; orbital: Orbital; count: number; seed: number }
export type GridRequest = { id: number; type: 'grid'; orbital: Orbital; size: number; fraction: number }
export type WorkerRequest = SampleRequest | GridRequest
export type SampleResponse = { id: number; type: 'sample'; positions: Float32Array; psi: Float32Array; maxDensity: number; rMax: number }
export type GridResponse = { id: number; type: 'grid'; positions: Float32Array; normals: Float32Array; signs: Int8Array; threshold: number; rMax: number }
export type ErrorResponse = { id: number; type: 'error'; message: string }
export type WorkerResponse = SampleResponse | GridResponse | ErrorResponse
export function sampleKey(o: Orbital, count: number, seed: number): string  // `${o.n},${o.l},${o.m},${o.Z.toFixed(4)},${o.real?1:0},s${count},${seed}`
export function gridKey(o: Orbital, size: number, fraction: number): string
```
```ts
// client.ts
export interface WorkerLike { postMessage(msg: unknown, transfer?: Transferable[]): void; onmessage: ((ev: MessageEvent) => void) | null; terminate(): void }
export class OrbitalWorkerClient {
  constructor(worker: WorkerLike, cacheLimit = 64)
  sample(orbital: Orbital, count: number, seed: number): Promise<SampleResponse>   // cached by sampleKey (LRU)
  grid(orbital: Orbital, size: number, fraction: number): Promise<GridResponse>    // cached by gridKey
  cancelAll(): void   // rejects every pending promise with Error('cancelled'); later worker replies for those ids are ignored
  dispose(): void
}
```
The worker handles one message at a time (JS is single-threaded) and posts results with transfer lists `[positions.buffer, psi.buffer]`.

- [ ] **Step 1: Failing test**

```ts
// src/worker/__tests__/client.test.ts
import { describe, it, expect } from 'vitest'
import { OrbitalWorkerClient, type WorkerLike } from '../client'
import type { WorkerRequest, WorkerResponse } from '../protocol'

/** Fake worker: records requests, replies when `flush()` is called. */
class FakeWorker implements WorkerLike {
  onmessage: ((ev: MessageEvent) => void) | null = null
  requests: WorkerRequest[] = []
  postMessage(msg: unknown) { this.requests.push(msg as WorkerRequest) }
  terminate() {}
  reply(res: WorkerResponse) { this.onmessage?.({ data: res } as MessageEvent) }
}
const o = { n: 1, l: 0, m: 0, Z: 1, real: true }

describe('OrbitalWorkerClient', () => {
  it('posts a request and resolves with the response', async () => {
    const w = new FakeWorker(), c = new OrbitalWorkerClient(w)
    const p = c.sample(o, 10, 1)
    expect(w.requests.length).toBe(1)
    w.reply({ id: w.requests[0].id, type: 'sample', positions: new Float32Array(30), psi: new Float32Array(10), maxDensity: 1, rMax: 5 })
    expect((await p).psi.length).toBe(10)
  })
  it('caches identical requests', async () => {
    const w = new FakeWorker(), c = new OrbitalWorkerClient(w)
    const p = c.sample(o, 10, 1)
    w.reply({ id: w.requests[0].id, type: 'sample', positions: new Float32Array(30), psi: new Float32Array(10), maxDensity: 1, rMax: 5 })
    await p
    await c.sample(o, 10, 1)
    expect(w.requests.length).toBe(1)
  })
  it('cancelAll rejects pending and ignores late replies', async () => {
    const w = new FakeWorker(), c = new OrbitalWorkerClient(w)
    const p = c.sample(o, 10, 1)
    c.cancelAll()
    await expect(p).rejects.toThrow('cancelled')
    w.reply({ id: w.requests[0].id, type: 'sample', positions: new Float32Array(30), psi: new Float32Array(10), maxDensity: 1, rMax: 5 })
    const p2 = c.sample(o, 10, 1)
    expect(w.requests.length).toBe(2) // not served from cache by the stale reply
    w.reply({ id: w.requests[1].id, type: 'sample', positions: new Float32Array(30), psi: new Float32Array(10), maxDensity: 1, rMax: 5 })
    await p2
  })
  it('rejects on error responses', async () => {
    const w = new FakeWorker(), c = new OrbitalWorkerClient(w)
    const p = c.grid(o, 8, 0.9)
    w.reply({ id: w.requests[0].id, type: 'error', message: 'boom' })
    await expect(p).rejects.toThrow('boom')
  })
})
```

- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement** `protocol.ts` as above; `client.ts` with a `Map<number, {resolve, reject}>` of pending requests, an LRU `Map<string, WorkerResponse>` (delete+set on hit, evict oldest beyond `cacheLimit`), and `cancelAll` that rejects and clears pending (late replies with unknown ids are dropped). `orbital.worker.ts`:

```ts
import { sampleOrbital } from '../physics/sampling'
import { buildDensityGrid, findThreshold } from '../physics/grid'
import { marchingCubes } from '../physics/marchingCubes'
import type { WorkerRequest, WorkerResponse } from './protocol'

self.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data
  try {
    if (req.type === 'sample') {
      const r = sampleOrbital(req.orbital, req.count, req.seed)
      const res: WorkerResponse = { id: req.id, type: 'sample', ...r }
      ;(self as unknown as Worker).postMessage(res, [r.positions.buffer, r.psi.buffer])
    } else {
      const grid = buildDensityGrid(req.orbital, req.size)
      const threshold = findThreshold(grid, req.fraction)
      const mesh = marchingCubes(grid, threshold)
      const res: WorkerResponse = { id: req.id, type: 'grid', ...mesh, threshold, rMax: grid.rMax }
      ;(self as unknown as Worker).postMessage(res, [mesh.positions.buffer, mesh.normals.buffer, mesh.signs.buffer])
    }
  } catch (e) {
    ;(self as unknown as Worker).postMessage({ id: req.id, type: 'error', message: (e as Error).message })
  }
}
```
Add `"lib": ["ES2023", "DOM", "WebWorker"]` to tsconfig. Main thread creates it with `new Worker(new URL('./worker/orbital.worker.ts', import.meta.url), { type: 'module' })`.

- [ ] **Step 4: PASS, tsc clean.**
- [ ] **Step 5: Commit** `git add -A && git commit -m "Add orbital worker, protocol and cached client"`

### Task 10: Scene setup with composer, lights, controls, theme

**Files:**
- Create: `src/render/scene.ts`, `src/render/postprocessing.ts`
- Modify: `src/main.ts`, `src/style.css`, `index.html`

**Interfaces:**
```ts
export type RenderMode = 'spheres' | 'glow' | 'iso'
export type Theme = 'light' | 'dark'
export class SceneManager {
  readonly renderer: THREE.WebGLRenderer; readonly scene: THREE.Scene; readonly camera: THREE.PerspectiveCamera
  readonly controls: OrbitControls; readonly content: THREE.Group  // all orbital objects go here
  constructor(container: HTMLElement)
  setMode(mode: RenderMode): void       // rebuilds the composer: spheres/iso -> GTAO (if aoEnabled); glow -> bloom
  setTheme(theme: Theme): void          // background + fog color: light #f4f4f6, dark #0b0b0e; glow always black
  setAO(enabled: boolean): void; setAOParams(p: { radius: number; intensity: number }): void
  setBloom(p: { enabled: boolean; strength: number; threshold: number; radius: number }): void
  setExposure(v: number): void          // renderer.toneMappingExposure
  fitCamera(radius: number): void       // place camera at distance 2.2*radius, controls.target origin
  resetCamera(): void
  start(): void; stop(): void           // rAF loop; renders via composer; half-res AO while controls are moving
  renderOnce(): void
  memoryInfo(): { geometries: number; textures: number }
  dispose(): void
}
```
Also `createRenderer(container)` throws a typed `WebGLUnavailableError` when `WebGL2RenderingContext` is missing or context creation fails; `main.ts` catches it and shows `<div class="fatal">This app needs WebGL 2. ...</div>` (Review Focus 5). A `webglcontextlost` listener on the canvas shows the same banner with "Reload" text.

- [ ] **Step 1: Write `index.html` layout**: `#app` containing `<main id="viewport"></main>`, `<aside id="side"></aside>` (periodic table + info go here later), and a `#gui` host for lil-gui. CSS grid: viewport fills, side panel 320px on the right, collapses under 900px to a bottom sheet.

- [ ] **Step 2: Implement `postprocessing.ts`**: a `buildComposer(renderer, scene, camera, opts: { mode, ao, bloom, width, height })` returning `{ composer, gtao?: GTAOPass, bloom?: UnrealBloomPass, output: OutputPass }`. GTAO: `new GTAOPass(scene, camera, w, h)`, `gtao.output = GTAOPass.OUTPUT.Default`, `gtao.updateGtaoMaterial({ radius, distanceExponent: 1, thickness: 1, scale: 1, samples: 16, distanceFallOff: 1, screenSpaceRadius: false })`, `gtao.blendIntensity`. Bloom: `new UnrealBloomPass(new Vector2(w, h), strength, radius, threshold)`. Always end with `OutputPass`. Renderer: `antialias: true`, `setPixelRatio(Math.min(2, devicePixelRatio))`, `toneMapping = ACESFilmicToneMapping`.

- [ ] **Step 3: Implement `SceneManager`** with `HemisphereLight(0xffffff, 0xd8d8dc, 1.2)` + `DirectionalLight(0xffffff, 1.4)` at (-3, 5, 4) (upper-left), no shadows, `scene.fog = new Fog(bg, far1, far2)` set in `fitCamera` to (3.5r, 6r). rAF loop: `controls.update()`; when `controls` emitted `change` within the last 150 ms and AO is on, render with `gtao` at half resolution by calling `gtao.setSize(w/2, h/2)`, otherwise full. `ResizeObserver` on the container updates sizes.

- [ ] **Step 4: Wire `main.ts`** to create the scene, add a placeholder `Mesh(SphereGeometry(0.2), MeshStandardMaterial({ color: 0x333333 }))` nucleus, start the loop. Run `npm run dev`, open the page, confirm an orbitable grey sphere on white; `npm run build` succeeds.

- [ ] **Step 5: Commit** `git add -A && git commit -m "Add scene manager with composer, lights and controls"`

### Task 11: Lit instanced-sphere cloud

**Files:**
- Create: `src/render/sphereCloud.ts`, `src/render/colors.ts`
- Modify: `src/main.ts`

**Interfaces:**
```ts
// colors.ts
export function phaseShades(base: string): { pos: THREE.Color; neg: THREE.Color }  // pos = base lightened to L+0.15 in HSL, neg = base darkened to L-0.2
export const SUBSHELL_PALETTE: string[]  // 10 distinct hues, used by element view: ['#2a9d8f', '#e76f51', '#457b9d', '#f4a261', '#8e44ad', '#2ecc71', '#d35400', '#1abc9c', '#c0392b', '#7f8c8d']
// sphereCloud.ts
export class SphereCloud {
  readonly mesh: THREE.InstancedMesh
  constructor(maxCount: number)                       // allocates geometry/material/instance buffers once
  update(positions: Float32Array, psi: Float32Array, pos: THREE.Color, neg: THREE.Color, radius: number): void
  setRadius(radius: number): void                     // rescales the matrices' diagonal in place
  setDetail(detail: 1 | 2): void                      // swaps IcosahedronGeometry
  dispose(): void
}
```
`update` writes `instanceMatrix.array` directly: for i, matrix = [r,0,0,0, 0,r,0,0, 0,0,r,0, x,y,z,1]; `instanceColor` is a `InstancedBufferAttribute(new Float32Array(3*max), 3)` written directly (pos or neg by `psi[i] >= 0`); set `mesh.count = N`, mark both `needsUpdate = true`, `mesh.computeBoundingSphere()`. Material: `MeshStandardMaterial({ roughness: 0.6, metalness: 0 })` with `color: 0xffffff` so instance colors show.

- [ ] **Step 1:** Implement both files.
- [ ] **Step 2:** In `main.ts`: create `OrbitalWorkerClient`, request `sample({n:3,l:2,m:0,Z:1,real:true}, 5000, 1)` then `50000`, build a `SphereCloud(150000)` and update it with radius `0.02 * rMax`; call `scene.fitCamera(rMax * 0.8)`; `setAOParams({ radius: 6 * sphereRadius, intensity: 1 })`.
- [ ] **Step 3:** Run the dev server and compare with the reference look: solid shaded spheres, visibly darker interior, dark gap at the nodal cone of 3dz2. Adjust `GTAO radius`/`blendIntensity` and light intensities until it reads as a 3D object; record the chosen defaults in `src/render/defaults.ts` (`export const DEFAULTS = { sphereRadiusFactor: 0.02, aoRadiusFactor: 6, aoIntensity: 1, ... }`).
- [ ] **Step 4:** Check `renderer.info.memory.geometries` before and after 50 `update` calls: must not grow (no new geometries are allocated by `update`).
- [ ] **Step 5: Commit** `git add -A && git commit -m "Add lit instanced sphere cloud"`

### Task 12: Glow cloud with bloom

**Files:**
- Create: `src/render/glowCloud.ts`, `src/render/sprite.ts`
- Modify: `src/main.ts`

**Interfaces:**
```ts
// sprite.ts
export function makeRadialSprite(size = 64): THREE.CanvasTexture  // radial gradient white (alpha 1) at center -> alpha 0 at edge
// glowCloud.ts
export class GlowCloud {
  readonly points: THREE.Points
  constructor(maxCount: number)
  update(positions: Float32Array, psi: Float32Array, maxDensity: number, map: Float32Array /* colormap */, gamma: number): void
  setColormap(map: Float32Array, gamma: number): void   // recolors from the cached psi/maxDensity
  setPointSize(size: number): void
  setCount(n: number): void                               // sets opacity = clamp(8 / sqrt(n), 0.02, 1)
  dispose(): void
}
```
Color: `t = pow(psi²/maxDensity, gamma)` with default `gamma = 0.35`, then `colormapLookup(map, t, colors, 3i)`. Material: `PointsMaterial({ size, vertexColors: true, map: sprite, transparent: true, blending: AdditiveBlending, depthWrite: false, sizeAttenuation: true })`.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** In `main.ts`, keyboard `2` switches to glow: `scene.setMode('glow')`, hide the sphere cloud, show the glow cloud, request 300k samples. Bloom defaults: strength 0.6, radius 0.4, threshold 0.6. Background black.
- [ ] **Step 3:** Compare with the reference: white-hot lobe centers, orange/red/purple fringe, black nodal planes. Tune gamma, point size (`0.012 * rMax` default), and opacity until it matches; record in `defaults.ts`.
- [ ] **Step 4: Commit** `git add -A && git commit -m "Add glow point cloud with inferno colormap and bloom"`

### Task 13: App state, lil-gui controls, single-orbital picker

**Files:**
- Create: `src/state.ts`, `src/ui/controls.ts`, `src/app.ts` (orchestrator: state -> worker -> render objects)
- Modify: `src/main.ts` (now only creates `App`)

**Interfaces:**
```ts
// state.ts
export interface AppState {
  Z: number; single: boolean; n: number; l: number; m: number; real: boolean
  mode: RenderMode; theme: Theme
  sphereCount: number; sphereRadius: number; ao: boolean; aoIntensity: number
  glowCount: number; pointSize: number; colormap: ColormapName; gamma: number; exposure: number
  bloom: boolean; bloomStrength: number; bloomThreshold: number
  isoFraction: number; gridSize: number
  showNucleus: boolean; showAxes: boolean; showSlice: boolean; showRadial: boolean; bohr: boolean
  valenceOnly: boolean; hiddenSubshells: string[]   // e.g. ['1s', '2p']
}
export const DEFAULT_STATE: AppState
export class Store { get state(): AppState; set(patch: Partial<AppState>): void; subscribe(fn: (s: AppState, changed: (keyof AppState)[]) => void): () => void }
```
`App` subscribes and decides: orbital-affecting keys (Z, single, n, l, m, real, sphereCount, glowCount, mode, isoFraction, gridSize, valenceOnly, hiddenSubshells) trigger `rebuild()` (preview N=5000 first, then full; `client.cancelAll()` first); look-affecting keys (sphereRadius, ao, bloom*, colormap, gamma, exposure, pointSize, theme) apply in place.

- [ ] **Step 1:** Implement `Store` with a tiny test `src/__tests__/state.test.ts` (set emits changed keys; unchanged values do not emit).
- [ ] **Step 2:** Implement `controls.ts`: lil-gui folders "Orbital" (single toggle, n 1..7, l, m sliders whose ranges follow n and l; real/complex), "Render" (mode dropdown, theme), "Spheres" (count 5000..150000 step 1000, radius, AO, AO intensity), "Glow" (count 100000..500000, point size, colormap, gamma, exposure, bloom, strength, threshold), "Isosurface" (fraction 0.5..0.99, grid 48..128 step 16), "Overlays", "Render still" button (wired in Task 19). Folder visibility follows the mode.
- [ ] **Step 3:** Implement `App` with `rebuild()` using the preview-then-refine sequence and a `generation` counter so stale results are dropped.
- [ ] **Step 4:** Manual check: change n/l/m, modes, N; no console errors; preview appears within 300 ms (log `performance.now()` deltas in dev).
- [ ] **Step 5: Commit** `git add -A && git commit -m "Add app state, lil-gui controls and single-orbital picker"`

**Milestone 2 done.** Tag `m2-viewer`.

---

## Milestone 3: isosurface

### Task 14: Isosurface render object and mode

**Files:**
- Create: `src/render/isosurface.ts`
- Modify: `src/app.ts`

**Interfaces:**
```ts
export class IsoSurface {
  readonly group: THREE.Group
  update(positions: Float32Array, normals: Float32Array, signs: Int8Array, pos: THREE.Color, neg: THREE.Color): void
  setOpacity(o: number): void
  dispose(): void
}
```
Splits vertices by sign into two non-indexed `BufferGeometry` objects (positive/negative), each a `Mesh` with `MeshPhysicalMaterial({ color, transparent: true, opacity: 0.75, roughness: 0.35, side: DoubleSide, depthWrite: false })`. `update` replaces attributes (dispose old geometry first).

- [ ] **Step 1:** Implement; in `App.rebuild()` for mode `iso` call `client.grid(orbital, gridSize, isoFraction)`.
- [ ] **Step 2:** Manual check with 3dz2 and 2pz: two-colored lobes, nodal gaps, 90% default; changing fraction updates; `renderer.info.memory.geometries` stable after 50 switches.
- [ ] **Step 3: Commit** `git add -A && git commit -m "Add marching-cubes isosurface mode"`

**Milestone 3 done.** Tag `m3-iso`.

---

## Milestone 4: periodic table and element view

### Task 15: Element orbital set

**Files:**
- Create: `src/physics/elementOrbitals.ts`
- Test: `src/physics/__tests__/elementOrbitals.test.ts`

**Interfaces:**
```ts
export interface SubshellView { key: string /* '3d' */; n: number; l: number; electrons: number; Zeff: number; valence: boolean; orbitals: { m: number; electrons: number }[] }
export function elementSubshells(Z: number): SubshellView[]          // configuration order
export function allocateCounts(subshells: SubshellView[], total: number, minPerOrbital = 500): Map<string, number>  // key `${n},${l},${m}` -> count proportional to electrons, floored
```

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest'
import { elementSubshells, allocateCounts } from '../elementOrbitals'

describe('elementSubshells', () => {
  it('Fe has 7 subshells with Slater Zeff and valence flags', () => {
    const s = elementSubshells(26)
    expect(s.map((x) => x.key)).toEqual(['1s', '2s', '2p', '3s', '3p', '4s', '3d'])
    expect(s.find((x) => x.key === '3d')!.Zeff).toBeCloseTo(6.25, 10)
    expect(s.filter((x) => x.valence).map((x) => x.key)).toEqual(['4s', '3d'])
    expect(s.find((x) => x.key === '3d')!.orbitals.length).toBe(5)
  })
  it('allocates counts proportional to electrons with a floor', () => {
    const counts = allocateCounts(elementSubshells(36), 50000)
    for (const v of counts.values()) expect(v).toBeGreaterThanOrEqual(500)
    expect(counts.get('1,0,0')!).toBeLessThan(counts.get('4,1,0')! * 2)
    expect(counts.size).toBe(1 + 1 + 3 + 1 + 3 + 1 + 5 + 3)
  })
})
```

- [ ] **Step 2: FAIL. Step 3: Implement** (uses `groundStateConfiguration`, `slaterZeff`, `isValenceSubshell`, `occupiedOrbitals`). `allocateCounts`: per orbital `max(minPerOrbital, round(total * electrons / Z))`.
- [ ] **Step 4: PASS. Step 5: Commit** `git add -A && git commit -m "Add element subshell/orbital set with Zeff and count allocation"`

### Task 16: Multi-orbital element view in all three modes

**Files:**
- Modify: `src/app.ts`, `src/render/sphereCloud.ts` (add `updateMany(parts: { positions, psi, pos, neg }[], radius)` that concatenates into the single instanced mesh), `src/render/glowCloud.ts` (`updateMany(parts: { positions, psi, maxDensity }[], ...)` with per-part normalization), `src/render/isosurface.ts` (`IsoSurfaceSet` holding one `IsoSurface` per subshell)

- [ ] **Step 1:** In `App.rebuild()` when `!state.single`: `subshells = elementSubshells(Z)` filtered by `valenceOnly` and `hiddenSubshells`; for spheres/glow allocate counts, request every (n,l,m) sample in parallel (`Promise.all`), concatenate, color by `SUBSHELL_PALETTE[index]` via `phaseShades`. Preview: same with `total = 5000`. For iso: one `grid` request per subshell using the m=0 orbital of the subshell (document: "isosurface shows one representative orbital per subshell"), each with its subshell color pair.
- [ ] **Step 2:** Sphere radius and camera fit use the largest `rMax` among parts.
- [ ] **Step 3:** Manual check: Fe shows nested shells; toggling valence shows only 4s + 3d; GPU memory stable.
- [ ] **Step 4: Commit** `git add -A && git commit -m "Add multi-subshell element view"`

### Task 17: Periodic table picker and subshell list

**Files:**
- Create: `src/ui/periodicTable.ts`, `src/ui/subshellList.ts`
- Modify: `src/app.ts`, `src/style.css`

- [ ] **Step 1:** `renderPeriodicTable(host, onPick(Z))`: an 18-column CSS grid, 4 periods, each cell a `<button data-z>` with symbol and Z, tinted by block (s #dfe9f3, p #f3e3df, d #e3f3df); `markSelected(Z)`. Cells for Z>36 are not rendered (keep the grid shape by placing cells with `grid-column: group; grid-row: period`).
- [ ] **Step 2:** `renderSubshellList(host, subshells, state, onToggle(key), onColor?)`: one row per subshell with a checkbox, a color swatch (palette color), label like `3d⁶ (Zeff 6.25)`, and a "valence" badge; a "Valence only" checkbox at the top.
- [ ] **Step 3:** Wire into `App`: picking an element sets `{ Z, single: false, hiddenSubshells: [] }`; clicking "Single orbital" in the GUI sets `single: true`.
- [ ] **Step 4:** Manual check across H, C, Fe, Kr.
- [ ] **Step 5: Commit** `git add -A && git commit -m "Add periodic table picker and subshell list"`

**Milestone 4 done.** Tag `m4-elements`.

---

## Milestone 5: overlays and info

### Task 18: Nucleus, axes, slice plane inset, radial plot, Bohr view, info panel

**Files:**
- Create: `src/render/overlays.ts` (nucleus sphere scaled to `0.03*rMax`, `AxesHelper(rMax)`, slice plane `Mesh(PlaneGeometry, MeshBasicMaterial({ map: CanvasTexture, transparent, opacity 0.9, side DoubleSide }))` at z=0), `src/ui/sliceInset.ts` (256x256 canvas, density on the plane through the origin normal to z, colormap inferno with the same gamma), `src/ui/radialPlot.ts` (canvas plot of r²R² vs r for the selected orbital or, in element view, one curve per visible subshell in its color), `src/render/bohr.ts` (flat view: `Group` of `RingGeometry` circles radius `n` units apart with small electron spheres evenly spaced, count from `shellCounts`; hides the cloud group while on), `src/ui/infoPanel.ts`
- Modify: `src/app.ts`

- [ ] **Step 1:** Implement each; all are driven from `Store` keys `showNucleus`, `showAxes`, `showSlice`, `showRadial`, `bohr`.
- [ ] **Step 2:** Info panel text: name, symbol, Z, configuration string, shell counts (`K 2, L 8, M 14, N 2`), and the fixed note: *"Orbitals shown are hydrogen-like functions with an effective nuclear charge from Slater's rules. For atoms with more than one electron this is a teaching approximation (not Hartree-Fock): shapes are right, sizes are approximate, and the subshell ordering follows the aufbau rule plus a small exceptions table."* In single mode it shows the orbital label, n/l/m, Z and the enclosed-probability radius.
- [ ] **Step 3:** Manual check. **Step 4: Commit** `git add -A && git commit -m "Add overlays, radial plot, Bohr view and info panel"`

### Task 19: Render still

**Files:**
- Create: `src/render/still.ts`
- Modify: `src/app.ts`, `src/ui/controls.ts`

- [ ] **Step 1:** `renderStill(app, { scale: 2, countMultiplier: 2, aoIntensity: 1.5, dof: boolean })`: cancel pending work, request `count * countMultiplier` samples (await), set `renderer.setPixelRatio(min(4, 2*devicePixelRatio))`, composer `setSize`, raise AO intensity, optionally insert a `BokehPass(scene, camera, { focus: camera.position.length(), aperture: 0.0008, maxblur: 0.01 })` before `OutputPass`, `renderOnce()`, `canvas.toBlob` -> `<a download="atom-<label>.png">`, then restore everything (pixel ratio, AO, composer passes, sample count) and `rebuild()`.
- [ ] **Step 2:** Manual check that a PNG downloads and the live view returns to normal. **Step 3: Commit** `git add -A && git commit -m "Add high-quality still render to PNG"`

**Milestone 5 done.** Tag `m5-overlays`.

---

## Milestone 6: polish

### Task 20: URL state and keyboard shortcuts

**Files:**
- Create: `src/ui/urlState.ts`, `src/ui/shortcuts.ts`
- Test: `src/ui/__tests__/urlState.test.ts`

**Interfaces:**
```ts
export function stateFromSearch(search: string, base: AppState): AppState   // reads Z, single, n, l, m, mode, N, theme, iso, real; clamps via clampOrbital, elementByZ, allowed enums
export function searchFromState(s: AppState): string                          // only keys that differ from DEFAULT_STATE
```

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest'
import { stateFromSearch, searchFromState } from '../urlState'
import { DEFAULT_STATE } from '../../state'

describe('urlState', () => {
  it('round-trips', () => {
    const s = { ...DEFAULT_STATE, Z: 26, mode: 'iso' as const, single: false }
    const q = searchFromState(s)
    expect(q).toContain('Z=26')
    expect(stateFromSearch(q, DEFAULT_STATE)).toMatchObject({ Z: 26, mode: 'iso', single: false })
  })
  it('clamps garbage', () => {
    const s = stateFromSearch('?Z=999&n=12&l=9&m=-9&mode=bogus&N=abc', DEFAULT_STATE)
    expect(s.Z).toBe(DEFAULT_STATE.Z)
    expect(s).toMatchObject({ n: 7, l: 6, m: -6, mode: DEFAULT_STATE.mode })
    expect(s.sphereCount).toBe(DEFAULT_STATE.sphereCount)
  })
})
```

- [ ] **Step 2: FAIL. Step 3: Implement**; `App` calls `history.replaceState` (debounced 300 ms) on state change and reads the URL on boot. Shortcuts: `1/2/3` mode, `R` reset camera, `S` still, `B` Bohr, `D` theme, `V` valence only, `Esc` closes side panel on mobile. Ignore when focus is in an input.
- [ ] **Step 4: PASS. Step 5: Commit** `git add -A && git commit -m "Add URL state and keyboard shortcuts"`

### Task 21: Responsive layout, README, final checks

**Files:**
- Modify: `src/style.css`, `index.html`
- Create: `README.md`, `docs/screenshots/` (placeholders are not allowed: capture real screenshots with the Playwright tooling or the browser, PNGs committed)

- [ ] **Step 1:** Mobile layout check at 400px wide (side panel becomes a bottom sheet, GUI collapsed by default under 900px).
- [ ] **Step 2:** README: what it is, how to run (`npm i && npm run dev`), controls and shortcuts, the three looks with screenshots, the physics section (formulas, Slater's rules, the approximation caveat, the configuration exceptions table), performance notes measured on this machine (fps for 50k spheres + AO and 300k glow points + bloom, from `requestAnimationFrame` deltas logged in dev), license notes (three MIT tables, CC0 colormaps, hand-typed element data).
- [ ] **Step 3:** `npm test`, `npx tsc --noEmit`, `npm run build` all green; 50 orbital switches leave `renderer.info.memory` unchanged (log it from the GUI "Memory" readout).
- [ ] **Step 4: Commit** `git add -A && git commit -m "Add responsive layout and README with screenshots"`; tag `v0.1.0`.
