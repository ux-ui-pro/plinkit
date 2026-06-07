import { RafLoop } from "./core/loop"
import { calculateViewportDimensions, deriveWorldMetrics, WORLD_WIDTH } from "./core/viewport"
import { PlinkitWorld, type WorldCollisionInfo, type WorldLayoutConfig } from "./core/world"
import { WebglRenderer } from "./render/webglRenderer"
import type {
  PlinkitCallbacks,
  PlinkitOptions,
  PlinkitStateSnapshot,
  SpawnResult,
  WorldSnapshot,
} from "./types"

const FIXED_STEP_MS = 1000 / 120
const MAX_DELTA_MS = 50
const MAX_STEPS_PER_FRAME = 8
const SPAWN_COOLDOWN_MS = 300

export class Plinkit {
  private readonly canvas: HTMLCanvasElement
  private readonly viewport: PlinkitOptions["viewport"]
  private readonly renderer: WebglRenderer
  private readonly world: PlinkitWorld
  private readonly loop: RafLoop
  private readonly worldHeight: number
  private readonly resizeObserver: ResizeObserver
  private dprQuery: MediaQueryList | null = null
  private readonly onDprChange: () => void
  private width: number
  private height: number
  private accumulatorMs = 0
  private lastFrameTime = 0
  private readonly callbacks: PlinkitCallbacks
  private ballCost: number
  private readonly showGuidePegs: boolean
  private balance: number
  private lastSpawnAtMs = -Infinity

  constructor(options: PlinkitOptions) {
    this.canvas = options.canvas
    this.viewport = options.viewport
    this.width = 1
    this.height = 1

    this.callbacks = {
      onBalanceChange: options.onBalanceChange,
      onBallSettled: options.onBallSettled,
      onCollision: options.onCollision,
    }
    this.ballCost = options.ballCost
    this.showGuidePegs = options.showGuidePegs
    this.balance = options.initialBalance
    this.onDprChange = () => this.listenDpr()

    const worldMetrics = deriveWorldMetrics({
      mainPegs: options.layout.mainPegs,
      ballRadius: options.ballRadius,
      heightPolicy: options.viewport.heightPolicy,
    })
    const layout: WorldLayoutConfig = {
      ...options.layout,
      mainPegs: worldMetrics.resolvedMainPegs,
    }
    this.worldHeight = worldMetrics.worldHeight

    this.canvas.style.maxWidth = "100%"
    this.renderer = new WebglRenderer(this.canvas, { appearance: options.appearance })
    this.world = new PlinkitWorld({
      width: WORLD_WIDTH,
      height: this.worldHeight,
      gravityY: options.gravityY,
      layout,
      ballRadius: options.ballRadius,
      multipliers: options.multipliers,
      ballCost: this.ballCost,
      houseEdge: options.houseEdge,
      onCollision: this.callbacks.onCollision ? (info) => this.handleCollision(info) : undefined,
    })
    this.resize()

    this.loop = new RafLoop((time) => this.frame(time))
    this.loop.start()

    const parent = this.canvas.parentElement
    if (!parent) {
      throw new Error("Canvas must have a parent element for viewport sizing")
    }
    this.resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const inlineSize = entry.contentBoxSize?.[0]?.inlineSize
      const parentWidth =
        inlineSize != null && inlineSize > 0 ? inlineSize : parent.getBoundingClientRect().width
      this.syncViewport(parentWidth)
    })
    this.resizeObserver.observe(parent)
    this.listenDpr()

    this.emitBalanceChange()
  }

  spawnBall(): SpawnResult {
    const now = performance.now()
    if (now - this.lastSpawnAtMs < SPAWN_COOLDOWN_MS) {
      return {
        ok: false,
        reason: "SPAWN_COOLDOWN",
        state: this.getStateSnapshot(),
      }
    }
    if (!this.world.canSpawnBall()) {
      return {
        ok: false,
        reason: "TOP_ZONE_LIMIT",
        state: this.getStateSnapshot(),
      }
    }

    if (this.balance < this.ballCost) {
      return {
        ok: false,
        reason: "INSUFFICIENT_BALANCE",
        state: this.getStateSnapshot(),
      }
    }

    this.balance -= this.ballCost
    this.lastSpawnAtMs = now
    this.emitBalanceChange()
    this.world.spawnBall()

    return {
      ok: true,
      state: this.getStateSnapshot(),
    }
  }

  resize(): void {
    const parent = this.canvas.parentElement
    if (!parent) return
    this.syncViewport(parent.getBoundingClientRect().width)
  }

  destroy(): void {
    this.loop.stop()
    this.resizeObserver.disconnect()
    this.dprQuery?.removeEventListener("change", this.onDprChange)
    this.dprQuery = null
    this.world.destroy()
    this.renderer.destroy()
  }

  getState(): PlinkitStateSnapshot {
    return this.getStateSnapshot()
  }

  setBallCost(value: number): void {
    if (!Number.isFinite(value) || value < 0) {
      throw new TypeError(
        `Plinkit.setBallCost: expected a non-negative finite number, got ${value}`,
      )
    }
    if (this.ballCost === value) return
    this.ballCost = value
    this.world.setBallCost(value)
    this.emitBalanceChange()
  }

  private handleCollision(info: WorldCollisionInfo): void {
    this.callbacks.onCollision?.(info, this.getStateSnapshot())
  }

  private frame(now: number): void {
    if (this.lastFrameTime === 0) {
      this.lastFrameTime = now
      this.renderSnapshot()
      return
    }

    const delta = Math.min(MAX_DELTA_MS, now - this.lastFrameTime)
    this.lastFrameTime = now
    this.accumulatorMs += delta

    let steps = 0
    while (this.accumulatorMs >= FIXED_STEP_MS && steps < MAX_STEPS_PER_FRAME) {
      const settlements = this.world.step(FIXED_STEP_MS)
      for (const settlement of settlements) {
        this.balance += settlement.payout
        const state = this.getStateSnapshot()
        this.callbacks.onBallSettled?.(settlement, state)
        this.callbacks.onBalanceChange?.(state)
      }
      this.accumulatorMs -= FIXED_STEP_MS
      steps += 1
    }

    this.renderSnapshot()
  }

  private renderSnapshot(): void {
    const snap: WorldSnapshot = this.world.snapshot()
    if (!this.showGuidePegs) snap.guidePegs = []
    this.renderer.render(snap)
  }

  private emitBalanceChange(): void {
    this.callbacks.onBalanceChange?.(this.getStateSnapshot())
  }

  private syncViewport(parentWidthPx: number): void {
    const dimensions = calculateViewportDimensions({
      parentWidthPx,
      viewport: this.viewport,
      worldHeight: this.worldHeight,
    })
    this.width = Math.max(1, dimensions.displayWidth)
    this.height = Math.max(1, dimensions.displayHeight)
    this.canvas.style.width = `${this.width}px`
    this.canvas.style.height = `${this.height}px`
    const dpr = Math.min(window.devicePixelRatio || 1, this.viewport.dprCap)
    this.renderer.resize(this.width, this.height, dpr, dimensions.worldScale)
  }

  private listenDpr(): void {
    this.dprQuery?.removeEventListener("change", this.onDprChange)
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
    mq.addEventListener("change", this.onDprChange)
    this.dprQuery = mq
    this.resize()
  }

  private getStateSnapshot(): PlinkitStateSnapshot {
    return {
      balance: this.balance,
      ballCost: this.ballCost,
    }
  }
}
