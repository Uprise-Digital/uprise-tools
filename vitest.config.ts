import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node", // Running actions/libs in Node.js environment
    globals: true,
    setupFiles: "./tests/setup.ts",
    fileParallelism: false, // Prevent concurrent database locks during integration tests
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
