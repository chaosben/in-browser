<script lang="ts">
	// The remote control (`/pdf-editor/remote?end=…&path=…`, opened from “… presents …” in any tool): the presenter
	// view on this device for slides shown elsewhere – by a guest this PDF is shared with, or by another device of this
	// user. Previews and notes come from this device's own copy (`path`), so nothing of them depends on the
	// connection; only where to go travels (`show/remote-link.ts`). This page leads the connections of the browser, so a
	// phone keeps them while other tabs sleep.
	import { page as route } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { watch } from '@in-browser/files/fs.js';
	import { basename, normalize } from '@in-browser/files/path.js';
	import { PdfError } from '@in-browser/pdf/pdfjs.js';
	import PasswordDialog from '#lib/components/PasswordDialog.svelte';
	import { withPassword } from '#lib/model/password.svelte.js';
	import type { LiveEnd } from '@in-browser/files/p2p/live-ends.js';
	import { m } from '#lib/i18n/index.js';
	import { PdfDocument } from '#lib/model/document.svelte.js';
	import { ShowControl } from '#lib/show/control.svelte.js';
	import { controlEndLink } from '#lib/show/remote-link.js';
	import Presenter from '#lib/show/Presenter.svelte';

	let doc = $state<PdfDocument | null>(null);
	let control = $state<ShowControl | null>(null);
	let error = $state<string | null>(null);
	/** No slides found for a while: say why and what helps */
	let slow = $state(false);
	$effect(() => {
		const timer = setTimeout(() => (slow = true), 20_000);
		return () => clearTimeout(timer);
	});

	$effect(() => {
		const params = route.url.searchParams;
		const param = params.get('path');
		const endId = params.get('end');
		if (!param || !endId) return;
		const path = normalize(param);
		let disposed = false;
		let opened: PdfDocument | null = null;
		let made: ShowControl | null = null;
		let link: ReturnType<typeof controlEndLink> | null = null;
		/** Stops waiting for the connection the slides are on */
		let stopLooking: (() => void) | null = null;
		let stopWatch: (() => void) | null = null;

		(async () => {
			try {
				const p2p = await import('@in-browser/files/p2p/p2p.svelte.js');
				// Protected by a password: remembered on this device, else asked
				const [next] = await Promise.all([withPassword(basename(path), path, (typed) => PdfDocument.open(path, typed)), p2p.takeLead()]);
				if (!next) throw new PdfError('password');
				if (disposed) return next.destroy();
				opened = next;
				// The end of the connection the slides are on (it may still be coming)
				const end = await new Promise<LiveEnd>((found) => {
					const look = () => p2p.liveEnds().find((e) => e.peer.id === endId);
					const now = look();
					if (now) return found(now);
					const off = p2p.onLiveEnd((e) => {
						if (e.peer.id !== endId) return;
						off();
						found(e);
					});
					stopLooking = off;
				});
				if (disposed) return;
				link = controlEndLink(end);
				made = new ShowControl(link, () => {
					const now = opened ?? next;
					return { pages: now.pages.length, steps: (i) => now.stepsOf(now.pages[i]?.id ?? '') };
				});
				doc = next;
				control = made;
				// Saved anew on this device (in the editor's tab): previews and notes follow, the slides get it by the sync
				let reading = false;
				stopWatch = watch(
					(paths) =>
						void opened?.filesChanged(paths, async () => {
							if (reading || disposed) return;
							reading = true;
							try {
								const newer = await PdfDocument.open(path, next.password);
								if (disposed) return newer.destroy();
								const old = opened;
								opened = newer;
								doc = newer;
								old?.destroy();
							} catch (e) {
								console.warn('[pdf-editor] remote: reload', e);
							} finally {
								reading = false;
							}
						})
				);
			} catch (e) {
				console.error('[pdf-editor] remote', e);
				error = m.show.failed;
			}
		})();

		return () => {
			disposed = true;
			stopWatch?.();
			stopLooking?.();
			// Gone from this page: the slides take their own keys again at once
			made?.leave();
			made?.destroy();
			link?.close();
			control = null;
			doc = null;
			opened?.destroy();
		};
	});

	/** Leaves the remote control – the slides stay where they are and go on with their own keys – and goes to the
	 * start page */
	function end() {
		control?.leave();
		// A moment for the message to go out (without it the slides take their keys back after a few seconds anyway)
		setTimeout(() => void goto(resolve('/pdf-editor')), 150);
	}
</script>

{#if doc && control}
	<Presenter {doc} {control} onend={end} />
{:else}
	<div class="bg-base-200 fixed inset-0 z-[60] flex items-center justify-center p-6 text-center">
		{#if error}
			<p role="alert">{error}</p>
		{:else}
			<p class="flex max-w-md items-center gap-2"><span class="loading loading-spinner shrink-0" aria-hidden="true"></span>{slow ? m.show.unreachable : m.show.connecting}</p>
		{/if}
	</div>
{/if}

<PasswordDialog />
