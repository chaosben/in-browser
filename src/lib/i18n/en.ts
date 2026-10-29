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
		toolsHeading: 'Tools',
		open: 'Open',
		openTool: (name: string) => `Open ${name}`,
		principlesHeading: 'Why in-browser?'
	},

	principles: {
		local: {
			title: 'No uploads',
			text: 'Everything is processed right on your device. Your files never leave the browser.'
		},
		account: {
			title: 'No account',
			text: 'Open the page and get started – no sign-up, no email address.'
		},
		tracking: {
			title: 'No tracking',
			text: 'No cookies, no analytics, no ads.'
		},
		offline: {
			title: 'Installable & offline',
			text: 'Every tool can be installed as an app and then works without an internet connection, too.'
		},
		openSource: {
			title: 'Open source',
			text: 'All code is public under the MIT license – check for yourself what happens with your files.',
			link: 'Source code on GitHub'
		}
	},

	footer: {
		openSource: 'Open source on GitHub'
	},

	/** Details shown as tooltip of the requirement badge */
	requiresHint: {
		desktopBrowser: 'Runs in current desktop browsers – works best in Chrome or Edge',
		anyBrowser: 'Runs in current browsers – syncing with a folder needs Chrome or Edge'
	},

	requires: {
		desktopBrowser: 'Desktop browser',
		anyBrowser: 'Any current browser'
	},

	tools: {
		screenCapture: {
			name: 'Screen Capture',
			description:
				'Record your screen, edit it on multiple tracks and export it as MP4 – like a small Camtasia in your browser.',
			features: [
				'Record screen, webcam and microphone at once – as linked, separate tracks',
				'Multi-track editing: picture in picture, music and voice-over with their own volume',
				'Cut, still frames and pan & zoom that stay in sync across all tracks',
				'Arrows, frames, text, highlighter, spotlight and blur',
				'Export as MP4 in your choice of resolution and quality'
			]
		},
		files: {
			name: 'Files',
			description:
				'The file manager for everything you create with the in-browser tools – and the bridge to a folder on your computer.',
			features: [
				'Folders, rename, copy, move, delete – with drag & drop and right-click',
				'Upload files and folders, download as file or ZIP',
				'Preview of images, videos, audio and text',
				'Opens projects directly in their tool',
				'Keeps everything in sync with a folder on your computer – the newer version wins'
			]
		}
	},

	error: {
		notFound: 'This page does not exist.',
		other: 'Something went wrong.',
		back: 'Back to the overview'
	}
};

export default en;
