<script lang="ts">
	import { untrack } from 'svelte';
	import { FilesError } from '@in-browser/files/fs.js';
	import { filesErrorText } from '@in-browser/files/i18n/index.svelte.js';
	import { connectRemote, remoteDetails, type RemoteInput } from '@in-browser/files/sources/connections.svelte.js';
	import { m } from '#lib/i18n/index.js';
	import { resolve } from '$app/paths';

	// Connects a server – a WebDAV folder or S3-compatible storage – or changes a stored connection (`edit`). “Connect”
	// tries it first and stores it only when its top folder lists; the password or secret key stays on this device,
	// encrypted. Left empty while editing, the stored one is kept.

	interface Props {
		kind: 'webdav' | 's3';
		/** Id of the connection to change */
		edit: string | null;
		onclose: () => void;
		onconnected: (path: string) => void;
	}

	let { kind, edit, onclose, onconnected }: Props = $props();

	/** Presets of S3 providers: endpoint (with `{region}`), a region to start with, addressing */
	const PROVIDERS = {
		aws: { endpoint: 'https://s3.{region}.amazonaws.com', region: 'eu-central-1', pathStyle: false },
		r2: { endpoint: 'https://ACCOUNT_ID.r2.cloudflarestorage.com', region: 'auto', pathStyle: true },
		b2: { endpoint: 'https://s3.{region}.backblazeb2.com', region: 'eu-central-003', pathStyle: false },
		wasabi: { endpoint: 'https://s3.{region}.wasabisys.com', region: 'eu-central-1', pathStyle: false },
		other: { endpoint: '', region: 'us-east-1', pathStyle: true }
	} as const;
	type Provider = keyof typeof PROVIDERS;

	const t = $derived(m.connect);
	const titleId = $props.id();

	let name = $state('');
	let url = $state('https://');
	let username = $state('');
	let secret = $state('');
	let provider = $state<Provider>('aws');
	let endpoint = $state(PROVIDERS.aws.endpoint.replace('{region}', PROVIDERS.aws.region));
	let region = $state<string>(PROVIDERS.aws.region);
	let bucket = $state('');
	let prefix = $state('');
	let pathStyle = $state<boolean>(PROVIDERS.aws.pathStyle);
	let accessKeyId = $state('');

	let busy = $state(false);
	let error = $state<string | null>(null);
	/** The server couldn't be reached at all: likely CORS (or no HTTPS) – the help explains it */
	let unreachable = $state(false);

	// Editing: the stored values (never the secret)
	$effect(() => {
		const id = edit;
		if (!id) return;
		void remoteDetails(id).then((details) => {
			if (!details) return;
			untrack(() => {
				name = details.name;
				if (details.kind === 'webdav') ({ url, username } = details);
				else {
					({ endpoint, region, bucket, prefix, pathStyle, accessKeyId } = details);
					provider = 'other';
				}
			});
		});
	});

	function pickProvider(next: Provider) {
		provider = next;
		const preset = PROVIDERS[next];
		region = preset.region;
		pathStyle = preset.pathStyle;
		endpoint = preset.endpoint.replace('{region}', region);
	}

	function changeRegion(next: string) {
		region = next;
		const preset = PROVIDERS[provider].endpoint;
		if (preset.includes('{region}')) endpoint = preset.replace('{region}', next.trim());
	}

	/** HTTPS only (browsers block plain HTTP from an HTTPS page), except a server on this computer */
	const secure = (address: string) => /^https:\/\/[^/]+/i.test(address) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(address);

	const address = $derived(kind === 'webdav' ? url.trim() : endpoint.trim());
	const complete = $derived(
		secure(address) &&
			(!!secret || !!edit) &&
			(kind === 'webdav' ? !!username.trim() || !!edit : !!bucket.trim() && !!region.trim() && !!accessKeyId.trim())
	);

	function input(): RemoteInput {
		const host = (() => {
			try {
				return new URL(address).host;
			} catch {
				return address;
			}
		})();
		if (kind === 'webdav') return { kind, name: name.trim() || host, url: url.trim(), username: username.trim(), secret };
		const label = name.trim() || [bucket.trim(), prefix.trim()].filter(Boolean).join('/');
		return { kind, name: label, endpoint: endpoint.trim(), region: region.trim(), bucket: bucket.trim(), prefix: prefix.trim(), pathStyle, accessKeyId: accessKeyId.trim(), secret };
	}

	async function submit() {
		if (!complete || busy) return;
		busy = true;
		error = null;
		unreachable = false;
		try {
			const path = await connectRemote(input(), edit ?? undefined);
			onclose();
			onconnected(path);
		} catch (e) {
			if (e instanceof FilesError && e.code === 'offline') {
				unreachable = true;
				error = t.unreachable;
			} else if (e instanceof FilesError && e.code === 'notFound') error = t.notFound;
			else if (e instanceof FilesError && e.code === 'credentials') error = t.wrongCredentials;
			else {
				if (!(e instanceof FilesError)) console.error(e);
				error = filesErrorText(e);
			}
		} finally {
			busy = false;
		}
	}

	function start(dialog: HTMLDialogElement) {
		dialog.showModal();
	}
