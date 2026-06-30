import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  reporter: "list",
  fullyParallel: false,
  timeout: 30_000,
  use: {
    trace: "on-first-retry",
  },
});
