import type help from './help.en.js';

const de: typeof help = {
	start: {
		title: 'Erste Schritte',
		items: {
			startPage: {
				title: 'Startseite',
				text: 'Die Startseite zeigt die PDFs, die du zuletzt geöffnet hast, die neueste zuerst, mit Ordner und letzter Änderung. Klicke eine an, um sie zu öffnen; das Menü daneben (drei Punkte, Rechtsklick oder langes Drücken) hat „Öffnen“ und „Aus der Liste entfernen“ – das vergisst sie nur hier, die Datei bleibt. Eine PDF, die es nicht mehr gibt, fällt von selbst aus der Liste.'
			},
			open: {
				title: 'Eine PDF öffnen',
				text: '„PDF öffnen …“ wählt eine PDF aus deinen Dateien. Auch ein Doppelklick auf eine PDF in Dateien öffnet sie hier; „Öffnen mit …“ in Dateien bietet weiterhin Notizen an, das daraus ein neues Notizbuch macht. „Vom Rechner öffnen …“ kopiert eine PDF von deinem Rechner zuerst in deine Dateien und fragt, wo sie liegen soll: Der PDF-Editor arbeitet immer an einer Datei in deinen Dateien, damit er deine Änderungen behalten kann.',
				link: { href: '/help/storage', label: 'Wo deine Dateien liegen' }
			},
			layout: {
				title: 'Aufbau',
				text: 'Die obere Leiste zeigt nur den Namen der offenen PDF – sie heißt wie ihre Datei; umbenennen kannst du sie in Dateien. Darunter liegt das Menüband: links „Rückgängig“ und „Wiederholen“, dann die Registerkarten „Datei“ (Gruppe „PDF“: „Herunterladen“ speichert eine Kopie auf diesem Gerät, „In Dateien zeigen“ öffnet ihren Ordner in Dateien; Gruppe „Neue PDF“: Extrahieren, Zusammenführen), „Start“ (Werkzeuge, Suchen; die PDF öffnet mit dieser Registerkarte), „Kommentieren“ (Zeichnen), „Seiten“ (Drehen, Verschieben, Löschen, Einfügen), „Formular“ (Felder) und „Ansicht“ (Seitenleisten). Jede Registerkarte zeigt ihre Befehle in Gruppen mit ihrem Namen darunter. Farbig abgesetzte Registerkarten kommen und gehen mit dem, woran du arbeitest: Ist ein Werkzeug gewählt, das Kommentare zeichnet, oder sind Kommentare ausgewählt, erscheint eine Registerkarte für ihr Format („Textfeld“, „Notiz“, „Markierung“, „Zeichnung“ oder „Auswahl“ für mehrere Arten), bei einer Auswahl außerdem „Anordnen“. Wählst du Kommentare aus, wechselt das Menüband von selbst zu ihrer Registerkarte – zu „Anordnen“, wenn du diese zuletzt benutzt hast – und zurück, wenn die Auswahl endet; eine Registerkarte, die nur das Format eines Werkzeugs zeigt, öffnet sich nie von selbst. Am linken Rand hält eine schmale Leiste die Seitenleisten: „Seiten“, „Suche“, „Kommentare“ und – wenn die PDF sie hat – „Felder“, „Lesezeichen“, „Anhänge“ und „Ebenen“; klicke eine an, um sie neben den Seiten zu öffnen, und noch einmal, um sie zu schließen. Ziehe ihren rechten Rand, um sie breiter zu machen. Am unteren Rand: die Pfeile zur ersten, vorherigen, nächsten und letzten Seite rund um die Seitenzahl (tippe eine andere ein und drücke Eingabe, um dorthin zu gehen) und die Anzahl der Seiten, dann „Verkleinern“, der Zoom und „Vergrößern“.'
			},
			ribbon: {
				title: 'Menüband-Anzeige',
				text: 'Wird das Fenster schmaler, werden zuerst die Gruppen rechts kleiner: Ihre Schaltflächen verlieren den Text unter dem Symbol, dann den Text ganz, und zuletzt wird eine ganze Gruppe zu einer Schaltfläche, die sie öffnet. Die Schaltfläche mit dem Leisten-Symbol am rechten Ende der Registerkarten wählt, wie das Menüband aussieht – für alle Tools von in-browser auf diesem Gerät. Der Pfeil daneben klappt das Menüband zusammen: Nur die Registerkarten bleiben, und ein Klick auf eine öffnet ihre Befehle über der Seite, bis du einen wählst; ein Doppelklick auf eine Registerkarte oder Strg+F1 tun dasselbe, und der Pfeil holt das Menüband zurück, wie es war.',
				options: {
					classic: { label: 'Klassisch (Standard am Rechner)', text: 'Große Schaltflächen in Gruppen mit ihren Namen. Am leichtesten zu finden, braucht etwa 120 Pixel Höhe.' },
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
				text: 'Dateien, die in die PDF eingebettet sind. Jede lässt sich herunterladen oder in deinen Dateien speichern.'
			},
			layers: {
				title: 'Ebenen',
				text: 'Manche PDFs (Pläne, Karten) haben Ebenen, die sich ein- und ausblenden lassen. Schalte sie hier um; das ändert nur die Ansicht, nicht die Datei.'
			}
		}
	},
	comment: {
		title: 'Kommentieren',
		items: {
			mark: {
				title: 'Text markieren',
				text: 'Zieh mit „Hervorheben“, „Unterstreichen“ oder „Durchstreichen“ auf der Registerkarte „Kommentieren“ über Text: Das Werkzeug markiert genau die Zeichen, über die du fährst, Zeile für Zeile, und zeigt sie schon beim Ziehen. Eine Hervorhebung reicht von der Unterlänge der Buchstaben (g, p, y) bis zu den höchsten, so wie die Schrift des Texts es angibt; eng gesetzte Zeilen stoßen aneinander, ohne sich zu überlappen. Jedes der drei behält seine eigene Farbe, eingestellt auf der Registerkarte „Markierung“, während das Werkzeug gewählt ist. Markierter Text gehört zu seinem Text: Du kannst ihn auswählen, umfärben und löschen, aber nicht verschieben. Gescannte Seiten haben keinen Text zum Markieren.',
				keys: [['M'], ['U'], ['X']]
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
				text: 'Klick mit „Textfeld“ (Gruppe „Kommentar“) auf die Seite, um dort zu schreiben – das Feld wächst mit der längsten Zeile („Automatische Breite“) –, oder zieh ein Feld auf, um genau in dieses zu schreiben („Feste Größe“). Die Eingabetaste beginnt eine neue Zeile. Verlässt du das Feld (Esc oder ein Klick daneben), bleibt der Text; ein leer gelassenes Feld verschwindet. Um den Text später zu ändern, doppelklick ihn mit „Auswählen“, klick ihn mit „Textfeld“ an, oder wähl ihn aus und dann „Text bearbeiten“. Die Registerkarte „Textfeld“ stellt „Textfarbe“, „Schriftgröße“ (8 bis 48 Punkt), „Hintergrund“ und „Rahmen“ („Keiner“ für beides) und die „Stärke“ des Rahmens ein (0,5 bis 4 Punkt – der Rahmen nimmt Platz im Feld ein, die Zeilen brechen also neu um). Die Gruppe „Absatz“ richtet die Zeilen im Feld aus: „Text linksbündig“ (Standard), „Text zentrieren“, „Text rechtsbündig“ oder „Blocksatz“ (die Wörter verteilen sich über die ganze Breite; die letzte Zeile eines Absatzes bleibt links). Andere Programme zeigen alle vier wie hier; bearbeiten sie den Text, behalten sie links, zentriert und rechts, aus Blocksatz wird dort linksbündig. Seine Anfasser ändern nur das Feld, nie die Schrift: Die linke und rechte Seite legen die Breite fest (die Zeilen brechen um, die Höhe folgt dem Text), Ober- und Unterkante und die Ecken eine feste Größe (Umschalt hält bei einer Ecke das Seitenverhältnis); Text, der nicht in eine feste Größe passt, ragt unten heraus – auch in anderen Programmen. Halte beim Ziehen K gedrückt, um die Schrift mit dem Feld zu skalieren. Die Gruppe „Größe“ wechselt zwischen den dreien. Solange „Textfeld“ das Werkzeug ist, legt dieselbe Registerkarte fest, wie das nächste Feld aussieht; jedes neue bekommt, was du zuletzt gewählt hast.',
				options: {
					autoWidth: { label: 'Automatische Breite (ein Klick)', text: 'So breit wie die längste Zeile; neue Zeilen nur, wo du Enter drückst (und am Rand der Seite). Für Beschriftungen und kurze Hinweise.' },
					autoHeight: { label: 'Automatische Höhe (eine Seite gezogen)', text: 'Behält seine Breite; die Zeilen brechen um und das Feld wächst mit dem Text nach unten. Für Absätze.' },
					fixedSize: { label: 'Feste Größe (ein Feld aufgezogen)', text: 'Behält Breite und Höhe, z. B. ein umrandeter Bereich zum späteren Ausfüllen; Text, der nicht hineinpasst, ragt unten heraus.' }
				},
				tip: 'Die Schriftgröße änderst du auf der Registerkarte „Textfeld“, nicht durch Ziehen – das Feld behält dann Platz und Breite. Andere Programme zeigen den Text in Helvetica; Zeilen mit Buchstaben über die westeuropäischen hinaus (Polnisch, Tschechisch, Griechisch, Kyrillisch …) bringen die wenigen Buchstaben, die sie brauchen, in einer passenden Schrift mit, so sehen sie überall gleich aus. Chinesisch, Japanisch, Arabisch und Emojis erscheinen dort vorerst als „?“; der Text selbst bleibt erhalten und wird hier gezeigt.',
				keys: [['T'], ['K']]
			},
			draw: {
				title: 'Auf Seiten zeichnen',
				text: 'Die Registerkarte „Kommentieren“ hat außerdem dieselben Stift-Werkzeuge wie Notizen: „Stift“, „Formen“ (der Pfeil darunter wählt Linie, Pfeil, Rechteck, Ellipse, Stern … – jede mit einer kleinen Zeichnung), und „Radierer“ (der Pfeil darunter: ganze Striche oder Pixel und seine Größe); „Auswählen“ steht als Erstes auf der Registerkarte, in einer eigenen Gruppe. Sie zeichnen mit Stift, Finger oder Maus; auf einem Touchscreen verschieben und zoomen zwei Finger weiterhin die Seiten. Hebst du den Stift nach einer von Hand gezeichneten Linie, einem Kreis oder Kasten, bietet „In … umwandeln“ eine exakte Form an. Formen, die du zeichnest, verschiebst oder skalierst, rasten an Kanten und Mitte der Seite und an anderen Formen und Bildern ein; Hilfslinien zeigen, wo – das kleine Zeichen am Anfang einer Linie ist ein Rahmen für die Seite, sonst die Form, von der sie kommt –, gleiche Abstände zeigen ihre Größe in Millimetern. Der Schalter „Einrasten“ in der Gruppe „Auswahl“ schaltet das ein und aus (Standard: ein, wird gemerkt); halte beim Ziehen Alt gedrückt für das Gegenteil.',
				tip: 'Lass „Einrasten“ an, um Formen auszurichten und gleiche Abstände zu halten; schalte es aus für viele kleine Verschiebungen, bei denen Formen an eine Hilfslinie springen würden – oder halte Alt für nur einen Zug.',
				keys: [['P'], ['S'], ['E'], ['L'], ['Alt']]
			},
			format: {
				title: 'Farbe, Stärke und Stil',
				text: 'Jedes Werkzeug, das Kommentare zeichnet, merkt sich sein eigenes Format: Wähl es, und die Registerkarte seiner Art („Zeichnung“, „Markierung“, „Notiz“, „Textfeld“) legt fest, wie das nächste aussieht – Stift und Formen behalten jeweils ihre Farbe und „Stärke“, jedes Markier-Werkzeug seine Farbe. Wählst du stattdessen Kommentare aus, ändert dieselbe Registerkarte sie, ein Rückgängig-Schritt je Wahl. Jede Farbe kann durchscheinend sein – Striche, markierter Text, Notizen sowie Text, Hintergrund und Rahmen eines Textfelds: Die Prozentzahl neben den Farben (zum Ziehen oder Eintippen) legt fest, wie sehr. Ein durchscheinender Strich bleibt gleichmäßig, auch wo er sich kreuzt, auf dem Bildschirm wie in der gespeicherten PDF; die Füllung einer Form hat unter „Stil“ ihre eigene Deckkraft. Das Farbfeld bleibt offen, während du Farben ausprobierst; ein Klick daneben schließt es. „Stil“ legt fest, wie Formen gezeichnet werden: Füllung, durchgezogene, gestrichelte oder gepunktete Linie, wie von Hand, und Pfeilspitzen ausgewählter Linien.'
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
				text: 'Das Seitenpanel „Kommentare“ listet alle Kommentare des PDFs nach Seite – Notizen, Textfelder, markierten Text und Zeichnungen, deine und die anderer Programme – mit Betreff (sonst der Art), Datum, Autor, Status und der ersten Zeile des Texts. Klick einen an, um hinzuspringen und ihn auszuwählen: Dann zeigt er seinen ganzen Text und seine Antworten. Klick seinen Betreff an, um ihn zu ändern. „Antworten“ öffnet ein Feld für eine Antwort („Senden“ oder Strg+Enter; „Abbrechen“ oder Esc schließt es). „Status“ legt fest, wie es um den Kommentar steht – jeder Status erscheint als Abzeichen in seiner Farbe (angenommen grün, abgelehnt rot, abgebrochen grau, erledigt blau); das ⋯ neben einer Antwort setzt ihren Status oder löscht sie – „Rückgängig“ holt alles zurück. „In Kommentaren suchen“ durchsucht Betreffe, Texte und Autoren, die Liste daneben zeigt nur eine Art. Neue Kommentare und Antworten tragen deinen Namen aus „Einstellungen“ → „Profil“ → „Dein Name“ (Zahnrad oben rechts) – auch in anderen Programmen.',
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
				text: 'Was du zeichnest, wird als echte PDF-Kommentare (Anmerkungen) gespeichert: Jeder PDF-Betrachter zeigt es, und Programme wie Acrobat oder PDF-XChange führen es als Notiz-, Textfeld-, Hervorhebungs-, Unterstreichungs-, Durchstreichungs-, Freihand-, Linien-, Rechteck-, Ellipsen- oder Polygon-Kommentar – markierten Text mit den Wörtern, die er markiert. Die Seite selbst bleibt darunter unverändert. Kommentare dieser Arten, die schon in der PDF stehen – deine von früher und die anderer Programme –, kannst du auswählen, ändern und löschen wie neue; neu geschrieben wird nur, was du änderst, und was sie sonst mitbringen (Antworten, Autor, Notizen), bleibt. Betreffe, Antworten und Status sind dieselben Einträge, die Acrobat und PDF-XChange verwenden, also erscheinen sie auch dort. Andere Arten (Stempel, Wellenlinien, offene Linienzüge) und Antworten auf Notizen werden gezeigt, wie sie sind, und lassen sich hier noch nicht ändern. Die Seitenminiaturen zeigen die Kommentare mit.'
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
				text: 'Was du ausfüllst, wird als Wert der Felder gespeichert, sodass jedes PDF-Programm es zeigt und wieder ändern kann. Es steht in der Schrift, die das Formular für jedes Feld vorgibt, in der Größe, die die Seite zeigt – wie in Acrobat oder Firefox; Buchstaben, die diese Schrift nicht schreiben kann, lassen die PDF die Programme bitten, das Feld selbst zu zeichnen. Während du tippst, zeigt das Feld eine ähnliche Schrift; sobald du es verlässt, zeigt die Seite die des Formulars. Unterschriftsfelder lassen sich nicht unterschreiben.'
			},
			scripts: {
				title: 'Berechnungen und Prüfungen',
				text: 'Manche Formulare bringen eigene kleine Programme mit: Sie zählen Felder zusammen (Stunden, Beträge), zeigen Zahlen in einem Format („1,50“) und prüfen, was du tippst. Sie laufen hier wie in Acrobat oder Firefox, sobald du ein Feld verlässt (Tab, Enter oder ein Klick daneben): Summen und Formate folgen sofort und gehören zum selben Schritt für „Rückgängig“ wie deine Eingabe. Lehnt eine Prüfung eine Eingabe ab, behält das Feld, was vorher drinstand, und die Meldung des Formulars erscheint unten. Diese Programme laufen abgeschottet – sie sehen nur die Felder des Formulars, nie deine Dateien, andere Seiten oder das Internet; Fragen an dich (Ja/Nein, einen Text eingeben) werden mit „Nein“ beantwortet.'
			},
			limits: {
				title: 'Was sich hier nicht ausfüllen lässt',
				text: 'Unterschriftsfelder werden angezeigt, lassen sich aber nicht unterschreiben. Formulare aus Adobes XFA (oft aus LiveCycle; sie zeigen manchmal „Bitte warten …“ oder dass dein Programm nicht unterstützt wird) lassen sich nicht ausfüllen – öffne sie in Acrobat. Schaltflächen, die ein Formular senden, drucken oder Seiten öffnen, tun hier nichts. Felder von Seiten, die aus einer anderen PDF eingefügt wurden, bleiben, wie sie sind.'
			}
		}
	},
	changes: {
		title: 'Änderungen und Speichern',
		items: {
			saving: {
				title: 'Speichern',
				text: 'Änderungen speichern sich selbst: etwa 1,5 Sekunden nach der letzten (bei PDFs über 25 MB nach 10 Sekunden, weil jedes Speichern die ganze Datei schreibt) und sofort, wenn du die Seite verlässt oder zu einer anderen App wechselst. Das Symbol links in der unteren Leiste zeigt, ob alles gespeichert ist; zeig darauf, um den Stand zu lesen. Die PDF bleibt eine normale PDF in deinen Dateien: Deine Änderungen kommen an ihr Ende, der Rest der Datei bleibt genau, wie er war. „Rückgängig“, bis nichts mehr geändert ist, ergibt wieder die ursprüngliche Datei.',
				link: { href: '/help/sync', label: 'Wie deine Dateien zu deinen anderen Geräten kommen' }
			},
			undo: {
				title: 'Rückgängig und Wiederholen',
				text: '„Rückgängig“ und „Wiederholen“ links im Menüband nehmen eine Änderung zurück und machen sie wieder, so weit zurück, wie die PDF geöffnet ist.',
				keys: [['Strg', 'Z'], ['Strg', 'Umschalt', 'Z'], ['Strg', 'Y']]
			},
			rotate: {
				title: 'Seiten organisieren',
				text: 'Die Registerkarte „Seiten“ wirkt auf die in der Seitenleiste „Seiten“ gewählten Seiten, sonst auf die aktuelle Seite – die in der Mitte des Fensters. „Nach links drehen“ und „Nach rechts drehen“ drehen sie um eine Vierteldrehung. „Nach vorne“ und „Nach hinten“ verschieben sie um eine Stelle (das Seitenmenü hat außerdem „An den Anfang“ und „Ans Ende“). „Seiten löschen“ entfernt sie samt allem, was darauf gezeichnet ist; die letzte Seite bleibt immer. „Leere Seite“ fügt nach der aktuellen eine leere Seite ein, so groß wie sie; „Aus PDF …“ fügt dort alle Seiten einer anderen PDF aus deinen Dateien ein, „Bild …“ ein Bild als eigene Seite (so groß wie das Bild, höchstens A4). Jede Änderung ist ein Schritt für „Rückgängig“ und ändert die Datei: Auch andere Programme zeigen die Seiten so.',
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
				text: 'Eine PDF, die zum Öffnen ein Passwort braucht, lässt sich hier nicht öffnen. Einschränkungen, die zum Öffnen kein Passwort verlangen (kein Drucken, Kopieren oder Ändern), werden wie in den meisten Anzeigeprogrammen übergangen: Du kommentierst, füllst aus und organisierst eine solche PDF wie jede andere, und sie bleibt geschützt wie zuvor. Eine PDF, die anders geschützt ist (z. B. mit einem Zertifikat), lässt sich lesen, aber nicht ändern: Eine Leiste sagt das. Genauso bei PDFs, deren Aufbau zu beschädigt ist, um Änderungen anzufügen; eine PDF, deren Ende nur leicht beschädigt ist, wird beim ersten Speichern neu geschrieben. In einer signierten PDF kommen deine Änderungen nach den Signaturen, so belegen diese weiter die signierte Version; vor der ersten Änderung an ihren Seiten wirst du gefragt, weil Programme womöglich melden, dass sich Seiten nach dem Signieren geändert haben.'
			}
		}
	}
};

export default de;