</script>

<dialog
	class="modal max-sm:modal-bottom"
	aria-labelledby={titleId}
	{@attach start}
	oncancel={(e) => {
		e.preventDefault();
		if (!busy) onclose();
	}}
>
	<form
		class="modal-box flex max-h-[calc(100dvh-2rem)] max-w-xl flex-col gap-3 overflow-y-auto max-sm:h-full max-sm:max-h-none max-sm:rounded-none"
		onsubmit={(e) => {
			e.preventDefault();
			void submit();
		}}
	>
		<h3 id={titleId} class="text-lg font-bold">{kind === 'webdav' ? (edit ? t.editWebdav : t.webdav) : edit ? t.editS3 : t.s3}</h3>
		<p class="text-sm opacity-80">{kind === 'webdav' ? t.webdavIntro : t.s3Intro}</p>

		{#if kind === 'webdav'}
			<label class="flex flex-col gap-1">
				<span class="text-sm font-medium">{t.url}</span>
				<input class="input w-full" type="url" bind:value={url} placeholder="https://cloud.example.com/remote.php/dav/files/anna/" autocomplete="url" spellcheck="false" />
			</label>
			<div class="grid gap-3 sm:grid-cols-2">
				<label class="flex flex-col gap-1">
					<span class="text-sm font-medium">{t.username}</span>
					<input class="input w-full" bind:value={username} autocomplete="username" autocapitalize="off" spellcheck="false" />
				</label>
				{@render secretField(t.password)}
			</div>
		{:else}
			<div class="grid gap-3 sm:grid-cols-2">
				<label class="flex flex-col gap-1">
					<span class="text-sm font-medium">{t.provider}</span>
					<select class="select w-full" value={provider} onchange={(e) => pickProvider(e.currentTarget.value as Provider)}>
						{#each Object.keys(PROVIDERS) as id (id)}
							<option value={id}>{t.providers[id as Provider]}</option>
						{/each}
					</select>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-sm font-medium">{t.region}</span>
					<input class="input w-full" value={region} oninput={(e) => changeRegion(e.currentTarget.value)} autocapitalize="off" spellcheck="false" />
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-sm font-medium">{t.bucket}</span>
					<input class="input w-full" bind:value={bucket} autocapitalize="off" spellcheck="false" />
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-sm font-medium">{t.prefix}</span>
					<input class="input w-full" bind:value={prefix} placeholder={t.prefixPlaceholder} autocapitalize="off" spellcheck="false" />
				</label>
			</div>
			<label class="flex flex-col gap-1">
				<span class="text-sm font-medium">{t.endpoint}</span>
				<input class="input w-full" type="url" bind:value={endpoint} spellcheck="false" />
			</label>
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" class="checkbox checkbox-sm" bind:checked={pathStyle} />
				{t.pathStyle}
			</label>
			<div class="grid gap-3 sm:grid-cols-2">
				<label class="flex flex-col gap-1">
					<span class="text-sm font-medium">{t.accessKeyId}</span>
					<input class="input w-full font-mono" bind:value={accessKeyId} autocomplete="username" autocapitalize="off" spellcheck="false" />
				</label>
				{@render secretField(t.secretKey)}
			</div>
		{/if}
		<label class="flex flex-col gap-1">
			<span class="text-sm font-medium">{t.name}</span>
			<input class="input w-full" bind:value={name} placeholder={t.namePlaceholder} maxlength="100" />
		</label>
		{#snippet secretField(label: string)}
			<label class="flex flex-col gap-1">
				<span class="text-sm font-medium">{label}</span>
				<input class="input w-full" type="password" bind:value={secret} placeholder={edit ? t.keepSecret : ''} autocomplete={edit ? 'off' : 'current-password'} />
			</label>
		{/snippet}
		{#if address && address !== 'https://' && !secure(address)}
			<p class="text-warning text-xs">{t.httpsOnly}</p>
		{/if}
		<p class="text-xs opacity-60">{t.secretStays}</p>
		<!-- One line kept for messages, so the buttons never jump -->
		<p role="alert" class="text-error min-h-5 text-sm">
			{#if error}
				{error}
				{#if unreachable}<a class="link" href={resolve('/help/connected') + '#servers'} target="_blank" rel="noopener">{t.corsHelp}</a>{/if}
			{/if}
		</p>
		<div class="modal-action mt-0">
			<button type="button" class="btn" onclick={onclose} disabled={busy}>{t.cancel}</button>
			<button class="btn btn-primary" disabled={!complete || busy}>
				{#if busy}<span class="loading loading-spinner loading-sm"></span>{/if}
				{edit ? t.save : t.connect}
			</button>
		</div>
	</form>
</dialog>
