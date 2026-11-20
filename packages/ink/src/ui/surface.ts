// Keeps a stage in step with its element: size and pixel density, position on the page (scrolling), theme colors.

import type { SceneItem, SurfacePage } from '../render/kit.js';
import type { Stage } from '../render/stage.js';

/** Starts following the stage's root element; returns the cleanup */
export function attachSurface<P extends SurfacePage, I extends SceneItem>(root: HTMLElement, stage: Stage<P, I>): () => void {
	const resize = () => {
		const rect = root.getBoundingClientRect();
		stage.resize(rect.width, rect.height, window.devicePixelRatio || 1);
	};
	const observer = new ResizeObserver(resize);
	observer.observe(root);
	// Moving the window to a screen with another pixel density
	window.addEventListener('resize', resize);
	const scroll = () => stage.updateOrigin();
	window.addEventListener('scroll', scroll, { passive: true, capture: true });
	// Theme switch (system or the switch in the header): the desk color around the pages follows
	const dark = matchMedia('(prefers-color-scheme: dark)');
	const theme = () => requestAnimationFrame(() => stage.themeChanged());
	dark.addEventListener('change', theme);
	const themeObserver = new MutationObserver(theme);
	themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
	resize();
	return () => {
		observer.disconnect();
		window.removeEventListener('resize', resize);
		window.removeEventListener('scroll', scroll, { capture: true });
		dark.removeEventListener('change', theme);
		themeObserver.disconnect();
	};
}
