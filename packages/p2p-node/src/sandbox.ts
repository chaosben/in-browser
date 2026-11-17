// How the starter runs the sync process: Node's permission model lets it read only itself, its state and the
// synced folder, write only the latter two, and use the network – nothing else of the computer.

export function sandboxArgs(bundle: string, sync: string, folder: string): string[] {
	return [
		'--permission',
		'--allow-net',
		// `--allow-net` is still experimental in Node 26
		'--disable-warning=ExperimentalWarning',
		`--allow-fs-read=${bundle}`,
		`--allow-fs-read=${sync}`,
		`--allow-fs-read=${folder}`,
		`--allow-fs-write=${sync}`,
		`--allow-fs-write=${folder}`
	];
}
