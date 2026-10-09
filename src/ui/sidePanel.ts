import type { Store } from '../state'
import { elementSubshells } from '../physics/elementOrbitals'
import { renderPeriodicTable } from './periodicTable'
import { renderSubshellList } from './subshellList'

/** Right-hand panel: periodic table, info, subshell list. Re-renders from the store. */
export function createSidePanel(host: HTMLElement, store: Store): void {
  const tableHost = section(host, 'Elements')
  const infoHost = section(host, 'Info')
  const listHost = section(host, 'Subshells')
  const table = renderPeriodicTable(tableHost, (Z) => store.set({ Z, single: false, hiddenSubshells: [] }))
  infoHost.id = 'info'
  const render = () => {
    const s = store.state
    table.markSelected(s.single ? null : s.Z)
    listHost.parentElement!.hidden = s.single
    if (!s.single) {
      renderSubshellList(listHost, {
        subshells: elementSubshells(s.Z),
        hidden: s.hiddenSubshells,
        valenceOnly: s.valenceOnly,
        onToggle: (key, visible) => {
          const hidden = s.hiddenSubshells.filter((k) => k !== key)
          if (!visible) hidden.push(key)
          store.set({ hiddenSubshells: hidden })
        },
        onValenceOnly: (v) => store.set({ valenceOnly: v }),
      })
    }
  }
  render()
  store.subscribe((_s, changed) => {
    if (changed.some((k) => ['Z', 'single', 'hiddenSubshells', 'valenceOnly'].includes(k))) render()
  })
}

function section(host: HTMLElement, title: string): HTMLElement {
  const sec = document.createElement('section')
  const h = document.createElement('h2')
  h.textContent = title
  const body = document.createElement('div')
  body.className = 'section-body'
  sec.append(h, body)
  host.appendChild(sec)
  return body
}
