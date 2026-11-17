import { describe, expect, it } from 'vitest';
import { deviceTraits, uniqueDeviceName } from './names.js';

describe('deviceTraits', () => {
	it('recognizes common browsers and systems', () => {
		expect(
			deviceTraits('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36')
		).toEqual({ browser: 'Chrome', system: 'Windows' });
		expect(
			deviceTraits('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')
		).toEqual({ browser: 'Safari', system: 'iPhone' });
		expect(deviceTraits('Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0')).toEqual({
			browser: 'Firefox',
			system: 'Linux'
		});
		expect(deviceTraits('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36')).toEqual({
			browser: 'Chrome',
			system: 'Android phone'
		});
		expect(deviceTraits('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 Edg/140.0').browser).toBe('Edge');
	});
});

describe('uniqueDeviceName', () => {
	it('numbers duplicates', () => {
		expect(uniqueDeviceName('Laptop', ['Phone'])).toBe('Laptop');
		expect(uniqueDeviceName('Laptop', ['laptop', 'Laptop (2)'])).toBe('Laptop (3)');
	});
});
