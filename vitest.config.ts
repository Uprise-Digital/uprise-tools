import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node", // Running actions/libs in Node.js environment
    globals: true,
    setupFiles: "./tests/setup.ts",
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
