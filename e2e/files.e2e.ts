import { expect, test } from './fixtures.js';

// Core flows in Files against the real OPFS (each test has a fresh browser context, so an empty file system)

test('creates and deletes a folder', async ({ page, problems: _ }) => {
	await page.goto('/files');
	await page.getByRole('button', { name: 'New folder' }).first().click();
	const input = page.getByRole('textbox', { name: /name/i });
	await input.fill('Projects');
	await input.press('Enter');
	const main = page.getByRole('main');
	await expect(main.getByText('Projects', { exact: true })).toBeVisible();

	await main.getByText('Projects', { exact: true }).click();
	await page.keyboard.press('Delete');
	await page.getByRole('dialog').getByRole('button', { name: /delete/i }).click();
	await expect(main.getByText('Projects', { exact: true })).toHaveCount(0);
});
