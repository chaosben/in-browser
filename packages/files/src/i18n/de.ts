import type { FilesMessages } from './index.svelte.js';

const de: FilesMessages = {
	root: 'Dateien',
	kinds: {
		folder: 'Ordner',
		file: 'Datei',
		fileType: (ext) => `${ext}-Datei`,
		package: (tool) => `${tool}-Projekt`
	},

	dialog: {
		titleOpen: 'Öffnen',
		titleSave: 'Speichern unter',
		open: 'Öffnen',
		openCount: (n) => `Öffnen (${n})`,
		save: 'Speichern',
		cancel: 'Abbrechen',
		up: 'Einen Ordner nach oben',
		newFolder: 'Neuer Ordner',
		folderName: 'Name des neuen Ordners',
		create: 'Anlegen',
		name: 'Name',
		empty: 'Hier ist noch nichts.',
		exists: (name) => `„${name}“ gibt es hier schon. Wähle einen anderen Namen.`
	},

	errors: {
		notFound: (name) => `„${name}“ gibt es nicht mehr.`,
		exists: (name) => `„${name}“ gibt es schon.`,
		collision: (name) => `Es gibt schon einen Eintrag, der sich von „${name}“ nur in Groß-/Kleinschreibung unterscheidet.`,
		invalidName: (name) => `„${name}“ ist kein gültiger Name.`,
		intoItself: (name) => `„${name}“ lässt sich nicht in sich selbst verschieben oder kopieren.`,
		root: (_name) => 'Mit dem obersten Ordner geht das nicht.'
	},

	names: {
		empty: 'Gib einen Namen ein.',
		dots: '„.“ und „..“ sind nicht erlaubt.',
		chars: 'Diese Zeichen sind nicht erlaubt: \\ / : * ? " < > |',
		reserved: 'Dieser Name ist unter Windows reserviert.',
		trailing: 'Der Name darf nicht mit einem Leerzeichen beginnen und nicht mit Leerzeichen oder Punkt enden.',
		long: 'Der Name ist zu lang.'
	}
};

export default de;
