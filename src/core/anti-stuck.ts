import { Body } from "matter-js"
import { getBallId } from "./buckets"

const ANTI_STUCK_MIN_SPEED = 0.18
const ANTI_STUCK_MIN_MOVE = 0.12
const ANTI_STUCK_MIN_TIME_MS = 420
const ANTI_STUCK_MIN_Y_RATIO = 0.12
const ANTI_STUCK_KICK_COOLDOWN_MS = 180
const ANTI_STUCK_MAX_KICKS_PER_STEP = 2
const ANTI_STUCK_MAX_KICKS = 5
const ANTI_STUCK_STALL_WINDOW_MS = 600
const ANTI_STUCK_MIN_Y_PROGRESS = 2
const BALL_MAX_ALIVE_MS = 25_000
const CENTER_ZONE_RATIO = 0.15

interface StuckState {
  x: number
  y: number
  stuckMs: number
  kickCooldownMs: number
  kickCount: number
  anchorY: number
  anchorAgeMs: number
  aliveMs: number
}

function createStuckState(x: number, y: number): StuckState {
  return {
    x,
    y,
    stuckMs: 0,
    kickCooldownMs: 0,
    kickCount: 0,
    anchorY: y,
    anchorAgeMs: 0,
    aliveMs: 0,
  }
}

export interface AntiStuckContext {
  center: number
  halfWidth: number
  worldHeight: number
}

/**
 * Detects balls that are stuck (oscillating, wedged between pegs, or alive too long)
 * and either kicks them free or signals they should be force-settled.
 */
export class AntiStuckSystem {
  private readonly tracker = new Map<number, StuckState>()

  track(ballId: number, x: number, y: number): void {
    this.tracker.set(ballId, createStuckState(x, y))
  }

  untrack(ballId: number): void {
    this.tracker.delete(ballId)
  }

  clear(): void {
    this.tracker.clear()
  }

  /**
   * Returns bodies that should be force-settled (exceeded max alive time or kick limit).
   * Applies velocity kicks to balls that appear stuck but haven't hit their limit yet.
   */
  process(deltaMs: number, activeBalls: Body[], ctx: AntiStuckContext): Body[] {
    const forceSettle: Body[] = []
    const aliveIds = new Set<number>()
    const candidates: Array<{ ball: Body; id: number; stuckMs: number }> = []

    for (const ball of activeBalls) {
      const ballId = getBallId(ball)
      aliveIds.add(ballId)
      const prev = this.tracker.get(ballId) ?? createStuckState(ball.position.x, ball.position.y)

      const aliveMs = prev.aliveMs + deltaMs

      if (aliveMs >= BALL_MAX_ALIVE_MS || prev.kickCount >= ANTI_STUCK_MAX_KICKS) {
        forceSettle.push(ball)
        this.tracker.delete(ballId)
        continue
      }

      const dx = ball.position.x - prev.x
      const dy = ball.position.y - prev.y
      const move = Math.sqrt(dx * dx + dy * dy)
      const velocity = ball.velocity
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y)
      const inActiveField = ball.position.y > ctx.worldHeight * ANTI_STUCK_MIN_Y_RATIO

      let anchorY = prev.anchorY
      let anchorAgeMs = prev.anchorAgeMs + deltaMs
      if (ball.position.y > anchorY + ANTI_STUCK_MIN_Y_PROGRESS) {
        anchorY = ball.position.y
        anchorAgeMs = 0
      }
      const stalled = anchorAgeMs > ANTI_STUCK_STALL_WINDOW_MS

      const looksStuck =
        inActiveField && ((speed < ANTI_STUCK_MIN_SPEED && move < ANTI_STUCK_MIN_MOVE) || stalled)
      const stuckMs = looksStuck ? prev.stuckMs + deltaMs : Math.max(0, prev.stuckMs - deltaMs * 2)

      const kickCooldownMs = Math.max(0, prev.kickCooldownMs - deltaMs)
      this.tracker.set(ballId, {
        x: ball.position.x,
        y: ball.position.y,
        stuckMs,
        kickCooldownMs,
        kickCount: prev.kickCount,
        anchorY,
        anchorAgeMs,
        aliveMs,
      })

      if (stuckMs >= ANTI_STUCK_MIN_TIME_MS && kickCooldownMs <= 0) {
        candidates.push({ ball, id: ballId, stuckMs })
      }
    }

    this.applyKicks(candidates, ctx)

    for (const trackedId of this.tracker.keys()) {
      if (!aliveIds.has(trackedId)) this.tracker.delete(trackedId)
    }

    return forceSettle
  }

  private applyKicks(
    candidates: Array<{ ball: Body; id: number; stuckMs: number }>,
    ctx: AntiStuckContext,
  ): void {
    if (candidates.length === 0) return

    candidates.sort((a, b) => {
      if (Math.abs(b.ball.position.y - a.ball.position.y) > 0.1) {
        return b.ball.position.y - a.ball.position.y
      }
      return b.stuckMs - a.stuckMs
    })

    const kickCount = Math.min(ANTI_STUCK_MAX_KICKS_PER_STEP, candidates.length)
    for (let i = 0; i < kickCount; i++) {
      const { ball, id } = candidates[i]
      const prev = this.tracker.get(id)
      if (!prev) continue
      const vel = ball.velocity

      const distFromCenter = Math.abs(ball.position.x - ctx.center) / ctx.halfWidth
      const kickDir =
        distFromCenter < CENTER_ZONE_RATIO
          ? Math.random() < 0.5
            ? 1
            : -1
          : ball.position.x < ctx.center
            ? 1
            : -1

      const sideKick = kickDir * (0.35 + Math.random() * 0.35) + (Math.random() - 0.5) * 0.25
      const downKick = 1.1 + Math.random() * 0.5

      Body.setVelocity(ball, {
        x: vel.x + sideKick,
        y: Math.max(vel.y + downKick, downKick),
      })
      Body.translate(ball, {
        x: kickDir * (0.2 + Math.random() * 0.4),
        y: 0.25 + Math.random() * 0.35,
      })

      this.tracker.set(id, {
        ...prev,
        x: ball.position.x,
        y: ball.position.y,
        stuckMs: 0,
        kickCooldownMs: ANTI_STUCK_KICK_COOLDOWN_MS,
        kickCount: prev.kickCount + 1,
      })
    }
  }
}
