export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`
  }
  if (km < 100) {
    return `${km.toFixed(1)} km`
  }
  return `${km.toLocaleString()} km`
}

export function formatScore(score: number): string {
  return score.toLocaleString()
}

export function formatYear(year: number): string {
  if (year < 0) {
    return `${Math.abs(year)} BC`
  } else if (year < 1000) {
    return `${year} AD`
  }
  return String(year)
}

export function formatYearDiff(diff: number): string {
  if (diff === 0) return 'Exact!'
  return `${diff} year${diff === 1 ? '' : 's'}`
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
