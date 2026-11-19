import type enHelp from './help.en.js';

const help: typeof enHelp = {
	start: {
		title: 'Erste Schritte',
		items: {
			startPage: {
				title: 'Startseite',
				text: 'Ist keine Datei offen, siehst du die Startseite: „Neu“ beginnt einen leeren Text, „Aus Files öffnen …“ wählt Dateien aus dem Browserspeicher, den alle Tools von in-browser teilen, „Vom Rechner öffnen …“ liest Dateien von deinem Rechner. Darunter listet „Zuletzt geöffnet“ die letzten zehn Dateien mit ihrem Ordner – ein Klick öffnet eine davon wieder. Du kannst Textdateien auch von deinem Rechner auf die Seite ziehen. Textdateien, die du in Files öffnest („Mit Text Editor öffnen“), landen ebenfalls hier.'
			},
			tabs: {
				title: 'Tabs',
				text: 'Jede offene Datei bekommt einen Tab über dem Text. Klicke einen Tab an, um ihn zu zeigen; sein × oder die mittlere Maustaste schließt ihn. Ein Rechtsklick (auf Touchscreens langes Drücken) bietet „Schließen“, „Andere schließen“ und „In Files zeigen“. Ein Punkt im Tab heißt: geändert, nicht gespeichert, und die Datei speichert sich nicht selbst – sie hat noch keinen Ort, oder das Speichern pausiert. Öffnest du eine Datei, die schon offen ist, wechselst du nur zu ihrem Tab. Ein frischer, leerer Tab „Unbenannt“ macht der ersten Datei Platz, die du öffnest.'
			},
			fileMenu: {
				title: 'Der Dateiname in der oberen Leiste',
				text: 'Der Name der gezeigten Datei steht in der oberen Leiste. Klicke darauf, um die Datei umzubenennen (nur Dateien mit einem Ort im Browserspeicher). Der Pfeil daneben öffnet das Menü mit allen Aktionen für diese Datei: Speichern, Rückgängig, Suchen, Formatierung (Markdown), die Aktionen der Tabelle oder des Baums („Zeile hinzufügen“, „Spalte hinzufügen“, „Eintrag hinzufügen“), „Umbenennen“, „Herunterladen“, „In Files zeigen“, „Neu“, Öffnen und „Schließen“. Die häufigsten stehen auch als Knöpfe neben dem Namen; auf schmalen Bildschirmen nur in diesem Menü.'
			},
			restore: {
				title: 'Wiederkommen',
				text: 'Deine offenen Tabs kommen zurück, wenn du den Text Editor das nächste Mal öffnest – samt Änderungen, die noch nicht gespeichert waren, auch in „Unbenannt“-Texten und Dateien vom Rechner. Diese ungespeicherten Änderungen liegen privat in diesem Browser: Sie erscheinen nicht in Files und werden nicht abgeglichen. Der Tab einer Datei, die es nicht mehr gibt, kommt nur zurück, wenn er ungespeicherte Änderungen hatte.',
				tip: 'Das ist ein Sicherheitsnetz, kein Ort zum Aufbewahren. Speichere Texte, die du behalten willst („Speichern …“), damit sie echte Dateien sind, die du in Files findest und die deine anderen Geräte erreichen.'
			},
			install: {
				title: 'Installieren, offline und Browser',
				text: 'Bietet dein Browser es an, installierst du den Text Editor wie ein Programm; er startet dann auch ohne Internetverbindung. Die Syntax-Hervorhebung einer Sprache wird geladen, wenn du zum ersten Mal eine solche Datei öffnest – offline erscheint eine Datei einer noch nie genutzten Sprache ohne Farben, bis du wieder online bist.',
				link: { href: '/help/install', label: 'Installieren, offline und unterstützte Browser' }
			}
		}
	},
	files: {
		title: 'Öffnen und speichern',
		items: {
			open: {
				title: 'Dateien öffnen',
				text: '„Öffnen“ in der oberen Leiste hat zwei Wege: „Aus Files öffnen …“ wählt eine oder mehrere Dateien im Browserspeicher – sie öffnen sich mit ihrem Ort, jede Änderung wird also dort gespeichert. „Vom Rechner öffnen …“ (oder Dateien auf die Seite ziehen) liest eine Kopie der Dateien: Sie öffnen sich ohne Ort, und nichts wird geschrieben, bis du sie speicherst. Gezogene Ordner werden übersprungen. Dateien über 20 MB und Dateien, die kein Text sind (Bilder, Programme), öffnen sich nicht.',
				tip: 'Willst du eine Datei von deinem Rechner hier weiter bearbeiten, auch auf anderen Geräten? Öffne sie vom Rechner und speichere sie einmal mit „Speichern …“ – ab dann speichert sie sich selbst. Brauchst du nur eine schnelle Änderung, bearbeite sie und nimm „Herunterladen“.'
			},
			autosave: {
				title: 'Automatisch speichern',
				text: 'Eine Datei mit einem Ort im Browserspeicher speichert sich etwa eine Sekunde, nachdem du aufhörst zu tippen, und sofort, wenn du den Tab wechselst, den Tab schließt oder die Seite verlässt. Das Symbol links in der unteren Leiste zeigt den Stand: gespeichert, wird gespeichert, noch nicht gespeichert – fahr mit der Maus darüber für den Text. Beim Speichern bleiben Kodierung und Zeilenende der Datei erhalten, eine unveränderte Datei bleibt also genau so, wie sie war. Nichts wird hochgeladen.',
				link: { href: '/help/storage', label: 'Wo deine Dateien liegen' }
			},
			connected: {
				title: 'Texte in einem verbundenen Ordner',
				text: 'Die Auswahl vor dem Ordnerpfad im Öffnen- und Speichern-Dialog wechselt zwischen Meine Dateien und den Ordnern, die du in Files verbunden hast („Verbunden“). Ein Text aus einem verbundenen Ordner öffnet und speichert sich direkt dort auf deinem Rechner, auch automatisch. Erlaubt der Browser den Zugriff nicht mehr (meist nach einem Neustart), zeigt das Speichern-Symbol in der unteren Leiste einen Fehler, und eine Meldung bietet „Zugriff erlauben“ an; deine Änderungen bleiben bis dahin erhalten und werden gespeichert, sobald du es erlaubst.',
				link: { href: '/help/connected', label: 'Verbundene Ordner' }
			},
			saveNew: {
				title: 'Einen neuen Text speichern',
				text: '„Unbenannt“-Texte und Dateien vom Rechner haben noch keinen Ort: Der Knopf „Speichern …“ in der oberen Leiste (und Strg+S) fragt nach Ordner und Namen im Browserspeicher. Der Dialog startet im zuletzt benutzten Ordner. Danach speichert sich die Datei selbst wie jede andere. Die Endung des Namens bestimmt die Hervorhebung – „notizen.md“ wird Markdown.'
			},
			saveAs: {
				title: 'Speichern unter',
				text: '„Speichern unter …“ im Menü am Dateinamen schreibt den Text unter einem neuen Namen oder in einen anderen Ordner – der Tab arbeitet dann mit der neuen Datei weiter, die alte bleibt, wie sie war. Wählst du eine bestehende Datei, wird sie ersetzt.'
			},
			rename: {
				title: 'Umbenennen, herunterladen, in Files zeigen',
				text: 'Klicke auf den Dateinamen in der oberen Leiste (oder „Umbenennen“ in seinem Menü), um die Datei in ihrem Ordner umzubenennen; mit einer neuen Endung ändert sich die Hervorhebung mit. „Herunterladen“ legt eine Kopie im Download-Ordner deines Rechners ab, in der aktuellen Kodierung und mit dem aktuellen Zeilenende – auch für Texte, die noch keinen Ort haben. „In Files zeigen“ öffnet Files in einem neuen Browser-Tab, im Ordner der Datei.'
			},
			close: {
				title: 'Schließen',
				text: '„Schließen“ speichert eine Datei mit Ort vorher. Nur wenn das nicht geht – der Text hat noch keinen Ort, oder das Speichern pausiert –, wirst du gefragt: „Änderungen verwerfen?“; „Verwerfen“ wirft die Änderungen weg.'
			},
			conflicts: {
				title: 'Woanders geändert',
				text: 'Dieselbe Datei kann sich in einem anderen Browser-Tab oder durch den Abgleich mit deinen anderen Geräten ändern. Hast du keine ungespeicherten Änderungen, lädt der Editor die Datei einfach neu und sagt es dir. Hast du welche, meldet ein gelber Balken, dass die Datei „woanders geändert“ wurde, und das automatische Speichern pausiert: „Neu laden“ übernimmt die andere Version und verwirft deine, „Meine Version behalten“ speichert deine darüber. Wurde die Datei gelöscht oder verschoben, sagt es der Balken, und das nächste Speichern legt sie wieder an. Speicherst du von Hand (Strg+S) über eine neuere Version, fragt der Editor vorher „Neuere Version ersetzen?“.',
				tip: 'Unsicher, welche Version stimmt? Kopiere deinen Text (Strg+A, Strg+C) vor „Neu laden“, dann kannst du Teile davon wieder einfügen.',
				link: { href: '/help/sync', label: 'Deine Geräte abgleichen' }
			}
		}
	},
	formats: {
		title: 'Formate',
		items: {
			types: {
				title: 'Dateitypen',
				text: 'Der Editor öffnet reine Textdateien: .txt, .log, .csv, .tsv, Markdown, JSON, JSON Lines (.jsonl, .ndjson), YAML, TOML, INI und andere Einstellungsdateien, HTML, CSS, XML, JavaScript, TypeScript, Svelte, Python und Shell-Skripte. Die Endung des Dateinamens bestimmt, wie der Text eingefärbt wird und welche Ansicht er neben dem Text bekommt: eine Tabelle, einen Baum oder eine Vorschau (siehe unten); die untere Leiste zeigt die Sprache („Nur Text“ ohne). SVG-Bilder öffnen sich in Files als Bild – wähle „Mit Text Editor öffnen“ im Menü der Datei, um ihren Text hier zu bearbeiten, mit dem Bild daneben. Einstellungsdateien namens .env (auch .env.local …) sind in Files versteckt; öffne sie mit „Vom Rechner öffnen …“.'
			},
			table: {
				title: 'Tabelle (CSV, TSV, JSON Lines)',
				text: 'CSV- und TSV-Dateien erscheinen als Tabelle neben dem Text, JSON-Lines-Dateien (ein JSON-Objekt pro Zeile) ebenso – ihre Spalten sind die Schlüssel der Objekte. Klicke eine Zelle an, um sie auszuwählen, doppelklicke sie (oder drücke Enter, F2 oder tippe einfach los), um sie zu ändern; Enter speichert und geht nach unten, Tab nach rechts, Esc bricht ab. Eine Zelle darf mehrere Zeilen haben: Umschalt+Enter oder Alt+Enter beginnt eine neue (auf Touchscreens Enter, und ✓ unter dem Feld speichert); in der Tabelle stehen ihre Zeilen mit ⏎ verbunden. Der Spaltentitel öffnet das Menü der Spalte: „Aufsteigend sortieren“ und „Absteigend sortieren“ bringen die Zeilen in der Datei in diese Reihenfolge – Zahlen nach ihrem Wert (auch mit Dezimalkomma), Text alphabetisch mit „2“ vor „10“, leere Zellen zuletzt; die Spaltennamen bleiben oben. „Filtern …“ blendet nur Zeilen aus: Ein Feld über der Tabelle behält die Zeilen, deren Zelle den Text enthält (Groß- und Kleinschreibung egal); das × entfernt den Filter, die untere Leiste zeigt „3 von 40 Zeilen“. Im selben Menü benennst du Spalten um, fügst sie ein, verschiebst und löschst sie; die Zeilennummer öffnet das Menü der Zeile (oberhalb oder unterhalb einfügen, verschieben, löschen). Ein Rechtsklick auf eine Zelle (auf Touchscreens langes Drücken) bietet beides. „Zeile hinzufügen“ und „Spalte hinzufügen“ stehen auch im Menü am Dateinamen.',
				options: {
					header: { label: 'Erste Zeile als Spaltennamen (Standard)', text: 'Im Menü „Ansicht“: Die erste Zeile einer CSV-Datei ist der Titel jeder Spalte. Ausgeschaltet heißen die Spalten A, B, C … und die erste Zeile ist eine Datenzeile wie alle anderen.' },
					delimiter: { label: 'Trennzeichen', text: 'Ebenfalls in „Ansicht“: „Automatisch erkennen“ (Standard) liest die ersten Zeilen und wählt Komma, Semikolon, Tabulator oder senkrechten Strich; wähle selbst eins, wenn die Tabelle falsch aussieht. TSV-Dateien nutzen immer den Tabulator. Das ändert nur, wie die Datei gelesen wird, nicht die Datei.' }
				},
				tip: 'Nur eine Spalte, wo du mehrere erwartest? Wähle das Trennzeichen in „Ansicht“ – deutsches Excel schreibt zum Beispiel Semikolons. Zeilen einer JSON-Lines-Datei, die keine Objekte sind, stehen kursiv da und lassen sich nur im Text ändern.'
			},
			tree: {
				title: 'Baum (JSON, YAML, TOML, INI, XML …)',
				text: 'JSON-, YAML-, TOML-, XML-, INI- und .properties-Dateien sowie .env-Dateien erscheinen als Baum neben dem Text (JSON Lines und SVG lassen sich in „Ansicht“ auf einen umschalten). Die Pfeile öffnen und schließen eine Ebene; die erste Ebene ist anfangs offen. Doppelklicke einen Wert (oder wähle ihn aus und drücke Enter), um ihn zu ändern, doppelklicke einen Schlüssel oder Namen (oder drücke F2), um ihn umzubenennen; Enter speichert, Esc bricht ab, Umschalt+Enter oder Alt+Enter beginnt in einem Wert eine neue Zeile (auf Touchscreens Enter, und ✓ speichert). Textwerte bleiben Text; in anderen Werten werden Zahlen, true/false und null als solche erkannt. Der ⋯-Knopf einer Zeile (oder ein Rechtsklick, auf Touchscreens langes Drücken) öffnet ihr Menü: darin einen Eintrag, Listeneintrag, ein Element, Attribut oder einen Text hinzufügen, „Davor einfügen“, „Danach einfügen“, „Duplizieren“, „Nach oben verschieben“, „Nach unten verschieben“, den „Typ“ ändern (Text, Zahl, Ja/Nein, Leer, Objekt, Liste) und „Löschen“. In INI-Dateien fügt das Menü am Dateinamen einen Abschnitt hinzu. „Alle öffnen“, „Alle schließen“ und „Filtern …“ stehen in „Ansicht“; der Filter zeigt Zeilen, deren Schlüssel oder Wert den Text enthält, mit den Ebenen darüber.',
				tip: 'Was ein Format nicht kann, wird nicht angeboten: TOML kennt keinen leeren Wert, INI-Werte sind immer Text, XML-Kommentare, YAML-Aliase (*name) und die Reihenfolge von TOML-Tabellen änderst du nur im Text.'
			},
			bothSides: {
				title: 'Auf beiden Seiten bearbeiten',
				text: 'Text und Tabelle oder Baum sind dieselbe Datei: Was du auf einer Seite änderst, erscheint sofort auf der anderen, und Speichern, „Rückgängig“ und die Synchronisierung funktionieren für beide gleich – jede Änderung in Tabelle oder Baum ist ein Rückgängig-Schritt. Eine Änderung dort schreibt nur die Stelle neu, um die es geht; der restliche Text mit Einrückung, Kommentaren, Anführungszeichen und Leerzeilen bleibt genau, wie er war. Ein Klick auf eine Zelle oder Zeile der Ansicht setzt den Cursor im Text dorthin, und wenn du den Cursor im Text bewegst, wird die Zelle oder Zeile markiert. Hat der Text einen Fehler (ein fehlendes Anführungszeichen oder eine fehlende Klammer), nennt ein gelber Balken die Zeile, und die Ansicht zeigt unverändert den letzten Stand ohne Fehler, bis der Text wieder stimmt; „Im Text zeigen“ springt hin.'
			},
			highlighting: {
				title: 'Syntax-Hervorhebung und Code-Hilfen',
				text: 'In Code- und Datendateien bekommen Schlüsselwörter, Zeichenketten, Zahlen und Kommentare eigene Farben. Klammern und Anführungszeichen schließen sich selbst, die passende Klammer wird markiert, und neue Zeilen behalten die Einrückung. Die Pfeile neben den Zeilennummern klappen einen Block (eine Funktion, einen Abschnitt) ein und wieder aus.'
			},
			preview: {
				title: 'Vorschauen: Markdown, HTML, SVG',
				text: 'Markdown-Dateien (.md, .markdown) zeigen ihren formatierten Text neben dem Editor, HTML-Dateien die Seite, SVG-Dateien das Bild – jede folgt deinem Tippen und ist dort nur zum Lesen; du schreibst im Text. Markdown-Tabellen, Aufgabenlisten und Durchgestrichenes erscheinen ebenfalls. Links öffnen sich in einem neuen Browser-Tab. Aus Sicherheitsgründen führen die Vorschauen nichts aus und laden nichts von außen: Skripte einer HTML-Seite laufen nicht, und Bilder, Stile oder Schriften aus dem Web oder neben der Datei erscheinen nicht – nur, was im Text selbst steht. Durchsichtige Stellen eines SVG zeigen ein Schachbrett.'
			},
			encoding: {
				title: 'Kodierung',
				text: 'Wie die Zeichen als Bytes gespeichert werden. Der Editor erkennt sie beim Öffnen und behält sie beim Speichern; die untere Leiste zeigt sie (z. B. „UTF-8“). Klicke darauf für zwei Listen: „Mit Kodierung neu öffnen“ liest die Datei in einer anderen Kodierung neu ein (nur Dateien mit Ort; ungespeicherte Änderungen gehen nach Rückfrage verloren), „Mit Kodierung speichern“ legt den Text ab dem nächsten Speichern in einer anderen ab.',
				options: {
					utf8: { label: 'UTF-8', text: 'Fasst jedes Zeichen jeder Sprache. Heute der Standard und die Wahl für neue Dateien.' },
					bom: { label: '… mit BOM', text: 'Setzt eine unsichtbare Markierung an den Anfang, die die Kodierung ankündigt. Manche Programme brauchen sie, andere zeigen sie als fremde Zeichen.' },
					utf16: { label: 'UTF-16 LE / UTF-16 BE', text: 'Jedes Zeichen in zwei oder mehr Bytes; nutzen manche Windows-Programme und Exporte.' },
					legacy: { label: 'Windows-1252 / ISO-8859-1', text: 'Ältere Kodierungen für westeuropäische Sprachen: ein Byte pro Zeichen, aber keine Emoji, keine griechischen, kyrillischen oder asiatischen Zeichen.' }
				},
				tip: 'Behalte, was die Datei hat. Sehen Umlaute kaputt aus („Ã¤“ statt „ä“ oder „�“), lag die Erkennung falsch: Versuch „Mit Kodierung neu öffnen“ → Windows-1252 oder UTF-8. Nimm „UTF-8 mit BOM“ für CSV-Dateien, die Excel mit richtigen Umlauten öffnen soll. Lässt sich ein Zeichen in der gewählten Kodierung nicht speichern, meldet es ein Balken, und das automatische Speichern pausiert – „Als UTF-8 speichern“ löst das.'
			},
			lineEnding: {
				title: 'Zeilenende',
				text: 'Die untere Leiste zeigt, wie die Zeilen dieser Datei enden – „LF“ oder „CRLF“ –, erkannt beim Öffnen und beibehalten beim Speichern. Klicke darauf, um es zu ändern; die Änderung wird wie eine Bearbeitung gespeichert.',
				options: {
					lf: { label: 'LF', text: 'Üblich unter macOS, Linux, im Web und in Code-Projekten. Neue Texte nutzen es.' },
					crlf: { label: 'CRLF', text: 'Üblich unter Windows. Manche Windows-Werkzeuge und ältere Programme erwarten es.' }
				},
				tip: 'Behalte, was die Datei hat, damit andere nur deine echten Änderungen sehen. Nimm CRLF nur, wenn ein Windows-Programm es braucht, z. B. bei Batch-Dateien (.bat).'
			}
		}
	},
	edit: {
		title: 'Bearbeiten und formatieren',
		items: {
			undo: {
				title: 'Rückgängig',
				text: '„Rückgängig“ und „Wiederholen“ sind Knöpfe neben dem Dateinamen und stehen in seinem Menü. Jeder Tab hat seinen eigenen Verlauf; er geht verloren, wenn du den Tab schließt oder die Seite neu lädst.',
				keys: [['Strg', 'Z'], ['Strg', 'Y']]
			},
			formatting: {
				title: 'Markdown-Formatierung',
				text: 'In Markdown-Dateien zeigt die obere Leiste „Fett“, „Kursiv“ und „Link“. Sie wirken auf die Auswahl: Fett und kursiv setzen die Zeichen darum herum oder entfernen sie, wenn sie schon da sind. „Link“ macht den ausgewählten Text zu einem Link und setzt den Cursor dorthin, wo die Adresse hinkommt; eine ausgewählte Webadresse wird zur Adresse des Links.',
				keys: [['Strg', 'B'], ['Strg', 'I'], ['Strg', 'K']]
			},
			paragraph: {
				title: 'Menü Absatz',
				text: 'Das Menü „Absatz“ (auch im Menü am Dateinamen) ändert ganze Zeilen: „Überschrift 1“ bis „Überschrift 3“, „Aufzählung“, „Nummerierte Liste“, „Aufgabe“ (ein Punkt mit Kästchen), „Zitat“, „Code-Block“ und „Code im Text“. Es wirkt auf jede Zeile der Auswahl – leere Zeilen bleiben, wie sie sind, nummerierte Listen werden durchgezählt. Haben alle Zeilen dieses Format schon, wird es entfernt; eine andere Überschriftenebene oder Listenart wird ersetzt.'
			},
			lines: {
				title: 'Mit Zeilen arbeiten',
				text: 'Verschieb die aktuelle Zeile (oder alle ausgewählten) nach oben oder unten, kopiere sie darüber oder darunter, lösch sie oder rück sie ein. Tab rückt die Auswahl ein, Umschalt+Tab nimmt die Einrückung zurück. Strg+/ kommentiert Zeilen in Code aus und wieder ein.',
				keys: [['Alt', '↑'], ['Alt', '↓'], ['Umschalt', 'Alt', '↓'], ['Strg', 'Umschalt', 'K'], ['Tab'], ['Umschalt', 'Tab'], ['Strg', '/']]
			},
			multi: {
				title: 'Mehrere Cursor',
				text: 'Du kannst an mehreren Stellen gleichzeitig tippen. Strg+Klick setzt einen weiteren Cursor, Strg+D nimmt das nächste Vorkommen des ausgewählten Worts zur Auswahl dazu, Strg+Alt+↑/↓ setzt einen Cursor in die Zeile darüber oder darunter. Zieh mit gedrückter Alt-Taste, um einen rechteckigen Block auszuwählen, etwa eine Spalte einer Tabelle. Esc führt zurück zu einem einzigen Cursor.',
				keys: [['Strg', 'D'], ['Strg', 'Alt', '↑'], ['Strg', 'Alt', '↓'], ['Esc']]
			}
		}
	},
	search: {
		title: 'Suchen und ersetzen',
		items: {
			find: {
				title: 'Suchen',
				text: '„Suchen“ (unter „Suchen“ in der oberen Leiste) öffnet eine Leiste über dem Text. Jeder Treffer wird markiert; Enter oder „Weiter“ springt zum nächsten, Umschalt+Enter oder „Zurück“ zum vorigen, „Alle“ wählt alle Treffer aus, sodass du sie gemeinsam bearbeitest. Die Optionen: „Groß-/Kleinschreibung“ unterscheidet große und kleine Buchstaben, „Ganzes Wort“ findet nur ganze Wörter, „Regulärer Ausdruck“ nimmt die Suche als regulären Ausdruck. Esc schließt die Leiste. Wählst du ein Wort aus, werden seine anderen Vorkommen auch ohne Leiste markiert.',
				keys: [['Strg', 'F'], ['Enter'], ['Umschalt', 'Enter'], ['F3'], ['Esc']]
			},
			replace: {
				title: 'Ersetzen',
				text: '„Ersetzen“ öffnet dieselbe Leiste mit dem Cursor im Ersetzen-Feld. „Ersetzen“ ersetzt den aktuellen Treffer und geht weiter, „Alle ersetzen“ ersetzt alle Treffer auf einmal – das machst du in einem Schritt rückgängig. Mit „Regulärer Ausdruck“ fügen $1, $2 … im Ersatz die eingeklammerten Teile des Treffers ein.',
				keys: [['Strg', 'H']]
			},
			gotoLine: {
				title: 'Gehe zu Zeile',
				text: '„Gehe zu Zeile“ fragt nach einer Zeilennummer und springt dorthin. „12:5“ geht zusätzlich zu Spalte 5, „+10“ oder „-10“ bewegt sich relativ zur aktuellen Zeile, „50%“ in die Mitte des Texts.',
				keys: [['Strg', 'G']]
			}
		}
	},
	view: {
		title: 'Ansicht',
		items: {
			wrap: {
				title: 'Zeilenumbruch',
				text: '„Zeilenumbruch“ im Menü „Ansicht“ bricht lange Zeilen am Fensterrand um, statt seitlich zu scrollen. Das ändert nur die Anzeige, nicht die Datei. Auf Telefonen und in schmalen Fenstern ist er von Anfang an an und gilt für alle Tabs.',
				tip: 'Schalte ihn für Fließtext und Markdown ein, wo ein Absatz eine lange Zeile ist. Schalte ihn für Code und Tabellen aus, wo die Zeilenstruktur zählt.'
			},
			fontSize: {
				title: 'Schriftgröße',
				text: '„Schrift größer“ und „Schrift kleiner“ im Menü „Ansicht“ ändern die Größe des Texts im Editor schrittweise; „Standard-Schriftgröße“ stellt sie zurück. Die Einstellung gilt für alle Tabs und bleibt in diesem Browser gespeichert.'
			},
			preview: {
				title: 'Text, Ansicht oder beides',
				text: 'Bei Dateien mit Tabelle, Baum oder Vorschau wählst du im Menü „Ansicht“, was zu sehen ist – das bleibt fürs nächste Mal und für alle Dateien gespeichert. Der Knopf mit dem Symbol der Ansicht (Tabelle, Baum, Vorschau) in der oberen Leiste schaltet die Ansicht ein und aus. Hat ein Dateityp mehrere Ansichten (JSON Lines: Tabelle oder Baum, SVG: Bild oder Baum), wählst du sie weiter unten im selben Menü.',
				options: {
					text: { label: 'Nur Text', text: 'Nur der Text, wie bei jeder anderen Datei.' },
					split: { label: 'Text und Ansicht (Standard)', text: 'Links der Text, rechts die Ansicht. Ziehe die Linie dazwischen (oder wähle sie aus und nutze die Pfeiltasten), um die Breite anders zu teilen; ein Doppelklick teilt sie halb und halb.' },
					view: { label: 'Nur Ansicht', text: 'Die ganze Breite für Tabelle oder Baum – gut für breite Tabellen. Der Text bleibt im Hintergrund offen; Rückgängig funktioniert wie gewohnt.' }
				},
				tip: 'Arbeitest du vor allem mit Tabelle oder Baum? Wähle „Nur Ansicht“ und wechsle mit dem Knopf zurück, wenn du den Text brauchst. Auf schmalen Bildschirmen ist für beides kein Platz: Der Knopf wechselt zwischen Text und Ansicht.'
			},
			statusBar: {
				title: 'Untere Leiste',
				text: 'Links in der unteren Leiste: der Speicherstand, die Cursorposition (Zeile und Spalte), wie viele Zeichen ausgewählt sind, die Sprache, was die Ansicht zeigt („12 Zeilen × 4 Spalten“, beim Filtern „3 von 40 Zeilen“ oder den Pfad des ausgewählten Eintrags wie „server.ports[0]“), das Zeilenende und die Kodierung. Zeilenende und Kodierung sind Knöpfe, mit denen du sie änderst. Rechts der Stand des Abgleichs mit deinen anderen Geräten.',
				link: { href: '/help/sync', label: 'Deine Geräte abgleichen' }
			}
		}
	},
	keys: {
		title: 'Tastenkürzel',
		items: {
			note: {
				title: 'Am Mac',
				text: 'Wo Strg steht, drückst du am Mac Cmd. Wiederholen ist dort Cmd+Umschalt+Z, den Block am Cursor einklappen Cmd+Alt+[ und Cmd+Alt+], alles einklappen bleibt Strg+Alt+[ und Strg+Alt+]. Neuer Tab und Schließen nutzen Alt, weil Strg+N und Strg+W dem Browser gehören.'
			},
			files: {
				title: 'Dateien und Tabs',
				text: 'Speichern („Speichern …“ bei einem Text ohne Ort), Speichern unter, Aus Files öffnen, Neu, Schließen',
				keys: [['Strg', 'S'], ['Strg', 'Umschalt', 'S'], ['Strg', 'O'], ['Alt', 'N'], ['Alt', 'W']]
			},
			undo: { title: 'Rückgängig und wiederholen', text: 'Pro Tab', keys: [['Strg', 'Z'], ['Strg', 'Y']] },
			search: {
				title: 'Suchen',
				text: 'Suchen, Ersetzen, Gehe zu Zeile; in der Suchleiste nächster/voriger Treffer',
				keys: [['Strg', 'F'], ['Strg', 'H'], ['Strg', 'G'], ['F3'], ['Umschalt', 'F3']]
			},
			select: {
				title: 'Auswahl',
				text: 'Alles auswählen, nächstes Vorkommen dazunehmen, alle Vorkommen der Auswahl auswählen, zurück zu einem Cursor',
				keys: [['Strg', 'A'], ['Strg', 'D'], ['Strg', 'Umschalt', 'L'], ['Esc']]
			},
			lines: {
				title: 'Zeilen',
				text: 'Nach oben/unten verschieben, nach unten kopieren, löschen, neue Zeile darunter, ohne die aktuelle zu teilen',
				keys: [['Alt', '↑'], ['Alt', '↓'], ['Umschalt', 'Alt', '↓'], ['Strg', 'Umschalt', 'K'], ['Strg', 'Enter']]
			},
			indent: {
				title: 'Einrücken und kommentieren',
				text: 'Weiter/weniger einrücken, Zeilen ein- oder auskommentieren (in Code)',
				keys: [['Tab'], ['Umschalt', 'Tab'], ['Strg', ']'], ['Strg', '['], ['Strg', '/']]
			},
			fold: {
				title: 'Einklappen',
				text: 'Block am Cursor ein- oder ausklappen, alles ein- oder ausklappen',
				keys: [['Strg', 'Umschalt', '['], ['Strg', 'Umschalt', ']'], ['Strg', 'Alt', '['], ['Strg', 'Alt', ']']]
			},
			markdown: {
				title: 'Markdown',
				text: 'Fett, kursiv, Link (nur in Markdown-Dateien)',
				keys: [['Strg', 'B'], ['Strg', 'I'], ['Strg', 'K']]
			},
			table: {
				title: 'Tabelle',
				text: 'Zwischen Zellen wechseln (auch seitenweise), Zelle bearbeiten (oder einfach lostippen), speichern und nach unten oder rechts gehen, neue Zeile in der Zelle, abbrechen, Zelle leeren',
				keys: [['↑'], ['↓'], ['←'], ['→'], ['Bild ↑'], ['Bild ↓'], ['Enter'], ['F2'], ['Tab'], ['Umschalt', 'Enter'], ['Alt', 'Enter'], ['Esc'], ['Entf']]
			},
			tree: {
				title: 'Baum',
				text: 'Zwischen Zeilen wechseln, öffnen/schließen (oder zur Ebene darüber/darunter), Wert bearbeiten, umbenennen, Eintrag verschieben, löschen',
				keys: [['↑'], ['↓'], ['→'], ['←'], ['Leertaste'], ['Enter'], ['F2'], ['Alt', '↑'], ['Alt', '↓'], ['Entf']]
			}
		}
	},
	phones: {
		title: 'Telefone und Tablets',
		items: {
			touch: {
				title: 'Mit dem Finger bedienen',
				text: 'Alles geht ohne Tastatur. Tippe auf den Pfeil neben dem Dateinamen in der oberen Leiste: Sein Menü enthält jede Aktion für die Datei, auch die, die auf breiten Bildschirmen Knöpfe sind (Rückgängig, Suchen, Formatierung), sowie „Neu“ und Öffnen. Halte den Finger auf einem Tab für sein Menü („Andere schließen“, „In Files zeigen“). Tippe in der unteren Leiste auf Zeilenende oder Kodierung, um sie zu ändern. In Tabelle oder Baum wählt ein Tippen aus, ein zweites Tippen auf dieselbe Zelle, denselben Schlüssel oder Wert bearbeitet ihn; langes Drücken (oder der ⋯-Knopf, der Spaltentitel, die Zeilennummer) öffnet das Menü.'
			},
			mobileView: {
				title: 'Lesen und schreiben auf kleinem Bildschirm',
				text: 'Der Zeilenumbruch ist von Anfang an an, nichts scrollt seitlich. In Dateien mit einer Ansicht (Markdown, CSV, JSON …) wechselt der Knopf mit dem Symbol der Ansicht in der oberen Leiste zwischen Text und Vorschau, Tabelle oder Baum, da für beides kein Platz ist. Breite Tabellen scrollen seitlich, die Zeilennummern bleiben stehen. „Ansicht“ macht die Schrift größer, wenn sie schwer zu lesen ist.'
			},
			fromPhone: {
				title: 'Dateien vom Telefon',
				text: '„Vom Rechner öffnen …“ öffnet die Dateiauswahl des Telefons – auch für Dateien aus anderen Apps oder Cloud-Speichern. Um einen Text wieder herauszubekommen, nimm „Herunterladen“, oder behalte ihn im Browserspeicher und lass ihn über den Abgleich deine anderen Geräte erreichen.',
				link: { href: '/help/sync', label: 'Deine Geräte abgleichen' }
			}
		}
	}
};

export default help;
