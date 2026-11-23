# Third-party licenses

The code in this repository is licensed under the [MIT License](LICENSE). The deployed site and the p2p-node bundle
the following third-party software. All of it is used unmodified. The full license texts ship with each package
(see the source links).

## Site

| Component | Version | License | Copyright | Used by | Source |
| --- | --- | --- | --- | --- | --- |
| [Svelte](https://svelte.dev) (runtime) | 5.57.3 | MIT | © 2016–2025 Svelte contributors | all | https://github.com/sveltejs/svelte |
| [SvelteKit](https://svelte.dev/docs/kit) (runtime) | 3.2.0 | MIT | © 2020 SvelteKit contributors | all | https://github.com/sveltejs/kit |
| [Tailwind CSS](https://tailwindcss.com) (generated CSS) | 4.3.5 | MIT | © Tailwind Labs, Inc. | all | https://github.com/tailwindlabs/tailwindcss |
| [daisyUI](https://daisyui.com) (CSS) | 5.8.1 | MIT | © 2020 Pouya Saadeghi | all | https://github.com/saadeghi/daisyui |
| Material Symbols Light (icons, `@iconify-json/material-symbols-light`) | 1.2.101 (Iconify set) | Apache-2.0 | © Google | all | https://github.com/google/material-design-icons |
| Material Symbols (icons, `@iconify-json/material-symbols`) | 1.2.100 (Iconify set) | Apache-2.0 | © Google | icon picker (Screen Capture) | https://github.com/google/material-design-icons |
| [Phosphor Icons](https://phosphoricons.com) (`@iconify-json/ph`) | 1.2.2 (Iconify set) | MIT | © Phosphor Icons | icon picker | https://github.com/phosphor-icons/core |
| [Tabler Icons](https://tabler.io/icons) (`@iconify-json/tabler`) | 1.2.46 (Iconify set) | MIT | © Paweł Kuna | icon picker | https://github.com/tabler/tabler-icons |
| [Trystero](https://github.com/dmotz/trystero) (`trystero`, `@trystero-p2p/core`, `@trystero-p2p/nostr`) | 0.27.0 | MIT | © 2021 Dan Motzenbecker | device sync | https://github.com/dmotz/trystero |
| [noble-secp256k1](https://github.com/paulmillr/noble-secp256k1) (`@noble/secp256k1`) | 3.2.0 | MIT | © 2019 Paul Miller | device sync (via Trystero) | https://github.com/paulmillr/noble-secp256k1 |
| [client-zip](https://github.com/Touffy/client-zip) (`client-zip`) | 2.5.1 | MIT | © 2020 David Junger | Files | https://github.com/Touffy/client-zip |
| [uqr](https://github.com/unjs/uqr) (`uqr`) | 0.1.3 | MIT | © Project Nayuki, © 2023 Anthony Fu | QR codes of pairing and sharing (`packages/files`) | https://github.com/unjs/uqr |
| [CodeMirror](https://codemirror.net) (`@codemirror/*`, `@lezer/*`, `style-mod`, `crelt`, `w3c-keyname`, `@marijn/find-cluster-break`) | 6.x (exact versions in `package-lock.json`) | MIT | © 2016–2024 Marijn Haverbeke and others | Text Editor | https://github.com/codemirror |
| [marked](https://marked.js.org) (`marked`) | 18.2.1 | MIT | © 2018+ MarkedJS, © 2011–2018 Christopher Jeffrey | Text Editor | https://github.com/markedjs/marked |
| [PDF.js](https://mozilla.github.io/pdf.js/) (`pdfjs-dist`) | 6.5.438 | Apache-2.0 | © Mozilla Foundation | PDF Editor | https://github.com/mozilla/pdf.js |
| PDF.js resources: Foxit standard fonts, JBIG2 decoder | (with PDF.js) | BSD-3-Clause | © 2014 PDFium Authors | PDF Editor | https://github.com/mozilla/pdf.js/tree/master/external |
| PDF.js resources: Liberation Sans fonts | (with PDF.js) | GPL-2.0 with font exception | © Red Hat, Inc. | PDF Editor | https://github.com/liberationfonts/liberation-fonts |
| PDF.js resources: Adobe CMaps | (with PDF.js) | BSD-3-Clause | © 1990–2009 Adobe Systems Incorporated | PDF Editor | https://github.com/adobe-type-tools/cmap-resources |
| PDF.js resources: OpenJPEG decoder | (with PDF.js) | BSD-2-Clause | © 2002–2014 Université catholique de Louvain, © 2024 Mozilla Foundation and others | PDF Editor | https://github.com/uclouvain/openjpeg |
| PDF.js resources: qcms | (with PDF.js) | MIT | © 2009–2024 Mozilla Corporation, © 1998–2007 Marti Maria | PDF Editor | https://github.com/FirefoxGraphics/qcms |
| [sql.js](https://sql.js.org) (`sql.js`, with its WebAssembly build) | 1.15.2 | MIT | © 2017 sql.js authors | PDF Editor (JW Library playlists, `packages/jwl`) | https://github.com/sql-js/sql.js |
| [SQLite](https://sqlite.org) (compiled into sql.js) | (with sql.js) | Public domain | – | PDF Editor (JW Library playlists) | https://sqlite.org/copyright.html |
| [fflate](https://github.com/101arrowz/fflate) (`fflate`) | 0.8.3 | MIT | © 2026 Arjun Barrett | PDF Editor (exported pictures as ZIP, JW Library playlists) | https://github.com/101arrowz/fflate |
| [noble-hashes](https://github.com/paulmillr/noble-hashes) (`@noble/hashes`) | 2.4.0 | MIT | © 2022 Paul Miller | PDF Editor (JW Library playlists) | https://github.com/paulmillr/noble-hashes |
| PDF.js resources: QuickJS | (with PDF.js) | MIT | © 2017–2021 Fabrice Bellard, Charlie Gordon; © 2026 Mozilla Foundation | PDF Editor (form scripts) | https://bellard.org/quickjs/ |
| [pdf-lib](https://pdf-lib.js.org) (`pdf-lib`, `@pdf-lib/standard-fonts`) | 1.17.1 | MIT | © 2018–2019 Andrew Dillon | PDF Editor | https://github.com/Hopding/pdf-lib |
| [fontkit for pdf-lib](https://github.com/Hopding/fontkit) (`@pdf-lib/fontkit`) | 1.1.1 | MIT | Devon Govett, Andrew Dillon (authors in its package.json; the package ships no LICENSE file) | PDF Editor (fonts of text boxes, via pdf-lib) | https://github.com/Hopding/fontkit |
| [UPNG.js](https://github.com/photopea/UPNG.js) (`@pdf-lib/upng`) | 1.0.1 | MIT | © 2017 Photopea | PDF Editor (via pdf-lib) | https://github.com/Hopding/upng |
| [pako](https://github.com/nodeca/pako) (`pako`) | 1.0.11 | MIT and Zlib | © 2014–2017 Vitaly Puzrin and Andrei Tuputcyn | PDF Editor (via pdf-lib and fontkit) | https://github.com/nodeca/pako |
| [tslib](https://github.com/microsoft/tslib) (`tslib`) | 1.14.1 | 0BSD | © Microsoft Corporation | PDF Editor (via pdf-lib) | https://github.com/microsoft/tslib |
| [Mediabunny](https://mediabunny.dev) (`mediabunny`) | 1.66.0 | MPL-2.0 | © Vanilagy | Screen Capture | https://github.com/Vanilagy/mediabunny/tree/v1.66.0 |
| [gifenc](https://github.com/mattdesl/gifenc) (`gifenc`) | 1.0.3 | MIT | © 2017 Matt DesLauriers | Screen Capture | https://github.com/mattdesl/gifenc |
| [Inter](https://rsms.me/inter/) (font, `@fontsource/inter`) | 5.3.0 | OFL-1.1 | © 2016 The Inter Project Authors | Screen Capture | https://github.com/rsms/inter |
| [Montserrat](https://github.com/JulietaUla/Montserrat) (font, `@fontsource/montserrat`) | 5.3.0 | OFL-1.1 | © 2011 The Montserrat Project Authors | Screen Capture | https://github.com/JulietaUla/Montserrat |
| [JetBrains Mono](https://www.jetbrains.com/lp/mono/) (font, `@fontsource/jetbrains-mono`) | 5.3.0 | OFL-1.1 | © 2020 The JetBrains Mono Project Authors | Screen Capture | https://github.com/JetBrains/JetBrainsMono |
| [Caveat](https://github.com/googlefonts/caveat) (font, `@fontsource/caveat`) | 5.3.0 | OFL-1.1 | © 2014 The Caveat Project Authors | Screen Capture | https://github.com/googlefonts/caveat |

## p2p-node

The sync process of the [p2p-node](packages/p2p-node/README.md) (`/p2p-node/peer-<commit>.js`) bundles, besides
Trystero and noble-secp256k1 (see above):

| Component | Version | License | Copyright | Source |
| --- | --- | --- | --- | --- |
| [werift](https://github.com/shinyoshiaki/werift-webrtc) (`werift`) | 0.27.0 | MIT | © shinyoshiaki | https://github.com/shinyoshiaki/werift-webrtc |
| libwebrtc (portions ported in werift) | – | BSD-3-Clause | © 2011 The WebRTC project authors | https://webrtc.googlesource.com/src |
| [Mediabunny](https://mediabunny.dev) (`mediabunny`, via werift) | 1.66.0 | MPL-2.0 | © Vanilagy | https://github.com/Vanilagy/mediabunny/tree/v1.66.0 |
| [buffer](https://github.com/feross/buffer) (`buffer`) | 6.0.3 | MIT | © Feross Aboukhadijeh and contributors | https://github.com/feross/buffer |
| [base64-js](https://github.com/beatgammit/base64-js) (`base64-js`) | 1.5.1 | MIT | © 2014 Jameson Little | https://github.com/beatgammit/base64-js |
| [ieee754](https://github.com/feross/ieee754) (`ieee754`) | 1.2.1 | BSD-3-Clause | © 2008 Fair Oaks Labs, Inc. | https://github.com/feross/ieee754 |
| [multicast-dns](https://github.com/mafintosh/multicast-dns) (`multicast-dns`) | 7.2.5 | MIT | © 2015 Mathias Buus | https://github.com/mafintosh/multicast-dns |
| [dns-packet](https://github.com/mafintosh/dns-packet) (`dns-packet`) | 5.6.1 | MIT | © 2016 Mathias Buus | https://github.com/mafintosh/dns-packet |
| [thunky](https://github.com/mafintosh/thunky) (`thunky`) | 1.1.0 | MIT | © 2018 Mathias Buus | https://github.com/mafintosh/thunky |
| [ip-codec](https://github.com/martinheidegger/ip-codec) (`@leichtgewicht/ip-codec`) | 2.0.5 | MIT | © 2021 Martin Heidegger | https://github.com/martinheidegger/ip-codec |

## Mediabunny (MPL-2.0)

Screen Capture (compiled and minified) and the p2p-node (bundled, not minified) include Mediabunny unmodified,
under the [Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/). The source code of exactly this
version is available at https://github.com/Vanilagy/mediabunny/tree/v1.66.0. The MPL applies to Mediabunny's files
only; it does not extend to the rest of this project.

## Apache-2.0: Material Symbols, PDF.js

The icons are part of Google's Material Symbols, and the PDF Editor includes Mozilla's PDF.js, both licensed under the
[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0). The icons are embedded as CSS by the Iconify
Tailwind plugin or loaded as Iconify JSON; their shapes are unchanged. PDF.js is used as published in `pdfjs-dist`; the PDF Editor's text layer styles (`packages/pdf/src/text-layer.css`) are the `.textLayer` rules of its `web/pdf_viewer.css`, unchanged, with our own rules added.

## Fonts

Screen Capture embeds Inter, Montserrat, JetBrains Mono and Caveat (WOFF2 from Fontsource) under the
[SIL Open Font License 1.1](https://openfontlicense.org). The PDF Editor ships the standard fonts of PDF.js for rendering
PDFs: the Foxit fonts (BSD-3-Clause) and Liberation Sans (GPL-2.0 with the font exception: embedding the font in a
document does not put the document under the GPL). All fonts are unmodified; their sources are linked above.

## BSD, Zlib, 0BSD

The BSD-licensed parts (PDF.js resources, ieee754, libwebrtc portions in werift), pako (Zlib) and tslib (0BSD) are
redistributed unmodified; their copyright notices are listed above and their full license texts ship with each
package.

## Build tools

Development and build tools such as Vite, Vitest, Playwright, TypeScript, svelte-check, Wrangler, ws and lightningcss
(MPL-2.0) are not part of the deployed apps. Neither are their dependencies (e.g. the optional sharp/libvips
binaries, LGPL-3.0, pulled in by Wrangler). Their licenses apply when you install them via npm; this repository does
not redistribute them.
