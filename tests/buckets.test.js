import assert from "node:assert/strict"
import { test } from "node:test"

const mod = await import("../dist/internal.es.js")

test("resolveBucketIndex maps center of first bucket to index 0", () => {
  const sidePadding = 5
  const baseSpacing = 50
  const bucketCount = 11
  const x = sidePadding + baseSpacing * 0.5
  assert.equal(mod.resolveBucketIndex(x, sidePadding, baseSpacing, bucketCount), 0)
})

test("resolveBucketIndex maps center of last bucket", () => {
  const sidePadding = 5
  const baseSpacing = 50
  const bucketCount = 11
  const x = sidePadding + baseSpacing * 10.5
  assert.equal(mod.resolveBucketIndex(x, sidePadding, baseSpacing, bucketCount), 10)
})

test("resolveBucketIndex clamps below zero", () => {
  assert.equal(mod.resolveBucketIndex(-100, 5, 50, 11), 0)
})

test("resolveBucketIndex clamps above max", () => {
  assert.equal(mod.resolveBucketIndex(10000, 5, 50, 11), 10)
})

test("resolveBucketIndex handles exact boundary", () => {
  const sidePadding = 5
  const baseSpacing = 50
  const x = sidePadding + baseSpacing
  assert.equal(mod.resolveBucketIndex(x, sidePadding, baseSpacing, 11), 1)
})

test("BALL_LABEL is exported and is a string", () => {
  assert.equal(typeof mod.BALL_LABEL, "string")
  assert.ok(mod.BALL_LABEL.length > 0)
})
