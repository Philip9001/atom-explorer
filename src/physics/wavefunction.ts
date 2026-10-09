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

/** Real part of psi at a Cartesian point (x = r sin t cos phi, y = r sin t sin phi, z = r cos t). */
export function psi(o: Orbital, x: number, y: number, z: number): number {
  const s = toSpherical(x, y, z)
  return psiSpherical(o, s.r, s.cosTheta, s.phi)
}

/** |psi|^2. For complex orbitals this is R^2 [N P_l^|m|]^2, independent of phi. */
export function density(o: Orbital, x: number, y: number, z: number): number {
  const s = toSpherical(x, y, z)
  const R = radialR(o.n, o.l, o.Z, s.r)
  if (o.real) {
    const y = realY(o.l, o.m, s.cosTheta, s.phi)
    return R * R * y * y
  }
  const a = angularNorm(o.l, o.m) * legendreP(o.l, Math.abs(o.m), s.cosTheta)
  return R * R * a * a
}

/** Phase angle of psi at a point in [0, 2pi): 0 or pi for real orbitals. */
export function phase(o: Orbital, x: number, y: number, z: number): number {
  const s = toSpherical(x, y, z)
  if (o.real) return psiSpherical(o, s.r, s.cosTheta, s.phi) >= 0 ? 0 : Math.PI
  const R = radialR(o.n, o.l, o.Z, s.r) * angularNorm(o.l, o.m) * legendreP(o.l, Math.abs(o.m), s.cosTheta)
  let ph = (o.m * s.phi + (R < 0 ? Math.PI : 0)) % (2 * Math.PI)
  if (ph < 0) ph += 2 * Math.PI
  return ph
}
