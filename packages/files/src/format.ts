// Formatting of values shown by the file system components

/** Time relative to `now` like “5 minutes ago” / „vor 5 Minuten“ in the format of `locale` (BCP-47 tag) */
export function formatAgo(time: number, now: number, locale: string): string {
	const seconds = Math.round((time - now) / 1000);
	const steps: [Intl.RelativeTimeFormatUnit, number][] = [
		['second', 60],
		['minute', 60],
		['hour', 24],
		['day', 30],
		['month', 12],
		['year', Infinity]
	];
	const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
	let value = seconds;
	for (const [unit, size] of steps) {
		if (Math.abs(value) < size) return format.format(unit === 'second' && Math.abs(value) < 10 ? 0 : value, unit);
		value = Math.round(value / size);
	}
	return format.format(value, 'year');
}
