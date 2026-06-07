import assert from "node:assert/strict"
import { test } from "node:test"

const mod = await import("../dist/internal.es.js")

test("computeBaseLayout returns correct rows count", () => {
  const result = mod.computeBaseLayout(
    { radius: 4, topPegCount: 3, bottomPegCount: 12, verticalStepRatio: 0.86, sidePaddingPx: 1 },
    600,
  )
  assert.equal(result.rows, 10)
})

test("computeBaseLayout calculates sidePadding as radius + sidePaddingPx", () => {
  const result = mod.computeBaseLayout(
    { radius: 4, topPegCount: 3, bottomPegCount: 12, verticalStepRatio: 0.86, sidePaddingPx: 10 },
    600,
  )
  assert.equal(result.sidePadding, 14)
})

test("computeBaseLayout baseSpacing fills available width", () => {
  const config = {
    radius: 4,
    topPegCount: 3,
    bottomPegCount: 12,
    verticalStepRatio: 0.86,
    sidePaddingPx: 1,
  }
  const width = 600
  const result = mod.computeBaseLayout(config, width)
  const expectedSidePadding = 4 + 1
  const expectedSpacing = (width - expectedSidePadding * 2) / (12 - 1)
  assert.equal(result.baseSpacing, expectedSpacing)
})

test("computeBaseLayout targetVerticalStep uses verticalStepRatio", () => {
  const result = mod.computeBaseLayout(
    { radius: 4, topPegCount: 3, bottomPegCount: 12, verticalStepRatio: 0.86, sidePaddingPx: 1 },
    600,
  )
  const expectedStep = result.baseSpacing * 0.86
  assert.ok(Math.abs(result.targetVerticalStep - expectedStep) < 1e-10)
})

test("computeBaseLayout handles single peg row gracefully", () => {
  const result = mod.computeBaseLayout(
    { radius: 4, topPegCount: 5, bottomPegCount: 5, verticalStepRatio: 0.86, sidePaddingPx: 1 },
    600,
  )
  assert.equal(result.rows, 1)
})

test("deriveWorldMetrics uses computeBaseLayout internally (consistent results)", () => {
  const mainPegs = {
    radius: 4,
    topPegCount: 3,
    bottomPegCount: 12,
    verticalStepRatio: 0.86,
    sidePaddingPx: 1,
  }
  const baseLayout = mod.computeBaseLayout(mainPegs, mod.WORLD_WIDTH)
  const metrics = mod.deriveWorldMetrics({
    ballRadius: 10,
    mainPegs,
    heightPolicy: { topPaddingPx: 20, bottomPaddingPx: 0 },
  })
  assert.equal(metrics.rows, baseLayout.rows)
  assert.equal(metrics.baseSpacing, baseLayout.baseSpacing)
})
