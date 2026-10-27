<script lang="ts">
	import { BRAND } from '@in-browser/brand/brand.js';
	import { m } from '#lib/i18n/index.svelte.js';
	import { TOOLS } from '#lib/tools.js';

	const PRINCIPLES = [
		{ key: 'local', icon: 'icon-[material-symbols-light--cloud-off-outline]' },
		{ key: 'account', icon: 'icon-[material-symbols-light--no-accounts-outline]' },
		{ key: 'tracking', icon: 'icon-[material-symbols-light--visibility-off-outline]' },
		{ key: 'offline', icon: 'icon-[material-symbols-light--offline-pin-outline]' },
		{ key: 'openSource', icon: 'icon-[material-symbols-light--code-blocks-outline]' }
	] as const;
</script>

<main class="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-10 sm:py-16">
	<section class="flex flex-col gap-3">
		<h1 class="text-3xl font-bold text-balance sm:text-5xl">{m.home.title}</h1>
		<p class="text-lg opacity-70">{m.home.tagline}</p>
	</section>

	<section class="flex flex-col gap-4" aria-labelledby="tools-heading">
		<h2 id="tools-heading" class="text-xl font-semibold">{m.home.toolsHeading}</h2>
		<ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each TOOLS as tool (tool.id)}
				{@const text = m.tools[tool.id]}
				<li class="card bg-base-200 hover:bg-base-300 relative transition-colors">
					<div class="card-body gap-3">
						<div class="flex items-center gap-3">
							<img src={tool.icon} alt="" class="size-12" width="48" height="48" />
							<h3 class="card-title">
								<!-- Invisibly stretched over the whole card: makes the card clickable -->
								<a href={tool.url} class="after:absolute after:inset-0 after:rounded-box">{text.name}</a>
							</h3>
						</div>
						<p>{text.description}</p>
						<ul class="flex flex-col gap-1 text-sm opacity-80">
							{#each text.features as feature (feature)}
								<li class="flex gap-1.5">
									<span class="icon-[material-symbols-light--check] text-success size-5 shrink-0" aria-hidden="true"></span>
									{feature}
								</li>
							{/each}
						</ul>
						<div class="card-actions mt-auto items-center justify-between pt-2">
							<span class="badge badge-outline badge-sm gap-1" title={m.requiresHint[tool.requires]}>
								<span class="icon-[material-symbols-light--desktop-windows-outline] size-4" aria-hidden="true"></span>
								{m.requires[tool.requires]}
							</span>
							<span class="btn btn-primary btn-sm" aria-hidden="true">
								{m.home.open}
								<span class="icon-[material-symbols-light--arrow-forward] size-5"></span>
							</span>
						</div>
					</div>
				</li>
			{/each}
		</ul>
	</section>

	<section class="flex flex-col gap-4" aria-labelledby="principles-heading">
		<h2 id="principles-heading" class="text-xl font-semibold">{m.home.principlesHeading}</h2>
		<ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
			{#each PRINCIPLES as principle (principle.key)}
				<li class="rounded-box border-base-300 flex flex-col gap-2 border p-4">
					<span class="{principle.icon} text-primary size-8" aria-hidden="true"></span>
					<h3 class="font-semibold">{m.principles[principle.key].title}</h3>
					<p class="text-sm opacity-70">{m.principles[principle.key].text}</p>
					{#if principle.key === 'openSource'}
						<a class="link link-primary mt-auto text-sm" href={BRAND.repoUrl} target="_blank" rel="noopener">
							{m.principles.openSource.link}
						</a>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
</main>
