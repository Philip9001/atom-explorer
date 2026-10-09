import { BokehPass } from 'three/addons/postprocessing/BokehPass.js'
import type { SceneManager } from './scene'

export interface StillOptions {
  /** Multiplier on the device pixel ratio (capped at 4). */
  scale: number
  /** Extra AO blend intensity for the still. */
  aoIntensity: number
  /** Depth of field via BokehPass. */
  dof: boolean
}

/**
 * Render one high-quality frame to a PNG blob: higher pixel ratio, stronger AO,
 * optional depth of field. The caller is responsible for raising the sample count
 * before and restoring it after. Everything touched here is restored.
 */
export async function renderStillBlob(scene: SceneManager, o: StillOptions): Promise<Blob> {
  const renderer = scene.renderer
  const prevRatio = renderer.getPixelRatio()
  const prevAO = scene.aoIntensity
  const ratio = Math.min(4, prevRatio * o.scale)
  scene.stop()
  let bokeh: BokehPass | undefined
  try {
    renderer.setPixelRatio(ratio)
    scene.resize()
    scene.setAOParams({ intensity: o.aoIntensity })
    if (o.dof) {
      const focus = scene.camera.position.length()
      bokeh = new BokehPass(scene.scene, scene.camera, { focus, aperture: 0.4 / (focus * focus), maxblur: 0.008 })
      scene.insertPassBeforeOutput(bokeh)
    }
    scene.renderOnce()
    const blob = await new Promise<Blob | null>((resolve) => renderer.domElement.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('Could not encode the PNG')
    return blob
  } finally {
    if (bokeh) { scene.removePass(bokeh); bokeh.dispose() }
    scene.setAOParams({ intensity: prevAO })
    renderer.setPixelRatio(prevRatio)
    scene.resize()
    scene.start()
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

