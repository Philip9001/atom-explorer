/** Wrap an async function so concurrent calls share the in-flight promise. */
export function singleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let current: Promise<T> | null = null
  return () => {
    if (current) return current
    current = fn().finally(() => { current = null })
    return current
  }
}
