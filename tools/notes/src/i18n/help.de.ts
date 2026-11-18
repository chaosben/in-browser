import type enHelp from './help.en.js';

const help: typeof enHelp = {
	start: {
		title: 'Erste Schritte',
		items: {
			startPage: {
				title: 'Startseite',
				text: 'Die Startseite zeigt jedes Notizbuch im Browserspeicher, den alle Tools von in-browser teilen – mit Seitenzahl, letzter Änderung und Ordner, auch Notizbücher, die von deinen anderen Geräten gekommen sind. Klicke ein Notizbuch an, um es zu öffnen. „Neues Notizbuch“ fragt, wohin es soll und wie es heißt, und beginnt mit einer linierten A4-Seite. „Öffnen …“ öffnet ein Notizbuch aus einem beliebigen Ordner, „PDF importieren“ macht aus einem PDF ein neues Notizbuch (siehe „PDF“).'
			},
			deleting: {
				title: 'Notizbuch löschen',
				text: 'Der Knopf mit den drei Punkten neben einem Notizbuch (oder ein Rechtsklick, am Telefon langes Drücken) öffnet sein Menü mit „Öffnen“ und „Löschen“. Ein gelöschtes Notizbuch landet im Papierkorb; die Meldung, die es bestätigt, bietet „Rückgängig“ an.'
			},
			layout: {
				title: 'Aufbau',
				text: 'Die Seiten liegen untereinander und füllen das Fenster. Die schwebende Leiste unten enthält die Werkzeuge („Stift“, „Textmarker“, „Formen“, „Radierer“, „Auswählen“, „Laserpointer“), dann den runden Knopf für „Farbe, Stärke und Glättung“ des aktuellen Werkzeugs, „Einfügen“ und „Seite“. Tippe das aktive Werkzeug noch einmal an, um seine Optionen zu öffnen oder zu schließen. Oben: der Name des Notizbuchs mit seinem Menü (Pfeil) und auf breiteren Bildschirmen „Rückgängig“, „Wiederholen“ und „Exportieren“. Am unteren Rand: der Speicherstand, „Seite 3 von 12“ und der Zoom.'
			},
			saving: {
				title: 'Speichern',
				text: 'Jede Änderung wird automatisch gesichert, einen Moment nachdem du den Stift absetzt; das Symbol unten links zeigt, ob alles gespeichert ist. Nichts wird hochgeladen. Ein Notizbuch ist eine Datei „Name.note“ im Browserspeicher; klicke oben auf seinen Namen, um es umzubenennen. In Files verschiebst, kopierst, löschst oder lädst du Notizbücher wie andere Dateien herunter. Ein Notizbuch kann nur in einem Tab gleichzeitig offen sein. Ändert es sich woanders (auf einem anderen Gerät, durch den Abgleich), werden die Seiten neu geladen, an denen du gerade nicht arbeitest – deine Änderungen hier bleiben erhalten.',
				tip: 'Der Browserspeicher hängt an diesem Browser und kann verloren gehen, wenn Websitedaten gelöscht werden. Halte eine Kopie in einem Ordner auf deinem Rechner oder auf deinen anderen Geräten.',
				link: { href: '/help/storage', label: 'Wo deine Dateien liegen' }
			},
			sync: {
				title: 'Auf all deinen Geräten',
				text: 'Notizbücher sind gewöhnliche Dateien des gemeinsamen Dateisystems und reisen deshalb mit dem Geräteabgleich mit – schreib auf dem Tablet, lies am Rechner.',
				link: { href: '/help/sync', label: 'Abgleich zwischen Geräten' }
			},
			install: {
				title: 'Installieren und offline',
				text: 'Notes läuft auf Telefonen, Tablets und Rechnern. Bietet dein Browser es an, installierst du es wie eine App; es startet dann auch ohne Internetverbindung.',
				link: { href: '/help/install', label: 'Installieren, offline und Browser' }
			},
			undo: {
				title: 'Rückgängig',
				text: 'Bis zu 300 Änderungen kannst du rückgängig machen und wiederholen – Striche, Radieren, Verschieben, Umfärben, eingefügte Bilder und PDFs, Änderungen an Seiten. Die Knöpfe stehen auf breiteren Bildschirmen in der oberen Leiste und immer im Menü des Notizbuchs (Pfeil neben seinem Namen).',
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
				text: 'Der runde Knopf nach den Werkzeugen öffnet die Optionen des aktuellen Werkzeugs: das Farbfeld der Suite (Palette, zuletzt benutzte Farben, eigene Farben) und die Stärke. Stift und Formen teilen sich Farbe und Stärke; der Textmarker behält seine eigenen. Alle Einstellungen bleiben für das nächste Notizbuch erhalten.'
			},
			smoothing: {
				title: 'Glättung',
				text: 'Gleicht zittrige Linien aus: Die Linie folgt dem Stift mit kleiner Verzögerung und verliert so kleine Wackler. Wenn du den Stift absetzt, holt die Linie bis zur Absetzstelle auf. In den Optionen von Stift und Textmarker.',
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
				text: 'Wische über das, was weg soll. Die Größe (drei Kreise) gilt auf dem Bildschirm – wenn du hineinzoomst, radierst du also feinere Details. Bilder und Icons werden nie wegradiert – wähle sie aus und lösche sie.',
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
				text: 'Zeichnet eine leuchtende Spur, die von selbst verblasst und nie gespeichert wird – um beim Präsentieren oder Bildschirmteilen auf etwas zu zeigen.'
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
				text: '„Nur der Stift zeichnet“ im Menü des Notizbuchs (Pfeil neben seinem Namen) macht das dauerhaft: Finger scrollen und zoomen immer nur, von der ersten Berührung an und in jedem Notizbuch. Solange es an ist, steht es in der unteren Leiste – tippe es dort an, um es auszuschalten.',
				tip: 'Schalte es ein, wenn du immer mit Eingabestift schreibst – dann zeichnet auch die allererste Berührung deines Handballens nichts. Lass es aus, wenn du manchmal auch mit dem Finger schreibst.'
			},
			longPress: {
				title: 'Langes Drücken',
				text: 'Auf Telefon und Tablet öffnet langes Drücken die Menüs, die am Rechner ein Rechtsklick öffnet, z. B. das Menü eines Notizbuchs auf der Startseite.'
			}
		}
	},
	select: {
		title: 'Auswählen',
		items: {
			selecting: {
				title: 'Auswählen',
				text: 'Mit „Auswählen“ tippst du ein Element an, um das oberste dort auszuwählen (einen Strich, eine Form, ein Bild oder Icon), oder umkreist mehrere: Striche zählen, wenn mindestens die Hälfte davon in der Schleife liegt, Bilder und Icons, wenn ihre Mitte darin liegt. Um die Auswahl erscheint ein Rahmen mit Anfassern. Ein anderes Werkzeug beendet die Auswahl.',
				keys: [['Esc']]
			},
			moving: {
				title: 'Verschieben und skalieren',
				text: 'Zieh innerhalb des Rahmens, um die Auswahl zu verschieben, zieh an einer Ecke, um sie zu skalieren – die Proportionen bleiben, die gegenüberliegende Ecke bleibt stehen. Jedes Verschieben oder Skalieren ist ein Schritt zum Rückgängigmachen. Ist „Einrasten“ an, richtet sich die Auswahl an der Seite und an anderen Formen und Bildern aus (siehe „Formen“).'
			},
			points: {
				title: 'Punkte einer Form',
				text: 'Ist genau eine Form ausgewählt, erscheinen statt der Ecken ihre Punkte: die Enden einer Linie oder eines Pfeils, die Ecken eines Vielecks, bei Ellipse und abgerundetem Rechteck die Ecken ihres Rahmens. Zieh einen Punkt, um die Form zu verändern.'
			},
			menu: {
				title: 'Auswahlmenü',
				text: 'Über der Auswahl schwebt ein Menü (am oberen Bildschirmrand darunter). Am Telefon zeigt es nur Symbole. Jede Änderung dort ist ein Schritt zum Rückgängigmachen.',
				options: {
					color: { label: 'Farbe', text: 'Färbt Striche, Formen und Icons um. Bilder behalten ihre Farben.' },
					size: { label: 'Stärke', text: 'Die Linienstärke ausgewählter Striche und Formen, in den fünf Stiftgrößen.' },
					style: { label: 'Stil', text: 'Nur bei Formen: Füllung, Linienart, handgezeichneter Look und bei Linien die Pfeilspitzen (siehe „Formen“).' },
					duplicate: { label: 'Duplizieren', text: 'Legt eine leicht versetzte Kopie obendrauf und wählt sie aus, bereit zum Verschieben.' },
					delete: { label: 'Löschen', text: 'Entfernt die Auswahl; „Rückgängig“ holt sie zurück.' }
				},
				keys: [['Entf'], ['Rücktaste']]
			}
		}
	},
	shapes: {
		title: 'Formen',
		items: {
			shapeTool: {
				title: 'Formen zeichnen',
				text: 'Wähle „Formen“; seine Optionen zeigen die zwölf Formen: Linie, Pfeil, Doppelpfeil, Rechteck, abgerundetes Rechteck, Ellipse, Dreieck, Raute, Parallelogramm, Fünfeck, Sechseck und Stern. Zieh auf der Seite von einer Ecke (oder dem Anfang einer Linie) zur anderen. Fast quadratische Formen werden zu Quadrat oder Kreis. Ein Tippen ohne Ziehen zeichnet nichts. Formen nutzen Farbe und Stärke des Stifts. Eine Form bleibt bearbeitbar: Wähle sie aus, um ihre Punkte zu verschieben oder ihren Stil zu ändern.'
			},
			style: {
				title: 'Stil einer Form',
				text: 'Unter Farbe und Stärke in den Optionen von „Formen“ – und unter „Stil“ im Auswahlmenü für schon gezeichnete Formen.',
				options: {
					fill: { label: 'Füllung', text: 'Eine Farbe im Inneren geschlossener Formen, „Keine“ für einen leeren Umriss. Linien und Pfeile haben keine Füllung.' },
					line: { label: 'Linie', text: '„Durchgezogen“, „Gestrichelt“ oder „Gepunktet“; die Länge von Strichen und Punkten richtet sich nach der Stärke.' },
					sketch: { label: 'Handgezeichnet', text: 'Zeichnet den Umriss leicht unregelmäßig, wie von Hand – passt besser zu handschriftlichen Notizen als exakte Geometrie.' },
					heads: { label: 'Pfeilspitzen', text: 'Nur im Auswahlmenü, für Linien und Pfeile: „Keine“, „Am Ende“, „Am Anfang“ oder „An beiden Enden“ – macht aus einer Linie einen Pfeil und zurück.' }
				}
			},
			snap: {
				title: 'Einrasten',
				text: 'Der Schalter „Einrasten“ in den Optionen von „Formen“ und „Auswählen“ (standardmäßig an) hilft beim Ziehen, Dinge auszurichten: Linien und Punkte von Formen springen in 15°-Schritte; Anfang und Ende einer neuen Form, gezogene Punkte und verschobene oder skalierte Auswahlen springen an Kanten und Mitte der Seite und an Kanten und Mitten anderer Formen und Bilder – Handschrift ist nie ein Ziel. Auswahlen rasten außerdem auf gleiche Abstände zu ihren Nachbarn ein. Hilfslinien zeigen, woran es einrastet, gleiche Abstände mit ihrer Größe in Millimetern.',
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
				text: '„Einfügen“ bietet „Bild aus Files …“ und „Bild von diesem Gerät …“; du kannst ein Bild auch einfügen (Zwischenablage) oder auf die Seite ziehen. Es erscheint in natürlicher Größe, verkleinert, wenn es nicht auf die Seite passt, und ist gleich ausgewählt, damit du es verschieben und skalieren kannst. Sehr große Bilder werden verkleinert gespeichert, damit das Notizbuch klein bleibt. Der Radierer rührt Bilder nie an – lösche sie mit „Auswählen“.'
			},
			icons: {
				title: 'Icons',
				text: '„Icon …“ im Menü „Einfügen“ öffnet eine durchsuchbare Icon-Auswahl. Das Icon bekommt die aktuelle Stiftfarbe und landet ausgewählt in der Mitte der Ansicht, sodass du es mit dem Rahmen verschieben und skalieren kannst. Seine Farbe änderst du später mit „Farbe“ im Auswahlmenü. Icons bleiben in jeder Größe scharf, auch im Export.'
			}
		}
	},
	pages: {
		title: 'Seiten & Papier',
		items: {
			pageMenu: {
				title: 'Seitenmenü',
				text: '„Seite“ in der unteren Leiste gilt für die aktuelle Seite – die in der Mitte der Ansicht („Seite 3 von 12“ unten). „Seite hinzufügen“ fügt danach eine neue Seite ein, mit derselben Größe und demselben Papier. „Seite nach oben“ und „Seite nach unten“ ändern die Reihenfolge. „Seite löschen“ fragt vorher nach und lässt sich rückgängig machen. „Seite hinzufügen“ steht auch im Menü des Notizbuchs.'
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
				text: 'Der Zoomwert unten öffnet „An Breite anpassen“, „100 %“, „Vergrößern“ und „Verkleinern“. Auf einem Touchscreen zoomst du mit zwei Fingern. Mit der Maus scrollt das Mausrad (mit Umschalt seitwärts), Strg und Mausrad zoomen (ebenso das Zusammenziehen auf dem Touchpad), und Ziehen mit der mittleren oder rechten Maustaste verschiebt die Seite.',
				keys: [['Strg', '+'], ['Strg', '-'], ['Strg', '0']]
			}
		}
	},
	pdf: {
		title: 'PDF',
		items: {
			importNew: {
				title: 'PDF als neues Notizbuch',
				text: '„PDF importieren“ auf der Startseite – „PDF aus Files …“ oder „PDF von diesem Gerät …“ – macht aus dem PDF ein neues Notizbuch: Jede PDF-Seite wird eine Seite, auf die du schreiben kannst. Du wählst, wohin das Notizbuch kommt; bei einem PDF aus Files startet der Dialog daneben. Ein PDF in Files zu öffnen, macht dasselbe. Mit Passwort geschützte PDFs lassen sich nicht öffnen.'
			},
			importInto: {
				title: 'PDF-Seiten in ein Notizbuch',
				text: '„PDF aus Files …“ und „PDF von diesem Gerät …“ im Menü „Einfügen“ – oder ein eingefügtes oder hineingezogenes PDF – fügen alle seine Seiten nach der aktuellen Seite ein. Ein PDF ist ein Schritt zum Rückgängigmachen.'
			},
			annotate: {
				title: 'Auf ein PDF schreiben',
				text: 'Eine PDF-Seite verhält sich wie Papier: Schreib, markiere, zeichne Formen und füge Bilder darauf ein. Das PDF selbst ändert sich nie – Radieren und Auswählen betreffen nur, was du hinzugefügt hast. Die Seiten bleiben in jedem Zoom scharf; direkt nach dem Öffnen oder Zoomen kann eine Seite kurz unscharf aussehen, bis sie vollständig gezeichnet ist. Papier und Größe lassen sich bei PDF-Seiten nicht ändern.'
			},
			export: {
				title: 'Exportieren',
				text: '„Exportieren“ in der oberen Leiste (oder „Exportieren …“ im Menü des Notizbuchs) schreibt das Notizbuch als Datei. Ist sie fertig, speichert „Herunterladen“ sie auf diesem Gerät, „In Files speichern …“ legt sie im Browserspeicher ab – standardmäßig neben dem Notizbuch.',
				options: {
					pdf: { label: 'PDF – alle Seiten', text: 'Alle Seiten in einem PDF. Striche, Formen und importierte PDF-Seiten bleiben in jeder Größe scharf; Bilder werden so eingebettet, wie sie sind.' },
					png: { label: 'PNG – diese Seite', text: 'Die aktuelle Seite als Bild in Druckqualität (etwa 216 dpi, höchstens 4096 Pixel an der langen Seite) – für Nachrichten, Folien oder andere Apps.' }
				},
				tip: 'Nimm PDF, um ein ganzes Notizbuch zu drucken, aufzubewahren oder weiterzugeben, oder um ein ausgefülltes PDF zurückzuschicken. Nimm PNG, um eine einzelne Seite als Bild zu teilen.'
			}
		}
	},
	keys: {
		title: 'Tastenkürzel',
		items: {
			undo: { title: 'Rückgängig', text: 'Die letzte Änderung rückgängig machen.', keys: [['Strg', 'Z']] },
			redo: { title: 'Wiederholen', text: 'Rückgängig Gemachtes wiederholen.', keys: [['Strg', 'Umschalt', 'Z'], ['Strg', 'Y']] },
			delete: { title: 'Auswahl löschen', text: 'Löscht, was mit „Auswählen“ ausgewählt ist.', keys: [['Entf'], ['Rücktaste']] },
			deselect: { title: 'Auswahl beenden', text: 'Hebt die Auswahl auf.', keys: [['Esc']] },
			snap: { title: 'Umgekehrt einrasten', text: 'Halte die Taste beim Ziehen einer Form, eines Punkts oder einer Auswahl gedrückt, um das Gegenteil des Schalters „Einrasten“ zu bewirken.', keys: [['Alt']] },
			zoom: { title: 'Zoom', text: 'Vergrößern, verkleinern, zurück auf 100 %.', keys: [['Strg', '+'], ['Strg', '-'], ['Strg', '0']] },
			wheel: { title: 'Mausrad', text: 'Strg und Mausrad zoomen am Mauszeiger, Umschalt und Mausrad scrollen seitwärts.', keys: [['Strg', 'Mausrad'], ['Umschalt', 'Mausrad']] }
		}
	}
};

export default help;
