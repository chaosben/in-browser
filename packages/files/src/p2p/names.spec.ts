import { describe, expect, it } from 'vitest';
import { uniqueDeviceName } from './names.js';

describe('uniqueDeviceName', () => {
	it('numbers duplicates, case-insensitive', () => {
		expect(uniqueDeviceName('Laptop', ['Phone'])).toBe('Laptop');
		expect(uniqueDeviceName('Laptop', ['laptop', 'Laptop (2)'])).toBe('Laptop (3)');
	});
});
