import './style.css'
import { App } from './app'
import { Store } from './state'
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
  const store = new Store()
  const worker = new Worker(new URL('./worker/orbital.worker.ts', import.meta.url), { type: 'module' })
  const side = createSidePanel(sideHost, store)
  const app = new App(viewport, store, worker, { sliceCanvas: side.sliceCanvas })
  app.onUpdate = (info) => side.onUpdate(info)
  app.scene.onContextLost = () => showFatal('The graphics context was lost. Reload the page to continue.')
  createControls(guiHost, store, {
    renderStill: () => console.info('Render still: not implemented yet'),
    resetCamera: () => app.scene.resetCamera(),
  })
  ;(window as unknown as { __app: App }).__app = app
} catch (e) {
  if (e instanceof WebGLUnavailableError) showFatal('This app needs WebGL 2, which your browser or GPU does not provide. Try Chrome or Firefox with hardware acceleration enabled.')
  else throw e
}
