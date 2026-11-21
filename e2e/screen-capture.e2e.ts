import { expect, test } from './fixtures.js';
import { shot } from './pdf.js';

// Screen Capture in one flow, without a recording (no screen capture in a test): an empty project is created where
// the save dialog says, opens in the editor, and is then a card on the suite's start page with the complete menu –
// deleted into the trash and brought back with “Undo”. Timeline, rendering and export are covered by the tool's specs.

test('creates an empty project, lists it on the start page, deletes it into the trash and undoes that', async ({ page }) => {
	await page.setViewportSize({ width: 1400, height: 900 });
	await page.goto('/screen-capture');
	await expect(page.getByText('No projects yet.')).toBeVisible();

	await page.getByRole('button', { name: 'Empty project' }).click();
	await page.getByRole('dialog').getByLabel('Name').fill('Demo');
	await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();

	// The editor of that project, with the suite's frame
	await expect(page).toHaveURL(/\/screen-capture\/editor\?path=/);
	await expect(page.getByTestId('ribbon')).toBeVisible();
	await shot(page, 'screen-capture-editor');

	// Back on the start page it is a card; its menu holds everything that can be done with it
	await page.goto('/screen-capture');
	const card = page.getByRole('link', { name: /Demo/ });
	await expect(card).toBeVisible();
	await shot(page, 'screen-capture-start');
	await card.click({ button: 'right' });
	await expect(page.getByRole('menuitem', { name: 'Open' })).toBeVisible();
	await expect(page.getByRole('menuitem', { name: 'Show in Files' })).toBeVisible();
	await page.getByRole('menuitem', { name: 'Delete' }).click();
	await expect(card).toBeHidden();

	await page.getByRole('status').filter({ hasText: 'is in the trash' }).getByRole('button', { name: 'Undo' }).click();
	await expect(card).toBeVisible();
});
