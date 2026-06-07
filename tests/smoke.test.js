import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { test } from "node:test"

test("dist artifacts exist", () => {
  assert.equal(existsSync("dist/index.es.js"), true)
  assert.equal(existsSync("dist/index.cjs"), true)
  assert.equal(existsSync("dist/plinkit.umd.js"), true)
  assert.equal(existsSync("dist/index.d.ts"), true)
  assert.equal(existsSync("dist/internal.es.js"), true)
})

test("public api exports Plinkit", async () => {
  const mod = await import("../dist/index.es.js")
  assert.equal(typeof mod.Plinkit, "function")
})
