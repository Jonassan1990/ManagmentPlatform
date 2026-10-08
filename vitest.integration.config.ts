import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
    hookTimeout: 120000,
    // Remote/temp Prisma DBs can exceed 60s on multi-outcome journeys.
    testTimeout: 120000,
  },
});
