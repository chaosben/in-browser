import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { flushSync, mount, unmount } from 'svelte';
import type { Command } from './commands';
import Ribbon from './Ribbon.svelte';
import type { RibbonTab } from './ribbon';
import { selection } from './ribbon.fixture.svelte';
// The site's styles (Tailwind, daisyUI): the ribbon measures its groups
import '../../../src/routes/layout.css';

// The ribbon in real Chromium: groups shrink with the room, a contextual tab shows up, access keys run commands

const runs: string[] = [];
const cmd = (id: string, label: string): Command => ({ id, label, icon: 'icon-[material-symbols-light--check]', run: () => runs.push(id) });

const tabs: RibbonTab[] = [
	{
		id: 'home',
		label: 'Home',
		groups: [
			{ id: 'clipboard', label: 'Clipboard', items: [cmd('paste', 'Paste'), cmd('cut', 'Cut'), cmd('copy', 'Copy')] },
			{ id: 'markup', label: 'Markup', items: [cmd('highlight', 'Highlight'), cmd('underline', 'Underline'), cmd('strike', 'Strikeout')] },
			{ id: 'draw', label: 'Draw', items: [cmd('pen', 'Pen'), cmd('marker', 'Marker'), cmd('shapes', 'Shapes'), cmd('eraser', 'Eraser')] }
		]
	},
	{ id: 'view', label: 'View', groups: [{ id: 'zoom', label: 'Zoom', items: [cmd('fit', 'Fit width')] }] },
	{ id: 'shape', label: 'Shape', contextual: true, visible: () => selection.on, groups: [{ id: 'style', label: 'Style', items: [cmd('fill', 'Fill')] }] }
];

let host: HTMLElement;
let ribbon: ReturnType<typeof mount> | null = null;

async function show(width: number) {
	localStorage.removeItem('test:ribbon');
	host = document.createElement('div');
	host.style.width = `${width}px`;
	document.body.append(host);
	ribbon = mount(Ribbon, { target: host, props: { tabs, storage: 'test' } });
	flushSync();
	// Measuring and fitting happen in the next frames
	for (let i = 0; i < 4; i++) await new Promise((r) => requestAnimationFrame(r));
	flushSync();
}

const collapsed = () => host.querySelectorAll('[role="toolbar"] [data-group-button]').length;
const labels = () => [...host.querySelectorAll('[role="toolbar"] [data-command] span:not([class*="icon-"])')].map((s) => s.textContent);

afterEach(() => {
	if (ribbon) unmount(ribbon);
	ribbon = null;
	host.remove();
	selection.on = false;
	runs.length = 0;
});

// A desktop window (narrow windows get the phone bar)
beforeAll(async () => {
	await page.viewport(1500, 800);
});

describe('ribbon', () => {
	it('shows every group with large buttons when there is room', async () => {
		await show(1400);
		expect(collapsed()).toBe(0);
		expect(host.querySelectorAll('[role="toolbar"] [data-size="0"]').length).toBe(3);
		expect(labels()).toContain('Eraser');
		expect(host.querySelectorAll('[role="tab"]').length).toBe(2);
	});

	it('shrinks groups from the right, collapses them last', async () => {
		const size = (id: string) => Number(host.querySelector(`[role="toolbar"] [aria-label="${id}"], [role="toolbar"] [data-group-button="${id.toLowerCase()}"]`)?.closest('[data-size]')?.getAttribute('data-size'));
		await show(1400);
		expect(['Clipboard', 'Markup', 'Draw'].map(size)).toEqual([0, 0, 0]);
		unmount(ribbon!);
		host.remove();
		// Room for less: the right groups get smaller first, the left one stays large longest
		await show(480);
		const sizes = ['Clipboard', 'Markup', 'Draw'].map(size);
		expect(sizes[0]).toBe(0);
		expect(sizes[2]).toBeGreaterThan(0);
		expect(sizes[2]).toBeGreaterThanOrEqual(sizes[1]);
		unmount(ribbon!);
		host.remove();
		await show(90);
		expect(collapsed()).toBeGreaterThan(0);
	});

	it('adds the contextual tab while there is something to show it for', async () => {
		await show(1400);
		selection.on = true;
		flushSync();
		const tab = host.querySelector<HTMLElement>('[data-tab="shape"]');
		expect(tab).not.toBeNull();
		tab!.click();
		flushSync();
		expect(labels()).toEqual(['Fill']);
		selection.on = false;
		flushSync();
		expect(host.querySelector('[data-tab="shape"]')).toBeNull();
	});

	it('runs a command by its access keys (Alt, tab letter, command letter)', async () => {
		await show(1400);
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt' }));
		window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt' }));
		flushSync();
		expect(host.querySelector('[data-tab="home"] kbd')?.textContent).toBe('H');
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
		flushSync();
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }));
		flushSync();
		// "Cut" has the C (Clipboard's first command is Paste → P)
		expect(runs).toEqual(['cut']);
	});
});
