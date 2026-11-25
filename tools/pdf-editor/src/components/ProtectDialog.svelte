<script lang="ts">
	// “Password and permissions …”: what protects the PDF now, and a new protection – a password to open it and/or
	// restrictions other programs keep to without a second password (AES-256 always) – or none. Applying writes the
	// file anew (the editor does it and offers to undo it).
	import Modal from '@in-browser/brand/Modal.svelte';
	import type { NewProtection, Permission } from '@in-browser/pdf/crypt.js';
	import { m } from '#lib/i18n/index.js';
	import type { PdfDocument } from '#lib/model/document.svelte.js';
	import { forgetPassword, hasRememberedPassword } from '#lib/model/password.svelte.js';

	interface Props {
		doc: PdfDocument;
		/** `protection` null: none; `remember`: keep the new password on this device */
		onapply: (protection: NewProtection | null, remember: boolean) => void;
		onclose: () => void;
	}

	let { doc, onapply, onclose }: Props = $props();

	/** The permissions offered, in this order (accessibility is always allowed) */
	const OFFERED: Permission[] = ['print', 'printHigh', 'copy', 'annotate', 'fillForms', 'assemble', 'modify'];

	// svelte-ignore state_referenced_locally
	const now = doc.protection;
	let needOpen = $state(now?.needsPassword ?? false);
	let user = $state('');
	let userAgain = $state('');
	let restrict = $state(!!now && OFFERED.some((p) => !now.permissions.includes(p)));
	let owner = $state('');
	let ownerAgain = $state('');
	let allowed = $state<Permission[]>(now ? OFFERED.filter((p) => now.permissions.includes(p)) : ['print', 'printHigh', 'fillForms', 'annotate']);
	let remember = $state(false);
	let remembered = $state(false);
	// svelte-ignore state_referenced_locally
	void hasRememberedPassword(doc.path).then((v) => (remembered = v));

	/** What opens the file now: kept when a field is left empty (“Unchanged”) – only what we know */
	// svelte-ignore state_referenced_locally
	const knownUser = now?.needsPassword ? (now.openedAs === 'user' ? doc.password : null) : '';
	// svelte-ignore state_referenced_locally
	const knownOwner = now?.openedAs === 'owner' ? doc.password : null;
	const wasRestricted = !!now && OFFERED.some((p) => !now.permissions.includes(p));
	const keepsUser = $derived(!!now?.needsPassword && knownUser !== null && !user && !userAgain);
	const keepsOwner = $derived(wasRestricted && knownOwner !== null && !owner && !ownerAgain);
	const userWill = $derived(keepsUser ? knownUser! : user);
	const ownerWill = $derived(keepsOwner ? knownOwner! : owner);

	const problem = $derived.by(() => {
		if (needOpen && !userWill) return m.protect.empty;
		if (needOpen && !keepsUser && user !== userAgain) return m.protect.mismatch;
		if (restrict && !keepsOwner && owner !== ownerAgain) return m.protect.mismatch;
		if (restrict && ownerWill && ownerWill === userWill) return m.protect.same;
		return null;
	});
	/** Anything different from the file as it is (the boxes are the switch: both off removes the protection) */
	const changed = $derived(
		!now
			? needOpen || restrict
			: needOpen !== now.needsPassword ||
					restrict !== wasRestricted ||
					(needOpen && !keepsUser) ||
					(restrict && (!keepsOwner || OFFERED.some((p) => allowed.includes(p) !== now.permissions.includes(p))))
	);
	const ready = $derived(changed && (!(needOpen || restrict) || !problem));
	const outcome = $derived(!changed ? m.protect.outcome.same : needOpen && restrict ? m.protect.outcome.both : needOpen ? m.protect.outcome.open : restrict ? m.protect.outcome.restricted : m.protect.outcome.none);

	const stateText = $derived(!now ? m.protect.state.none : now.needsPassword ? m.protect.state.open(m.protect.methods[now.method]) : m.protect.state.restricted(m.protect.methods[now.method]));

	function toggle(p: Permission, on: boolean) {
		allowed = on ? [...allowed, p] : allowed.filter((a) => a !== p && !(p === 'print' && a === 'printHigh'));
	}

	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!ready) return;
		if (!needOpen && !restrict) return onapply(null, false);
		onapply({ user: needOpen ? userWill : '', owner: restrict ? ownerWill : '', permissions: restrict ? allowed : OFFERED }, needOpen && !keepsUser && remember);
	}
