<script lang="ts">
	import { filesUrl } from '@in-browser/files/formats.js';
	// Editor page of a PDF (`?path=`): ribbon on top, side panels on the left, the pages on the
	// shared ink core; page navigation and zoom in the footer. Changes save themselves
	// (`PdfDocument`); the save state sits in the footer, conflicts and notices in a bar above the pages. One tab per PDF.
	import { installNudgeKeys } from '@in-browser/ink/input/keys.js';
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { setBrandBar } from '@in-browser/brand/brand-bar.svelte.js';
	import { saveStateOf, setBrandFooter } from '@in-browser/brand/brand-footer.svelte.js';
	import { installCommandKeys, shortcutLabel, type Command } from '@in-browser/brand/commands.js';
	import { downloadBlob } from '@in-browser/brand/download.js';
	import { brandMessages, toolName } from '@in-browser/brand/i18n/index.svelte.js';
	import PanelRail from '@in-browser/brand/PanelRail.svelte';
	import { panelCommand as sharedPanelCommand, type PanelSpec } from '@in-browser/brand/panels.js';
	import Ribbon from '@in-browser/brand/Ribbon.svelte';
	import type { GroupSize, RibbonGroup, RibbonItem, RibbonTab } from '@in-browser/brand/ribbon.js';
	import RibbonPopover from '@in-browser/brand/RibbonPopover.svelte';
	import VisibilityButton from '#lib/components/VisibilityButton.svelte';
	import { ask } from '@in-browser/brand/ui/confirm.svelte.js';
	import { openMenuAbove, type MenuEntry } from '@in-browser/brand/ui/context-menu.svelte.js';
	import { toast } from '@in-browser/brand/ui/toast.svelte.js';
	import { inTextField } from '@in-browser/brand/ui/typing.js';
	import { accessAction } from '@in-browser/files/sources/connections.svelte.js';
	import { ExternalVersions, flushWhenHidden, lockDocument } from '@in-browser/files/documents.js';
	import { read, watch, write } from '@in-browser/files/fs.js';
	import { FilesError } from '@in-browser/files/entry.js';
	import { chooseFile, chooseFiles } from '@in-browser/files/dialog.svelte.js';
	import { filesErrorText } from '@in-browser/files/i18n/index.svelte.js';
	import { basename, normalize, parent } from '@in-browser/files/path.js';
	import { imagePdf } from '@in-browser/pdf/write/image-page.js';
	import { editorUrl } from '#lib/brand.js';
	import ColorField from '@in-browser/graphics/ColorField.svelte';
	import { inkMessages } from '@in-browser/ink/i18n/index.svelte.js';
	import type { Tool } from '@in-browser/ink/input/controller.js';
	import { SHAPE_KINDS, shapeGlyph } from '@in-browser/ink/shapes.js';
	import { ERASER_SIZES } from '@in-browser/ink/sizes.js';
	import { SMOOTHING_LEVELS } from '@in-browser/ink/smooth.js';
	import SelectionMenu from '@in-browser/ink/ui/SelectionMenu.svelte';
	import InkColorButton from '@in-browser/ink/ui/InkColorButton.svelte';
	import InkStyleButton from '@in-browser/ink/ui/InkStyleButton.svelte';
	import { arrangeGroups } from '@in-browser/ink/ui/selection-commands.js';
	import ShapeSuggestionButton from '@in-browser/ink/ui/ShapeSuggestion.svelte';
	import NoteEditor from '#lib/components/NoteEditor.svelte';
	import NewPdfDialog from '#lib/components/NewPdfDialog.svelte';
	import PrintDialog from '#lib/components/PrintDialog.svelte';
	import ExportDialog from '#lib/components/ExportDialog.svelte';
	import Display from '#lib/show/Display.svelte';
	import Presenter from '#lib/show/Presenter.svelte';
	import { ShowControl } from '#lib/show/control.svelte.js';
	import { DisplayController } from '#lib/show/display.svelte.js';
	import { controlLink, newSession } from '#lib/show/local.js';
	import { toOtherScreen } from '#lib/show/screen.js';
	import { offerRemote } from '#lib/show/remote-link.js';
	import { presentSettings, type PresentMode } from '#lib/show/settings.svelte.js';
	import { showUrl } from '#lib/brand.js';
	import { canShare, openShareDialog } from '@in-browser/files/share-dialog.svelte.js';
	import { filesMessages } from '@in-browser/files/i18n/index.svelte.js';
	import PdfPageDialog from '#lib/components/PdfPageDialog.svelte';
	import StampEditor from '#lib/components/StampEditor.svelte';
	import LinkEditor from '#lib/components/LinkEditor.svelte';
	import MeasureDialog from '#lib/components/MeasureDialog.svelte';
	import CalibrateDialog from '#lib/components/CalibrateDialog.svelte';
	import { contentEdit } from '#lib/model/content.svelte.js';
	import type { MeasureKind } from '@in-browser/ink/items.js';
	import { isLink, safeUrl } from '#lib/render/link.js';
	import StampWordDialog from '#lib/components/StampWordDialog.svelte';
	import { choosePdfPage, stampDialogs } from '#lib/model/stamp-dialogs.svelte.js';
	import { chosenWord, wordText } from '#lib/model/stamp-words.js';
	import { PAPERS, paperPdf, type Paper } from '@in-browser/pdf/write/paper-page.js';
	import { customStamps, iconPicture, loadStamps, loadWords, pictureSource, STAMP_TYPES, stampPicture, stampTool, stampWords, type StampPicture } from '#lib/model/stamps.svelte.js';
	import { isStamp, pictureStamp, type StampItem } from '#lib/render/stamp.js';
	import IconPicker from '@in-browser/graphics/IconPicker.svelte';
	import type { IconData } from '@in-browser/graphics/icons/types.js';
	import TextEditor from '#lib/components/TextEditor.svelte';
	import { stampFromArea, stampFromSelection } from '#lib/model/stamp-actions.js';
	import { attachedFiles, isNote, NOTE_SIZE } from '#lib/render/note.js';
	import { showError } from '@in-browser/files/errors.js';
	import { PdfError } from '@in-browser/pdf/pdfjs.js';
	import Surface from '#lib/components/Surface.svelte';
	import { m } from '#lib/i18n/index.js';
	import { FILLABLE, PdfDocument } from '#lib/model/document.svelte.js';
	import { formView, toggleHighlight } from '#lib/model/forms.svelte.js';
	import { EditorState } from '#lib/model/editor.svelte.js';
	import { recent } from '#lib/model/recent.js';
	import { kindOf, selectionCommands, toolKind, type FormatKind } from '#lib/model/selection-commands.js';
	import { isCommented } from '#lib/render/markup.js';
	import { choose, endMeasuring, iconColor, inkColor, measureTool, measureWith, type MeasureTool, noteColor, setInkColor, setStamp, stampChoice, tools, type EditorTool } from '#lib/model/tools.svelte.js';
	import type { PdfSelection, PdfStage, PdfSuggestion } from '#lib/render/surface.js';

	const ed = new EditorState();
	let error = $state<string | null>(null);
	/** Opening failed because the browser doesn't allow access to the connected folder right now */
	let access = $state<ReturnType<typeof accessAction>>(undefined);
	let pageInput = $state('');
	/** Opens the file again (another version arrived); null while nothing is open */
	let reload: ((quiet: boolean) => Promise<void>) | null = null;
	/** The notice about signatures was closed */
	let signedSeen = $state(false);
	/** Asked once whether pages of a signed PDF may change */
	let signedPagesOk = false;
	/** "New PDF …" is open */
	let creating = $state(false);
	/** The print dialog is open, starting with these pages */
	let printing = $state<'all' | 'picked' | null>(null);
	/** The export dialog is open, starting with these pages */
	let exporting = $state<'all' | 'picked' | null>(null);

	function loadError(e: unknown): string {
		if (e instanceof PdfError) return e.reason === 'password' ? m.editor.password : m.editor.invalid;
		if (e instanceof FilesError && e.code === 'notFound') return m.editor.missing;
		return m.editor.loadFailed(filesErrorText(e));
	}

	$effect(() => {
		const param = page.url.searchParams.get('path');
		if (!param) return;
		const path = normalize(param);
		let disposed = false;
		let release: (() => void) | null = null;
		let opened: PdfDocument | null = null;
		let stopWatch: (() => void) | null = null;
		error = null;

		/** Replaces the open document by the file as it is now (the lock stays held) */
		const reopen = async (quiet: boolean) => {
			const next = await PdfDocument.open(path);
			if (disposed) return next.destroy();
			const old = opened;
			ed.stage = null;
			opened = ed.doc = next;
			// Messages of the form's scripts (`app.alert`) – never a browser dialog
			next.onScriptMessage = (text) => toast(text, 'info', 8000);
			old?.destroy();
			// Shown as slides right now: they go on with the new version where they were
			if (presenting?.mode === 'display') presenting.display.reloaded();
			if (!quiet) toast(m.conflict.reloaded(next.name));
		};

		(async () => {
			try {
				release = await lockDocument(`pdf-editor:pdf:${path}`);
				if (disposed) return release?.();
				if (!release) {
					error = m.editor.openElsewhere;
					return;
				}
				const next = await PdfDocument.open(path);
				if (disposed) return next.destroy();
				opened = ed.doc = next;
				// Messages of the form's scripts (`app.alert`) – never a browser dialog
				next.onScriptMessage = (text) => toast(text, 'info', 8000);
				recent.remember(path);
				reload = reopen;
				void resumePresenting(next);
				// A version saved elsewhere: asked first (once per version; the answer may be kept while it is open)
				const external = new ExternalVersions();
				stopWatch = watch(
					(paths) =>
						void opened?.filesChanged(paths, async (version) => {
							// Nothing to ask where nothing can be changed (a share for viewing) or while it is presented: the new
							// version is shown
							const follow = !!presenting || opened?.editable === 'readonly';
							const silent = follow || external.silent;
							if (!follow && !(await external.shouldReload(next.name, version))) return;
							if (disposed || opened?.dirty) return;
							await reopen(!silent || !!presenting).catch((e) => console.error('[pdf-editor] reload', e));
						})
				);
			} catch (e) {
				console.error('[pdf-editor] open', e);
				error = loadError(e);
				access = accessAction(e, () => location.reload());
			}
		})();

		const stopFlush = flushWhenHidden(() => opened?.flush());
		return () => {
			disposed = true;
			reload = null;
			stopWatch?.();
			stopFlush();
			opened?.flush();
			ed.doc = null;
			ed.stage = null;
			opened?.destroy();
			release?.();
		};
	});

	// --- Commands ---

	const has = () => !!ed.stage;
	// A tool's language is fixed when it loads
	const tm = inkMessages().tools;

	/** A tool of the ink core: picked by its command (and a letter), only while the PDF can be changed */
	function drawingTool(tool: Tool | EditorTool, label: string, icon: string, key: string): Command {
		return { id: tool, label, icon, shortcut: { key }, enabled: () => editable(), active: () => tools.tool === tool, run: () => choose(tool) };
	}
	const editable = () => ed.doc?.editable === 'yes';

	/** After undo, redo or turning pages: the suggestion goes, the selection follows, search hits may lie elsewhere */
	function changed(run: () => void) {
		ed.suggestion?.clear();
		run();
		ed.selection?.refresh();
		void ed.refind();
	}

	/** Changes pages (the picked ones, else the current one); pages of a signed PDF only after asking once */
	async function changePages(run: (doc: PdfDocument, ids: string[]) => void) {
		const doc = ed.doc;
		const ids = ed.pagesToChange();
		if (!doc || doc.editable !== 'yes' || !ids.length) return;
		if (doc.signed && !signedPagesOk) {
			if (!(await ask(m.questions.signedPages))) return;
			signedPagesOk = true;
		}
		// A selection names its page by place: it goes when pages change
		ed.selection?.clear();
		changed(() => run(doc, ids));
	}

	/** Moves the pages to change: one up or down, to the start or the end */
	function movePages(where: 'up' | 'down' | 'first' | 'last') {
		void changePages((doc, ids) => {
			const at = ids.map((id) => doc.pages.findIndex((p) => p.id === id));
			const to = where === 'first' ? 0 : where === 'last' ? doc.pages.length : where === 'up' ? Math.max(0, Math.min(...at) - 1) : Math.min(doc.pages.length, Math.max(...at) + 2);
			doc.movePages(new Set(ids), to);
			// The view follows the first of them
			const first = doc.pages.findIndex((p) => p.id === ids[0]);
			if (first >= 0) ed.goTo(first);
		});
	}
	const failed = (e: unknown) => {
		console.warn('[pdf-editor] pages', e);
		toast(e instanceof PdfError ? (e.reason === 'password' ? m.commands.protected : m.editor.invalid) : m.commands.failed(filesErrorText(e)), 'error', 8000);
	};

	/** Inserts the pages of a PDF (or an image as a page) after the current page */
	async function insertFrom(kind: 'pdf' | 'image') {
		const doc = ed.doc;
		if (!doc) return;
		const path = await chooseFile(
			kind === 'pdf'
				? { mode: 'open', folder: parent(doc.path), accept: ['.pdf'], title: m.commands.insertPdfTitle }
				: { mode: 'open', folder: parent(doc.path), accept: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif'], title: m.commands.insertImageTitle }
		);
		if (!path) return;
		try {
			const file = await read(path);
			const bytes = kind === 'pdf' ? new Uint8Array(await file.arrayBuffer()) : await imagePdf(file);
			const at = ed.current + 1;
			ed.selection?.clear();
			await doc.insertPdf(at, bytes);
			ed.goTo(at);
		} catch (e) {
			failed(e);
		}
	}

	/** Inserts a page with a paper after the current page, as big as it */
	async function insertPaper(paper: Paper) {
		const doc = ed.doc;
		const like = doc?.pages[ed.current];
		if (!doc || !like) return;
		if (paper === 'blank') {
			if (doc.insertBlank(ed.current + 1)) ed.goTo(ed.current + 1);
			return;
		}
		try {
			const at = ed.current + 1;
			ed.selection?.clear();
			await doc.insertPdf(at, await paperPdf({ width: like.w, height: like.h, paper }));
			ed.goTo(at);
		} catch (e) {
			failed(e);
		}
	}

	/** Saves a new PDF (pages of this one, or this one merged with others) and offers to open it */
	async function saveNew(make: (doc: PdfDocument) => Promise<Uint8Array>, name: string, title: string) {
		const doc = ed.doc;
		if (!doc) return;
		try {
			const bytes = await make(doc);
			const path = await chooseFile({ mode: 'save', folder: parent(doc.path), accept: ['.pdf'], name, title });
			if (!path) return;
			await write(path, new Blob([bytes as Uint8Array<ArrayBuffer>]));
			toast(m.commands.saved(basename(path)), 'success', 8000, { label: m.commands.openNew, run: () => location.assign(editorUrl(path)) });
		} catch (e) {
			failed(e);
		}
	}
	const stem = () => (ed.doc?.name ?? 'PDF').replace(/\.pdf$/i, '');

	async function mergeWith() {
		const doc = ed.doc;
		if (!doc) return;
		const paths = await chooseFiles({ mode: 'open', folder: parent(doc.path), accept: ['.pdf'], multiple: true, title: m.commands.mergeTitle });
		if (!paths?.length) return;
		await saveNew(
			async (d) => d.merged(await Promise.all(paths.map(async (p) => new Uint8Array(await (await read(p)).arrayBuffer())))),
			m.commands.mergeName(stem()),
			m.commands.mergeSaveTitle
		);
	}

	const canMove = (where: 'up' | 'down') => {
		const doc = ed.doc;
		if (!doc || !editable()) return false;
		const at = ed.pagesToChange().map((id) => doc.pages.findIndex((p) => p.id === id));
		return where === 'up' ? at.some((i, k) => i !== k) : at.some((i, k) => i !== doc.pages.length - at.length + k);
	};

	// --- Stamps: a word of the standard or a picture (of "My stamps" or picked once) ---

	void loadStamps();
	void loadWords();
	// The chosen picture is read once it is needed – and again when another file, another page of it or another
	// picture under the same name is chosen
	$effect(() => {
		const path = stampChoice.custom;
		const page = stampChoice.page;
		if (!path || tools.tool !== 'stamp') return;
		const source = pictureSource(path, page);
		if (untrack(() => stampTool.picture?.source) === source) return;
		stampTool.picture = null;
		stampPicture(path, page).then(
			(picture) => {
				if (stampChoice.custom === path && stampChoice.page === page) stampTool.picture = picture;
			},
			(e) => {
				console.warn('[pdf-editor] stamp', e);
				toast(m.stamps.loadFailed, 'error', 8000);
				if (stampChoice.custom === path) setStamp({ custom: null });
			}
		);
	});
	function pickStamp(choice: Parameters<typeof setStamp>[0]) {
		setStamp(choice);
		choose('stamp');
	}
	async function stampFromImage() {
		const doc = ed.doc;
		const path = await chooseFile({ mode: 'open', folder: doc ? parent(doc.path) : '/', accept: STAMP_TYPES, title: m.stamps.imageTitle });
		if (!path) return;
		try {
			const which = await choosePdfPage(path);
			if (which) pickStamp({ custom: path, page: which.page });
		} catch (e) {
			console.warn('[pdf-editor] stamp', e);
			toast(m.stamps.loadFailed, 'error', 8000);
		}
	}
	// --- Page content: its objects are changed only while the switch "Edit content" is on ---

	let signedContentOk = false;
	// Every PDF opens with the switch off; a remembered tool never turns it on
	$effect(() => {
		void ed.doc;
		untrack(() => contentEdit.stop());
	});
	$effect(() => {
		if (tools.tool === 'content' && !contentEdit.on) untrack(() => choose('lasso'));
	});
	// Another tool: nothing of the content stays picked
	$effect(() => {
		if (tools.tool !== 'content') untrack(() => contentEdit.clear());
	});
	/** Changing a page's content writes the file anew: a signed PDF asks once before the first such change */
	async function contentAllowed(): Promise<boolean> {
		if (!ed.doc?.signed || signedContentOk) return true;
		if (!(await ask(m.questions.signedContent))) return false;
		signedContentOk = true;
		return true;
	}
	async function toggleContent() {
		const doc = ed.doc;
		if (!doc || doc.editable !== 'yes') return;
		if (contentEdit.on) {
			contentEdit.stop();
			if (tools.tool === 'content') choose('lasso');
			return;
		}
		if (!(await contentAllowed())) return;
		contentEdit.on = true;
		ed.selection?.clear();
		choose('content');
	}
	const contentPicked = () => contentEdit.on && contentEdit.page !== null && contentEdit.ids.size > 0;
	/** The one image picked of the content ("Replace image …") */
	const pickedImage = () => {
		if (!contentPicked() || contentEdit.ids.size !== 1 || !ed.doc) return null;
		void ed.doc.contentChanges;
		const [id] = contentEdit.ids;
		const item = ed.doc.contentItems(contentEdit.page!)?.find((i) => i.id === id);
		return item?.kind === 'image' ? { page: contentEdit.page!, id } : null;
	};
	async function replaceImage() {
		const doc = ed.doc;
		const image = pickedImage();
		if (!doc || !image) return;
		const path = await chooseFile({ mode: 'open', folder: parent(doc.path), accept: STAMP_TYPES, title: m.content.replaceTitle });
		if (!path) return;
		try {
			const which = await choosePdfPage(path);
			if (!which) return;
			const id = doc.replaceImage(image.page, image.id, await stampPicture(path, which.page));
			if (id !== null) contentEdit.select(image.page, [id]);
		} catch (e) {
			console.warn('[pdf-editor] replace image', e);
			toast(m.stamps.loadFailed, 'error', 8000);
		}
	}
	/** The selected comments that can become part of the page */
	const flattenable = () => (ed.doc && ed.selection?.active ? ed.selection.items.filter((item) => ed.doc!.flattens(item)) : []);
	/** "Embed in the page": the selected comments become part of their page – also with the switch off (it guards
	 * the page's own content; this is a deliberate step on one's own comment) */
	async function flattenSelection() {
		const doc = ed.doc;
		const selection = ed.selection;
		const items = flattenable();
		if (!doc || !selection || selection.pageIndex < 0 || !items.length || !(await contentAllowed())) return;
		const page = selection.pageIndex;
		selection.clear();
		doc.flatten(page, new Set(items.map((item) => item.id)));
	}
	/** What the footer says while content is edited */
	function contentStatus(): string {
		const doc = ed.doc;
		if (!doc) return '';
		// Read anew when a page's content was read or changed
		void doc.contentChanges;
		if (contentPicked()) return m.content.status(contentEdit.ids.size);
		return doc.contentState(ed.current) === 'none' ? m.content.unreadable : m.content.on;
	}

	// --- Measuring: the shape tool drawing a line, a path or an outline that says its size ---

	let scaling = $state(false);
	/** The distance drawn with "Calibrate" (length in page points; `clear` takes it off the page), while its real length is asked for */
	let calibrating = $state<{ points: number; clear: () => void } | null>(null);
	// Another tool ends measuring (the shape tool draws what it drew before)
	$effect(() => {
		if (tools.tool !== 'shape' && measureTool.kind) untrack(endMeasuring);
	});
	const measureCommand = (kind: MeasureTool, icon: string, key?: string): Command => ({
		id: `measure-${kind}`,
		label: m.measure.kinds[kind],
		tip: m.measure.tips[kind],
		icon,
		...(key && { shortcut: { key } }),
		enabled: editable,
		active: () => tools.tool === 'shape' && measureTool.kind === kind,
		run: () => measureWith(kind)
	});

	// --- Links: followed with "Hand", their boxes shown while they are worked on ---

	$effect(() => {
		const shown = tools.tool === 'link' || tools.tool === 'lasso';
		ed.doc?.showLinks(shown);
	});

	// --- Presenting: the steps marked on the pages while the panel “Presentation steps” is open ---

	$effect(() => {
		const shown = ed.panel === 'steps';
		ed.doc?.showSteps(shown);
	});

	/** Presenting: the presenter view here with the slides in a window of their own, or the slides filling this screen */
	let presenting = $state<
		| { mode: 'presenter'; session: string; control: ShowControl; close: () => void; open: (at: { page: number; step: number }) => Window | null }
		| { mode: 'display'; display: DisplayController; stopOffer: () => void }
		| null
	>(null);

	/** The slides of the open document as it is now (a version read anew while presenting takes its place) */
	const deckOf = (first: PdfDocument) => () => {
		const doc = ed.doc ?? first;
		return { pages: doc.pages.length, steps: (i: number) => doc.stepsOf(doc.pages[i]?.id ?? '') };
	};

	/** Starts presenting at a place, the way chosen (`presentSettings.mode`) */
	async function present(at: { page: number; step: number }) {
		const doc = ed.doc;
		if (!doc || presenting) return;
		ed.selection?.clear();
		if (presentSettings.mode === 'display') {
			// Full screen needs the click itself: asked for before anything waits
			void document.documentElement.requestFullscreen().catch(() => {});
			const display = new DisplayController(deckOf(doc), at, () => ed.doc?.fingerprint ?? '');
			// A phone may control it (sharing this PDF, or one of this user's devices)
			presenting = { mode: 'display', display, stopOffer: offerRemote(display, doc.path, doc.name) };
			return;
		}
		// The slides window reads the file: everything saved first
		if (doc.dirty) await doc.save();
		const session = newSession();
		const view = presenterOf(doc, session);
		if (!view.open(at)) return view.close();
		remember(PRESENTING_KEY, { session, path: doc.path });
		presenting = view;
	}

	/** Kept for this tab while it is the presenter view: a reload finds its slides window again */
	const PRESENTING_KEY = 'pdf-editor:presenting';
	const remember = (key: string, value: unknown) => {
		try {
			if (value === null) sessionStorage.removeItem(key);
			else sessionStorage.setItem(key, JSON.stringify(value));
		} catch {
			// Without it a reload leaves the slides to their own keys
		}
	};

	/** The presenter view of the slides window `session` shows (opened by `open`, also again after it was closed) */
	function presenterOf(doc: PdfDocument, session: string) {
		const path = doc.path;
		let win: Window | null = null;
		const open = (from: { page: number; step: number }) => {
			win = window.open(showUrl(path, session, from), `pdf-editor-show-${session}`, 'popup,width=960,height=600');
			if (win) void toOtherScreen(win);
			else toast(m.show.popupBlocked, 'warning', 10_000);
			return win;
		};
		const link = controlLink(session);
		const control = new ShowControl(link, deckOf(doc));
		return {
			mode: 'presenter' as const,
			session,
			control,
			open,
			close: () => {
				// The slides window closes itself on `end` (after a reload of this tab there is no handle to it)
				control.end();
				control.destroy();
				link.close();
				if (win && !win.closed) win.close();
			}
		};
	}

	/** After a reload of this tab while it was the presenter view: its slides window still shows – the presenter view
	 * comes back at their place (the slides went on with their own keys meanwhile) */
	async function resumePresenting(doc: PdfDocument) {
		let kept: { session?: unknown; path?: unknown } | null = null;
		try {
			kept = JSON.parse(sessionStorage.getItem(PRESENTING_KEY) ?? 'null');
		} catch {
			// Nothing kept
		}
		if (!kept || typeof kept.session !== 'string' || kept.path !== doc.path) return;
		const view = presenterOf(doc, kept.session);
		// The slides answer a `hello` at once when they are there
		for (let waited = 0; !view.control.connected && waited < 1500; waited += 50) await new Promise((r) => setTimeout(r, 50));
		if (!view.control.connected || presenting || ed.doc !== doc) {
			// No slides anymore (closed meanwhile): nothing to end
			view.control.destroy();
			if (!presenting) remember(PRESENTING_KEY, null);
			return;
		}
		presenting = view;
	}

	/** Ends presenting; the editor shows the page the presentation was at */
	function stopPresenting() {
		const p = presenting;
		if (!p) return;
		const at = p.mode === 'display' ? p.display.state.page : p.control.place.page;
		if (p.mode === 'presenter') p.close();
		else {
			p.stopOffer();
			p.display.leave();
		}
		if (p.mode === 'presenter') remember(PRESENTING_KEY, null);
		presenting = null;
		if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
		ed.goTo(at);
	}

	function presentWith(mode: PresentMode, at: () => { page: number; step: number }) {
		presentSettings.mode = mode;
		presentSettings.store();
		void present(at());
	}
	const presentMenu = (at: () => { page: number; step: number }) => () => [
		{ label: m.show.withPresenter, checked: presentSettings.mode === 'presenter', run: () => presentWith('presenter', at) },
		{ label: m.show.displayOnly, checked: presentSettings.mode === 'display', run: () => presentWith('display', at) }
	];
	const fromStart = () => ({ page: 0, step: 0 });
	const fromHere = () => ({ page: ed.current, step: 0 });
	/** Goes where the link at a point of a page leads: to its page, or – asked first, it leaves the PDF – to its address */
	async function followLink(page: number, x: number, y: number) {
		const link = await ed.doc?.linkAt(page, x, y);
		if (link?.place) return ed.goTo(link.place.index, link.place.y);
		const url = link?.url ? safeUrl(link.url) : null;
		if (link?.url && !url) return toast(m.link.refused, 'warning', 6000);
		if (url && (await ask({ title: m.link.openTitle, message: m.link.openText(url), confirm: m.link.open }))) window.open(url, '_blank', 'noopener,noreferrer');
	}

	// --- Files attached as comments: a paper clip on the page, the file in the PDF ---

	/** Above this size attaching asks first: the file goes into the PDF as it is, and every save writes it again */
	const LARGE_ATTACHMENT = 25 * 1024 * 1024;
	async function attachFile(page: number, x: number, y: number) {
		const doc = ed.doc;
		if (!doc || doc.editable !== 'yes') return;
		const path = await chooseFile({ mode: 'open', folder: parent(doc.path), accept: [], title: m.attach.title });
		if (!path) return;
		try {
			const bytes = new Uint8Array(await (await read(path)).arrayBuffer());
			if (bytes.length > LARGE_ATTACHMENT && !(await ask({ title: m.attach.largeTitle, message: m.attach.large(basename(path)), confirm: m.attach.attach }))) return;
			const key = crypto.randomUUID();
			attachedFiles.set(key, bytes);
			const at = doc.pages[page];
			const id = doc.items.addItem(page, {
				id: crypto.randomUUID(),
				type: 'note',
				x: Math.max(0, Math.min(at.w - NOTE_SIZE, x)),
				y: Math.max(0, Math.min(at.h - NOTE_SIZE, y)),
				color: noteColor.value,
				text: '',
				file: { key, name: basename(path), size: bytes.length }
			});
			if (!id) return;
			choose('lasso');
			ed.selection?.select(page, new Set([id]));
		} catch (e) {
			showError(e, { context: '[pdf-editor] attach' });
		}
	}
	/** The file of the one selected attachment comment */
	const selectedFile = () => {
		const items = ed.selection?.items ?? [];
		const item = items.length === 1 ? items[0] : null;
		return item && isNote(item) && item.file ? item.file : null;
	};
	function downloadSelectedFile() {
		const file = selectedFile();
		const bytes = file && attachedFiles.get(file.key);
		if (file && bytes) downloadBlob(new Blob([bytes as Uint8Array<ArrayBuffer>]), file.name);
	}

	// --- Pictures and icons as free items: placed in the middle of the view and selected, to be moved and sized ---

	/** Longer side of a new icon (points) */
	const ICON_SIZE = 48;
	function placePicture(picture: StampPicture, side?: number, icon?: Pick<StampItem, 'icon' | 'color'>) {
		const doc = ed.doc;
		const at = ed.stage?.insertPoint();
		if (!doc || !at || doc.editable !== 'yes') return;
		const id = doc.items.addItem(at.page, { ...pictureStamp(picture, doc.pages[at.page], at.x, at.y, side), ...icon });
		if (!id) return;
		choose('lasso');
		ed.selection?.select(at.page, new Set([id]));
	}
	async function insertPicture() {
		const doc = ed.doc;
		if (!doc) return;
		const path = await chooseFile({ mode: 'open', folder: parent(doc.path), accept: STAMP_TYPES, title: m.commands.pictureTitle });
		if (!path) return;
		try {
			const which = await choosePdfPage(path);
			if (which) placePicture(await stampPicture(path, which.page));
		} catch (e) {
			console.warn('[pdf-editor] picture', e);
			toast(m.stamps.loadFailed, 'error', 8000);
		}
	}
	/** An icon in the pen's color */
	async function insertIcon(icon: IconData) {
		try {
			// The color an icon was given last, else the pen's
			const color = iconColor.value ?? tools.ink.color;
			const picture = await iconPicture(icon, color);
			placePicture(picture, ICON_SIZE, picture.icon && { icon: picture.icon, color });
		} catch (e) {
			console.warn('[pdf-editor] icon', e);
			toast(m.stamps.loadFailed, 'error', 8000);
		}
	}
	const asMenu = (c: Command): MenuEntry => ({ label: c.label, icon: c.icon, disabled: c.enabled ? !c.enabled() : false, checked: c.active?.(), run: c.run! });
	function stampMenu(): MenuEntry[] {
		return [
			...stampWords.list.map((word) => ({
				label: wordText(word, m.stamps.names),
				checked: !stampChoice.custom && chosenWord(stampWords.list, stampChoice.word)?.id === word.id,
				run: () => pickStamp({ word: word.id, custom: null })
			})),
			{ heading: m.stamps.lineBelow },
			{ label: m.stamps.withName, icon: 'icon-[material-symbols-light--badge-outline]', checked: stampChoice.withName, run: () => setStamp({ withName: !stampChoice.withName }) },
			{ label: m.stamps.withDate, icon: 'icon-[material-symbols-light--calendar-today-outline]', checked: stampChoice.withDate, run: () => setStamp({ withDate: !stampChoice.withDate }) },
			{ label: m.stamps.withTime, icon: 'icon-[material-symbols-light--schedule-outline]', checked: stampChoice.withTime, run: () => setStamp({ withTime: !stampChoice.withTime }) },
			{ separator: true },
			...customStamps.list.map((s) => ({ label: s.name, icon: 'icon-[material-symbols-light--image-outline]', checked: stampChoice.custom === s.path, run: () => pickStamp({ custom: s.path }) })),
			{ label: m.stamps.image, icon: 'icon-[material-symbols-light--upload-file-outline]', run: () => void stampFromImage() },
			{ label: m.stamps.mine, icon: 'icon-[material-symbols-light--approval-outline]', run: () => (ed.panel = 'stamps') },
			{ separator: true },
			asMenu(commands.stampFromSelection),
			asMenu(commands.stampFromArea)
		];
	}

	// The selection's commands (the shared ones of the ink core plus the PDF's own kinds)
	const sc = selectionCommands(ed, edit);

	const commands = {
		// The PDF itself (tab “File”); it is named after its file – renamed in Files
		download: { id: 'download', label: m.editor.download, icon: 'icon-[material-symbols-light--download]', enabled: () => !!ed.doc, run: () => void download() },
		newPdf: { id: 'newPdf', label: m.newPdf.command, tip: m.newPdf.tip, icon: 'icon-[material-symbols-light--note-add-outline]', run: () => (creating = true) },
		// Ctrl+P everywhere (also while typing): ours instead of the browser's, which would print the editor itself
		print: {
			id: 'print',
			label: m.print.command,
			tip: m.print.tip,
			icon: 'icon-[material-symbols-light--print-outline]',
			shortcut: { key: 'p', ctrl: true, inText: true },
			enabled: () => !!ed.doc,
			run: () => (printing = 'all')
		},
		exportPages: {
			id: 'exportPages',
			label: m.export.command,
			tip: m.export.tip,
			icon: 'icon-[material-symbols-light--photo-library-outline]',
			enabled: () => !!ed.doc,
			run: () => (exporting = 'all')
		},
share: {
			id: 'share',
			label: filesMessages().shareDialog.action,
			tip: filesMessages().shareDialog.tip,
			icon: 'icon-[material-symbols-light--share-outline]',
			enabled: () => canShare(ed.doc?.path),
			run: () => {
				const path = ed.doc?.path;
				if (path) openShareDialog({ path, single: true });
			}
		},
		showInFiles: { id: 'showInFiles', label: m.editor.showInFiles, icon: 'icon-[material-symbols-light--folder-open-outline]', enabled: () => !!ed.doc, run: () => showInFiles() },
		undo: { id: 'undo', label: m.commands.undo, icon: 'icon-[material-symbols-light--undo]', shortcut: { key: 'z', ctrl: true }, enabled: () => !!ed.doc?.canUndo, run: () => changed(() => ed.doc?.undo()) },
		redo: {
			id: 'redo',
			label: m.commands.redo,
			icon: 'icon-[material-symbols-light--redo]',
			shortcut: { key: 'z', ctrl: true, shift: true },
			enabled: () => !!ed.doc?.canRedo,
			run: () => changed(() => ed.doc?.redo())
		},
		rotateLeft: {
			id: 'rotateLeft',
			label: m.commands.rotateLeft,
			tip: m.commands.rotateTip,
			icon: 'icon-[material-symbols-light--rotate-90-degrees-ccw-outline]',
			enabled: editable,
			run: () => void changePages((doc, ids) => doc.rotate(ids, -90))
		},
		rotateRight: {
			id: 'rotateRight',
			label: m.commands.rotateRight,
			tip: m.commands.rotateTip,
			icon: 'icon-[material-symbols-light--rotate-90-degrees-cw-outline]',
			enabled: editable,
			run: () => void changePages((doc, ids) => doc.rotate(ids, 90))
		},
		deletePages: {
			id: 'deletePages',
			label: m.commands.deletePages,
			tip: m.commands.deletePagesTip,
			icon: 'icon-[material-symbols-light--delete-outline]',
			// The last page stays
			enabled: () => editable() && ed.pagesToChange().length < (ed.doc?.pages.length ?? 0),
			run: () =>
				void changePages((doc, ids) => {
					doc.deletePages(new Set(ids));
					ed.clearPagePick();
					ed.current = Math.min(ed.current, doc.pages.length - 1);
				})
		},
		moveUp: { id: 'moveUp', label: m.commands.moveUp, tip: m.commands.moveTip, icon: 'icon-[material-symbols-light--arrow-upward]', enabled: () => canMove('up'), run: () => movePages('up') },
		moveDown: {
			id: 'moveDown',
			label: m.commands.moveDown,
			tip: m.commands.moveTip,
			icon: 'icon-[material-symbols-light--arrow-downward]',
			enabled: () => canMove('down'),
			run: () => movePages('down')
		},
		moveFirst: { id: 'moveFirst', label: m.commands.moveFirst, icon: 'icon-[material-symbols-light--vertical-align-top]', enabled: () => canMove('up'), run: () => movePages('first') },
		moveLast: { id: 'moveLast', label: m.commands.moveLast, icon: 'icon-[material-symbols-light--vertical-align-bottom]', enabled: () => canMove('down'), run: () => movePages('last') },
		insertBlank: {
			id: 'insertBlank',
			label: m.commands.insertBlank,
			tip: m.commands.insertBlankTip,
			icon: 'icon-[material-symbols-light--note-add-outline]',
			enabled: editable,
			run: () =>
				void changePages((doc) => {
					const at = ed.current + 1;
					if (doc.insertBlank(at)) ed.goTo(at);
				}),
			// With a paper: a page of that paper, as big as the current one
			menu: () => PAPERS.map((paper) => ({ label: m.newPdf.blankWith(m.newPdf.papers[paper]), run: () => void changePages(() => void insertPaper(paper)) }))
		},
		duplicatePages: {
			id: 'duplicatePages',
			label: m.commands.duplicatePages,
			tip: m.commands.duplicatePagesTip,
			icon: 'icon-[material-symbols-light--content-copy-outline]',
			enabled: editable,
			run: () =>
				void changePages((doc, ids) => {
					const made = doc.duplicatePages(new Set(ids));
					ed.clearPagePick();
					const at = doc.pages.findIndex((p) => p.id === made.at(-1));
					if (at >= 0) ed.goTo(at);
				})
		},
		present: {
			id: 'present',
			label: m.show.present,
			tip: m.show.presentTip,
			icon: 'icon-[material-symbols-light--slideshow-outline]',
			shortcut: { key: 'F5' },
			enabled: () => !!ed.doc && ed.doc.editable !== 'checking',
			run: () => void present(fromStart()),
			menu: presentMenu(fromStart)
		},
		presentFromHere: {
			id: 'presentFromHere',
			label: m.show.fromHere,
			tip: m.show.fromHereTip,
			icon: 'icon-[material-symbols-light--co-present-outline]',
			shortcut: { key: 'F5', shift: true },
			enabled: () => !!ed.doc && ed.doc.editable !== 'checking',
			run: () => void present(fromHere()),
			menu: presentMenu(fromHere)
		},
		insertPdf: {
			id: 'insertPdf',
			label: m.commands.insertPdf,
			tip: m.commands.insertPdfTip,
			icon: 'icon-[material-symbols-light--picture-as-pdf-outline]',
			enabled: editable,
			run: () => void changePages(() => void insertFrom('pdf'))
		},
		insertImage: {
			id: 'insertImage',
			label: m.commands.insertImage,
			tip: m.commands.insertImageTip,
			icon: 'icon-[material-symbols-light--add-photo-alternate-outline]',
			enabled: editable,
			run: () => void changePages(() => void insertFrom('image'))
		},
		extract: {
			id: 'extract',
			label: m.commands.extract,
			tip: m.commands.extractTip,
			icon: 'icon-[material-symbols-light--file-export-outline]',
			enabled: () => !!ed.doc,
			run: () => {
				const doc = ed.doc;
				if (!doc) return;
				const places = ed.pagesToChange().map((id) => doc.pages.findIndex((p) => p.id === id));
				void saveNew((d) => d.extract(places), m.commands.extractName(stem()), m.commands.extractTitle);
			}
		},
		merge: {
			id: 'merge',
			label: m.commands.merge,
			tip: m.commands.mergeTip,
			icon: 'icon-[material-symbols-light--merge]',
			enabled: () => !!ed.doc,
			run: () => void mergeWith()
		},
		hand: { id: 'hand', label: m.commands.hand, tip: m.commands.handTip, icon: 'icon-[material-symbols-light--pan-tool-outline]', shortcut: { key: 'h' }, active: () => tools.tool === 'hand', run: () => choose('hand') },
		text: {
			id: 'text',
			label: m.commands.selectText,
			tip: m.commands.selectTextTip,
			icon: 'icon-[material-symbols-light--text-select-start]',
			shortcut: { key: 'v' },
			active: () => tools.tool === 'text',
			run: () => choose('text')
		},
		pen: drawingTool('pen', tm.pen, 'icon-[material-symbols-light--ink-pen-outline]', 'p'),
		// Paints freely (the marking tools follow the text); H is "Hand"
		highlighter: drawingTool('highlighter', tm.highlighter, 'icon-[material-symbols-light--format-ink-highlighter-outline]', 'g'),
		smoothing: {
			id: 'smoothing',
			label: tm.smoothing,
			tip: tm.smoothingHint,
			icon: 'icon-[material-symbols-light--gesture]',
			enabled: () => !sc.sel() && (tools.tool === 'pen' || tools.tool === 'highlighter'),
			menu: () =>
				SMOOTHING_LEVELS.map((level, i) => ({
					label: tm.smoothingLevels[i],
					checked: level === tools.smoothing,
					run: () => {
						tools.smoothing = level;
						tools.store();
					}
				}))
		},
		penOnly: {
			id: 'penOnly',
			label: tm.penOnly,
			tip: tm.penOnlyTip,
			icon: 'icon-[material-symbols-light--do-not-touch-outline]',
			active: () => tools.penOnly,
			run: () => {
				tools.penOnly = !tools.penOnly;
				tools.store();
				if (tools.penOnly) toast(tm.penOnlyOn, 'info');
			}
		},
		highlight: { ...drawingTool('highlight', m.commands.highlight, 'icon-[material-symbols-light--ink-highlighter]', 'm'), tip: m.commands.markTip },
		underline: { ...drawingTool('underline', m.commands.underline, 'icon-[material-symbols-light--format-underlined]', 'u'), tip: m.commands.markTip },
		squiggly: { ...drawingTool('squiggly', m.commands.squiggly, 'icon-[material-symbols-light--format-underlined-squiggle]', 'w'), tip: m.commands.markTip },
		area: { ...drawingTool('area', m.commands.area, 'icon-[material-symbols-light--highlight-outline]', 'a'), tip: m.commands.areaTip },
		insert: { ...drawingTool('insert', m.commands.insert, 'icon-[material-symbols-light--insert-text-outline]', 'i'), tip: m.commands.insertTip },
		replace: { ...drawingTool('replace', m.commands.replace, 'icon-[material-symbols-light--find-replace]', 'r'), tip: m.commands.replaceTip },
		strikeout: { ...drawingTool('strikeout', m.commands.strikeout, 'icon-[material-symbols-light--strikethrough-s]', 'x'), tip: m.commands.markTip },
		textbox: { ...drawingTool('textbox', m.commands.textbox, 'icon-[material-symbols-light--text-fields]', 't'), tip: m.commands.textboxTip },
		attach: { ...drawingTool('attach', m.attach.command, 'icon-[material-symbols-light--attach-file]', 'j'), tip: m.attach.tip },
		downloadAttached: {
			id: 'downloadAttached',
			label: m.attach.download,
			icon: 'icon-[material-symbols-light--download]',
			enabled: () => !!selectedFile(),
			run: downloadSelectedFile
		},
		callout: { ...drawingTool('callout', m.commands.callout, 'icon-[material-symbols-light--mode-comment-outline]', 'c'), tip: m.commands.calloutTip },
		stamp: { ...drawingTool('stamp', m.commands.stamp, 'icon-[material-symbols-light--approval-outline]', 'k'), tip: m.commands.stampTip, menu: stampMenu },
		link: { ...drawingTool('link', m.commands.link, 'icon-[material-symbols-light--link]', 'y'), tip: m.commands.linkTip },
		editLink: {
			id: 'editLink',
			label: m.link.edit,
			icon: 'icon-[material-symbols-light--edit-outline]',
			enabled: () => {
				const items = ed.selection?.items ?? [];
				return editable() && items.length === 1 && isLink(items[0]);
			},
			run: () => {
				const [item] = ed.selection?.items ?? [];
				if (item && isLink(item)) ed.linkEdit = item.id;
			}
		},
		editStamp: {
			id: 'editStamp',
			label: m.stamps.editText,
			icon: 'icon-[material-symbols-light--edit-outline]',
			enabled: () => {
				const items = ed.selection?.items ?? [];
				return editable() && items.length === 1 && isStamp(items[0]) && !items[0].image;
			},
			run: () => {
				const [item] = ed.selection?.items ?? [];
				if (item && isStamp(item) && !item.image) ed.stampEdit = item.id;
			}
		},
		stampFromSelection: {
			id: 'stampFromSelection',
			label: m.stamps.fromSelection,
			tip: m.stamps.fromSelectionTip,
			icon: 'icon-[material-symbols-light--select-all]',
			enabled: () => !!ed.selection?.count,
			run: () => stampFromSelection(ed)
		},
		stampFromArea: {
			id: 'stampFromArea',
			label: m.stamps.fromArea,
			tip: m.stamps.fromAreaTip,
			icon: 'icon-[material-symbols-light--screenshot-region]',
			enabled: has,
			active: () => tools.tool === 'capture',
			run: () => choose(tools.tool === 'capture' ? 'hand' : 'capture')
		},
		picture: {
			id: 'picture',
			label: m.commands.picture,
			tip: m.commands.pictureTip,
			icon: 'icon-[material-symbols-light--image-outline]',
			enabled: editable,
			run: () => void insertPicture()
		},
		note: { ...drawingTool('note', m.commands.note, 'icon-[material-symbols-light--sticky-note-2-outline]', 'n'), tip: m.commands.noteTip },
		shape: {
			...drawingTool('shape', tm.shape, 'icon-[material-symbols-light--shapes-outline]', 's'),
			// Measuring draws with the shape tool too: then this one isn't the tool
			active: () => tools.tool === 'shape' && !measureTool.kind,
			run: () => {
				endMeasuring();
				choose('shape');
			},
			menu: () =>
				SHAPE_KINDS.map((kind) => ({
					label: tm.shapes[kind],
					glyph: shapeGlyph(kind),
					checked: !measureTool.kind && kind === tools.shape,
					run: () => {
						endMeasuring();
						tools.shape = kind;
						choose('shape');
					}
				}))
		},
		measureDistance: measureCommand('distance', 'icon-[material-symbols-light--straighten-outline]', 'd'),
		measurePerimeter: measureCommand('perimeter', 'icon-[material-symbols-light--polyline-outline]'),
		measureArea: measureCommand('area', 'icon-[material-symbols-light--square-foot]'),
		contentEdit: {
			id: 'contentEdit',
			label: m.content.edit,
			tip: m.content.editTip,
			icon: 'icon-[material-symbols-light--edit-document-outline]',
			enabled: editable,
			active: () => contentEdit.on,
			run: () => void toggleContent()
		},
		contentSelect: {
			id: 'contentSelect',
			label: m.content.select,
			tip: m.content.selectTip,
			icon: 'icon-[material-symbols-light--arrow-selector-tool-outline]',
			enabled: () => editable() && contentEdit.on,
			active: () => contentEdit.on && tools.tool === 'content',
			run: () => choose('content')
		},
		contentSelectAll: {
			id: 'contentSelectAll',
			label: m.content.selectAll,
			tip: m.content.selectAllTip,
			icon: 'icon-[material-symbols-light--select-all]',
			enabled: () => editable() && contentEdit.on,
			run: () => {
				const doc = ed.doc;
				if (!doc) return;
				choose('content');
				const page = ed.current;
				void doc.loadContent(page).then(() => contentEdit.select(page, (doc.contentItems(page) ?? []).map((i) => i.id)));
			}
		},
		contentDelete: {
			id: 'contentDelete',
			label: m.content.delete,
			tip: m.content.deleteTip,
			icon: 'icon-[material-symbols-light--delete-outline]',
			enabled: () => editable() && contentPicked(),
			run: () => {
				if (!ed.doc || contentEdit.page === null) return;
				ed.doc.removeContent(contentEdit.page, contentEdit.ids);
				contentEdit.clear();
			}
		},
		contentReplaceImage: {
			id: 'contentReplaceImage',
			label: m.content.replaceImage,
			tip: m.content.replaceImageTip,
			icon: 'icon-[material-symbols-light--imagesmode-outline]',
			enabled: () => editable() && !!pickedImage(),
			run: () => void replaceImage()
		},
		flattenSelection: {
			id: 'flattenSelection',
			label: m.content.flatten,
			tip: m.content.flattenTip,
			icon: 'icon-[material-symbols-light--layers-outline]',
			enabled: () => editable() && flattenable().length > 0,
			run: () => void flattenSelection()
		},
		flattenAll: {
			id: 'flattenAll',
			label: m.content.flattenAll,
			tip: m.content.flattenAllTip,
			icon: 'icon-[material-symbols-light--stacks-outline]',
			enabled: () => editable() && (void ed.doc?.changes, !!ed.doc?.canFlatten()),
			run: async () => {
				if (!(await contentAllowed())) return;
				ed.selection?.clear();
				ed.doc?.flattenAll();
			}
		},
		measureCalibrate: measureCommand('calibrate', 'icon-[material-symbols-light--architecture]'),
		measureScale: {
			id: 'measureScale',
			label: m.measure.scaleCommand,
			tip: m.measure.scaleTip,
			icon: 'icon-[material-symbols-light--design-services-outline]',
			enabled: editable,
			run: () => (scaling = true)
		},
		eraser: {
			...drawingTool('eraser', tm.eraser, 'icon-[material-symbols-light--ink-eraser-outline]', 'e'),
			menu: () => [
				...(['stroke', 'pixel'] as const).map((mode) => ({
					label: tm.eraserModes[mode],
					checked: mode === tools.eraserMode,
					run: () => {
						tools.eraserMode = mode;
						choose('eraser');
					}
				})),
				{ separator: true as const },
				...ERASER_SIZES.map((size) => ({
					label: tm.sizeValue(size),
					checked: size === tools.eraser,
					run: () => {
						tools.eraser = size;
						choose('eraser');
					}
				}))
			]
		},
		lasso: { ...drawingTool('lasso', tm.lasso, 'icon-[material-symbols-light--arrow-selector-tool-outline]', 'l'), tip: tm.lassoHint },
		deleteSelection: sc.delete,
		selectAll: {
			id: 'selectAll',
			label: m.commands.selectAll,
			tip: m.commands.selectAllTip,
			icon: 'icon-[material-symbols-light--select-all]',
			shortcut: { key: 'a', ctrl: true },
			enabled: () => editable() && has(),
			run: () => {
				choose('lasso');
				ed.selection?.selectAll(ed.current);
			}
		},
		snap: {
			id: 'snap',
			label: tm.snap,
			tip: tm.snapHint,
			icon: 'icon-[material-symbols-light--grid-guides-outline]',
			active: () => tools.snap,
			run: () => {
				tools.snap = !tools.snap;
				tools.store();
			}
		},
		zoomIn: { id: 'zoomIn', label: m.commands.zoomIn, icon: 'icon-[material-symbols-light--zoom-in]', shortcut: { key: '+', ctrl: true }, enabled: has, run: () => ed.zoomIn() },
		zoomOut: { id: 'zoomOut', label: m.commands.zoomOut, icon: 'icon-[material-symbols-light--zoom-out]', shortcut: { key: '-', ctrl: true }, enabled: has, run: () => ed.zoomOut() },
		fitWidth: { id: 'fitWidth', label: m.commands.fitWidth, icon: 'icon-[material-symbols-light--fit-page-width]', enabled: has, run: () => ed.fitWidth() },
		fitPage: { id: 'fitPage', label: m.commands.fitPage, icon: 'icon-[material-symbols-light--fit-page]', enabled: has, run: () => ed.fitPage() },
		actualSize: { id: 'actualSize', label: m.commands.actualSize, icon: 'icon-[material-symbols-light--crop-free]', shortcut: { key: '0', ctrl: true }, enabled: has, run: () => ed.actualSize() },
		first: { id: 'first', label: m.commands.firstPage, icon: 'icon-[material-symbols-light--first-page]', shortcut: { key: 'Home' }, enabled: () => ed.current > 0, run: () => ed.goTo(0) },
		previous: {
			id: 'previous',
			label: m.commands.previousPage,
			icon: 'icon-[material-symbols-light--keyboard-arrow-left]',
			shortcut: { key: 'PageUp' },
			enabled: () => ed.current > 0,
			run: () => ed.goTo(ed.current - 1)
		},
		next: {
			id: 'next',
			label: m.commands.nextPage,
			icon: 'icon-[material-symbols-light--keyboard-arrow-right]',
			shortcut: { key: 'PageDown' },
			enabled: () => ed.current < ed.pageCount - 1,
			run: () => ed.goTo(ed.current + 1)
		},
		last: { id: 'last', label: m.commands.lastPage, icon: 'icon-[material-symbols-light--last-page]', shortcut: { key: 'End' }, enabled: () => ed.current < ed.pageCount - 1, run: () => ed.goTo(ed.pageCount - 1) }
	} satisfies Record<string, Command>;

	/** Ctrl+F: the search panel (its field takes the focus) */
	const find: Command = {
		id: 'find',
		label: m.commands.find,
		icon: 'icon-[material-symbols-light--search]',
		shortcut: { key: 'f', ctrl: true },
		active: () => ed.panel === 'search',
		run: () => {
			ed.panel = null;
			queueMicrotask(() => (ed.panel = 'search'));
		}
	};
	// The page commands in the panel "Pages" (right click or long press on a page)
	const asEntry = (c: Command) => ({ label: c.label, icon: c.icon, disabled: c.enabled ? !c.enabled() : false, run: c.run! });
	ed.pageMenu = () => [
		asEntry(commands.rotateLeft),
		asEntry(commands.rotateRight),
		{ separator: true },
		asEntry(commands.moveFirst),
		asEntry(commands.moveUp),
		asEntry(commands.moveDown),
		asEntry(commands.moveLast),
		{ separator: true },
		asEntry(commands.duplicatePages),
		asEntry(commands.insertBlank),
		asEntry(commands.insertPdf),
		asEntry(commands.insertImage),
		{ separator: true },
		asEntry(commands.extract),
		// The picked pages, else the current one – like every entry here
		{ label: m.print.command, icon: commands.print.icon, run: () => (printing = 'picked') },
		{ label: m.export.pageCommand, icon: commands.exportPages.icon, run: () => (exporting = 'picked') },
		asEntry(commands.deletePages)
	];


	// `=` is `+` without Shift on many layouts
	const zoomInAlt: Command = { ...commands.zoomIn, id: 'zoomInAlt', shortcut: { key: '=', ctrl: true } };

	const panels: PanelSpec<EditorState>[] = [
		{ id: 'pages', icon: 'icon-[material-symbols-light--auto-stories-outline]', label: m.panels.pages, load: async () => (await import('#lib/panels/PagesPanel.svelte')).default },
		{
			id: 'search',
			icon: 'icon-[material-symbols-light--search]',
			label: m.panels.search,
			load: async () => (await import('#lib/panels/SearchPanel.svelte')).default
		},
		{
			id: 'stamps',
			icon: 'icon-[material-symbols-light--approval-outline]',
			label: m.panels.stamps,
			load: async () => (await import('#lib/panels/StampsPanel.svelte')).default
		},
		{
			id: 'comments',
			icon: 'icon-[material-symbols-light--comment-outline]',
			label: m.panels.comments,
			load: async () => (await import('#lib/panels/CommentsPanel.svelte')).default
		},
		{
			id: 'fields',
			icon: 'icon-[material-symbols-light--fact-check-outline]',
			label: m.panels.fields,
			available: () => hasFields(),
			load: async () => (await import('#lib/panels/FieldsPanel.svelte')).default
		},
		{
			id: 'outline',
			icon: 'icon-[material-symbols-light--bookmarks-outline]',
			label: m.panels.outline,
			available: () => !!ed.doc?.outline.length,
			load: async () => (await import('#lib/panels/OutlinePanel.svelte')).default
		},
		{
			id: 'attachments',
			icon: 'icon-[material-symbols-light--attach-file]',
			label: m.panels.attachments,
			available: () => !!ed.doc?.attachments.length || !!ed.doc?.attachedCount,
			load: async () => (await import('#lib/panels/AttachmentsPanel.svelte')).default
		},
		{
			id: 'layers',
			icon: 'icon-[material-symbols-light--layers-outline]',
			label: m.panels.layers,
			available: () => !!ed.doc?.hasLayers,
			load: async () => (await import('#lib/panels/LayersPanel.svelte')).default
		},
		// Seldom used: last
		{ id: 'notes', icon: 'icon-[material-symbols-light--speaker-notes-outline]', label: m.panels.notes, load: async () => (await import('#lib/panels/NotesPanel.svelte')).default },
		{ id: 'steps', icon: 'icon-[material-symbols-light--format-list-numbered]', label: m.panels.steps, load: async () => (await import('#lib/panels/StepsPanel.svelte')).default }
	];

	/** Opens or closes a side panel (commands of the "View" tab; on phones the only way to them) */
	const openPanel = { get: () => ed.panel, set: (id: string | null) => (ed.panel = id) };
	const panelCommand = (spec: PanelSpec<EditorState>): Command => sharedPanelCommand(spec, openPanel);

	// --- Contextual tabs: format by kind (of the selection, else of what the chosen tool draws) and arrange ---

	/** Writing into a text box or a note's comment (it is selected) */
	function edit(id: string) {
		const item = ed.selection?.items.find((i) => i.id === id);
		if (item && isCommented(item)) ed.noteEdit = id;
		else if (item && isStamp(item)) ed.stampEdit = item.image ? null : id;
		else if (item && isLink(item)) ed.linkEdit = id;
		else ed.textEdit = id;
	}
	const kind = $derived(ed.selection?.count ? kindOf(ed.selection.items) : editable() ? toolKind(tools.tool) : null);
	const objectGroup: RibbonGroup = { id: 'object', label: m.ribbon.groups.object, items: [sc.duplicate, commands.deleteSelection] };
	const revealGroup: RibbonGroup = { id: 'visibility', label: m.ribbon.groups.visibility, items: [{ id: 'visibility', label: m.present.visibility, custom: visibilityButton }] };
	/** A format tab for one kind: its format group, then duplicate and delete (phones open it for a selection only) */
	const formatTab = (id: FormatKind, label: string, groups: RibbonGroup[]): RibbonTab => ({
		id,
		label,
		contextual: true,
		visible: () => kind === id,
		follow: () => !!sc.sel(),
		groups: [...groups, revealGroup, objectGroup]
	});
	const color: RibbonItem = { id: 'color', label: inkMessages().selection.color, custom: formatColor };
	/** Colors of the selection while they are dragged (opacity, picker) – `fill`, `border`: shown at once,
	 * applied as one step at the end; gone with another selection */
	let drafts = $derived.by((): Partial<Record<'fill' | 'border', string | null>> => {
		void ed.selection?.items;
		return {};
	});
	/** Background or border of text boxes: the selection's applied once at the end (shown meanwhile), the new ones' at once */
	function draftOr<T extends string | null>(key: 'fill' | 'border', value: T): T {
		return key in drafts ? (drafts[key] as T) : value;
	}
	function colorChange(key: 'fill' | 'border', v: string | null, final: boolean, apply: (v: string | null) => void) {
		if (!sc.sel()) return apply(v);
		const { [key]: _, ...rest } = drafts;
		drafts = final ? rest : { ...rest, [key]: v };
		if (final) apply(v);
	}

	/** The PDF has fields to fill in */
	function hasFields() {
		return !!ed.doc?.fields.some((f) => FILLABLE.has(f.kind));
	}
	const formCommands: Record<'highlightFields' | 'clearForm', Command> = {
		highlightFields: {
			id: 'highlightFields',
			label: m.commands.highlightFields,
			tip: m.commands.highlightFieldsTip,
			icon: 'icon-[material-symbols-light--highlight-mouse-cursor]',
			enabled: hasFields,
			active: () => formView.highlight,
			run: toggleHighlight
		},
		clearForm: {
			id: 'clearForm',
			label: m.commands.clearForm,
			tip: m.commands.clearFormTip,
			icon: 'icon-[material-symbols-light--format-clear]',
			enabled: () => editable() && hasFields(),
			run: () => ed.doc?.clearForm()
		}
	};

	const tabs: RibbonTab[] = [
		{
			id: 'file',
			label: brandMessages().ribbon.file,
			groups: [
				{ id: 'pdf', label: m.ribbon.groups.pdf, items: [commands.newPdf, commands.download, commands.exportPages, commands.print, commands.share, commands.showInFiles] },
				{ id: 'newFile', label: m.ribbon.groups.newFile, items: [commands.extract, commands.merge] }
			]
		},
		{
			id: 'home',
			label: m.ribbon.tabs.home,
			groups: [
				{ id: 'tools', label: m.ribbon.groups.tools, items: [commands.hand, commands.text] },
				{ id: 'find', label: m.ribbon.groups.find, items: [find] }
			]
		},
		{
			id: 'comment',
			label: m.ribbon.tabs.comment,
			groups: [
				{ id: 'select', label: m.ribbon.groups.select, items: [commands.lasso, commands.selectAll, commands.snap] },
				{ id: 'markup', label: m.ribbon.groups.markup, items: [commands.highlight, commands.underline, commands.squiggly, commands.strikeout, commands.insert, commands.replace, commands.area] },
				{ id: 'notes', label: m.ribbon.groups.notes, items: [commands.note, commands.textbox, commands.callout, commands.attach, commands.link, commands.stamp, commands.picture, { id: 'icon', label: m.commands.icon, custom: iconButton }] },
				{ id: 'draw', label: m.ribbon.groups.draw, items: [commands.pen, commands.highlighter, commands.shape, commands.eraser, commands.penOnly] },
				{ id: 'measure', label: m.ribbon.groups.measure, items: [commands.measureDistance, commands.measurePerimeter, commands.measureArea, commands.measureCalibrate, commands.measureScale] }
			]
		},
		{
			id: 'content',
			label: m.ribbon.tabs.content,
			groups: [
				{ id: 'content', label: m.ribbon.groups.content, items: [commands.contentEdit, commands.contentSelect, commands.contentSelectAll, commands.contentReplaceImage, commands.contentDelete] },
				{ id: 'flatten', label: m.ribbon.groups.flatten, items: [commands.flattenSelection, commands.flattenAll] }
			]
		},
		{
			id: 'pages',
			label: m.ribbon.tabs.pages,
			groups: [
				{ id: 'rotate', label: m.ribbon.groups.rotate, items: [commands.rotateLeft, commands.rotateRight] },
				{ id: 'organize', label: m.ribbon.groups.organize, items: [commands.duplicatePages, commands.deletePages, commands.moveUp, commands.moveDown] },
				{ id: 'insert', label: m.ribbon.groups.insert, items: [commands.insertBlank, commands.insertPdf, commands.insertImage] }
			]
		},
		{
			id: 'form',
			label: m.ribbon.tabs.form,
			groups: [
				{
					id: 'fields',
					label: m.ribbon.groups.fields,
					items: [panelCommand(panels.find((p) => p.id === 'fields')!), formCommands.highlightFields, formCommands.clearForm]
				}
			]
		},
		{
			id: 'present',
			label: m.ribbon.tabs.present,
			groups: [
				{ id: 'present', label: m.ribbon.groups.present, items: [commands.present, commands.presentFromHere] },
				{ id: 'prepare', label: m.ribbon.groups.prepare, items: [panelCommand(panels.find((p) => p.id === 'notes')!), panelCommand(panels.find((p) => p.id === 'steps')!)] }
			]
		},
		{
			id: 'view',
			label: m.ribbon.tabs.view,
			groups: [{ id: 'panels', label: m.ribbon.groups.panels, items: panels.map(panelCommand) }]
		},
		// The format of what is selected or what the chosen tool draws, and how a selection is arranged
		formatTab('text', m.ribbon.tabs.textbox, [
			{ id: 'text', label: m.ribbon.groups.text, items: [sc.editText, { id: 'textColor', label: m.textbox.textColor, custom: formatColor }, sc.fontSize] },
			{ id: 'paragraph', label: m.ribbon.groups.paragraph, items: [sc.alignLeft, sc.alignCenter, sc.alignRight, sc.justify] },
			{
				id: 'box',
				label: m.ribbon.groups.box,
				items: [{ id: 'fill', label: m.textbox.fill, custom: fillButton }, { id: 'border', label: m.textbox.border, custom: borderButton }, sc.borderWidth]
			},
			{ id: 'sizing', label: m.ribbon.groups.sizing, items: [sc.autoWidth, sc.autoHeight, sc.fixedSize] }
		]),
		formatTab('note', m.ribbon.tabs.note, [{ id: 'format', label: m.ribbon.groups.format, items: [sc.editComment, sc.noteIcon, color, commands.downloadAttached] }]),
		formatTab('markup', m.ribbon.tabs.markup, [{ id: 'format', label: m.ribbon.groups.format, items: [sc.editComment, color] }]),
		formatTab('link', m.ribbon.tabs.link, [{ id: 'format', label: m.ribbon.groups.format, items: [commands.editLink] }]),
		formatTab('stamp', m.ribbon.tabs.stamp, [{ id: 'format', label: m.ribbon.groups.format, items: [commands.editStamp, color] }]),
		formatTab('drawing', m.ribbon.tabs.drawing, [
			{ id: 'format', label: m.ribbon.groups.format, items: [color, sc.thickness, commands.smoothing, { id: 'style', label: inkMessages().selection.style, custom: formatStyle }] }
		]),
		formatTab('mixed', m.ribbon.tabs.selection, [{ id: 'format', label: m.ribbon.groups.format, items: [color] }]),
		{
			id: 'arrange',
			label: m.ribbon.tabs.arrange,
			contextual: true,
			// Only for a selection (its commands work on one)
			visible: () => !!sc.sel(),
			groups: arrangeGroups(sc)
		}
	];

	// Ctrl+Y redoes too
	const redoAlt: Command = { ...commands.redo, id: 'redoAlt', shortcut: { key: 'y', ctrl: true } };
	// Backspace deletes too
	const deleteAlt: Command = { ...commands.deleteSelection, id: 'deleteAlt', shortcut: { key: 'Backspace' } };

	// While presenting, the presentation has the keys
	$effect(() => installCommandKeys(() => (presenting ? [] : [...Object.values(commands), zoomInAlt, redoAlt, deleteAlt, find])));
	// Arrow keys move the selection (one undo step per key sequence)
	$effect(() => installNudgeKeys(() => ed.selection));

	// Esc ends a selection; without one it goes back from any tool to "Select" (not while typing or while a menu,
	// popover or dialog takes the Esc)
	$effect(() => {
		const key = (e: KeyboardEvent) => {
			if (e.key !== 'Escape' || e.defaultPrevented || presenting || document.querySelector(':popover-open, dialog[open], .modal-open')) return;
			if (ed.selection?.active) ed.selection.clear();
			else if (tools.tool !== 'lasso' && editable() && !inTextField(e.target)) choose('lasso');
		};
		addEventListener('keydown', key);
		return () => removeEventListener('keydown', key);
	});

	// Another tool ends the selection and the shape suggestion
	$effect(() => {
		const tool = tools.tool;
		untrack(() => {
			ed.suggestion?.clear();
			if (tool !== 'lasso') ed.selection?.clear();
		});
	});

	/** A stroke became a shape: select it, so its points can be moved right away */
	function shapeAccepted(shape: { page: number; id: string }) {
		choose('lasso');
		ed.selection?.select(shape.page, new Set([shape.id]));
	}

	// --- Bars ---

	function ready(s: PdfStage, selection: PdfSelection, suggestion: PdfSuggestion, showField: (widget: string) => void) {
		ed.showField = showField;
		ed.stage = s;
		ed.selection = selection;
		ed.suggestion = suggestion;
		ed.updateView();
	}

	async function download() {
		const doc = ed.doc;
		if (!doc) return;
		try {
			downloadBlob(await read(doc.path), doc.name);
		} catch (e) {
			error = m.editor.loadFailed(filesErrorText(e));
		}
	}

	function showInFiles() {
		const doc = ed.doc;
		if (doc) location.assign(filesUrl(doc.path));
	}

	$effect(() => {
		const doc = ed.doc;
		if (!doc) return setBrandBar({ crumbs: [{ label: m.editor.back, href: resolve('/pdf-editor') }] });
		return setBrandBar({
			crumbs: [
				{ label: doc.name }
			]
		});
	});

	function zoomMenu(): MenuEntry[] {
		return [commands.fitWidth, commands.fitPage, commands.actualSize].map((c) => ({ label: c.label, icon: c.icon, run: c.run }));
	}

	function goToTyped(e: SubmitEvent) {
		e.preventDefault();
		const n = Number.parseInt(pageInput, 10);
		if (Number.isFinite(n)) ed.goTo(Math.min(Math.max(1, n), ed.pageCount) - 1);
		pageInput = '';
		(document.activeElement as HTMLElement | null)?.blur();
	}

	$effect(() => setBrandFooter({ status: footerStatus, save: ed.doc ? saveStateOf(ed.doc) : null }));
</script>

<svelte:head>
	{#if ed.doc}<title>{ed.doc.name} · {toolName('pdf-editor')}</title>{/if}
</svelte:head>

<!-- Format tabs: the color of the selection, else of what the chosen tool draws next – every one with its opacity -->
{#snippet formatColor(size: GroupSize)}
	{@const s = sc.sel()}
	<InkColorButton
		id="formatColor"
		selection={s}
		value={inkColor()}
		onpick={setInkColor}
		label={kind === 'text' ? m.textbox.textColor : inkMessages().selection.color}
		{size}
		disabled={s ? !s.colorable : !kind}
	/>
{/snippet}

<!-- An icon in the pen's color, in the middle of the view -->
{#snippet iconButton(size: GroupSize)}
	<RibbonPopover id="icon" label={m.commands.icon} icon="icon-[material-symbols-light--interests-outline]" {size} disabled={!editable()}>
		{#snippet children(close)}
			<div class="max-h-[60vh] w-80 max-w-[calc(100vw-2.5rem)] overflow-x-hidden overflow-y-auto">
				<IconPicker
					onpick={(icon) => {
						close();
						void insertIcon(icon);
					}}
					hint={m.commands.iconHint}
				/>
			</div>
		{/snippet}
	</RibbonPopover>
{/snippet}

<!-- Every format tab: at which steps of the presentation the selected comments show -->
{#snippet visibilityButton(size: GroupSize)}
	<VisibilityButton doc={ed.doc} selection={sc.sel()} steps={(index) => ed.stepsOf(index)} {size} />
{/snippet}

<!-- Format tab "Text box": background and border (with their opacity; "None") -->
{#snippet fillButton(size: GroupSize)}
	{@const fill = draftOr('fill', sc.boxStyle().fill)}
	<RibbonPopover id="fill" label={m.textbox.fill} icon="icon-[material-symbols-light--format-paint-outline]" {size} swatch={fill} disabled={kind !== 'text'}>
		{#snippet children()}
			<ColorField value={fill} allowNone onchange={(v, final) => colorChange('fill', v, final, (c) => sc.styleTexts({ fill: c }))} />
		{/snippet}
	</RibbonPopover>
{/snippet}

{#snippet borderButton(size: GroupSize)}
	{@const border = draftOr('border', sc.boxStyle().border)}
	<RibbonPopover id="border" label={m.textbox.border} icon="icon-[material-symbols-light--border-outer]" {size} swatch={border} disabled={kind !== 'text'}>
		{#snippet children()}
			<ColorField value={border} allowNone onchange={(v, final) => colorChange('border', v, final, (c) => sc.styleTexts({ border: c }))} />
		{/snippet}
	</RibbonPopover>
{/snippet}

<!-- Format tab "Drawing": style of the selected shapes, else of the next shape -->
{#snippet formatStyle(size: GroupSize)}
	<InkStyleButton id="formatStyle" selection={sc.sel()} {tools} {size} />
{/snippet}

<!-- A command as a small footer button (name and shortcut as tooltip) -->
{#snippet footerButton(c: Command, cls = '')}
	<button
		class={['btn btn-ghost btn-xs btn-square', cls]}
		disabled={c.enabled?.() === false}
		onclick={() => c.run?.()}
		title={c.shortcut ? `${c.label} (${shortcutLabel(c.shortcut, brandMessages().keys)})` : c.label}
		aria-label={c.label}
		data-command={c.id}
	>
		<span class={[c.icon, 'size-4']} aria-hidden="true"></span>
	</button>
{/snippet}

{#snippet footerStatus()}
	{#if ed.doc}
		<div class="flex items-center">
			{@render footerButton(commands.first, 'max-sm:hidden')}
			{@render footerButton(commands.previous)}
			<form class="flex items-center gap-1 px-0.5" onsubmit={goToTyped}>
				<input
					class="input input-xs w-12 text-center tabular-nums"
					inputmode="numeric"
					aria-label={m.editor.pageField}
					placeholder={String(ed.current + 1)}
					bind:value={pageInput}
				/>
				<span class="tabular-nums">/ {ed.pageCount}</span>
			</form>
			{@render footerButton(commands.next)}
			{@render footerButton(commands.last, 'max-sm:hidden')}
		</div>
		<div class="flex items-center">
			{@render footerButton(commands.zoomOut)}
			<button class="btn btn-ghost btn-xs min-w-14 font-normal tabular-nums" onclick={(e) => openMenuAbove(e, zoomMenu())} title={m.ribbon.groups.zoom}>
				{m.editor.zoom(Math.round(ed.zoom * 100))}
			</button>
			{@render footerButton(commands.zoomIn)}
		</div>
		<!-- Editing the pages' own content: said as long as the switch is on -->
		{#if contentEdit.on}
			<span class="truncate px-1 max-sm:hidden" data-testid="content-status">{contentStatus()}</span>
		{/if}
	{/if}
{/snippet}

{#if error}
	<div class="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
		<p class="max-w-md">{error}</p>
		<div class="flex gap-2">
			{#if access}<button class="btn btn-primary" onclick={access.run}>{access.label}</button>{/if}
			<a class="btn" href={resolve('/pdf-editor')}>{m.editor.back}</a>
		</div>
	</div>
{:else if ed.doc}
	{@const doc = ed.doc}
	<div class="flex h-full min-h-0 flex-col">
		<Ribbon {tabs} quick={[commands.undo, commands.redo]} storage="pdf-editor" initial="home" />
		<div class="flex min-h-0 flex-1">
			<PanelRail {panels} context={ed} bind:open={ed.panel} storage="pdf-editor" />
			<div class="flex min-w-0 flex-1 flex-col">
				{#if doc.conflict}
					<div role="alert" class="alert alert-warning rounded-none py-2 text-sm">
						<span class="icon-[material-symbols-light--warning-outline] size-5" aria-hidden="true"></span>
						<span>{doc.conflict === 'changed' ? m.conflict.changed(doc.name) : m.conflict.deleted(doc.name)}</span>
						<div class="flex gap-2">
							{#if doc.conflict === 'changed'}
								<button class="btn btn-sm" onclick={() => void reload?.(true)}>{m.conflict.reload}</button>
							{/if}
							<button class="btn btn-ghost btn-sm" onclick={() => void doc.keepMine()}>{m.conflict.keepMine}</button>
						</div>
					</div>
				{:else if doc.editable === 'encrypted' || doc.editable === 'failed' || doc.editable === 'readonly'}
					<div role="status" class="alert rounded-none py-2 text-sm">
						<span class="icon-[material-symbols-light--lock-outline] size-5" aria-hidden="true"></span>
						<span>{doc.editable === 'encrypted' ? m.notice.encrypted : doc.editable === 'readonly' ? m.notice.readonly : m.notice.failed}</span>
					</div>
				{:else if doc.signed && !signedSeen}
					<div role="status" class="alert rounded-none py-2 text-sm">
						<span class="icon-[material-symbols-light--verified-outline] size-5" aria-hidden="true"></span>
						<span>{m.notice.signed}</span>
						<button class="btn btn-ghost btn-sm btn-square" onclick={() => (signedSeen = true)} title={m.common.close} aria-label={m.common.close}>
							<span class="icon-[material-symbols-light--close] size-5" aria-hidden="true"></span>
						</button>
					</div>
				{/if}
				<div class="relative min-h-0 flex-1">
					{#key doc}
						<Surface {doc} onready={ready} onedit={edit} onview={() => ed.updateView()} oncapture={(page, box) => stampFromArea(ed, page, box)} onattach={(page, x, y) => void attachFile(page, x, y)} onlink={(page, x, y) => void followLink(page, x, y)} oncalibrate={(points, clear) => (calibrating = { points, clear })} hits={ed.hits} current={ed.currentHit} />
					{/key}
					<!-- Next to the surface, not in it: presses on them must not reach the surface's input -->
					{#if ed.selection}
						{@const selection = ed.selection}
						{#if !ed.textEdit && !ed.noteEdit && !ed.stampEdit && !ed.linkEdit}
							<!-- Only the object's actions here; formats are on the contextual tabs -->
							<SelectionMenu {selection}>
								{#snippet actions()}
									{#if commands.downloadAttached.enabled?.()}
										<button class="btn btn-ghost btn-sm btn-square" onclick={commands.downloadAttached.run} title={commands.downloadAttached.label} aria-label={commands.downloadAttached.label}>
											<span class="icon-[material-symbols-light--download] size-5" aria-hidden="true"></span>
										</button>
									{/if}
									<button class="btn btn-ghost btn-sm btn-square" onclick={commands.stampFromSelection.run} title={commands.stampFromSelection.label} aria-label={commands.stampFromSelection.label}>
										<span class="icon-[material-symbols-light--approval-outline] size-5" aria-hidden="true"></span>
									</button>
									{#if commands.flattenSelection.enabled?.()}
										<button class="btn btn-ghost btn-sm btn-square" onclick={commands.flattenSelection.run} title={commands.flattenSelection.label} aria-label={commands.flattenSelection.label} data-command="flattenSelection">
											<span class="icon-[material-symbols-light--layers-outline] size-5" aria-hidden="true"></span>
										</button>
									{/if}
									<!-- Writing its text opens on the item (touch screens have no double click) -->
									{#if sc.editText.enabled()}
										<button class="btn btn-ghost btn-sm btn-square" onclick={sc.editText.run} title={sc.editText.label} aria-label={sc.editText.label}>
											<span class="icon-[material-symbols-light--edit-outline] size-5" aria-hidden="true"></span>
										</button>
									{:else if commands.editLink.enabled?.()}
										<button class="btn btn-ghost btn-sm btn-square" onclick={commands.editLink.run} title={commands.editLink.label} aria-label={commands.editLink.label}>
											<span class="icon-[material-symbols-light--edit-outline] size-5" aria-hidden="true"></span>
										</button>
									{:else if commands.editStamp.enabled?.()}
										<button class="btn btn-ghost btn-sm btn-square" onclick={commands.editStamp.run} title={commands.editStamp.label} aria-label={commands.editStamp.label}>
											<span class="icon-[material-symbols-light--edit-outline] size-5" aria-hidden="true"></span>
										</button>
									{:else if sc.editComment.enabled()}
										<button class="btn btn-ghost btn-sm btn-square" onclick={sc.editComment.run} title={sc.editComment.label} aria-label={sc.editComment.label}>
											<span class="icon-[material-symbols-light--edit-note-outline] size-5" aria-hidden="true"></span>
										</button>
									{/if}
								{/snippet}
							</SelectionMenu>
						{/if}
						<TextEditor {selection} {doc} stage={ed.stage} editing={ed.textEdit} ondone={() => (ed.textEdit = null)} />
						<NoteEditor {selection} {doc} editing={ed.noteEdit} ondone={() => (ed.noteEdit = null)} />
						<StampEditor {selection} {doc} editing={ed.stampEdit} ondone={() => (ed.stampEdit = null)} />
						<LinkEditor {selection} {doc} editing={ed.linkEdit} ondone={() => (ed.linkEdit = null)} />
					{/if}
					{#if ed.suggestion}<ShapeSuggestionButton suggestion={ed.suggestion} onaccept={shapeAccepted} />{/if}
				</div>
			</div>
		</div>
	</div>
	{#if creating}<NewPdfDialog folder={parent(doc.path)} oncreated={(path) => location.assign(editorUrl(path))} onclose={() => (creating = false)} />{/if}
	{#if printing}<PrintDialog {ed} which={printing} onclose={() => (printing = null)} />{/if}
	{#if exporting}<ExportDialog {ed} which={exporting} onclose={() => (exporting = null)} />{/if}
	{#if scaling}<MeasureDialog {ed} onclose={() => (scaling = false)} />{/if}
	{#if calibrating}
		<CalibrateDialog
			{ed}
			points={calibrating.points}
			onclose={(done) => {
				// The distance asked about goes, whatever the answer
				calibrating?.clear();
				calibrating = null;
				// Calibrated: on to measuring, e.g. a second known distance as a check
				if (done) measureWith('distance');
			}}
		/>
	{/if}
	{#if stampDialogs.page}<PdfPageDialog path={stampDialogs.page.path} pages={stampDialogs.page.pages} ondone={stampDialogs.page.done} />{/if}
	{#if stampDialogs.word}<StampWordDialog word={stampDialogs.word.word} onclose={() => (stampDialogs.word = null)} />{/if}
	{#if presenting?.mode === 'display'}
		<Display {doc} display={presenting.display} onexit={stopPresenting} />
	{:else if presenting?.mode === 'presenter'}
		{@const p = presenting}
		<Presenter {doc} control={p.control} onend={stopPresenting} onopen={() => p.open(p.control.place)} />
	{/if}
{:else}
	<div class="flex h-full items-center justify-center">
		<span class="loading loading-spinner opacity-60"></span>
	</div>
{/if}
