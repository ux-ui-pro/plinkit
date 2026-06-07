// Внутренний entry-point: используется только для тестов и dev-инструментов
// (например, scripts/bench-distribution.mjs может импортировать отсюда).
// Не публикуется как часть npm-пакета — см. `files` в package.json.
export { resolveBucketIndex } from "./core/buckets"
export { type ResolvedDistribution, resolveDistribution } from "./core/distribution"
export {
  type BaseLayout,
  type BaseLayoutConfig,
  computeBaseLayout,
} from "./core/layout"
export { BALL_LABEL } from "./core/spawn"
export { calculateViewportDimensions, deriveWorldMetrics, WORLD_WIDTH } from "./core/viewport"
