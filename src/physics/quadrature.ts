/** Composite Simpson's rule on [a,b] with n (even) intervals. Numerical Recipes 4.1.4. */
export function simpson(f: (x: number) => number, a: number, b: number, n: number): number {
  if (n % 2 !== 0) n++
  const h = (b - a) / n
  let s = f(a) + f(b)
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 === 0 ? 2 : 4)
  return (s * h) / 3
}
