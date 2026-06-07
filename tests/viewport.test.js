import assert from "node:assert/strict"
import { test } from "node:test"

const mod = await import("../dist/internal.es.js")

test("deriveWorldMetrics keeps landing zone safe", () => {
  const result = mod.deriveWorldMetrics({
    ballRadius: 10,
    mainPegs: {
      radius: 4,
      topPegCount: 3,
      bottomPegCount: 12,
      verticalStepRatio: 0.86,
      sidePaddingPx: 10,
    },
    heightPolicy: {
      topPaddingPx: 40,
      bottomPaddingPx: 72,
    },
  })

  const bucketOffset = 4 + 10 - 1
  const landingMinPx = 10 * 2 + 8
  assert.equal(result.requiredBottomPaddingPx >= bucketOffset + landingMinPx, true)
  assert.equal(result.resolvedMainPegs.bottomPaddingPx, result.requiredBottomPaddingPx)
  assert.equal(result.resolvedMainPegs.topPaddingPx, 40)
  assert.equal(result.worldHeight > 0, true)
})

test("deriveWorldMetrics rejects negative top padding", () => {
  assert.throws(() =>
    mod.deriveWorldMetrics({
      ballRadius: 10,
      mainPegs: {
        radius: 4,
        topPegCount: 3,
        bottomPegCount: 12,
        verticalStepRatio: 0.86,
        sidePaddingPx: 10,
      },
      heightPolicy: {
        topPaddingPx: -1,
        bottomPaddingPx: 72,
      },
    }),
  )
})

test("calculateViewportDimensions uses parent width directly", () => {
  const result = mod.calculateViewportDimensions({
    parentWidthPx: 400,
    viewport: {
      dprCap: 2,
      heightPolicy: {
        topPaddingPx: 40,
        bottomPaddingPx: 72,
      },
    },
    worldHeight: 440,
  })

  assert.equal(result.displayWidth, 400)
  const expectedScale = 400 / mod.WORLD_WIDTH
  assert.equal(result.worldScale, expectedScale)
  assert.equal(result.displayHeight, 400 * (440 / mod.WORLD_WIDTH))
})

test("calculateViewportDimensions rejects zero parent width", () => {
  assert.throws(() =>
    mod.calculateViewportDimensions({
      parentWidthPx: 0,
      viewport: {
        dprCap: 2,
        heightPolicy: {
          topPaddingPx: 40,
          bottomPaddingPx: 72,
        },
      },
      worldHeight: 440,
    }),
  )
})
