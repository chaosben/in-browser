import type enHelp from './help.en.js';

const help: typeof enHelp = {
	start: {
		title: 'Erste Schritte',
		items: {
			startPage: {
				title: 'Startseite',
				text: 'Der Texteditor beginnt mit seiner Startseite: „Neu“ beginnt einen leeren Text, „Aus Dateien öffnen …“ wählt eine Datei aus dem Browserspeicher, den alle Tools von in-browser teilen, „Vom Rechner öffnen …“ liest eine Datei von deinem Rechner. Darunter zeigt „Zuletzt geöffnet“ die letzten zehn Dateien als Karten mit letzter Änderung und Ordner – ein Klick öffnet eine davon wieder (Dateien, die es nicht mehr gibt, fallen aus der Liste), ein Mittelklick oder „In neuem Tab öffnen“ deines Browsers öffnet sie in einem neuen Browser-Tab. Das Menü einer Karte – Rechtsklick, ihr ⋯-Knopf oder auf Touchscreens langes Drücken – bietet „Öffnen“, „In Dateien zeigen“ und „Aus Liste entfernen“; Entfernen nimmt sie nur von der Liste, die Datei bleibt. Du kannst auch eine Textdatei von deinem Rechner auf die Seite ziehen. Textdateien, die du in Dateien öffnest („Mit Texteditor öffnen“), landen ebenfalls hier.'
			},
			onePage: {
				title: 'Eine Datei pro Seite',
				text: 'Der Editor zeigt eine Datei auf einmal, mit einer eigenen Adresse im Browser – du kannst sie als Lesezeichen ablegen oder die Seite neu laden. „Neu“ oder „Öffnen“ in der Registerkarte „Datei“ ersetzen die gezeigte Datei im selben Browser-Tab; sie wird vorher gespeichert. Willst du mehrere Dateien nebeneinander sehen, öffne jede in einem eigenen Browser-Tab oder Fenster (z. B. mit einem Mittelklick auf eine Karte der Startseite). Eine Datei lässt sich immer nur in einem Browser-Tab bearbeiten: Öffnest du sie in einem zweiten, steht dort „Diese Datei ist schon in einem anderen Tab oder Fenster geöffnet.“ – geh zurück zum ersten oder schließ sie dort.',
				tip: 'Willst du zwei Dateien vergleichen oder zwischen ihnen kopieren? Öffne die zweite in einem neuen Browser-Tab und stell die beiden Fenster nebeneinander.'
			},
			fileMenu: {
				title: 'Die Registerkarte „Datei“',
				text: 'Die obere Leiste zeigt nur, wo du bist: Der Name der gezeigten Datei steht nach „Texteditor“. Was du mit der Datei selbst tust, steht in der ersten Registerkarte des Menübands, „Datei“: die Gruppe „Neu“ mit „Neu“ und „Öffnen“ („Aus Dateien öffnen …“, „Vom Rechner öffnen …“), die Gruppe „Datei“ mit „Speichern“, „Speichern unter …“, „Herunterladen“, „In Dateien zeigen“ und „Schließen“. Was für diese Datei nicht geht, ist ausgegraut – einen Text ohne Ort kannst du noch nicht in Dateien zeigen. Der Editor öffnet mit der Registerkarte „Start“, in der du am Text arbeitest. Eine Datei heißt wie ihre Datei im Browserspeicher; umbenennen kannst du sie in Dateien.'
			},
			ribbon: {
				title: 'Das Menüband',
				text: 'Unter der oberen Leiste liegt das Menüband: links „Rückgängig“ und „Wiederholen“, dann die Registerkarten „Datei“ (neu, öffnen, speichern, herunterladen, schließen), „Start“ (Zwischenablage; „Suchen“, dessen Pfeil „Ersetzen“ und „Gehe zu Zeile“ anbietet; Zeilen bearbeiten), „Format“ (Markdown-Formatierung) und „Ansicht“ (Layout, Zeilenumbruch, Schriftgröße). Farbig abgesetzte Registerkarten kommen mit der Ansicht neben dem Text: „Tabelle“, solange eine Tabelle zu sehen ist, „Baum“, solange ein Baum zu sehen ist. Jede Registerkarte zeigt ihre Befehle in Gruppen mit ihren Namen darunter; was gerade nicht geht, ist ausgegraut, damit nichts verrutscht. Wird das Fenster schmaler, werden zuerst die Gruppen rechts kleiner, und zuletzt wird eine ganze Gruppe zu einem Knopf, der sie öffnet. Der Knopf am rechten Ende der Registerkarten wählt, wie das Menüband erscheint; ein Doppelklick auf eine Registerkarte wechselt zu „Nur Registerkarten“ und zurück.',
				options: {
					classic: { label: 'Klassisch (Standard)', text: 'Große Knöpfe in Gruppen mit ihren Namen. Am leichtesten zu finden, braucht etwa 120 Pixel Höhe.' },
					simplified: { label: 'Vereinfacht', text: 'Eine kompakte Zeile Knöpfe, ohne Gruppennamen. Lässt mehr Platz für den Text.' },
					tabs: { label: 'Nur Registerkarten', text: 'Nur die Registerkarten; ein Klick auf eine öffnet ihre Befehle über dem Text, bis du einen wählst. Der meiste Platz für den Text.' }
				},
				tip: 'Fang mit „Klassisch“ an, bis du weißt, wo alles ist, und wechsle dann zu „Vereinfacht“ oder „Nur Registerkarten“, um mehr vom Text zu sehen.',
				keys: [['Strg', 'F1']]
			},
			accessKeys: {
				title: 'Zugriffstasten',
				text: 'Drück Alt und lass sie los (oder drück F10): Auf den Registerkarten erscheinen Buchstaben, auf „Rückgängig“ und „Wiederholen“ Zahlen. Tippe den Buchstaben einer Registerkarte, dann den Buchstaben auf einem Befehl, um ihn auszuführen – alles geht ohne Maus. Esc geht einen Schritt zurück.',
				keys: [['Alt'], ['F10']]
			},
			restore: {
				title: 'Ungespeicherte Änderungen und neue Texte',
				text: 'Was du tippst, bleibt als Entwurf in diesem Browser, bis es gespeichert ist – schließt du den Browser-Tab, geht nichts verloren. Eine Datei mit Ort bekommt ihre Änderungen zurück, wenn du sie das nächste Mal öffnest. Ein neuer Text („Neu“ oder eine Datei vom Rechner) hat eine eigene Adresse mit einer Entwurfsnummer; lädst du die Seite neu oder kommst du über den Verlauf deines Browsers zu dieser Adresse zurück, ist er wieder so da, wie du ihn verlassen hast. Entwürfe liegen privat in diesem Browser: Sie erscheinen nicht in Dateien und werden nicht synchronisiert. Eine Datei, die inzwischen gelöscht wurde, kommt mit ihren Änderungen und dem Balken „wurde gelöscht oder verschoben“ zurück.',
				tip: 'Das ist ein Sicherheitsnetz, kein Ort zum Aufbewahren. Speichere Texte, die du behalten willst („Speichern …“), damit sie echte Dateien sind, die du in Dateien findest und die deine anderen Geräte erreichen.'
			},
			install: {
				title: 'Installieren, offline und Browser',
				text: 'Bietet dein Browser es an, installierst du den Texteditor wie ein Programm; er startet dann auch ohne Internetverbindung. Die Syntax-Hervorhebung einer Sprache wird geladen, wenn du zum ersten Mal eine solche Datei öffnest – offline erscheint eine Datei einer noch nie genutzten Sprache ohne Farben, bis du wieder online bist.',
				link: { href: '/help/install', label: 'Installieren, offline und unterstützte Browser' }
			}
		}
	},
	files: {
		title: 'Öffnen und speichern',
		items: {
			open: {
				title: 'Dateien öffnen',
				text: '„Öffnen“ in der Registerkarte „Datei“ hat zwei Wege: „Aus Dateien öffnen …“ wählt eine Datei im Browserspeicher – sie öffnet sich mit ihrem Ort, jede Änderung wird also dort gespeichert. „Vom Rechner öffnen …“ (oder eine Datei auf die Seite ziehen) liest eine Kopie der Datei: Sie öffnet sich als neuer Text ohne Ort, und nichts wird geschrieben, bis du sie speicherst. Es öffnet sich eine Datei auf einmal: Von mehreren gezogenen Dateien öffnet sich nur die erste, gezogene Ordner werden übersprungen. Die Datei ersetzt die gezeigte in diesem Browser-Tab (die vorher gespeichert wird). Dateien über 20 MB und Dateien, die kein Text sind (Bilder, Programme), öffnen sich nicht.',
				tip: 'Willst du eine Datei von deinem Rechner hier weiter bearbeiten, auch auf anderen Geräten? Öffne sie vom Rechner und speichere sie einmal mit „Speichern“ – ab dann speichert sie sich selbst. Brauchst du nur eine schnelle Änderung, bearbeite sie und nimm „Herunterladen“.'
			},
			autosave: {
				title: 'Automatisch speichern',
				text: 'Eine Datei mit einem Ort im Browserspeicher speichert sich etwa eine Sekunde, nachdem du aufhörst zu tippen, und sofort, wenn du eine andere Datei öffnest, sie schließt oder die Seite verlässt. Das Symbol links in der unteren Leiste zeigt den Stand: gespeichert, wird gespeichert, noch nicht gespeichert – fahr mit der Maus darüber für den Text. Beim Speichern bleiben Kodierung und Zeilenende der Datei erhalten, eine unveränderte Datei bleibt also genau so, wie sie war. Nichts wird hochgeladen.',
				link: { href: '/help/storage', label: 'Wo deine Dateien liegen' }
			},
			connected: {
				title: 'Texte in einem verbundenen Ordner',
				text: 'Die Auswahl vor dem Ordnerpfad im Öffnen- und Speichern-Dialog wechselt zwischen Meine Dateien und den Ordnern, die du in Dateien verbunden hast („Verbunden“). Ein Text aus einem verbundenen Ordner öffnet und speichert sich direkt dort auf deinem Rechner, auch automatisch. Erlaubt der Browser den Zugriff nicht mehr (meist nach einem Neustart), zeigt das Speichern-Symbol in der unteren Leiste einen Fehler, und eine Meldung bietet „Zugriff erlauben“ an; deine Änderungen bleiben bis dahin erhalten und werden gespeichert, sobald du es erlaubst. Beim Öffnen oder Neuladen einer solchen Datei kommt dieselbe Meldung, und der Editor versucht es erneut, sobald du den Zugriff erlaubst. Dasselbe gilt für Ordner mit einer Wolke (live von deinen anderen Geräten) und Ordner, die jemand für dich freigegeben hat.',
				link: { href: '/help/connected', label: 'Verbundene Ordner' }
			},
			saveNew: {
				title: 'Einen neuen Text speichern',
				text: '„Unbenannt“-Texte und Dateien vom Rechner haben noch keinen Ort: „Speichern“ in der Registerkarte „Datei“ (oder Strg+S) fragt nach Ordner und Namen im Browserspeicher. Der Dialog startet im zuletzt benutzten Ordner (gibt es ihn nicht mehr, im nächsten darüber). Eine Meldung nennt dann die Datei und bietet „In Dateien zeigen“ an. Danach speichert sich die Datei selbst wie jede andere, und die Adresse der Seite wird ihre. Die Endung des Namens bestimmt die Hervorhebung – „notizen.md“ wird Markdown.'
			},
			saveAs: {
				title: 'Speichern unter',
				text: '„Speichern unter …“ in der Registerkarte „Datei“ schreibt den Text unter einem neuen Namen oder in einen anderen Ordner – der Editor arbeitet dann mit der neuen Datei weiter, die alte bleibt, wie sie war. Wählst du eine bestehende Datei, wird sie ersetzt. Die Meldung danach bietet „In Dateien zeigen“ an.'
			},
			rename: {
				title: 'Herunterladen, in Dateien zeigen, umbenennen',
				text: '„Herunterladen“ in der Registerkarte „Datei“ legt eine Kopie im Download-Ordner deines Rechners ab, in der aktuellen Kodierung und mit dem aktuellen Zeilenende – auch für Texte, die noch keinen Ort haben. „In Dateien zeigen“ öffnet Dateien in einem neuen Browser-Tab, im Ordner der Datei – dort benennst oder verschiebst du sie; der Texteditor benennt keine Dateien um.'
			},
			close: {
				title: 'Schließen',
				text: '„Schließen“ in der Registerkarte „Datei“ (Alt+W) führt zurück zur Startseite; die Datei wird vorher gespeichert. Nur wenn das nicht geht – der Text hat noch keinen Ort, oder das Speichern pausiert –, wirst du gefragt: „Änderungen verwerfen?“; „Verwerfen“ wirft die Änderungen weg, „Abbrechen“ lässt die Datei offen. „Neu“ und „Öffnen“ fragen genauso, bevor sie einen solchen Text ersetzen. Verlässt du die Seite anders (Browser-Tab schließen, Zurück-Knopf des Browsers), bleiben die Änderungen als Entwurf erhalten.'
			},
			conflicts: {
				title: 'Woanders geändert',
				text: 'Dieselbe Datei kann sich in einem anderen Browser-Tab oder durch das Synchronisieren mit deinen anderen Geräten ändern. Hast du keine ungespeicherten Änderungen, fragt der Editor, ob er die Datei neu laden soll („Neu laden“ / „Nicht neu laden“, auf Wunsch ohne weitere Frage, solange sie offen ist). Hast du welche, meldet ein gelber Balken, dass die Datei „woanders geändert“ wurde, und das automatische Speichern pausiert: „Neu laden“ übernimmt die andere Version und verwirft deine, „Meine Version behalten“ speichert deine darüber. Wurde die Datei gelöscht oder verschoben, sagt es der Balken, und das nächste Speichern legt sie wieder an. Speicherst du von Hand (Strg+S) über eine neuere Version, fragt der Editor vorher „Neuere Version ersetzen?“.',
				tip: 'Unsicher, welche Version stimmt? Kopiere deinen Text (Strg+A, Strg+C) vor „Neu laden“, dann kannst du Teile davon wieder einfügen.',
				link: { href: '/help/sync', label: 'Deine Geräte synchronisieren' }
			}
		}
	},
	formats: {
		title: 'Formate',
		items: {
			types: {
				title: 'Dateitypen',
				text: 'Der Editor öffnet reine Textdateien: .txt, .log, .csv, .tsv, Markdown, JSON, JSON Lines (.jsonl, .ndjson), YAML, TOML, INI und andere Einstellungsdateien, HTML, CSS, XML, JavaScript, TypeScript, Svelte, Python und Shell-Skripte. Die Endung des Dateinamens bestimmt, wie der Text eingefärbt wird und welche Ansicht er neben dem Text bekommt: eine Tabelle, einen Baum oder eine Vorschau (siehe unten); die untere Leiste zeigt die Sprache („Nur Text“ ohne). SVG-Bilder öffnen sich in Dateien als Bild – wähle „Mit Texteditor öffnen“ im Menü der Datei, um ihren Text hier zu bearbeiten, mit dem Bild daneben. Einstellungsdateien namens .env (auch .env.local …) sind in Dateien versteckt; öffne sie mit „Vom Rechner öffnen …“.'
			},
			table: {
				title: 'Tabelle (CSV, TSV, JSON Lines)',
				text: 'CSV- und TSV-Dateien erscheinen als Tabelle neben dem Text, JSON-Lines-Dateien (ein JSON-Objekt pro Zeile) ebenso – ihre Spalten sind die Schlüssel der Objekte. Solange eine Tabelle zu sehen ist, hat das Menüband die Registerkarte „Tabelle“. Klicke eine Zelle an, um sie zur aktuellen zu machen; doppelklicke sie (oder drücke Enter, F2 oder tippe einfach los), um sie zu ändern; Enter speichert und geht nach unten, Tab nach rechts, Esc bricht ab. Eine Zelle darf mehrere Zeilen haben: Umschalt+Enter oder Alt+Enter beginnt eine neue (auf Touchscreens Enter, und ✓ unter dem Feld speichert); in der Tabelle stehen ihre Zeilen mit ⏎ verbunden. Zeilen wählst du aus wie Einträge in Dateien: Ein Klick auf eine Zelle oder Zeilennummer wählt ihre Zeile, Strg+Klick nimmt eine Zeile dazu oder heraus, Umschalt+Klick (oder Umschalt+↑/↓) wählt die Zeilen dazwischen, Strg+A alle gezeigten; ausgewählte Zeilen sind eingefärbt. Die Registerkarte „Tabelle“ wirkt auf die ausgewählten Zeilen, sonst auf die aktuelle Zelle: „Zelle“ – „Zelle bearbeiten“, „Zellen leeren“ (die Zellen der aktuellen Spalte in den ausgewählten Zeilen, auch Entf); „Zeilen“ – „Zeile oberhalb einfügen“, „Zeile unterhalb einfügen“, „Nach oben verschieben“, „Nach unten verschieben“ (auch Alt+↑/↓), „Zeilen löschen“; „Spalten“ – „Spalte links einfügen“, „Spalte rechts einfügen“, „Spalte umbenennen“, „Nach links verschieben“, „Nach rechts verschieben“, „Spalte löschen“ für die Spalte der aktuellen Zelle; „Sortieren & Filtern“ – „Aufsteigend sortieren“ und „Absteigend sortieren“ bringen die Zeilen in der Datei in diese Reihenfolge (Zahlen nach ihrem Wert, auch mit Dezimalkomma, Text alphabetisch mit „2“ vor „10“, leere Zellen zuletzt; die Spaltennamen bleiben oben), „Filtern …“ blendet nur Zeilen aus: Ein Feld über der Tabelle behält die Zeilen, deren Zelle den Text enthält (Groß- und Kleinschreibung egal); sein × oder Esc im Feld entfernt ihn, „Alle Filter entfernen“ alle, und die untere Leiste zeigt „3 von 40 Zeilen“; „Auswahl“ – „Alles auswählen“, „Auswahl aufheben“. Jeder Befehl ist ein Schritt für „Rückgängig“, auch für viele Zeilen auf einmal; eine neue Spalte und der Name, den du für sie tippst, sind ebenfalls ein Schritt. Der Spaltentitel öffnet das Menü seiner Spalte; ein Rechtsklick auf eine Zelle oder Zeilennummer (auf Touchscreens langes Drücken) öffnet das Menü mit den Befehlen für die Zelle, ihre Zeilen und ihre Spalte. Esc beendet eine Auswahl mehrerer Zeilen; ein weiteres Esc setzt den Cursor in den Text.',
				options: {
					header: { label: 'Erste Zeile als Spaltennamen (Standard)', text: 'In der Gruppe „Optionen“ der Registerkarte „Tabelle“: Die erste Zeile einer CSV-Datei ist der Titel jeder Spalte. Ausgeschaltet heißen die Spalten A, B, C … und die erste Zeile ist eine Datenzeile wie alle anderen.' },
					delimiter: { label: 'Trennzeichen', text: 'Ebenfalls in „Optionen“: „Automatisch erkennen“ (Standard) liest die ersten Zeilen und wählt Komma, Semikolon, Tabulator oder senkrechten Strich; wähle selbst eins, wenn die Tabelle falsch aussieht. TSV-Dateien nutzen immer den Tabulator. Das ändert nur, wie die Datei gelesen wird, nicht die Datei.' }
				},
				tip: 'Nur eine Spalte, wo du mehrere erwartest? Wähle das Trennzeichen in „Optionen“ der Registerkarte „Tabelle“ – deutsches Excel schreibt zum Beispiel Semikolons. Zeilen einer JSON-Lines-Datei, die keine Objekte sind, stehen kursiv da und lassen sich nur im Text ändern.'
			},
			tree: {
				title: 'Baum (JSON, YAML, TOML, INI, XML …)',
				text: 'JSON-, YAML-, TOML-, XML-, INI- und .properties-Dateien sowie .env-Dateien erscheinen als Baum neben dem Text (JSON Lines und SVG lassen sich mit „Ansichtsart“ in der Registerkarte „Ansicht“ auf einen umschalten). Solange ein Baum zu sehen ist, hat das Menüband die Registerkarte „Baum“. Die Pfeile öffnen und schließen eine Ebene; die erste Ebene ist anfangs offen. Klicke eine Zeile an, um sie zur aktuellen zu machen; Strg+Klick, Umschalt+Klick (oder Umschalt+↑/↓) und Strg+A wählen mehrere aus, wie in Dateien. Doppelklicke einen Wert (oder drücke Enter), um ihn zu ändern, doppelklicke einen Schlüssel oder Namen (oder drücke F2), um ihn umzubenennen; Enter speichert, Esc bricht ab, Umschalt+Enter oder Alt+Enter beginnt in einem Wert eine neue Zeile (auf Touchscreens Enter, und ✓ speichert). Textwerte bleiben Text; in anderen Werten werden Zahlen, true/false und null als solche erkannt. Die Registerkarte „Baum“: „Bearbeiten“ – „Wert bearbeiten“, „Umbenennen“, „Duplizieren“, „Löschen“ (auch Entf); „Einfügen“ – einen Eintrag, Listeneintrag, ein Element, Attribut oder einen Text im aktuellen Knoten, „Davor einfügen“, „Danach einfügen“ und in INI-Dateien „Abschnitt hinzufügen“; „Anordnen“ – „Nach oben verschieben“, „Nach unten verschieben“ (auch Alt+↑/↓) und „Typ“ (Text, Zahl, Ja/Nein, Leer, Objekt, Liste); „Anzeigen“ – „Alle öffnen“, „Alle schließen“ und „Filtern …“, das Zeilen zeigt, deren Schlüssel oder Wert den Text enthält, mit den Ebenen darüber (Esc im Feld schließt es); „Auswahl“ – „Alles auswählen“, „Auswahl aufheben“. Duplizieren, Löschen, Verschieben und den Typ ändern wirkt auf alle ausgewählten Knoten als ein Rückgängig-Schritt; ein neuer Knoten und der Name, den du für ihn tippst, sind ebenfalls ein Schritt. Der ⋯-Knopf einer Zeile (oder ein Rechtsklick, auf Touchscreens langes Drücken) öffnet ihr Menü mit denselben Befehlen. Esc beendet eine Auswahl mehrerer Knoten; ein weiteres Esc setzt den Cursor in den Text.',
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
				text: '„Rückgängig“ und „Wiederholen“ sind die Pfeile links im Menüband (auf Telefonen am Anfang seiner Leiste). Der Verlauf geht verloren, wenn du eine andere Datei öffnest oder die Seite neu lädst.',
				keys: [['Strg', 'Z'], ['Strg', 'Umschalt', 'Z'], ['Strg', 'Y']]
			},
			clipboard: {
				title: 'Zwischenablage',
				text: '„Einfügen“, „Ausschneiden“ und „Kopieren“ in der Registerkarte „Start“ tun, was die Tasten tun – praktisch auf Touchscreens. „Ausschneiden“ und „Kopieren“ brauchen ausgewählten Text. Der Browser fragt eventuell einmal, ob die Seite die Zwischenablage lesen darf; ohne diese Erlaubnis zeigt „Einfügen“ eine Meldung, und die Tasten funktionieren weiter.',
				keys: [['Strg', 'V'], ['Strg', 'X'], ['Strg', 'C']]
			},
			formatting: {
				title: 'Markdown-Formatierung',
				text: 'Die Registerkarte „Format“ des Menübands formatiert Markdown-Dateien; in anderen Dateien sind ihre Befehle ausgegraut. Die Gruppe „Text“ – „Fett“, „Kursiv“, „Code im Text“ und „Link“ – wirkt auf die Auswahl: Fett, kursiv und Code setzen die Zeichen darum herum oder entfernen sie, wenn sie schon da sind. „Link“ macht den ausgewählten Text zu einem Link und setzt den Cursor dorthin, wo die Adresse hinkommt; eine ausgewählte Webadresse wird zur Adresse des Links.',
				keys: [['Strg', 'B'], ['Strg', 'I'], ['Strg', 'K']]
			},
			paragraph: {
				title: 'Absätze und Listen',
				text: 'Die Gruppen „Absatz“ („Überschrift 1“ bis „Überschrift 3“, „Zitat“, „Code-Block“) und „Listen“ („Aufzählung“, „Nummerierte Liste“, „Aufgabe“ – ein Punkt mit Kästchen) der Registerkarte „Format“ ändern ganze Zeilen. Sie wirken auf jede Zeile der Auswahl – leere Zeilen bleiben, wie sie sind, nummerierte Listen werden durchgezählt. Haben alle Zeilen dieses Format schon, wird es entfernt; eine andere Überschriftenebene oder Listenart wird ersetzt. „Code-Block“ setzt Zäune um die ausgewählten Zeilen.'
			},
			lines: {
				title: 'Mit Zeilen arbeiten',
				text: 'Die Gruppe „Bearbeiten“ der Registerkarte „Start“: „Zeile nach oben“ und „Zeile nach unten“ verschieben die aktuelle Zeile (oder alle ausgewählten), „Einrücken“ und „Ausrücken“ ändern ihre Einrückung, „Kommentar“ kommentiert sie in Code aus und wieder ein, „Alles auswählen“ wählt den ganzen Text aus. Mit der Tastatur kopierst du eine Zeile auch darüber oder darunter oder löschst sie; Tab und Umschalt+Tab rücken ebenfalls ein und aus.',
				keys: [['Alt', '↑'], ['Alt', '↓'], ['Strg', ']'], ['Strg', '['], ['Strg', '/'], ['Umschalt', 'Alt', '↓'], ['Strg', 'Umschalt', 'K'], ['Tab'], ['Umschalt', 'Tab']]
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
				text: '„Suchen“ in der Registerkarte „Start“ öffnet eine Leiste über dem Text. Jeder Treffer wird markiert; Enter oder „Weiter“ springt zum nächsten, Umschalt+Enter oder „Zurück“ zum vorigen, „Alle“ wählt alle Treffer aus, sodass du sie gemeinsam bearbeitest. Die Optionen: „Groß-/Kleinschreibung“ unterscheidet große und kleine Buchstaben, „Ganzes Wort“ findet nur ganze Wörter, „Regulärer Ausdruck“ nimmt die Suche als regulären Ausdruck. Esc schließt die Leiste. Wählst du ein Wort aus, werden seine anderen Vorkommen auch ohne Leiste markiert. Der Pfeil neben „Suchen“ bietet „Ersetzen“ und „Gehe zu Zeile“.',
				keys: [['Strg', 'F'], ['Enter'], ['Umschalt', 'Enter'], ['F3'], ['Esc']]
			},
			replace: {
				title: 'Ersetzen',
				text: '„Ersetzen“ (unter dem Pfeil neben „Suchen“) öffnet dieselbe Leiste mit dem Cursor im Ersetzen-Feld. „Ersetzen“ ersetzt den aktuellen Treffer und geht weiter, „Alle ersetzen“ ersetzt alle Treffer auf einmal – das machst du in einem Schritt rückgängig. Mit „Regulärer Ausdruck“ fügen $1, $2 … im Ersatz die eingeklammerten Teile des Treffers ein.',
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
				text: '„Zeilenumbruch“ in der Registerkarte „Ansicht“ (Gruppe „Text“) bricht lange Zeilen am Fensterrand um, statt seitlich zu scrollen. Das ändert nur die Anzeige, nicht die Datei. Auf Telefonen und in schmalen Fenstern ist er von Anfang an an und gilt für alle Dateien.',
				tip: 'Schalte ihn für Fließtext und Markdown ein, wo ein Absatz eine lange Zeile ist. Schalte ihn für Code und Tabellen aus, wo die Zeilenstruktur zählt.'
			},
			fontSize: {
				title: 'Schriftgröße',
				text: '„Schrift größer“ und „Schrift kleiner“ in der Registerkarte „Ansicht“ ändern die Größe des Texts im Editor schrittweise; „Standard-Schriftgröße“ stellt sie zurück. Die Einstellung gilt für alle Dateien und bleibt in diesem Browser gespeichert.'
			},
			preview: {
				title: 'Text, Ansicht oder beides',
				text: 'Bei Dateien mit Tabelle, Baum oder Vorschau wählst du in der Gruppe „Layout“ der Registerkarte „Ansicht“, was zu sehen ist – das bleibt fürs nächste Mal und für alle Dateien gespeichert; bei anderen Dateien sind diese Knöpfe ausgegraut. Hat ein Dateityp mehrere Ansichten (JSON Lines: Tabelle oder Baum, SVG: Bild oder Baum), wählt „Ansichtsart“ eine davon.',
				options: {
					text: { label: 'Nur Text', text: 'Nur der Text, wie bei jeder anderen Datei.' },
					split: { label: 'Nebeneinander (Standard)', text: 'Links der Text, rechts die Ansicht. Ziehe die Linie dazwischen (oder wähle sie aus und nutze die Pfeiltasten), um die Breite anders zu teilen; ein Doppelklick teilt sie halb und halb.' },
					view: { label: 'Nur Ansicht', text: 'Die ganze Breite für Tabelle oder Baum – gut für breite Tabellen. Der Text bleibt im Hintergrund offen; Rückgängig funktioniert wie gewohnt.' }
				},
				tip: 'Arbeitest du vor allem mit Tabelle oder Baum? Wähle „Nur Ansicht“ und geh zurück zu „Nebeneinander“, wenn du den Text brauchst. Auf schmalen Bildschirmen ist für beides kein Platz: „Nebeneinander“ ist ausgegraut, und du wechselst zwischen „Nur Text“ und „Nur Ansicht“.'
			},
			statusBar: {
				title: 'Untere Leiste',
				text: 'Links in der unteren Leiste: der Speicherstand, die Cursorposition (Zeile und Spalte), wie viele Zeichen ausgewählt sind, die Sprache, was die Ansicht zeigt („12 Zeilen × 4 Spalten“, beim Filtern „3 von 40 Zeilen“ oder den Pfad des ausgewählten Eintrags wie „server.ports[0]“), das Zeilenende und die Kodierung. Zeilenende und Kodierung sind Knöpfe, mit denen du sie änderst. Rechts der Sync-Status mit deinen anderen Geräten.',
				link: { href: '/help/sync', label: 'Deine Geräte synchronisieren' }
			}
		}
	},
	keys: {
		title: 'Tastenkürzel',
		items: {
			note: {
				title: 'Am Mac',
				text: 'Wo Strg steht, drückst du am Mac Cmd. Wiederholen ist dort Cmd+Umschalt+Z, den Block am Cursor einklappen Cmd+Alt+[ und Cmd+Alt+], alles einklappen bleibt Strg+Alt+[ und Strg+Alt+]. Neu und Schließen nutzen Alt, weil Strg+N und Strg+W dem Browser gehören.'
			},
			files: {
				title: 'Dateien',
				text: 'Speichern (fragt bei einem Text ohne Ort nach dem Ort), Speichern unter, Aus Dateien öffnen, Neu, Schließen – auch während du tippst',
				keys: [['Strg', 'S'], ['Strg', 'Umschalt', 'S'], ['Strg', 'O'], ['Alt', 'N'], ['Alt', 'W']]
			},
			undo: { title: 'Rückgängig und wiederholen', text: 'Im Text und seiner Ansicht', keys: [['Strg', 'Z'], ['Strg', 'Umschalt', 'Z'], ['Strg', 'Y']] },
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
				text: 'Zwischen Zellen wechseln (auch seitenweise), Zeilen auswählen (Umschalt mit den Pfeilen), alle Zeilen auswählen, Zelle bearbeiten (oder einfach lostippen), speichern und nach unten oder rechts gehen, neue Zeile in der Zelle, abbrechen oder Auswahl beenden, Zellen leeren, Zeilen verschieben',
				keys: [['↑'], ['↓'], ['←'], ['→'], ['Bild ↑'], ['Bild ↓'], ['Umschalt', '↑'], ['Umschalt', '↓'], ['Strg', 'A'], ['Enter'], ['F2'], ['Tab'], ['Umschalt', 'Enter'], ['Alt', 'Enter'], ['Esc'], ['Entf'], ['Alt', '↑'], ['Alt', '↓']]
			},
			tree: {
				title: 'Baum',
				text: 'Zwischen Zeilen wechseln, auswählen (Umschalt mit den Pfeilen), alle auswählen, öffnen/schließen (oder zur Ebene darüber/darunter), Wert bearbeiten, umbenennen, Einträge verschieben, löschen, Auswahl beenden',
				keys: [['↑'], ['↓'], ['Umschalt', '↑'], ['Umschalt', '↓'], ['Strg', 'A'], ['→'], ['←'], ['Leertaste'], ['Enter'], ['F2'], ['Alt', '↑'], ['Alt', '↓'], ['Entf'], ['Esc']]
			},
			ribbon: {
				title: 'Menüband',
				text: 'Nur Registerkarten und zurück, Zugriffstasten',
				keys: [['Strg', 'F1'], ['Alt'], ['F10']]
			}
		}
	},
	phones: {
		title: 'Telefone und Tablets',
		items: {
			touch: {
				title: 'Mit dem Finger bedienen',
				text: 'Alles geht ohne Tastatur. Auf dem Telefon ist das Menüband eine Leiste unter der oberen Leiste: Der Knopf links wählt die Registerkarte („Datei“, „Start“, „Format“, „Ansicht“ und „Tabelle“ oder „Baum“, solange eine solche Ansicht zu sehen ist), die Befehle daneben sind Symbole und scrollen seitlich – halte eins gedrückt, um seinen Namen zu sehen. Neu, Öffnen, Speichern und Schließen stehen in der Registerkarte „Datei“; der gezeigte Tab hat einen ⋯-Knopf mit dem Menü der Datei und „Andere schließen“. In Tabelle oder Baum wählt ein Tippen aus, ein zweites Tippen auf dieselbe Zelle, denselben Schlüssel oder Wert bearbeitet ihn. Langes Drücken öffnet das Menü und startet den Auswahlmodus: Kästchen erscheinen (in den Zeilennummern einer Tabelle, am Anfang der Zeilen eines Baums), Tippen wählt aus und ab, und die Befehle der Registerkarte „Tabelle“ oder „Baum“ wirken auf das Ausgewählte; „Auswahl aufheben“ dort beendet ihn. Ein Tippen auf eine Zeilennummer öffnet das Menü ihrer Zeile, der ⋯-Knopf einer Baumzeile ihr Menü. Tippe in der unteren Leiste auf Zeilenende oder Kodierung, um sie zu ändern.'
			},
			mobileView: {
				title: 'Lesen und schreiben auf kleinem Bildschirm',
				text: 'Der Zeilenumbruch ist von Anfang an an, nichts scrollt seitlich. In Dateien mit einer Ansicht (Markdown, CSV, JSON …) ist für beides kein Platz: „Nur Text“ und „Nur Ansicht“ in der Registerkarte „Ansicht“ wechseln zwischen dem Text und der Vorschau, Tabelle oder dem Baum. Breite Tabellen scrollen seitlich, die Zeilennummern bleiben stehen. „Schrift größer“ in „Ansicht“ hilft, wenn der Text schwer zu lesen ist.'
			},
			fromPhone: {
				title: 'Dateien vom Telefon',
				text: '„Vom Rechner öffnen …“ öffnet die Dateiauswahl des Telefons – auch für Dateien aus anderen Apps oder Cloud-Speichern. Um einen Text wieder herauszubekommen, nimm „Herunterladen“, oder behalte ihn im Browserspeicher und lass ihn über das Synchronisieren deine anderen Geräte erreichen.',
				link: { href: '/help/sync', label: 'Deine Geräte synchronisieren' }
			}
		}
	}
};

export default help;
