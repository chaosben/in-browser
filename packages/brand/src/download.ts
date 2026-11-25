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
	// A file without a type (an ending the browser doesn't know) is taken for text by Chrome on Android, which then
	// appends “.txt” to its name – so it always gets one
	const url = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: 'application/octet-stream' }));
	downloadUrl(url, name);
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
