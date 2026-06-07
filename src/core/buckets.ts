import type { Body } from "matter-js"

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

export function getBallId(body: Body): number {
  const id = body.plugin.ballId
  if (typeof id === "number") return id
  return body.id
}

export function resolveBucketIndex(
  x: number,
  sidePadding: number,
  baseSpacing: number,
  bucketCount: number,
): number {
  const raw = Math.floor((x - sidePadding) / baseSpacing)
  return clamp(raw, 0, bucketCount - 1)
}
