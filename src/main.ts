import './style.css'
import { App } from './app'
import { Store, DEFAULT_STATE } from './state'
import { stateFromSearch, searchFromState } from './ui/urlState'
import { installShortcuts } from './ui/shortcuts'
import { WebGLUnavailableError } from './render/scene'
import { createControls } from './ui/controls'
import { createSidePanel } from './ui/sidePanel'

const viewport = document.querySelector<HTMLElement>('#viewport')!
const guiHost = document.querySelector<HTMLElement>('#gui')!
const sideHost = document.querySelector<HTMLElement>('#side')!

function showFatal(message: string): void {
  const div = document.createElement('div')
  div.className = 'fatal'
  div.textContent = message
  viewport.appendChild(div)
}

try {
  const store = new Store(stateFromSearch(location.search, DEFAULT_STATE))
  const worker = new Worker(new URL('./worker/orbital.worker.ts', import.meta.url), { type: 'module' })
  const side = createSidePanel(sideHost, store)
  const app = new App(viewport, store, worker, { sliceCanvas: side.sliceCanvas })
  app.onUpdate = (info) => side.onUpdate(info)
  app.scene.onContextLost = () => showFatal('The graphics context was lost. Reload the page to continue.')
  app.client.onError = (m) => showFatal(`The orbital worker failed (${m}). Reload the page to continue.`)
  const actions = {
    renderStill: () => { void app.renderStill({ dof: store.state.mode !== 'glow' }).catch((e) => console.error(e)) },
    resetCamera: () => app.scene.resetCamera(),
    memoryInfo: () => app.scene.memoryInfo(),
  }
  createControls(guiHost, store, actions)
  installShortcuts(store, actions)
  let urlTimer = 0
  store.subscribe((s) => {
    clearTimeout(urlTimer)
    urlTimer = window.setTimeout(() => history.replaceState(null, '', `${location.pathname}${searchFromState(s)}`), 300)
  })
  ;(window as unknown as { __app: App }).__app = app
} catch (e) {
  if (e instanceof WebGLUnavailableError) showFatal('This app needs WebGL 2, which your browser or GPU does not provide. Try Chrome or Firefox with hardware acceleration enabled.')
  else throw e
}
