import brand from '@in-browser/brand/i18n/en.js';
import help from './help.en.js';

// English texts. This file defines the structure; `de.ts` must have the same keys.

const en = {
	brand: {
		claim: 'tools that run entirely in your browser',
		description:
			'Free tools that run entirely in your browser: no uploads, no account – your files stay on your device.'
	},

	home: {
		title: 'Tools that run entirely in your browser',
		tagline: 'No uploads, no account – your files stay on your device.',
		searchLabel: 'Search tools',
		searchPlaceholder: 'Search tools …',
		noMatch: (query: string) => `No tool matches “${query}”.`,
		recent: 'Recently used',
		principlesHeading: 'Why in-browser?'
	},

	/** Sections of the launcher; a tool appears in its main category, the others only help the search */
	categories: {
		media: 'Media',
		writing: 'Writing',
		drawing: 'Drawing',
		organize: 'Organize'
	},

	/** Short points of the bar below the tools: keyword in bold, then a few words */
	principles: {
		local: { title: 'No uploads', text: 'your files stay on your device' },
		account: { title: 'No account', text: 'open the page and get started' },
		tracking: { title: 'No tracking', text: 'no cookies, no ads' },
		devices: { title: 'Sync without a cloud', text: 'directly between your devices' },
		offline: { title: 'Installable & offline', text: 'works without internet, too' },
		openSource: { title: 'Open source', text: 'MIT license', link: 'Source code on GitHub' }
	},

	footer: {
		openSource: 'Open source on GitHub',
		/** Third-party software the site ships, with its licenses */
		licenses: 'Licenses'
	},

	/** What a tool needs and this browser lacks: badge legend and the hidden text at the tool name */
	requires: {
		displayCapture: { legend: 'Works on a computer only', label: '(computer only)' }
	},

	/** `summary`: one line on the launcher; `keywords`: synonyms for the search (not shown) */
	tools: {
		screenCapture: {
			name: brand.tools['screen-capture'],
			summary: 'Record your screen, edit it and export it as video or GIF',
			keywords: 'record, recorder, screen recorder, screencast, video, webcam, microphone, gif, mp4, webm, tutorial'
		},
		files: {
			name: brand.tools['files'],
			summary: 'Manage, sync and download your files',
			keywords: 'file manager, explorer, folder, sync, upload, download, zip, preview, devices'
		},
		textEditor: {
			name: brand.tools['text-editor'],
			summary: 'Edit Markdown, JSON, YAML and code with syntax highlighting',
			keywords: 'text, editor, notepad, markdown, json, yaml, csv, html, css, javascript, code, txt'
		},
		pdfEditor: {
			name: brand.tools['pdf-editor'],
			summary: 'Write on and annotate PDFs, fill in forms, organize pages',
			keywords: 'pdf, annotate, comment, highlight, stamp, print, form, fill, merge, split, pages, rotate, sign, acrobat, viewer, handwriting, notebook, stylus, pen, sketch, draw'
		},
		fonts: {
			name: brand.tools['fonts'],
			summary: 'Add your own fonts for every tool, or install free ones',
			keywords: 'font, fonts, typeface, ttf, otf, install, google fonts, fontsource, typography'
		}
	},

	error: {
		notFound: 'This page does not exist.',
		other: 'Something went wrong.',
		back: 'Back to the overview'
	},

	/** Help pages of the whole suite (`/help/…`) */
	help
};

export default en;
