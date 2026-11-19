import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { changed, watchSettled } from './changes';

describe('watchSettled', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('refreshes once after a burst of changes that concern it', () => {
		const refresh = vi.fn();
		const stop = watchSettled((paths) => paths.some((p) => p.startsWith('/a')), 100, refresh);
		changed('/a/1');
		vi.advanceTimersByTime(50);
		changed('/a/2');
		changed('/b');
		vi.advanceTimersByTime(99);
		expect(refresh).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(refresh).toHaveBeenCalledTimes(1);
		changed('/b');
		vi.advanceTimersByTime(200);
		expect(refresh).toHaveBeenCalledTimes(1);
		stop();
	});
	it('drops a pending refresh when stopped', () => {
		const refresh = vi.fn();
		const stop = watchSettled(() => true, 100, refresh);
		changed('/x');
		stop();
		vi.advanceTimersByTime(200);
		expect(refresh).not.toHaveBeenCalled();
	});
});
