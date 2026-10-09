import { ELEMENTS, periodicTableCell, type Element } from '../physics/elements'

/** 18-column periodic table of the supported elements; each cell is a button. */
export function renderPeriodicTable(host: HTMLElement, onPick: (Z: number) => void): { markSelected: (Z: number | null) => void } {
  const table = document.createElement('div')
  table.className = 'ptable'
  table.setAttribute('role', 'listbox')
  table.setAttribute('aria-label', 'Periodic table')
  const buttons = new Map<number, HTMLButtonElement>()
  for (const e of ELEMENTS) buttons.set(e.Z, cell(e, table, onPick))
  host.appendChild(table)
  return {
    markSelected(Z) {
      for (const [z, b] of buttons) {
        b.classList.toggle('selected', z === Z)
        b.setAttribute('aria-selected', String(z === Z))
      }
    },
  }
}

function cell(e: Element, table: HTMLElement, onPick: (Z: number) => void): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = `pcell block-${e.block}`
  b.dataset.z = String(e.Z)
  b.title = `${e.name} (Z = ${e.Z})`
  const cell = periodicTableCell(e)
  b.style.gridColumn = String(cell.col)
  b.style.gridRow = String(cell.row)
  b.innerHTML = `<span class="z">${e.Z}</span><span class="sym">${e.symbol}</span>`
  b.addEventListener('click', () => onPick(e.Z))
  table.appendChild(b)
  return b
}
