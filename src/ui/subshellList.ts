import type { SubshellView } from '../physics/elementOrbitals'
import { subshellColor } from '../parts'

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'
const sup = (n: number) => String(n).split('').map((d) => SUP[+d]).join('')

export interface SubshellListProps {
  subshells: SubshellView[]
  hidden: string[]
  valenceOnly: boolean
  onToggle: (key: string, visible: boolean) => void
  onValenceOnly: (v: boolean) => void
}

/** Checkbox list of an element's subshells with color swatches and Z_eff. */
export function renderSubshellList(host: HTMLElement, p: SubshellListProps): void {
  host.replaceChildren()
  const head = document.createElement('label')
  head.className = 'row valence-toggle'
  const vo = document.createElement('input')
  vo.type = 'checkbox'
  vo.checked = p.valenceOnly
  vo.addEventListener('change', () => p.onValenceOnly(vo.checked))
  head.append(vo, document.createTextNode(' Valence only'))
  host.appendChild(head)
  for (const s of p.subshells) {
    const row = document.createElement('label')
    const off = p.hidden.includes(s.key)
    const dimmed = p.valenceOnly && !s.valence
    row.className = `row subshell${off || dimmed ? ' off' : ''}`
    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.checked = !off
    cb.disabled = dimmed
    cb.addEventListener('change', () => p.onToggle(s.key, cb.checked))
    const swatch = document.createElement('span')
    swatch.className = 'swatch'
    swatch.style.background = subshellColor(p.subshells, s.key)
    const label = document.createElement('span')
    label.className = 'label'
    label.textContent = `${s.key}${sup(s.electrons)}`
    const zeff = document.createElement('span')
    zeff.className = 'muted'
    zeff.textContent = `Zeff ${s.Zeff.toFixed(2)}`
    row.append(cb, swatch, label, zeff)
    if (s.valence) {
      const badge = document.createElement('span')
      badge.className = 'badge'
      badge.textContent = 'valence'
      row.appendChild(badge)
    }
    host.appendChild(row)
  }
}
