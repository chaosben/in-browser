<script lang="ts">
	// One backup or playlist (`ui.md` “One document per page”): the ribbon with the tab “File” first, the view chosen in
	// “Home” → “Show” (overview, notes, highlights, bookmarks, tags, playlists), each view's commands on a contextual tab.
	// Every change is one undo step of `JwlDocument` and saved by itself.
	import { onDestroy, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { setBrandBar } from '@in-browser/brand/brand-bar.svelte.js';
	import { saveStateOf, setBrandFooter } from '@in-browser/brand/brand-footer.svelte.js';
	import { installCommandKeys, type Command } from '@in-browser/brand/commands.js';
	import { downloadBlob } from '@in-browser/brand/download.js';
	import { toolName } from '@in-browser/brand/i18n/index.svelte.js';
	import { formatDateTime } from '@in-browser/brand/i18n/tool.js';
	import Modal from '@in-browser/brand/Modal.svelte';
	import Ribbon from '@in-browser/brand/Ribbon.svelte';
	import TagField from '@in-browser/brand/TagField.svelte';
	import type { RibbonTab } from '@in-browser/brand/ribbon.js';
	import { type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { Picker } from '@in-browser/brand/ui/pick.svelte.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { chooseFile, chooseFiles } from '@in-browser/files/dialog.svelte.js';
	import { ExternalVersions, flushWhenHidden, lockDocument } from '@in-browser/files/documents.js';
	import { filesUrl } from '@in-browser/files/formats.js';
	import { canWrite, read, watch, writable, write } from '@in-browser/files/fs.js';
	import { filesErrorText } from '@in-browser/files/i18n/index.svelte.js';
	import { basename, normalize, parent, stem } from '@in-browser/files/path.js';
	import { sendCommand } from '@in-browser/files/send.js';
	import { shareCommand } from '@in-browser/files/share-dialog.svelte.js';
	import { accessAction } from '@in-browser/files/sources/connections.svelte.js';
	import {
		addItems,
		addTag,
		cleanable,
		cleanUp,
		deleteBookmarks,
		deleteMarks,
		deleteNotes,
		deletePlaylists,
		deleteTags,
		editItem,
		editNote,
		freePlaylistName,
		importPlaylists,
		itemKind,
		itemSeconds,
		itemTrim,
		locationName,
		mergeTags,
		moveItems,
		playlistData,
		playlists,
		publicationOf,
		recolorMarks,
		removeItems,
		renamePlaylist,
		renameTag,
		reorder,
		setNoteTags,
		trimItem,
		tagsOfNote,
		userTags,
		type NewItem
	} from '@in-browser/jwl/edits.js';
	import { DEVICE_NAME, JwlError, readJwl, writeJwl } from '@in-browser/jwl/jwl-file.js';
	import { TAG_PLAYLIST, TAG_USER, parseTime, tagKey, type JwlData } from '@in-browser/jwl/model.js';
	import { intlLocale, m } from '#lib/i18n/index.js';
	import { JwlDocument } from '#lib/model/document.svelte.js';
	import { MEDIA_EXTENSIONS, isVideo, newItem } from '#lib/model/media.js';
	import { recent } from '#lib/model/recent.js';
	import EntryList from '#lib/views/EntryList.svelte';
	import TrimDialog, { clock } from '#lib/views/TrimDialog.svelte';

	type View = 'overview' | 'notes' | 'highlights' | 'bookmarks' | 'tags' | 'playlists';
	const VIEWS: View[] = ['overview', 'notes', 'highlights', 'bookmarks', 'tags', 'playlists'];
	const ICONS: Record<View, string> = {
		overview: 'icon-[material-symbols-light--info-outline]',
		notes: 'icon-[material-symbols-light--sticky-note-2-outline]',
		highlights: 'icon-[material-symbols-light--ink-highlighter-outline]',
		bookmarks: 'icon-[material-symbols-light--bookmark-outline]',
		tags: 'icon-[material-symbols-light--sell-outline]',
		playlists: 'icon-[material-symbols-light--playlist-play]'
	};
	/** JW Library's highlight colors by `ColorIndex` (the document's colors, the same in both themes) */
	const COLORS = ['#d4d4d4', '#fde047', '#86efac', '#93c5fd', '#f9a8d4', '#fdba74', '#c4b5fd'];

	let doc = $state.raw<JwlDocument | null>(null);
	let error = $state<string | null>(null);
	let access = $state<{ label: string; run: () => Promise<void> } | undefined>(undefined);
	let readOnly = $state(false);
	let view = $state<View>('overview');
	/** The playlist shown in “Playlists” (a playlist file: its one playlist) */
	let openList = $state<string | null>(null);
	let query = $state('');
	/** Notes shown only with these tags (keys): all of them, or one of them */
	let tagFilter = $state<string[]>([]);
	let tagMatch = $state<'all' | 'any'>('all');
	const pick = new Picker<string>();
	/**
	 * The dialog of notes: one note's title and text (`text`), and the tags of the notes – those all have (`tags`) and
	 * those only some have (`partial`); `before` is what they had when it opened
	 */
	let editing = $state<{ guids: string[]; text: boolean; title: string; content: string; tags: string[]; partial: string[]; before: string[] } | null>(null);
	/** The tag field of the notes' filter */
	let filterInput = $state<HTMLInputElement>();
	/** The playlist item being trimmed */
	let trimming = $state<string | null>(null);
	/** The tag renamed in place */
	let renaming = $state<string | null>(null);
	let adding = $state(false);
	let reload: ((quiet: boolean) => Promise<void>) | null = null;
	let input = $state<HTMLInputElement>();

	const data = $derived(doc?.data ?? null);
	const isBackup = $derived(doc?.kind === 'backup');
	const editable = () => !!doc && !readOnly;

	// --- Opening (one tab edits a file; a version saved elsewhere is asked about) ---

	function errorText(e: unknown): string {
		if (e instanceof JwlError) return m.editor[e.reason];
		return m.editor.loadFailed(filesErrorText(e));
	}

	$effect(() => {
		const path = normalize(page.url.searchParams.get('path') ?? '');
		let disposed = false;
		let release: (() => void) | null = null;
		let stopWatch: (() => void) | null = null;
		const external = new ExternalVersions();

		const open = async (quiet: boolean) => {
			const next = await JwlDocument.open(path);
			if (disposed) return;
			untrack(() => {
				doc?.dispose();
				doc = next;
				if (next.kind === 'playlist') {
					view = 'playlists';
					openList = playlists(next.data)[0]?.key ?? null;
				} else if (openList && !next.data.tags.has(openList)) openList = null;
				pick.clear();
			});
			if (!quiet) toast(m.editor.reloaded(next.name));
		};

		(async () => {
			try {
				release = await lockDocument(`jwl-files:${path}`);
				if (disposed) return release?.();
				if (!release) {
					error = m.editor.openElsewhere;
					return;
				}
				readOnly = !(await canWrite(path));
				await open(true);
				recent.remember(path);
				reload = open;
				stopWatch = watch(async (paths) => {
					const current = untrack(() => doc);
					if (!current || (await current.external(paths)) !== 'reload') return;
					if (!(await external.shouldReload(current.name, String(Date.now())))) return;
					if (!disposed && !current.dirty) await open(!external.silent).catch((e) => console.error('[jwl] reload', e));
				});
			} catch (e) {
				console.error('[jwl] open', e);
				error = errorText(e);
				access = accessAction(e, () => location.reload());
			}
		})();

		const stopFlush = flushWhenHidden(() => void untrack(() => doc)?.flush());
		return () => {
			disposed = true;
			reload = null;
			stopWatch?.();
			stopFlush();
			const current = untrack(() => doc);
			void current?.flush();
			current?.dispose();
			release?.();
		};
	});

	// --- What the views list ---

	/** The tags filtered by that still exist */
	const filtering = $derived(data ? tagFilter.filter((k) => data.tags.has(k)) : []);

	const notes = $derived.by(() => {
		if (!data) return [];
		const q = query.trim().toLowerCase();
		const byTags = (guid: string) => {
			if (!filtering.length) return true;
			const on = tagsOfNote(data, guid);
			return tagMatch === 'all' ? filtering.every((k) => on.includes(k)) : filtering.some((k) => on.includes(k));
		};
		return [...data.notes.values()]
			.filter((n) => !q || `${n.title ?? ''}\n${n.content ?? ''}`.toLowerCase().includes(q))
			.filter((n) => byTags(n.guid))
			.sort((a, b) => (parseTime(b.modified) || 0) - (parseTime(a.modified) || 0))
			.map((n) => ({
				id: n.guid,
				note: n,
				place: locationName(n.loc ? data.locations.get(n.loc) : undefined),
				tags: tagsOfNote(data, n.guid).map((k) => data.tags.get(k)?.name ?? '')
			}));
	});

	/** Highlights by publication and color */
	const highlights = $derived.by(() => {
		if (!data) return [];
		const groups = new Map<string, { id: string; publication: string; color: number; guids: string[]; styles: Set<number> }>();
		for (const mark of data.marks.values()) {
			const publication = publicationOf(data.locations.get(mark.loc)) || '–';
			const id = `${publication}\x1f${mark.color}`;
			const group = groups.get(id) ?? { id, publication, color: mark.color, guids: [], styles: new Set<number>() };
			group.guids.push(mark.guid);
			group.styles.add(mark.style);
			groups.set(id, group);
		}
		return [...groups.values()].sort((a, b) => a.publication.localeCompare(b.publication) || a.color - b.color);
	});

	const bookmarks = $derived.by(() => {
		if (!data) return [];
		return [...data.bookmarks]
			.map(([id, b]) => ({ id, bookmark: b, publication: locationName(data.locations.get(b.publication)) || publicationOf(data.locations.get(b.publication)) }))
			.sort((a, b) => a.publication.localeCompare(b.publication) || a.bookmark.slot - b.bookmark.slot);
	});

	const tags = $derived(data ? userTags(data).map((t) => ({ id: t.key, ...t })) : []);
	const lists = $derived(data ? playlists(data).map((p) => ({ id: p.key, ...p })) : []);
	const list = $derived(lists.find((l) => l.key === openList) ?? null);
	const items = $derived(data && list ? list.items.map((key) => ({ id: key, item: data.playlists.get(key)! })) : []);

	/** The ids the open view lists */
	const shown = $derived.by((): string[] => {
		if (view === 'notes') return notes.map((r) => r.id);
		if (view === 'highlights') return highlights.map((r) => r.id);
		if (view === 'bookmarks') return bookmarks.map((r) => r.id);
		if (view === 'tags') return tags.map((r) => r.id);
		if (view === 'playlists') return list ? items.map((r) => r.id) : lists.map((r) => r.id);
		return [];
	});
	const selected = $derived(pick.ordered(shown));

	// A change of view or playlist starts without a selection; entries gone drop out of it
	$effect(() => {
		void view;
		void openList;
		untrack(() => pick.clear());
	});
	$effect(() => {
		const ids = shown;
		untrack(() => pick.keep(ids));
	});

	// --- Changes ---

	function change(next: JwlData, files?: Map<string, Blob>) {
		if (!doc || readOnly) return;
		doc.change(next, files);
	}

	function show(next: View) {
		view = next;
		query = '';
		if (doc?.kind === 'backup' && next !== 'playlists') openList = null;
	}

	function remove() {
		if (!data || !selected.length) return;
		if (view === 'notes') change(deleteNotes(data, selected));
		else if (view === 'highlights') change(deleteMarks(data, highlights.filter((g) => selected.includes(g.id)).flatMap((g) => g.guids)));
		else if (view === 'bookmarks') change(deleteBookmarks(data, selected));
		else if (view === 'tags') change(deleteTags(data, selected));
		else if (view === 'playlists') change(list ? removeItems(data, selected) : deletePlaylists(data, selected));
	}

	function openNote(guid: string) {
		const note = data?.notes.get(guid);
		if (!data || !note) return;
		const tags = tagsOfNote(data, guid);
		editing = { guids: [guid], text: true, title: note.title ?? '', content: note.content ?? '', tags, partial: [], before: tags };
	}

	/** “Tags …”: the tags of the selected notes */
	function openTags(guids: string[]) {
		if (!data || !guids.length) return;
		const of = guids.map((g) => tagsOfNote(data, g));
		const any = [...new Set(of.flat())];
		const tags = any.filter((k) => of.every((t) => t.includes(k)));
		editing = { guids, text: false, title: '', content: '', tags, partial: any.filter((k) => !tags.includes(k)), before: any };
	}

	/** “Done”: title, text and tags as one step */
	function keepNote() {
		if (!editing || !data) return;
		const { guids, tags, partial, before } = editing;
		let next = editing.text ? editNote(data, guids[0], { title: editing.title, content: editing.content }) : data;
		const all = guids.map((g) => tagsOfNote(data, g));
		const on = tags.filter((k) => !all.every((t) => t.includes(k)));
		const off = before.filter((k) => !tags.includes(k) && !partial.includes(k));
		if (on.length || off.length) next = setNoteTags(next, guids, on, off);
		if (next !== data) change(next);
		editing = null;
	}

	const tagOptions = $derived(tags.map((t) => ({ id: t.id, label: t.name })));
	const newTagKey = (name: string) => tagKey({ type: TAG_USER, name });

	function newTag() {
		if (!data) return;
		let name = m.tags.newName;
		for (let i = 2; data.tags.has(`1|${name}`); i++) name = `${m.tags.newName} ${i}`;
		const added = addTag(data, name);
		change(added.data);
		show('tags');
		pick.only(added.key);
		renaming = added.key;
	}

	function rename(key: string, name: string) {
		renaming = null;
		if (data) change(renameTag(data, key, name));
	}

	/** An empty playlist in the backup, picked and named in place */
	function newPlaylist() {
		if (!data) return;
		const added = addTag(data, freePlaylistName(data, m.playlists.newName), TAG_PLAYLIST);
		change(added.data);
		show('playlists');
		openList = null;
		pick.only(added.key);
		renaming = added.key;
	}

	function renameList(key: string, name: string) {
		renaming = null;
		const tag = data?.tags.get(key);
		if (!data || !tag || !name.trim() || name.trim() === tag.name) return;
		if (data.tags.has(tagKey({ type: TAG_PLAYLIST, name: name.trim() }))) return toast(m.playlists.taken(name.trim()), 'info');
		change(renamePlaylist(data, key, name));
	}

	async function exportNotes() {
		if (!doc || !data) return;
		const chosen = view === 'notes' && selected.length ? notes.filter((n) => selected.includes(n.id)) : notes;
		const text = chosen
			.map(({ note, place, tags: names }) =>
				[note.title || m.notes.untitled, [place, formatDateTime(parseTime(note.modified) || 0, intlLocale), names.filter(Boolean).join(', ')].filter(Boolean).join(' · '), '', note.content ?? ''].join('\n')
			)
			.join('\n\n---\n\n');
		const path = await chooseFile({ mode: 'save', folder: parent(doc.path), accept: ['.txt'], name: m.notes.fileName(stem(doc.name)) });
		if (!path) return;
		try {
			await write(path, new Blob([text], { type: 'text/plain' }));
			toast(m.notes.exported(basename(path)), 'success');
		} catch (e) {
			toast(filesErrorText(e), 'error', 8000);
		}
	}

	async function exportPlaylist() {
		if (!doc || !data || !list) return;
		const path = await chooseFile({ mode: 'save', folder: parent(doc.path), accept: ['.jwlplaylist'], name: `${list.name}.jwlplaylist`, title: m.playlists.saveTitle });
		if (!path) return;
		try {
			await writeJwl(
				{ kind: 'playlist', name: list.name, deviceName: DEVICE_NAME, data: playlistData(data, list.key), template: doc.file.database, files: doc.files },
				await writable(path)
			);
			toast(m.playlists.exported(basename(path)), 'success');
		} catch (e) {
			console.error('[jwl] export playlist', e);
			toast(filesErrorText(e), 'error', 8000);
		}
	}

	/** A `.jwlplaylist` of the files: a playlist of the backup, or (a playlist file) its items appended */
	async function importPlaylist() {
		if (!doc || !data) return;
		const path = await chooseFile({ mode: 'open', folder: parent(doc.path), accept: ['.jwlplaylist'], title: m.playlists.openTitle });
		if (!path) return;
		try {
			const other = await readJwl(await read(path));
			if (other.kind !== 'playlist') return toast(m.playlists.notPlaylist, 'error');
			const files = new Map([...doc.files, ...other.files]);
			let next = importPlaylists(data, other.data);
			if (!isBackup && openList) {
				const added = playlists(next).filter((p) => !data.tags.has(p.key)).map((p) => p.key);
				next = mergeTags(next, added, openList);
			}
			change(next, files);
			toast(m.playlists.imported(basename(path)), 'success');
		} catch (e) {
			console.error('[jwl] import playlist', e);
			toast(e instanceof JwlError ? m.playlists.notPlaylist : filesErrorText(e), 'error', 8000);
		}
	}

	async function addMedia(files: File[]) {
		if (!doc || !data || !openList || !files.length) return;
		adding = true;
		const made: NewItem[] = [];
		const blobs = new Map(doc.files);
		for (const file of files) {
			try {
				const { item, files: parts } = await newItem(file, isVideo(file.type) ? 0 : 2);
				made.push(item);
				for (const [hash, blob] of parts) blobs.set(hash, blob);
			} catch (e) {
				console.error('[jwl] add', e);
				toast(m.playlists.addFailed(file.name), 'error', 8000);
			}
		}
		adding = false;
		if (made.length && doc.data) change(addItems(doc.data, openList, made), blobs);
	}

	async function addFromFiles() {
		const paths = await chooseFiles({ mode: 'open', multiple: true, folder: doc ? parent(doc.path) : '/', accept: MEDIA_EXTENSIONS, title: m.playlists.mediaTitle });
		if (paths?.length) await addMedia(await Promise.all(paths.map((p) => read(p))));
	}

	/** “Merge with …”: another backup of the files taken into this one – one undo step, saved like every change */
	async function merge() {
		if (!doc || !isBackup) return;
		const current = doc;
		const path = await chooseFile({ mode: 'open', folder: parent(current.path), accept: ['.jwlibrary'], title: m.merge.chooseTitle(current.name) });
		if (!path) return;
		if (path === current.path) return toast(m.merge.same, 'info');
		try {
			const other = await readJwl(await read(path));
			if (other.kind !== 'backup') return toast(m.merge.notBackup, 'error');
			const done = current.merge(other);
			if (!done) return toast(m.merge.unchanged(basename(path)), 'info', 6000);
			toast(m.merge.done(basename(path), done), 'success', 10000, { label: m.merge.undo, run: () => current.undo() });
		} catch (e) {
			console.error('[jwl] merge', e);
			toast(e instanceof JwlError ? m.editor[e.reason] : m.merge.failed(filesErrorText(e)), 'error', 8000);
		}
	}

	async function download() {
		if (!doc) return;
		try {
			await doc.flush();
			downloadBlob(await read(doc.path), doc.name);
		} catch (e) {
			toast(filesErrorText(e), 'error', 8000);
		}
	}

	// --- Commands ---

	const has = () => selected.length > 0;
	const backupOnly = () => isBackup;
	const viewCommand = (v: View): Command => ({
		id: `view:${v}`,
		label: m.views[v],
		icon: ICONS[v],
		enabled: () => !!doc && (v === 'overview' || v === 'playlists' || isBackup),
		active: () => view === v,
		run: () => show(v)
	});

	const commands = {
		undo: { id: 'undo', label: m.commands.undo, icon: 'icon-[material-symbols-light--undo]', shortcut: { key: 'z', ctrl: true }, enabled: () => !!doc?.canUndo && editable(), run: () => doc?.undo() },
		redo: { id: 'redo', label: m.commands.redo, icon: 'icon-[material-symbols-light--redo]', shortcut: { key: 'y', ctrl: true }, enabled: () => !!doc?.canRedo && editable(), run: () => doc?.redo() },
		download: { id: 'download', label: m.commands.download, tip: m.commands.downloadTip, icon: 'icon-[material-symbols-light--download]', enabled: () => !!doc, run: () => void download() },
		send: sendCommand(() => doc?.path),
		share: shareCommand(() => doc?.path),
		merge: {
			id: 'merge',
			label: m.commands.merge,
			tip: m.commands.mergeTip,
			icon: 'icon-[material-symbols-light--merge]',
			enabled: () => isBackup && editable(),
			run: () => void merge()
		},
		showInFiles: { id: 'showInFiles', label: m.commands.showInFiles, icon: 'icon-[material-symbols-light--open-in-new]', enabled: () => !!doc, run: () => doc && location.assign(filesUrl(doc.path)) },
		exportNotes: { id: 'exportNotes', label: m.commands.exportNotes, tip: m.commands.exportNotesTip, icon: 'icon-[material-symbols-light--file-export-outline]', enabled: () => !!data?.notes.size, run: () => void exportNotes() },
		selectAll: { id: 'selectAll', label: m.commands.selectAll, icon: 'icon-[material-symbols-light--select-all]', enabled: () => shown.length > 0, run: () => pick.selectAll(shown) },
		clearSelection: { id: 'clearSelection', label: m.commands.clearSelection, icon: 'icon-[material-symbols-light--deselect]', enabled: has, run: () => pick.clear() },
		delete: {
			id: 'delete',
			label: m.commands.delete,
			icon: 'icon-[material-symbols-light--delete-outline]',
			shortcut: { key: 'Delete' },
			enabled: () => has() && editable() && view !== 'overview',
			run: remove
		},
		editNote: {
			id: 'editNote',
			label: m.commands.editNote,
			icon: 'icon-[material-symbols-light--edit-outline]',
			enabled: () => view === 'notes' && selected.length === 1 && editable(),
			run: () => openNote(selected[0])
		},
		tagNotes: {
			id: 'tagNotes',
			label: m.commands.tagNotes,
			icon: 'icon-[material-symbols-light--sell-outline]',
			enabled: () => view === 'notes' && has() && editable(),
			run: () => openTags(selected)
		},
		filterTags: {
			id: 'filterTags',
			label: m.commands.filterTags,
			tip: m.commands.filterTagsTip,
			icon: 'icon-[material-symbols-light--filter-alt-outline]',
			active: () => filtering.length > 0,
			enabled: () => view === 'notes' && tags.length > 0,
			run: () => filterInput?.focus()
		},
		recolor: {
			id: 'recolor',
			label: m.commands.recolor,
			icon: 'icon-[material-symbols-light--palette-outline]',
			enabled: () => view === 'highlights' && has() && editable(),
			menu: () => colorMenu()
		},
		cleanUp: {
			id: 'cleanUp',
			label: m.commands.cleanUp,
			tip: m.commands.cleanUpTip,
			icon: 'icon-[material-symbols-light--cleaning-services-outline]',
			enabled: () => !!data && editable() && isBackup,
			run: () => {
				if (!data) return;
				const found = cleanable(data);
				const n = found.marks.length + found.tags.length;
				if (!n) return toast(m.highlights.nothingToClean);
				change(cleanUp(data));
				toast(m.highlights.cleaned(n), 'success');
			}
		},
		newTag: { id: 'newTag', label: m.commands.newTag, icon: 'icon-[material-symbols-light--label-outline]', enabled: () => editable() && isBackup, run: newTag },
		rename: {
			id: 'rename',
			label: m.commands.rename,
			icon: 'icon-[material-symbols-light--drive-file-rename-outline]',
			shortcut: { key: 'F2' },
			enabled: () => (view === 'tags' || (view === 'playlists' && !list && isBackup)) && selected.length === 1 && editable(),
			run: () => (renaming = selected[0])
		},
		mergeInto: {
			id: 'mergeInto',
			label: m.commands.mergeInto,
			icon: 'icon-[material-symbols-light--call-merge]',
			enabled: () => view === 'tags' && has() && tags.length > selected.length && editable(),
			menu: () => tags.filter((t) => !selected.includes(t.id)).map((t) => ({ label: t.name, run: () => data && change(mergeTags(data, selected, t.id)) }))
		},
		openPlaylist: {
			id: 'openPlaylist',
			label: m.commands.openPlaylist,
			icon: 'icon-[material-symbols-light--folder-open-outline]',
			enabled: () => view === 'playlists' && !list && selected.length === 1,
			run: () => (openList = selected[0])
		},
		backToPlaylists: {
			id: 'backToPlaylists',
			label: m.commands.backToPlaylists,
			icon: 'icon-[material-symbols-light--arrow-back]',
			enabled: () => !!list && isBackup,
			run: () => (openList = null)
		},
		newPlaylist: { id: 'newPlaylist', label: m.commands.newPlaylist, tip: m.commands.newPlaylistTip, icon: 'icon-[material-symbols-light--playlist-add]', enabled: () => editable() && isBackup, run: newPlaylist },
		importPlaylist: { id: 'importPlaylist', label: m.commands.importPlaylist, tip: m.commands.importPlaylistTip, icon: 'icon-[material-symbols-light--library-add-outline]', enabled: () => editable() && isBackup, run: () => void importPlaylist() },
		appendPlaylist: { id: 'appendPlaylist', label: m.commands.appendPlaylist, tip: m.commands.appendPlaylistTip, icon: 'icon-[material-symbols-light--playlist-add]', enabled: () => editable() && !isBackup && !!list, run: () => void importPlaylist() },
		exportPlaylist: { id: 'exportPlaylist', label: m.commands.exportPlaylist, tip: m.commands.exportPlaylistTip, icon: 'icon-[material-symbols-light--publish]', enabled: () => !!list && isBackup, run: () => void exportPlaylist() },
		deletePlaylist: {
			id: 'deletePlaylist',
			label: m.commands.deletePlaylist,
			icon: 'icon-[material-symbols-light--delete-outline]',
			enabled: () => editable() && isBackup && (!!list || (view === 'playlists' && has())),
			run: () => {
				if (!data) return;
				const keys = list ? [list.key] : selected;
				openList = null;
				change(deletePlaylists(data, keys));
			}
		},
		addMedia: {
			id: 'addMedia',
			label: m.commands.addMedia,
			tip: m.commands.addMediaTip,
			icon: 'icon-[material-symbols-light--add-photo-alternate-outline]',
			enabled: () => !!list && editable() && !adding,
			run: () => void addFromFiles(),
			menu: (): MenuEntry[] => [
				{ label: m.commands.addMedia, icon: 'icon-[material-symbols-light--folder-open-outline]', run: () => void addFromFiles() },
				{ label: m.commands.addFromDevice, icon: 'icon-[material-symbols-light--upload-file-outline]', run: () => input?.click() }
			]
		},
		moveUp: {
			id: 'moveUp',
			label: m.commands.moveUp,
			icon: 'icon-[material-symbols-light--arrow-upward]',
			shortcut: { key: 'ArrowUp', alt: true },
			enabled: () => !!list && has() && editable() && selected[0] !== list.items[0],
			run: () => data && list && change(moveItems(data, list.key, selected, -1))
		},
		moveDown: {
			id: 'moveDown',
			label: m.commands.moveDown,
			icon: 'icon-[material-symbols-light--arrow-downward]',
			shortcut: { key: 'ArrowDown', alt: true },
			enabled: () => !!list && has() && editable() && selected.at(-1) !== list.items.at(-1),
			run: () => data && list && change(moveItems(data, list.key, selected, 1))
		},
		trim: {
			id: 'trim',
			label: m.commands.trim,
			tip: m.commands.trimTip,
			icon: 'icon-[material-symbols-light--content-cut]',
			enabled: () => {
				const item = list && selected.length === 1 ? data?.playlists.get(selected[0]) : undefined;
				return !!item && !!data && editable() && ['video', 'audio'].includes(itemKind(data, item)) && !!itemTrim(item);
			},
			run: () => (trimming = selected[0])
		},
		removeItems: { id: 'removeItems', label: m.commands.removeItems, icon: 'icon-[material-symbols-light--playlist-remove]', enabled: () => !!list && has() && editable(), run: () => data && change(removeItems(data, selected)) }
	} satisfies Record<string, Command>;

	function colorMenu(): MenuEntry[] {
		if (!data) return [];
		const guids = highlights.filter((g) => selected.includes(g.id)).flatMap((g) => g.guids);
		return COLORS.map((_, color) => ({
			label: m.highlights.colors[color],
			glyph: '4,4 20,4 20,20 4,20 4,4',
			run: () => change(recolorMarks(data, guids, color))
		})).slice(1);
	}

	const views = VIEWS.map(viewCommand);
	const g = m.ribbon.groups;
	const tabs: RibbonTab[] = [
		{
			id: 'file',
			label: m.ribbon.tabs.file,
			groups: [
				{ id: 'file', label: g.file, items: [commands.download, commands.merge, commands.showInFiles] },
				{ id: 'share', label: g.share, items: [commands.share, commands.send] },
				{ id: 'export', label: g.export, items: [commands.exportNotes, commands.exportPlaylist] }
			]
		},
		{
			id: 'home',
			label: m.ribbon.tabs.home,
			groups: [
				{ id: 'show', label: g.show, items: views },
				{ id: 'select', label: g.select, items: [commands.selectAll, commands.clearSelection, commands.delete] }
			]
		},
		{
			id: 'notes',
			label: m.ribbon.tabs.notes,
			contextual: true,
			visible: () => view === 'notes',
			groups: [
				{ id: 'note', label: g.note, items: [commands.editNote, commands.tagNotes, commands.delete] },
				{ id: 'filter', label: g.filter, items: [commands.filterTags] },
				{ id: 'export', label: g.export, items: [commands.exportNotes] }
			]
		},
		{
			id: 'highlights',
			label: m.ribbon.tabs.highlights,
			contextual: true,
			visible: () => view === 'highlights',
			groups: [
				{ id: 'color', label: g.color, items: [commands.recolor, commands.delete] },
				{ id: 'tidy', label: g.tidy, items: [commands.cleanUp] }
			]
		},
		{
			id: 'tags',
			label: m.ribbon.tabs.tags,
			contextual: true,
			visible: () => view === 'tags',
			groups: [
				{ id: 'tag', label: g.tag, items: [commands.newTag, commands.rename, commands.mergeInto, commands.delete] },
				{ id: 'tidy', label: g.tidy, items: [commands.cleanUp] }
			]
		},
		{
			id: 'playlist',
			label: m.ribbon.tabs.playlist,
			contextual: true,
			visible: () => view === 'playlists',
			groups: [
				{ id: 'playlists', label: g.playlists, items: [commands.newPlaylist, commands.openPlaylist, commands.backToPlaylists, commands.importPlaylist, commands.exportPlaylist, commands.deletePlaylist] },
				{ id: 'items', label: g.items, items: [commands.addMedia, commands.appendPlaylist, commands.trim, commands.removeItems] },
				{ id: 'order', label: g.order, items: [commands.moveUp, commands.moveDown] }
			]
		}
	];

	$effect(() => installCommandKeys(() => (doc && !editing && !trimming ? Object.values(commands) : [])));

	// --- Menus of entries ---

	const entryMenu = (...cmds: Command[]): MenuEntry[] => cmds.map((c) => ({ label: c.label, icon: c.icon, disabled: c.enabled ? !c.enabled() : false, run: () => c.run?.() }));

	// --- Thumbnails of playlist items (object URLs, freed when the page goes) ---

	const urls = new Map<string, string>();
	function thumbnailUrl(hash: string | null): string | null {
		const blob = hash ? doc?.files.get(hash) : null;
		if (!hash || !blob) return null;
		let url = urls.get(hash);
		if (!url) {
			url = URL.createObjectURL(blob);
			urls.set(hash, url);
		}
		return url;
	}
	onDestroy(() => {
		for (const url of urls.values()) URL.revokeObjectURL(url);
	});

	// --- Frame ---

	$effect(() => {
		const current = doc;
		if (!current) return setBrandBar({ crumbs: [{ label: m.editor.back, href: resolve('/jwl-files') }] });
		const playlist = list;
		if (isBackup && playlist) return setBrandBar({ crumbs: [{ label: current.name, onclick: () => (openList = null) }, { label: playlist.name }] });
		return setBrandBar({ crumbs: [{ label: current.name }] });
	});

	const total = $derived(shown.length);
	$effect(() => setBrandFooter({ status: view === 'overview' ? null : footerStatus, save: doc ? saveStateOf(doc) : null }));

	const date = (ms: number) => (ms ? formatDateTime(ms, intlLocale) : '');
</script>

<svelte:head>
	{#if doc}<title>{doc.name} · {toolName('jwl-files')}</title>{/if}
</svelte:head>

{#snippet footerStatus()}
	<span>{selected.length ? m.status.selected(selected.length) : total}</span>
{/snippet}

<input
	bind:this={input}
	type="file"
	multiple
	hidden
	accept={MEDIA_EXTENSIONS.join(',')}
	onchange={(e) => {
		void addMedia([...(e.currentTarget.files ?? [])]);
		e.currentTarget.value = '';
	}}
/>

{#if error}
	<div class="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
		<p class="max-w-md">{error}</p>
		<div class="flex gap-2">
			{#if access}<button class="btn btn-primary" onclick={access.run}>{access.label}</button>{/if}
			<a class="btn" href={resolve('/jwl-files')}>{m.editor.back}</a>
		</div>
	</div>
{:else if !doc || !data}
	<div class="flex h-full items-center justify-center"><span class="loading loading-spinner"></span></div>
{:else}
	{@const current = doc}
	<div class="flex h-full min-h-0 flex-col">
		<Ribbon {tabs} quick={[commands.undo, commands.redo]} storage="jwl-files" initial="home" />
		{#if current.conflict}
			<div role="alert" class="alert alert-warning rounded-none py-2 text-sm">
				<span class="icon-[material-symbols-light--warning-outline] size-5" aria-hidden="true"></span>
				<span>{m.editor.changed(current.name)}</span>
				<div class="flex gap-2">
					<button class="btn btn-sm" onclick={() => void reload?.(true)}>{m.editor.reload}</button>
					<button class="btn btn-ghost btn-sm" onclick={() => void current.keepMine()}>{m.editor.keepMine}</button>
				</div>
			</div>
		{:else if readOnly}
			<div role="status" class="alert rounded-none py-2 text-sm">
				<span class="icon-[material-symbols-light--lock-outline] size-5" aria-hidden="true"></span>
				<span>{m.editor.readOnly}</span>
			</div>
		{/if}

		<div class="min-h-0 flex-1 overflow-y-auto">
			<div class="mx-auto flex max-w-4xl flex-col gap-3 p-3">
				{#if view === 'overview'}
					{@const counts = isBackup
						? [
								[m.overview.counts.notes, data.notes.size],
								[m.overview.counts.highlights, data.marks.size],
								[m.overview.counts.bookmarks, data.bookmarks.size],
								[m.overview.counts.tags, tags.length],
								[m.overview.counts.playlists, lists.length],
								[m.overview.counts.inputs, data.inputs.size]
							]
						: [[m.overview.counts.items, items.length]]}
					<h2 class="text-lg font-semibold">{isBackup ? m.overview.backup : m.overview.playlist}</h2>
					<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
						{#if current.file.device}<dt class="opacity-70">{m.overview.device}</dt><dd>{current.file.device}</dd>{/if}
						<dt class="opacity-70">{m.overview.modified}</dt>
						<dd>{date(current.file.modified)}</dd>
						<dt class="opacity-70">{m.overview.schema}</dt>
						<dd>{data.schema}</dd>
					</dl>
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
						{#each counts as [label, n] (label)}
							<div class="border-base-300 rounded-box border p-3">
								<div class="text-2xl font-semibold">{n}</div>
								<div class="text-sm opacity-70">{label}</div>
							</div>
						{/each}
					</div>
					{#if data.warnings.length}<p class="text-sm opacity-70">{m.editor.warnings(data.warnings.length)}</p>{/if}
					{#if isBackup}<p class="text-sm opacity-70">{m.overview.mergeHint}</p>{/if}
					<p class="text-sm opacity-70">{m.overview.backHint}</p>
				{:else if view === 'notes'}
					<div class="flex flex-wrap items-start gap-2">
						<label class="input input-sm min-w-48 flex-1">
							<span class="icon-[material-symbols-light--search] size-5 opacity-60" aria-hidden="true"></span>
							<input type="search" placeholder={m.notes.search} aria-label={m.notes.search} bind:value={query} />
						</label>
						{#if tags.length}
							<div class="min-w-48 flex-1">
								<TagField options={tagOptions} bind:value={tagFilter} bind:input={filterInput} label={m.notes.filterLabel} placeholder={m.notes.filterPlaceholder} size="sm" />
							</div>
						{/if}
					</div>
					{#if filtering.length > 1}
						<div class="flex flex-wrap items-center gap-1">
							<span class="text-sm opacity-70">{m.notes.match}</span>
							<div class="join" role="group" aria-label={m.notes.match}>
								<button class={['btn btn-xs join-item', tagMatch === 'all' && 'btn-active']} aria-pressed={tagMatch === 'all'} onclick={() => (tagMatch = 'all')}>{m.notes.matchAll}</button>
								<button class={['btn btn-xs join-item', tagMatch === 'any' && 'btn-active']} aria-pressed={tagMatch === 'any'} onclick={() => (tagMatch = 'any')}>{m.notes.matchAny}</button>
							</div>
						</div>
					{/if}
					<EntryList
						rows={notes}
						{pick}
						label={m.views.notes}
						empty={data.notes.size ? m.notes.none : m.notes.empty}
						name={(r) => r.note.title || m.notes.untitled}
						menu={() => entryMenu(commands.editNote, commands.tagNotes, commands.delete)}
						onopen={(r) => editable() && openNote(r.id)}
					>
						{#snippet row(r)}
							<div class="truncate font-medium">{r.note.title || m.notes.untitled}</div>
							{#if r.note.content}<div class="line-clamp-2 text-sm opacity-80">{r.note.content}</div>{/if}
							<div class="truncate text-xs opacity-60">{[r.place, date(parseTime(r.note.modified) || 0), r.tags.filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</div>
						{/snippet}
					</EntryList>
				{:else if view === 'highlights'}
					<EntryList
						rows={highlights}
						{pick}
						label={m.views.highlights}
						empty={m.highlights.empty}
						name={(r) => `${r.publication} ${m.highlights.colors[r.color] ?? ''}`}
						menu={() => entryMenu(commands.delete)}
					>
						{#snippet row(r)}
							<div class="flex items-center gap-3">
								<span class="size-4 shrink-0 rounded-sm border border-black/20" style:background-color={COLORS[r.color] ?? COLORS[0]} aria-hidden="true"></span>
								<span class="min-w-0 flex-1 truncate">{r.publication}</span>
								<span class="text-sm opacity-70">{m.highlights.colors[r.color] ?? r.color}</span>
								<span class="w-12 text-right text-sm tabular-nums">{r.guids.length}</span>
							</div>
						{/snippet}
					</EntryList>
				{:else if view === 'bookmarks'}
					<EntryList rows={bookmarks} {pick} label={m.views.bookmarks} empty={m.bookmarks.empty} name={(r) => r.bookmark.title} menu={() => entryMenu(commands.delete)}>
						{#snippet row(r)}
							<div class="truncate font-medium">{r.bookmark.title}</div>
							<div class="truncate text-xs opacity-60">{[r.publication, m.bookmarks.slot(r.bookmark.slot)].filter(Boolean).join(' · ')}</div>
							{#if r.bookmark.snippet}<div class="line-clamp-1 text-sm opacity-80">{r.bookmark.snippet}</div>{/if}
						{/snippet}
					</EntryList>
				{:else if view === 'tags'}
					<EntryList
						rows={tags}
						{pick}
						label={m.views.tags}
						empty={m.tags.empty}
						name={(r) => r.name}
						menu={() => entryMenu(commands.rename, commands.delete)}
						onopen={(r) => editable() && (renaming = r.id)}
					>
						{#snippet row(r)}
							<div class="flex items-center gap-3">
								<span class="icon-[material-symbols-light--sell-outline] size-5 shrink-0 opacity-70" aria-hidden="true"></span>
								{#if renaming === r.id}
									<!-- svelte-ignore a11y_autofocus -->
									<input
										class="input input-sm min-w-0 flex-1"
										value={r.name}
										aria-label={m.tags.rename(r.name)}
										autofocus
										onclick={(e) => e.stopPropagation()}
										onblur={(e) => rename(r.id, e.currentTarget.value)}
										onkeydown={(e) => {
											e.stopPropagation();
											if (e.key === 'Enter') e.currentTarget.blur();
											else if (e.key === 'Escape') {
												e.currentTarget.value = r.name;
												renaming = null;
											}
										}}
									/>
								{:else}
									<button
										class="min-w-0 flex-1 truncate text-left"
										onclick={(e) => {
											// A click on the name of the only selected tag renames it (`ui.md` “Editing in place”)
											if (editable() && pick.has(r.id) && selected.length === 1 && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
												e.stopPropagation();
												renaming = r.id;
											}
										}}>{r.name}</button
									>
								{/if}
								<span class="text-sm opacity-70">{m.tags.count(r.count)}</span>
							</div>
						{/snippet}
					</EntryList>
				{:else if view === 'playlists' && !list}
					<EntryList
						rows={lists}
						{pick}
						label={m.views.playlists}
						empty={m.playlists.empty}
						name={(r) => r.name}
						menu={() => entryMenu(commands.openPlaylist, commands.rename, commands.exportPlaylist, commands.deletePlaylist)}
						onopen={(r) => renaming !== r.id && (openList = r.id)}
					>
						{#snippet row(r)}
							<div class="flex items-center gap-3">
								<span class="icon-[material-symbols-light--playlist-play] size-6 shrink-0 opacity-70" aria-hidden="true"></span>
								{#if renaming === r.id}
									<!-- svelte-ignore a11y_autofocus -->
									<input
										class="input input-sm min-w-0 flex-1"
										value={r.name}
										aria-label={m.playlists.rename(r.name)}
										autofocus
										onclick={(e) => e.stopPropagation()}
										ondblclick={(e) => e.stopPropagation()}
										onblur={(e) => renameList(r.id, e.currentTarget.value)}
										onkeydown={(e) => {
											e.stopPropagation();
											if (e.key === 'Enter') e.currentTarget.blur();
											else if (e.key === 'Escape') {
												e.currentTarget.value = r.name;
												renaming = null;
											}
										}}
									/>
								{:else}
									<span class="min-w-0 flex-1 truncate">{r.name}</span>
								{/if}
								<span class="text-sm opacity-70">{m.playlists.items(r.items.length)}</span>
							</div>
						{/snippet}
					</EntryList>
				{:else if view === 'playlists' && list}
					{#if adding}<p class="text-sm opacity-70" role="status"><span class="loading loading-spinner loading-xs"></span> {m.playlists.adding}</p>{/if}
					<EntryList
						rows={items}
						{pick}
						label={list.name}
						empty={m.playlists.emptyItems}
						name={(r) => r.item.label}
						menu={() => entryMenu(commands.trim, commands.moveUp, commands.moveDown, commands.removeItems)}
						ondrop={editable() ? (ids, at) => {
							const rest = list.items.filter((k) => !ids.includes(k));
							const before = list.items.slice(0, at).filter((k) => !ids.includes(k)).length;
							rest.splice(before, 0, ...ids);
							change(reorder(data, list.key, rest));
						} : undefined}
					>
						{#snippet row(r)}
							{@const kind = data ? itemKind(data, r.item) : 'other'}
							{@const trim = itemTrim(r.item)}
							{@const cut = !!(r.item.startTrim || r.item.endTrim)}
							<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
								<div class="bg-base-300 flex h-[42px] w-[75px] shrink-0 items-center justify-center overflow-hidden rounded">
									{#if thumbnailUrl(r.item.thumbnail)}
										<img src={thumbnailUrl(r.item.thumbnail)} alt="" class="h-full w-full object-contain" />
									{:else}
										<span class={[kind === 'video' ? 'icon-[material-symbols-light--movie-outline]' : kind === 'audio' ? 'icon-[material-symbols-light--music-note-outline]' : 'icon-[material-symbols-light--imagesmode-outline]', 'size-6 opacity-60']} aria-hidden="true"></span>
									{/if}
								</div>
								<input
									class="input input-sm min-w-32 flex-1"
									value={r.item.label}
									aria-label={m.playlists.label}
									disabled={!editable()}
									onclick={(e) => e.stopPropagation()}
									onchange={(e) => change(editItem(data, r.id, { label: e.currentTarget.value }))}
									onkeydown={(e) => {
										e.stopPropagation();
										if (e.key === 'Enter') e.currentTarget.blur();
										else if (e.key === 'Escape') {
											e.currentTarget.value = r.item.label;
											e.currentTarget.blur();
										}
									}}
								/>
								{#if kind !== 'picture'}
									<span class="flex items-center gap-1 text-sm">
										<span class="opacity-70">{kind === 'video' ? m.playlists.video : kind === 'audio' ? m.playlists.audio : m.playlists.other}</span>
										{#if trim}<span class="tabular-nums">{clock(itemSeconds(r.item))}</span>{/if}
										{#if cut && trim}
											<span class="icon-[material-symbols-light--content-cut] size-4" title={m.playlists.trimmed(clock(trim.start), clock(trim.end))} aria-label={m.playlists.trimmed(clock(trim.start), clock(trim.end))}></span>
										{/if}
									</span>
								{:else}
									<label class="flex items-center gap-1 text-sm">
										<span class="opacity-70">{m.playlists.seconds}</span>
										<input
											type="number"
											min="1"
											max="3600"
											step="1"
											class="input input-sm w-20"
											value={Math.round(itemSeconds(r.item) * 10) / 10}
											disabled={!editable()}
											onclick={(e) => e.stopPropagation()}
											onkeydown={(e) => e.stopPropagation()}
											onchange={(e) => {
												const seconds = Number(e.currentTarget.value);
												if (seconds > 0) change(editItem(data, r.id, { seconds }));
											}}
										/>
									</label>
								{/if}
								<label class="flex items-center gap-1 text-sm">
									<span class="opacity-70">{m.playlists.endAction}</span>
									<select
										class="select select-sm w-auto"
										value={r.item.endAction}
										disabled={!editable()}
										onclick={(e) => e.stopPropagation()}
										onchange={(e) => change(editItem(data, r.id, { endAction: Number(e.currentTarget.value) }))}
									>
										{#each m.playlists.endActions as label, i (i)}
											<option value={i}>{label}</option>
										{/each}
									</select>
								</label>
							</div>
						{/snippet}
					</EntryList>
				{/if}
			</div>
		</div>
	</div>
{/if}

{#if editing}
	<Modal onclose={() => (editing = null)} labelledby="jwl-note-title">
		<div class={['modal-box flex max-h-[85vh] w-11/12 flex-col gap-3', editing.text ? 'max-w-2xl' : 'max-w-lg']}>
			<h3 id="jwl-note-title" class="text-lg font-bold">{editing.text ? m.notes.editTitle : m.notes.tagsTitle(editing.guids.length)}</h3>
			{#if editing.text}
				<label class="flex flex-col gap-1">
					<span class="text-sm">{m.notes.title}</span>
					<input class="input w-full" bind:value={editing.title} />
				</label>
				<label class="flex min-h-0 flex-1 flex-col gap-1">
					<span class="text-sm">{m.notes.text}</span>
					<textarea class="textarea min-h-48 w-full flex-1" bind:value={editing.content}></textarea>
				</label>
			{/if}
			<div class="flex flex-col gap-1">
				<span class="text-sm">{m.notes.tags}</span>
				<TagField
					options={tagOptions}
					bind:value={editing.tags}
					bind:partial={editing.partial}
					create={newTagKey}
					createLabel={m.notes.newTag}
					label={m.notes.tags}
					placeholder={m.notes.tagsPlaceholder}
				/>
			</div>
			<div class="modal-action mt-0">
				<button class="btn btn-ghost" onclick={() => (editing = null)}>{m.common.cancel}</button>
				<button class="btn btn-primary" onclick={keepNote}>{m.common.done}</button>
			</div>
		</div>
	</Modal>
{/if}

{#if trimming && data?.playlists.get(trimming)}
	{@const item = data.playlists.get(trimming)!}
	{@const trim = itemTrim(item)}
	{#if trim}
		<TrimDialog
			label={item.label}
			start={trim.start}
			end={trim.end}
			length={trim.length}
			video={itemKind(data, item) === 'video' ? thumbnailUrl(item.media[0]?.hash ?? null) : null}
			onclose={() => (trimming = null)}
			ondone={(start, end) => {
				if (data && trimming) change(trimItem(data, trimming, { start, end }));
				trimming = null;
			}}
		/>
	{/if}
{/if}
