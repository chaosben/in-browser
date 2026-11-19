import type { Component } from 'svelte';
import type { TableFormat } from './table/model.js';
import { looksLikeIni } from './tree/ini-detect.js';
import type { TreeFormat } from './tree/model.js';
import type { ViewProps } from './types.js';

// Which file gets which view next to its text. A file type is one entry: how its name looks and the views it offers
// (the first one is the default). Components and formats are only loaded when a file needs them.

export type ViewId = 'markdown' | 'html' | 'svg' | 'table' | 'tree';

export interface ViewSpec {
	id: ViewId;
	/** Read-only previews don't change the text */
	editable: boolean;
	component: () => Promise<Component<ViewProps>>;
	/** Table or tree format the component works on */
	format?: () => Promise<TableFormat | TreeFormat>;
}

export interface FileViews {
	/** Key for the remembered choice of view (e.g. `.jsonl`) */
	type: string;
	views: ViewSpec[];
}

const markdown: ViewSpec = {
	id: 'markdown',
	editable: false,
	component: async () => (await import('./preview/MarkdownPreview.svelte')).default
};
const html: ViewSpec = { id: 'html', editable: false, component: async () => (await import('./preview/HtmlPreview.svelte')).default };
const svg: ViewSpec = { id: 'svg', editable: false, component: async () => (await import('./preview/SvgPreview.svelte')).default };

const table = (format: () => Promise<TableFormat>): ViewSpec => ({
	id: 'table',
	editable: true,
	component: async () => (await import('./table/TableView.svelte')).default,
	format
});
const tree = (format: () => Promise<TreeFormat>): ViewSpec => ({
	id: 'tree',
	editable: true,
	component: async () => (await import('./tree/TreeView.svelte')).default,
	format
});

const csv = (delimiter?: string) => table(async () => (await import('./table/csv.js')).csvFormat(delimiter));
const json = tree(async () => (await import('./tree/json.js')).jsonFormat);
const yaml = tree(async () => (await import('./tree/yaml.js')).yamlFormat);
const toml = tree(async () => (await import('./tree/toml.js')).tomlFormat);
const xml = tree(async () => (await import('./tree/xml.js')).xmlFormat);
const ini = (dialect: 'ini' | 'properties' | 'env') => tree(async () => (await import('./tree/ini.js')).iniFormat(dialect));
const jsonlTable = table(async () => (await import('./table/jsonl.js')).jsonlFormat);
const jsonlTree = tree(async () => (await import('./tree/jsonl.js')).jsonlTreeFormat);

const BY_EXTENSION: Record<string, ViewSpec[]> = {
	'.md': [markdown],
	'.markdown': [markdown],
	'.html': [html],
	'.htm': [html],
	'.svg': [svg, xml],
	'.csv': [csv()],
	'.tsv': [csv('\t')],
	'.json': [json],
	'.jsonl': [jsonlTable, jsonlTree],
	'.ndjson': [jsonlTable, jsonlTree],
	'.yml': [yaml],
	'.yaml': [yaml],
	'.toml': [toml],
	'.xml': [xml],
	'.ini': [ini('ini')],
	'.cfg': [ini('ini')],
	'.conf': [ini('ini')],
	'.properties': [ini('properties')]
};

/** `.env`, `.env.local`, `.env.production` … (dot files: no extension of their own) */
const ENV = /^\.env(\..+)?$/i;

/**
 * Views of a file, by its name; `null` when it has none. `.conf` files only get one when their text looks like INI
 * (`text`; there are many other formats with that ending).
 */
export function viewsOf(name: string, text: () => string): FileViews | null {
	if (ENV.test(name)) return { type: '.env', views: [ini('env')] };
	const dot = name.lastIndexOf('.');
	const type = dot > 0 ? name.slice(dot).toLowerCase() : '';
	const views = BY_EXTENSION[type];
	if (!views) return null;
	if (type === '.conf' && !looksLikeIni(text())) return null;
	return { type, views };
}
