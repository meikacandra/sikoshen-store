/** Mulberry32: hasil yang sama untuk setiap seed. */
export function seededRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0
    let value = Math.imul(seed ^ (seed >>> 15), seed | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

/** Bagikan unit bulat sambil mempertahankan jumlah awal. */
export function allocateUnits(total: number, weights: readonly number[]): number[] {
  if (total === 0) return weights.map(() => 0)

  const sum = weights.reduce((a, b) => a + b, 0)
  const shares = weights.map((weight, i) => {
    const exact = (total * weight) / sum
    const units = Math.floor(exact)
    return { i, units, remainder: exact - units }
  })
  const remaining = total - shares.reduce((a, share) => a + share.units, 0)
  const result = shares.map((share) => share.units)
  shares.sort((a, b) => b.remainder - a.remainder || a.i - b.i)
  for (const { i } of shares.slice(0, remaining)) result[i] += 1
  return result
}
