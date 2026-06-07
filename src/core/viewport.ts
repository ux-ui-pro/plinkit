import type {
  PlinkitMainPegsOptions,
  PlinkitViewportHeightPolicy,
  PlinkitViewportOptions,
} from "../types"
import type { PyramidBaseConfig } from "./layout"
import { computeBaseLayout } from "./layout"

export const WORLD_WIDTH = 600

export interface DerivedWorldMetricsInput {
  mainPegs: PlinkitMainPegsOptions
  ballRadius: number
  heightPolicy: PlinkitViewportHeightPolicy
}

export interface DerivedWorldMetrics {
  worldHeight: number
  resolvedMainPegs: PyramidBaseConfig
  rows: number
  baseSpacing: number
  verticalStep: number
  requiredBottomPaddingPx: number
}

export interface ViewportDimensionsInput {
  parentWidthPx: number
  viewport: PlinkitViewportOptions
  worldHeight: number
}

export interface ViewportDimensions {
  displayWidth: number
  displayHeight: number
  worldScale: number
}

const BASE_BUCKET_OFFSET = -1
const LANDING_GUTTER_PX = 8

export function deriveWorldMetrics(input: DerivedWorldMetricsInput): DerivedWorldMetrics {
  const { mainPegs, ballRadius, heightPolicy } = input
  validateHeightPolicy(heightPolicy)
  validateMainPegs(mainPegs)
  if (!Number.isFinite(ballRadius) || ballRadius <= 0) {
    throw new Error("ballRadius must be greater than 0")
  }

  const base = computeBaseLayout(mainPegs, WORLD_WIDTH)
  if (base.baseSpacing <= 0) {
    throw new Error(
      "mainPegs produce non-positive base spacing; reduce sidePaddingPx or peg counts",
    )
  }

  const { rows, baseSpacing, targetVerticalStep: verticalStep } = base
  const pegSpan = verticalStep * Math.max(rows - 1, 0)
  const topPaddingPx = heightPolicy.topPaddingPx
  const funnelHeight = verticalStep * 2
  const landingMinPx = ballRadius * 2 + LANDING_GUTTER_PX
  const bucketOffset = mainPegs.radius + ballRadius + BASE_BUCKET_OFFSET
  const requiredBottomPaddingPx = Math.max(
    heightPolicy.bottomPaddingPx,
    bucketOffset + landingMinPx,
  )
  const worldHeight = topPaddingPx + funnelHeight + pegSpan + requiredBottomPaddingPx

  return {
    worldHeight,
    resolvedMainPegs: {
      ...mainPegs,
      topPaddingPx,
      bottomPaddingPx: requiredBottomPaddingPx,
    },
    rows,
    baseSpacing,
    verticalStep,
    requiredBottomPaddingPx,
  }
}

export function calculateViewportDimensions(input: ViewportDimensionsInput): ViewportDimensions {
  const { parentWidthPx, viewport, worldHeight } = input
  validateViewportBounds(viewport)
  if (!Number.isFinite(parentWidthPx) || parentWidthPx <= 0) {
    throw new Error("Parent width must be greater than 0")
  }
  if (!Number.isFinite(worldHeight) || worldHeight <= 0) {
    throw new Error("World height must be greater than 0")
  }

  const displayWidth = parentWidthPx
  const displayHeight = displayWidth * (worldHeight / WORLD_WIDTH)
  return {
    displayWidth,
    displayHeight,
    worldScale: displayWidth / WORLD_WIDTH,
  }
}

function validateHeightPolicy(policy: PlinkitViewportHeightPolicy): void {
  if (!Number.isFinite(policy.topPaddingPx) || policy.topPaddingPx < 0) {
    throw new Error("viewport.heightPolicy.topPaddingPx must be >= 0")
  }
  if (!Number.isFinite(policy.bottomPaddingPx) || policy.bottomPaddingPx < 0) {
    throw new Error("viewport.heightPolicy.bottomPaddingPx must be >= 0")
  }
}

function validateViewportBounds(viewport: PlinkitViewportOptions): void {
  if (!Number.isFinite(viewport.dprCap) || viewport.dprCap <= 0) {
    throw new Error("viewport.dprCap must be greater than 0")
  }
}

function validateMainPegs(mainPegs: PlinkitMainPegsOptions): void {
  if (!Number.isFinite(mainPegs.radius) || mainPegs.radius <= 0) {
    throw new Error("layout.mainPegs.radius must be greater than 0")
  }
  if (!Number.isFinite(mainPegs.topPegCount) || mainPegs.topPegCount < 1) {
    throw new Error("layout.mainPegs.topPegCount must be >= 1")
  }
  if (!Number.isFinite(mainPegs.bottomPegCount) || mainPegs.bottomPegCount < mainPegs.topPegCount) {
    throw new Error("layout.mainPegs.bottomPegCount must be >= topPegCount")
  }
  if (!Number.isFinite(mainPegs.verticalStepRatio) || mainPegs.verticalStepRatio <= 0) {
    throw new Error("layout.mainPegs.verticalStepRatio must be > 0")
  }
  if (!Number.isFinite(mainPegs.sidePaddingPx) || mainPegs.sidePaddingPx < 0) {
    throw new Error("layout.mainPegs.sidePaddingPx must be >= 0")
  }
}
