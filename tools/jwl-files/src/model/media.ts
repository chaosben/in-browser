// Pictures and videos becoming playlist items: hashed (JW Library knows files by SHA-256), a thumbnail drawn, a
// video's length read.

import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { DEFAULT_PICTURE_SECONDS, THUMBNAIL, playlistThumbnail } from '@in-browser/jwl/playlist.js';
import type { NewItem } from '@in-browser/jwl/edits.js';

/** File kinds a playlist takes, by extension */
export const MEDIA_TYPES: Record<string, string> = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.bmp': 'image/bmp',
	'.mp4': 'video/mp4',
	'.m4v': 'video/mp4',
	'.mov': 'video/quicktime',
	'.webm': 'video/webm'
};
export const MEDIA_EXTENSIONS = Object.keys(MEDIA_TYPES);

const extOf = (name: string) => name.match(/\.[a-z0-9]+$/i)?.[0].toLowerCase() ?? '';

async function hashOf(blob: Blob): Promise<string> {
	const hash = sha256.create();
	const reader = blob.stream().getReader();
	for (let next = await reader.read(); !next.done; next = await reader.read()) hash.update(next.value);
	return bytesToHex(hash.digest());
}

/** A frame of a video and its length (seconds) */
function videoFrame(blob: Blob): Promise<{ frame: HTMLVideoElement; seconds: number; release: () => void }> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(blob);
		const video = document.createElement('video');
		video.muted = true;
		video.preload = 'auto';
		const release = () => {
			video.removeAttribute('src');
			video.load();
			URL.revokeObjectURL(url);
		};
		video.onloadedmetadata = () => {
			video.currentTime = Math.min(1, (video.duration || 0) / 2);
		};
		video.onseeked = () => resolve({ frame: video, seconds: Number.isFinite(video.duration) ? video.duration : 0, release });
		video.onerror = () => {
			release();
			reject(new Error('The video can’t be read'));
		};
		video.src = url;
	});
}

/** A picture or video as a new item (`seconds`: how long a picture is shown) */
export async function newItem(file: File, endAction: number, seconds = DEFAULT_PICTURE_SECONDS): Promise<{ item: NewItem; files: [string, Blob][] }> {
	const mime = file.type || MEDIA_TYPES[extOf(file.name)] || 'application/octet-stream';
	const media = mime === file.type ? file : new Blob([file], { type: mime });
	let thumbnail: Blob;
	let length = seconds;
	if (mime.startsWith('video/')) {
		const { frame, seconds: duration, release } = await videoFrame(media);
		try {
			thumbnail = await playlistThumbnail(frame, frame.videoWidth || THUMBNAIL.width, frame.videoHeight || THUMBNAIL.height, '#000000');
			length = duration;
		} finally {
			release();
		}
	} else {
		const bitmap = await createImageBitmap(media);
		try {
			thumbnail = await playlistThumbnail(bitmap, bitmap.width, bitmap.height);
		} finally {
			bitmap.close();
		}
	}
	const [hash, thumbHash] = await Promise.all([hashOf(media), hashOf(thumbnail)]);
	const ext = extOf(file.name).slice(1) || mime.split('/')[1];
	const label = file.name.replace(/\.[^.]+$/, '') || file.name;
	return {
		item: {
			label,
			seconds: length,
			endAction,
			media: { name: file.name, path: `${crypto.randomUUID()}.${ext}`, mime, hash },
			thumbnail: { name: crypto.randomUUID(), path: crypto.randomUUID(), mime: 'image/jpeg', hash: thumbHash }
		},
		files: [
			[hash, media],
			[thumbHash, thumbnail]
		]
	};
}

/** Whether the item shows a video (by its file's kind) */
export const isVideo = (mime: string | undefined) => !!mime?.startsWith('video/');
