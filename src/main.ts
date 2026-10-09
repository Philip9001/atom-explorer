import './style.css'
import * as THREE from 'three'
import { SceneManager, WebGLUnavailableError } from './render/scene'
import { SphereCloud } from './render/sphereCloud'
import { phaseShades } from './render/colors'
import { OrbitalWorkerClient } from './worker/client'
import { DEFAULTS } from './render/defaults'

const viewport = document.querySelector<HTMLElement>('#viewport')!

function showFatal(message: string): void {
  const div = document.createElement('div')
  div.className = 'fatal'
  div.textContent = message
  viewport.appendChild(div)
}

/** Radius containing `q` of the sampled points: a better framing size than the extent box. */
function percentileRadius(positions: Float32Array, q: number): number {
  const n = positions.length / 3
  const radii = new Float32Array(n)
  for (let i = 0; i < n; i++) radii[i] = Math.hypot(positions[3 * i], positions[3 * i + 1], positions[3 * i + 2])
  radii.sort()
  return radii[Math.min(n - 1, Math.floor(q * n))]
}

async function boot(): Promise<void> {
  const scene = new SceneManager(viewport)
  scene.onContextLost = () => showFatal('The graphics context was lost. Reload the page to continue.')
  const worker = new Worker(new URL('./worker/orbital.worker.ts', import.meta.url), { type: 'module' })
  const client = new OrbitalWorkerClient(worker)
  const cloud = new SphereCloud(150000)
  scene.content.add(cloud.mesh)
  const nucleus = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshStandardMaterial({ color: 0x333333 }))
  scene.content.add(nucleus)
  scene.start()
  ;(window as unknown as { __scene: SceneManager }).__scene = scene

  const orbital = { n: 3, l: 2, m: 0, Z: 1, real: true }
  const { pos, neg } = phaseShades('#2a9d8f')
  const t0 = performance.now()
  let fitR = 1
  for (const count of [5000, 50000]) {
    const r = await client.sample(orbital, count, 1)
    if (count === 5000) fitR = percentileRadius(r.positions, 0.95)
    const radius = DEFAULTS.sphereRadiusFactor * fitR
    cloud.update(r.positions, r.psi, pos, neg, radius)
    nucleus.scale.setScalar(radius * 1.5)
    if (count === 5000) {
      scene.fitCamera(fitR)
      scene.setAOParams({ radius: DEFAULTS.aoRadiusFactor * radius, intensity: DEFAULTS.aoIntensity })
    }
    console.log(`N=${count} ready at ${(performance.now() - t0).toFixed(0)} ms`)
  }
}

try {
  boot().catch((e) => showFatal(String(e)))
} catch (e) {
  if (e instanceof WebGLUnavailableError) showFatal('This app needs WebGL 2, which your browser or GPU does not provide. Try Chrome or Firefox with hardware acceleration enabled.')
  else throw e
}
