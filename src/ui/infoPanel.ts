import { elementByZ } from '../physics/elements'
import { groundStateConfiguration, configurationString, shellCounts } from '../physics/configuration'
import { orbitalLabel } from '../physics/orbital'
import type { AppState } from '../state'

export const APPROXIMATION_NOTE =
  "Orbitals shown are hydrogen-like functions with an effective nuclear charge from Slater's rules. " +
  'For atoms with more than one electron this is a teaching approximation (not Hartree-Fock): shapes are right, ' +
  'sizes are approximate, and the subshell ordering follows the aufbau rule plus a small exceptions table.'

const SHELL_NAMES = 'KLMNOPQ'

export function renderInfoPanel(host: HTMLElement, s: AppState, extras: { fitRadius: number }): void {
  host.replaceChildren()
  const p = (html: string, cls = '') => { const el = document.createElement('p'); el.innerHTML = html; if (cls) el.className = cls; host.appendChild(el) }
  if (s.single) {
    p(`<strong>Hydrogen orbital ${orbitalLabel({ n: s.n, l: s.l, m: s.m, real: s.real })}</strong>`)
    p(`n = ${s.n}, l = ${s.l}, m = ${s.m}, Z = 1 · ${s.real ? 'real' : 'complex'} harmonics`)
    p(`Radial nodes ${s.n - s.l - 1}, angular nodes ${s.l} · 95% of samples within ${extras.fitRadius.toFixed(1)} a₀`)
    p('Single-orbital mode shows an exact hydrogen wavefunction (Z = 1).', 'note')
    return
  }
  const e = elementByZ(s.Z)
  if (!e) return
  const cfg = groundStateConfiguration(s.Z)
  const shells = shellCounts(cfg).map((c, i) => `${SHELL_NAMES[i]} ${c}`).join(', ')
  p(`<strong>${e.name}</strong> (${e.symbol}), Z = ${e.Z} · period ${e.period}, group ${e.group}, ${e.block}-block`)
  p(`Configuration: ${configurationString(cfg)}`)
  p(`Shells: ${shells}`)
  p(APPROXIMATION_NOTE, 'note')
}
