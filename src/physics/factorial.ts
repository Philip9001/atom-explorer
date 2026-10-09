const TABLE: number[] = [1]
for (let i = 1; i <= 20; i++) TABLE[i] = TABLE[i - 1] * i

/** n! for 0 <= n <= 20 (exact in double precision up to 18!, adequate for n+l <= 13 here). */
export function factorial(n: number): number {
  if (n < 0 || n > 20 || !Number.isInteger(n)) throw new RangeError(`factorial(${n})`)
  return TABLE[n]
}
