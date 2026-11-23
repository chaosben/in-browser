import type help from './help.en.js';

const de: typeof help = {
	start: {
		title: 'Erste Schritte',
		items: {
			startPage: {
				title: 'Startseite',
				text: 'Die Startseite beginnt mit „Neue PDF …“, „PDF öffnen …“ und „Vom Rechner öffnen …“ und zeigt die PDFs, die du zuletzt geöffnet hast, die neueste zuerst, mit Ordner und letzter Änderung. Klicke eine an, um sie zu öffnen; das Menü daneben (drei Punkte, Rechtsklick oder langes Drücken) hat „Öffnen“ und „Aus der Liste entfernen“ – das vergisst sie nur hier, die Datei bleibt. Eine PDF, die es nicht mehr gibt, fällt von selbst aus der Liste.'
			},
			newPdf: {
				title: 'Neue PDF',
				text: '„Neue PDF …“ auf der Startseite (auch auf der Registerkarte „Datei“) legt eine leere PDF zum Schreiben und Zeichnen an – ein Notizbuch, eine Skizze, eine Folie. Wähl Seitengröße und Papier, dann den Ort, an dem sie liegen soll; sie öffnet sich sofort mit einer Seite. Weitere Seiten kommen über „Leere Seite“ auf der Registerkarte „Seiten“: Ein Klick fügt eine weiße Seite ein, so groß wie die aktuelle, der Pfeil daneben eine mit Papier („Liniert“, „Kariert“, „Gepunktet“). Das Papier gehört zur Seite wie in jeder PDF, jedes Programm zeigt und druckt es also; nachträglich ändern lässt es sich nicht – füg stattdessen eine Seite mit anderem Papier ein. Der Dialog merkt sich deine letzte Wahl auf diesem Gerät.',
				options: {
					paper: { label: 'Seitengröße: Papier', text: 'A4 (Standard; 210 × 297 mm), A5, A6, A3, US Letter, US Legal – jeweils „Hochformat“ (Standard) oder „Querformat“. Für alles, was gedruckt werden könnte.' },
					media: { label: 'Seitengröße: Bildschirm und Medien', text: '„Präsentation 16:9“ (wie Folien von Präsentationsprogrammen, 339 × 191 mm), „Präsentation 4:3“, „Quadrat 1:1“, „Hochformat 9:16“ (ein Handybildschirm). Sie haben ihre eigene Form, „Ausrichtung“ gilt dafür nicht.' },
					custom: { label: 'Eigene Größe', text: 'Breite und Höhe in Millimetern, von 10 mm bis 2 m.' },
					blank: { label: 'Papier: „Blanko“ (Standard)', text: 'Eine weiße Seite – für Skizzen, Folien und alles, was du selbst gestaltest.' },
					lined: { label: '„Liniert“', text: 'Linien im Abstand von 1 cm – für Handschrift.' },
					grid: { label: '„Kariert“', text: 'Kästchen von 5 mm – für Rechnungen, Tabellen und technische Skizzen.' },
					dotted: { label: '„Gepunktet“', text: 'Punkte alle 5 mm – Orientierung beim Schreiben und Zeichnen, die danach kaum auffällt.' }
				},
				tip: 'Für handschriftliche Notizen nimm A4 oder A5 mit Linien oder Punkten; auf einem quer gehaltenen Tablet nutzt „Querformat“ den Bildschirm am besten. Wähl eine Präsentationsgröße, wenn die Seiten am Bildschirm gezeigt statt gedruckt werden.'
			},
			open: {
				title: 'Eine PDF öffnen',
				text: '„PDF öffnen …“ wählt eine PDF aus deinen Dateien. Auch ein Doppelklick auf eine PDF in Dateien öffnet sie hier; „Vom Rechner öffnen …“ kopiert eine PDF von deinem Rechner zuerst in deine Dateien und fragt, wo sie liegen soll: Der PDF-Editor arbeitet immer an einer Datei in deinen Dateien, damit er deine Änderungen behalten kann.',
				link: { href: '/help/storage', label: 'Wo deine Dateien liegen' }
			},
			layout: {
				title: 'Aufbau',
				text: 'Die obere Leiste zeigt nur den Namen der offenen PDF – sie heißt wie ihre Datei; umbenennen kannst du sie in Dateien. Darunter liegt das Menüband: links „Rückgängig“ und „Wiederholen“, dann die Registerkarten „Datei“ (Gruppe „PDF“: „Neue PDF …“ legt eine leere an, „Herunterladen“ speichert eine Kopie auf diesem Gerät, „Drucken …“ druckt sie, „Freigeben …“ gibt sie an einen Gast (ein Link, ein QR-Code oder vier Wörter – siehe die Hilfeseite zum Freigeben), „In Dateien zeigen“ öffnet ihren Ordner in Dateien; Gruppe „Neue PDF“: Extrahieren, Zusammenführen), „Start“ (Werkzeuge, Suchen; die PDF öffnet mit dieser Registerkarte), „Kommentieren“ (Markieren, Notiz, Stempel, Zeichnen), „Seiten“ (Drehen, Duplizieren, Verschieben, Löschen, Einfügen), „Formular“ (Felder), „Präsentation“ (Notizen, Schritte) und „Ansicht“ (Seitenleisten). Jede Registerkarte zeigt ihre Befehle in Gruppen mit ihrem Namen darunter. Farbig abgesetzte Registerkarten kommen und gehen mit dem, woran du arbeitest: Ist ein Werkzeug gewählt, das Kommentare zeichnet, oder sind Kommentare ausgewählt, erscheint eine Registerkarte für ihr Format („Textfeld“, „Notiz“, „Markierung“, „Zeichnung“ oder „Auswahl“ für mehrere Arten), bei einer Auswahl außerdem „Anordnen“. Wählst du Kommentare aus, wechselt das Menüband von selbst zu ihrer Registerkarte – zu „Anordnen“, wenn du diese zuletzt benutzt hast – und zurück, wenn die Auswahl endet; eine Registerkarte, die nur das Format eines Werkzeugs zeigt, öffnet sich nie von selbst. Am linken Rand hält eine schmale Leiste die Seitenleisten: „Seiten“, „Suche“, „Stempel“, „Kommentare“, – wenn die PDF sie hat – „Felder“, „Lesezeichen“, „Anhänge“ und „Ebenen“ und zuletzt „Präsentationsnotizen“ und „Präsentationsschritte“; klicke eine an, um sie neben den Seiten zu öffnen, und noch einmal, um sie zu schließen. Ziehe ihren rechten Rand, um sie breiter zu machen. Am unteren Rand: die Pfeile zur ersten, vorherigen, nächsten und letzten Seite rund um die Seitenzahl (tippe eine andere ein und drücke Eingabe, um dorthin zu gehen) und die Anzahl der Seiten, dann „Verkleinern“, der Zoom und „Vergrößern“.'
			},
			ribbon: {
				title: 'Menüband-Anzeige',
				text: 'Wird das Fenster schmaler, werden zuerst die Gruppen rechts kleiner: Ihre Schaltflächen verlieren den Text unter dem Symbol, dann den Text ganz, und zuletzt wird eine ganze Gruppe zu einer Schaltfläche, die sie öffnet. Die Schaltfläche mit dem Leisten-Symbol am rechten Ende der Registerkarten wählt, wie das Menüband aussieht – für alle Tools von in-browser auf diesem Gerät. Der Pfeil daneben klappt das Menüband zusammen: Nur die Registerkarten bleiben, und ein Klick auf eine öffnet ihre Befehle über der Seite, bis du einen wählst; ein Doppelklick auf eine Registerkarte oder Strg+F1 tun dasselbe, und der Pfeil holt das Menüband zurück, wie es war.',
				options: {
					classic: { label: 'Klassisch (Standard am Rechner)', text: 'Befehle in drei Zeilen mit ihren Namen, in Gruppen mit je einem Namen. Am leichtesten zu finden, braucht etwa 130 Pixel Höhe.' },
					simplified: { label: 'Vereinfacht', text: 'Eine kompakte Zeile Schaltflächen, ohne Gruppennamen. Lässt mehr Platz für die Seiten.' },
					minimal: { label: 'Minimal (Standard auf Handy und Tablet)', text: 'Eine Zeile Symbole ohne Text; halte den Zeiger über ein Symbol – oder halte es gedrückt –, um seinen Namen zu sehen. Am wenigsten Höhe, und jeder Befehl bleibt erreichbar.' }
				},
				tip: 'Bleib bei „Klassisch“, bis du weißt, wo alles ist; dann schalte auf „Vereinfacht“ oder „Minimal“ – oder klapp das Menüband zusammen –, um mehr von der Seite zu sehen.',
				keys: [['Strg', 'F1']]
			},
			accessKeys: {
				title: 'Zugriffstasten',
				text: 'Drücke kurz Alt (oder F10): Auf den Registerkarten erscheinen Buchstaben, auf „Rückgängig“ und „Wiederholen“ Zahlen. Tippe den Buchstaben einer Registerkarte, dann den Buchstaben auf einem Befehl, um ihn auszuführen – alles geht ohne Maus. Esc geht einen Schritt zurück.',
				keys: [['Alt'], ['F10']]
			},
			phone: {
				title: 'Auf dem Handy',
				text: 'Auf Handy und Tablet beginnt das Menüband als „Minimal“: die Registerkarten in einer Zeile, darunter die Befehle der Registerkarte als Symbole, die sich seitwärts schieben lassen. Halte ein Symbol gedrückt, um seinen Namen zu sehen. Der Pfeil rechts neben den Registerkarten klappt das Menüband zusammen, wenn du die Höhe brauchst. Wählst du Kommentare aus, springt es von selbst zu ihrer Registerkarte; die Format-Registerkarte eines Werkzeugs steht bei den Registerkarten. Seitenleisten öffnen sich über den ganzen Bildschirm, über die Registerkarte „Ansicht“.'
			},
			connected: {
				title: 'In einem verbundenen Ordner',
				text: 'In den Dialogen wechselt die Auswahl vor dem Ordnerpfad zwischen Meine Dateien und den Ordnern, die du in Dateien verbunden hast. Eine PDF dort wird direkt aus diesem Ordner auf deinem Rechner geöffnet.',
				link: { href: '/help/connected', label: 'Verbundene Ordner' }
			},
			sync: {
				title: 'Auf allen deinen Geräten',
				text: 'PDFs sind gewöhnliche Dateien des gemeinsamen Dateisystems und reisen deshalb mit dem Synchronisieren deiner Geräte.',
				link: { href: '/help/sync', label: 'Synchronisieren zwischen Geräten' }
			},
			install: {
				title: 'Installieren und offline',
				text: 'Wenn dein Browser es anbietet, kannst du den PDF-Editor wie eine App installieren; er startet dann auch ohne Internetverbindung.',
				link: { href: '/help/install', label: 'Installieren, offline und Browser' }
			}
		}
	},
	view: {
		title: 'Ansehen',
		items: {
			navigate: {
				title: 'Durch die Seiten',
				text: 'Die Seiten liegen untereinander. Scrolle mit dem Mausrad oder dem Touchpad, schiebe mit zwei Fingern auf einem Touchscreen oder ziehe mit dem Werkzeug „Hand“ (Registerkarte „Start“) mit der Maus. Die Pfeile in der unteren Leiste springen zur ersten, vorherigen, nächsten oder letzten Seite (auf dem Handy nur zur vorherigen und nächsten); dazwischen kannst du eine Seitenzahl eintippen und Eingabe drücken.',
				keys: [['Bild↑'], ['Bild↓'], ['Pos1'], ['Ende']]
			},
			zoom: {
				title: 'Zoom',
				text: '„Vergrößern“ und „Verkleinern“ – die Schaltflächen neben dem Zoom in der unteren Leiste – ändern die Größe in Stufen. Der Zoom selbst öffnet ein Menü: „Seitenbreite“ macht die Seite so breit wie das Fenster, „Ganze Seite“ zeigt die ganze Seite, „Originalgröße“ zeigt sie mit 100 %. Ziehe zwei Finger auseinander oder halte Strg und drehe das Mausrad, um dort zu zoomen, wo du hinzeigst.',
				keys: [['Strg', '+'], ['Strg', '-'], ['Strg', '0']]
			},
			pages: {
				title: 'Seitenleiste „Seiten“',
				text: 'Kleine Bilder aller Seiten; die aktuelle ist markiert. Klicke eine Seite an, um dorthin zu gehen. Zieh die Seitenleiste breiter, um die Seiten nebeneinander zu sehen. Um mehrere Seiten auf einmal zu ändern, wähle sie: Strg+Klick nimmt eine Seite dazu oder heraus, Umschalt+Klick wählt alle ab der zuletzt angeklickten – ist nichts gewählt, gehen beide von der aktuellen Seite aus, die eingefärbt ist und mitzählt: Strg+Klick auf eine andere Seite, und beide sind gewählt –, Strg+A wählt alle (solange die Seitenleiste den Fokus hat), Esc hebt die Wahl auf. Rechtsklick auf eine Seite öffnet ihr Menü, und gewählte Seiten ziehst du an eine andere Stelle. Auf einem Touchscreen hältst du eine Seite gedrückt: Ihr Menü öffnet sich und der Auswahlmodus beginnt – Kästchen erscheinen, ein Tippen wählt eine Seite oder nimmt sie heraus, „Alle auswählen“ im Menü wählt jede Seite, und „Auswahl aufheben“ oben in der Seitenleiste beendet ihn. Auch der Knopf ⋯ auf einer Seite öffnet ihr Menü. Die Zeile oben nennt die aktuelle Seite oder, sobald du welche gewählt hast, wie viele gewählt sind.',
				keys: [['Strg', 'A'], ['Esc']],
				link: { href: '/help/pdf-editor#changes', label: 'Seiten organisieren' }
			},
			outline: {
				title: 'Lesezeichen',
				text: 'Das Inhaltsverzeichnis, das die PDF mitbringt, wenn sie eines hat. Klicke einen Eintrag an, um zu seiner Stelle zu gehen; die Pfeile öffnen und schließen seine Untereinträge.'
			},
			search: {
				title: 'Suche',
				text: 'Findet Text in der ganzen PDF und listet jeden Treffer mit den Wörtern drumherum; die Treffer sind auf den Seiten markiert. Eingabe oder die Pfeile gehen zum nächsten und vorherigen Treffer; „Groß-/Kleinschreibung beachten“ unterscheidet große und kleine Buchstaben. Eingescannte Seiten (Bilder von Text) lassen sich nicht durchsuchen.',
				keys: [['Strg', 'F'], ['Eingabe'], ['Umschalt', 'Eingabe']]
			},
			selectText: {
				title: 'Text auswählen',
				text: 'Mit dem Werkzeug „Text auswählen“ (Registerkarte „Start“) ziehst du über den Text, um ihn auszuwählen, und kopierst ihn dann. Eingescannte Seiten haben keinen Text zum Auswählen. „Hand“ schaltet zurück aufs Verschieben der Seiten durch Ziehen.',
				keys: [['V'], ['H'], ['Strg', 'C']]
			},
			attachments: {
				title: 'Anhänge',
				text: 'Dateien, die in die PDF eingebettet sind, und darunter die an Kommentare angehängten Dateien (siehe „Eine Datei an eine Stelle hängen“). Jede lässt sich herunterladen oder in deinen Dateien speichern.'
			},
			layers: {
				title: 'Ebenen',
				text: 'Manche PDFs (Pläne, Karten) haben Ebenen, die sich ein- und ausblenden lassen. Schalte sie hier um; das ändert nur die Ansicht, nicht die Datei.'
			},
			print: {
				title: 'Drucken',
				text: '„Drucken …“ auf der Registerkarte „Datei“ (auch im Seitenmenü des Panels „Seiten“) fragt, was gedruckt werden soll, und öffnet dann den Druckdialog deines Browsers; dort wählst du Drucker, Papier und Anzahl der Kopien. Seiten: „Alle“, „Aktuelle Seite“, „Gewählte Seiten“ (die im Panel „Seiten“ gewählten) oder Seiten, die du eintippst, z. B. „1-3, 7“ – gezählt in ihrer jetzigen Reihenfolge. Die Seiten werden so gedruckt, wie du sie siehst: gedrehte Seiten gedreht, ausgefüllte Felder mit ihren Werten, ausgeblendete Ebenen nicht. Sie werden nacheinander als Bilder mit 200 dpi vorbereitet („Abbrechen“ beendet das), lange PDFs brauchen also einen Moment. Einschränkungen gegen das Drucken, die kein Passwort verlangen, werden ignoriert. Der Dialog merkt sich die Auswahl unter „Inhalt“ und „Größe“ auf diesem Gerät.',
				options: {
					comments: { label: 'Kommentare drucken (Standard: an)', text: 'Druckt markierten Text, Notizen, Textfelder, Zeichnungen und die übrigen Kommentare der Datei auf den Seiten mit. Aus: die Seiten ohne sie – Formularfelder und ihre Werte werden weiterhin gedruckt.' },
					list: { label: 'Liste der Kommentare anhängen (Standard: aus)', text: 'Fügt nach den gedruckten Seiten weitere an, die deren Kommentare nach Seite auflisten: Betreff, Autor, Datum, Status, Text und Antworten. Kostet zusätzliches Papier, zeigt aber, was in Notizen steht – auf der Seite ist eine Notiz nur ihr Symbol.' },
					fit: { label: 'An das Papier anpassen (Standard)', text: 'Jede Seite wird so skaliert, dass sie das im Druckdialog gewählte Papier füllt, innerhalb der Ränder des Druckers, hoch oder quer wie die Seite. Nichts wird abgeschnitten, aber die Größe auf dem Papier weicht von der der PDF ab.' },
					actual: { label: 'Tatsächliche Größe', text: 'Verlangt Papier in der Größe der Seite und druckt ohne Skalierung und Ränder: 1 cm in der PDF ist 1 cm auf dem Papier. Auf kleinerem Papier werden die Ränder abgeschnitten, und die Skalierung im Druckdialog muss auf 100 % bleiben.' }
				},
				tip: 'Nimm „An das Papier anpassen“ für Leseexemplare. Wähle „Tatsächliche Größe“, wenn Maße zählen (Pläne, Formulare zum Scannen, Etiketten) oder wenn du in eine PDF druckst und Seiten in Originalgröße willst.',
				keys: [['Strg', 'P']]
			},
			export: {
				title: 'Seiten als Bilder oder Playlist exportieren',
				text: '„Exportieren …“ auf der Registerkarte „Datei“ (auch „Als Bilder exportieren …“ im Seitenmenü des Panels „Seiten“) speichert Seiten als Bilder oder als Playlist für JW Library. Die Seiten wählst du wie beim Drucken: „Alle“, „Aktuelle Seite“, „Gewählte Seiten“ oder Seiten, die du eintippst, z. B. „1-3, 7“. Sie werden so gezeichnet, wie du sie siehst – gedrehte Seiten gedreht, ausgefüllte Felder mit ihren Werten, ausgeblendete Ebenen nicht – nacheinander („Abbrechen“ beendet das). „Speichern …“ fragt nach einem Ordner in deinen Dateien (Bilder) oder einem Dateinamen (Playlist); eine vorhandene Datei wird nie ersetzt – die neue bekommt „ (2)“ im Namen. „Herunterladen“ speichert stattdessen in den Download-Ordner deines Rechners: ein Bild so, wie es ist, mehrere als eine ZIP-Datei. Der Dialog merkt sich seine Einstellungen auf diesem Gerät.',
				options: {
					png: { label: 'PNG (Standard)', text: 'Genau, ohne Verlust: Text und Linien bleiben scharf. Die größten Dateien.' },
					jpeg: { label: 'JPEG', text: 'Viel kleinere Dateien, leicht weiche Kanten an Text. Öffnet sich überall.' },
					webp: { label: 'WebP', text: 'Kleiner als JPEG bei gleichem Aussehen. Nicht jedes Programm öffnet es, und nicht jeder Browser kann es schreiben – dann ist die Option aus.' },
					playlist: { label: 'JW-Library-Playlist (.jwlplaylist)', text: 'Eine Datei mit jeder Seite als Bild (JPEG) in ihrer Reihenfolge, benannt nach der PDF. In JW Library: „Playlists“, dann eine Playlist hinzufügen und die Datei importieren.' },
					resolution: { label: 'Auflösung (Standard: 150 dpi)', text: 'Pixel pro Zoll der Seite: eine A4-Seite mit 150 dpi hat 1241 × 1754 Pixel. Doppelte dpi ergeben viermal so viele Pixel und viel größere Dateien. Die Zeile über den Knöpfen zeigt die Größe der ersten Seite; Seiten, die mehr als etwa 16,8 Millionen Pixel hätten, werden kleiner gezeichnet, und er sagt das.' },
					quality: { label: 'Qualität (Standard: 90 %)', text: 'Für JPEG, WebP und die Bilder der Playlist: weniger ergibt kleinere Dateien mit sichtbarer Unschärfe an Text. PNG hat keine Qualität – es ist immer genau.' },
					comments: { label: 'Kommentare exportieren (Standard: an)', text: 'Zeichnet markierten Text, Notizen, Textfelder, Zeichnungen und die übrigen Kommentare der Datei in die Bilder. Aus: die Seiten ohne sie – Formularfelder und ihre Werte bleiben.' },
					background: { label: 'Hintergrund (Standard: Weiß)', text: 'Was unter dem Inhalt der Seite liegt, wo die PDF nichts malt. „Keine“ ergibt durchsichtige Bilder und eine Farbe mit weniger als voller Deckkraft einen halb durchsichtigen Hintergrund – beides nur bei PNG und WebP; JPEG und die Playlist nehmen die Farbe voll deckend und für „Keine“ Weiß. Flächen, die die PDF selbst malt (gescannte Seiten, weiße Kästen), bleiben, wie sie sind.' },
					name: { label: 'Dateiname (Standard: {name}_{page})', text: 'Die Namen der Bilder, mit Platzhaltern, die du mit dem Knopf neben dem Feld einfügst: {name} der Name der PDF, {page} die Seitenzahl (mit führenden Nullen, damit die Dateien richtig sortiert sind), {pages} die Anzahl der Seiten, {date} das Datum (2026-11-23), {time} die Uhrzeit (14-05). Die Zeile über den Knöpfen zeigt den ersten Namen oder was daran nicht stimmt.' },
					seconds: { label: 'Dauer (Standard: 4 s)', text: 'Nur Playlist: wie lange JW Library eine Seite zeigt, bevor die Aktion am Ende folgt.' },
					endAction: { label: 'Am Ende (Standard: Standbild)', text: 'Nur Playlist, wie in JW Library: „Weiter“ geht zur nächsten Seite, „Stopp“ zurück zur Playlist, „Standbild“ lässt die Seite stehen, bis du weitergehst, „Wiederholen“ zeigt sie noch einmal. In JW Library kannst du es später für jedes Element ändern.' }
				},
				tip: 'Für Bildschirme und Präsentationen reichen 150 dpi, zum Drucken nimm 300 dpi. Nimm PNG für Text, Pläne und Zeichnungen (mit dem Hintergrund „Keine“ für Unterschriften und Logos zum Darüberlegen), JPEG oder WebP für Fotos oder wenn die Dateien klein sein müssen. Für einen Vortrag in JW Library nimm die Playlist mit „Standbild“, dann bleibt jede Seite, bis du weitergehst.'
			}
		}
	},
	comment: {
		title: 'Kommentieren',
		items: {
			mark: {
				title: 'Text markieren',
				text: 'Zieh mit „Hervorheben“, „Unterstreichen“, „Wellenlinie“ oder „Durchstreichen“ auf der Registerkarte „Kommentieren“ über Text: Das Werkzeug markiert genau die Zeichen, über die du fährst, Zeile für Zeile, und zeigt sie schon beim Ziehen. Eine Hervorhebung reicht von der Unterlänge der Buchstaben (g, p, y) bis zu den höchsten, so wie die Schrift des Texts es angibt; eng gesetzte Zeilen stoßen aneinander, ohne sich zu überlappen. Jedes der vier behält seine eigene Farbe, eingestellt auf der Registerkarte „Markierung“, während das Werkzeug gewählt ist. Markierter Text gehört zu seinem Text: Du kannst ihn auswählen, umfärben und löschen, aber nicht verschieben. Gescannte Seiten haben keinen Text zum Markieren – dort hilft „Bereich hervorheben“: Zieh einen Rahmen auf, und er wird in der Farbe der Hervorhebung markiert; so ein Bereich ist von dir gezeichnet, du kannst ihn also verschieben und skalieren wie eine Zeichnung.',
				keys: [['M'], ['U'], ['W'], ['X'], ['A']]
			},
			insert: {
				title: 'Text einfügen und ersetzen',
				text: 'Zwei Werkzeuge der Gruppe „Text“ sagen, wie sich der Text selbst ändern soll – so wie Korrektoren es anzeichnen; der Text der PDF bleibt, wie er ist. „Text einfügen“: Klick zwischen zwei Zeichen; dort erscheint ein kleines Einfügezeichen, und ein Feld darunter nimmt den einzufügenden Text. „Text ersetzen“: Zieh über die Wörter, die ersetzt werden sollen; sie werden durchgestrichen, an ihrem Ende steht ein Einfügezeichen, und das Feld nimmt, was stattdessen dort stehen soll – die durchgestrichenen Wörter und das Einfügezeichen sind ein Kommentar: zusammen ausgewählt, umgefärbt und gelöscht und im Kommentar-Panel einmal als „Text ersetzen“ mit den alten und den neuen Wörtern geführt. Der Text wird gespeichert, wenn du das Feld verlässt (ein Klick daneben oder Esc). Um ihn später zu ändern, doppelklick das Einfügezeichen mit „Auswählen“ oder wähl es aus und nimm „Kommentar bearbeiten“; ruht die Maus darauf, zeigt sie den Text. Beide nutzen eine Farbe, eingestellt auf der Registerkarte „Markierung“, während eines der Werkzeuge gewählt ist. Wie markierten Text kannst du ein Einfügezeichen umfärben und löschen, aber nicht verschieben. Andere Programme führen eine Einfügung mit deinem Text und eine Ersetzung ebenfalls als einen Kommentar, wo sie gruppierte Kommentare kennen (Acrobat, PDF-XChange); einfachere Betrachter zeigen Durchstreichung und Einfügung als zwei. Ersetzungen anderer Programme erscheinen hier als eine. Das Kommentar-Panel zeigt beides unter „Markierter Text“.',
				keys: [['I'], ['R']]
			},
			callout: {
				title: 'Legenden',
				text: 'Eine Legende ist ein Textfeld mit einer Linie und einem Pfeil, der auf das zeigt, worum es geht. Drücke mit „Legende“ (Registerkarte „Kommentieren“, Gruppe „Kommentar“) dort, wohin sie zeigen soll, zieh dorthin, wo ihr Text stehen soll, und lass los – oder klicke dorthin, wohin sie zeigen soll, und klicke noch einmal dort, wo der Text stehen soll (ein zweiter Klick auf dieselbe Stelle setzt das Feld etwas rechts oberhalb) – und tippe. Die Linie verlässt die Mitte der Seite des Felds, die der Spitze zugewandt ist, 14 Punkt gerade und läuft dann zur Spitze; sie folgt, wenn du das Feld verschiebst oder seine Größe änderst. Mit „Auswählen“ hat eine ausgewählte Legende einen weiteren Griff an ihrer Spitze: Zieh ihn, um auf etwas anderes zu zeigen. Verschiebst du die Legende, wandert die Spitze mit. Das Feld ist sonst ein Textfeld (Registerkarte „Textfeld“: Schriftgröße, Farben, Ausrichtung, Größe); es bekommt immer einen Rahmen – den für Textfelder gewählten, sonst eine Linie in der Textfarbe –, und die Linie hat Farbe und Stärke des Rahmens. Andere Programme führen sie als Legende und können sie bearbeiten; Legenden anderer Programme erscheinen hier mit ihrer Linie auf dieselbe Stelle.',
				keys: [['C']]
			},
			attach: {
				title: 'Eine Datei an eine Stelle hängen',
				text: 'Klicke mit „Datei anhängen“ (Registerkarte „Kommentieren“, Gruppe „Kommentar“) auf eine Seite und wähle eine Datei aus deinen Dateien: Eine Büroklammer markiert die Stelle, und die Datei selbst wird Teil der PDF – wer die PDF bekommt, bekommt die Datei mit. Wähle die Büroklammer aus, um sie zu verschieben, ihr einen Kommentar (Doppelklick oder „Kommentar bearbeiten“ auf der Registerkarte „Notiz“) oder eine Farbe zu geben und die Datei zurückzubekommen: „Angehängte Datei herunterladen“ an ihrem Rahmen und auf der Registerkarte „Notiz“. Die Seitenleiste „Anhänge“ führt diese Dateien unter „An Kommentare angehängt“ mit ihrer Seite – ein Klick zeigt die Büroklammer, die Schaltflächen laden die Datei herunter oder speichern sie in deinen Dateien. Löschst du die Büroklammer, verschwindet die Datei aus der PDF. Die Datei wird gespeichert, wie sie ist, die PDF wächst also um ihre Größe; über 25 MB wirst du vorher gefragt. Andere Programme zeigen sie als Dateianhang-Kommentar; solche Kommentare anderer Programme erscheinen hier genauso.',
				keys: [['J']]
			},
			measure: {
				title: 'Messen',
				text: 'Drei Werkzeuge in der Gruppe „Messen“ (Registerkarte „Kommentieren“) zeichnen eine Form, die ihre Größe nennt. „Abstand“: Zieh von einem Punkt zum anderen oder klicke beide – eine Linie mit einem Querstrich an jedem Ende und der Länge darüber. „Umfang“: Klicke Punkt für Punkt und doppelklicke den letzten – der Linienzug sagt, wie lang er insgesamt ist. „Fläche“: Klicke die Ecken eines Umrisses und doppelklicke die letzte – die Fläche darin steht in ihrer Mitte. Die Zahl folgt der Form: Zieh mit „Auswählen“ einen Punkt oder die ganze Form, und sie misst neu. Eine Messung ist sonst eine Zeichnung wie jede andere (Registerkarte „Zeichnung“: Farbe, Stärke, Strichelung; eine Fläche kann eine Füllung bekommen). „Einrasten“ hilft, Ecken zu treffen und Linien gerade zu halten. Eine PDF hat einen Maßstab für alle ihre Messungen – „Maßstab …“ legt ihn fest, „Kalibrieren“ errechnet ihn aus einer Strecke, die du kennst. Andere Programme zeigen die Formen mit ihren Zahlen und kennen den Maßstab; Messungen aus anderen Programmen erscheinen hier als einfache Formen, die nicht neu messen.',
				options: {
					scale: { label: '„Maßstab 1 :“ und „Einheit“ (Standard: 1 : 1 in Millimetern)', text: 'Wie viel eine Einheit auf dem Papier in Wirklichkeit ist – 100 für einen Plan im Maßstab 1 : 100 – und die Einheit, in der die Zahlen stehen: Millimeter, Zentimeter, Meter, Zoll oder Punkt. Änderst du ihn, misst jede Messung der PDF neu, als ein Schritt für „Rückgängig“. Eine neue PDF beginnt mit dem Maßstab, den du zuletzt benutzt hast.' },
					calibrate: { label: '„Kalibrieren“', text: 'Für einen Plan, dessen Maßstab du nicht kennst: Wähle „Kalibrieren“ (Gruppe „Messen“) und zieh an etwas entlang, dessen wahre Länge du kennst (eine Wand, eine Maßstabsleiste) – oder klicke seine beiden Enden, bei Bedarf mit Scrollen dazwischen. Dann wirst du gefragt „Wie lang ist diese Strecke?“ – tippe ihre „Länge“ und wähle die „Einheit“; der Maßstab wird daraus errechnet und darunter angezeigt. „Übernehmen“ setzt ihn für die ganze PDF, und das Werkzeug wechselt zu „Abstand“, damit du mit einer zweiten bekannten Länge prüfen kannst. Die gezogene Linie bleibt stehen, solange du gefragt wirst, und wird nicht behalten. „Abbrechen“ lässt den Maßstab, wie er war.' }
				},
				tip: 'Zoome hinein, bevor du die Endpunkte klickst – die Messung ist so genau wie deine Klicks. Ein Scan kann verzerrt sein: Kalibriere in der Richtung, in der du misst, und prüfe mit einer zweiten bekannten Länge.',
				keys: [['D']]
			},
			link: {
				title: 'Links',
				text: 'Ein Link ist ein Rahmen auf der Seite, der beim Klicken irgendwohin führt. Um einem zu folgen, klick ihn mit „Hand“ an – der Zeiger wird darüber zur Hand mit Finger; Links, die schon in der PDF waren, funktionieren genauso. Ein Link zu einer anderen Stelle der PDF bringt dich sofort dorthin; bevor eine Webadresse geöffnet wird, zeigt eine Frage die ganze Adresse, und „In neuem Tab öffnen“ öffnet sie – die PDF bleibt offen. Geöffnet werden nur Web- und Mailadressen, nichts anderes, was eine Datei nennen könnte. Um einen Link anzulegen, wähle „Link“ (Registerkarte „Kommentieren“, Gruppe „Kommentar“), zieh einen Rahmen über das, was anklickbar sein soll – ein Wort, ein Bild, eine Zeile eines Inhaltsverzeichnisses –, und sag in dem kleinen Feld darunter, wohin er führt; Enter oder ein Klick daneben behält ihn, Esc verwirft, und ein neuer Link ohne Ziel verschwindet wieder. Ein Link zeichnet nichts auf die Seite und nichts im Druck: Sein Rahmen wird nur gezeigt – getönt, mit gestrichelter Linie –, solange „Link“ oder „Auswählen“ das Werkzeug ist. Mit „Auswählen“ verschiebst und skalierst du ihn, löschst ihn oder änderst mit einem Doppelklick (oder „Link bearbeiten“ auf der Registerkarte „Link“), wohin er führt. Jeder PDF-Betrachter folgt den Links, die du anlegst. Links, die andere Programme in die PDF gesetzt haben, kannst du hier verfolgen, aber nicht ändern. Links sind keine Kommentare: Das Kommentar-Panel führt sie nicht.',
				options: {
					url: { label: '„Webadresse“ (Standard)', text: 'Eine Adresse im Web oder eine Mailadresse (mailto:…). Ohne „https://“ getippt, wird es für dich ergänzt. Die Adresse steht so in der PDF, wie du sie in der Frage vor dem Öffnen siehst.' },
					page: { label: '„Seite dieser PDF“', text: 'Eine Seite nach ihrer Nummer. Der Link gehört zu dieser Seite, nicht zur Nummer: Verschiebst du Seiten, führt er weiter zur selben Seite; löschst du die Seite, führt er nirgendwohin, bis du ihm ein neues Ziel gibst.' }
				},
				tip: 'Für ein Inhaltsverzeichnis ziehst du über jede Zeile einen Link und wählst „Seite dieser PDF“. Für Quellen und Weiterführendes nimmst du „Webadresse“.',
				keys: [['Y']]
			},
			stamp: {
				title: 'Stempel',
				text: 'Klick mit „Stempel“ (Gruppe „Kommentar“) auf die Seite: Der gewählte Stempel wird mit seiner Mitte dorthin gesetzt und ausgewählt, du kannst ihn also gleich verschieben oder an einer Ecke größer oder kleiner ziehen. Der Pfeil unter der Schaltfläche wählt, was gestempelt wird: einen Text-Stempel – ein Text im Rahmen, zu Beginn die zehn des PDF-Standards („Genehmigt“, „Endgültig“, „Entwurf“, „Zur Stellungnahme“, „Wie besehen“, „Nicht genehmigt“, „Vertraulich“, „Streng geheim“, „Abgelaufen“, „Verkauft“), in deiner Sprache geschrieben; „Aus Datei …“ nimmt ein Bild oder eine PDF aus deinen Dateien (eine Unterschrift, ein Logo) und fragt bei einer PDF mit mehreren Seiten, welche Seite – ein Bild wird so groß gesetzt wie auf einem Bildschirm, eine PDF oder ein SVG in der eigenen Größe, höchstens halb so groß wie die Seite; „Meine Stempel …“ öffnet die Seitenleiste „Stempel“ mit den Stempeln, die du aufbewahrst. Bevor du klickst, folgt der Stempel dem Zeiger: Du siehst, was wohin gesetzt wird (mit der Maus oder einem Stift, der über dem Bildschirm schwebt). Die Registerkarte „Stempel“ legt die Farbe eines Text-Stempels fest, und „Text bearbeiten“ dort – oder ein Doppelklick mit „Auswählen“ – öffnet am Stempel zwei Felder für seinen Text und die Zeile darunter: Enter oder ein Klick daneben behält sie, Esc stellt wieder her, was da stand; der Stempel wird so breit, wie sein Text es braucht. SVG-Dateien, Icons und PDF-Seiten bleiben Vektoren – in der Datei und im Druck scharf in jeder Größe; am Bildschirm werden sie für den Zoom, mit dem du sie ansiehst, neu gezeichnet (einen Moment nach dem Zoomen), bis 16 Megapixel, sodass nur ein sehr großer, sehr stark vergrößerter Stempel hier weich wird; ein SVG mit Text, Verläufen oder Beschnitt und alle anderen Bilder bleiben Pixel, mit ihren durchsichtigen Stellen, auf 2000 Pixel verkleinert, wenn sie größer sind. Andere Programme führen beides als Stempel; Stempel anderer Programme werden gezeigt, wie sie sind, und lassen sich hier nicht ändern.',
				options: {
					info: { label: '„Zeile unter dem Text“: „Name“, „Datum“, „Uhrzeit“ (Standard: alle aus)', text: 'Jedes, das du einschaltest, kommt in eine zweite Zeile unter dem Text, in dieser Reihenfolge: dein Name aus den Suite-Einstellungen („Profil → Dein Name“), das heutige Datum, die Uhrzeit jetzt. Du kannst jedes der drei für sich wählen; ohne eines gibt es keine zweite Zeile. Die Zeile wird beim Setzen des Stempels geschrieben und ändert sich später nicht – „Text bearbeiten“ ändert sie von Hand.' },
					mine: { label: 'Seitenleiste „Stempel“', text: 'Zeigt deine eigenen Stempel als kleine Bilder und darunter die Text-Stempel; ein Klick wählt einen und wechselt zu „Stempel“. „Hinzufügen …“ kopiert ein Bild, ein SVG oder eine PDF aus deinen Dateien (von einer PDF mit mehreren Seiten die Seite, die du wählst) in einen versteckten Ordner deiner Dateien, sodass es mit dem Sync auf deine anderen Geräte wandert, und wählt es für den nächsten Klick; der Papierkorb unter einem Stempel löscht ihn in den Papierkorb (mit „Rückgängig“). Schon gesetzte Stempel bleiben in ihren PDFs.' },
					words: { label: 'Eigene Text-Stempel', text: 'Die Liste „Text-Stempel“ gehört dir: „Text-Stempel hinzufügen …“ darunter nimmt einen Text und seine Farbe; das ⋯ eines Eintrags (oder ein Rechtsklick) bietet „Bearbeiten …“ und „Löschen“ (mit „Rückgängig“); „Standard-Stempel wiederherstellen“ bringt die zehn des Standards zurück und entfernt deine eigenen. Jeder Text wird so gestempelt, wie er in der Liste steht. Die Liste liegt bei „Meine Stempel“ und ist damit auf allen deinen Geräten dieselbe.' },
					selection: { label: '„Stempel aus Auswahl“', text: 'Behält die ausgewählten Kommentare – Zeichnungen, Formen, Textfelder, Notizen, markierten Text, andere Stempel – zusammen als einen neuen Stempel, als Vektoren. Du findest es in der Seitenleiste, im Menü von „Stempel“ und als Schaltfläche am Rahmen einer Auswahl.' },
					area: { label: '„Stempel aus Bereich“', text: 'Zieh auf einer Seite einen Rahmen auf: Alles darin wird ein Stempel – Text, Bilder und Zeichnungen der Seite selbst als Vektoren, mit deinen Kommentaren darüber. Das geht mit jeder PDF, auch einer, die du nicht ändern kannst. Nicht dabei: Formularfelder und Kommentare anderer Programme, die sich hier nicht bearbeiten lassen. Der Stempel enthält den Inhalt der ganzen Seite, auf den Rahmen beschnitten – ein Stempel aus einer schweren Seite ist also eine schwere Datei.' }
				},
				tip: 'Leg deine Unterschrift oder deinen Firmenstempel einmal in „Meine Stempel“ – ein PNG mit durchsichtigem Hintergrund sieht auf der Seite am besten aus –, dann hast du sie in jeder PDF und auf jedem Gerät zur Hand. Ein Bild, das du nur einmal brauchst, geht über „Aus Datei …“.',
				keys: [['K']]
			},
			pictures: {
				title: 'Bilder und Icons',
				text: 'Neben „Stempel“ (Registerkarte „Kommentieren“, Gruppe „Kommentar“): „Bild …“ nimmt ein Bild aus deinen Dateien (PNG, JPEG, WebP, GIF, AVIF, SVG oder eine Seite einer PDF – bei mehreren fragt es, welche), und „Icon“ öffnet die Icon-Bibliothek – durchsuche sie, wähle ein anderes Icon-Set oder lade ein ganzes Set. Beide setzen ihr Bild in die Mitte der Ansicht auf die aktuelle Seite und wählen es aus, du kannst es also gleich verschieben und an einer Ecke größer oder kleiner ziehen. Ein Bild kommt so groß wie auf einem Bildschirm, höchstens halb so groß wie die Seite; ein Icon 48 Punkt (etwa 17 mm) breit in der Farbe, die du zuletzt einem Icon gegeben hast (bis dahin in der Stiftfarbe); „Farbe“ auf der Registerkarte „Stempel“ gibt einem ausgewählten Icon eine andere Farbe – die nächsten Icons kommen dann in ihr (nicht Icons, die gesetzt wurden, bevor das ging, und nicht die wenigen Icons mit Farbverläufen, die als Pixel bleiben). Icons, SVG-Dateien und PDFs werden als Vektoren gespeichert, scharf in jeder Größe. Alle werden als Stempel gespeichert: Jeder PDF-Betrachter zeigt sie, und andere Programme führen sie als Stempel. Um dasselbe Bild oft zu setzen, nimm stattdessen „Stempel“ mit „Aus Datei …“ oder „Meine Stempel …“: Dort setzt jeder Klick eines.'
			},
			note: {
				title: 'Notizzettel',
				text: 'Klick mit „Notiz“ (Gruppe „Kommentar“) dorthin, worauf die Notiz zeigen soll: Dort erscheint ihr Symbol, und ein Feld darunter nimmt sofort deinen Kommentar auf. Gespeichert wird er, wenn du das Feld verlässt – klick woandershin oder drück Esc. Um ihn später zu lesen oder zu ändern, doppelklick die Notiz mit „Auswählen“, klick sie mit „Notiz“ an, oder wähl sie aus und dann „Kommentar bearbeiten“ (in der kleinen Leiste an der Notiz oder auf der Registerkarte „Notiz“, die auch Symbol und Farbe einstellt). Ruht die Maus auf einer Notiz, zeigt ein Tooltip ihren Kommentar. Andere Programme zeigen sie als Kommentar mit deinem Text.',
				options: {
					comment: { label: '„Kommentar“ (Standard)', text: 'Eine Sprechblase – eine Anmerkung oder Frage.' },
					note: { label: '„Notiz“', text: 'Ein Blatt Papier – eine längere Notiz.' },
					key: { label: '„Schlüssel“', text: 'Etwas Wichtiges.' },
					help: { label: '„Hilfe“', text: 'Ein Fragezeichen – etwas ist unklar.' },
					newParagraph: { label: '„Neuer Absatz“', text: 'Hier soll ein neuer Absatz beginnen.' },
					paragraph: { label: '„Absatz“', text: 'Zum Absatz als Ganzem.' },
					insert: { label: '„Einfügen“', text: 'Ein Einfügezeichen – hier soll etwas eingefügt werden.' }
				},
				tip: '„Symbol“ auf der Registerkarte „Notiz“ ändert die ausgewählten Notizen oder – ohne Auswahl – die nächste, die du setzt. Es sind die sieben Symbole, die jedes PDF-Programm kennt, also sehen andere dasselbe Zeichen.',
				keys: [['N']]
			},
			textbox: {
				title: 'Textfelder',
				text: 'Klick mit „Textfeld“ (Gruppe „Kommentar“) auf die Seite, um dort zu schreiben – das Feld wächst mit der längsten Zeile („Automatische Breite“) –, oder zieh ein Feld auf, um genau in dieses zu schreiben („Feste Größe“). Die Eingabetaste beginnt eine neue Zeile. Verlässt du das Feld (Esc oder ein Klick daneben), bleibt der Text; ein leer gelassenes Feld verschwindet. Um den Text später zu ändern, doppelklick ihn mit „Auswählen“, klick ihn mit „Textfeld“ an, oder wähl ihn aus und dann „Text bearbeiten“. Die Registerkarte „Textfeld“ stellt „Textfarbe“, „Schriftgröße“ (8 bis 48 Punkt), „Hintergrund“ und „Rahmen“ („Keiner“ für beides) und die „Stärke“ des Rahmens ein (0,5 bis 4 Punkt – der Rahmen nimmt Platz im Feld ein, die Zeilen brechen also neu um). Die Gruppe „Absatz“ richtet die Zeilen im Feld aus: „Text linksbündig“ (Standard), „Text zentrieren“, „Text rechtsbündig“ oder „Blocksatz“ (die Wörter verteilen sich über die ganze Breite; die letzte Zeile eines Absatzes bleibt links). Andere Programme zeigen alle vier wie hier; bearbeiten sie den Text, behalten sie links, zentriert und rechts, aus Blocksatz wird dort linksbündig. Seine Anfasser ändern nur das Feld, nie die Schrift: Die linke und rechte Seite legen die Breite fest (die Zeilen brechen um, die Höhe folgt dem Text), Ober- und Unterkante und die Ecken eine feste Größe (Umschalt hält bei einer Ecke das Seitenverhältnis); Text, der nicht in eine feste Größe passt, ragt unten heraus – auch in anderen Programmen. Halte beim Ziehen K gedrückt, um die Schrift mit dem Feld zu skalieren. Die Gruppe „Größe“ wechselt zwischen den dreien. Solange „Textfeld“ das Werkzeug ist, legt dieselbe Registerkarte fest, wie das nächste Feld aussieht; jedes neue bekommt, was du zuletzt gewählt hast. Für ein Formular ohne Felder stellst du „Hintergrund“ und „Rahmen“ auf „Keine“: der Text steht dann allein auf der Seite (andere Programme führen ihn als Schreibmaschinentext).',
				options: {
					autoWidth: { label: 'Automatische Breite (ein Klick)', text: 'So breit wie die längste Zeile; neue Zeilen nur, wo du Enter drückst (und am Rand der Seite). Für Beschriftungen und kurze Hinweise.' },
					autoHeight: { label: 'Automatische Höhe (eine Seite gezogen)', text: 'Behält seine Breite; die Zeilen brechen um und das Feld wächst mit dem Text nach unten. Für Absätze.' },
					fixedSize: { label: 'Feste Größe (ein Feld aufgezogen)', text: 'Behält Breite und Höhe, z. B. ein umrandeter Bereich zum späteren Ausfüllen; Text, der nicht hineinpasst, ragt unten heraus.' }
				},
				tip: 'Die Schriftgröße änderst du auf der Registerkarte „Textfeld“, nicht durch Ziehen – das Feld behält dann Platz und Breite. Andere Programme zeigen den Text in Helvetica; Zeilen mit Buchstaben über die westeuropäischen hinaus (Polnisch, Tschechisch, Griechisch, Kyrillisch …) bringen die wenigen Buchstaben, die sie brauchen, in einer passenden Schrift mit, so sehen sie überall gleich aus. Chinesisch, Japanisch, Arabisch und Emojis erscheinen dort vorerst als „?“; der Text selbst bleibt erhalten und wird hier gezeigt.',
				keys: [['T'], ['K']]
			},
			twoClicks: {
				title: 'Zwei Klicks statt Ziehen',
				text: 'Was durch zwei Punkte bestimmt ist, kannst du auf zwei Arten zeichnen. Drücken, ziehen und loslassen – oder einmal klicken für den ersten Punkt und noch einmal für den zweiten. Zwischen den beiden Klicks folgt eine Vorschau dem Mauszeiger, und du kannst scrollen und zoomen (Mausrad, Strg + Mausrad, mittlere Maustaste, zwei Finger) – praktisch, wenn die beiden Punkte nicht zusammen auf den Bildschirm passen oder du an jeden heranzoomen willst. Das gilt für jede Form unter „Formen“ (Linien, Pfeile, Rechtecke, Ellipsen …), für „Abstand“ und „Kalibrieren“, für „Bereich hervorheben“, den Bereich eines „Links“, „Stempel aus Bereich“ und „Legende“ (erst die Spitze, dann der Text). „Einrasten“, Umschalt und Alt wirken wie beim Ziehen; hältst du den zweiten Klick gedrückt, kannst du den Punkt vor dem Loslassen noch zurechtrücken. Esc nimmt den ersten Punkt zurück. „Linienzug“, „Polygon“, „Umfang“ und „Fläche“ klickst du ohnehin Punkt für Punkt – sie zeigen das nächste Stück bis zum Mauszeiger. „Textfeld“ ist die Ausnahme: Dort setzt schon ein Klick ein Textfeld.',
				keys: [['Esc']]
			},
			draw: {
				title: 'Auf Seiten zeichnen',
				text: 'Die Registerkarte „Kommentieren“ hat außerdem Stift-Werkzeuge: „Stift“, „Textmarker“ (malt frei mit breiter, durchscheinender Spitze, durch die der Text hindurchscheint – anders als „Hervorheben“, das dem Text folgt), „Formen“ (der Pfeil darunter wählt Linie, Pfeil, Rechteck, Ellipse, Stern, Linienzug, Polygon … – jede mit einer kleinen Zeichnung), und „Radierer“ (der Pfeil darunter: ganze Striche oder Pixel und seine Größe); „Auswählen“ steht als Erstes auf der Registerkarte, in einer eigenen Gruppe. „Nur der Stift zeichnet“ lässt Finger die Seiten nur verschieben und zoomen, schon bei der ersten Berührung – schalte es ein, wenn du mit einem Stift schreibst und die Hand auf dem Bildschirm ablegst; ohne es zeichnen Finger, bis einmal ein Stift benutzt wurde. „Glättung“ auf der Registerkarte „Zeichnung“ („Aus“, „Leicht“, „Mittel“, „Stark“; für Stift und Textmarker) gleicht eine zittrige Linie aus; je stärker, desto mehr folgt die Linie dem Stift mit Verzögerung. „Linienzug“ und „Polygon“ zeichnest du Punkt für Punkt: je Ecke ein Klick (oder Zug); ein Doppelklick, die Eingabetaste oder Esc beendet die Form, ein Polygon schließt sich auch mit einem Klick auf seinen ersten Punkt. Jeder Punkt ist ein Schritt für „Rückgängig“. Sie zeichnen mit Stift, Finger oder Maus; auf einem Touchscreen verschieben und zoomen zwei Finger weiterhin die Seiten. Hebst du den Stift nach einer von Hand gezeichneten Linie, einem Kreis oder Kasten, bietet „In … umwandeln“ eine exakte Form an. Formen, die du zeichnest, verschiebst oder skalierst, rasten an Kanten und Mitte der Seite und an anderen Formen und Bildern ein; Hilfslinien zeigen, wo – das kleine Zeichen am Anfang einer Linie ist ein Rahmen für die Seite, sonst die Form, von der sie kommt –, gleiche Abstände zeigen ihre Größe in Millimetern. Der Schalter „Einrasten“ in der Gruppe „Auswahl“ schaltet das ein und aus (Standard: ein, wird gemerkt); halte beim Ziehen Alt gedrückt für das Gegenteil.',
				tip: 'Lass „Einrasten“ an, um Formen auszurichten und gleiche Abstände zu halten; schalte es aus für viele kleine Verschiebungen, bei denen Formen an eine Hilfslinie springen würden – oder halte Alt für nur einen Zug.',
				keys: [['P'], ['S'], ['E'], ['L'], ['Alt']]
			},
			format: {
				title: 'Farbe, Stärke und Stil',
				text: 'Jedes Werkzeug, das Kommentare zeichnet, merkt sich sein eigenes Format: Wähl es, und die Registerkarte seiner Art („Zeichnung“, „Markierung“, „Notiz“, „Textfeld“) legt fest, wie das nächste aussieht – Stift und Formen behalten jeweils ihre Farbe und „Stärke“, jedes Markier-Werkzeug seine Farbe. Wählst du stattdessen Kommentare aus, ändert dieselbe Registerkarte sie, ein Rückgängig-Schritt je Wahl. Jede Farbe kann durchscheinend sein – Striche, markierter Text, Notizen sowie Text, Hintergrund und Rahmen eines Textfelds: Die Prozentzahl neben den Farben (zum Ziehen oder Eintippen) legt fest, wie sehr. Ein durchscheinender Strich bleibt gleichmäßig, auch wo er sich kreuzt, auf dem Bildschirm wie in der gespeicherten PDF; die Füllung einer Form hat unter „Stil“ ihre eigene Deckkraft. Das Farbfeld bleibt offen, während du Farben ausprobierst; ein Klick daneben schließt es. „Stil“ legt fest, wie Formen gezeichnet werden: Füllung, durchgezogene, gestrichelte oder gepunktete Linie, wie von Hand, ein Wolken-Umriss für geschlossene Formen und was die Enden ausgewählter Linien und Linienzüge tragen (Pfeil, geschlossener Pfeil, Kreis, Quadrat, Raute, Querstrich).'
			},
			select: {
				title: 'Gezeichnetes ändern',
				text: 'Tippe mit „Auswählen“ (vorn auf der Registerkarte „Kommentieren“) einen Strich, eine Form, markierten Text oder eine Notiz an oder umkreise mehrere – beginnend neben ihnen. Strg+Klick oder Umschalt+Klick nimmt ein Element zur Auswahl hinzu oder wieder heraus; eine Schleife mit gedrückter Umschalt- oder Strg-Taste fügt hinzu, was sie umschließt. Ein Element ziehst du sofort weg, ohne es vorher auszuwählen; den Rahmen ziehst du, um eine Auswahl zu verschieben, eine Ecke, um sie zu skalieren (Textfelder behalten ihre Schrift – halte K gedrückt, um sie mitzuskalieren); eine einzelne Form zeigt ihre Punkte zum Ziehen, ein einzelnes Textfeld seine Ecken und Seiten (siehe „Textfelder“). Markierter Text bleibt bei seinem Text (keine Griffe, er bewegt sich nicht). Die kleine Leiste am Rahmen dupliziert oder löscht (und bearbeitet den Text eines einzelnen Textfelds oder einer Notiz); das Format steht auf der Registerkarte, die für die Auswahl erscheint. Die Pfeiltasten verschieben die Auswahl um 1 Punkt, mit Umschalt um 10 – ohne Einrasten, und Gedrückthalten bis zum Loslassen ist ein Schritt für „Rückgängig“; markierter Text bleibt stehen. Strg+A (oder „Alles auswählen“ in der Gruppe „Auswahl“) wählt alles auf der aktuellen Seite aus. Entf oder Rücktaste löscht. Esc beendet die Auswahl; ohne Auswahl führt Esc von jedem Werkzeug zurück zu „Auswählen“.',
				keys: [['Strg', 'Klick'], ['Umschalt', 'Klick'], ['←'], ['→'], ['↑'], ['↓'], ['Umschalt', '←'], ['Strg', 'A'], ['Entf'], ['Rücktaste'], ['Esc']]
			},
			arrange: {
				title: 'Anordnen',
				text: 'Die Registerkarte „Anordnen“ erscheint mit einer Auswahl. „In den Vordergrund“, „Eine Ebene nach vorne“, „Eine Ebene nach hinten“ und „In den Hintergrund“ ändern, welcher Kommentar oben liegt, wo sie sich überdecken – auch in anderen Programmen. „Linksbündig ausrichten“, „Horizontal zentrieren“, „Rechtsbündig ausrichten“, „Oben ausrichten“, „Vertikal zentrieren“ und „Unten ausrichten“ richten die ausgewählten Elemente am Rahmen um alle aus – ein einzelnes an der Seite („Horizontal zentrieren“ setzt es in die Mitte der Seitenbreite); „Horizontal verteilen“ und „Vertikal verteilen“ geben drei oder mehr gleiche Abstände. Markierter Text wird nie verschoben: Er bleibt stehen, während die anderen ausgewählten Elemente ausgerichtet, verteilt oder dupliziert werden.'
			},
			comments: {
				title: 'Kommentare und Antworten',
				text: 'Das Seitenpanel „Kommentare“ listet alle Kommentare des PDFs – Notizen, Textfelder, markierten Text und Zeichnungen, deine und die anderer Programme – mit Betreff (sonst der Art), Datum, Autor, Status und der ersten Zeile des Texts. Klick einen an, um hinzuspringen und ihn auszuwählen: Dann zeigt er seinen ganzen Text und seine Antworten. Klick seinen Betreff an, um ihn zu ändern. „Antworten“ öffnet ein Feld für eine Antwort („Senden“ oder Strg+Enter; „Abbrechen“ oder Esc schließt es). „Status“ legt fest, wie es um den Kommentar steht – jeder Status erscheint als Abzeichen in seiner Farbe (angenommen grün, abgelehnt rot, abgebrochen grau, erledigt blau); das ⋯ neben einer Antwort setzt ihren Status oder löscht sie – „Rückgängig“ holt alles zurück. „In Kommentaren suchen“ durchsucht Betreffe, Texte und Autoren. Die zwei Schaltflächen daneben ordnen die Liste: „Sortieren nach“ gruppiert die Kommentare nach Seite (Standard), nach Tag mit den neuesten zuerst, nach Autor, nach Art oder nach Status; „Filtern“ zeigt nur eine Art, einen Autor oder einen Status – das Symbol ist getönt, solange etwas ausgeblendet ist, und „Alle Kommentare zeigen“ am Ende hebt es auf. Sortierung und Art merkt sich dieses Gerät; Autor und Status stehen bei jeder PDF zunächst auf „alle“. Neue Kommentare und Antworten tragen deinen Namen aus „Einstellungen“ → „Profil“ → „Dein Name“ (Zahnrad oben rechts) – auch in anderen Programmen.',
				options: {
					none: { label: '„Keiner“ (Standard)', text: 'Noch nichts entschieden; keine Markierung in der Liste.' },
					accepted: { label: '„Angenommen“', text: 'Du stimmst dem Kommentar zu und setzt um, worum er bittet.' },
					rejected: { label: '„Abgelehnt“', text: 'Du setzt nicht um, worum er bittet.' },
					cancelled: { label: '„Abgebrochen“', text: 'Er gilt nicht mehr, z. B. weil der Text, um den es ging, weg ist.' },
					completed: { label: '„Erledigt“', text: 'Fertig – worum er bat, ist umgesetzt.' }
				},
				tip: 'Antworten und Status werden als echte PDF-Antworten gespeichert: Acrobat und PDF-XChange zeigen sie beim Kommentar, einen Status mit wer ihn wann gesetzt hat. Nimm „Erledigt“, wenn du eine Durchsicht abarbeitest, dann sehen die anderen, was noch offen ist. Trag deinen Namen ein, bevor du kommentierst – schon gespeicherte Kommentare behalten den Namen, den sie hatten.',
				keys: [['Strg', 'Enter']]
			},
			annotations: {
				title: 'Was andere sehen',
				text: 'Was du zeichnest, wird als echte PDF-Kommentare (Anmerkungen) gespeichert: Jeder PDF-Betrachter zeigt es, und Programme wie Acrobat oder PDF-XChange führen es als Notiz-, Textfeld-, Stempel-, Einfügungs-, Hervorhebungs-, Unterstreichungs-, Wellenlinien-, Durchstreichungs-, Freihand-, Linien-, Linienzug-, Rechteck-, Ellipsen- oder Polygon-Kommentar (eine Wolke als wolkigen Rand, Linienenden als ihre Abschlüsse) – markierten Text mit den Wörtern, die er markiert. Die Seite selbst bleibt darunter unverändert. Kommentare dieser Arten, die schon in der PDF stehen – deine von früher und die anderer Programme –, kannst du auswählen, ändern und löschen wie neue; neu geschrieben wird nur, was du änderst, und was sie sonst mitbringen (Antworten, Autor, Notizen), bleibt. Betreffe, Antworten und Status sind dieselben Einträge, die Acrobat und PDF-XChange verwenden, also erscheinen sie auch dort. Andere Arten (Stempel) und Antworten auf Notizen werden gezeigt, wie sie sind, und lassen sich hier noch nicht ändern. Die Seitenminiaturen zeigen die Kommentare mit.'
			}
		}
	},
	forms: {
		title: 'Formulare ausfüllen',
		items: {
			fill: {
				title: 'Felder ausfüllen',
				text: 'Die Felder eines PDF-Formulars füllst du direkt auf der Seite aus, mit „Hand“, „Auswählen“ und „Text auswählen“ – die anderen Werkzeuge zeichnen darüber. Klick in ein Textfeld und tippe; Tab springt zum nächsten Feld, auch auf den folgenden Seiten, Umschalt+Tab zurück. Enter behält, was du getippt hast (in einem mehrzeiligen Feld beginnt es eine neue Zeile), Esc stellt wieder her, was vorher drinstand. Klick ein Kontrollkästchen oder einen runden Knopf an, um ihn umzuschalten; eine Liste öffnet ihre Auswahl. Jede Änderung ist ein Schritt für „Rückgängig“ und wird gespeichert wie alles andere. Felder, die die PDF sperrt, lassen sich nicht ändern; Schaltflächen und Unterschriftsfelder tun hier nichts.',
				keys: [['Tab'], ['Umschalt', 'Tab'], ['Esc']]
			},
			highlight: {
				title: 'Felder hervorheben',
				text: '„Felder hervorheben“ auf der Registerkarte „Formular“ tönt die ausfüllbaren Felder und rahmt die Pflichtfelder ein, damit keins übersehen wird. Die Wahl gilt für alle PDFs.',
				options: {
					on: { label: 'An (Standard)', text: 'Jedes Feld zeigt, wo es ist, Pflichtfelder gerahmt. Am besten zum Ausfüllen.' },
					off: { label: 'Aus', text: 'Die Seite sieht aus wie gedruckt; Felder zeigen sich erst, wenn du auf sie zeigst.' }
				}
			},
			panel: {
				title: 'Seitenleiste Felder',
				text: 'Die Seitenleiste „Felder“ (Registerkarte „Formular“ oder die Leiste links) listet die Felder nach Seite mit dem, was sie erfragen, und dem, was jetzt drinsteht; Pflichtfelder tragen einen Stern, und oben steht, wie viele davon ausgefüllt sind. „Nur Pflichtfelder“ zeigt nur diese. Klick ein Feld an, um hinzuspringen – es bekommt den Fokus, sodass du gleich tippen kannst.'
			},
			clear: {
				title: 'Formular leeren',
				text: '„Formular leeren“ auf der Registerkarte „Formular“ leert alle ausfüllbaren Felder: Texte, Kontrollkästchen, Auswahlen. Es ist ein Schritt für „Rückgängig“.'
			},
			others: {
				title: 'Was andere sehen',
				text: 'Was du ausfüllst, wird als Wert der Felder gespeichert, sodass jedes PDF-Programm es zeigt und wieder ändern kann. Es steht in der Schrift, die das Formular für jedes Feld vorgibt, in der Größe, die die Seite zeigt; Buchstaben, die diese Schrift nicht schreiben kann, lassen die PDF die Programme bitten, das Feld selbst zu zeichnen. Während du tippst, zeigt das Feld eine ähnliche Schrift; sobald du es verlässt, zeigt die Seite die des Formulars. Unterschriftsfelder lassen sich nicht unterschreiben.'
			},
			scripts: {
				title: 'Berechnungen und Prüfungen',
				text: 'Manche Formulare bringen eigene kleine Programme mit: Sie zählen Felder zusammen (Stunden, Beträge), zeigen Zahlen in einem Format („1,50“) und prüfen, was du tippst. Sie laufen hier, sobald du ein Feld verlässt (Tab, Enter oder ein Klick daneben): Summen und Formate folgen sofort und gehören zum selben Schritt für „Rückgängig“ wie deine Eingabe. Lehnt eine Prüfung eine Eingabe ab, behält das Feld, was vorher drinstand, und die Meldung des Formulars erscheint unten. Diese Programme laufen abgeschottet – sie sehen nur die Felder des Formulars, nie deine Dateien, andere Seiten oder das Internet; Fragen an dich (Ja/Nein, einen Text eingeben) werden mit „Nein“ beantwortet.'
			},
			limits: {
				title: 'Was sich hier nicht ausfüllen lässt',
				text: 'Unterschriftsfelder werden angezeigt, lassen sich aber nicht unterschreiben. Formulare aus Adobes XFA (oft aus LiveCycle; sie zeigen manchmal „Bitte warten …“ oder dass dein Programm nicht unterstützt wird) lassen sich nicht ausfüllen – öffne sie in Acrobat. Schaltflächen, die ein Formular senden, drucken oder Seiten öffnen, tun hier nichts. Felder von Seiten, die aus einer anderen PDF eingefügt wurden, bleiben, wie sie sind.'
			}
		}
	},
	present: {
		title: 'Präsentieren',
		items: {
			slides: {
				title: 'Folien als PDF',
				text: 'Eine Präsentation ist hier eine PDF: Jede Seite ist eine Folie. Lege eine mit „Neue PDF …“ und dem Seitenformat „Präsentation 16:9“ an oder öffne eine PDF, die du aus einem beliebigen Präsentationsprogramm exportiert hast. Textfelder, Bilder, Symbole, Formen und Zeichnungen setzt du als Kommentare auf die Seiten (Registerkarte „Kommentieren“); „Duplizieren“ auf der Registerkarte „Seiten“ kopiert eine Folie, um die nächste daraus zu bauen.'
			},
			steps: {
				title: 'In Schritten ein- und ausblenden',
				text: 'Damit das Publikum dir nicht vorauseilt, kann das, was auf einer Folie liegt, nacheinander kommen und gehen. Eine Folie wird in Schritten gezeigt: erst so, wie sie kommt, dann mit jedem „Weiter“ auf ihr einen Schritt weiter. Wähle eines oder mehreres aus und öffne „Ein- und Ausblenden“ – auf der Format-Registerkarte, die sich für die Auswahl öffnet. Dort stehen die Schritte der Folie, jeder mit einem Schalter: „Mit der Seite“, „Schritt 1“ (nach dem ersten „Weiter“), „Schritt 2“ und so fort. Schalte aus, wo die Auswahl nicht zu sehen sein soll, und ein, wo doch; ein Schalter gilt ab seinem Schritt bis zum nächsten Schritt, an dem sich die Auswahl ändert – was spät kommen soll, braucht so zwei Klicks: aus bei „Mit der Seite“, ein bei seinem Schritt. Für einen einzelnen Schritt schalte beim Schritt danach zurück. Schritte fügst du in der Seitenleiste „Präsentationsschritte“ hinzu (unten). So kann etwas später erscheinen (aus bei „Mit der Seite“, ein ab „Schritt 1“), erst da sein und dann gehen (ein, dann aus) oder kommen, gehen und wiederkommen. Ein Schritt, bei dem sich nichts mehr ändert, fällt von selbst weg. Was gleich geschaltet ist, kommt und geht zusammen. Jeder Schalter ist ein Schritt für „Rückgängig“. Solange die Seitenleiste „Präsentationsschritte“ offen ist, trägt alles auf den Seiten seine Schritte als kleine Marke – „2“ erscheint bei Schritt 2, „–3“ geht bei Schritt 3, „1–3 · 5“ ist von Schritt 1 bis 3 da und wieder ab 5 – nur hier, nie im Druck, in Bildern oder beim Präsentieren. Im Editor siehst du immer alles.',
				options: {
					panel: { label: 'Die Seitenleiste „Präsentationsschritte“', text: 'Zeigt die Schritte der Seite in der Ansicht („Präsentationsschritte“ in der Leiste links oder auf der Registerkarte „Präsentation“): „Mit der Seite“, dann jeden Schritt mit der Zahl dessen, was dort kommt und geht. „Weiterer Schritt“ unter der Liste gibt der Seite einen Schritt mehr – er bleibt, sobald dort etwas kommt oder geht. Ein Klick auf einen Schritt wählt aus, was sich dort ändert. Das Menü eines Schritts (Rechtsklick, langer Druck oder ⋯) ändert die Schritte für alles auf der Seite: „Nach oben“ und „Nach unten“ ändern die Reihenfolge (mit der Maus kannst du einen Schritt auch an seinen Platz ziehen), „Schritt davor einfügen“ setzt einen Schritt davor, der dasselbe zeigt wie der vorige – schalte dort dann mit „Ein- und Ausblenden“ ein oder aus –, „Schritt löschen“ entfernt ihn: Was dort kam oder ging, tut es einen Schritt früher, die späteren Schritte rücken auf. Jedes davon ist ein Schritt für „Rückgängig“. „Mit der Seite“ bleibt immer der erste.' },
					what: { label: 'Was kommen und gehen kann', text: 'Alles, was du als Kommentar setzt: Textfelder, Bilder, Symbole, Stempel, Formen, Zeichnungen, Notizen, Markierungen. Was zur Seite selbst gehört – der eigene Text und die Bilder der PDF oder ein in die Seite eingebetteter Kommentar –, ist immer da.' },
					others: { label: 'In anderen Programmen', text: 'Andere PDF-Programme kennen keine Schritte: Sie zeigen jede Folie mit allem darauf – so, wie es auch zum Drucken und Weitergeben der PDF passt.' }
				},
				tip: 'Gib jedem Punkt einer Liste einen eigenen Schritt und lass den Titel mit der Seite kommen. Um ein Bild an derselben Stelle gegen ein anderes zu tauschen, blende das erste bei dem Schritt aus, bei dem das zweite erscheint. Kommt eine Folie aus einem anderen Programm als ein einziges Bild, kann nichts darauf später erscheinen – lege dort eine Folie je Schritt an oder baue die Teile hier als Textfelder neu.'
			},
			present: {
				title: 'Präsentieren',
				text: '„Präsentieren“ auf der Registerkarte „Präsentation“ (F5) beginnt mit der ersten Folie, „Ab dieser Seite“ (Umschalt+F5) mit der aktuellen. Der Pfeil daneben wählt, wie – deine Wahl wird auf diesem Gerät gemerkt. Vorher wird alles gespeichert. Auf den Folien geht es mit einem Klick, →, ↓, der Leertaste, Bild↓ oder Eingabe weiter – zum nächsten Schritt, sonst zur nächsten Folie; ←, ↑, Bild↑ oder die Rücktaste gehen zurück; Pos1 und Ende springen zur ersten und letzten Folie; B oder der Punkt machen das Bild schwarz und wieder hell. Die meisten Presenter senden diese Tasten und funktionieren so, wie sie sind. Esc beendet die Präsentation; der Editor zeigt dann die Folie, bei der du aufgehört hast.',
				options: {
					presenter: { label: '„Mit Referentenansicht“ (Standard)', text: 'Die Folien öffnen sich in einem eigenen Fenster für den Beamer; dieses Fenster wird deine Referentenansicht. Wo der Browser weiß, wo deine Bildschirme sind, legt sich das Folienfenster von selbst auf den anderen Bildschirm (der Browser fragt einmal, ob er darf) – sonst zieh es dorthin. Mit nur einem Bildschirm bleibt es ein kleines Fenster neben dieser Ansicht. Klicke dann darauf auf „Vollbild“ (der Browser braucht diesen Klick im Fenster selbst). Blockiert dein Browser das Fenster, erlaube Pop-ups für diese Seite. Lädst du dieses Fenster aus Versehen neu, bleiben die Folien stehen und die Referentenansicht findet sie wieder.' },
					display: { label: '„Nur Folien“', text: 'Die Folien füllen sofort diesen Bildschirm. Für einen Bildschirm, oder wenn der Beamer dasselbe zeigt wie dein Laptop.' }
				},
				tip: 'Mit einem Beamer als zweitem Bildschirm nimm die Referentenansicht – du siehst, was als Nächstes kommt, und deine Notizen, das Publikum nur die Folie. Spiegelt der Beamer nur deinen Bildschirm, nimm „Nur Folien“.',
				keys: [['F5'], ['Umschalt', 'F5'], ['→'], ['Leertaste'], ['←'], ['B'], ['Esc']]
			},
			presenter: {
				title: 'Referentenansicht',
				text: 'Oben: Folie und Schritt, bei denen du bist, die Zeit seit dem Start (daneben anhalten oder neu starten) und die Uhrzeit; rechts der Zeiger (keiner, „Punkt“, „Spotlight“), „Schwarzbild“, „Alle Folien“ (klicke eine an, um dorthin zu gehen) und „Beenden“. Darunter: die aktuelle Folie groß, daneben, was als Nächstes kommt – der nächste Schritt dieser Folie oder die nächste Folie – und deine Notizen (A− und A+ ändern ihre Größe, auf diesem Gerät gemerkt). Unten „Zurück“ und „Weiter“; die Tasten wirken hier wie auf den Folien. Das Folienfenster arbeitet auch allein weiter: Wird diese Ansicht geschlossen, gehen Tasten und Klicks auf den Folien trotzdem weiter. Wird das Folienfenster versehentlich geschlossen, sagt es die Leiste oben – „Folienfenster öffnen“ holt es bei derselben Folie zurück. Die Anordnung richtet sich nach dem Platz: nebeneinander, wenn es breit ist, untereinander, wenn es schmal ist.',
				keys: [['→'], ['←'], ['Pos1'], ['Ende'], ['B'], ['Esc']]
			},
			remote: {
				title: 'Fernsteuerung vom Handy',
				text: 'Steuere die Folien auf einem anderen Rechner – dem am Beamer – von deinem Handy aus, mit der Referentenansicht auf dem Handy. Am Handy: Öffne die PDF, „Freigeben …“ auf der Registerkarte „Datei“ („Nur ansehen“ genügt), dann „Vier Wörter zeigen“. Am Rechner: Öffne in-browser, Dateien, „Verbinden …“ → „Freigabe mit vier Wörtern …“ und tippe die Wörter – die PDF öffnet sich dort zum Lesen. Wähle im Menü von „Präsentieren“ „Nur Folien“ und starte. Das Handy sagt dann „Dein Gast präsentiert …“: „Fernsteuern“ öffnet dort die Referentenansicht – aktuelle und nächste Folie, deine Notizen, die Zeit, den Zeiger, „Zurück“ und „Weiter“. Solange die Fernsteuerung verbunden ist, steuert nur sie: Tasten und Klicks am Rechner bewegen die Folien nicht, also auch nichts, was dort versehentlich gedrückt wird („Vollbild“ und „Beenden“ dort gehen weiter). „Beenden“ am Handy verlässt nur die Fernsteuerung – die Folien bleiben, wo sie sind, und nehmen die Tasten des Rechners wieder an. Mit deinen eigenen Geräten geht es ohne Freigabe: Starte auf einem das Präsentieren, und dein Handy zeigt dieselbe Meldung.',
				options: {
					stable: { label: 'Wenn die Verbindung abreißt', text: 'Der Rechner zeigt die Folie weiter; etwa 5 Sekunden, nachdem das Handy zuletzt zu hören war, wirken seine Tasten und ein Presenter dort wieder. Das Handy zeigt, dass es verbindet, und findet die Folien von selbst wieder – innerhalb von Sekunden, auch nachdem es neu geladen hat oder der Browser am Rechner neu gestartet wurde (die freigegebene PDF bleibt dort als Kopie, bis die Freigabe endet). Befehle sind Stellen, keine Schritte: Ein doppelt gesendeter Befehl überspringt nie eine Folie.' },
					change: { label: 'Unterwegs noch etwas ändern', text: 'Öffne die PDF am Handy in einem weiteren Tab, ändere sie – eine Notiz, einen Text, wann etwas zu sehen ist –, und sie wird wie immer gespeichert. Der Rechner bekommt die neue Fassung über die Freigabe und zeigt sie auf der Folie, bei der er gerade ist, ohne zu fragen; auch die Fernsteuerung liest sie neu. Bis beide dieselbe Fassung haben, sagt die Fernsteuerung „Die Folien werden abgeglichen …“; bleibt das stehen, erreichen sich die beiden Geräte gerade nicht – die Folien laufen mit der Fassung weiter, die sie haben.' },
					network: { label: 'Was die Verbindung braucht', text: 'Beide Geräte brauchen Internet, um sich zu finden; danach sprechen sie direkt miteinander. Kommen das Netz des Rechners und die mobilen Daten deines Handys nicht zueinander (Firmen- und Hotelnetze sperren das oft), sagt das Handy es nach etwa 20 Sekunden – hol den Rechner in den Hotspot deines Handys oder beide ins selbe WLAN.' }
				},
				tip: 'Probiere es vor dem Vortrag an dem Rechner aus, den du nutzen wirst. Ist sein Netz streng, starte den Hotspot des Handys und verbinde den Rechner damit – das klappt fast überall. Lass den Bildschirm des Handys an; in-browser bittet es, sich nicht abzuschalten, solange die Fernsteuerung offen ist.'
			},
			pointer: {
				title: 'Zeiger',
				text: 'Wähle oben in der Referentenansicht „Punkt“ oder „Spotlight“ und zeig dann mit der Maus auf die aktuelle Folie (oder drück und zieh mit Finger oder Stift): Das Publikum sieht es auf den Folien. Der Punkt ist weich und zieht eine kurze, verblassende Spur – ruhiger als das Zittern eines Laserpointers; das Spotlight dunkelt die Folie ab, bis auf einen Kreis um die Stelle. Verlässt die Maus die Folie, verschwindet er, und eine Sekunde nach der letzten Bewegung geht er von selbst. Eine andere Folie beendet ihn dort.',
				tip: 'Den Punkt, um auf eine Einzelheit zu zeigen, das Spotlight, wenn alle auf eine Stelle einer vollen Folie schauen sollen.'
			},
			notes: {
				title: 'Notizen',
				text: 'Die Seitenleiste „Präsentationsnotizen“ (in der Leiste links oder auf der Registerkarte „Präsentation“) hält, was du auf der aktuellen Seite sagen willst. Tippe hinein; beim Verlassen des Felds wird der Text übernommen (ein Schritt für „Rückgängig“), Esc stellt wieder her, was vorher dastand. Die Notizen liegen als versteckter Teil ihrer Seite in der PDF: Sie wandern, werden kopiert und gelöscht mit ihr und reisen mit der Datei – gezeichnet, gedruckt oder als Bild exportiert werden sie nie.',
				tip: 'Halte sie kurz – Stichworte und Zahlen, die du nicht vergessen willst. Andere PDF-Programme zeigen sie unter Umständen als versteckten Kommentar; schreib nichts hinein, was die Empfänger der PDF nicht lesen dürfen.'
			}
		}
	},
	changes: {
		title: 'Änderungen und Speichern',
		items: {
			saving: {
				title: 'Speichern',
				text: 'Änderungen speichern sich selbst: etwa 1,5 Sekunden nach der letzten (bei PDFs über 25 MB nach 10 Sekunden, weil jedes Speichern die ganze Datei schreibt) und sofort, wenn du die Seite verlässt oder zu einer anderen App wechselst. Das Symbol links in der unteren Leiste zeigt, ob alles gespeichert ist; zeig darauf, um den Stand zu lesen. Die PDF bleibt eine normale PDF in deinen Dateien: Deine Änderungen kommen an ihr Ende, der Rest der Datei bleibt genau, wie er war. „Rückgängig“, bis nichts mehr geändert ist, ergibt wieder die ursprüngliche Datei. Die eine Ausnahme: Sobald du den Inhalt der Seiten selbst änderst (Registerkarte „Inhalt“), wird die Datei als Ganzes neu geschrieben, damit Gelöschtes wirklich aus ihr verschwunden ist.',
				link: { href: '/help/sync', label: 'Wie deine Dateien zu deinen anderen Geräten kommen' }
			},
			content: {
				title: 'Seiteninhalt bearbeiten',
				text: 'Die Registerkarte „Inhalt“ ändert, woraus die Seiten selbst bestehen – nicht deine Kommentare darüber. Sie arbeitet mit Objekten: einem Textstück (so, wie die Datei es setzt, meist eine Zeile oder ein Teil davon), einem Bild, einer Grafik (eine gefüllte oder umrandete Form) oder einer eingebetteten Zeichnung als Ganzes. Text wird nie neu getippt oder umbrochen. Schalte zuerst den Schalter „Inhalt bearbeiten“ ein – er ist bei jeder geöffneten PDF aus, und solange er aus ist, kann nichts ändern, was die Seiten enthalten (nur das Einbetten eines eigenen Kommentars, unten, geht ohne ihn). Dann ist „Objekte auswählen“ das Werkzeug: Ein Umriss zeigt das Objekt unter dem Mauszeiger, ein Klick wählt es (Umschalt oder Strg nimmt dazu oder heraus; ein neben den Objekten aufgezogener Rahmen wählt alles, was ganz darin liegt; „Alle Objekte“ wählt die der Seite). Zieh das Ausgewählte, um es zu verschieben (Umschalt hält die Achse), zieh an einer Ecke des Rahmens, um es proportional zu skalieren, oder drücke Entf („Objekt löschen“). Die Pfeiltasten verschieben um 1 Punkt, mit Umschalt um 10. Beim Ziehen bewegt sich ein leicht durchscheinendes Bild des Ausgewählten mit, und mit „Einrasten“ rastet es an Rändern und Mitte der Seite und an den anderen Objekten der Seite ein (Alt tut das Gegenteil); das Original bleibt stehen, bis du loslässt, dann wird die Seite neu gezeichnet. Jede Änderung ist ein Schritt für „Rückgängig“.',
				options: {
					replace: { label: '„Bild ersetzen …“', text: 'Wenn genau ein Bild der Seite ausgewählt ist: Wähle ein Bild aus deinen Dateien (auch ein SVG oder eine Seite einer PDF). Es wird proportional in den Platz des alten Bildes eingepasst und dort zentriert, und es wird dort gezeichnet, wo das alte gezeichnet wurde – was über dem Bild lag, bleibt darüber. Danach ist es ein Objekt wie jedes andere: Verschiebe oder skaliere es. Das alte Bild verschwindet aus der Datei.' },
					flatten: { label: '„In die Seite einbetten“ und „Alle Kommentare einbetten“', text: 'So werden neuer Text und neue Bilder Teil einer Seite: Setze ein Textfeld, ein Bild, einen Stempel oder eine Zeichnung wie gewohnt als Kommentar, wähle ihn aus und nimm „In die Seite einbetten“ – der Knopf mit den Ebenen im kleinen Menü am ausgewählten Kommentar oder auf der Registerkarte „Inhalt“. Jeder Kommentar wird genau so in die Seite gezeichnet, wie er aussieht, und ist danach kein Kommentar mehr: Sein Kommentartext, Antworten und Status entfallen, andere Programme können ihn nicht mehr abnehmen. Links und an eine Stelle angehängte Dateien bleiben Kommentare. „Alle Kommentare einbetten“ (Registerkarte „Inhalt“) nimmt jeden Kommentar der PDF. Beides geht ohne den Schalter „Inhalt bearbeiten“ – er schützt, was die Seite schon enthält; um Eingebettetes zu verschieben, zu skalieren oder zu löschen, schalte ihn ein. Einbetten schreibt die Datei neu wie jede Änderung am Inhalt, eine signierte PDF fragt deshalb vorher. Ein Schritt für „Rückgängig“, der den Kommentar zurückholt.' },
					deleted: { label: 'Was „gelöscht“ heißt', text: 'Eine PDF, deren Inhalt du geändert hast, wird beim Speichern als Ganzes neu geschrieben, nur mit dem, was noch gebraucht wird: Das gelöschte Objekt ist aus der Datei verschwunden – nicht bloß verdeckt –, ebenso frühere Fassungen, die in der Datei aufbewahrt waren. Nicht angefasst werden Kopien derselben Sache an anderer Stelle der PDF (Alternativtexte für Screenreader, Lesezeichen, Metadaten, Anhänge, dasselbe Bild auf einer anderen Seite) und ältere Fassungen der Datei außerhalb davon (der Papierkorb, andere Geräte, Konfliktkopien).' },
					signed: { label: 'Signierte PDFs', text: 'Das Neuschreiben der Datei macht ihre Signaturen ungültig. Du wirst einmal gefragt, bevor der Schalter angeht oder der erste Kommentar eingebettet wird.' },
					limits: { label: 'Was sich nicht auswählen lässt', text: 'Beschnittbereiche, Verläufe und alles, was die Datei ungewöhnlich aufbaut, bleiben, wie sie sind. Ein Objekt, das aus einem beschnittenen Bereich herausgeschoben wird, kann abgeschnitten sein. Auf einer Seite, deren Inhalt sich nicht sicher lesen lässt, steht in der unteren Leiste „Der Inhalt dieser Seite lässt sich nicht bearbeiten“; aus anderen PDFs eingefügte und leere Seiten haben hier keinen bearbeitbaren Inhalt.' }
				},
				tip: 'Nimm Kommentare (Registerkarte „Kommentieren“) für alles, was entfernbar und als Zusatz erkennbar bleiben soll; bearbeite den Inhalt oder bette ein, wenn die Seite selbst anders sein soll – etwa bevor du eine PDF jemandem schickst, der deine Ergänzungen nicht entfernen können soll. Um sicherzugehen, dass etwas weg ist, suche danach in der gespeicherten PDF.',
				keys: [['Entf'], ['←', '→', '↑', '↓'], ['Umschalt', '←'], ['Esc']]
			},
			undo: {
				title: 'Rückgängig und Wiederholen',
				text: '„Rückgängig“ und „Wiederholen“ links im Menüband nehmen eine Änderung zurück und machen sie wieder, so weit zurück, wie die PDF geöffnet ist.',
				keys: [['Strg', 'Z'], ['Strg', 'Umschalt', 'Z'], ['Strg', 'Y']]
			},
			rotate: {
				title: 'Seiten organisieren',
				text: 'Die Registerkarte „Seiten“ wirkt auf die in der Seitenleiste „Seiten“ gewählten Seiten, sonst auf die aktuelle Seite – die in der Mitte des Fensters. „Nach links drehen“ und „Nach rechts drehen“ drehen sie um eine Vierteldrehung. „Duplizieren“ setzt jeweils eine Kopie direkt dahinter – mit allem, was darauf gezeichnet ist, ihren Schritten und ihren Notizen; eine Kopie dreht sich mit ihrer Seite. „Nach vorne“ und „Nach hinten“ verschieben sie um eine Stelle (das Seitenmenü hat außerdem „An den Anfang“ und „Ans Ende“). „Seiten löschen“ entfernt sie samt allem, was darauf gezeichnet ist; die letzte Seite bleibt immer. „Leere Seite“ fügt nach der aktuellen eine leere Seite ein, so groß wie sie; „Aus PDF …“ fügt dort alle Seiten einer anderen PDF aus deinen Dateien ein, „Bild …“ ein Bild als eigene Seite (so groß wie das Bild, höchstens A4). Jede Änderung ist ein Schritt für „Rückgängig“ und ändert die Datei: Auch andere Programme zeigen die Seiten so.',
				keys: [['Strg', 'Klick'], ['Umschalt', 'Klick']]
			},
			newFile: {
				title: 'Neue PDFs aus Seiten',
				text: 'Auf der Registerkarte „Datei“, Gruppe „Neue PDF“: „Extrahieren …“ (auch im Seitenmenü) speichert die in der Seitenleiste „Seiten“ gewählten Seiten (sonst die aktuelle) als neue PDF, samt allem, was darauf gezeichnet ist; „Zusammenführen …“ speichert diese PDF und dahinter andere PDFs, die du wählst, als neue. Wohin, bestimmst du; die hier offene PDF bleibt, wie sie ist. Eine Meldung bietet an, die neue PDF zu öffnen.',
				tip: 'Um Seiten in eine andere PDF zu bringen, extrahiere sie, öffne die andere PDF und füge sie dort mit „Aus PDF …“ ein. Seiten einer PDF, die zum Öffnen ein Passwort braucht, lassen sich nicht einfügen.'
			},
			conflict: {
				title: 'Woanders geändert',
				text: 'Wird die PDF in einem anderen Tab, auf einem anderen Gerät oder in einem synchronisierten Ordner geändert, während sie hier offen ist, und hast du keine ungespeicherten Änderungen, fragt der Editor, ob er sie neu laden soll („Neu laden“ / „Nicht neu laden“, auf Wunsch ohne weitere Frage, solange sie offen ist). Hast du Änderungen, die noch nicht gespeichert sind, pausiert das Speichern und eine Leiste fragt, was geschehen soll.',
				options: {
					reload: { label: 'Neu laden', text: 'Zeigt die andere Version; deine ungespeicherten Änderungen entfallen.' },
					keepMine: { label: 'Meine Version behalten', text: 'Das nächste Speichern ersetzt die andere Version durch deine.' }
				},
				tip: 'Behalte deine Version, wenn du weißt, dass die andere Änderung nicht zählt (etwa weil du die PDF versehentlich auf einem anderen Gerät geöffnet hast). Sonst lade neu und mach deine Änderung noch einmal.',
				link: { href: '/help/sync', label: 'Synchronisieren zwischen Geräten' }
			},
			limits: {
				title: 'Geschützte, beschädigte und signierte PDFs',
				text: 'Eine PDF, die zum Öffnen ein Passwort braucht, lässt sich hier nicht öffnen. Einschränkungen, die zum Öffnen kein Passwort verlangen (kein Drucken, Kopieren oder Ändern), werden wie in den meisten Anzeigeprogrammen übergangen: Du kommentierst, füllst aus und organisierst eine solche PDF wie jede andere, und sie bleibt geschützt wie zuvor. Eine PDF, die anders geschützt ist (z. B. mit einem Zertifikat), lässt sich lesen, aber nicht ändern: Eine Leiste sagt das. Genauso bei PDFs, deren Aufbau zu beschädigt ist, um Änderungen anzufügen; eine PDF, deren Ende nur leicht beschädigt ist, wird beim ersten Speichern neu geschrieben. In einer signierten PDF kommen deine Änderungen nach den Signaturen, so belegen diese weiter die signierte Version; vor der ersten Änderung an ihren Seiten wirst du gefragt, weil Programme womöglich melden, dass sich Seiten nach dem Signieren geändert haben. Den Inhalt der Seiten selbst zu bearbeiten (Registerkarte „Inhalt“) schreibt die Datei neu und macht die Signaturen ungültig; auch davor wirst du gefragt.'
			}
		}
	}
};

export default de;
