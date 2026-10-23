import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./browser-tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:4286",
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
    locale: "en-GB",
    timezoneId: "UTC",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: `${process.platform === "win32" ? "python" : "python3"} -m http.server 4286 --bind 127.0.0.1`,
    url: "http://127.0.0.1:4286",
    reuseExistingServer: false,
  },
});
