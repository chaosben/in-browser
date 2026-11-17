import { test as base, expect, type Page } from '@playwright/test';

// Every page under test collects console errors, uncaught exceptions and CSP violations; a test fails if any
// occurred (`expect(problems).toEqual([])` runs automatically after each test).

export const test = base.extend<{ problems: string[] }>({
	problems: async ({ page }, use) => {
		const problems = watchProblems(page);
		await use(problems);
		expect(problems, 'console errors, exceptions or CSP violations').toEqual([]);
	}
});

export function watchProblems(page: Page): string[] {
	const problems: string[] = [];
	page.on('console', (msg) => {
		if (msg.type() === 'error') problems.push(`console: ${msg.text()}`);
	});
	page.on('pageerror', (error) => problems.push(`exception: ${error.message}`));
	return problems;
}

export { expect };
