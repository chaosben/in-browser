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

	// The launcher installs as the app of the whole suite
	await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
	// Nothing used yet, so no “Recently used”
	await expect(page.getByRole('heading', { name: 'Recently used' })).toHaveCount(0);

	// The search filters live, also by keywords and German words
	const search = page.getByRole('searchbox', { name: 'Search tools' });
	const tiles = page.locator('main section[aria-labelledby^="category-"] a');
	await search.fill('screen recorder');
	await expect(tiles).toHaveText([/Screen Capture/]);
	await search.fill('notizbuch');
	await expect(tiles).toHaveText([/Notes/]);
	await search.fill('xyz');
	await expect(page.getByRole('status')).toHaveText('No tool matches “xyz”.');
	await search.fill('');
	await expect(page.getByRole('heading', { name: /^Writing/ })).toBeVisible();

	for (const tool of TOOLS) {
		await page.goto(tool.path);
		await expect(page.getByRole('banner').getByText(tool.name, { exact: true })).toBeVisible();
		await expect(page.getByRole('contentinfo').getByText(/^Version /)).toHaveCount(0);
	}

	// Every tool records itself: the most recent first
	await page.goto('/');
	const recent = page.getByRole('region', { name: 'Recently used' }).getByRole('link');
	await expect(recent).toHaveText([...TOOLS].reverse().map((tool) => tool.name));

	const response = await page.goto('/does-not-exist');
	expect(response?.status()).toBe(404);
	// The browser logs the intended 404 itself
	problems.splice(0, problems.length, ...problems.filter((p) => !p.includes('status of 404')));
});
