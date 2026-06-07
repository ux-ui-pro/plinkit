import { Bodies, Body, Composite, Engine, Events, World } from "matter-js"
import type {
  BallSettlement,
  BucketSnapshot,
  PlinkitCollisionInfo,
  PlinkitCollisionTarget,
  RectBody,
  WorldSnapshot,
} from "../types"
import { AntiStuckSystem } from "./anti-stuck"
import { getBallId, resolveBucketIndex } from "./buckets"
import { applyCenterBias, type ResolvedDistribution, resolveDistribution } from "./distribution"
import {
  buildEdgeGuidePegs,
  buildMainPegs,
  computePyramidGeometry,
  type EdgeGuideLayoutConfig,
  type PyramidBaseConfig,
  type PyramidGeometry,
} from "./layout"
import { BALL_LABEL, createBall } from "./spawn"

export interface WorldLayoutConfig {
  mainPegs: PyramidBaseConfig
  edgeGuides: EdgeGuideLayoutConfig & {
    radius: number
  }
}

export type WorldCollisionTarget = PlinkitCollisionTarget
export type WorldCollisionInfo = PlinkitCollisionInfo

export interface WorldConfig {
  width: number
  height: number
  gravityY: number
  layout: WorldLayoutConfig
  ballRadius: number
  multipliers: number[]
  ballCost: number
  houseEdge?: number
  onCollision?: (info: WorldCollisionInfo) => void
}

interface InternalBodies {
  leftWall: Body
  rightWall: Body
  floor: Body
}

const PEG_LABEL = "plinkit-peg"
const GUIDE_LABEL = "plinkit-guide"
const WALL_LABEL = "plinkit-wall"
const TOP_ZONE_HEIGHT_RATIO = 0.22
const TOP_ZONE_MAX_BALLS = 4

export class PlinkitWorld {
  private readonly engine: Engine
  private config: WorldConfig
  private pegs: Body[] = []
  private guidePegs: Body[] = []
  private walls: InternalBodies | null = null
  private buckets: BucketSnapshot[] = []
  private nextBallId = 1
  private pegBaseY = 0
  private center = 0
  private layoutGeometry: PyramidGeometry | null = null
  private readonly antiStuck = new AntiStuckSystem()
  private readonly dist: ResolvedDistribution
  private removeCollisionNudge: (() => void) | null = null
  private removeCollisionStart: (() => void) | null = null

  constructor(config: WorldConfig) {
    this.engine = Engine.create({
      gravity: { x: 0, y: config.gravityY, scale: 0.001 },
    })
    this.config = config
    this.dist = resolveDistribution(config.houseEdge ?? 0)
    this.rebuildStaticBodies(config.width, config.height)

    const nudge = this.dist.collisionNudge
    if (nudge > 0) {
      const handler = (event: Matter.IEventCollision<Engine>) => {
        const center = this.center
        const halfWidth = this.config.width * 0.5
        for (const pair of event.pairs) {
          const ball =
            pair.bodyA.label === BALL_LABEL
              ? pair.bodyA
              : pair.bodyB.label === BALL_LABEL
                ? pair.bodyB
                : null
          if (!ball || ball.plugin.settled) continue
          const isPeg =
            pair.bodyA.label === PEG_LABEL ||
            pair.bodyB.label === PEG_LABEL ||
            pair.bodyA.label === GUIDE_LABEL ||
            pair.bodyB.label === GUIDE_LABEL
          if (!isPeg) continue

          const t = (ball.position.x - center) / halfWidth
          Body.setVelocity(ball, {
            x: ball.velocity.x - nudge * t,
            y: ball.velocity.y,
          })
        }
      }
      Events.on(this.engine, "collisionEnd", handler)
      this.removeCollisionNudge = () => Events.off(this.engine, "collisionEnd", handler)
    }

    if (config.onCollision) {
      const onCollision = config.onCollision
      const handler = (event: Matter.IEventCollision<Engine>) => {
        for (const pair of event.pairs) {
          const ball =
            pair.bodyA.label === BALL_LABEL
              ? pair.bodyA
              : pair.bodyB.label === BALL_LABEL
                ? pair.bodyB
                : null
          if (!ball || ball.plugin.settled) continue
          const otherLabel = pair.bodyA === ball ? pair.bodyB.label : pair.bodyA.label
          let target: WorldCollisionTarget | null = null
          if (otherLabel === PEG_LABEL) target = "peg"
          else if (otherLabel === GUIDE_LABEL) target = "guide"
          if (!target) continue
          const speed = Math.hypot(ball.velocity.x, ball.velocity.y)
          onCollision({ ballId: getBallId(ball), target, speed })
        }
      }
      Events.on(this.engine, "collisionStart", handler)
      this.removeCollisionStart = () => Events.off(this.engine, "collisionStart", handler)
    }
  }

