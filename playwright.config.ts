import { defineConfig, devices } from '@playwright/test';

/**
 * Bez tego pliku job "E2E smoke" w quality.yml pomijal sie po cichu
 * (`if: hashFiles('playwright.config.ts', ...) != ''`), wiec zielona bramka
 * nie byla zadnym dowodem, ze logika PWA w index.html dziala.
 *
 * Serwujemy statyczny katalog, bo to nie jest projekt z bundlerem —
 * service worker i manifest wymagaja prawdziwego origin http, nie file://.
 */
const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'line',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm start',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
