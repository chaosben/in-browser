import { defineConfig, devices } from '@playwright/test';

// End-to-end tests against the built site, served by Wrangler with the real asset handling and header rules
// (`static/_headers`, so the CSP applies). `npm run test:e2e` builds first.
const PORT = 8788;

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	fullyParallel: true,
	reporter: [['list'], ['html', { open: 'never' }]],
	use: {
		baseURL: `http://localhost:${PORT}`,
		locale: 'en-US',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: `npx wrangler dev --port ${PORT} --ip 127.0.0.1`,
		url: `http://localhost:${PORT}/`,
		reuseExistingServer: true,
		timeout: 60_000
	}
});
