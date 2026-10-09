import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { buildComposer, type ComposerBundle, type ComposerOptions, type RenderMode } from './postprocessing'

export type Theme = 'light' | 'dark'

export class WebGLUnavailableError extends Error {}

export const BACKGROUNDS: Record<Theme | 'glow', number> = { light: 0xf4f4f6, dark: 0x0b0b0e, glow: 0x000000 }

function createRenderer(container: HTMLElement): THREE.WebGLRenderer {
  if (typeof WebGL2RenderingContext === 'undefined') throw new WebGLUnavailableError('WebGL 2 is not available')
  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.toneMapping = THREE.NoToneMapping
    renderer.toneMappingExposure = 1
    container.appendChild(renderer.domElement)
    return renderer
  } catch (e) {
    throw new WebGLUnavailableError((e as Error).message)
  }
}

/** Owns renderer, camera, controls, lights, fog and the post-processing chain. */
export class SceneManager {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly controls: OrbitControls
  /** All orbital content goes here so it can be cleared/toggled as one. */
  readonly content = new THREE.Group()
  readonly container: HTMLElement

  private bundle: ComposerBundle
  private opts: ComposerOptions
  private theme: Theme = 'light'
  private fitRadius = 10
  private lastInteraction = 0
  private aoHalfRes = false
  private raf = 0
  private resizeObserver: ResizeObserver
  onContextLost?: () => void

  constructor(container: HTMLElement) {
    this.container = container
    this.renderer = createRenderer(container)
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      this.stop()
      this.onContextLost?.()
    })
    this.camera = new THREE.PerspectiveCamera(40, this.aspect(), 0.01, 1000)
    this.camera.up.set(0, 0, 1) // orbital symmetry axis (z) is vertical, as in textbook figures
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.12
    this.controls.addEventListener('change', () => { this.lastInteraction = performance.now() })

    // Lighting per spec: hemisphere sky/ground plus one soft key light from upper-left, no shadows.
    const hemi = new THREE.HemisphereLight(0xffffff, 0xd8d8dc, 1.2)
    const key = new THREE.DirectionalLight(0xffffff, 1.4)
    key.position.set(-3, 5, 4)
    this.scene.add(hemi, key, this.content)

    this.opts = {
      mode: 'spheres', ao: true, aoRadius: 0.5, aoIntensity: 1,
      bloom: true, bloomStrength: 0.6, bloomRadius: 0.4, bloomThreshold: 0.6,
      width: container.clientWidth, height: container.clientHeight,
    }
    this.bundle = buildComposer(this.renderer, this.scene, this.camera, this.opts)
    this.setTheme('light')
    this.fitCamera(10)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
  }

  private aspect(): number { return Math.max(1e-3, this.container.clientWidth / Math.max(1, this.container.clientHeight)) }

  get mode(): RenderMode { return this.opts.mode }

  private rebuildComposer(): void {
    this.bundle.dispose()
    this.bundle = buildComposer(this.renderer, this.scene, this.camera, this.opts)
    this.aoHalfRes = false
  }

  setMode(mode: RenderMode): void {
    if (this.opts.mode === mode) return
    this.opts.mode = mode
    // Glow mode relies on filmic tone mapping to roll off additive highlights; flat colors elsewhere.
    this.renderer.toneMapping = mode === 'glow' ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping
    this.rebuildComposer()
    this.applyBackground()
  }

  setTheme(theme: Theme): void {
    this.theme = theme
    document.documentElement.dataset.theme = theme
    this.applyBackground()
  }

  private applyBackground(): void {
    const color = new THREE.Color(this.opts.mode === 'glow' ? BACKGROUNDS.glow : BACKGROUNDS[this.theme])
    this.scene.background = color
    this.scene.fog = new THREE.Fog(color, this.fitRadius * 3.5, this.fitRadius * 7)
  }

  setAO(enabled: boolean): void {
    if (this.opts.ao === enabled) return
    this.opts.ao = enabled
    this.rebuildComposer()
  }

  setAOParams(p: { radius?: number; intensity?: number }): void {
    if (p.radius !== undefined) this.opts.aoRadius = p.radius
    if (p.intensity !== undefined) this.opts.aoIntensity = p.intensity
    if (this.bundle.gtao) {
      this.bundle.gtao.updateGtaoMaterial({ radius: this.opts.aoRadius })
      this.bundle.gtao.blendIntensity = this.opts.aoIntensity
    }
  }

  setBloom(p: { enabled?: boolean; strength?: number; threshold?: number; radius?: number }): void {
    const needRebuild = p.enabled !== undefined && p.enabled !== this.opts.bloom
    if (p.enabled !== undefined) this.opts.bloom = p.enabled
    if (p.strength !== undefined) this.opts.bloomStrength = p.strength
    if (p.threshold !== undefined) this.opts.bloomThreshold = p.threshold
    if (p.radius !== undefined) this.opts.bloomRadius = p.radius
    if (needRebuild) this.rebuildComposer()
    else if (this.bundle.bloom) {
      this.bundle.bloom.strength = this.opts.bloomStrength
      this.bundle.bloom.threshold = this.opts.bloomThreshold
      this.bundle.bloom.radius = this.opts.bloomRadius
    }
  }

  setExposure(v: number): void { this.renderer.toneMappingExposure = v }

  /** Place the camera to frame a sphere of `radius` about the origin. */
  fitCamera(radius: number): void {
    this.fitRadius = radius
    this.camera.near = radius * 0.01
    this.camera.far = radius * 20
    this.camera.updateProjectionMatrix()
    this.controls.minDistance = radius * 0.2
    this.controls.maxDistance = radius * 8
    this.resetCamera()
    this.applyBackground()
  }

  resetCamera(): void {
    const d = this.fitRadius * 4.2
    this.camera.position.set(d * 0.72, d * 0.5, d * 0.48)
    this.controls.target.set(0, 0, 0)
    this.controls.update()
  }

  resize(): void {
    const w = this.container.clientWidth, h = this.container.clientHeight
    if (w === 0 || h === 0) return
    this.opts.width = w
    this.opts.height = h
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.bundle.composer.setSize(w, h)
    this.bundle.gtao?.setSize(w, h)
    this.bundle.bloom?.setSize(w, h)
    this.aoHalfRes = false
  }

  renderOnce(): void {
    this.bundle.composer.render()
  }

  private frame = (): void => {
    this.controls.update()
    const gtao = this.bundle.gtao
    if (gtao) {
      // Half-resolution AO while the user is orbiting, full quality when idle.
      const moving = performance.now() - this.lastInteraction < 150
      if (moving !== this.aoHalfRes) {
        this.aoHalfRes = moving
        const s = moving ? 0.5 : 1
        gtao.setSize(Math.max(1, Math.floor(this.opts.width * s)), Math.max(1, Math.floor(this.opts.height * s)))
      }
    }
    this.renderOnce()
    this.raf = requestAnimationFrame(this.frame)
  }

  start(): void { if (!this.raf) this.raf = requestAnimationFrame(this.frame) }
  stop(): void { cancelAnimationFrame(this.raf); this.raf = 0 }

  memoryInfo(): { geometries: number; textures: number } {
    const m = this.renderer.info.memory
    return { geometries: m.geometries, textures: m.textures }
  }

  dispose(): void {
    this.stop()
    this.resizeObserver.disconnect()
    this.controls.dispose()
    this.bundle.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
