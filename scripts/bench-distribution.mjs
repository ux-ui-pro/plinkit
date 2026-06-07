import { PlinkitWorld } from "../src/core/world.ts"
import { WORLD_WIDTH, deriveWorldMetrics } from "../src/core/viewport.ts"

const BALLS_PER_TEST = Number(process.env.BALLS_PER_TEST ?? 3000)
const BALL_COST = 250
const STEP_MS = 1000 / 120
const MAX_STEPS = 800
const HOUSE_EDGES = process.env.HOUSE_EDGES
  ? process.env.HOUSE_EDGES.split(",").map((value) => Number(value.trim()))
  : [0, 0.25, 0.5, 0.75, 0.85, 1.0]

const BALL_RADIUS = Number(process.env.BALL_RADIUS ?? 14)
const PEG_RADIUS = Number(process.env.PEG_RADIUS ?? 7)
const BOTTOM_PEG_COUNT = Number(process.env.BOTTOM_PEG_COUNT ?? 10)
const multipliers = process.env.MULTIPLIERS
  ? process.env.MULTIPLIERS.split(",").map((value) => Number(value.trim()))
  : [6.5, 0.7, 0.3, 0.1, 0, 0.1, 0.3, 0.7, 6.5]

if (multipliers.length !== BOTTOM_PEG_COUNT - 1) {
  throw new Error(
    `Invalid multipliers length (${multipliers.length}). Expected ${BOTTOM_PEG_COUNT - 1} for bottomPegCount=${BOTTOM_PEG_COUNT}`,
  )
}

const mainPegsInput = {
  sidePaddingPx: 1,
  radius: PEG_RADIUS,
  topPegCount: 3,
  bottomPegCount: BOTTOM_PEG_COUNT,
  verticalStepRatio: 0.86,
}

const worldMetrics = deriveWorldMetrics({
  mainPegs: mainPegsInput,
  ballRadius: BALL_RADIUS,
  heightPolicy: { topPaddingPx: 20, bottomPaddingPx: 0 },
})

function runTest(houseEdge) {
  const world = new PlinkitWorld({
    width: WORLD_WIDTH,
    height: worldMetrics.worldHeight,
    gravityY: 0.65,
    layout: {
      mainPegs: worldMetrics.resolvedMainPegs,
      edgeGuides: { radius: 8, spread: 1.1, yOffset: -2 },
    },
    ballRadius: BALL_RADIUS,
    multipliers,
    ballCost: BALL_COST,
    houseEdge,
  })

  const bucketCounts = new Array(multipliers.length).fill(0)
  let settled = 0
  let totalPayout = 0

  for (let ball = 0; ball < BALLS_PER_TEST; ball++) {
    world.spawnBall()
    for (let step = 0; step < MAX_STEPS; step++) {
      const settlements = world.step(STEP_MS)
      if (settlements.length > 0) {
        for (const s of settlements) {
          bucketCounts[s.bucketIndex]++
          totalPayout += s.payout
          settled++
        }
        break
      }
    }
  }

  world.destroy()
  const totalWagered = settled * BALL_COST
  const rtp = totalWagered > 0 ? totalPayout / totalWagered : 0
  return { bucketCounts, settled, rtp }
}

console.log(
  `Config: pegRadius=${PEG_RADIUS}, ballRadius=${BALL_RADIUS}, bottomPegCount=${BOTTOM_PEG_COUNT}, multipliers=[${multipliers.join(", ")}]`,
)
console.log(`Bench: ${BALLS_PER_TEST} balls per houseEdge value\n`)

const labels = multipliers.map((m) => `${m}x`)
console.log(["houseEdge", ...labels, "RTP", "settled"].join("\t"))

for (const he of HOUSE_EDGES) {
  const t0 = performance.now()
  const { bucketCounts, settled, rtp } = runTest(he)
  const elapsed = ((performance.now() - t0) / 1000).toFixed(1)

  const pcts = bucketCounts.map((c) => ((c / settled) * 100).toFixed(1) + "%")
  console.log([he.toFixed(2), ...pcts, `${(rtp * 100).toFixed(1)}%`, `${settled}/${BALLS_PER_TEST}`].join("\t"))

  const extreme = bucketCounts[0] + bucketCounts[multipliers.length - 1]
  console.log(`  -> edge: ${extreme} (${((extreme / settled) * 100).toFixed(1)}%) | RTP: ${(rtp * 100).toFixed(1)}% | ${elapsed}s\n`)
}
