import { Bodies, type Body } from "matter-js"

export const BALL_LABEL = "plinkit-ball"

export interface SpawnBallConfig {
  width: number
  height: number
  radius: number
}

function gaussianRandom(): number {
  const u1 = Math.random()
  const u2 = Math.random()
  return Math.sqrt(-2 * Math.log(u1 || 1e-15)) * Math.cos(2 * Math.PI * u2)
}

export function createBall(config: SpawnBallConfig, sigmaRatio?: number): Body {
  const spawnY = Math.max(config.radius + 8, config.height * 0.06)

  let j: number
  if (sigmaRatio && sigmaRatio > 0) {
    j = gaussianRandom() * config.width * sigmaRatio
  } else {
    j = (Math.random() - 0.5) * config.width * 0.08
  }

  return Bodies.circle(config.width * 0.5 + j, spawnY, config.radius, {
    label: BALL_LABEL,
    restitution: 0.65,
    frictionAir: 0.001,
    friction: 0.001,
    frictionStatic: 0,
  })
}
