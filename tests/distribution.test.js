import assert from "node:assert/strict"
import { test } from "node:test"

const mod = await import("../dist/internal.es.js")

test("resolveDistribution returns zero bias at houseEdge=0", () => {
  const d = mod.resolveDistribution(0)
  assert.equal(d.windStrength, 0)
  assert.equal(d.collisionNudge, 0)
  assert.equal(d.spawnSigmaRatio, 0)
})

test("resolveDistribution returns positive bias at houseEdge > 0", () => {
  const d = mod.resolveDistribution(0.5)
  assert.ok(d.windStrength > 0)
  assert.ok(d.collisionNudge > 0)
  assert.ok(d.spawnSigmaRatio > 0)
})

test("resolveDistribution windStrength is capped at 4e-7", () => {
  const d = mod.resolveDistribution(1)
  assert.ok(d.windStrength <= 4e-7)
})

test("resolveDistribution clamps houseEdge below 0 to 0", () => {
  const d = mod.resolveDistribution(-1)
  assert.equal(d.windStrength, 0)
  assert.equal(d.collisionNudge, 0)
  assert.equal(d.spawnSigmaRatio, 0)
})

test("resolveDistribution clamps houseEdge above 1", () => {
  const at1 = mod.resolveDistribution(1)
  const at5 = mod.resolveDistribution(5)
  assert.equal(at1.windStrength, at5.windStrength)
  assert.equal(at1.collisionNudge, at5.collisionNudge)
  assert.equal(at1.spawnSigmaRatio, at5.spawnSigmaRatio)
})

test("resolveDistribution monotonically increases bias with houseEdge", () => {
  const values = [0, 0.25, 0.5, 0.75, 1]
  const results = values.map((v) => mod.resolveDistribution(v))
  for (let i = 1; i < results.length; i++) {
    assert.ok(results[i].windStrength >= results[i - 1].windStrength)
    assert.ok(results[i].collisionNudge >= results[i - 1].collisionNudge)
  }
})

test("resolveDistribution spawnSigmaRatio decreases as houseEdge grows", () => {
  const low = mod.resolveDistribution(0.1)
  const high = mod.resolveDistribution(1)
  assert.ok(low.spawnSigmaRatio > high.spawnSigmaRatio)
})
