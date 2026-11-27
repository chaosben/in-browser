
// Where a path of the sync lies on disk. Paths come from other devices: whatever they ask for stays below the
// folder. The sync's own paths split at `/` only, but Windows also splits at `\` and reads `C:` and `name:stream`
// – a name like `..\..\x` left the folder there.

/** `node:path`, or one of its `win32`/`posix` */
interface Paths {
	join(...parts: string[]): string;
	resolve(...parts: string[]): string;
	sep: string;
}

/** Characters that mean something to the system's paths and never occur in a name the sync writes */
const unsafe = (name: string, paths: Paths) => name === '' || name === '.' || name === '..' || /[\\/\0]/.test(name) || (paths.sep === '\\' && name.includes(':'));

/** The path of `names` below `root`; throws for names that would lead anywhere else */
export function realPath(paths: Paths, root: string, names: readonly string[]): string {
	const bad = names.find((name) => unsafe(name, paths));
	if (bad !== undefined) throw new Error(`Not a name: ${JSON.stringify(bad)}`);
	const base = paths.resolve(root);
	const full = paths.join(base, ...names);
	if (!isBelow(paths, base, full)) throw new Error(`Outside the folder: ${names.join('/')}`);
	return full;
}

/** `path` is `folder` or lies in it */
export function isBelow(paths: Pick<Paths, 'sep'>, folder: string, path: string): boolean {
	return path === folder || path.startsWith(folder.endsWith(paths.sep) ? folder : folder + paths.sep);
}
