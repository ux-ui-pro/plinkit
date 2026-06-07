import type { Peg } from "../types"

export interface PyramidBaseConfig {
  radius: number
  topPegCount: number
  bottomPegCount: number
  verticalStepRatio: number
  sidePaddingPx: number
  topPaddingPx: number
  bottomPaddingPx: number
}

export interface RowAnchor {
  row: number
  count: number
  y: number
  startX: number
  rowWidth: number
  leftX: number
  rightX: number
}

export interface PyramidGeometry {
  rows: number
  center: number
  minTopY: number
  bottomY: number
  sidePadding: number
  baseSpacing: number
  verticalStep: number
  startY: number
  rowAnchors: RowAnchor[]
}

export interface EdgeGuideLayoutConfig {
  spread: number
  yOffset: number
}

export interface BaseLayoutConfig {
  radius: number
  topPegCount: number
  bottomPegCount: number
  verticalStepRatio: number
  sidePaddingPx: number
}

export interface BaseLayout {
  rows: number
  sidePadding: number
  baseSpacing: number
  targetVerticalStep: number
}

export function computeBaseLayout(config: BaseLayoutConfig, width: number): BaseLayout {
  const rows = config.bottomPegCount - config.topPegCount + 1
  const sidePadding = config.radius + config.sidePaddingPx
  const baseSpacing = (width - sidePadding * 2) / Math.max(config.bottomPegCount - 1, 1)
  const targetVerticalStep = baseSpacing * config.verticalStepRatio
  return { rows, sidePadding, baseSpacing, targetVerticalStep }
}

export function computePyramidGeometry(
  config: PyramidBaseConfig & { width: number; height: number },
): PyramidGeometry {
  const { width, height, topPegCount } = config
  if (config.bottomPegCount < topPegCount) {
    throw new Error("bottomPegCount must be greater than or equal to topPegCount")
  }

  const base = computeBaseLayout(config, width)
  const center = width * 0.5
  const minTopY = config.topPaddingPx
  const bottomY = Math.max(minTopY + 60, height - config.bottomPaddingPx)
  const maxVerticalStep = base.rows > 1 ? (bottomY - minTopY) / (base.rows - 1) : 0
  const verticalStep = Math.min(base.targetVerticalStep, maxVerticalStep)
  const startY = bottomY - verticalStep * Math.max(base.rows - 1, 0)

  const rowAnchors: RowAnchor[] = []
  for (let row = 0; row < base.rows; row++) {
    const count = topPegCount + row
    const y = startY + row * verticalStep
    const rowWidth = (count - 1) * base.baseSpacing
    const startX = center - rowWidth * 0.5
    rowAnchors.push({
      row,
      count,
      y,
      startX,
      rowWidth,
      leftX: startX,
      rightX: startX + rowWidth,
    })
  }

  return {
    rows: base.rows,
    center,
    minTopY,
    bottomY,
    sidePadding: base.sidePadding,
    baseSpacing: base.baseSpacing,
    verticalStep,
    startY,
    rowAnchors,
  }
}

export function buildMainPegs(geometry: PyramidGeometry, radius: number): Peg[] {
  const pegs: Peg[] = []
  for (const row of geometry.rowAnchors) {
    for (let index = 0; index < row.count; index++) {
      pegs.push({
        x: row.startX + index * geometry.baseSpacing,
        y: row.y,
        radius,
      })
    }
  }
  return pegs
}

export function buildEdgeGuidePegs(
  geometry: PyramidGeometry,
  radius: number,
  config: EdgeGuideLayoutConfig,
): Peg[] {
  if (geometry.rows < 2) return []

  const guides: Peg[] = []
  const outwardOffset = (config.spread - 1) * geometry.baseSpacing
  const spreadEdgeX = (x: number) => {
    if (x < geometry.center) return x - outwardOffset
    if (x > geometry.center) return x + outwardOffset
    return x
  }

  const topRow = geometry.rowAnchors[0]
  const row0Left = topRow.leftX
  const row0Right = topRow.rightX
  const availableAbove = geometry.startY - geometry.minTopY
  const minFunnelStep = radius * 2.5
  const funnelStep = Math.min(geometry.verticalStep, Math.max(minFunnelStep, availableAbove / 3))
  const funnelLevels =
    availableAbove >= minFunnelStep ? Math.min(3, Math.floor(availableAbove / funnelStep)) : 0

  for (let level = 1; level <= funnelLevels; level++) {
    const y = geometry.startY - level * funnelStep + config.yOffset
    const leftX = row0Left - level * geometry.baseSpacing * 0.5
    const rightX = row0Right + level * geometry.baseSpacing * 0.5
    guides.push({ x: spreadEdgeX(leftX), y, radius }, { x: spreadEdgeX(rightX), y, radius })
  }

  for (let level = 0; level < funnelLevels; level++) {
    const yCur = geometry.startY - level * funnelStep
    const yNext = geometry.startY - (level + 1) * funnelStep
    const leftCur = row0Left - level * geometry.baseSpacing * 0.5
    const leftNext = row0Left - (level + 1) * geometry.baseSpacing * 0.5
    const rightCur = row0Right + level * geometry.baseSpacing * 0.5
    const rightNext = row0Right + (level + 1) * geometry.baseSpacing * 0.5

    guides.push(
      {
        x: spreadEdgeX((leftCur + leftNext) / 2),
        y: (yCur + yNext) / 2 + config.yOffset,
        radius,
      },
      {
        x: spreadEdgeX((rightCur + rightNext) / 2),
        y: (yCur + yNext) / 2 + config.yOffset,
        radius,
      },
    )
  }

  for (let row = 0; row < geometry.rows - 1; row++) {
    const cur = geometry.rowAnchors[row]
    const next = geometry.rowAnchors[row + 1]
    const yMid = (cur.y + next.y) / 2 + config.yOffset
    guides.push(
      {
        x: spreadEdgeX((cur.leftX + next.leftX) / 2),
        y: yMid,
        radius,
      },
      {
        x: spreadEdgeX((cur.rightX + next.rightX) / 2),
        y: yMid,
        radius,
      },
    )
  }

  return guides
}
