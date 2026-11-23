// The presentation over the suite's live channels (`@in-browser/files/p2p/live-ends.js`): the display offers itself
// to the other end of its connections – the device sharing the PDF with this browser, or this user's other devices –
// as a live session `present`, and a remote control there talks to it on the channel `present` with the messages of
// `protocol.ts`. Nothing of it knows whether the other end is a guest or a device.

import type { Json } from '@in-browser/files/p2p/rpc.js';
import type { LiveEnd } from '@in-browser/files/p2p/live-ends.js';
import { connectionOf } from '@in-browser/files/path.js';
import { fromDisplay, toDisplay, type FromDisplay, type ShowLink, type ToDisplay } from './protocol.js';
import type { DisplayController } from './display.svelte.js';

const CHANNEL = 'present';
/** A display tells its live session this often (an end that came back hears it again) */
const ANNOUNCE_MS = 10_000;

function endLink<In, Out extends Json>(end: LiveEnd, check: (raw: unknown) => In | null, latest?: (message: Out) => string | undefined): ShowLink<In, Out> {
	const offs: (() => void)[] = [];
	return {
		send: (message) => end.send(CHANNEL, message, { latest: latest?.(message) }),
		onMessage(handler) {
			const off = end.onMessage(CHANNEL, (raw) => {
				const message = check(raw);
				if (message) handler(message);
			});
			offs.push(off);
			return off;
		},
		close: () => offs.splice(0).forEach((off) => off())
	};
}

/** The display's end of a remote control on `end` */
export const displayEndLink = (end: LiveEnd) => endLink<ToDisplay, FromDisplay & Json>(end, toDisplay) as ShowLink<ToDisplay, FromDisplay>;

/** A remote control's end on `end`: of the pointer's positions only the newest goes out */
export const controlEndLink = (end: LiveEnd) =>
	endLink<FromDisplay, ToDisplay & Json>(end, fromDisplay, (m) => (m.t === 'pointer' ? 'pointer' : undefined)) as ShowLink<FromDisplay, ToDisplay>;

/** The path of a PDF as the device sharing it names it (inside the share), or null for a file of this device */
function sharedPath(path: string): string | null {
	const place = connectionOf(path);
	return place?.id === 'share' ? place.inner : null;
}

/**
 * Offers a display to remote controls: on the connection to the device sharing the PDF with this browser, else to
 * this user's other devices (this tab takes the lead for that – only when there are any). Returns how to stop
 * offering.
 */
export function offerRemote(display: DisplayController, path: string, title: string): () => void {
	let stopped = false;
	const cleanups: (() => void)[] = [];
	const attached = new Set<LiveEnd>();
	const inShare = sharedPath(path);

	const offer = (end: LiveEnd, at: string) => {
		const tell = (sessions: Json) => end.send('live', { sessions });
		if (!attached.has(end)) {
			attached.add(end);
			const link = displayEndLink(end);
			const detach = display.attach(link, { remote: true });
			// Heard again after the connection came back
			const off = end.onState(() => end.open && tell([{ kind: 'present', path: at, title }]));
			cleanups.push(() => {
				tell([]);
				off();
				detach();
				link.close();
			});
		}
		tell([{ kind: 'present', path: at, title }]);
	};

	void (async () => {
		const files = await import('@in-browser/files/sources/share.js');
		if (inShare !== null) {
			const end = files.shareLiveEnd();
			if (!end || stopped) return;
			offer(end, inShare);
			const timer = setInterval(() => offer(end, inShare), ANNOUNCE_MS);
			cleanups.push(() => clearInterval(timer));
			return;
		}
		// A file of this device: its other devices may control it (the live page leads, `takeLead`)
		const p2p = await import('@in-browser/files/p2p/p2p.svelte.js');
		// Only with other devices to offer it to: taking the lead moves every connection of this browser to this page
		// (all rooms entered anew), which is for nothing when nobody could steer
		for (let waited = 0; p2p.p2pStatus.view.state === 'off' && waited < 3000 && !stopped; waited += 250) await new Promise((r) => setTimeout(r, 250));
		if (stopped || p2p.p2pStatus.view.state !== 'online' || !p2p.p2pStatus.view.devices.length) return;
		await p2p.takeLead();
		if (stopped) return;
		const devices = () => p2p.liveEnds().filter((end) => end.peer.kind === 'device');
		for (const end of devices()) offer(end, path);
		cleanups.push(p2p.onLiveEnd((end) => end.peer.kind === 'device' && offer(end, path)));
		const timer = setInterval(() => devices().forEach((end) => offer(end, path)), ANNOUNCE_MS);
		cleanups.push(() => clearInterval(timer));
	})();

	return () => {
		stopped = true;
		cleanups.splice(0).forEach((cleanup) => cleanup());
	};
}
