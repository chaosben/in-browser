// What presenting asks of the screen: staying awake (no screen saver on the projector, no locked phone – a locked
// phone drops its connection) and a second screen for the display. Each only where the browser offers it.

/** Keeps the screen on while the page is visible (asked again when it comes back); the returned function lets go */
export function keepAwake(): () => void {
	let lock: WakeLockSentinel | null = null;
	let stopped = false;
	const ask = async () => {
		if (stopped || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
		try {
			lock = await navigator.wakeLock.request('screen');
		} catch {
			// Refused (power saving, a policy): the screen may go dark as usual
		}
	};
	const visible = () => void ask();
	document.addEventListener('visibilitychange', visible);
	void ask();
	return () => {
		stopped = true;
		document.removeEventListener('visibilitychange', visible);
		void lock?.release().catch(() => {});
	};
}

interface ScreenDetailed {
	availLeft: number;
	availTop: number;
	availWidth: number;
	availHeight: number;
}

/**
 * Moves a window opened by this page onto another screen (the projector), filling it – where the browser can tell
 * where the screens are (Window Management; asks once for permission). False when there is none or it can't.
 */
export async function toOtherScreen(win: Window): Promise<boolean> {
	const get = (window as unknown as { getScreenDetails?: () => Promise<{ screens: ScreenDetailed[]; currentScreen: ScreenDetailed }> }).getScreenDetails;
	if (!get) return false;
	try {
		const details = await get.call(window);
		// Told apart by where they lie: the current screen's object isn't the one in the list
		const here = details.currentScreen;
		const same = (s: ScreenDetailed) => s.availLeft === here.availLeft && s.availTop === here.availTop && s.availWidth === here.availWidth && s.availHeight === here.availHeight;
		const other = details.screens.length > 1 ? details.screens.find((s) => !same(s)) : undefined;
		if (!other || win.closed) return false;
		win.moveTo(other.availLeft, other.availTop);
		win.resizeTo(other.availWidth, other.availHeight);
		return true;
	} catch {
		return false;
	}
}

/** Is a second screen attached? (only where the browser tells; null: unknown) */
export function hasOtherScreen(): boolean | null {
	const extended = (screen as Screen & { isExtended?: boolean }).isExtended;
	return typeof extended === 'boolean' ? extended : null;
}
