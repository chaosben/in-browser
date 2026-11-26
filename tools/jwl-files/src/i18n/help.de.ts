import type enHelp from './help.en.js';

const help: typeof enHelp = {
	start: {
		title: 'Sicherungen und Playlists',
		items: {
			what: {
				title: 'Wofür JWL-Dateien da ist',
				text: 'JW Library speichert deine Notizen, Markierungen, Lesezeichen, Tags und Playlists in einer Sicherung (.jwlibrary) und gibt einzelne Playlists als .jwlplaylist-Dateien weiter. JWL-Dateien öffnet beides: Es zeigt, was darin ist, lässt dich aufräumen und bearbeiten und führt die Sicherungen deiner Geräte zu einer zusammen. Alles geschieht in diesem Browser – die Dateien werden nie hochgeladen. Die Startseite zeigt die zuletzt geöffneten oder importierten Dateien; „Öffnen …“ nimmt eine deiner Dateien, „Neue Playlist …“ legt eine leere Playlist-Datei an, „Vom Gerät importieren …“ nimmt eine Datei dieses Geräts: Sie wird in deinen Dateien abgelegt, wo du sagst, und steht dann auf der Startseite – geöffnet wird sie nicht.'
			},
			receive: {
				title: 'Von JW Library zu in-browser',
				text: 'Erstelle in JW Library eine Sicherung (oder teile eine Playlist) und teile sie mit in-browser – auf Android und am Computer wird dir das installierte in-browser dafür angeboten. Auf iPhone oder iPad sichere sie in „Dateien“ und wähle hier „Vom Gerät importieren …“ (oder „Hochladen“ im Tool Dateien von in-browser). Eine ankommende Datei fragt wie jede Datei, wo sie liegen soll. Geöffnet wird sie nicht – weder Sicherung noch Playlist: Eine Meldung sagt, wo sie liegt (mit „Öffnen“), und sie steht als erste auf der Startseite. Um eine neue Sicherung in die zu bringen, die du aufbewahrst, öffne diese und wähle „Zusammenführen mit …“ (unten).',
				link: { href: '/help/install', label: 'in-browser installieren' }
			},
			send: {
				title: 'Zurück zu JW Library',
				text: 'Im Tab „Datei“ gibt „Senden …“ die Datei an eine andere App des Geräts – darunter JW Library –, wo der Browser es erlaubt; Chrome auf Android tut es für diese Dateien nicht, dort bleibt der Knopf aus. „Herunterladen“ legt die Datei im Download-Ordner des Geräts ab: Öffne sie aus der Download-Meldung oder dem Ordner, und JW Library stellt die Sicherung wieder her oder fügt die Playlist hinzu. Am Computer ziehst du sie aus dem Download-Ordner in JW Library oder öffnest sie dort mit „Sicherung wiederherstellen“.'
			}
		}
	},
	merge: {
		title: 'Sicherungen zusammenführen',
		items: {
			manual: {
				title: '„Zusammenführen mit …“',
				text: 'Öffne die Sicherung, die du aufbewahrst, wähle im Tab „Datei“ „Zusammenführen mit …“ und dann eine andere Sicherung aus deinen Dateien – die neue eines Geräts oder eine Kopie, die die Synchronisation behalten hat, als zwei Geräte die Sicherung gleichzeitig geändert haben („… (Konflikt …)“). Was sie hat, wird als eine Änderung in die geöffnete Sicherung übernommen: Eine Meldung nennt, was neu und geändert ist, „Rückgängig“ darin (oder Strg+Z) nimmt es zurück, und gespeichert wird es wie jede Änderung. Die andere Datei bleibt, wie sie ist. Hat die geöffnete Sicherung schon alles, ändert sich nichts.',
				tip: 'Bewahre eine Sicherung für alle deine Geräte auf (z. B. „JW Library.jwlibrary“), führe jede neue Sicherung darin zusammen und stelle diese auf jedem Gerät wieder her.'
			},
			how: {
				title: 'Was übernommen wird',
				text: 'Zusammenführen legt nie einfach eine Datei über die andere: Es geht jede Notiz, Markierung, jedes Lesezeichen, Eingabefeld, jeden Tag und jeden Playlist-Eintrag durch. Was nur eine der beiden Dateien hat, bleibt – Zusammenführen löscht also nie etwas.'
			},
			conflicts: {
				title: 'Wenn beide dasselbe verschieden haben',
				text: 'Das Neuere gilt: eine Notiz nach ihrer eigenen Änderungszeit, alles andere nach der Zeit, zu der die Datei zuletzt geändert wurde. Die Meldung sagt, wie viele verschieden waren. Markierungen werden je Absatz als Ganzes aus der neueren Datei übernommen – die der anderen Datei kommen dazu, wo sie nicht überlappen, sodass Markierungen nie übereinander landen. Haben beide Dateien ein Lesezeichen auf demselben Platz, rückt das andere auf einen freien Platz derselben Publikation (es gibt zehn); sind alle zehn belegt, entfällt es.'
			},
			deleted: {
				title: 'Gelöschtes kommt zurück',
				text: 'Zusammenführen fügt nur hinzu: Was du auf einem Gerät gelöscht hast, kommt aus einer Sicherung zurück, die es noch hat. Lösche es in der zusammengeführten Sicherung (hier in JWL-Dateien, oder in JW Library, nachdem du sie dort wiederhergestellt hast, und mach dann eine neue Sicherung).',
				tip: 'Erst zusammenführen, dann löschen – und das Ergebnis auf deinen Geräten wiederherstellen, damit keine ältere Sicherung es zurückbringt.'
			}
		}
	},
	edit: {
		title: 'Hineinschauen und aufräumen',
		items: {
			show: {
				title: 'Was angezeigt wird',
				text: 'Die Gruppe „Anzeigen“ im Tab „Start“ wechselt zwischen „Überblick“ (welche Art Datei, von welchem Gerät, wann und wie viele von allem), „Notizen“, „Markierungen“, „Lesezeichen“, „Tags“ und „Playlists“. Ein Klick wählt einen Eintrag aus, Strg+Klick und Umschalt+Klick mehrere, Strg+A alle; auf einem Touchscreen öffnet langes Drücken das Menü eines Eintrags und startet das Auswählen, jeder Eintrag hat auch ein ⋯. „Löschen“ (oder Entf) entfernt die Auswahl. Jede Änderung wird von selbst gespeichert und lässt sich rückgängig machen (Strg+Z, Strg+Y).',
				keys: [['Strg', 'A'], ['Entf'], ['Strg', 'Z'], ['Strg', 'Y']]
			},
			notes: {
				title: 'Notizen',
				text: 'Die Liste zeigt jede Notiz mit Titel, dem Anfang ihres Texts und wohin sie gehört; das Feld darüber durchsucht Titel und Text. „Notiz bearbeiten …“ (oder ein Doppelklick) öffnet Titel, Text und Tags – „Fertig“ behält alles als eine Änderung, Esc stellt zurück. „Tags …“ (Tab „Notizen“ und das Menü einer Notiz) zeigt die Tags der ausgewählten Notizen; ein gestrichelter Tag hängt nur an einigen davon – klick ihn an, um ihn allen zu geben. Tags wählst du durch Tippen: Die Liste unter dem Feld zeigt die passenden Tags, ↑/↓ wandern darin, Eingabe übernimmt einen, „Neuer Tag …“ legt einen mit dem getippten Namen an; × an einem Tag nimmt ihn weg, die Rücktaste im leeren Feld den letzten, das × am Ende alle. Das Feld „Nach Tags filtern …“ unter der Suche (oder „Nach Tags filtern“ im Tab „Notizen“) zeigt nur die Notizen mit den Tags, die du dort eintippst. Bei mehreren Tags zeigt „Notizen mit allen davon“ (Standard) die, die jeden haben, „einem davon“ die, die irgendeinen haben. „Notizen als Text …“ (Tab „Datei“) speichert die ausgewählten Notizen – sonst alle – als Textdatei in deinen Dateien.',
				keys: [['↑'], ['↓'], ['Eingabe'], ['Rücktaste']]
			},
			highlights: {
				title: 'Markierungen',
				text: 'Markierungen stehen nach Publikation und Farbe mit ihrer Anzahl in der Liste. „Farbe“ gibt den ausgewählten Gruppen eine andere Farbe, „Löschen“ entfernt sie (Notizen darauf bleiben, wo sie sind). „Aufräumen“ entfernt Markierungen, die keinen Text abdecken, und Tags, die an nichts hängen.'
			},
			tags: {
				title: 'Tags und Lesezeichen',
				text: '„Neuer Tag“ legt einen Tag an und lässt dich ihn benennen. „Umbenennen“ (oder F2 oder ein Klick auf den Namen des ausgewählten Tags) benennt ihn um – ein Name, den ein anderer Tag hat, legt beide zusammen. „Zusammenlegen mit“ verschiebt alles der ausgewählten Tags auf einen anderen. Lesezeichen kannst du ansehen und löschen.',
				keys: [['F2']]
			}
		}
	},
	playlists: {
		title: 'Playlists',
		items: {
			create: {
				title: 'Eine neue Playlist',
				text: '„Neue Playlist …“ auf der Startseite fragt, wo die neue .jwlplaylist-Datei liegen und wie sie heißen soll – die Playlist bekommt den Namen der Datei – und öffnet sie leer: Füge Bilder und Videos hinzu und gib sie dann an JW Library. In einer geöffneten Sicherung legt „Neue Playlist“ (Tab „Playlist“) eine leere Playlist darin an und lässt dich sie gleich benennen.'
			},
			list: {
				title: 'Playlists in einer Sicherung',
				text: '„Playlists“ zeigt sie mit der Zahl ihrer Einträge; öffne eine mit einem Klick (oder „Öffnen“), benenne sie mit „Umbenennen“ (oder F2) um. „Playlist hinzufügen …“ nimmt eine .jwlplaylist aus deinen Dateien in die Sicherung auf (unter einem freien Namen), „Als Playlist-Datei speichern …“ speichert die geöffnete Playlist als eigene .jwlplaylist, „Playlist löschen“ entfernt sie mit ihren Einträgen.'
			},
			trim: {
				title: 'Ein Video oder Musikstück schneiden',
				text: '„Schneiden …“ (Tab „Playlist“ oder das Menü eines Eintrags) spielt nur einen Teil des ausgewählten Videos oder Musikstücks ab – wie „Schneiden“ in JW Library, und was dort geschnitten ist, zeigt sich hier (die Schere neben der Länge). Gib „Anfang“ und „Ende“ als Minuten:Sekunden ein (z. B. 1:43.5; ein Komma geht auch). Bei einem eigenen Video läuft darüber eine Vorschau: „Anfang hier“ und „Ende hier“ übernehmen ihre Position, ▷ spielt ab dem Anfang oder kurz vor dem Ende. Videos und Musik aus Publikationen liegen in JW Library, darum gibt es für sie hier keine Vorschau – nur die Zeiten. „Ungeschnitten“ spielt wieder alles; „Fertig“ behält es, als ein Schritt zum Rückgängigmachen. Bilder werden nicht geschnitten: Ihre „Sekunden“ sagen, wie lange sie gezeigt werden.'
			},
			items: {
				title: 'Einträge',
				text: 'Eine Playlist zeigt ihre Einträge der Reihe nach mit Bild, Name, Länge und was an ihrem Ende geschieht. Ändere den Namen in seinem Feld, die Sekunden eines Bilds (wie lange es gezeigt wird) und „Am Ende“ direkt dort. „Nach oben“ und „Nach unten“ verschieben die ausgewählten Einträge (am Computer auch durch Ziehen), „Entfernen“ nimmt sie heraus. „Bilder und Videos …“ fügt Bilder und Videos aus deinen Dateien am Ende hinzu, „Vom Gerät …“ solche dieses Geräts; „Playlist anhängen …“ die Einträge einer anderen .jwlplaylist. Videos und Musik aus Publikationen, in JW Library hinzugefügt, zeigen Art und Länge.',
				options: {
					continue: { label: '„Weiter“', text: 'der nächste Eintrag folgt von selbst.' },
					stop: { label: '„Stopp“', text: 'die Playlist hält an; der Bildschirm geht zur Liste zurück.' },
					freeze: { label: '„Standbild“', text: 'der Eintrag bleibt stehen, bis du weitergehst – für Bilder während eines Vortrags.' },
					repeat: { label: '„Wiederholen“', text: 'der Eintrag beginnt von vorn.' }
				},
				tip: 'Für Bilder, die du beim Sprechen zeigst, nimm „Standbild“: Sie bleiben, bis du weitertippst. Für eine Bilderschau, die von selbst läuft, „Weiter“ mit den Sekunden, die jedes Bild stehen soll.'
			}
		}
	}
};

export default help;
