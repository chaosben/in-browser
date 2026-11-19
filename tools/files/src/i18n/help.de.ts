import type { HelpContent } from '@in-browser/brand/help.js';
import type enHelp from './help.en.js';

const help: typeof enHelp = {
	start: {
		title: 'Erste Schritte',
		items: {
			what: {
				title: 'Wozu Dateien da ist',
				text: 'Jedes Tool von in-browser legt seine Dokumente in einem gemeinsamen Speicher in diesem Browser ab: Aufnahmen und Projekte der Bildschirmaufnahme, Texte des Texteditors, Notizen. Das Tool Dateien zeigt diesen Speicher wie ein Laufwerk. Hier lädst du hoch und herunter, sortierst Dokumente in Ordner, benennst um, kopierst und löschst – und richtest den Abgleich mit einem Ordner auf deinem Rechner oder mit deinen anderen Geräten ein. Nichts wird auf einen Server hochgeladen.',
				link: { href: '/help/storage', label: 'Wo deine Dateien liegen' }
			},
			layout: {
				title: 'Aufbau',
				text: 'Links der Ordnerbaum, beginnend mit „Meine Dateien“; darunter „Verbunden“ mit Ordnern auf deinem Rechner, die du live geöffnet hast, dann „Papierkorb“ und „Abgleich“ mit einem kurzen Status. In der Mitte der Inhalt des geöffneten Ordners. Die obere Leiste zeigt den Pfad des geöffneten Ordners – ein Klick auf eine Ebene führt dorthin zurück –, danach „Hochladen“ und „Neuer Ordner“; rechts die Suche und der Wechsel zwischen „Liste“ und „Kacheln“. Die untere Zeile zählt die Elemente des Ordners und die ausgewählten, zeigt ein laufendes Hochladen und wie viel Speicher belegt ist. Ganz rechts zeigt das Abgleich-Symbol den Stand des Abgleichs, wie in jedem Tool.'
			},
			menus: {
				title: 'Wo die Aktionen sind',
				text: 'Der Name des geöffneten Ordners in der oberen Leiste (auf oberster Ebene: „Dateien“ neben „in-browser“) öffnet das Menü dieses Ordners: „Neuer Ordner“, „Neue Textdatei“, Hochladen, „Einfügen“, „Alles auswählen“, die Ansicht, „Als ZIP herunterladen“, „Eigenschaften“ und „Papierkorb“. Es enthält immer alles, auch was die Knöpfe daneben tun. Ein Rechtsklick auf einen Eintrag zeigt alles, was du mit ihm oder der Auswahl tun kannst; ein Rechtsklick auf die freie Fläche zeigt die Aktionen für den Ordner. Ordner im Baum links haben dasselbe Menü wie in der Liste.'
			},
			phone: {
				title: 'Am Handy',
				text: 'Auf schmalen Bildschirmen ist der Ordnerbaum ausgeblendet: Du wechselst in Ordner, indem du sie antippst, und zurück über den Pfad in der oberen Leiste. „Hochladen“ und „Neuer Ordner“ stehen im Menü am Ordnernamen, ebenso „Papierkorb“. Das Abgleich-Symbol in der oberen Leiste öffnet die Abgleich-Einstellungen, die Lupe die Suche. Statt eines Rechtsklicks hältst du einen Eintrag gedrückt oder tippst auf seinen ⋮-Knopf.'
			},
			storage: {
				title: 'Speicherplatz',
				text: 'Die untere Zeile zeigt, wie viel vom Browserspeicher belegt ist und wie viel der Browser erlaubt (auf breiten Bildschirmen). Den meisten Platz brauchen große Mediendateien. Gelöschtes liegt im Papierkorb und belegt weiter Platz, bis es abläuft oder du den Papierkorb leerst.',
				link: { href: '/help/storage', label: 'Speicherplatz und Sicherungen' }
			}
		}
	},
	select: {
		title: 'Auswählen und öffnen',
		items: {
			open: {
				title: 'Öffnen',
				text: 'Doppelklicke einen Eintrag oder wähle ihn aus und drücke Enter. Ein Ordner öffnet sich in Dateien. Ein Dokument eines Tools (z. B. ein Projekt der Bildschirmaufnahme oder eine Textdatei) öffnet sich in diesem Tool – können es mehrere Tools öffnen, bietet das Menü des Eintrags für jedes „Mit … öffnen“ an. Andere Dateien öffnen sich in der Vorschau. Manche davon lassen sich auch als Text bearbeiten: Das Menü eines SVG-Bilds bietet „Mit Texteditor öffnen“ an, ein Doppelklick zeigt das Bild. Auf Touchscreens öffnet ein Tippen.'
			},
			select: {
				title: 'Auswählen',
				text: 'Ein Klick wählt einen Eintrag aus. Mit gedrückter Strg-Taste (am Mac Cmd) fügt ein Klick einen Eintrag zur Auswahl hinzu oder nimmt ihn heraus; mit gedrückter Umschalttaste wählt er alles zwischen dem zuletzt angeklickten Eintrag und diesem aus. „Alles auswählen“ steht in den Menüs; Esc oder ein Klick auf die freie Fläche hebt die Auswahl auf. Die untere Zeile zählt, was ausgewählt ist.'
			},
			touch: {
				title: 'Auswählen auf dem Touchscreen',
				text: 'Halte einen Eintrag gedrückt: Der Auswahlmodus beginnt, der Eintrag bekommt ein Häkchen und sein Menü öffnet sich. Jedes weitere Tippen wählt dann einen Eintrag aus oder ab, statt ihn zu öffnen. Währenddessen zeigt die obere Leiste „Aktionen für die Auswahl“ (⋮) mit allem, was du mit den ausgewählten Einträgen tun kannst, und „Auswahl aufheben“ (×), das den Modus beendet. Er endet auch, wenn du den letzten Eintrag abwählst. „Alles auswählen“ steht im Menü jedes Eintrags.'
			},
			preview: {
				title: 'Vorschau',
				text: '„Vorschau“ im Menü einer Datei (oder die Leertaste) zeigt Bilder, Videos, Audio und Text direkt in Dateien, ohne ein Tool zu öffnen. Textdateien über etwa 1 MB werden nicht angezeigt; für andere Arten gibt es keine Vorschau. „Herunterladen“ in der Vorschau speichert die Datei.'
			},
			properties: {
				title: 'Eigenschaften',
				text: '„Eigenschaften“ im Menü eines Eintrags zeigt Art, Ort, Größe und den Zeitpunkt der letzten Änderung. Bei einem Ordner zählt es die Größe von allem darin zusammen und die enthaltenen Dateien und Ordner – das Ordnermenü oben zeigt das für den geöffneten Ordner.'
			}
		}
	},
	transfer: {
		title: 'Hochladen und herunterladen',
		items: {
			upload: {
				title: 'Hochladen',
				text: '„Hochladen“ kopiert Dateien von deinem Rechner oder Handy in den geöffneten Ordner – „Dateien hochladen“ für einzelne Dateien, „Ordner hochladen“ für einen ganzen Ordner mit Unterordnern (auf iPhone und iPad nicht angeboten). Du kannst Dateien oder Ordner auch von deinem Rechner auf die Liste ziehen: Auf der freien Fläche landen sie im geöffneten Ordner, auf einem Ordner in der Liste oder im Baum dort. Die untere Zeile zeigt, welche Datei gerade kopiert wird. „Hochladen“ heißt hier nur Kopieren in den Browserspeicher – nichts verlässt dein Gerät.'
			},
			download: {
				title: 'Herunterladen',
				text: '„Herunterladen“ im Menü einer Datei speichert sie, wie sie ist. Ordner, Projekte von Tools und mehrere ausgewählte Einträge werden als eine ZIP-Datei gespeichert („Als ZIP herunterladen“); die ZIP-Datei entsteht beim Speichern, daher klappt das auch mit großen Ordnern. Chrome und Edge fragen, wohin gespeichert wird, andere Browser speichern in den Download-Ordner. „Als ZIP herunterladen“ im Ordnermenü oben speichert den ganzen geöffneten Ordner.',
				tip: 'Für eine dauerhafte Sicherung von allem ist ein Ordner auf deinem Rechner, der abgeglichen bleibt, bequemer als Herunterladen von Hand.',
				link: { href: '/help/storage', label: 'Sicherungen und der Ordner auf deinem Rechner' }
			},
			names: {
				title: 'Gleiche Namen',
				text: 'Dateien überschreibt beim Hochladen, Einfügen, Verschieben oder Kopieren nie etwas: Hat der Zielordner schon einen Eintrag mit diesem Namen, bekommt der neue eine Nummer, z. B. „Foto (2).jpg“.'
			}
		}
	},
	organize: {
		title: 'Ordnen',
		items: {
			create: {
				title: 'Neuer Ordner und neue Textdatei',
				text: '„Neuer Ordner“ (obere Leiste oder Ordnermenü) und „Neue Textdatei“ (Ordnermenü oder Rechtsklick auf die freie Fläche) legen den Eintrag im geöffneten Ordner an, und du tippst gleich seinen Namen ein. Eine neue Textdatei ist leer; öffnest du sie, landest du im Texteditor.'
			},
			rename: {
				title: 'Umbenennen',
				text: '„Umbenennen“ im Menü eines Eintrags (oder F2) macht den Namen zu einem Eingabefeld; der Teil vor der Endung ist markiert, damit die Art erhalten bleibt. Enter oder ein Klick daneben übernimmt den neuen Namen, Esc bricht ab. Namen, die nicht erlaubt sind (z. B. mit „/“), werden mit einem Hinweis abgelehnt.'
			},
			move: {
				title: 'Verschieben und kopieren',
				text: 'Zieh Einträge auf einen Ordner in der Liste oder im Ordnerbaum, um sie dorthin zu verschieben; halte beim Loslassen Strg gedrückt (am Mac Cmd oder Alt), um sie stattdessen zu kopieren. Ohne Ziehen: „Ausschneiden“ oder „Kopieren“ im Menü, dann „Einfügen“ im Zielordner (Ordnermenü oder Rechtsklick auf die freie Fläche) oder „Einfügen“ im Menü eines Ordners. „Verschieben nach …“ lässt dich den Zielordner in einem Dialog wählen – am Handy der einfachste Weg. „Duplizieren“ legt eine Kopie im selben Ordner an. Ausgeschnittene Einträge erscheinen blass, bis du sie einfügst.',
				tip: 'Verschiebe, wenn das Dokument nur noch am neuen Ort liegen soll. Kopiere oder dupliziere, wenn du eine Fassung ändern und die andere behalten willst – die Kopie ist ab dann ein eigenes Dokument, Änderungen an einem erreichen das andere nicht.'
			},
			search: {
				title: 'Suchen',
				text: 'Das Suchfeld in der oberen Leiste (am Handy die Lupe) filtert den geöffneten Ordner schon beim Tippen: Ein Eintrag bleibt, wenn jedes eingegebene Wort in seinem Namen vorkommt. Unterordner und der Inhalt von Dateien werden nicht durchsucht. Passt nichts, sagt die Liste das.'
			},
			view: {
				title: 'Sortieren und Ansicht',
				text: '„Liste“ zeigt Name, Art, Größe und den Zeitpunkt der letzten Änderung in Spalten – klicke auf eine Spaltenüberschrift, um danach zu sortieren, ein weiterer Klick dreht die Reihenfolge um. Ordner stehen immer zuerst. „Kacheln“ zeigt große Symbole, praktisch bei vielen Bildern. Die Wahl wird gemerkt. Am Handy steht der Wechsel der Ansicht im Ordnermenü.'
			}
		}
	},
	trash: {
		title: 'Papierkorb',
		items: {
			delete: {
				title: 'Löschen',
				text: '„Löschen“ im Menü (oder Entf) verschiebt die ausgewählten Einträge ohne Nachfrage in den Papierkorb. Ein Hinweis bietet ein paar Sekunden lang „Rückgängig“ an. Ist der Abgleich eingerichtet, verschwinden die Einträge auch auf deinen anderen Geräten und landen dort ebenfalls im Papierkorb – so holst du sie auf jedem Gerät zurück.',
				link: { href: '/help/sync', label: 'Löschen und Papierkorb mit mehreren Geräten' }
			},
			open: {
				title: 'Papierkorb öffnen',
				text: '„Papierkorb“ unten in der Seitenleiste oder im Ordnermenü oben (am Handy nur dort). Er listet, was gelöscht wurde – hier oder auf einem anderen Gerät –, mit dem Ordner, aus dem es kam, wann es gelöscht wurde und seiner Größe.'
			},
			restore: {
				title: 'Wiederherstellen',
				text: '„Wiederherstellen“ legt einen Eintrag zurück in seinen alten Ordner; ein Hinweis sagt, wo er gelandet ist. Ist der Name inzwischen vergeben, bekommt er eine Nummer, statt etwas zu überschreiben.'
			},
			remove: {
				title: 'Endgültig löschen',
				text: '„Endgültig löschen“ (Papierkorb mit Kreuz neben einem Eintrag) und „Papierkorb leeren“ entfernen Einträge nach einer Rückfrage endgültig – auf all deinen Geräten. Erst dann ist ihr Speicherplatz frei.'
			},
			keep: {
				title: 'Aufbewahren',
				text: 'Wie lange Gelöschtes im Papierkorb bleibt, bevor es von selbst entfernt wird. Die Einstellung gilt für all deine Geräte.',
				options: {
					days7: { label: '7 Tage', text: 'Gibt Platz bald frei; ein Versehen musst du innerhalb einer Woche bemerken.' },
					days30: { label: '30 Tage (Standard)', text: 'Genug Zeit, ein Versehen zu bemerken, ohne den Speicher lange zu füllen.' },
					days90: { label: '90 Tage', text: 'Für Dokumente, die du selten anschaust; gelöschte Medien belegen lange Platz.' },
					forever: { label: 'Bis ich ihn leere', text: 'Nichts wird von selbst entfernt – du leerst den Papierkorb selbst.' }
				},
				tip: 'Bleib bei 30 Tagen. Nimm 7 Tage, wenn der Speicher knapp wird (große Aufnahmen), 90 Tage oder „Bis ich ihn leere“, wenn du mit Dokumenten arbeitest, die du nur ab und zu ansiehst.'
			},
			elsewhere: {
				title: 'Papierkorb im Ordner auf deinem Rechner',
				text: 'Im abgeglichenen Ordner auf deinem Rechner und beim p2p-node ist der Papierkorb der versteckte Ordner „.in-browser-trash“. Dateien dort werden nach derselben Einstellung entfernt.'
			}
		}
	},
	connected: {
		title: 'Verbundene Ordner',
		items: {
			connect: {
				title: 'Einen Ordner verbinden',
				text: 'Mit „Ordner verbinden …“ unter „Verbunden“ in der Seitenleiste wählst du einen Ordner auf deinem Rechner; der Browser fragt, ob in-browser ihn ansehen und bearbeiten darf. Der Ordner erscheint mit seinem Namen unter „Verbunden“ und öffnet sich live: Du siehst und änderst die Dateien direkt dort, nichts wird in den Browserspeicher kopiert und nichts abgeglichen. Das können nur Chrome und Edge am Computer.',
				tip: 'Verbinde einen Ordner, um Dateien dort zu bearbeiten, wo sie liegen (z. B. den Projektordner eines anderen Programms). Willst du stattdessen eine Kopie von Meine Dateien auf deinem Rechner? Nimm „Ordner auf deinem Rechner“ in den Abgleich-Einstellungen.',
				link: { href: '/help/connected', label: 'Verbundene Ordner' }
			},
			use: {
				title: 'Darin arbeiten',
				text: 'Alles geht wie in Meine Dateien: Öffnen, Vorschau, Hochladen, Herunterladen, Umbenennen, Verschieben und Kopieren – auch zwischen Meine Dateien und einem verbundenen Ordner (Ziehen vom einen ins andere kopiert, wie zwischen Laufwerken). Die untere Zeile zeigt „Live aus …“ statt der Speicherbelegung. Notizbücher und Projekte öffnen sich direkt dort in ihrem Tool.'
			},
			access: {
				title: '„Zugriff erlauben“',
				text: 'Nach einem Neustart fragt der Browser meist erneut nach dem Zugriff. Der Ordner zeigt dann in der Seitenleiste und beim Öffnen „Zugriff erlauben“; klicke darauf und bestätige die Frage des Browsers.',
				tip: 'Wähle „Bei jedem Besuch erlauben“ – dann bleibt er verbunden.'
			},
			manage: {
				title: 'Umbenennen und trennen',
				text: 'Klicke mit der rechten Maustaste auf einen verbundenen Ordner in der Seitenleiste oder öffne das Menü an seinem Namen in der oberen Leiste: „Umbenennen“ ändert nur den Namen hier (der Ordner behält seinen Namen), „Trennen“ entfernt ihn aus in-browser. Im Ordner wird nichts gelöscht.'
			},
			delete: {
				title: 'Löschen in einem verbundenen Ordner',
				text: 'Ein verbundener Ordner hat keinen Papierkorb von in-browser: „Löschen“ fragt erst „Endgültig löschen?“ und löscht dann sofort.'
			},
			share: {
				title: 'Einen Ordner mit einem Gast teilen',
				text: '„Ordner teilen …“ unter „Freigaben“ in der Seitenleiste (oder „Teilen …“ im Menü eines Ordners in Meine Dateien) erzeugt einen Link und QR-Code für einen Browser außerhalb deiner Geräte – z. B. den Rechner eines Freundes, bei dem du zu Besuch bist. Der Gast sieht nur diesen Ordner, live von diesem Gerät; bei ihm bleibt nichts. Wähle „Nur ansehen“ (Standard) oder „Bearbeiten“. Der Link gilt, bis du die Freigabe beendest, jeweils für einen Browser. Deine Freigaben erscheinen unter „Freigaben“ (grüner Punkt: Gast verbunden); ein Klick zeigt den Link wieder, ein Rechtsklick bietet „Freigabe beenden“.',
				tip: '„Nur ansehen“, um Dateien weiterzugeben; „Bearbeiten“, wenn der Gast im Ordner speichern oder hochladen soll. Lass in-browser hier offen, solange er ihn nutzt.',
				link: { href: '/help/connected#share', label: 'Mit einem Gast teilen' }
			},
			guest: {
				title: 'Einen geteilten Link öffnen',
				text: 'Ein Link, den jemand mit dir geteilt hat, öffnet Dateien mit dem Ordner unter „Verbunden“, benannt nach ihm und dem Gerät, das ihn teilt (ein Schloss heißt nur ansehen). Er lebt nur in diesem Tab: „Trennen“ oder das Schließen des Tabs beendet ihn, in deinem Browser bleibt nichts; der Link öffnet ihn wieder, solange die Freigabe besteht. Ist gerade ein anderer Browser drin, sagt Dateien das und versucht es selbst wieder. Kopiere Dateien nach Meine Dateien, um sie zu behalten. Endet die Freigabe, sagt Dateien das sofort; „Entfernen“ nimmt sie aus „Verbunden“.'
			}
		}
	},
	folder: {
		title: 'Ordner auf deinem Rechner',
		items: {
			connect: {
				title: 'Mit einem Ordner abgleichen',
				text: '„Abgleich“ in der Seitenleiste (am Handy das Abgleich-Symbol in der oberen Leiste) öffnet die Abgleich-Einstellungen; klicke unter „Ordner auf deinem Rechner“ auf „Ordner wählen“ und wähle einen Ordner. Ab dann hält Dateien den Browserspeicher und diesen Ordner in beide Richtungen abgeglichen; wurde eine Datei auf beiden Seiten geändert, gewinnt die neuere Fassung. Der Abgleich läuft, solange ein Tool von in-browser in diesem Browser offen ist. Das können nur Chrome und Edge am Desktop-Rechner.',
				tip: 'Wähle einen leeren Ordner oder einen nur für in-browser – alles darin wird Teil von „Meine Dateien“. Ein Ordner, den dein Sync-Tool (Syncthing, Nextcloud, Dropbox …) mitnimmt, bringt deine Dokumente auch auf andere Rechner.',
				link: { href: '/help/storage', label: 'Der Ordner auf deinem Rechner' }
			},
			paused: {
				title: 'Pausiert: „Zugriff erlauben“',
				text: 'Der Browser erlaubt den Zugriff auf den Ordner oft nur, bis er geschlossen wird. Dann steht in den Abgleich-Einstellungen „Pausiert“, und Dateien ändert nichts im Ordner. Klicke auf „Zugriff erlauben“ und bestätige die Frage des Browsers; der Abgleich geht weiter und holt nach.',
				tip: 'Wähle in der Frage des Browsers „Bei jedem Besuch zulassen“ – dann läuft der Abgleich beim nächsten Mal von selbst weiter.'
			},
			deletes: {
				title: 'Löschungen im Ordner',
				text: 'Verschwinden viele Dateien auf einmal aus dem Ordner auf deinem Rechner, folgt Dateien nicht einfach: Die Abgleich-Einstellungen fragen, ob sie auch hier gelöscht werden sollen. „Auch hier löschen“ löscht sie in Dateien, „Stattdessen wiederherstellen“ schreibt sie zurück in den Ordner.',
				tip: 'Stelle sie wieder her, wenn du sie nicht absichtlich gelöscht hast – z. B. wenn ein Laufwerk fehlte oder ein Sync-Tool den Ordner geleert hat. Lösch sie auch hier, wenn du den Ordner selbst aufgeräumt hast.'
			},
			manage: {
				title: 'Jetzt abgleichen und trennen',
				text: '„Jetzt abgleichen“ gleicht sofort ab, statt auf die nächste Änderung zu warten. Lassen sich einzelne Dateien nicht abgleichen, sagt eine Zeile, wie viele. „Trennen“ beendet den Abgleich mit dem Ordner; es wird nichts gelöscht, weder in Dateien noch im Ordner, und du kannst jederzeit wieder einen Ordner wählen.'
			}
		}
	},
	devices: {
		title: 'Deine Geräte',
		items: {
			where: {
				title: 'Wo du es findest',
				text: '„Abgleich“ in der Seitenleiste (am Handy das Abgleich-Symbol in der oberen Leiste) öffnet die Abgleich-Einstellungen mit „Deine Geräte“ oben. Sein Eintrag in der Seitenleiste zeigt, wie viele Geräte verbunden sind, und ein Warnsymbol, wenn etwas dich braucht. In jedem Tool zeigt das Abgleich-Symbol ganz rechts in der unteren Zeile den Stand; sein Menü führt mit „Geräte verwalten“ hierher.',
				link: { href: '/help/sync', label: 'Deine Geräte abgleichen' }
			},
			first: {
				title: 'Die ersten Geräte verbinden',
				text: 'Klicke auf dem ersten Gerät auf „Geräte verbinden“: eine kurze Erklärung, dann ein Name für dieses Gerät (damit du sie auseinanderhältst), dann zeigt „Gerät hinzufügen“ einen Schlüssel als QR-Code. Auf dem zweiten Gerät scannst du den Code mit der Kamera, öffnest den Link aus „Link kopieren“ oder öffnest dort Dateien und tippst den Schlüssel unter „Schlüssel eingeben“ ein. Lass Dateien auf dem ersten Gerät geöffnet, bis das zweite hinzugefügt ist.',
				link: { href: '/help/sync', label: 'Geräte verbinden' }
			},
			add: {
				title: 'Weitere Geräte hinzufügen',
				text: '„Gerät hinzufügen“ auf einem beliebigen verbundenen Gerät zeigt einen neuen Schlüssel. Er gilt einmal, 24 Stunden lang und nur, solange das Gerät, das ihn zeigt, online ist. Wer ihn hat, kann ein Gerät verbinden und alle deine abgeglichenen Dateien lesen und ändern – gib ihn nur dir selbst.'
			},
			status: {
				title: 'Stand der Geräte',
				text: 'Die Liste zeigt dieses Gerät (ein Klick auf seinen Namen benennt es um) und jedes andere: verbunden, gleicht ab, wann es zuletzt gesehen oder abgeglichen wurde. Hinweise in Warnfarbe sagen, wenn ein Gerät wahrscheinlich nicht aktuell ist, nicht erreichbar ist (oft Mobilfunk oder ein Firmennetz) oder ein Update braucht. Abgeglichen wird, solange mindestens zwei Geräte in-browser geöffnet haben; „Jetzt abgleichen“ startet es sofort.',
				link: { href: '/help/sync', label: 'Wenn Geräte nicht abgleichen' }
			},
			folders: {
				title: 'Ordner ausnehmen',
				text: '„Ordner auswählen“ zeigt alle Ordner mit Größe und wo sie liegen; nimm bei einem das Häkchen weg, um ihn auf diesem Gerät nicht mehr abzugleichen. Dasselbe steht im Menü eines Ordners: „Auf diesem Gerät nicht abgleichen“, und zurück mit „Auf diesem Gerät wieder abgleichen“. Die Kopie auf diesem Gerät wird gelöscht, die anderen Geräte behalten den Ordner. Er bleibt mit einer Wolke im Baum: Öffnest du ihn, liest dieses Gerät ihn live von einem Gerät, das ihn hat, und du arbeitest darin wie überall (Löschen geht in den Papierkorb jenes Geräts). Ist keins davon verbunden, nennt Dateien, wo der Ordner liegt.',
				tip: 'Lass aus, was du hier selten brauchst, z. B. große Aufnahmen auf dem Handy – öffnen kannst du sie trotzdem live. Gleich einen Ordner wieder ab, wenn du ihn brauchst, während deine anderen Geräte aus sind.',
				link: { href: '/help/sync', label: 'Live von deinen Geräten' }
			},
			deletes: {
				title: 'Löschungen von einem anderen Gerät',
				text: 'Wurden auf einem anderen Gerät viele Dateien auf einmal gelöscht, fragt dieses Gerät, bevor es folgt: „Hier auch löschen“ löscht sie hier. Bis du bestätigst, bleiben sie.'
			},
			remove: {
				title: 'Entfernen und trennen',
				text: 'Der Knopf neben einem anderen Gerät entfernt es nach einer Rückfrage: Es kann sich nicht mehr verbinden und bekommt nichts Neues, behält aber, was es schon hat. „Dieses Gerät trennen“ beendet nur den Abgleich hier; deine Dateien bleiben auf allen Geräten, und du kannst es später wieder verbinden. Ein entferntes Gerät sagt das und bietet an, neu anzufangen – mit oder ohne seine Dateien.',
				link: { href: '/help/sync', label: 'Geräte entfernen' }
			},
			explain: {
				title: 'So funktioniert’s und Diagnose',
				text: 'Das Fragezeichen neben „Deine Geräte“ öffnet „So funktioniert’s“: „Einfach“ erklärt das Prinzip, „Für Experten“ die Technik und zeigt, während Geräte verbunden sind, die Diagnose – wie jedes Gerät verbunden ist und welche Relays erreichbar sind. „Diagnose kopieren“ kopiert sie, z. B. für eine Fehlermeldung.'
			},
			log: {
				title: 'Fehlersuche',
				text: 'Unten in den Abgleich-Einstellungen kann „Fehlersuche“ ein Protokoll beider Abgleiche (Geräte und Ordner) aufzeichnen. Schalte es auf jedem beteiligten Gerät ein, lass das Problem noch einmal auftreten und wähle dann auf jedem „Protokoll exportieren“. Das Protokoll bleibt auf dem Gerät, bis du es exportierst; es enthält Datei- und Gerätenamen, schau es also durch, bevor du es weitergibst. „Protokoll leeren“ löscht es.'
			},
			node: {
				title: 'Abgleich ohne offenen Browser',
				text: 'Ein p2p-node auf einem Rechner oder Heimserver macht wie ein weiterer Browser bei deinen Geräten mit und ist ständig online – so erreichen Änderungen dein Handy auch, wenn auf keinem anderen Gerät in-browser offen ist.',
				link: { href: '/help/p2p-node', label: 'p2p-node einrichten' }
			}
		}
	},
	keys: {
		title: 'Tastenkürzel',
		items: {
			move: {
				title: 'Durch die Liste bewegen',
				text: 'Die Pfeiltasten wählen den vorigen oder nächsten Eintrag aus; mit gedrückter Umschalttaste erweitern sie die Auswahl. Kürzel wirken nicht, während du in einem Feld tippst oder ein Dialog offen ist.',
				keys: [['↑'], ['↓'], ['Umschalt', '↓']]
			},
			open: { title: 'Öffnen', text: 'Öffnet den ausgewählten Eintrag: einen Ordner in Dateien, ein Dokument in seinem Tool, andere Dateien in der Vorschau.', keys: [['Enter']] },
			up: { title: 'Einen Ordner nach oben', text: 'Wechselt in den Ordner, der den geöffneten enthält.', keys: [['Rücktaste'], ['Alt', '↑']] },
			preview: { title: 'Vorschau', text: 'Zeigt die ausgewählte Datei in der Vorschau.', keys: [['Leertaste']] },
			selectAll: { title: 'Alles auswählen und aufheben', text: 'Wählt jeden Eintrag des geöffneten Ordners aus; Esc hebt die Auswahl auf.', keys: [['Strg', 'A'], ['Esc']] },
			clipboard: { title: 'Kopieren, ausschneiden, einfügen', text: 'Kopiere oder schneide die Auswahl aus und füge sie dann in den geöffneten Ordner ein. Am Mac Cmd statt Strg.', keys: [['Strg', 'C'], ['Strg', 'X'], ['Strg', 'V']] },
			rename: { title: 'Umbenennen', text: 'Benennt den ausgewählten Eintrag um; Enter übernimmt den neuen Namen, Esc bricht ab.', keys: [['F2']] },
			delete: { title: 'Löschen', text: 'Verschiebt die Auswahl in den Papierkorb.', keys: [['Entf']] }
		}
	}
} satisfies HelpContent;

export default help;
