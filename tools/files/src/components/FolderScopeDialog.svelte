<script lang="ts">
	import Modal from '@in-browser/brand/Modal.svelte';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { list } from '@in-browser/files/fs.js';
	import { formatSize } from '@in-browser/files/i18n/index.svelte.js';
	import { isHidden } from '@in-browser/files/path.js';
	import { folderSizes, includeFolder, p2pStatus } from '@in-browser/files/p2p/p2p.svelte.js';
	import { inScope } from '@in-browser/files/p2p/scope.js';
	import { devicesUi } from '#lib/devices.svelte.js';
	import { intlLocale, m } from '#lib/i18n/index.js';
	import ScopeTree, { type ScopeFolder } from './ScopeTree.svelte';

	// Which folders this device takes part in: sizes and where the folders are (also folders that exist only on
	// other devices). Taking a folder in again syncs right away; leaving one out asks first (`ExcludeFolderDialog`).

	let { onclose }: { onclose: () => void } = $props();

	const scope = $derived(p2pStatus.view.scope);
	const self = $derived(p2pStatus.view.self?.id ?? '');
	const names = $derived(new Map(p2pStatus.view.devices.map((d) => [d.id, d.name])));

	/** The subfolders of `folder` here at once, then with those only on the connected devices and their size on each */
	async function load(folder: string): Promise<{ folders: ScopeFolder[]; later: Promise<ScopeFolder[]> }> {
		const local = await list(folder).catch(() => []);
		const here = local.filter((entry) => entry.kind === 'directory' && !isHidden(entry.path)).map((entry) => ({ path: entry.path, name: entry.name, sizes: {} }));
		const later = folderSizes(folder).then((sizes) => {
			const byPath = new Map<string, ScopeFolder>(here.map((f) => [f.path, { ...f, sizes: {} }]));
			for (const [device, perFolder] of Object.entries(sizes)) {
				for (const [path, bytes] of Object.entries(perFolder)) {
					if (isHidden(path)) continue;
					const entry = byPath.get(path) ?? { path, name: path.split('/').at(-1) ?? path, sizes: {} };
					entry.sizes[device] = bytes;
					byPath.set(path, entry);
				}
			}
			return [...byPath.values()];
		});
		return { folders: here, later };
	}

	async function toggle(folder: ScopeFolder, on: boolean) {
		if (on) {
			try {
				await includeFolder(folder.path);
			} catch (e) {
				toast(m.devices.failed(e instanceof Error ? e.message : String(e)), 'error', 8000);
			}
		} else {
			devicesUi.exclude = folder.path;
		}
	}

	function where(folder: ScopeFolder): string {
		const devices = Object.keys(folder.sizes).filter((id) => folder.sizes[id] > 0);
		const size = Math.max(0, ...Object.values(folder.sizes));
		const sizeText = size ? formatSize(size, intlLocale) : '';
		if (devices.length && !devices.includes(self)) {
			const onlyOn = m.scope.onlyOn(devices.map((id) => names.get(id) ?? id).join(', '));
			return sizeText ? `${sizeText}, ${onlyOn}` : onlyOn;
		}
		return sizeText;
	}

</script>



<Modal onclose={onclose}>
	<div class="modal-box flex max-w-2xl flex-col gap-3">
		<h3 class="text-lg font-bold">{m.scope.title}</h3>
		<p class="text-sm opacity-80">{m.scope.hint}</p>
		<ScopeTree {load} isOn={(path) => inScope(path, scope)} ontoggle={toggle} detail={where} empty={m.scope.empty} />
		<p class="text-xs opacity-60">{m.scope.always}: <code>.apps</code></p>
		<div class="modal-action">
			<button class="btn" onclick={onclose}>{m.devices.close}</button>
		</div>
	</div>
</Modal>
