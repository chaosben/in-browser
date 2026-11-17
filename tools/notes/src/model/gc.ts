// Cleaning up assets nobody uses any more. Assets (images, PDFs) are only ever added; when the last page using one
// is deleted, its file stays behind – undo can still bring it back during the session. On opening a notebook,
// files that no page references and that are older than a grace period are removed. The grace period protects
// against a sync race: another device adds an image, its asset arrives here before the page file that uses it.

export const GRACE_MS = 24 * 60 * 60 * 1000;

export interface AssetFile {
	name: string;
	/** Last change (ms) */
	modified: number;
}

/** Names of the asset files that can be deleted */
export function unusedAssets(files: readonly AssetFile[], referenced: ReadonlySet<string>, now: number, grace = GRACE_MS): string[] {
	return files.filter((f) => !referenced.has(f.name) && now - f.modified > grace).map((f) => f.name);
}
