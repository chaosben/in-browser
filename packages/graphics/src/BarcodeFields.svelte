<script lang="ts">
	// The fields a barcode is made with, for every tool: its kind, its content (a QR code's also by a template: a
	// Wi-Fi, a contact …), colors, error correction, the text below and the quiet zone – and the code as it will
	// look, or why the content can't be a code of that kind. The tool decides what happens with it: it keeps `spec`
	// and gets the drawing (`barcodeSvg` of `barcode.ts` makes it again from the spec).
	import { onMount } from 'svelte';
	import { BARCODE_GROUPS, BARCODE_TYPES, barcodeSvg, barcodeTypes, scanRisk, type BarcodeDrawing, type BarcodeProblem, type BarcodeSpec, type BarcodeType } from './barcode.js';
	import ColorField from './ColorField.svelte';
	import { parseColor } from './color.js';
	import { graphicsMessages } from './i18n/index.svelte.js';
	import { EMPTY_QR_FIELDS, QR_TEMPLATE_FIELDS, QR_TEMPLATES, qrContent, WIFI_SECURITIES, type QrFields, type QrTemplate } from './qr-content.js';

	let { spec = $bindable(), drawing = $bindable(null) }: { spec: BarcodeSpec; drawing?: BarcodeDrawing | null } = $props();

	const m = $derived(graphicsMessages().barcode);
	const uid = $props.id();

	/** The listed kinds at once, the library's others once it is loaded */
	let types = $state.raw<readonly BarcodeType[]>(BARCODE_TYPES);
	onMount(() => {
		void barcodeTypes().then((all) => (types = all));
	});
	const type = $derived(types.find((t) => t.id === spec.kind));
	const nameOf = (t: BarcodeType) => m.names[t.id] ?? t.name;

	// A code that is opened to be changed comes as its text
	let template = $state<QrTemplate>('text');
	let fields = $state<QrFields>({ ...EMPTY_QR_FIELDS, text: spec.text });
	/** Only a plain QR code is read by phones as a Wi-Fi, a contact … */
	const templated = $derived(spec.kind === 'qrcode');
	$effect(() => {
		spec.text = templated ? qrContent(template, fields) : fields.text.trim();
	});

	let result = $state.raw<BarcodeDrawing | { problem: BarcodeProblem; detail?: string } | null>(null);
	$effect(() => {
		const wanted = $state.snapshot(spec);
		let stale = false;
		void barcodeSvg(wanted).then((made) => {
			if (stale) return;
			result = made;
			drawing = 'problem' in made ? null : made;
		});
		return () => (stale = true);
	});
	const problem = $derived.by(() => {
		if (!result || !('problem' in result)) return '';
		const text = m.problems[result.problem];
		return result.detail ? m.detail(text, result.detail) : text;
	});
	const risk = $derived(scanRisk(spec));

	function pickKind(kind: string) {
		spec.kind = kind;
		spec.ecc = undefined;
	}

	/** A color field opens below its button, inside the window */
	function place(e: ToggleEvent) {
		const popover = e.currentTarget as HTMLElement;
		const button = document.querySelector<HTMLElement>(`[popovertarget="${popover.id}"]`);
		if (e.newState !== 'open' || !button) return;
		const rect = button.getBoundingClientRect();
		popover.style.top = `${Math.max(4, Math.min(rect.bottom + 4, innerHeight - popover.offsetHeight - 4))}px`;
		popover.style.left = `${Math.max(4, Math.min(rect.left, innerWidth - popover.offsetWidth - 4))}px`;
	}
</script>

