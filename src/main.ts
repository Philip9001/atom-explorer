import './style.css'
import * as THREE from 'three'
import { SceneManager, WebGLUnavailableError } from './render/scene'

const viewport = document.querySelector<HTMLElement>('#viewport')!

function showFatal(message: string): void {
  const div = document.createElement('div')
  div.className = 'fatal'
  div.textContent = message
  viewport.appendChild(div)
}

try {
  const scene = new SceneManager(viewport)
  scene.onContextLost = () => showFatal('The graphics context was lost. Reload the page to continue.')
  const nucleus = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 16), new THREE.MeshStandardMaterial({ color: 0x333333 }))
  scene.content.add(nucleus)
  scene.fitCamera(1)
  scene.start()
  ;(window as unknown as { __scene: SceneManager }).__scene = scene
} catch (e) {
  if (e instanceof WebGLUnavailableError) showFatal('This app needs WebGL 2, which your browser or GPU does not provide. Try Chrome or Firefox with hardware acceleration enabled.')
  else throw e
}
