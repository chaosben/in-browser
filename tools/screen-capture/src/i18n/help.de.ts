import type enHelp from './help.en.js';

const help: typeof enHelp = {
	title: 'Hilfe',
	button: 'Hilfe',
	buttonTitle: 'Hilfe (F1)',
	search: 'Hilfe durchsuchen',
	noMatches: 'Nichts gefunden.',
	topics: 'Themen',
	move: 'Ziehen, um das Hilfefenster zu verschieben',
	tipLabel: 'So entscheidest du',
	sections: {
		start: {
			title: 'Erste Schritte',
			items: {
				layout: {
					title: 'Aufbau',
					text: 'Links findest du alles, was du hinzufügst (Medien, Markierungen, Text, Icons, Zoom). In der Mitte die Vorschau, darunter die Timeline mit der Werkzeugleiste. Rechts die Eigenschaften des ausgewählten Elements – ist nichts ausgewählt, die des Projekts.'
				},
				saving: {
					title: 'Speichern',
					text: 'Jede Änderung wird automatisch gesichert – „Gespeichert“ neben dem Projektnamen in der oberen Leiste bestätigt es. Ein Klick auf den Namen benennt das Projekt um. Nichts wird hochgeladen. Ein Projekt ist eine Datei „Name.screencapture“ im Browserspeicher, den alle Tools von in-browser teilen. Beim Anlegen (Aufnahme, Import, leeres Projekt) wählst du Ordner und Namen; der Dialog startet im zuletzt benutzten Ordner. „Speichern unter …“ im Menü neben dem Projektnamen (Pfeil) legt eine Kopie unter neuem Namen oder in einem anderen Ordner an – du arbeitest dann mit der Kopie weiter. „Öffnen …“ auf der Startseite öffnet jedes Projekt. In Files benennst du Projekte wie andere Dateien um, verschiebst, kopierst, löschst oder lädst sie herunter.',
					tip: 'Der Browserspeicher hängt an diesem Browser und kann verloren gehen, wenn Websitedaten gelöscht werden. Wähle in Files (Chrome und Edge) unter „Ordner auf deinem Rechner“ einen Ordner: Deine Projekte werden dann mit ihm abgeglichen, und ein Sync-Tool kann ihn auf deine anderen Rechner bringen. Ein Projekt, das in einem Tab offen ist, lässt sich nicht gleichzeitig in einem zweiten öffnen.'
				},
				storage: {
					title: 'Speicherplatz',
					text: 'Die Startseite zeigt, wie viel vom Browserspeicher die Tools von in-browser belegen. Den größten Teil machen Aufnahmen und importierte Medien aus; wenn du ein Projekt löschst (auf der Startseite oder in Files), wird sein Platz frei.'
				},
				browser: {
					title: 'Browser',
					text: 'Am besten läuft die App in einem aktuellen Chrome oder Edge am Desktop-Rechner. Firefox geht mit Einschränkungen: kein Systemton, kein Abgleich mit einem Ordner auf deinem Rechner, keine Installation.'
				},
				install: {
					title: 'Installieren und offline',
					text: 'Bietet dein Browser es an (in Chrome und Edge ein Installieren-Symbol in der Adresszeile), fügst du die App wie ein Programm hinzu. Sie startet dann auch ohne Internetverbindung. Eine neue Version kündigt ein Hinweis an – sie wird nie ungefragt übernommen, eine laufende Aufnahme ist also sicher.'
				},
				undo: { title: 'Rückgängig', text: 'Bis zu 100 Änderungen kannst du rückgängig machen und wiederholen.', keys: [['Strg', 'Z'], ['Strg', 'Umschalt', 'Z'], ['Strg', 'Y']] }
			}
		},
		record: {
			title: 'Aufnehmen',
			items: {
				flow: {
					title: 'So läuft eine Aufnahme',
					text: 'Wähle in den Tabs die Quellen und klicke „Bildschirm oder Fenster wählen“: Der Browser fragt, welchen Bildschirm, welches Fenster oder welchen Tab du teilst. Nach dem optionalen 3-Sekunden-Countdown läuft die Aufnahme. „Pause“ hält alle Quellen gemeinsam an (Pausen zählen nicht mit), „Stopp“ beendet sie – ebenso „Freigabe beenden“ in der Leiste des Browsers. „Verwerfen“ löscht die Aufnahme.'
				},
				screenQuality: {
					title: 'Bildschirm – Qualität',
					text: 'Der Bildschirm wird mit gleichbleibender Qualität aufgenommen: Ruhige Stellen kosten fast nichts und bleiben scharf, Bewegung bekommt so viele Daten, wie sie braucht. Die Dateigröße hängt deshalb vom Inhalt ab.',
					options: {
						low: { label: 'Niedrig', text: 'Kleinste Dateien; feine Schrift und dünne Linien können unscharf werden.' },
						medium: { label: 'Mittel', text: 'Gut für große Schrift und Folien; kleine Schrift verliert etwas Schärfe.' },
						high: { label: 'Hoch (Standard)', text: 'Scharfer Text bei normaler Bildschirmarbeit, Dateien in vernünftiger Größe.' },
						veryHigh: { label: 'Sehr hoch', text: 'Kaum Verlust, auch bei kleiner Schrift – bei viel Bewegung werden die Dateien spürbar größer.' }
					},
					tip: 'Nimm „Hoch“ für Software-Demos und alles mit Text. Wähle „Sehr hoch“, wenn du kleine Schrift zeigst oder später hineinzoomen willst. „Mittel“ oder „Niedrig“ passen zu langen Aufnahmen mit wenig Text, etwa Folien mit Sprecher.'
				},
				frameRate: {
					title: 'Bildschirm – Bildrate',
					text: 'Wie viele Bilder pro Sekunde aufgenommen werden.',
					options: {
						fps30: { label: '30 fps (Standard)', text: 'Flüssig genug für Klicken, Tippen und Scrollen.' },
						fps60: { label: '60 fps', text: 'Flüssigere schnelle Bewegung; etwa 1,5-mal so viele Daten und mehr Prozessorlast.' }
					},
					tip: 'Bleib bei 30 für Anleitungen und Präsentationen. Nimm 60 nur für schnelle Bewegung wie Spiele oder Animationen – und exportiere dann auch mit 60 fps, sonst ist der Vorteil weg.'
				},
				encoder: {
					title: 'Bildschirm – Encoder',
					text: 'Welcher Teil des Rechners das Video komprimiert. Die Zeile darunter zeigt, was verwendet wird (zum Beispiel „Encoder: AV1 · Hardware“); unter „Details“ siehst du, was dein Browser kann.',
					options: {
						auto: { label: 'Automatisch – wenig Prozessorlast', text: 'Nutzt nach Möglichkeit den Grafikchip. Der Rechner bleibt flüssig, auch bei langen Aufnahmen.' },
						sharp: { label: 'Schärfster Text – mehr Prozessorlast', text: 'Komprimiert immer auf dem Prozessor, mit einem Verfahren speziell für Bildschirminhalte. Feine Schrift bleibt am schärfsten, der Prozessor arbeitet aber mehr.' }
					},
					tip: 'Bleib bei „Automatisch“. Wechsle zu „Schärfster Text“ nur, wenn kleine Schrift verschmiert aussieht und dein Rechner Reserven hat. Meldet ein Hinweis, dass kein Hardware-Encoder da ist, arbeitet ohnehin der Prozessor – dann entlasten eine niedrigere Qualität oder 30 fps.'
				},
				growWindow: {
					title: 'Fenster darf während der Aufnahme größer werden',
					text: 'Spielt nur eine Rolle, wenn du ein einzelnes Fenster oder einen Tab teilst. Die Aufnahme hat von Anfang an eine feste Größe. Wird das Fenster später größer, wird es passend verkleinert – außer diese Option ist an: Dann reserviert die Aufnahme die volle Bildschirmgröße, und das größere Fenster bleibt scharf.',
					tip: 'Lass sie aus, wenn du die Fenstergröße während der Aufnahme nicht änderst – das spart Rechenleistung. Schalte sie ein, wenn du das Fenster während der Aufnahme vergrößerst. Wo ein kleineres Fenster im Bild steht, legst du später unter „Fensterposition“ des Clips fest.'
				},
				estimate: {
					title: 'Größenschätzung',
					text: '„bis ca. … MB pro Minute“ ist eine Obergrenze für den ganzen Bildschirm mit allen gewählten Quellen. Bildschirmaufnahmen mit wenig Bewegung sind meist deutlich kleiner.'
				},
				systemAudio: {
					title: 'Systemton',
					text: 'Nimmt auf, was dein Rechner abspielt – Videos, Hinweistöne, die Gegenseite eines Gesprächs. Der Browser bietet ihn nur unter Windows oder beim Teilen eines Browser-Tabs an, Firefox gar nicht. Er landet im selben Clip wie das Bild.',
					tip: 'Schalte im Freigabe-Dialog des Browsers zusätzlich das Teilen des Tons ein, sonst kommt kein Ton an. Lass die Filter hier aus: Sie sind für Sprache gemacht und lassen Musik und Spielton dumpf klingen.'
				},
				microphone: {
					title: 'Mikrofon',
					text: 'Deine Stimme als eigener Clip mit eigener Lautstärke. Wähle das Gerät in der Liste – Namen erscheinen erst, nachdem du den Zugriff einmal erlaubt hast. Die Pegelanzeige zeigt, ob das Mikrofon dich hört: Sprich normal und achte darauf, dass sie deutlich ausschlägt, ohne ständig am Ende anzustoßen.'
				},
				filters: {
					title: 'Mikrofon-Filter',
					text: 'Bearbeitung durch den Browser vor der Aufnahme. Sie lässt sich später nicht rückgängig machen.',
					options: {
						echo: { label: 'Echounterdrückung', text: 'Entfernt den Ton deiner Lautsprecher, den das Mikrofon wieder auffängt.' },
						noise: { label: 'Rauschunterdrückung', text: 'Dämpft gleichmäßige Hintergrundgeräusche wie Lüfter oder Verkehr; Stimmen können etwas flacher klingen.' },
						gain: { label: 'Automatische Pegelanpassung', text: 'Gleicht laute und leise Sprache automatisch an; hebt in Pausen aber auch Nebengeräusche an.' }
					},
					tip: 'Mit Lautsprechern: Echounterdrückung an lassen. Mit Headset in einem ruhigen Raum kannst du alle drei ausschalten – das klingt natürlicher. Schalte die Pegelanpassung aus, wenn dein Abstand zum Mikrofon gleich bleibt und du den Pegel lieber selbst einstellst.'
				},
				audioQuality: {
					title: 'Tonqualität',
					text: 'Datenrate für Mikrofon und Systemton, jeweils einzeln.',
					options: {
						kbps96: { label: '96 kbit/s', text: 'Reicht für Sprache, kleinste Dateien.' },
						kbps128: { label: '128 kbit/s', text: 'Klare Sprache mit Reserve.' },
						kbps192: { label: '192 kbit/s (Standard)', text: 'Sichere Wahl für Sprache und die meisten Töne.' },
						kbps256: { label: '256 kbit/s', text: 'Für Musik, bei der jedes Detail zählt.' }
					},
					tip: 'Ton ist im Vergleich zum Video klein – der Standard 192 passt fast immer. Nimm 256 nur für Musik.'
				},
				webcam: {
					title: 'Webcam',
					text: 'Deine Kamera als eigener Clip, aufgenommen mit 30 fps. Prüfe das Bild vor dem Start in der Vorschau des Tabs.',
					options: {
						res720: { label: 'Auflösung 720p (Standard)', text: 'Reicht locker für das kleine Bild in der Ecke.' },
						res1080: { label: 'Auflösung 1080p', text: 'Schärfer, wenn die Webcam groß oder bildfüllend gezeigt wird – Dateien etwa doppelt so groß.' }
					},
					tip: '720p genügt, solange die Webcam ein kleines Bild in der Ecke ist. Nimm 1080p, wenn du zwischendurch bildfüllend auf die Kamera schaltest. Lass die Qualität der Webcam auf „Sehr hoch“: Kamerabilder rauschen und brauchen mehr Daten als Bildschirminhalte.'
				},
				countdown: { title: '3 Sekunden Countdown', text: 'Gibt dir Zeit, zum aufgenommenen Fenster zu wechseln. Schalte ihn aus, wenn es sofort losgehen soll.' },
				result: {
					title: 'Nach der Aufnahme',
					text: 'Bildschirm, Webcam und Mikrofon werden eigene Clips, miteinander verknüpft und hinten an die Timeline angehängt: die Webcam unten rechts mit einem Viertel der Breite und abgerundeten Ecken, das Mikrofon auf einer eigenen Spur. Ein Klick wählt alle aus; „Verknüpfung lösen“ trennt sie.'
				}
			}
		},
		media: {
			title: 'Medien & Import',
			items: {
				import: {
					title: 'Importieren',
					text: '„Vom Rechner importieren“ oder Dateien, die du auf den Editor ziehst, landen in der Medienablage – nicht in der Timeline. „Aus Files importieren“ macht dasselbe mit Dateien aus dem gemeinsamen Browserspeicher (mehrere auf einmal mit Strg oder Umschalt); sie werden ins Projekt kopiert, die Originale in Files bleiben also unverändert, und wenn du sie dort löschst, schadet das dem Projekt nicht. Videos: MP4, WebM, MOV, MKV. Ton: MP3, WAV, M4A, AAC, OGG, Opus, FLAC. Bilder: PNG, JPEG, WebP, GIF, SVG. Videos und Ton werden ohne Qualitätsverlust nach MP4 umverpackt.'
				},
				newProject: {
					title: 'Neues Projekt aus Dateien',
					text: 'Auf der Startseite legen „Vom Rechner importieren“, „Aus Files importieren“ oder Dateien, die du auf die Seite ziehst, ein neues Projekt an – nachdem du Ordner und Namen gewählt hast. Videos und Ton werden Clips in der Timeline; Bilder folgen nacheinander nach den Videos, je 3 s, in die Leinwand eingepasst (z. B. für eine Diashow), und liegen zusätzlich in der Medienablage. Das erste Video bestimmt die Leinwandgröße; ohne Video das erste Bild.'
				},
				insert: {
					title: 'Einfügen',
					text: 'Der Einfügen-Knopf eines Eintrags setzt ihn an den Abspielkopf, vor alles, was dort liegt; Bilder landen mittig, höchstens halb so groß wie die Leinwand und nie vergrößert. Du kannst einen Eintrag auch auf die Timeline (an diese Stelle) oder die Vorschau ziehen.'
				},
				drop: {
					title: 'Auf die Timeline ablegen',
					text: 'Legst du Dateien direkt auf der Timeline ab, werden sie importiert und genau dort eingefügt; auf der Vorschau abgelegte beginnen am Abspielkopf.'
				},
				delete: {
					title: 'Medien löschen',
					text: 'Löschen kannst du nur Medien, die nicht mehr in der Timeline vorkommen. Nutzen Rückgängig-Schritte sie noch, gehen diese Schritte verloren – du wirst vorher gefragt.'
				},
				icons: {
					title: 'Icons',
					text: 'Jedes Set bietet eine Grundauswahl von rund 230 Icons, die auch offline funktioniert. „Alle Icons laden“ holt das ganze Set einmalig; danach bleibt es im Browser, funktioniert offline und lässt sich nach Stil filtern (bei Material auch nach Kategorie). Gesucht wird mit englischen Namen. Das Icon wird im Projekt gespeichert und hängt damit nie von einem Set ab.',
					options: {
						material: { label: 'Material Symbols', text: 'Rund 16.000 Icons (1,3 MB), Stile von normal über Umriss bis abgerundet oder kantig.' },
						tabler: { label: 'Tabler', text: 'Rund 6.000 Icons (0,3 MB) mit gleichmäßigen, schlichten Linien; als Umriss oder gefüllt.' },
						phosphor: { label: 'Phosphor', text: 'Rund 9.000 Icons (0,9 MB) in sechs Strichstärken von dünn bis fett, dazu zweifarbig (Duotone).' }
					},
					tip: 'Material hat die größte Auswahl. Tabler wirkt ruhig und technisch. Phosphor passt, wenn du eine bestimmte Strichstärke oder zweifarbige Icons willst. Bleib pro Video bei einem Set, dann wirkt alles einheitlich.'
				}
			}
		},
		library: {
			title: 'Bibliothek',
			items: {
				save: {
					title: 'Elemente ablegen',
					text: 'Bewahre eingestellte Elemente auf – einen gestylten Pfeil, eine Sprechblase mit Text, einen zugeschnittenen Clip samt Markierungen –, um sie wieder einzufügen. Wähle sie aus und nimm im Kontextmenü (Rechtsklick) „Zur Bibliothek hinzufügen …“, oder zieh sie aus der Vorschau oder der Timeline auf einen Abschnitt der geöffneten Gruppe „Bibliothek“ links – sobald du Vorschau oder Timeline verlässt, springt das Element zurück und hängt als Bild mit Namen am Zeiger; die Abschnitte der Bibliothek zeigen gestrichelte Rahmen, der unter dem Zeiger leuchtet auf. Lässt du woanders los, ändert sich nichts. Ist die Bibliothek zugeklappt, halte das Element kurz über ihr Symbol links, dann öffnet sie sich. Gib einen Namen und klick auf die Bibliothek, in die es soll – „Dieses Projekt“ oder „Alle Projekte“; Enter nimmt die zuletzt gewählte. Gespeichert werden alle ausgewählten Elemente mit Einstellungen, Text, Zuschnitt, Verknüpfungen und Platz im Bild; Zoom-Abschnitte nicht.',
					options: {
						project: { label: 'Dieses Projekt', text: 'Bleibt beim Projekt, auch in seinen Kopien. Nutzt die Medien des Projekts direkt, deshalb lassen sich dort benutzte Medien nicht aus der Medienablage löschen.' },
						global: { label: 'Alle Projekte', text: 'In jedem Projekt verfügbar, auch nachdem das Ursprungsprojekt gelöscht ist. Benutzte Medien werden in die Bibliothek kopiert – bei Clips die ganze Mediendatei, nicht nur der zugeschnittene Teil; das belegt Speicherplatz.' }
					},
					tip: 'Leg Markierungen, Texte und Logos für alle Projekte ab – sie brauchen kaum Platz. Zugeschnittene Clips besser im Projekt, außer etwa ein Intro, das in jedes Video gehört.'
				},
				insert: {
					title: 'Einfügen',
					text: 'Klick auf eine Kachel fügt sie am Abspielkopf ein; zieh sie auf die Timeline (sie beginnt an der Ablegestelle) oder die Vorschau (am Abspielkopf). Sie behält ihren Platz im Bild und kommt vor alles, womit sie sich überschneidet; ein Rückgängig-Schritt. Medien aus der globalen Bibliothek werden ins Projekt kopiert und erscheinen in der Medienablage.'
				},
				manage: {
					title: 'Verwalten',
					text: 'Rechtsklick auf eine Kachel: einfügen, umbenennen, in die andere Bibliothek verschieben oder kopieren, entfernen. Eine Kachel in den anderen Abschnitt ziehen verschiebt sie; beim Verschieben in dieses Projekt landen ihre Medien in der Medienablage. Entfernen ändert nichts an schon eingefügten Elementen.',
					tip: 'Bibliothek oder Zwischenablage? Die Zwischenablage ist zum schnellen Wiederholen jetzt, auch in ein anderes Projekt. Die Bibliothek ist für Bausteine, die du über längere Zeit immer wieder brauchst.'
				},
				view: {
					title: 'Ansicht und Suche',
					text: 'Die Knöpfe oben schalten zwischen zwei Ansichten um; deine Wahl wird gemerkt. Das Suchfeld daneben schränkt beide Abschnitte auf Einträge ein, deren Name oder Elemente passen (z. B. „Pfeil“ oder ein Text); Esc leert es.',
					options: {
						list: { label: 'Liste', text: 'Eine Zeile je Eintrag mit kleiner Vorschau – viele Einträge auf einen Blick.' },
						grid: { label: 'Kacheln', text: 'Zwei Spalten mit großer Vorschau – du erkennst leichter, wie ein Eintrag aussieht.' }
					},
					tip: 'Nimm die Liste, sobald du viele Bausteine hast und sie am Namen kennst; Kacheln, solange du noch sammelst oder sie am Aussehen unterscheidest.'
				}
			}
		},
		canvas: {
			title: 'Leinwand',
			items: {
				size: {
					title: 'Leinwandgröße',
					text: 'Die Leinwand ist das Bild deines Videos: Alles wird darauf platziert, und der Export übernimmt ihre Größe. Die erste Aufnahme oder das erste Video legt sie fest; ein leeres Projekt startet mit der Größe, die du wählst.',
					options: {
						landscape: { label: 'Full HD 16:9 (1920×1080)', text: 'Standard für YouTube, Präsentationen und Websites. HD (1280×720) ist kleiner, QHD und 4K sind größer.' },
						portrait: { label: 'Hochformat 9:16 (1080×1920)', text: 'Bildschirmfüllend auf dem Handy: Shorts, Reels, TikTok, Storys.' },
						feed: { label: 'Hochformat 4:5 und Quadrat 1:1', text: 'Nehmen in Social-Media-Feeds viel Platz ein.' },
						custom: { label: 'Eigene', text: 'Jede gerade Größe von 16 bis 7680 Pixeln.' }
					},
					tip: 'Wähle das Format des Ortes, an dem das Video gezeigt wird. Größer als deine Aufnahme macht es nicht schärfer – 4K lohnt sich nur, wenn du einen 4K-Bildschirm aufgenommen hast.'
				},
				change: {
					title: 'Ändern',
					text: 'Mit „Ändern“ in den Projekt-Eigenschaften setzt du eine neue Größe. Alles behält seine Größe in Pixeln und bleibt mittig; auf einer kleineren Leinwand kann Inhalt über den Rand ragen. Lässt sich rückgängig machen.'
				},
				enlarge: {
					title: 'Leinwand vergrößern?',
					text: 'Fügst du Material ein, das größer als die Leinwand ist, wird es verkleinert gezeigt, und du wirst gefragt, ob die Leinwand mitwachsen soll.',
					options: {
						grow: { label: 'Leinwand vergrößern', text: 'Das neue Material erscheint 1:1 und scharf; der bisherige Inhalt behält seine Größe und rückt in die Mitte. Der Export wird größer.' },
						keep: { label: 'Größe beibehalten', text: 'Die Ausgabegröße bleibt; das neue Material bleibt verkleinert.' }
					},
					tip: 'Vergrößere, wenn das neue Material dein Hauptinhalt ist, etwa eine Aufnahme auf einem größeren Bildschirm. Behalte die Größe, wenn das Video in ein festes Format passen muss oder das Material nur Beiwerk ist. In den Projekt-Eigenschaften kannst du die Leinwand später noch vergrößern.'
				},
				background: {
					title: 'Hintergrundfarbe',
					text: 'Zu sehen, wo nichts die Leinwand bedeckt: in Lücken, um Bild-im-Bild-Clips herum und während Blenden. Du stellst sie in den Projekt-Eigenschaften ein (nichts ausgewählt).'
				}
			}
		},
		timeline: {
			title: 'Timeline',
			items: {
				playhead: {
					title: 'Abspielkopf',
					text: 'Klicke oder ziehe im Lineal, um den Abspielkopf zu setzen. Mit den Pfeiltasten gehst du ein Bild weiter, mit Umschalt eine Sekunde.',
					keys: [['Leertaste'], ['K'], ['←'], ['→'], ['Pos1'], ['Ende']]
				},
				tracks: {
					title: 'Spuren',
					text: 'Höhere Spuren liegen vorne – die oberste Zeile ist ganz vorne. Zieh ein Element nach oben oder unten auf eine andere Spur; ist sie an der Stelle belegt, entsteht eine neue Spur. Strg + ↑/↓ verschiebt es eine Stufe, mit Umschalt ganz nach vorne oder hinten. Die Zeile „+“ legt eine neue Spur ganz vorne an.',
					keys: [['Strg', '↑'], ['Strg', '↓']]
				},
				trackStates: {
					title: 'Spurkopf',
					text: 'Die Knöpfe vor jeder Spur gelten für alle Elemente darauf.',
					options: {
						hide: { label: 'Spur ausblenden', text: 'Kein Bild und kein Ton – in der Vorschau und im Export.' },
						mute: { label: 'Spur stumm schalten', text: 'Nur der Ton fehlt, das Bild bleibt.' },
						lock: { label: 'Spur sperren', text: 'Elemente lassen sich nicht mehr versehentlich auswählen, verschieben oder löschen. Wird anderswo Zeit gelöscht, rücken sie trotzdem mit, damit alles synchron bleibt.' }
					},
					tip: 'Blende eine Spur aus, um Varianten zu vergleichen, schalte sie stumm, um den Rest ohne ihren Ton zu beurteilen, und sperre die Hauptaufnahme, sobald sie geschnitten ist – dann verschiebst du sie nicht aus Versehen, während du Markierungen setzt.'
				},
				select: {
					title: 'Auswählen',
					text: 'Ein Klick wählt das Element samt Verknüpften; Alt + Klick nur dieses; mit Strg oder Umschalt + Klick fügst du hinzu oder entfernst. Ziehen verschiebt alle ausgewählten Elemente gemeinsam.',
					keys: [['Strg', 'A'], ['Esc']]
				},
				move: {
					title: 'Verschieben und trimmen',
					text: 'Zieh ein Element, um es zeitlich zu verschieben; es stoppt am Nachbarn auf derselben Spur und rastet an Kanten und Abspielkopf ein („Einrasten“ über der Timeline, Alt bewirkt das Gegenteil). Zieh an den Enden eines Clips, um ihn zu trimmen.'
				},
				ripple: {
					title: 'Löschen und trimmen: was sich verschiebt',
					text: 'Wird Zeit entfernt, rückt alles Spätere auf allen Spuren nach – aber nur dort, wo zu dieser Zeit sonst nichts mehr liegt. Liegt dort noch ein Bild-im-Bild-Clip oder eine Markierung, bleibt die Zeit erhalten. Verlängerst du einen Clip, füllt er zuerst freien Platz auf seiner Spur; nur was darüber hinausgeht, schiebt alles Spätere auf allen Spuren.',
					options: {
						noGap: { label: 'Normal', text: 'Die Lücke schließt sich, so weit es geht.' },
						gap: { label: 'Mit Umschalt', text: 'Beim Löschen bleibt eine Lücke; beim Trimmen bleibt der Rest stehen.' },
						audio: { label: 'Tonclips und Markierungen', text: 'Sie zu löschen entfernt nie Zeit: Hintergrundmusik verschiebt deinen Schnitt nicht.' }
					},
					tip: 'Schneide Versprecher auf die normale Art heraus. Halte Umschalt, wenn spätere Elemente schon zeitgenau sitzen, etwa passend zur Musik.',
					keys: [['Entf'], ['Umschalt', 'Entf']]
				},
				split: {
					title: 'Teilen',
					text: 'Schneidet die ausgewählten Elemente unter dem Abspielkopf durch – ist dort nichts ausgewählt, alle Clips unter dem Abspielkopf. An der Schnittstelle gibt es keine Blende.',
					keys: [['S']]
				},
				hold: {
					title: 'Frame halten',
					text: 'Fügt am Abspielkopf ein Standbild der ausgewählten Clips ein (oder aller Clips mit Bild); die Länge wählst du neben dem Knopf (1–8 s). Alles Spätere rückt nach hinten. Andere Clips unter dem Abspielkopf – auch Ton – werden geteilt und bekommen eine Lücke; Standbilder sind stumm.',
					tip: 'Nutze es, damit Zuschauer etwas lesen können oder um einen Schritt zu erklären. 2–3 Sekunden passen für eine kurze Pause; für längere Erklärungen sprichst du auf einer eigenen Spur über das Standbild.',
					keys: [['F']]
				},
				link: { title: 'Verknüpfen', text: 'Verknüpft die ausgewählten Elemente, sodass ein Klick sie gemeinsam auswählt, verschiebt und löscht.', keys: [['Strg', 'G'], ['Strg', 'Umschalt', 'G']] },
				clipboard: {
					title: 'Kopieren, Ausschneiden, Einfügen',
					text: 'Kopiert die ausgewählten Elemente – Clips und Markierungen – und fügt sie am Abspielkopf ein: Das früheste beginnt dort, die Abstände untereinander bleiben, und alle behalten ihren Platz im Bild. Die Kopie kommt vor alles, womit sie sich überschneidet, und ist ausgewählt; ein Rückgängig-Schritt. Verknüpfte Kopien sind untereinander verknüpft, nie mit den Originalen. Zoom-Abschnitte werden nicht kopiert.',
					options: {
						cut: { label: 'Ausschneiden', text: 'Kopiert und löscht dann wie Entf – spätere Elemente rücken nach. Elemente auf gesperrten Spuren bleiben.' },
						other: { label: 'Anderes Projekt', text: 'Die Zwischenablage teilen sich alle Tabs und Projekte in diesem Browser. Fügst du in ein anderes Projekt ein, werden die nötigen Videos, Tondateien und Bilder in dessen Medienablage kopiert, sodass es danach eigenständig funktioniert. Gibt es ein Medium nicht mehr (Projekt oder Datei gelöscht), werden seine Elemente mit Hinweis ausgelassen.' }
					},
					tip: 'Um eine Markierung später zu wiederholen (z. B. denselben Pfeil für jeden Schritt), kopiere sie, setz den Abspielkopf weiter und füge ein. Für dasselbe Element zur selben Zeit in einem anderen Projekt setz dort zuerst den Abspielkopf an die Stelle.',
					keys: [['Strg', 'C'], ['Strg', 'X'], ['Strg', 'V']]
				},
				layer: {
					title: 'Ebene ändern',
					text: 'Was vorne liegt, entscheidet die Spur: Höhere Spuren werden später gezeichnet und verdecken tiefere – auch Spotlight und Weichzeichnen wirken nur auf das, was darunter liegt. Die Ebene des ausgewählten Elements änderst du über das Kontextmenü, die Tastenkürzel oder indem du seinen Balken in der Timeline nach oben oder unten ziehst.',
					options: {
						forward: { label: 'Eine Ebene nach vorne / hinten', text: 'Springt vor (hinter) das nächste Element, das zur selben Zeit sichtbar ist – nicht einfach eine Spur weiter, damit jeder Schritt sichtbar etwas ändert.' },
						front: { label: 'Ganz nach vorne / hinten', text: 'Vor (hinter) alles, was sich zeitlich mit ihm überschneidet.' }
					},
					tip: 'Eine Markierung, die neben einem Spotlight hell bleiben soll (z. B. ein Rahmen oder Pfeil), muss vor dem Spotlight liegen. Elemente auf gesperrten Spuren lassen sich nicht umsortieren; entsperre die Spur zuerst.',
					keys: [['Strg', '↑'], ['Strg', '↓'], ['Strg', 'Umschalt', '↑'], ['Strg', 'Umschalt', '↓']]
				},
				menu: {
					title: 'Kontextmenü',
					text: 'Ein Rechtsklick auf ein Element – in der Timeline oder der Vorschau – wählt es aus (falls es das nicht schon ist) und bietet Ausschneiden, Kopieren, Einfügen, Löschen, das Ändern der Ebene und das Ablegen in der Bibliothek. Auf einer freien Stelle der Timeline setzt er den Abspielkopf dorthin, sodass „Einfügen“ genau dort einfügt.'
				},
				view: {
					title: 'Timeline-Zoom und Höhe',
					text: 'Mit Strg + Mausrad oder dem Regler zoomst du die Timeline (bis 32×); „Alles zeigen“ passt alles ein. Zieh die Leiste über der Werkzeugleiste, um der Timeline mehr oder weniger Höhe zu geben; ein Doppelklick stellt sie zurück.'
				}
			}
		},
		preview: {
			title: 'Vorschau',
			items: {
				edit: {
					title: 'Verschieben und skalieren',
					text: 'Klicke ein Element in der Vorschau an, um es auszuwählen, zieh es zum Verschieben und an den Ecken zum Skalieren. Ein Klick wählt das vorderste Element unter der Maus (verdeckte: siehe unten); ein Klick auf eine leere Stelle oder Esc hebt die Auswahl auf.'
				},
				snap: {
					title: 'Einrasten',
					text: 'Elemente rasten an Rändern und Mitte der Leinwand ein, an Kanten und Mitten anderer Elemente und an gleichen Abständen zwischen ihnen – Linien und Abstandsmaße zeigen, woran. Mit dem Schalter „Einrasten“ über der Timeline schaltest du das für Vorschau und Timeline an oder aus; hältst du beim Ziehen Alt gedrückt, gilt das Gegenteil.',
					keys: [['Alt']]
				},
				axis: { title: 'Eine Richtung', text: 'Halte beim Verschieben Umschalt gedrückt, um nur waagrecht oder senkrecht zu verschieben.', keys: [['Umschalt']] },
				nudge: {
					title: 'Pfeiltasten',
					text: 'Hast du in die Vorschau geklickt, verschieben die Pfeiltasten das ausgewählte Element um einen Leinwand-Pixel, mit Umschalt um zehn. Eine Folge von Tastendrücken ist ein Rückgängig-Schritt.',
					keys: [['←'], ['↑'], ['→'], ['↓'], ['Umschalt', '←']]
				},
				covered: {
					title: 'Verdeckte Elemente auswählen',
					text: 'Ein Klick trifft immer das vorderste Element. An ein Element darunter kommst du auf drei Wegen:',
					options: {
						menu: { label: 'Rechtsklick', text: 'Das Kontextmenü listet unter „Element auswählen“ alles unter dem Mauszeiger auf, das vorderste zuerst. Zeigst du auf einen Eintrag, wird das Element in der Vorschau hervorgehoben; ein Klick wählt es aus.' },
						tab: { label: 'Tab', text: 'Hast du in die Vorschau geklickt, wählt Tab das nächste Element unter dem Abspielkopf von vorne nach hinten, Umschalt+Tab das vorige.' },
						timeline: { label: 'Timeline', text: 'Ein Klick auf seinen Balken in der Timeline.' }
					},
					tip: 'Einmal ausgewählt, bleibt ein verdecktes Element zum Bearbeiten obenauf: Du kannst es direkt in der Vorschau verschieben und skalieren, obwohl es weiter hinter den anderen gezeichnet wird. Soll es dauerhaft nach vorne, ändere seine Spur (Strg+↑).',
					keys: [['Tab'], ['Umschalt', 'Tab']]
				},
				paused: {
					title: 'Im Stillstand',
					text: 'Angehalten zeigt die Vorschau alles mit voller Deckkraft und ohne Zoom, damit du alle Elemente bearbeiten kannst. Der Zoom-Ausschnitt unter dem Abspielkopf ist gestrichelt markiert. Blenden, sich selbst zeichnende Formen und Zoom siehst du beim Abspielen und im Export.'
				}
			}
		},
		clips: {
			title: 'Clips',
			items: {
				placement: {
					title: 'Position im Bild',
					text: 'Ein Clip kann beliebig groß irgendwo auf der Leinwand stehen (Bild im Bild). Die Knöpfe setzen ihn auf eine von zwei Standard-Platzierungen.',
					options: {
						fit: { label: 'Einpassen', text: 'Das ganze Bild ist zu sehen; freie Fläche zeigt die Hintergrundfarbe.' },
						fill: { label: 'Füllen', text: 'Die Leinwand ist ganz bedeckt; Ränder des Bildes können abgeschnitten werden.' }
					},
					tip: 'Einpassen für Bildschirmaufnahmen – nichts Wichtiges wird abgeschnitten. Füllen für Kamerabilder oder wenn ein anderes Seitenverhältnis keine Balken lassen soll.'
				},
				shape: {
					title: 'Form',
					text: 'Wie der Clip ausgeschnitten wird.',
					options: {
						rect: { label: 'Rechteck', text: 'Das volle Bild.' },
						rounded: { label: 'Abgerundet', text: 'Abgerundete Ecken – wirkt bei Bild im Bild weicher.' },
						circle: { label: 'Kreis', text: 'Ein mittiger Kreis; die Seiten werden abgeschnitten.' }
					},
					tip: 'Ein Kreis passt zum Webcam-Bild mit deinem Gesicht in der Mitte; die bildfüllende Bildschirmaufnahme bleibt ein Rechteck.'
				},
				windowPosition: {
					title: 'Fensterposition',
					text: 'Erscheint nur, wenn das aufgenommene Fenster seine Größe geändert hat. Der Clip hat die Größe des größten Fensters; solange das Fenster kleiner war, bleibt der Rest leer. Im 3×3-Raster legst du fest, wo das kleinere Fenster steht.'
				},
				volume: {
					title: 'Lautstärke',
					text: 'Je Clip von 0 bis 100 %; der Knopf schaltet stumm. Die Wellenform in der Timeline folgt der Lautstärke.',
					tip: 'Dreh Hintergrundmusik auf 15–30 % herunter, damit Sprache gut verständlich bleibt.'
				},
				fades: {
					title: 'Blenden',
					text: 'Ein- und Ausblenden je Clip (0 = keine): Das Bild wird durchsichtig und Darunterliegendes scheint durch, der Ton wird leiser. Standbilder blenden nur das Bild, Tonclips nur den Ton.'
				}
			}
		},
		annotations: {
			title: 'Markierungen',
			items: {
				add: {
					title: 'Hinzufügen',
					text: 'Klickst du links auf eine Kachel, kommt sie an den Abspielkopf; du kannst sie auch auf die Vorschau oder die Timeline ziehen. Markierungen zoomen mit dem Bild mit.'
				},
				shapes: {
					title: 'Pfeil, Linie, Rahmen, Ellipse',
					text: 'Zeigen auf etwas oder markieren es. Farbe und Linienstärke (1 px bis zu einem Zehntel der Leinwandhöhe; die Pfeilspitze wächst mit) stellst du in den Eigenschaften ein; eine Linie kann gestrichelt sein, ein Rahmen abgerundete Ecken bekommen.'
				},
				pen: {
					title: 'Handgezeichnet und selbst zeichnend',
					text: 'Pfeil, Linie, Rahmen und Ellipse können aussehen wie mit dem Stift gezeichnet und sich beim Erscheinen selbst zeichnen – etwa um etwas auf dem Bildschirm einzukreisen.',
					options: {
						sketch: { label: 'Handgezeichnet', text: 'Leicht unregelmäßige Striche: Eine Ellipse kreist etwas mehr als einmal mit Überschwung, ein Rahmen besteht aus vier Strichen, die über die Ecken hinausragen, Pfeil und Linie sind leicht gebogen, die Pfeilspitze ist offen gezeichnet. Die Unregelmäßigkeit ist je Element fest – in Vorschau und Export gleich und beim Verschieben unverändert; eine Kopie bekommt ihre eigene.' },
						drawIn: { label: 'Zeichnen', text: 'Zeit in Sekunden, in der sich die Form nach ihrem Start selbst zeichnet (0 = erscheint sofort). Ein exakter Pfeil zieht zuerst den Schaft, dann erscheint die Spitze. Gestrichelte Linien bleiben gestrichelt. In der angehaltenen Vorschau ist die Form immer vollständig; gezeichnet wird beim Abspielen und im Export.' }
					},
					tip: 'Zum Einkreisen: Ellipse, Handgezeichnet, Zeichnen 0,5–0,8 s und das Einblenden auf 0 stellen, damit der Strich gleich in voller Farbe erscheint. Schneller als 0,3 s wirkt kaum noch wie Zeichnen, langsamer als 1,5 s zäh. Ein Pfeil, der sich in etwa 0,4 s zeichnet, lenkt den Blick in die richtige Richtung.'
				},
				highlight: {
					title: 'Textmarker',
					text: 'Eine farbige, durchscheinende Fläche über Text oder einem Knopf. Die Deckkraft der Farbe bestimmt, wie viel durchscheint (Standard 40 %).'
				},
				spotlight: {
					title: 'Spotlight',
					text: 'Lenkt den Blick auf einen Bereich, indem es alles außerhalb zurücknimmt – auch Clips und Markierungen auf tieferen Spuren. Abdunkeln und Weichzeichnen wirken einzeln oder zusammen.',
					options: {
						color: { label: 'Farbe', text: 'Dunkelt die Umgebung ab (oder färbt sie ein). Die Deckkraft der Farbe ist die Stärke (Standard Schwarz mit 60 %); 0 % schaltet das Abdunkeln aus.' },
						blur: { label: 'Weichzeichnen', text: 'Macht die Umgebung unscharf, in Leinwand-Pixeln; 0 px (Standard) schaltet es aus. Hohe Werte machen den Rest unkenntlich.' },
						shape: { label: 'Form', text: 'Rechteck (mit Eckenradius; ein großer Radius ergibt eine Pillenform) oder Ellipse, die den Rahmen füllt – bei gleich breitem und hohem Rahmen ein Kreis.' }
					},
					tip: 'Abdunkeln mit 40–60 % führt am klarsten und lässt den Rest lesbar. Nur weichzeichnen (Deckkraft 0 %), wenn die Umgebung ihre Farben behalten soll, etwa ein voller Desktop neben einem Dialog. Beides zusammen, wenn ein unruhiger Hintergrund trotzdem ablenkt; dann reicht schwächeres Abdunkeln (20–40 %). Ellipse für Gesichter, Webcam-Bereiche und runde Symbole; Rechteck mit kleinem Radius für Knöpfe, Felder und Fenster.'
				},
				blur: {
					title: 'Weichzeichnen',
					text: 'Macht den markierten Bereich unscharf, etwa Passwörter, E-Mail-Adressen oder Namen – auch Clips und Markierungen auf tieferen Spuren. Soll alles außer einem Bereich unscharf werden, nimm das Spotlight.',
					options: {
						shape: { label: 'Form', text: 'Rechteck (mit Eckenradius) oder Ellipse, die den Rahmen füllt.' }
					},
					tip: 'Für vertrauliche Daten: hohe Stärke, den Bereich etwas größer als den Text ziehen und das Ergebnis im Export Bild für Bild prüfen. Für Text ist das Rechteck die sicherste Form – eine Ellipse lässt die Ecken scharf. Ellipse für Gesichter.'
				},
				step: {
					title: 'Schritt',
					text: 'Ein nummerierter Kreis für Anleitungen. Neue Schritte bekommen die nächste Nummer; du kannst sie ändern. Die Ziffer ist automatisch schwarz oder weiß, je nachdem, was auf der Farbe besser lesbar ist.'
				},
				image: {
					title: 'Bild',
					text: 'Deine eigenen Bilder aus der Medienablage, etwa ein Logo. Sie behalten ihr Seitenverhältnis; „Einpassen“ und „Füllen“ platzieren sie auf der Leinwand, der Eckenradius rundet sie ab. Bei einem transparenten PNG oder SVG folgt der Schatten der Kontur.'
				},
				icon: {
					title: 'Icon',
					text: 'Icons aus der Gruppe „Icons“ links; Farbe samt Deckkraft stellst du in den Eigenschaften ein.'
				},
				shadow: {
					title: 'Schatten',
					text: 'Ein weicher Schlagschatten, der das Element vom Bild abhebt. Standardmäßig an; Text mit Hintergrund startet ohne, und dort trägt die Box den Schatten.',
					tip: 'Lass ihn an bei Elementen über unruhigem oder wechselndem Inhalt; auf ruhigen, einfarbigen Flächen wirkt es ohne flacher und moderner.'
				},
				fades: {
					title: 'Blenden und Dauer',
					text: 'Jede Markierung blendet über eine eigene Dauer ein und aus (Standard 0,2 s, 0 = aus). Sind beide zusammen länger als das Element, werden sie gekürzt; wird das Element später kürzer, wird das Feld gelb, und der Tooltip zeigt, was tatsächlich wirkt.'
				},
				styles: {
					title: 'Gemerkte Einstellungen',
					text: 'Was du in den Eigenschaften einstellst – Farbe, Schrift, Größe, Linienstärke, Schatten, Blenden, Dauer – und an der Ecke gezogene Größen gelten für das nächste neue Element desselben Typs, in allen Projekten. Position, Text und Schritt-Nummer werden nicht gemerkt.'
				}
			}
		},
		text: {
			title: 'Text & Sprechblase',
			items: {
				box: {
					title: 'Textbox',
					text: 'Die Ecken skalieren den ganzen Text. Die Seiten setzen eine feste Breite: Der Text bricht dann um. „Breite automatisch“ passt die Box wieder an die längste Zeile an. Die Höhe folgt immer dem Text. Würde eine Box größer als die Leinwand, bricht sie auf Leinwandbreite um und bekommt bei Bedarf eine kleinere Schrift.'
				},
				font: {
					title: 'Schrift',
					text: 'Die Schriften sind in der App enthalten und funktionieren offline.',
					options: {
						system: { label: 'Systemschrift', text: 'Die Schrift deines Betriebssystems – neutral und vertraut.' },
						inter: { label: 'Inter', text: 'Auch klein sehr gut lesbar; gut für Beschriftungen.' },
						montserrat: { label: 'Montserrat', text: 'Breit und markant; gut für Titel.' },
						caveat: { label: 'Caveat', text: 'Handschrift – persönliche Notizen und Hinweise.' },
						mono: { label: 'JetBrains Mono', text: 'Jedes Zeichen gleich breit – Code und Befehle.' }
					},
					tip: 'Nimm eine Schrift für Fließtext und höchstens eine zweite für Titel. Für Code immer eine Schrift mit gleich breiten Zeichen.'
				},
				align: {
					title: 'Ausrichtung',
					text: 'Links, zentriert, rechts oder Blocksatz. Im Blocksatz werden die Wörter auf die volle Breite verteilt; die letzte Zeile jedes Absatzes bleibt links.'
				},
				background: {
					title: 'Hintergrundfarbe, Eckenradius, Innenabstand',
					text: 'Eine Box hinter dem Text macht ihn auf jedem Bild lesbar. Der Eckenradius rundet die Box ab, der Innenabstand bestimmt den Platz zwischen Boxrand und Text. Text kommt auch ohne Hintergrund aus, eine Sprechblase hat immer einen.',
					tip: 'Eine dunkle Box mit etwa 65 % Deckkraft (der Standard) hält weißen Text auf jedem Inhalt lesbar. Ohne Hintergrund schalte den Schatten ein.'
				},
				callout: {
					title: 'Sprechblase',
					text: 'Eine Textbox mit Zeiger. Zieh den runden Griff an der Spitze, um auf etwas zu zeigen; verschiebst du die Box, wandert die Spitze mit.'
				}
			}
		},
		zoom: {
			title: 'Zoom',
			items: {
				segments: {
					title: 'Zoom-Abschnitte',
					text: 'Ein Zoom-Abschnitt vergrößert eine Weile lang einen Bereich des Bildes; er liegt auf einer eigenen Spur über den anderen. Zwischen den Abschnitten siehst du das ganze Bild. Im Stillstand zeigt die Vorschau das ganze Bild mit dem Zoom-Ausschnitt als gestricheltem Rahmen; ein Klick auf Etikett oder Rand wählt ihn aus.'
				},
				level: {
					title: 'Zoomstufe',
					text: 'Wie stark der Bereich vergrößert wird: 1,1× bis 6× in den Eigenschaften, bis 10×, wenn du die Ecken in der Vorschau ziehst. Der Bereich behält immer das Seitenverhältnis der Leinwand.',
					tip: '1,5–2,5× reicht meist, um kleine Schrift lesbar zu machen. Höhere Stufen vergrößern die aufgenommenen Pixel – das Bild wird weich, außer du hast mit „Sehr hoch“ auf einem großen Bildschirm aufgenommen.'
				},
				transition: {
					title: 'Übergang',
					text: 'Wie lange Hinein- und Herauszoomen dauern, jeweils einzeln (Standard 0,6 s, 0 = harter Schnitt).',
					tip: '0,4–0,8 s wirken ruhig und natürlich. Nimm einen harten Schnitt nur, wenn der Wechsel bewusst abrupt sein soll.'
				}
			}
		},
		properties: {
			title: 'Eigenschaften',
			items: {
				sections: {
					title: 'Abschnitte',
					text: 'Die Eigenschaften stehen in Abschnitten, die du zuklappen kannst; zugeklappte Abschnitte bleiben für alle Elemente zu. Das Suchfeld zeigt dir nur passende Eigenschaften.'
				},
				numbers: {
					title: 'Zahlenfelder',
					text: 'Tippe einen Wert (Komma oder Punkt), nutze ↑/↓ (Umschalt: ×10) oder zieh die Beschriftung nach links oder rechts (Umschalt: ×10, Alt: ×0,1). Größen sind in Pixeln der Leinwand.'
				},
				colors: {
					title: 'Farben',
					text: 'Vorgabefarben in der ersten Reihe, darunter deine eigenen – die zuletzt gewählten und die im Projekt benutzten. Die Felder zeigen die Farbe immer deckend, damit sie erkennbar bleibt; wie durchscheinend sie ist, zeigt der Knopf „Deckkraft“ (Farbe über Schachbrett und Prozent). Der Farbwähler rechts bietet jede beliebige Farbe.',
					options: {
						opacity: { label: 'Deckkraft', text: '100 % ist deckend, 0 % unsichtbar. Textmarker und Spotlight nutzen sie als Stärke.' },
						palette: { label: 'Vorgabefarben', text: 'Zieh eine Farbe aus der zweiten Reihe auf eine Vorgabe, um sie zu ersetzen; zieh eine Vorgabe auf eine andere, um beide zu tauschen. Sie gelten in allen Farbfeldern und allen Projekten. Der Knopf neben dem Farbwähler stellt die Standardfarben wieder her (nur nach einer Änderung sichtbar).' }
					},
					tip: 'Leg die Farben, die du immer wieder brauchst – etwa deine Firmenfarben –, einmal in die Vorgaben; dann sind sie in jedem Projekt einen Klick entfernt und rutschen nicht aus den zuletzt benutzten Farben heraus.'
				}
			}
		},
		export: {
			title: 'Export',
			items: {
				resolution: {
					title: 'Auflösung',
					text: '„Original“ ist die Leinwandgröße. Wählbar sind nur kleinere Größen – das Video wird nie vergrößert, denn das macht es nur größer, nicht schärfer.',
					tip: 'Bleib bei „Original“, außer die Datei soll kleiner werden: 1080p reicht für fast jede Website, 720p für E-Mail und Chat.'
				},
				quality: {
					title: 'Qualität',
					text: 'Die Datenrate des Videos. Die Werte gelten für 1080p bei 30 fps; kleinere Auflösungen brauchen entsprechend weniger.',
					options: {
						low: { label: 'Niedrig', text: 'Etwa 2,5 Mbit/s – kleine Dateien, sichtbarer Verlust bei Bewegung und feiner Schrift.' },
						medium: { label: 'Mittel', text: 'Etwa 4,4 Mbit/s – gut für Folien und ruhige Bildschirmarbeit.' },
						high: { label: 'Hoch (Standard)', text: 'Etwa 7,5 Mbit/s – scharfe Schrift, passt für die meisten Videos.' },
						veryHigh: { label: 'Sehr hoch', text: 'Etwa 12,4 Mbit/s – für viel Bewegung oder wenn das Video weiterbearbeitet wird.' },
						custom: { label: 'Benutzerdefiniert', text: 'Du legst die Bitrate in Mbit/s selbst fest.' }
					},
					tip: 'Nimm „Hoch“. Plattformen wie YouTube komprimieren ohnehin noch einmal – „Sehr hoch“ gibt ihnen die beste Grundlage. Wähle „Mittel“ oder „Niedrig“, wenn die Datei klein sein muss.'
				},
				frameRate: {
					title: 'Bildrate',
					text: '15, 24, 30 oder 60 Bilder pro Sekunde. 60 fps brauchen etwa 1,5-mal so viele Daten.',
					tip: 'Nimm die Bildrate, mit der du aufgenommen hast (meist 30). 15 genügt für reine Folienvideos; 24 wirkt wie Kino.'
				},
				audio: {
					title: 'Ton',
					text: 'Datenrate des Tons oder „Ohne Ton“.',
					tip: '128 kbit/s reichen für Sprache, 192 (Standard) ist für alles sicher, 256 für Musik.'
				},
				estimate: {
					title: 'Geschätzte Größe',
					text: 'Berechnet aus den Datenraten und der Dauer. Die echte Datei ist oft kleiner, vor allem bei ruhigen Bildschirminhalten.'
				},
				compatibility: {
					title: 'Kompatibilität',
					text: 'Heraus kommt eine MP4 mit H.264-Video und AAC-Ton, die fast überall läuft. Kann dein Browser H.264 in dieser Größe nicht kodieren, nimmt er VP9 oder AV1 – das spielt nicht jedes Gerät ab. Klappt auch das nicht, bittet ein Hinweis um eine kleinere Auflösung.'
				},
				running: {
					title: 'Während des Exports',
					text: 'Lass den Tab geöffnet; der Export läuft in diesem Tab. Danach startet der Download automatisch – „Erneut herunterladen“ holt die Datei noch einmal, „In Files speichern …“ legt das Video im Browserspeicher ab (standardmäßig neben dem Projekt). Ausgeblendete Spuren fehlen, stumme Spuren sind ohne Ton.'
				}
			}
		},
		shortcuts: {
			title: 'Tastenkürzel',
			items: {
				help: { title: 'Hilfe', text: 'Dieses Fenster öffnen oder schließen', keys: [['F1'], ['?']] },
				play: { title: 'Abspielen / Pause', text: 'Wiedergabe starten oder anhalten', keys: [['Leertaste'], ['K']] },
				frame: { title: 'Schritt', text: 'Ein Bild zurück oder vor; mit Umschalt eine Sekunde', keys: [['←'], ['→'], ['Umschalt', '←'], ['Umschalt', '→']] },
				ends: { title: 'Anfang / Ende', text: 'An den Anfang oder ans Ende springen', keys: [['Pos1'], ['Ende']] },
				split: { title: 'Teilen', text: 'Am Abspielkopf', keys: [['S']] },
				hold: { title: 'Frame halten', text: 'Am Abspielkopf', keys: [['F']] },
				delete: { title: 'Löschen', text: 'Mit Umschalt bleibt eine Lücke', keys: [['Entf'], ['Umschalt', 'Entf']] },
				undo: { title: 'Rückgängig / Wiederholen', text: 'Letzte Änderung', keys: [['Strg', 'Z'], ['Strg', 'Umschalt', 'Z'], ['Strg', 'Y']] },
				all: { title: 'Alles auswählen', text: 'Alle Elemente', keys: [['Strg', 'A']] },
				deselect: { title: 'Auswahl aufheben', text: 'Nichts mehr ausgewählt', keys: [['Esc']] },
				link: { title: 'Verknüpfen / lösen', text: 'Ausgewählte Elemente', keys: [['Strg', 'G'], ['Strg', 'Umschalt', 'G']] },
				track: { title: 'Spur', text: 'Nach vorne / hinten; mit Umschalt ganz nach vorne / hinten', keys: [['Strg', '↑'], ['Strg', '↓']] },
				clipboard: { title: 'Kopieren / Ausschneiden / Einfügen', text: 'Ausgewählte Elemente; eingefügt am Abspielkopf', keys: [['Strg', 'C'], ['Strg', 'X'], ['Strg', 'V']] },
				nudge: { title: 'Pixelweise verschieben', text: 'In der Vorschau: 1 px, mit Umschalt 10 px', keys: [['←'], ['↑'], ['→'], ['↓']] },
				cycle: { title: 'Nächstes Element', text: 'In der Vorschau: von vorne nach hinten unter dem Abspielkopf; mit Umschalt rückwärts', keys: [['Tab'], ['Umschalt', 'Tab']] },
				free: { title: 'Einrasten', text: 'Beim Ziehen: das Gegenteil des Schalters „Einrasten“', keys: [['Alt']] },
				axis: { title: 'Eine Richtung', text: 'Beim Verschieben in der Vorschau', keys: [['Umschalt']] },
				zoom: { title: 'Timeline-Zoom', text: 'In der Timeline', keys: [['Strg', 'Mausrad']] }
			}
		}
	}
};

export default help;