{#snippet colorButton(id: string, label: string, value: string | null)}
	<div class="flex flex-col gap-1">
		<span class="text-sm opacity-70">{label}</span>
		<button type="button" class="btn btn-sm justify-start font-normal" popovertarget={id} aria-label={label}>
			<!-- "None" as an empty, struck-through swatch -->
			<span
				class={['border-base-content/30 size-4 rounded-sm border', value === null && 'bg-[linear-gradient(to_top_right,transparent_45%,currentColor_45%,currentColor_55%,transparent_55%)]']}
				style:background-color={value}
			></span>
			{value === null ? graphicsMessages().color.none : parseColor(value).hex}
		</button>
	</div>
{/snippet}

<label class="flex flex-col gap-1">
	<span class="text-sm opacity-70">{m.kind}</span>
	<select class="select select-sm w-full" value={spec.kind} onchange={(e) => pickKind(e.currentTarget.value)}>
		{#each BARCODE_GROUPS as group (group)}
			{@const inGroup = types.filter((t) => t.group === group)}
			{#if inGroup.length}
				<optgroup label={m.groups[group]}>
					{#each inGroup as t (t.id)}<option value={t.id}>{nameOf(t)}</option>{/each}
				</optgroup>
			{/if}
		{/each}
	</select>
</label>

<!-- Always there, disabled for the kinds without it: nothing moves when the kind changes. The fields are plain text
fields (only the keyboard follows what is asked for): the browser would refuse “example.org” as an address -->
<label class="flex flex-col gap-1">
	<span class="text-sm opacity-70">{m.contentAs}</span>
	<select class="select select-sm w-full" bind:value={template} disabled={!templated}>
		{#each QR_TEMPLATES as t (t)}<option value={t}>{m.templates[t]}</option>{/each}
	</select>
</label>

{#if !templated}
	<label class="flex flex-col gap-1">
		<span class="text-sm opacity-70">{m.content}</span>
		<input class="input input-sm w-full" inputmode={type?.digits ? 'numeric' : 'text'} autocomplete="off" bind:value={fields.text} />
	</label>
{:else}
	{#each QR_TEMPLATE_FIELDS[template] as field (field)}
		{#if field === 'hidden'}
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" class="checkbox checkbox-sm" bind:checked={fields.hidden} />
				{m.fields.hidden}
			</label>
		{:else}
			<label class="flex flex-col gap-1">
				<span class="text-sm opacity-70">{template === 'text' ? m.content : m.fields[field]}</span>
				{#if field === 'security'}
					<select class="select select-sm w-full" bind:value={fields.security}>
						{#each WIFI_SECURITIES as s (s)}<option value={s}>{m.securities[s]}</option>{/each}
					</select>
				{:else if field === 'text' || field === 'body' || field === 'message' || field === 'address'}
					<textarea class="textarea textarea-sm w-full" rows={field === 'text' ? 3 : 2} bind:value={fields[field]}></textarea>
				{:else}
					<input
						class="input input-sm w-full"
						inputmode={field === 'email' ? 'email' : field === 'phone' ? 'tel' : field === 'url' ? 'url' : 'text'}
						autocomplete="off"
						autocapitalize={field === 'ssid' || field === 'password' ? 'off' : undefined}
						spellcheck={field === 'ssid' || field === 'password' ? false : undefined}
						disabled={field === 'password' && fields.security === 'nopass'}
						bind:value={fields[field]}
					/>
				{/if}
			</label>
		{/if}
	{/each}
{/if}

<div class="grid grid-cols-2 gap-x-3 gap-y-2">
	{@render colorButton(`${uid}-dark`, m.color, spec.dark)}
	{@render colorButton(`${uid}-light`, m.background, spec.light)}
	<label class="col-span-2 flex flex-col gap-1">
		<span class="text-sm opacity-70">{m.ecc}</span>
		<select class="select select-sm w-full" disabled={!type?.ecc} value={type?.ecc ? (spec.ecc ?? type.ecc[0]) : ''} onchange={(e) => (spec.ecc = e.currentTarget.value)}>
			{#each type?.ecc ?? [] as level (level)}<option value={level}>{m.eccLevels[level] ?? m.eccLevel(level)}</option>{/each}
		</select>
	</label>
	<label class="flex items-center gap-2 text-sm">
		<input type="checkbox" class="checkbox checkbox-sm" bind:checked={spec.showText} disabled={!!type?.matrix} />
		{m.showText}
	</label>
	<label class="flex items-center gap-2 text-sm">
		<input type="checkbox" class="checkbox checkbox-sm" bind:checked={spec.quiet} />
		{m.quiet}
	</label>
</div>

<!-- The code in its colors on paper – white whatever the theme, since that is what it will lie on. The room is
always there, so nothing jumps -->
<div class="flex h-36 items-center justify-center rounded-sm bg-white p-2">
	{#if result && !('problem' in result)}
		<svg viewBox="0 0 {result.width} {result.height}" class="max-h-full max-w-full" role="img" aria-label={m.preview(type ? nameOf(type) : spec.kind, spec.text)} shape-rendering="crispEdges">
			{#if result.light}<rect width={result.width} height={result.height} fill={result.light} />{/if}
			<g transform="translate({result.x} {result.y})">
				{#each result.paths as path, i (i)}
					{#if path.stroke}<path d={path.d} fill="none" stroke={result.dark} stroke-width={path.stroke} />{:else}<path d={path.d} fill={result.dark} />{/if}
				{/each}
			</g>
		</svg>
	{/if}
</div>
<!-- One line for why there is no code, or what may keep a scanner from reading it -->
{#if problem}
	<p class={['min-h-10 text-sm', result && 'problem' in result && result.problem === 'empty' ? 'opacity-70' : 'text-error']} role={result && 'problem' in result && result.problem !== 'empty' ? 'alert' : undefined}>{problem}</p>
{:else}
	<p class="text-warning min-h-10 text-sm" role="status">{risk ? m.risks[risk] : ''}</p>
{/if}

<div id="{uid}-dark" popover class="bg-base-100 text-base-content border-base-300 rounded-box m-0 w-72 border p-3 shadow" ontoggle={place}>
	<ColorField value={spec.dark} opaque onchange={(value) => (spec.dark = value ?? '#000000')} />
</div>
<div id="{uid}-light" popover class="bg-base-100 text-base-content border-base-300 rounded-box m-0 w-72 border p-3 shadow" ontoggle={place}>
	<ColorField value={spec.light} allowNone opaque onchange={(value) => (spec.light = value)} />
</div>
