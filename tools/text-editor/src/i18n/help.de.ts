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
				text: 'Der Name der gezeigten Datei steht in der oberen Leiste. Klicke darauf, um die Datei umzubenennen (nur Dateien mit einem Ort im Browserspeicher). Der Pfeil daneben öffnet das Menü mit allen Aktionen für diese Datei: Speichern, Rückgängig, Suchen, Formatierung (Markdown), „Umbenennen“, „Herunterladen“, „In Files zeigen“, „Neu“, Öffnen und „Schließen“. Die häufigsten stehen auch als Knöpfe neben dem Namen; auf schmalen Bildschirmen nur in diesem Menü.'
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
				text: 'Der Editor öffnet reine Textdateien: .txt, .log, .csv, .tsv, Markdown, JSON, YAML, TOML, INI und andere Einstellungsdateien, HTML, CSS, XML, JavaScript, TypeScript, Svelte, Python und Shell-Skripte. Die Endung des Dateinamens bestimmt, wie der Text eingefärbt wird; die untere Leiste zeigt die Sprache („Nur Text“ ohne). CSV und TSV öffnen sich als reiner Text – als Tabelle zeigt der Editor sie nicht.'
			},
			highlighting: {
				title: 'Syntax-Hervorhebung und Code-Hilfen',
				text: 'In Code- und Datendateien bekommen Schlüsselwörter, Zeichenketten, Zahlen und Kommentare eigene Farben. Klammern und Anführungszeichen schließen sich selbst, die passende Klammer wird markiert, und neue Zeilen behalten die Einrückung. Die Pfeile neben den Zeilennummern klappen einen Block (eine Funktion, einen Abschnitt) ein und wieder aus.'
			},
			preview: {
				title: 'Markdown-Vorschau',
				text: 'Bei Markdown-Dateien (.md, .markdown) zeigt die Vorschau den formatierten Text neben dem Editor und folgt deinem Tippen. Tabellen, Aufgabenlisten und Durchgestrichenes erscheinen ebenfalls. Links öffnen sich in einem neuen Browser-Tab. Aus Sicherheitsgründen führt die Vorschau nichts aus und lädt nichts von außen: Bilder aus dem Web oder neben der Datei erscheinen nicht, nur Bilder, die im Text selbst eingebettet sind. Ein- und ausschalten kannst du sie mit „Markdown-Vorschau“ im Menü „Ansicht“.'
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
				title: 'Vorschau daneben',
				text: 'Auf breiten Bildschirmen steht die Markdown-Vorschau rechts neben dem Text; „Markdown-Vorschau“ im Menü „Ansicht“ schaltet sie ein und aus – das bleibt fürs nächste Mal gespeichert. Auf schmalen Bildschirmen ist für beides kein Platz: Der Vorschau-Knopf in der oberen Leiste wechselt zwischen Text und Vorschau.'
			},
			statusBar: {
				title: 'Untere Leiste',
				text: 'Links in der unteren Leiste: der Speicherstand, die Cursorposition (Zeile und Spalte), wie viele Zeichen ausgewählt sind, die Sprache, das Zeilenende und die Kodierung. Zeilenende und Kodierung sind Knöpfe, mit denen du sie änderst. Rechts der Stand des Abgleichs mit deinen anderen Geräten.',
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
			}
		}
	},
	phones: {
		title: 'Telefone und Tablets',
		items: {
			touch: {
				title: 'Mit dem Finger bedienen',
				text: 'Alles geht ohne Tastatur. Tippe auf den Pfeil neben dem Dateinamen in der oberen Leiste: Sein Menü enthält jede Aktion für die Datei, auch die, die auf breiten Bildschirmen Knöpfe sind (Rückgängig, Suchen, Formatierung), sowie „Neu“ und Öffnen. Halte den Finger auf einem Tab für sein Menü („Andere schließen“, „In Files zeigen“). Tippe in der unteren Leiste auf Zeilenende oder Kodierung, um sie zu ändern.'
			},
			mobileView: {
				title: 'Lesen und schreiben auf kleinem Bildschirm',
				text: 'Der Zeilenumbruch ist von Anfang an an, nichts scrollt seitlich. In Markdown-Dateien wechselt der Vorschau-Knopf in der oberen Leiste zwischen Text und Vorschau, da für beides kein Platz ist. „Ansicht“ macht die Schrift größer, wenn sie schwer zu lesen ist.'
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
