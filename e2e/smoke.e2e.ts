import { expect, test } from './fixtures.js';

// Every page loads without errors and shows its header; unknown paths get the 404 page

const TOOLS = [
	{ path: '/files', name: 'Files' },
	{ path: '/text-editor', name: 'Text Editor' },
	{ path: '/screen-capture', name: 'Screen Capture' },
	{ path: '/notes', name: 'Notes' }
];

test('overview, every tool and the 404 page load', async ({ page, problems }) => {
	await page.goto('/');
	for (const tool of TOOLS) await expect(page.locator(`a[href="${tool.path}"]`).first()).toBeVisible();
	// The version is shown here (not in the tools)
	await expect(page.getByRole('contentinfo').getByText(/^Version /)).toBeVisible();
	// …and the licenses of the third-party software it ships, as of this build
	await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Licenses' })).toHaveAttribute(
		'href',
		/\/blob\/[0-9a-f]+\/THIRD_PARTY_LICENSES\.md$/
	);

	for (const tool of TOOLS) {
		await page.goto(tool.path);
		await expect(page.getByRole('banner').getByText(tool.name, { exact: true })).toBeVisible();
		await expect(page.getByRole('contentinfo').getByText(/^Version /)).toHaveCount(0);
	}

	const response = await page.goto('/does-not-exist');
	expect(response?.status()).toBe(404);
	// The browser logs the intended 404 itself
	problems.splice(0, problems.length, ...problems.filter((p) => !p.includes('status of 404')));
});
