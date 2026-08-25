import { defineConfig } from "vitest/config";

// Reads the same "@/*" -> "./src/*" alias from tsconfig.json rather than
// duplicating it here — one source of truth for the mapping.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
  },
});
