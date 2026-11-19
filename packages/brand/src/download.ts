// Saving through the browser's download (to the computer's download folder), not into the browser storage.

/** Downloads an object or data URL under `name` */
export function downloadUrl(url: string, name: string) {
	const a = document.createElement('a');
	a.href = url;
	a.download = name;
	a.click();
}

/** Downloads `blob` under `name`; its object URL is freed a minute later (the download has started by then) */
export function downloadBlob(blob: Blob, name: string) {
	const url = URL.createObjectURL(blob);
	downloadUrl(url, name);
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
