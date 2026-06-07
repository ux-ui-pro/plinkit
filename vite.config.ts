import { defineConfig } from "vite"
import dts from "vite-plugin-dts"

export default defineConfig({
  plugins: [
    dts({
      entryRoot: "src",
      include: ["src"],
      compilerOptions: {
        declarationMap: false,
      },
      insertTypesEntry: true,
      bundleTypes: true,
    }),
  ],
  build: {
    sourcemap: false,
    minify: "esbuild",
    lib: {
      entry: "src/index.ts",
      name: "Plinkit",
      fileName: (format) => {
        if (format === "es") return "index.es.js"
        if (format === "cjs") return "index.cjs"
        return "plinkit.umd.js"
      },
      formats: ["es", "cjs", "umd"],
    },
  },
})
