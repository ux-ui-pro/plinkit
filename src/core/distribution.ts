import { Body } from "matter-js"

export interface ResolvedDistribution {
  windStrength: number
  collisionNudge: number
  spawnSigmaRatio: number
}

export function resolveDistribution(houseEdge: number): ResolvedDistribution {
  const input = Math.max(0, Math.min(1, houseEdge))
  const t = input ** 1.3
  return {
    windStrength: t * 4e-7,
    collisionNudge: t * 0.13,
    spawnSigmaRatio: input > 0 ? 0.04 - t * 0.035 : 0,
  }
}

const CENTER_BIAS_MIN_SPEED = 0.4

export function applyCenterBias(activeBalls: Body[], center: number, windStrength: number): void {
  if (windStrength <= 0) return
  for (const ball of activeBalls) {
    const speed = Math.sqrt(ball.velocity.x * ball.velocity.x + ball.velocity.y * ball.velocity.y)
    if (speed < CENTER_BIAS_MIN_SPEED) continue
    const dx = ball.position.x - center
    Body.applyForce(ball, ball.position, { x: -windStrength * dx, y: 0 })
  }
}
