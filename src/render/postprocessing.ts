import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

export type RenderMode = 'spheres' | 'glow' | 'iso'

export interface ComposerOptions {
  mode: RenderMode
  ao: boolean
  aoRadius: number
  aoIntensity: number
  bloom: boolean
  bloomStrength: number
  bloomRadius: number
  bloomThreshold: number
  width: number
  height: number
}

export interface ComposerBundle {
  composer: EffectComposer
  gtao?: GTAOPass
  bloom?: UnrealBloomPass
  output: OutputPass
  dispose(): void
}

/** Build the pass chain for a mode: RenderPass -> (GTAO | Bloom) -> OutputPass. */
export function buildComposer(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, o: ComposerOptions): ComposerBundle {
  const composer = new EffectComposer(renderer)
  composer.setSize(o.width, o.height)
  const renderPass = new RenderPass(scene, camera)
  composer.addPass(renderPass)
  let gtao: GTAOPass | undefined
  let bloom: UnrealBloomPass | undefined
  if (o.mode !== 'glow' && o.ao) {
    gtao = new GTAOPass(scene, camera, o.width, o.height)
    gtao.output = GTAOPass.OUTPUT.Default
    gtao.blendIntensity = o.aoIntensity
    gtao.updateGtaoMaterial({ radius: o.aoRadius, distanceExponent: 1, thickness: 1, scale: 1, samples: 16, distanceFallOff: 1, screenSpaceRadius: false })
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, radiusExponent: 1, rings: 2, samples: 16 })
    composer.addPass(gtao)
  }
  if (o.mode === 'glow' && o.bloom) {
    bloom = new UnrealBloomPass(new THREE.Vector2(o.width, o.height), o.bloomStrength, o.bloomRadius, o.bloomThreshold)
    composer.addPass(bloom)
  }
  const output = new OutputPass()
  composer.addPass(output)
  return {
    composer, gtao, bloom, output,
    dispose() {
      renderPass.dispose()
      gtao?.dispose()
      bloom?.dispose()
      output.dispose()
      composer.dispose()
    },
  }
}
