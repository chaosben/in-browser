// Suggested name of this device, from what the browser tells about itself (e.g. “Chrome on Windows”)

export interface DeviceTraits {
	browser: string;
	system: string;
}

const BROWSERS: [RegExp, string][] = [
	[/Edg\//, 'Edge'],
	[/OPR\/|Opera/, 'Opera'],
	[/Firefox\//, 'Firefox'],
	[/SamsungBrowser\//, 'Samsung Internet'],
	[/Chrome\/|CriOS\//, 'Chrome'],
	[/Safari\//, 'Safari']
];

const SYSTEMS: [RegExp, string][] = [
	[/iPhone/, 'iPhone'],
	[/iPad/, 'iPad'],
	[/Android.*Mobile/, 'Android phone'],
	[/Android/, 'Android tablet'],
	[/CrOS/, 'ChromeOS'],
	[/Windows/, 'Windows'],
	[/Mac OS X|Macintosh/, 'Mac'],
	[/Linux/, 'Linux']
];

/** Browser and system from a user agent string; unknown parts stay empty */
export function deviceTraits(userAgent: string): DeviceTraits {
	return {
		browser: BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? '',
		system: SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? ''
	};
}

/** `name` or, if another device already has it, `name (2)`, `name (3)` … */
export function uniqueDeviceName(name: string, taken: Iterable<string>): string {
	const names = new Set([...taken].map((n) => n.toLowerCase()));
	if (!names.has(name.toLowerCase())) return name;
	for (let i = 2; ; i++) {
		const candidate = `${name} (${i})`;
		if (!names.has(candidate.toLowerCase())) return candidate;
	}
}
