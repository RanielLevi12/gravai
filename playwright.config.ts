import { defineConfig, devices } from "@playwright/test";

// E2E_BASE_URL aponta para um servidor já rodando (ex.: `next start -p 3100`) e dispensa o webServer.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL, ...devices["Pixel 7"] },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
