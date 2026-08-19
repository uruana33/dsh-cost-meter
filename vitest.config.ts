import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@mymeter/shared": fileURLToPath(new URL("./packages/shared/src", import.meta.url)),
      "@mymeter/core": fileURLToPath(new URL("./packages/core/src", import.meta.url)),
      "@mymeter/host": fileURLToPath(new URL("./packages/host/src", import.meta.url)),
      "@mymeter/api": fileURLToPath(new URL("./packages/api/src", import.meta.url)),
      "@mymeter/client": fileURLToPath(new URL("./packages/client/src", import.meta.url))
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["packages/**/*.test.ts", "packages/**/*.test.tsx", "tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"]
  }
});
