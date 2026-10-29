# Third-party licenses

The code in this repository is licensed under the [MIT License](LICENSE). The deployed site bundles the following
third-party software. All of it is used unmodified.

| Component | Version | License | Copyright | Source |
| --- | --- | --- | --- | --- |
| [Svelte](https://svelte.dev) (runtime) | 5.57 | MIT | © 2016–2025 Svelte contributors | https://github.com/sveltejs/svelte |
| [SvelteKit](https://svelte.dev/docs/kit) (runtime) | 3.1 | MIT | © 2020 SvelteKit contributors | https://github.com/sveltejs/kit |
| [Tailwind CSS](https://tailwindcss.com) (generated CSS) | 4.3 | MIT | © Tailwind Labs, Inc. | https://github.com/tailwindlabs/tailwindcss |
| [daisyUI](https://daisyui.com) (CSS) | 5.7 | MIT | © 2020 Pouya Saadeghi | https://github.com/saadeghi/daisyui |
| [Material Symbols Light](https://fonts.google.com/icons) (icons, via Iconify) | 1.2.97 (Iconify set) | Apache-2.0 | © Google | https://github.com/google/material-design-icons |
| [Mediabunny](https://mediabunny.dev) (Screen Capture only) | 1.62.1 | MPL-2.0 | © Vanilagy | https://github.com/Vanilagy/mediabunny/tree/v1.62.1 |
| [client-zip](https://github.com/Touffy/client-zip) (Files only) | 2.5.1 | MIT | © 2020 David Junger | https://github.com/Touffy/client-zip |

## Mediabunny (MPL-2.0)

Screen Capture includes Mediabunny unmodified, in compiled and minified form, under the
[Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/). The source code of exactly this version is
available at https://github.com/Vanilagy/mediabunny/tree/v1.62.1. The MPL applies to Mediabunny's files only; it
does not extend to the rest of this project.

## Material Symbols (Apache-2.0)

The icons are part of Google's Material Symbols, licensed under the
[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0). They are embedded as CSS by the Iconify Tailwind
plugin; the icon shapes themselves are unchanged.

## Build tools

Development and build tools such as Vite, Vitest, TypeScript, svelte-check, Wrangler and lightningcss (MPL-2.0)
are not part of the deployed apps. Neither are their dependencies (e.g. the optional sharp/libvips binaries,
LGPL-3.0, pulled in by Wrangler). Their licenses apply when you install them via npm; this repository does not
redistribute them.