</script>

<Modal {onclose} labelledby="protect-title">
	<form class="modal-box flex max-w-md flex-col gap-3" onsubmit={submit}>
		<h3 id="protect-title" class="flex items-center gap-2 text-lg font-bold">
			<span class="icon-[material-symbols-light--shield-lock-outline] size-6" aria-hidden="true"></span>
			{m.protect.title}
		</h3>
		<p class="text-sm">{stateText}</p>

		<label class="flex items-center gap-2 text-sm font-medium">
			<input type="checkbox" class="checkbox checkbox-sm" bind:checked={needOpen} />
			{m.protect.openPassword}
		</label>
		<div class="grid grid-cols-2 gap-2 pl-6">
			<input class="input input-sm" type="password" autocomplete="new-password" aria-label={m.protect.password} placeholder={now?.needsPassword && knownUser !== null ? m.protect.unchanged : m.protect.password} bind:value={user} disabled={!needOpen} />
			<input class="input input-sm" type="password" autocomplete="new-password" aria-label={m.protect.repeat} placeholder={now?.needsPassword && knownUser !== null ? m.protect.unchanged : m.protect.repeat} bind:value={userAgain} disabled={!needOpen} />
			<label class="col-span-2 flex items-center gap-2 text-sm">
				<input type="checkbox" class="checkbox checkbox-sm" bind:checked={remember} disabled={!needOpen} />
				{m.protect.remember}
			</label>
		</div>

		<label class="flex items-center gap-2 text-sm font-medium">
			<input type="checkbox" class="checkbox checkbox-sm" bind:checked={restrict} />
			{m.protect.restrict}
		</label>
		<div class="flex flex-col gap-2 pl-6">
			<div class="grid grid-cols-2 gap-2">
				<input class="input input-sm" type="password" autocomplete="new-password" aria-label={m.protect.ownerPassword} placeholder={wasRestricted && knownOwner !== null ? m.protect.unchanged : m.protect.ownerPassword} bind:value={owner} disabled={!restrict} />
				<input class="input input-sm" type="password" autocomplete="new-password" aria-label={m.protect.repeat} placeholder={wasRestricted && knownOwner !== null ? m.protect.unchanged : m.protect.repeat} bind:value={ownerAgain} disabled={!restrict} />
			</div>
			<fieldset class="grid grid-cols-1 gap-1 sm:grid-cols-2" disabled={!restrict}>
				<legend class="mb-1 text-xs opacity-70">{m.protect.allowed}</legend>
				{#each OFFERED as p (p)}
					<label class="flex items-center gap-2 text-sm">
						<input type="checkbox" class="checkbox checkbox-xs" checked={allowed.includes(p)} disabled={p === 'printHigh' && !allowed.includes('print')} onchange={(e) => toggle(p, e.currentTarget.checked)} />
						{m.protect.permissions[p]}
					</label>
				{/each}
			</fieldset>
		</div>

		<p class="text-xs opacity-70">{m.protect.hint}</p>
		<p class="text-sm font-medium" aria-live="polite">{outcome}</p>
		<!-- Always there, so nothing jumps -->
		<p class={['text-error text-sm', !(problem && (needOpen || restrict) && (user || owner || userAgain || ownerAgain)) && 'invisible']}>{problem ?? '–'}</p>

		<div class="modal-action mt-0 flex-wrap">
			<button
				type="button"
				class="btn btn-ghost btn-sm mr-auto"
				disabled={!remembered}
				onclick={async () => {
					await forgetPassword(doc.path);
					remembered = false;
				}}>{m.protect.forget}</button
			>
			<button type="button" class="btn btn-ghost btn-sm" onclick={onclose}>{m.common.cancel}</button>
			<button type="submit" class="btn btn-primary btn-sm" disabled={!ready}>{m.protect.apply}</button>
		</div>
	</form>
</Modal>
