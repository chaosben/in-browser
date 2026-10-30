// Central brand: name of the tool family (shown without domain ending) and its addresses.
export const BRAND = {
	suite: 'in-browser',
	suiteUrl: 'https://in-browser.org',
	/** Source code of all apps */
	repoUrl: 'https://github.com/chaosben/in-browser',
	/** Browser UI color per theme = `base-100` of the themes in `theme.css` (keep the manifests in sync) */
	themeColor: { light: '#ffffff', dark: '#1c1f25' }
} as const;
