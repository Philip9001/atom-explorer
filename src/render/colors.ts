import * as THREE from 'three'

/** Twenty distinct hues for subshells in the element view (index = subshell order; Og has 19). */
export const SUBSHELL_PALETTE: string[] = [
  '#2a9d8f', '#e76f51', '#457b9d', '#f4a261', '#8e44ad',
  '#2ecc71', '#d35400', '#1abc9c', '#c0392b', '#7f8c8d',
  '#3f51b5', '#ff9800', '#009688', '#e91e63', '#8bc34a',
  '#795548', '#00bcd4', '#9c27b0', '#cddc39', '#607d8b',
]

/** Two shades of a base color: lighter for psi > 0, darker for psi < 0. */
export function phaseShades(base: string): { pos: THREE.Color; neg: THREE.Color } {
  const c = new THREE.Color(base)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  const pos = new THREE.Color().setHSL(hsl.h, hsl.s, Math.min(0.92, hsl.l + 0.15))
  const neg = new THREE.Color().setHSL(hsl.h, hsl.s, Math.max(0.08, hsl.l - 0.2))
  return { pos, neg }
}