  resize(width: number, height: number): void {
    this.config = { ...this.config, width, height }
    this.rebuildStaticBodies(width, height)
  }

  setBallCost(value: number): void {
    this.config = { ...this.config, ballCost: value }
  }

  spawnBall(): void {
    const ball = createBall(
      {
        width: this.config.width,
        height: this.config.height,
        radius: this.config.ballRadius,
      },
      this.dist.spawnSigmaRatio,
    )
    ball.plugin.ballId = this.nextBallId
    // Фиксируем цену шарика на момент спавна, чтобы последующее изменение
    // ballCost не влияло на расчёт wager/payout уже летящих шариков.
    ball.plugin.wager = this.config.ballCost
    this.nextBallId += 1
    this.antiStuck.track(getBallId(ball), ball.position.x, ball.position.y)
    World.add(this.engine.world, ball)
  }

  canSpawnBall(): boolean {
    const topZoneY = this.config.height * TOP_ZONE_HEIGHT_RATIO
    let topZoneCount = 0
    const balls = Composite.allBodies(this.engine.world).filter((body) => body.label === BALL_LABEL)
    for (const ball of balls) {
      if (ball.plugin.settled) continue
      if (ball.position.y <= topZoneY) {
        topZoneCount += 1
        if (topZoneCount >= TOP_ZONE_MAX_BALLS) return false
      }
    }
    return true
  }

  step(deltaMs: number): BallSettlement[] {
    Engine.update(this.engine, deltaMs)
    const allBalls = Composite.allBodies(this.engine.world).filter((b) => b.label === BALL_LABEL)
    const activeBalls = allBalls.filter((b) => !b.plugin.settled)
    applyCenterBias(activeBalls, this.center, this.dist.windStrength)
    const forceSettleBalls = this.antiStuck.process(deltaMs, activeBalls, {
      center: this.center,
      halfWidth: this.config.width * 0.5,
      worldHeight: this.config.height,
    })
    const forceSettled = forceSettleBalls.map((ball) => this.settleBall(ball))
    const naturalSettled = this.cleanupBalls(allBalls)
    if (forceSettled.length > 0) return [...forceSettled, ...naturalSettled]
    return naturalSettled
  }

  snapshot(): WorldSnapshot {
    const mainPegRadius = this.config.layout.mainPegs.radius
    const pegs = this.pegs.map((peg) => ({
      x: peg.position.x,
      y: peg.position.y,
      radius: peg.circleRadius ?? mainPegRadius,
    }))

    const guidePegs = this.guidePegs.map((gp) => ({
      x: gp.position.x,
      y: gp.position.y,
      radius: gp.circleRadius ?? mainPegRadius,
    }))

    const balls = Composite.allBodies(this.engine.world)
      .filter((body) => body.label === BALL_LABEL)
      .map((ball) => ({
        id: getBallId(ball),
        x: ball.position.x,
        y: ball.position.y,
        radius: ball.circleRadius ?? this.config.ballRadius,
      }))

    return {
      pegs,
      guidePegs,
      balls,
      walls: this.getWallRects(),
      buckets: this.buckets,
    }
  }

  destroy(): void {
    this.removeCollisionNudge?.()
    this.removeCollisionStart?.()
    World.clear(this.engine.world, false)
    Engine.clear(this.engine)
  }

  private cleanupBalls(balls: Body[]): BallSettlement[] {
    const settled: BallSettlement[] = []
    const offScreen = this.config.height + this.config.ballRadius
    const bucketY = this.getBucketTop()

    for (const ball of balls) {
      if (ball.position.y > offScreen) {
        this.antiStuck.untrack(getBallId(ball))
        World.remove(this.engine.world, ball)
        continue
      }

      if (!ball.plugin.settled && ball.position.y >= bucketY) {
        settled.push(this.settleBall(ball))
        continue
      }

      const radius = ball.circleRadius ?? this.config.ballRadius
      const floorContactY = this.config.height - radius - 1
      if (!ball.plugin.settled && ball.position.y >= floorContactY) {
        settled.push(this.settleBall(ball))
      }
    }

    return settled
  }

