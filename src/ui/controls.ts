import GUI from 'lil-gui'
import type { Store, AppState } from '../state'
import { MAX_N, clampOrbital } from '../physics/orbital'

/** lil-gui control panel bound to the store. Returns a function that syncs the panel from state. */
export function createControls(host: HTMLElement, store: Store, actions: { renderStill: () => void; resetCamera: () => void; memoryInfo: () => { geometries: number; textures: number } }): { gui: GUI; sync: () => void } {
  const gui = new GUI({ container: host, title: 'Atom Explorer', width: 270 })
  const s: AppState = { ...store.state }
  const bind = <K extends keyof AppState>(key: K) => (v: AppState[K]) => store.set({ [key]: v } as Partial<AppState>)

  const orbital = gui.addFolder('Orbital')
  orbital.add(s, 'single').name('Single orbital').onChange(bind('single'))
  const nCtl = orbital.add(s, 'n', 1, MAX_N, 1).onChange((n: number) => {
    const c = clampOrbital(n, s.l, s.m)
    store.set({ n: c.n, l: c.l, m: c.m })
  })
  const lCtl = orbital.add(s, 'l', 0, MAX_N - 1, 1).onChange((l: number) => {
    const c = clampOrbital(s.n, l, s.m)
    store.set({ l: c.l, m: c.m })
  })
  const mCtl = orbital.add(s, 'm', -(MAX_N - 1), MAX_N - 1, 1).onChange((m: number) => {
    store.set({ m: clampOrbital(s.n, s.l, m).m })
  })
  orbital.add(s, 'real').name('Real orbitals').onChange(bind('real'))

  const render = gui.addFolder('Render')
  render.add(s, 'mode', { 'Lit spheres': 'spheres', 'Glow cloud': 'glow', Isosurface: 'iso' }).name('Mode').onChange(bind('mode'))
  render.add(s, 'theme', { Light: 'light', Dark: 'dark' }).name('Theme').onChange(bind('theme'))
  render.add(s, 'exposure', 0.2, 3, 0.05).name('Exposure').onChange(bind('exposure'))

  const spheres = gui.addFolder('Spheres')
  spheres.add(s, 'sphereCount', 5000, 150000, 1000).name('Count').onChange(bind('sphereCount'))
  spheres.add(s, 'sphereRadius', 0.3, 3, 0.05).name('Sphere size').onChange(bind('sphereRadius'))
  spheres.add(s, 'ao').name('Ambient occlusion').onChange(bind('ao'))
  spheres.add(s, 'aoIntensity', 0, 3, 0.05).name('AO strength').onChange(bind('aoIntensity'))

  const glow = gui.addFolder('Glow')
  glow.add(s, 'glowCount', 100000, 500000, 10000).name('Points').onChange(bind('glowCount'))
  glow.add(s, 'pointSize', 0.3, 3, 0.05).name('Point size').onChange(bind('pointSize'))
  glow.add(s, 'colormap', ['inferno', 'magma', 'viridis']).name('Colormap').onChange(bind('colormap'))
  glow.add(s, 'gamma', 0.1, 1, 0.01).name('Gamma').onChange(bind('gamma'))
  glow.add(s, 'bloom').name('Bloom').onChange(bind('bloom'))
  glow.add(s, 'bloomStrength', 0, 2, 0.05).name('Bloom strength').onChange(bind('bloomStrength'))
  glow.add(s, 'bloomThreshold', 0, 1, 0.01).name('Bloom threshold').onChange(bind('bloomThreshold'))

  const iso = gui.addFolder('Isosurface')
  iso.add(s, 'isoFraction', 0.5, 0.99, 0.01).name('Enclosed probability').onChange(bind('isoFraction'))
  iso.add(s, 'gridSize', 48, 128, 16).name('Grid size').onChange(bind('gridSize'))

  const overlays = gui.addFolder('Overlays')
  overlays.add(s, 'showNucleus').name('Nucleus').onChange(bind('showNucleus'))
  overlays.add(s, 'showAxes').name('Axes').onChange(bind('showAxes'))
  overlays.add(s, 'showSlice').name('Slice plane').onChange(bind('showSlice'))
  overlays.add(s, 'showRadial').name('Radial plot').onChange(bind('showRadial'))
  overlays.add(s, 'bohr').name('Bohr view').onChange(bind('bohr'))
  overlays.add(s, 'valenceOnly').name('Valence only').onChange(bind('valenceOnly'))

  gui.add(actions, 'resetCamera').name('Reset camera (R)')
  gui.add(actions, 'renderStill').name('Render still (S)')
  const mem = { gpu: '' }
  const memCtl = gui.add(mem, 'gpu').name('GPU memory').disable()
  setInterval(() => {
    const m = actions.memoryInfo()
    mem.gpu = `${m.geometries} geometries, ${m.textures} textures`
    memCtl.updateDisplay()
  }, 1000)

  for (const f of [glow, iso, overlays]) f.close()

  const sync = () => {
    Object.assign(s, store.state)
    lCtl.max(s.n - 1)
    mCtl.min(-s.l).max(s.l)
    spheres.show(s.mode === 'spheres')
    glow.show(s.mode === 'glow')
    iso.show(s.mode === 'iso')
    nCtl.show(s.single); lCtl.show(s.single); mCtl.show(s.single)
    gui.controllersRecursive().forEach((c) => c.updateDisplay())
  }
  sync()
  store.subscribe(sync)
  if (window.innerWidth < 900) gui.close()
  return { gui, sync }
}
