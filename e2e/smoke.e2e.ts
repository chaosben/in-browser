import { expect, test } from './fixtures.js';

// Every page loads without errors and shows its header

const TOOLS = [
	{ path: '/files', name: 'Files' },
	{ path: '/text-editor', name: 'Text Editor' },
	{ path: '/screen-capture', name: 'Screen Capture' }
];

test('overview lists the tools', async ({ page, problems: _ }) => {
	await page.goto('/');
	for (const tool of TOOLS) await expect(page.locator(`a[href="${tool.path}"]`).first()).toBeVisible();
	// The version is shown here (not in the tools)
	await expect(page.getByRole('contentinfo').getByText(/^Version /)).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Sync your way' })).toBeVisible();
});

for (const tool of TOOLS) {
	test(`${tool.name} loads`, async ({ page, problems: _ }) => {
		await page.goto(tool.path);
		await expect(page.getByRole('banner').getByText(tool.name, { exact: true })).toBeVisible();
		// Shared footer: no version; without page status or a sync set up it stays hidden
		const footer = page.getByRole('contentinfo');
		await expect(footer.getByText(/^Version /)).toHaveCount(0);
		await expect(footer.getByRole('button', { name: /^Sync status/ })).toHaveCount(0);
	});
}

test('unknown paths get the error page with status 404', async ({ page }) => {
	const response = await page.goto('/does-not-exist');
	expect(response?.status()).toBe(404);
});
