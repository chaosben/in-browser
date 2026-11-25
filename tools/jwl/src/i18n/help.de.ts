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
				text: 'Erstelle in JW Library eine Sicherung (oder teile eine Playlist) und teile sie mit in-browser – auf Android und am Computer wird dir das installierte in-browser dafür angeboten. Auf iPhone oder iPad sichere sie in „Dateien“ und wähle hier „Vom Gerät importieren …“ (oder „Hochladen“ im Tool Dateien von in-browser). Eine ankommende Sicherung fragt wie jede Datei, wo sie liegen soll. Wähle die Sicherung, die du aufbewahrst, um sie darin zusammenzuführen: Der Dialog schlägt die vor, in die du zuletzt zusammengeführt hast, und „Zusammenführen“ übernimmt, was die neue Sicherung hat. „Ersetzen“ überschreibt sie stattdessen, ein neuer Name legt sie als eigene Datei ab. Eine ankommende Datei – Sicherung oder Playlist – wird nicht geöffnet: Eine Meldung sagt, wo sie liegt (mit „Öffnen“) oder was das Zusammenführen geändert hat (mit „Rückgängig“), und sie steht als erste auf der Startseite.',
				tip: 'Bewahre eine Sicherung für alle deine Geräte auf (z. B. „JW Library.jwlibrary“) und führe jede neue darin zusammen. Stelle dann diese auf jedem Gerät wieder her.',
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
			how: {
				title: 'Wie das Zusammenführen arbeitet',
				text: 'Zusammenführen legt nie einfach eine Datei über die andere: Es geht jede Notiz, Markierung, jedes Lesezeichen, jeden Tag und jeden Playlist-Eintrag durch. Was nur eine Datei hat, bleibt. Jedes Ergebnis trägt eine eigene Kennung und wird in deinen Dateien aufbewahrt (versteckt, die letzten zehn). Hat ein Gerät dieses Ergebnis wiederhergestellt und kommt seine nächste Sicherung zurück, weiß JWL-Dateien, was das Gerät seitdem geändert hat – bearbeitet, hinzugefügt und gelöscht – und übernimmt genau das; was inzwischen in der anderen Datei geändert wurde, bleibt. Löschungen kommen auch ohne Wiederherstellen an: Die zuletzt zusammengeführte Sicherung jedes Geräts wird gemerkt (versteckt in deinen Dateien, eine je Gerät, unterschieden am Gerätenamen in der Sicherung), und was ein Gerät darin hatte und in seiner nächsten nicht mehr hat, wird gelöscht – was nur deine anderen Geräte hatten, bleibt. Die erste Sicherung eines Geräts fügt nur hinzu: Durch sie wird nichts gelöscht. Das Gemerkte liegt in deinen Dateien und reist mit der Synchronisation deiner Geräte: Eine Sicherung, die auf einem Gerät zusammengeführt wird, das es noch nicht hat, kann nur hinzufügen, und eine Meldung sagt das – synchronisiere die Geräte und führe sie noch einmal zusammen.',
				tip: 'Führe die Sicherungen all deiner Geräte in einer Datei zusammen, jedes Gerät unter eigenem Namen: Zwei Geräte mit demselben Namen gelten als eines, und die Sicherung des einen würde löschen, was nur das andere hatte. Um jedes Gerät auf denselben Stand zu bringen, stelle dort nach dem Zusammenführen das Ergebnis wieder her.'
			},
			conflicts: {
				title: 'Wenn beide dasselbe geändert haben',
				text: 'Haben beide Dateien dieselbe Notiz geändert, zählt die später geänderte (nach ihrer Änderungszeit). Markierungen werden je Absatz, in dem sie liegen, als Ganzes von einer Seite übernommen – überlappende Markierungen zweier Geräte landen nie übereinander. Legen zwei Geräte ein Lesezeichen auf denselben Platz, rückt das zweite auf einen freien Platz derselben Publikation (es gibt zehn); sind alle zehn belegt, entfällt es.'
			},
			safety: {
				title: 'Rückfrage, bevor viel wegfällt, und „Rückgängig“',
				text: 'Würde ein Zusammenführen mehr als ein Fünftel (und mehr als 20) der Markierungen und Notizen entfernen, fragt es vorher und nennt die Zahlen. Danach nennt eine Meldung, was neu, geändert und entfernt ist – „Rückgängig“ darin stellt die Datei wieder her, wie sie war. Hatte die Datei schon alles, wird nichts geschrieben. Eine inzwischen geänderte Datei (auf einem anderen Gerät, in einem anderen Tab) wird von vorn zusammengeführt.'
			},
			manual: {
				title: '„Zusammenführen mit …“',
				text: 'Im Tab „Datei“ einer geöffneten Sicherung und im Menü einer Sicherung in Dateien: Wähle eine andere Sicherung aus deinen Dateien, und sie wird genauso in diese geführt – auch eine Kopie, die die Synchronisation behalten hat, als zwei Geräte die Sicherung gleichzeitig geändert haben („… (Konflikt …)“).'
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
				text: 'Die Liste zeigt jede Notiz mit Titel, dem Anfang ihres Texts und wohin sie gehört; das Feld darüber durchsucht Titel und Text. „Notiz bearbeiten …“ (oder ein Doppelklick) öffnet Titel und Text – „Fertig“ behält, Esc stellt zurück. „Tags“ hängt einen deiner Tags an die ausgewählten Notizen oder nimmt ihn ab. „Tags ▾“ neben dem Suchfeld (oder „Nach Tags filtern“ im Tab „Notizen“) zeigt nur die Notizen mit den Tags, die du anhakst – jeder steht dann unter dem Feld, × nimmt ihn weg. Bei mehreren Tags zeigt „Notizen mit allen davon“ (Standard) die, die jeden haben, „einem davon“ die, die irgendeinen haben; „Alle Notizen zeigen“ beendet den Filter. „Notizen als Text …“ (Tab „Datei“) speichert die ausgewählten Notizen – sonst alle – als Textdatei in deinen Dateien.'
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
