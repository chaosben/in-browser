import type enHelp from './help.en.js';

const help: typeof enHelp = {
	start: {
		title: 'Erste Schritte',
		items: {
			startPage: {
				title: 'Startseite',
				text: 'Die Startseite zeigt jedes Notizbuch im Browserspeicher, den alle Tools von in-browser teilen, als Karte – mit Seitenzahl, letzter Änderung und Ordner, auch Notizbücher, die von deinen anderen Geräten gekommen sind. Ein Klick (am Telefon oder Tablet ein Tippen) öffnet ein Notizbuch. „Neues Notizbuch“ fragt, wohin es soll und wie es heißt, und beginnt mit einer linierten A4-Seite. „Öffnen …“ öffnet ein Notizbuch aus einem beliebigen Ordner, „PDF importieren“ macht aus einem PDF ein neues Notizbuch (siehe „PDF“).'
			},
			deleting: {
				title: 'Notizbücher löschen',
				text: 'Jede Notizbuch-Karte hat ein Menü – klicke sie mit rechts an, drücke ihren ⋯-Knopf oder halte sie am Telefon oder Tablet gedrückt: „Öffnen“, „In Dateien zeigen“ und „Löschen“. „Löschen“ legt das Notizbuch in den Papierkorb; die Meldung, die es bestätigt, bietet „Rückgängig“ an. Mit der Tastatur gehst du mit Tab zu einer Karte und drückst Entf. Ein Notizbuch heißt wie seine Datei: Zum Umbenennen wähle „In Dateien zeigen“ und benenne es dort um.',
				keys: [['Entf']]
			},
			layout: {
				title: 'Aufbau',
				text: 'Die Seiten liegen untereinander unter dem Menüband: links darin „Rückgängig“ und „Wiederholen“, dann die Registerkarten „Datei“ (Exportieren, in Dateien zeigen, Löschen), „Zeichnen“ (Werkzeuge, Format, Optionen), „Einfügen“ (Bilder, Icons, PDFs, Seiten), „Seiten“ (Papier, Größe, Reihenfolge, Löschen) und „Ansicht“ (Zoom). Jede Registerkarte zeigt ihre Befehle in Gruppen mit ihrem Namen darunter. Farbig abgesetzte Registerkarten kommen und gehen mit einer Auswahl: „Zeichnung“ (nur Striche und Formen) oder „Auswahl“ (mit Bildern oder Icons) und „Anordnen“. Das Menüband wechselt von selbst zur Registerkarte der Auswahl – zu „Anordnen“, wenn du diese zuletzt benutzt hast – und zurück, wenn die Auswahl endet. Das Notizbuch öffnet mit „Zeichnen“. Die Registerkarte „Datei“, die erste, enthält in ihrer Gruppe „Notizbuch“, was du mit dem Notizbuch selbst tust: „Exportieren …“, „In Dateien zeigen“ und „Löschen“. Die obere Leiste darüber zeigt nur den Namen des Notizbuchs. Am unteren Rand: der Speicherstand, „Seite 3 von 12“ und der Zoom.'
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
				text: 'Drücke kurz Alt (oder F10): Auf den Registerkarten erscheinen Buchstaben, auf „Rückgängig“ und „Wiederholen“ Zahlen. Tippe den Buchstaben einer Registerkarte, dann den Buchstaben auf einem Befehl, um ihn auszuführen. Esc geht einen Schritt zurück.',
				keys: [['Alt'], ['F10']]
			},
			phone: {
				title: 'Auf dem Handy',
				text: 'Auf Handy und Tablet beginnt das Menüband als „Minimal“: die Registerkarten in einer Zeile, darunter die Befehle der Registerkarte als Symbole, die sich seitwärts schieben lassen. Halte ein Symbol gedrückt, um seinen Namen zu sehen. Der Pfeil rechts neben den Registerkarten klappt das Menüband zusammen, wenn du die Höhe brauchst. Wählst du etwas aus, springt es von selbst zur Registerkarte der Auswahl.'
			},
			saving: {
				title: 'Speichern',
				text: 'Jede Änderung wird automatisch gesichert, einen Moment nachdem du den Stift absetzt; das Symbol unten links zeigt, ob alles gespeichert ist. Nichts wird hochgeladen. Ein Notizbuch ist eine Datei „Name.note“ im Browserspeicher und trägt deren Namen. In Dateien benennst du Notizbücher wie andere Dateien um, verschiebst, kopierst oder löschst sie oder lädst sie herunter. Ein Notizbuch kann nur in einem Tab gleichzeitig offen sein. Ändert es sich woanders (auf einem anderen Gerät, durch das Synchronisieren), fragen dich Notizen, ob sie die Seiten neu laden sollen, die du hier nicht geändert hast („Neu laden“ / „Nicht neu laden“, auf Wunsch ohne weitere Frage, solange es offen ist) – deine Änderungen hier bleiben erhalten.',
				tip: 'Der Browserspeicher hängt an diesem Browser und kann verloren gehen, wenn Websitedaten gelöscht werden. Halte eine Kopie in einem Ordner auf deinem Rechner oder auf deinen anderen Geräten.',
				link: { href: '/help/storage', label: 'Wo deine Dateien liegen' }
			},
			connected: {
				title: 'In einem verbundenen Ordner',
				text: 'In den Dialogen für ein neues Notizbuch, „Öffnen …“ und den PDF-Import wechselt die Auswahl vor dem Ordnerpfad zwischen Meine Dateien und den Ordnern, die du in Dateien verbunden hast („Verbunden“). Ein Notizbuch dort wird direkt in diesem Ordner auf deinem Rechner gespeichert. Die Startseite zeigt solche Notizbücher, sobald du sie hier angelegt oder geöffnet hast; verbundene Ordner durchsucht sie nicht. Nach einem Neustart fragt der Browser eventuell erneut: Die Startseite zeigt dann „Zugriff erlauben“, ebenso eine Meldung, wenn Speichern oder Öffnen nicht klappt. Ordner mit einer Wolke (live von deinen anderen Geräten) funktionieren genauso.',
				link: { href: '/help/connected', label: 'Verbundene Ordner' }
			},
			sync: {
				title: 'Auf all deinen Geräten',
				text: 'Notizbücher sind gewöhnliche Dateien des gemeinsamen Dateisystems und reisen deshalb mit dem Synchronisieren deiner Geräte mit – schreib auf dem Tablet, lies am Rechner.',
				link: { href: '/help/sync', label: 'Synchronisieren zwischen Geräten' }
			},
			install: {
				title: 'Installieren und offline',
				text: 'Notizen läuft auf Telefonen, Tablets und Rechnern. Bietet dein Browser es an, installierst du es wie eine App; es startet dann auch ohne Internetverbindung.',
				link: { href: '/help/install', label: 'Installieren, offline und Browser' }
			},
			undo: {
				title: 'Rückgängig',
				text: 'Bis zu 300 Änderungen kannst du rückgängig machen und wiederholen – Striche, Radieren, Verschieben, Umfärben, eingefügte Bilder und PDFs, Änderungen an Seiten. „Rückgängig“ und „Wiederholen“ stehen am linken Ende des Menübands.',
				keys: [['Strg', 'Z'], ['Strg', 'Umschalt', 'Z'], ['Strg', 'Y']]
			}
		}
	},
	writing: {
		title: 'Schreiben & Stifte',
		items: {
			pen: {
				title: 'Stift',
				text: 'Der Stift schreibt in der gewählten Farbe und Stärke (fünf Größen). Mit einem drucksensitiven Eingabestift wird die Linie dicker, je fester du drückst. Mit Finger, Maus oder einem Stift ohne Drucksensor richtet sich die Breite stattdessen nach dem Tempo: Schnelle Striche werden dünner, wie bei einem echten Stift. Ein schwebender Stift (und die Maus) zeigt, wo die Spitze landet und wie breit sie ist.'
			},
			highlighter: {
				title: 'Textmarker',
				text: 'Ein breiter, durchscheinender Marker (drei Breiten): Was darunter liegt – Handschrift, ein importiertes PDF – bleibt lesbar. Der Textmarker hat eigene Farbe und Breite, getrennt vom Stift.'
			},
			color: {
				title: 'Farbe und Stärke',
				text: 'In der Registerkarte „Zeichnen“, Gruppe „Format“: „Farbe“ öffnet das Farbfeld der Suite (Palette, zuletzt benutzte Farben, eigene Farben) für das gewählte Werkzeug, der Pfeil an „Stärke“ seine Größen – fünf für Stift und Formen, drei für den Textmarker. Stift und Formen teilen sich Farbe und Stärke; der Textmarker behält seine eigenen. Die Prozentzahl neben den Farben legt fest, wie durchscheinend die Tinte ist (zum Ziehen oder Eintippen; der Textmarker beginnt bei 35 %) – ein durchscheinender Strich bleibt gleichmäßig, auch wo er sich kreuzt, auch in der exportierten PDF. Bei einer Auswahl ändern dieselben Knöpfe stattdessen die ausgewählten Elemente (siehe „Auswählen“). Alle Einstellungen bleiben für das nächste Notizbuch erhalten.'
			},
			smoothing: {
				title: 'Glättung',
				text: 'Gleicht zittrige Linien aus: Die Linie folgt dem Stift mit kleiner Verzögerung und verliert so kleine Wackler. Wenn du den Stift absetzt, holt die Linie bis zur Absetzstelle auf. „Glättung“ steht in der Registerkarte „Zeichnen“ (Gruppe „Format“), für Stift und Textmarker.',
				options: {
					off: { label: 'Aus', text: 'Die Linie liegt genau dort, wo der Stift war – jeder Wackler bleibt.' },
					light: { label: 'Leicht (Standard)', text: 'Entfernt Zittern; die Verzögerung merkst du kaum.' },
					medium: { label: 'Mittel', text: 'Spürbar rundere Linien; kleine Schleifen und enge Ecken werden weicher.' },
					strong: { label: 'Stark', text: 'Sehr glatte Kurven, aber die Linie hängt sichtbar hinterher und kleine Handschrift verliert Details.' }
				},
				tip: 'Für Handschrift bleib bei „Leicht“ oder wähle „Aus“ – Buchstaben bleiben klar. Nimm „Mittel“ oder „Stark“ für Zeichnungen, Diagramme und große Bögen, oder wenn du mit Finger oder Maus schreibst und die Linien zittrig werden.'
			},
			eraser: {
				title: 'Radierer',
				text: 'Wische über das, was weg soll. Der Pfeil an „Radierer“ wählt, was er radiert, und seine Größe (drei Größen); die Größe gilt auf dem Bildschirm – wenn du hineinzoomst, radierst du also feinere Details. Bilder und Icons werden nie wegradiert – wähle sie aus und lösche sie.',
				options: {
					stroke: { label: 'Ganze Striche (Standard)', text: 'Ein berührter Strich verschwindet ganz. Schnell und sauber für Handschrift.' },
					pixel: { label: 'Pixel', text: 'Entfernt nur, was unter dem Radierer liegt; der Rest des Strichs bleibt als einzelne Stücke stehen. Eine so berührte Form wird zu gewöhnlichen Strichen und verliert ihre Punkte zum Verschieben und ihre Stileinstellungen.' }
				},
				tip: 'Nimm „Ganze Striche“, um Wörter und Linien zu entfernen. Wechsle zu „Pixel“ nur, um das Ende einer Linie zu kürzen oder eine Lücke in eine Zeichnung zu schneiden – und um einen Teil einer Form zu entfernen, verschiebe lieber ihre Punkte mit „Auswählen“, dann bleibt sie eine Form.'
			},
			penEraser: {
				title: 'Radierende und Seitentaste des Stifts',
				text: 'Hat dein Eingabestift ein Radierende oder eine Seitentaste und meldet der Browser sie, radierst du, solange du sie benutzt – mit den Einstellungen des Radierers und ohne das Werkzeug zu wechseln. Nicht jedes Gerät und jeder Browser gibt das weiter.'
			},
			laser: {
				title: 'Laserpointer',
				text: 'Zeichnet eine leuchtende Spur, die von selbst verblasst und nie gespeichert wird – um beim Präsentieren oder Freigeben deines Bildschirms auf etwas zu zeigen.'
			}
		}
	},
	touch: {
		title: 'Stift, Finger und Gesten',
		items: {
			finger: {
				title: 'Mit dem Finger schreiben',
				text: 'Ohne Eingabestift schreibt ein Finger mit dem aktuellen Werkzeug. Zwei Finger verschieben und zoomen die Seite: Ziehen scrollt, Auseinander- und Zusammenziehen zoomt. Setzt der zweite Finger direkt nach dem ersten auf, wird die begonnene Linie des ersten verworfen – ein Zoom hinterlässt nie einen Punkt. Nach einem schnellen Wischen gleitet die Seite weiter.'
			},
			palm: {
				title: 'Handballenerkennung',
				text: 'Sobald du in einem offenen Notizbuch mit einem Eingabestift schreibst, zeichnen Finger dort nicht mehr: Sie scrollen und zoomen nur noch, deine Hand darf also auf dem Bildschirm liegen. Das gilt, bis du das Notizbuch erneut öffnest.'
			},
			penOnly: {
				title: 'Nur der Stift zeichnet',
				text: 'Der Schalter „Nur der Stift zeichnet“ in der Registerkarte „Zeichnen“ (Gruppe „Optionen“) macht das dauerhaft: Finger scrollen und zoomen dann immer nur, schon bei der ersten Berührung, in jedem Notizbuch. Solange er an ist, steht es in der Leiste unten – tippe es dort an, um ihn auszuschalten.',
				tip: 'Schalte es ein, wenn du immer mit Eingabestift schreibst – dann zeichnet auch die allererste Berührung deines Handballens nichts. Lass es aus, wenn du manchmal auch mit dem Finger schreibst.'
			},
			longPress: {
				title: 'Langes Drücken',
				text: 'Am Telefon oder Tablet öffnet langes Drücken die Menüs, die am Rechner ein Rechtsklick öffnet – etwa das Menü eines Notizbuchs auf der Startseite – und zeigt den Namen eines Befehls im Menüband.'
			}
		}
	},
	select: {
		title: 'Auswählen',
		items: {
			selecting: {
				title: 'Auswählen',
				text: 'Mit „Auswählen“ (Registerkarte „Zeichnen“) tippst du ein Element an, um das oberste dort auszuwählen (einen Strich, eine Form, ein Bild oder Icon), oder ziehst eine Schleife um mehrere (neben ihnen beginnen): Striche zählen, wenn mindestens die Hälfte in der Schleife liegt, Bilder, wenn ihre Mitte darin liegt. Strg+Klick oder Umschalt+Klick nimmt ein Element zur Auswahl hinzu oder wieder heraus; eine Schleife mit gedrückter Umschalt- oder Strg-Taste fügt hinzu, was sie umschließt. Ziehst du an einem Element, verschiebst du es sofort, ohne es vorher auszuwählen. Um die Auswahl erscheint ein Rahmen mit Griffen. Ein anderes Werkzeug beendet die Auswahl; Esc beendet sie auch, und ohne Auswahl geht Esc von jedem Werkzeug zurück zu „Auswählen“.',
				keys: [['Strg', 'Klick'], ['Umschalt', 'Klick'], ['Esc']]
			},
			moving: {
				title: 'Verschieben und skalieren',
				text: 'Ziehe im Rahmen, um die Auswahl zu verschieben, ziehe an einer Ecke, um sie zu skalieren – die Proportionen bleiben, und die gegenüberliegende Ecke bleibt stehen. Halte beim Verschieben Umschalt gedrückt, um in der Richtung zu bleiben, in die du am meisten gezogen hast. Jedes Verschieben oder Skalieren ist ein Rückgängig-Schritt. Mit „Einrasten“ richtet sich die Auswahl an der Seite und an anderen Formen und Bildern aus (siehe „Formen“). Mit der Tastatur verschieben die Pfeiltasten die Auswahl um 1 Punkt, mit Umschalt um 10 – ohne Einrasten; gedrückt halten bis zum Loslassen ist ein Rückgängig-Schritt. Strg+A (oder „Alles auswählen“ in der Registerkarte der Auswahl) wählt alles auf der sichtbaren Seite aus.',
				keys: [['←'], ['→'], ['↑'], ['↓'], ['Umschalt', '←'], ['Strg', 'A']]
			},
			points: {
				title: 'Punkte einer Form',
				text: 'Ist genau eine Form ausgewählt, erscheinen statt der Ecken ihre Punkte: die Enden einer Linie oder eines Pfeils, die Ecken eines Vielecks, bei Ellipse und abgerundetem Rechteck die Ecken ihres Rahmens. Zieh einen Punkt, um die Form zu verändern.'
			},
			menu: {
				title: 'Eine Auswahl formatieren',
				text: 'Mit einer Auswahl erscheint die Registerkarte „Zeichnung“ (nur Striche und Formen) oder „Auswahl“ (mit Bildern oder Icons) und öffnet sich von selbst. Ihre Gruppen „Format“ und „Objekt“ wirken auf die ausgewählten Elemente; jede Änderung ist ein Rückgängig-Schritt. Das kleine Menü an der Auswahl enthält „Duplizieren“ und „Löschen“ als Symbole.',
				options: {
					color: { label: 'Farbe', text: 'Färbt Striche, Formen und Icons um. Bilder behalten ihre Farben.' },
					size: { label: 'Stärke', text: 'Die Linienstärke ausgewählter Striche und Formen, in den fünf Stiftgrößen.' },
					smoothing: { label: 'Glättung', text: 'Nur für die nächsten Striche – bei einer Auswahl gesperrt.' },
					style: { label: 'Stil', text: 'Nur bei Formen: Füllung, Linienart, handgezeichneter Look und bei Linien die Pfeilspitzen (siehe „Formen“).' },
					duplicate: { label: 'Duplizieren', text: 'Legt eine leicht versetzte Kopie obendrauf und wählt sie aus, bereit zum Verschieben.' },
					delete: { label: 'Löschen', text: 'Entfernt die Auswahl; „Rückgängig“ holt sie zurück.' },
					selectAll: { label: 'Alles auswählen', text: 'Wählt alles auf der sichtbaren Seite aus.' }
				},
				keys: [['Entf'], ['Rücktaste']]
			},
			arrange: {
				title: 'Anordnen',
				text: 'Die Registerkarte „Anordnen“ erscheint mit einer Auswahl. „In den Vordergrund“, „Eine Ebene nach vorne“, „Eine Ebene nach hinten“ und „In den Hintergrund“ ändern, welches Element oben liegt, wo sie sich überlappen. „Linksbündig ausrichten“, „Horizontal zentrieren“, „Rechtsbündig ausrichten“, „Oben ausrichten“, „Vertikal zentrieren“ und „Unten ausrichten“ richten die ausgewählten Elemente am Rahmen um alle aus – ein einzelnes an der Seite; „Horizontal verteilen“ und „Vertikal verteilen“ geben drei oder mehr gleiche Abstände. Jedes ist ein Rückgängig-Schritt.'
			}
		}
	},
	shapes: {
		title: 'Formen',
		items: {
			shapeTool: {
				title: 'Formen zeichnen',
				text: 'Wähle „Formen“; der Pfeil daran listet die zwölf Formen: Linie, Pfeil, Doppelpfeil, Rechteck, abgerundetes Rechteck, Ellipse, Dreieck, Raute, Parallelogramm, Fünfeck, Sechseck und Stern. Zieh auf der Seite von einer Ecke (oder dem Anfang einer Linie) zur anderen. Fast quadratische Formen werden zu Quadrat oder Kreis. Ein Tippen ohne Ziehen zeichnet nichts. Formen nutzen Farbe und Stärke des Stifts. Eine Form bleibt bearbeitbar: Wähle sie aus, um ihre Punkte zu verschieben oder ihren Stil zu ändern.'
			},
			style: {
				title: 'Stil einer Form',
				text: '„Stil“ in der Gruppe „Format“ (Registerkarte „Zeichnen“) legt fest, wie die nächste Form gezeichnet wird; sind Formen ausgewählt, ändert er sie.',
				options: {
					fill: { label: 'Füllung', text: 'Eine Farbe im Inneren geschlossener Formen, „Keine“ für einen leeren Umriss. Linien und Pfeile haben keine Füllung.' },
					line: { label: 'Linie', text: '„Durchgezogen“, „Gestrichelt“ oder „Gepunktet“; die Länge von Strichen und Punkten richtet sich nach der Stärke.' },
					sketch: { label: 'Handgezeichnet', text: 'Zeichnet den Umriss leicht unregelmäßig, wie von Hand – passt besser zu handschriftlichen Notizen als exakte Geometrie.' },
					heads: { label: 'Pfeilspitzen', text: 'Nur für ausgewählte Linien und Pfeile: „Keine“, „Am Ende“, „Am Anfang“ oder „An beiden Enden“ – macht aus einer Linie einen Pfeil und zurück.' }
				}
			},
			snap: {
				title: 'Einrasten',
				text: 'Der Schalter „Einrasten“ in der Registerkarte „Zeichnen“ (Gruppe „Optionen“, standardmäßig an) hilft beim Ziehen, Dinge auszurichten: Linien und Punkte von Formen springen in 15°-Schritte; Anfang und Ende einer neuen Form, gezogene Punkte und verschobene oder skalierte Auswahlen springen an Kanten und Mitte der Seite und an Kanten und Mitten anderer Formen und Bilder – Handschrift ist nie ein Ziel. Auswahlen rasten außerdem auf gleiche Abstände zu ihren Nachbarn ein. Hilfslinien zeigen, woran es einrastet: Das kleine Zeichen am Anfang einer Linie ist ein Rahmen für die Seite, sonst die Form oder das Bild, von dem sie kommt – das ist zusätzlich umrandet. Gleiche Abstände zeigen ihre Größe in Millimetern.',
				tip: 'Lass es für Diagramme und ordentliche Layouts an. Schalte es aus, wenn du Dinge frei dicht neben anderen platzieren willst. Mit Tastatur bewirkt Alt beim Ziehen das Gegenteil des Schalters, nur für dieses eine Ziehen.',
				keys: [['Alt']]
			},
			suggestion: {
				title: 'Aus einem Strich eine Form machen',
				text: 'Zeichnest du mit dem Stift etwas Größeres als Handschrift – eine Linie, einen in einem Zug gezeichneten Pfeil, ein Dreieck, ein Rechteck oder anderes Viereck, einen Kreis oder eine Ellipse –, erscheint darüber ein Knopf wie „In Pfeil umwandeln“. Tippe ihn an, um den Strich durch eine exakte Form in derselben Farbe und Stärke zu ersetzen; die Form ist gleich ausgewählt, du kannst also ihre Punkte verschieben. Beachtest du den Knopf nicht, verschwindet er bei deiner nächsten Aktion oder nach ein paar Sekunden, und der Strich bleibt, wie du ihn gezeichnet hast.'
			}
		}
	},
	insert: {
		title: 'Bilder & Icons',
		items: {
			images: {
				title: 'Bilder',
				text: '„Bild“ in der Registerkarte „Einfügen“ bietet „Bild aus Dateien …“ und „Bild von diesem Gerät …“; du kannst ein Bild auch einfügen (Zwischenablage) oder auf die Seite ziehen. Es erscheint in natürlicher Größe, verkleinert, wenn es nicht auf die Seite passt, und ist gleich ausgewählt, damit du es verschieben und skalieren kannst. Sehr große Bilder werden verkleinert gespeichert, damit das Notizbuch klein bleibt. Der Radierer rührt Bilder nie an – lösche sie mit „Auswählen“.'
			},
			icons: {
				title: 'Icons',
				text: '„Icon“ in der Registerkarte „Einfügen“ öffnet eine durchsuchbare Icon-Auswahl. Das Icon bekommt die aktuelle Stiftfarbe und landet ausgewählt in der Mitte der Ansicht, sodass du es mit dem Rahmen verschieben und skalieren kannst. Seine Farbe änderst du später mit „Farbe“ in der Registerkarte „Auswahl“. Icons bleiben in jeder Größe scharf, auch im Export.'
			}
		}
	},
	pages: {
		title: 'Seiten & Papier',
		items: {
			pageMenu: {
				title: 'Die Registerkarte „Seiten“',
				text: 'Die Registerkarte „Seiten“ gilt für die aktuelle Seite – die in der Mitte der Ansicht („Seite 3 von 12“ unten). „Papier“ und „Seitengröße“ wählen aus ihren Listen, „Querformat“ dreht die Seite. „Seite hinzufügen“ fügt danach eine neue Seite mit gleicher Größe und gleichem Papier ein (auch in der Registerkarte „Einfügen“). „Seite nach oben“ und „Seite nach unten“ ändern die Reihenfolge. „Seite löschen“ löscht sie mit allem darauf sofort; die Meldung bietet „Rückgängig“ an (Strg+Z geht auch). Die letzte Seite lässt sich nicht löschen.'
			},
			paper: {
				title: 'Papier',
				text: 'Der Hintergrund der aktuellen Seite; er kommt auch in den Export. Importierte PDF-Seiten behalten das Aussehen des PDFs.',
				options: {
					blank: { label: 'Blanko', text: 'Für Skizzen und Zeichnungen.' },
					lined: { label: 'Liniert', text: 'Zum Schreiben (Standard eines neuen Notizbuchs).' },
					grid: { label: 'Kariert', text: 'Für Mathe, Tabellen und Diagramme.' },
					dotted: { label: 'Gepunktet', text: 'Orientierung wie Karos, aber ruhiger – gut für Bullet Journals und Layouts.' }
				}
			},
			size: {
				title: 'Seitengröße',
				text: '„A4“, „A5“, „A3“ oder „US Letter“, und „Querformat“, um die Seite zu drehen. Was auf der Seite steht, bleibt, wo es ist – auf einer kleineren Seite kann Inhalt also außerhalb landen. Neue Notizbücher beginnen mit A4; neue Seiten übernehmen die Größe der aktuellen. Importierte PDF-Seiten behalten ihre Größe.'
			},
			zoom: {
				title: 'Zoomen und scrollen',
				text: 'Die Registerkarte „Ansicht“ enthält „An Breite anpassen“, „Originalgröße“, „Vergrößern“ und „Verkleinern“; der Zoomwert unten öffnet dieselbe Liste. Auf einem Touchscreen zoomst du mit zwei Fingern. Mit der Maus scrollt das Mausrad (mit Umschalt seitwärts), Strg und Mausrad zoomen (ebenso das Zusammenziehen auf dem Touchpad), und Ziehen mit der mittleren oder rechten Maustaste verschiebt die Seite.',
				keys: [['Strg', '+'], ['Strg', '-'], ['Strg', '0']]
			}
		}
	},
	pdf: {
		title: 'PDF',
		items: {
			importNew: {
				title: 'PDF als neues Notizbuch',
				text: '„PDF importieren“ auf der Startseite – „PDF aus Dateien …“ oder „PDF von diesem Gerät …“ – macht aus dem PDF ein neues Notizbuch: Jede PDF-Seite wird eine Seite, auf die du schreiben kannst. Du wählst, wohin das Notizbuch kommt; bei einem PDF aus Dateien startet der Dialog daneben. Ein Doppelklick auf ein PDF in Dateien öffnet es im PDF-Editor, der die PDF selbst kommentiert; für ein Notizbuch daraus wählst du dort in seinem Menü „Mit Notizen öffnen“. Mit Passwort geschützte PDFs lassen sich nicht öffnen.',
				link: { href: '/help/pdf-editor', label: 'PDF-Editor' }
			},
			importInto: {
				title: 'PDF-Seiten in ein Notizbuch',
				text: '„PDF“ in der Registerkarte „Einfügen“ – „PDF aus Dateien …“ oder „PDF von diesem Gerät …“ – oder ein eingefügtes oder hineingezogenes PDF fügt alle seine Seiten nach der aktuellen Seite ein. Ein PDF ist ein Rückgängig-Schritt.'
			},
			annotate: {
				title: 'Auf ein PDF schreiben',
				text: 'Eine PDF-Seite verhält sich wie Papier: Schreib, markiere, zeichne Formen und füge Bilder darauf ein. Das PDF selbst ändert sich nie – Radieren und Auswählen betreffen nur, was du hinzugefügt hast. Die Seiten bleiben in jedem Zoom scharf; direkt nach dem Öffnen oder Zoomen kann eine Seite kurz unscharf aussehen, bis sie vollständig gezeichnet ist. Papier und Größe lassen sich bei PDF-Seiten nicht ändern.'
			},
			export: {
				title: 'Exportieren',
				text: '„Exportieren …“ in der Registerkarte „Datei“ (Gruppe „Notizbuch“) schreibt das Notizbuch als Datei. Ist sie fertig, speichert „Herunterladen“ sie auf diesem Gerät, „In Dateien speichern …“ legt sie im Browserspeicher ab – standardmäßig neben dem Notizbuch; die Meldung bietet dann „Öffnen“ an (eine PDF öffnet sich im PDF-Editor, ein Bild in Dateien).',
				options: {
					pdf: { label: 'PDF – alle Seiten', text: 'Alle Seiten in einem PDF. Striche, Formen und importierte PDF-Seiten bleiben in jeder Größe scharf; Bilder werden so eingebettet, wie sie sind.' },
					png: { label: 'PNG – diese Seite', text: 'Die aktuelle Seite als Bild in Druckqualität (etwa 216 dpi, höchstens 4096 Pixel an der langen Seite) – für Nachrichten, Folien oder andere Apps.' }
				},
				tip: 'Nimm PDF, um ein ganzes Notizbuch zu drucken, aufzubewahren oder weiterzugeben, oder um ein ausgefülltes PDF zurückzuschicken. Nimm PNG, um eine einzelne Seite als Bild weiterzugeben.'
			}
		}
	},
	keys: {
		title: 'Tastenkürzel',
		items: {
			tools: { title: 'Werkzeuge', text: '„Stift“, „Textmarker“, „Formen“, „Radierer“, „Auswählen“, „Laserpointer“.', keys: [['P'], ['H'], ['S'], ['E'], ['L'], ['R']] },
			undo: { title: 'Rückgängig', text: 'Die letzte Änderung rückgängig machen.', keys: [['Strg', 'Z']] },
			redo: { title: 'Wiederholen', text: 'Rückgängig Gemachtes wiederholen.', keys: [['Strg', 'Umschalt', 'Z'], ['Strg', 'Y']] },
			delete: { title: 'Auswahl löschen', text: 'Löscht, was mit „Auswählen“ ausgewählt ist.', keys: [['Entf'], ['Rücktaste']] },
			selectAll: { title: 'Alles auswählen', text: 'Wählt alles auf der sichtbaren Seite aus (das Werkzeug wird „Auswählen“).', keys: [['Strg', 'A']] },
			nudge: { title: 'Auswahl verschieben', text: 'Um 1 Punkt, mit Umschalt um 10, ohne Einrasten; ein Rückgängig-Schritt bis zum Loslassen.', keys: [['←'], ['→'], ['↑'], ['↓'], ['Umschalt', '←']] },
			deselect: { title: 'Auswahl beenden', text: 'Hebt die Auswahl auf; ohne Auswahl geht es von jedem Werkzeug zurück zu „Auswählen“.', keys: [['Esc']] },
			snap: { title: 'Umgekehrt einrasten', text: 'Halte die Taste beim Ziehen einer Form, eines Punkts oder einer Auswahl gedrückt, um das Gegenteil des Schalters „Einrasten“ zu bewirken.', keys: [['Alt']] },
			zoom: { title: 'Zoom', text: 'Vergrößern, verkleinern, zurück auf 100 %.', keys: [['Strg', '+'], ['Strg', '-'], ['Strg', '0']] },
			wheel: { title: 'Mausrad', text: 'Strg und Mausrad zoomen am Mauszeiger, Umschalt und Mausrad scrollen seitwärts.', keys: [['Strg', 'Mausrad'], ['Umschalt', 'Mausrad']] },
			ribbon: { title: 'Menüband', text: 'Menüband zusammen- oder aufklappen; Alt oder F10 zeigen die Zugriffstasten.', keys: [['Strg', 'F1'], ['Alt'], ['F10']] },
			home: { title: 'Startseite', text: 'Das fokussierte Notizbuch öffnen oder löschen.', keys: [['Eingabe'], ['Entf']] }
		}
	}
};

export default help;
