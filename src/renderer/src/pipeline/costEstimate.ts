export type CostEstimate = {
  lowUSD: number
  highUSD: number
  shotCount: number
}

export function estimateCost(input: {
  durationSeconds: number
  sceneCount?: number
}): CostEstimate {
  const shotCount =
    input.sceneCount !== undefined && Number.isFinite(input.sceneCount)
      ? Math.max(1, Math.round(input.sceneCount))
      : Math.max(1, Math.round(input.durationSeconds / 3.5))
  const perShotLow = 4.5
  const perShotHigh = 7.5
  const flatLow = 0.5
  const flatHigh = 2
  const low = shotCount * perShotLow + flatLow
  const high = shotCount * perShotHigh + flatHigh
  return {
    lowUSD: Math.round(low),
    highUSD: Math.round(high),
    shotCount
  }
}
