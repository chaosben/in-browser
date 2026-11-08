import { mount, unmount, type Component } from 'svelte';

interface DocumentPictureInPicture {
	requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
}

const api = (): DocumentPictureInPicture | undefined =>
	(globalThis as { documentPictureInPicture?: DocumentPictureInPicture }).documentPictureInPicture;

/**
 * Small always-on-top window (Document Picture-in-Picture, Chrome/Edge) that shows a component of this page, so
 * the recording controls stay visible while another window is in front. Needs a user activation to open.
 */
class FloatingWindow {
	readonly supported = typeof window !== 'undefined' && !!api();
	/** The window is open */
	open = $state(false);
	#window: Window | null = null;
	#cleanup = () => {};

	async show<P extends Record<string, unknown>>(component: Component<P>, props: P, size = { width: 300, height: 90 }) {
		const pip = api();
		if (!pip) return;
		this.close();
		const win = await pip.requestWindow(size);
		this.#window = win;
		const doc = win.document;
		// Same styles (Tailwind/daisyUI, icons) as the page
		for (const node of document.head.querySelectorAll('style, link[rel="stylesheet"]')) {
			doc.head.append(node.cloneNode(true));
		}
		doc.title = document.title;
		// Always dark: the browser draws the window's frame in a fixed dark design
		const root = doc.documentElement;
		root.lang = document.documentElement.lang;
		root.setAttribute('data-theme', 'dark');
		root.style.colorScheme = 'dark';
		doc.body.className = 'bg-base-100 text-base-content';
		const instance = mount(component, { target: doc.body, props });
		this.open = true;
		let done = false;
		const cleanup = () => {
			if (done) return;
			done = true;
			unmount(instance);
			if (this.#window !== win) return;
			this.open = false;
			this.#window = null;
			this.#cleanup = () => {};
		};
		this.#cleanup = cleanup;
		// Closed by the user (or by close())
		win.addEventListener('pagehide', cleanup, { once: true });
	}

	close() {
		const win = this.#window;
		this.#cleanup();
		win?.close();
	}
}

export const floatingWindow = new FloatingWindow();
