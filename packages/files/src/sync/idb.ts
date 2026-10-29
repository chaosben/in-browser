// Minimal key-value store in IndexedDB (database `in-browser-files`, store `sync`): IndexedDB is the only storage
// that keeps a folder handle (`FileSystemDirectoryHandle`) across visits.

const DB = 'in-browser-files';
const STORE = 'sync';

let db: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
	db ??= new Promise((resolve, reject) => {
		const request = indexedDB.open(DB, 1);
		request.onupgradeneeded = () => request.result.createObjectStore(STORE);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
	return db;
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
	const store = (await open()).transaction(STORE, mode).objectStore(STORE);
	return new Promise((resolve, reject) => {
		const request = action(store);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

export const idbGet = <T>(key: string) => run<T | undefined>('readonly', (s) => s.get(key));
export const idbSet = (key: string, value: unknown) => run('readwrite', (s) => s.put(value, key)).then(() => {});
export const idbDelete = (key: string) => run('readwrite', (s) => s.delete(key)).then(() => {});
