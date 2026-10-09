import type { Store } from '../state'

/** Keyboard shortcuts: 1/2/3 modes, R reset camera, S still, B Bohr, D theme, V valence only. */
export function installShortcuts(store: Store, actions: { renderStill: () => void; resetCamera: () => void }): () => void {
  const handler = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
    const s = store.state
    switch (e.key.toLowerCase()) {
      case '1': store.set({ mode: 'spheres' }); break
      case '2': store.set({ mode: 'glow' }); break
      case '3': store.set({ mode: 'iso' }); break
      case 'r': actions.resetCamera(); break
      case 's': actions.renderStill(); break
      case 'b': store.set({ bohr: !s.bohr }); break
      case 'd': store.set({ theme: s.theme === 'dark' ? 'light' : 'dark' }); break
      case 'v': store.set({ valenceOnly: !s.valenceOnly }); break
      case 'escape': document.body.classList.remove('side-open'); break
      default: return
    }
    e.preventDefault()
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}
