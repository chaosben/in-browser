<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { m } from '#lib/i18n/index.svelte.js';
	import Shell from '#lib/Shell.svelte';
</script>

<!-- Unknown paths get the shell 404.html; the frame switches to the browser language like the home page -->
<Shell>
	<main class="mx-auto flex w-full max-w-5xl flex-col items-start gap-4 px-4 py-16">
		<h1 class="text-5xl font-bold opacity-30">{page.status}</h1>
		<p class="text-lg">{page.status === 404 ? m.error.notFound : m.error.other}</p>
		<a class="btn btn-primary" href={resolve('/')}>
			<span class="icon-[material-symbols-light--home-outline] size-5" aria-hidden="true"></span>
			{m.error.back}
		</a>
	</main>
</Shell>