  private rebuildStaticBodies(width: number, height: number): void {
    this.antiStuck.clear()
    if (this.pegs.length > 0) {
      World.remove(this.engine.world, this.pegs)
      this.pegs = []
    }

    if (this.guidePegs.length > 0) {
      World.remove(this.engine.world, this.guidePegs)
      this.guidePegs = []
    }

    if (this.walls) {
      World.remove(this.engine.world, [this.walls.leftWall, this.walls.rightWall, this.walls.floor])
      this.walls = null
    }

    this.center = width * 0.5

    const wallThickness = Math.max(18, width * 0.02)
    const bucketCount = this.config.multipliers.length
    const laneWidth = width / bucketCount
    const mainPegs = this.config.layout.mainPegs
    const geometry = computePyramidGeometry({
      ...mainPegs,
      width,
      height,
    })
    this.layoutGeometry = geometry
    const mainPegRadius = mainPegs.radius
    const edgeGuidePegRadius = this.config.layout.edgeGuides.radius

    this.pegs = buildMainPegs(geometry, mainPegRadius).map((peg) =>
      Bodies.circle(peg.x, peg.y, peg.radius, {
        isStatic: true,
        label: PEG_LABEL,
        restitution: 0.3,
      }),
    )
    this.pegBaseY = this.pegs.reduce((max, peg) => Math.max(max, peg.position.y), 0)
    const bucketTop = this.getBucketTop()

    const leftWall = Bodies.rectangle(
      -wallThickness * 0.5,
      height * 0.5,
      wallThickness,
      height * 2,
      {
        isStatic: true,
        label: WALL_LABEL,
        restitution: 0.4,
      },
    )
    const rightWall = Bodies.rectangle(
      width + wallThickness * 0.5,
      height * 0.5,
      wallThickness,
      height * 2,
      {
        isStatic: true,
        label: WALL_LABEL,
        restitution: 0.4,
      },
    )
    const floor = Bodies.rectangle(
      width * 0.5,
      height + wallThickness * 0.5,
      width,
      wallThickness,
      {
        isStatic: true,
        isSensor: true,
        label: WALL_LABEL,
      },
    )
    this.walls = { leftWall, rightWall, floor }
    World.add(this.engine.world, [leftWall, rightWall, floor])

    this.guidePegs = buildEdgeGuidePegs(geometry, edgeGuidePegRadius, {
      spread: this.config.layout.edgeGuides.spread,
      yOffset: this.config.layout.edgeGuides.yOffset,
    }).map((gp) =>
      Bodies.circle(gp.x, gp.y, gp.radius, {
        isStatic: true,
        label: GUIDE_LABEL,
        restitution: 0.3,
      }),
    )

    World.add(this.engine.world, this.pegs)
    World.add(this.engine.world, this.guidePegs)

    const bucketHeight = height - bucketTop
    this.buckets = this.config.multipliers.map((multiplier, index) => ({
      index,
      multiplier,
      x: laneWidth * index,
      y: bucketTop,
      width: laneWidth,
      height: bucketHeight,
    }))
  }

  private getWallRects(): RectBody[] {
    if (!this.walls) return []
    return [this.walls.leftWall, this.walls.rightWall, this.walls.floor].map((wall) => ({
      x: wall.position.x,
      y: wall.position.y,
      width: wall.bounds.max.x - wall.bounds.min.x,
      height: wall.bounds.max.y - wall.bounds.min.y,
    }))
  }

  private getBucketTop(): number {
    const mainPegs = this.config.layout.mainPegs
    const offset = mainPegs.radius + this.config.ballRadius - 1
    return this.pegBaseY > 0
      ? Math.min(this.config.height - 6, this.pegBaseY + offset)
      : this.config.height * 0.85
  }

  private settleBall(ball: Body): BallSettlement {
    ball.plugin.settled = true
    Body.set(ball, "isSensor", true)
    const geo = this.layoutGeometry
    const mainPegs = this.config.layout.mainPegs
    const sidePadding = geo?.sidePadding ?? mainPegs.radius + mainPegs.sidePaddingPx
    const baseSpacing =
      geo?.baseSpacing ??
      (this.config.width - sidePadding * 2) / Math.max(mainPegs.bottomPegCount - 1, 1)
    const bucketIndex = resolveBucketIndex(
      ball.position.x,
      sidePadding,
      baseSpacing,
      this.config.multipliers.length,
    )
    const multiplier = this.config.multipliers[bucketIndex] ?? 0
    const wager = typeof ball.plugin.wager === "number" ? ball.plugin.wager : this.config.ballCost
    return {
      ballId: getBallId(ball),
      bucketIndex,
      multiplier,
      wager,
      payout: wager * multiplier,
    }
  }
}
