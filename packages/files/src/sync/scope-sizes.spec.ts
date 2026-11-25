import { describe, expect, it } from 'vitest';
import { exclude, excludedPackages, include } from '../p2p/scope.js';
import type { FileState, Snapshot } from './plan.js';
import { folderAmounts } from './scope-sizes.js';

const file = (size: number): FileState => ({ kind: 'file', size, modified: 1 });
const DIR: FileState = { kind: 'directory', size: 0, modified: 0 };

describe('folder choice', () => {
	it('offers no package and nothing inside it – its size belongs to the folder it lies in', () => {
		const here: Snapshot = new Map([
			['/Videos', DIR],
			['/Videos/Trip.screencapture', DIR],
			['/Videos/Trip.screencapture/project.json', file(10)],
			['/Videos/Trip.screencapture/media', DIR],
			['/Videos/Trip.screencapture/media/a.mp4', file(1000)],
			['/Top.screencapture', DIR],
			['/Top.screencapture/project.json', file(5)]
		]);
		expect([...folderAmounts(here, new Map())]).toEqual([['/Videos', { here: 1010, there: 0, in: 0, out: 1010 }]]);
	});

	it('takes a package in again as a whole when a folder inside it was left out', () => {
		const excluded = exclude(['/Videos/Trip.screencapture/media'], '/Other');
		expect(excludedPackages(excluded)).toEqual(['/Videos/Trip.screencapture']);
		expect(include(excluded, '/Videos/Trip.screencapture')).toEqual(['/Other']);
	});
});
