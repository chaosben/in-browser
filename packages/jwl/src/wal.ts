// Folding SQLite's write-ahead log into its database file (what a checkpoint does). JW Library sometimes packs a
// backup while its database still has changes only in `userData.db-wal`; sql.js can't open the two together, so
// the committed pages are written into the file here. Format: https://www.sqlite.org/fileformat2.html#walformat

const WAL_HEADER = 32;
const FRAME_HEADER = 24;

/** Running checksum of SQLite's WAL over `data` (a multiple of 8 bytes), continuing from `s` */
function checksum(view: DataView, offset: number, length: number, little: boolean, s: [number, number]): [number, number] {
	let [s0, s1] = s;
	for (let i = offset; i < offset + length; i += 8) {
		s0 = (s0 + view.getUint32(i, little) + s1) >>> 0;
		s1 = (s1 + view.getUint32(i + 4, little) + s0) >>> 0;
	}
	return [s0, s1];
}

/**
 * The database with every committed transaction of `wal` applied, in rollback-journal mode (so it opens on its own);
 * frames after the last valid commit (an unfinished or torn write) are left out, as SQLite does. A log that isn't
 * valid at all gives the database as it is.
 */
export function foldWal(database: Uint8Array<ArrayBuffer>, wal: Uint8Array): Uint8Array<ArrayBuffer> {
	if (wal.length < WAL_HEADER) return database;
	const view = new DataView(wal.buffer, wal.byteOffset, wal.byteLength);
	const magic = view.getUint32(0);
	if (magic !== 0x377f0682 && magic !== 0x377f0683) return database;
	const little = magic === 0x377f0682;
	const pageSize = view.getUint32(8) === 1 ? 65536 : view.getUint32(8);
	if (pageSize < 512 || pageSize > 65536 || (pageSize & (pageSize - 1)) !== 0) return database;
	const salt1 = view.getUint32(16);
	const salt2 = view.getUint32(20);
	let sum = checksum(view, 0, 24, little, [0, 0]);
	if (sum[0] !== view.getUint32(24) || sum[1] !== view.getUint32(28)) return database;

	// Valid frames, applied only once their transaction's commit frame is reached
	const committed = new Map<number, number>();
	const pending = new Map<number, number>();
	let pages = 0;
	for (let at = WAL_HEADER; at + FRAME_HEADER + pageSize <= wal.length; at += FRAME_HEADER + pageSize) {
		if (view.getUint32(at + 8) !== salt1 || view.getUint32(at + 12) !== salt2) break;
		sum = checksum(view, at, 8, little, sum);
		sum = checksum(view, at + FRAME_HEADER, pageSize, little, sum);
		if (sum[0] !== view.getUint32(at + 16) || sum[1] !== view.getUint32(at + 20)) break;
		pending.set(view.getUint32(at), at + FRAME_HEADER);
		const size = view.getUint32(at + 4);
		if (size > 0) {
			for (const [page, offset] of pending) committed.set(page, offset);
			pending.clear();
			pages = size;
		}
	}
	if (pages === 0) return database;

	const out = new Uint8Array(pages * pageSize);
	out.set(database.subarray(0, Math.min(database.length, out.length)));
	for (const [page, offset] of committed) if (page <= pages) out.set(wal.subarray(offset, offset + pageSize), (page - 1) * pageSize);
	const header = new DataView(out.buffer);
	// Rollback journal instead of WAL, and a header that names the size (valid for the change counter it has)
	out[18] = 1;
	out[19] = 1;
	header.setUint32(28, pages);
	header.setUint32(92, header.getUint32(24));
	return out;
}
