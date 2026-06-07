export interface PlinkitMainPegsOptions {
  radius: number
  topPegCount: number
  bottomPegCount: number
  verticalStepRatio: number
  sidePaddingPx: number
}

export interface PlinkitEdgeGuidesOptions {
  radius: number
  spread: number
  yOffset: number
}

export interface PlinkitLayoutOptions {
  mainPegs: PlinkitMainPegsOptions
  edgeGuides: PlinkitEdgeGuidesOptions
}

/** Высота мира всегда выводится из геометрии пирамиды и этих отступов (px в координатах мира). */
export interface PlinkitViewportHeightPolicy {
  topPaddingPx: number
  bottomPaddingPx: number
}

/** Ширина холста подстраивается под родительский контейнер (ResizeObserver). */
export interface PlinkitViewportOptions {
  dprCap: number
  heightPolicy: PlinkitViewportHeightPolicy
}

export interface PlinkitAppearanceOptions {
  /** URL растровой текстуры для обычных и guide-пегов. */
  pegTextureUrl?: string
  /** URL растровой текстуры для шариков. */
  ballTextureUrl?: string
  /**
   * Значение для `HTMLImageElement.crossOrigin` при загрузке URL-текстур.
   * Для ресурсов с CORS (другой домен) укажите `"anonymous"`. Не задавайте, если
   * изображения строго same-origin и не требуют CORS.
   */
  textureCrossOrigin?: string | null
}

export type PlinkitCollisionTarget = "peg" | "guide"

export interface PlinkitCollisionInfo {
  ballId: number
  target: PlinkitCollisionTarget
  speed: number
}

export interface PlinkitOptions {
  canvas: HTMLCanvasElement
  viewport: PlinkitViewportOptions
  gravityY: number
  ballRadius: number
  layout: PlinkitLayoutOptions
  multipliers: number[]
  initialBalance: number
  ballCost: number
  showGuidePegs: boolean
  houseEdge?: number
  appearance?: PlinkitAppearanceOptions
  onBalanceChange?: (state: PlinkitStateSnapshot) => void
  onBallSettled?: (settlement: BallSettlement, state: PlinkitStateSnapshot) => void
  onCollision?: (collision: PlinkitCollisionInfo, state: PlinkitStateSnapshot) => void
}

export interface Peg {
  x: number
  y: number
  radius: number
}

export interface RectBody {
  x: number
  y: number
  width: number
  height: number
}

export interface BallSnapshot {
  id: number
  x: number
  y: number
  radius: number
}

export interface BucketSnapshot {
  index: number
  multiplier: number
  x: number
  y: number
  width: number
  height: number
}

export interface BallSettlement {
  ballId: number
  bucketIndex: number
  multiplier: number
  wager: number
  payout: number
}

export interface WorldSnapshot {
  pegs: Peg[]
  guidePegs: Peg[]
  balls: BallSnapshot[]
  walls: RectBody[]
  buckets: BucketSnapshot[]
}

export interface PlinkitStateSnapshot {
  balance: number
  ballCost: number
}

export interface PlinkitCallbacks {
  onBalanceChange?: (state: PlinkitStateSnapshot) => void
  onBallSettled?: (settlement: BallSettlement, state: PlinkitStateSnapshot) => void
  onCollision?: (collision: PlinkitCollisionInfo, state: PlinkitStateSnapshot) => void
}

export interface SpawnResult {
  ok: boolean
  reason?: "INSUFFICIENT_BALANCE" | "SPAWN_COOLDOWN" | "TOP_ZONE_LIMIT"
  state: PlinkitStateSnapshot
}
