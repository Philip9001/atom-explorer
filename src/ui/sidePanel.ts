import type { Store } from '../state'
import { elementSubshells } from '../physics/elementOrbitals'
import { renderPeriodicTable } from './periodicTable'
import { renderSubshellList } from './subshellList'
import { renderInfoPanel } from './infoPanel'
import { drawRadialPlot, type RadialSeries } from './radialPlot'
import { orbitalLabel } from '../physics/orbital'
import { subshellColor, SINGLE_COLOR, visibleSubshells, type OrbitalPart } from '../parts'

export interface SidePanel {
  sliceCanvas: HTMLCanvasElement
  /** Hook for App.onUpdate. */
  onUpdate(info: { parts: OrbitalPart[]; fitRadius: number }): void
}

/** Right-hand panel: periodic table, info, subshell list, radial plot, slice inset. */
export function createSidePanel(host: HTMLElement, store: Store): SidePanel {
  const tableHost = section(host, 'Elements')
  const infoHost = section(host, 'Info')
  const listHost = section(host, 'Subshells')
  const radialHost = section(host, 'Radial distribution r²R²')
  const sliceHost = section(host, 'Slice through the x–z plane')
  const radialCanvas = document.createElement('canvas')
  radialCanvas.className = 'plot'
  radialHost.appendChild(radialCanvas)
  const sliceCanvas = document.createElement('canvas')
  sliceCanvas.className = 'slice'
  sliceHost.appendChild(sliceCanvas)
  const table = renderPeriodicTable(tableHost, (Z) => store.set({ Z, single: false, hiddenSubshells: [] }))
  infoHost.id = 'info'
  let fitRadius = 1
  const drawRadial = () => {
    const s = store.state
    if (!s.showRadial) return
    const series: RadialSeries[] = s.single
      ? [{ n: s.n, l: s.l, Z: 1, scale: 1, color: SINGLE_COLOR, label: orbitalLabel({ n: s.n, l: s.l, m: s.m, real: s.real }) }]
      : visibleSubshells(s).map((sub) => ({ n: sub.n, l: sub.l, Z: sub.Zeff, scale: sub.electrons, color: subshellColor(visibleSubshells({ ...s, valenceOnly: false, hiddenSubshells: [] }), sub.key), label: sub.key }))
    drawRadialPlot(radialCanvas, series, fitRadius * 1.3, s.theme === 'dark')
  }
  const render = () => {
    const s = store.state
    table.markSelected(s.single ? null : s.Z)
    renderInfoPanel(infoHost, s, { fitRadius })
    radialHost.parentElement!.hidden = !s.showRadial
    sliceHost.parentElement!.hidden = !s.showSlice
    drawRadial()
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
    if (changed.some((k) => ['Z', 'single', 'n', 'l', 'm', 'real', 'hiddenSubshells', 'valenceOnly', 'showRadial', 'showSlice', 'theme'].includes(k))) render()
  })
  window.addEventListener('resize', drawRadial)
  return {
    sliceCanvas,
    onUpdate(info) {
      fitRadius = info.fitRadius
      renderInfoPanel(infoHost, store.state, { fitRadius })
      drawRadial()
    },
  }
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
