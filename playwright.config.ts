import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:3100", channel: "msedge", headless: true },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    env: {
      NEXT_TEST_DIST_DIR: ".next-test",
      NEXT_PUBLIC_SUPABASE_URL: "https://marketplace-test.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    },
    timeout: 60000,
  },
});
