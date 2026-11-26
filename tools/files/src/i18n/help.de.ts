import type { HelpContent } from '@in-browser/brand/help.js';
import type enHelp from './help.en.js';

const help: typeof enHelp = {
	start: {
		title: 'Erste Schritte',
		items: {
			what: {
				title: 'Wozu Dateien da ist',
				text: 'Jedes Tool von in-browser legt seine Dokumente in einem gemeinsamen Speicher in diesem Browser ab: Aufnahmen und Projekte der Bildschirmaufnahme, Texte des Texteditors, PDFs. Das Tool Dateien zeigt diesen Speicher wie ein Laufwerk. Hier lädst du hoch und herunter, sortierst Dokumente in Ordner, benennst um, kopierst und löschst – und richtest das Synchronisieren mit einem Ordner auf deinem Rechner oder mit deinen anderen Geräten ein. Nichts wird auf einen Server hochgeladen.',
				link: { href: '/help/storage', label: 'Wo deine Dateien liegen' }
			},
			layout: {
				title: 'Aufbau',
				text: 'Die obere Leiste zeigt den Pfad des geöffneten Ordners – ein Klick auf eine Ebene führt dorthin zurück. Darunter liegt das Menüband: links „Rückgängig“, dann die Registerkarten „Start“ (Neu und „Hochladen“, Zwischenablage, Organisieren, Auswählen, Suchen), „Freigeben“ (für einen Gast freigeben, herunterladen), „Verbinden“ (einen Ordner deines Rechners verbinden, Zugriff erlauben, trennen), „Sync“ (jetzt synchronisieren, Sync-Einstellungen, Geräte) und „Ansicht“ (Liste oder Kacheln, sortieren, Seitenleisten, aktualisieren). Solange Einträge ausgewählt sind, enthält die farbig abgesetzte Registerkarte „Auswahl“, was du mit ihnen tun kannst (im Papierkorb: die Registerkarte „Papierkorb“); das Menüband wechselt von selbst dorthin und zurück zur vorherigen Registerkarte, sobald nichts mehr ausgewählt ist. Am linken Rand hält eine schmale Leiste die Seitenleisten „Ordner“ (zu Beginn offen: Meine Dateien als Baum, darunter deine verbundenen Ordner, am Ende der Papierkorb) und „Freigaben“; ein Klick öffnet eine neben der Liste, ein zweiter schließt sie, und an ihrem rechten Rand ziehst du sie breiter. In der Mitte der Inhalt des geöffneten Ordners. Die untere Zeile zählt die Elemente des Ordners, zeigt ein laufendes Hochladen, wie viel Speicher belegt ist und wie viele Elemente ausgewählt sind; ganz rechts zeigt das Sync-Symbol den Sync-Status, wie in jedem Tool.'
			},
			ribbon: {
				title: 'Darstellung des Menübands',
				text: 'Wird das Fenster schmaler, werden zuerst die Gruppen rechts kleiner: Ihre Schaltflächen verlieren den Text unter dem Symbol, dann den Text ganz, und zuletzt wird eine ganze Gruppe zu einer Schaltfläche, die sie öffnet. Die Schaltfläche mit dem Leisten-Symbol am rechten Ende der Registerkarten wählt, wie das Menüband aussieht – für alle Tools von in-browser auf diesem Gerät. Der Pfeil daneben klappt das Menüband zusammen: Nur die Registerkarten bleiben, und ein Klick auf eine öffnet ihre Befehle über der Seite, bis du einen wählst; ein Doppelklick auf eine Registerkarte oder Strg+F1 tun dasselbe, und der Pfeil holt das Menüband zurück, wie es war.',
				options: {
					classic: { label: 'Klassisch (Standard am Rechner)', text: 'Befehle in drei Zeilen mit ihren Namen, in Gruppen mit je einem Namen. Am leichtesten zu finden, braucht etwa 130 Pixel Höhe.' },
					simplified: { label: 'Vereinfacht', text: 'Eine kompakte Zeile Schaltflächen, ohne Gruppennamen. Lässt mehr Platz für die Liste.' },
					minimal: { label: 'Minimal (Standard auf Handy und Tablet)', text: 'Eine Zeile Symbole ohne Text; halte den Zeiger über ein Symbol – oder halte es gedrückt –, um seinen Namen zu sehen. Am wenigsten Höhe, und jeder Befehl bleibt erreichbar.' }
				},
				tip: 'Bleib bei „Klassisch“, bis du weißt, wo alles ist; dann schalte auf „Vereinfacht“ oder „Minimal“ – oder klapp das Menüband zusammen –, um mehr von der Liste zu sehen.',
				keys: [['Strg', 'F1']]
			},
			accessKeys: {
				title: 'Zugriffstasten',
				text: 'Drücke kurz Alt (oder F10): Auf den Registerkarten erscheinen Buchstaben, auf „Rückgängig“ eine Zahl. Tippe den Buchstaben einer Registerkarte, dann den Buchstaben auf einem Befehl, um ihn auszuführen – alles geht ohne Maus. Esc geht einen Schritt zurück.',
				keys: [['Alt'], ['F10']]
			},
			menus: {
				title: 'Wo die Aktionen sind',
				text: 'Ein Rechtsklick auf einen Eintrag zeigt alles, was du mit ihm oder der Auswahl tun kannst; ein Rechtsklick auf die freie Fläche zeigt, was du dem geöffneten Ordner hinzufügen kannst (Neu, Hochladen, Einfügen), „Alles auswählen“, „Aktualisieren“ und die Sortierung. Ordner in der Seitenleiste „Ordner“ haben dasselbe Menü wie in der Liste – dort benennst du den geöffneten Ordner selbst um, verschiebst oder löschst ihn oder siehst seine Eigenschaften; „Meine Dateien“ hat dort ein eigenes (öffnen, einfügen, herunterladen, Eigenschaften). Das Menüband enthält den Rest; seine Befehle wirken auf die Auswahl, die auch ohne eine gehen („Herunterladen“, „Freigeben …“), auf den geöffneten Ordner. Was gerade nicht geht – z. B. Änderungen in einem freigegebenen Ordner, den du nur ansehen darfst –, bleibt in den Menüs, ausgegraut.'
			},
			phone: {
				title: 'Am Handy',
				text: 'Auf Handy und Tablet beginnt das Menüband als „Minimal“: die Registerkarten in einer Zeile, darunter die Befehle der Registerkarte als Symbole, die sich seitwärts schieben lassen; halte ein Symbol gedrückt, um seinen Namen zu sehen. Der Pfeil rechts neben den Registerkarten klappt das Menüband zusammen, wenn du die Höhe brauchst. Die Seitenleisten öffnen sich über den ganzen Bildschirm über „Ansicht“ → „Seitenleisten“ und schließen sich, wenn du einen Ordner antippst. Du wechselst in Ordner, indem du sie antippst, und zurück über den Pfad in der oberen Leiste; die Suche steht in der Registerkarte „Start“. Statt eines Rechtsklicks hältst du einen Eintrag gedrückt oder tippst auf seinen ⋮-Knopf – auch in den Seitenleisten.'
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
				text: 'Doppelklicke einen Eintrag oder wähle ihn aus und drücke Enter. Ein Ordner öffnet sich in Dateien. Ein Dokument eines Tools (z. B. ein Projekt der Bildschirmaufnahme oder eine Textdatei) öffnet sich in diesem Tool; sein Symbol trägt dann das Symbol des Tools als kleine Kachel in der Ecke, ein Projekt zeigt das Symbol des Tools selbst. Können es mehrere Tools öffnen, bietet das Menü des Eintrags für jedes „Mit … öffnen“ an. Andere Dateien öffnen sich in der Vorschau. Manche davon lassen sich auch als Text bearbeiten: Das Menü eines SVG-Bilds bietet „Mit Texteditor öffnen“ an, ein Doppelklick zeigt das Bild. Auf Touchscreens öffnet ein Tippen. Soll dieser Ordner sichtbar bleiben, öffne einen Eintrag in einem neuen Browser-Tab: Klick ihn mit der mittleren Maustaste (dem Mausrad) an, oder „Öffnen“ bzw. „Mit … öffnen“ in seinem Menü – ein Ordner öffnet sich dort in Dateien, ein Dokument in seinem Tool. Das geht auch mit Ordnern in der Seitenleiste „Ordner“ und mit dem Papierkorb.'
			},
			select: {
				title: 'Auswählen',
				text: 'Ein Klick wählt einen Eintrag aus. Mit gedrückter Strg-Taste (Cmd am Mac) fügt ein Klick einen Eintrag zur Auswahl hinzu oder nimmt ihn heraus; mit gedrückter Umschalttaste wählt er alles zwischen dem zuletzt angeklickten Eintrag und diesem. Die Pfeiltasten verschieben die Auswahl, mit Umschalt erweitern sie sie. „Alles auswählen“ und „Auswahl aufheben“ stehen in der Registerkarte „Start“, in „Auswahl“ und in den Menüs; Esc oder ein Klick auf die freie Fläche heben die Auswahl ebenfalls auf. Die untere Zeile zählt, was ausgewählt ist; die Befehle des Menübands wirken auf die Auswahl, die ohne eine gehen („Herunterladen“, „Freigeben …“), auf den geöffneten Ordner.'
			},
			touch: {
				title: 'Auswählen auf dem Touchscreen',
				text: 'Halte einen Eintrag gedrückt: Der Auswahlmodus beginnt, der Eintrag bekommt ein Häkchen und sein Menü öffnet sich. Jedes weitere Tippen wählt dann einen Eintrag aus oder ab, statt ihn zu öffnen, und das Menüband wechselt zur Registerkarte „Auswahl“ mit allem, was du mit den ausgewählten Einträgen tun kannst – darunter „Alles auswählen“ und „Auswahl aufheben“, das den Modus beendet. Er endet auch, wenn du den letzten Eintrag abwählst. Der ⋮-Knopf eines Eintrags öffnet ebenfalls das Menü der Auswahl.'
			},
			preview: {
				title: 'Vorschau',
				text: '„Vorschau“ im Menü einer Datei oder in der Registerkarte „Auswahl“ (oder die Leertaste) zeigt Bilder, Videos, Audio und Text direkt in Dateien, ohne ein Tool zu öffnen. Textdateien über etwa 1 MB werden nicht gezeigt; für andere Arten gibt es keine Vorschau. „Herunterladen“ in der Vorschau speichert die Datei.'
			},
			properties: {
				title: 'Eigenschaften',
				text: '„Eigenschaften“ im Menü eines Eintrags oder in der Registerkarte „Auswahl“ zeigt Art, Ort, Größe und den Zeitpunkt der letzten Änderung. Bei einem Ordner zählt es die Größe von allem darin zusammen und zählt die enthaltenen Dateien und Ordner – für den geöffneten Ordner nimm sein Menü in der Seitenleiste „Ordner“.'
			},
		}
	},
	transfer: {
		title: 'Hochladen und herunterladen',
		items: {
			upload: {
				title: 'Hochladen',
				text: '„Hochladen“ (Registerkarte „Start“, Gruppe „Neu“) kopiert Dateien von deinem Rechner oder Handy in den geöffneten Ordner – „Dateien hochladen“ für einzelne Dateien, „Ordner hochladen“ für einen ganzen Ordner mit seinen Unterordnern (auf iPhone und iPad nicht angeboten). Du kannst Dateien oder Ordner auch von deinem Rechner auf die Liste ziehen: auf der freien Fläche abgelegt landen sie im geöffneten Ordner, auf einem Ordner in der Liste oder in der Seitenleiste „Ordner“ landen sie dort. Die untere Zeile zeigt, welche Datei gerade kopiert wird. „Hochladen“ heißt nur Kopieren in den Browserspeicher – nichts verlässt dein Gerät.'
			},
			download: {
				title: 'Herunterladen',
				text: '„Herunterladen“ im Menü einer Datei speichert sie, wie sie ist. Ordner, Projekte von Tools und mehrere ausgewählte Einträge werden als eine ZIP-Datei gespeichert („Als ZIP herunterladen“); die ZIP-Datei entsteht beim Speichern, so klappt es auch mit großen Ordnern. Chrome und Edge fragen, wohin gespeichert wird, andere Browser speichern in den Download-Ordner. „Herunterladen“ in der Registerkarte „Freigeben“ speichert die Auswahl – oder, wenn nichts ausgewählt ist, den ganzen geöffneten Ordner als ZIP.',
				tip: 'Für eine dauerhafte Sicherung von allem ist ein Ordner auf deinem Rechner, der synchronisiert bleibt, bequemer als Herunterladen von Hand.',
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
				text: '„Neuer Ordner“ und „Neue Textdatei“ (Registerkarte „Start“ oder Rechtsklick auf die freie Fläche) legen den Eintrag im geöffneten Ordner an und lassen dich gleich seinen Namen tippen. Eine neue Textdatei ist leer; öffnen bringt dich in den Texteditor.'
			},
			rename: {
				title: 'Umbenennen',
				text: '„Umbenennen“ im Menü eines Eintrags oder im Menüband (oder F2) macht aus dem Namen ein Feld; der Teil vor der Endung ist markiert, so bleibt die Art erhalten. Ein Klick auf den Namen des Eintrags, der schon als einziger ausgewählt ist, tut nach einem Moment dasselbe (ein Doppelklick öffnet ihn weiterhin). Den geöffneten Ordner selbst benennst du in der Liste des Ordners darüber um oder mit „Umbenennen“ in seinem Menü in der Seitenleiste „Ordner“ – nicht am Pfad in der oberen Leiste. Eingabe oder ein Klick daneben übernimmt den neuen Namen, Esc bricht ab. Namen, die nicht erlaubt sind (z. B. mit „/“), werden mit einer Meldung abgelehnt.'
			},
			move: {
				title: 'Verschieben und kopieren',
				text: 'Zieh Einträge auf einen Ordner in der Liste oder in der Seitenleiste „Ordner“, um sie dorthin zu verschieben; halte beim Ablegen Strg (Cmd oder Alt am Mac), um sie stattdessen zu kopieren. Ohne Ziehen: „Ausschneiden“ oder „Kopieren“, dann „Einfügen“ im Zielordner (Registerkarte „Start“ oder Rechtsklick auf die freie Fläche) oder „Einfügen“ im Menü eines Ordners. „Verschieben nach …“ lässt dich den Zielordner in einem Dialog wählen – am Handy der einfachste Weg. „Duplizieren“ legt eine Kopie im selben Ordner an. Ausgeschnittene Einträge sind blass, bis du sie einfügst.',
				tip: 'Verschiebe, wenn das Dokument nur noch am neuen Ort liegen soll. Kopiere oder dupliziere, wenn du eine Fassung ändern und die andere behalten willst – die Kopie ist ab dann ein eigenes Dokument, Änderungen an einem erreichen das andere nicht.'
			},
			undo: {
				title: 'Rückgängig',
				text: 'Nach Umbenennen, Verschieben, Einfügen, Duplizieren oder Löschen sagt eine Meldung, was passiert ist, und bietet ein paar Sekunden lang „Rückgängig“ an: Es benennt oder verschiebt die Einträge zurück legt die Kopien in den Papierkorb oder holt gelöschte Einträge wieder aus ihm heraus. „Rückgängig“ am linken Ende des Menübands (oder Strg+Z) tut dasselbe für den letzten solchen Schritt, auch wenn die Meldung schon weg ist. Endgültiges Löschen in einem verbundenen Ordner lässt sich nicht rückgängig machen.',
				keys: [['Strg', 'Z']]
			},
			search: {
				title: 'Suchen',
				text: 'Das Suchfeld in der Registerkarte „Start“ (Gruppe „Suchen“) filtert den geöffneten Ordner, während du tippst: Ein Eintrag bleibt, wenn jedes getippte Wort in seinem Namen vorkommt. Unterordner und der Inhalt von Dateien werden nicht durchsucht. Passt nichts, sagt die Liste das.'
			},
			view: {
				title: 'Sortieren und Ansicht',
				text: '„Liste“ und „Kacheln“ in der Registerkarte „Ansicht“ wechseln die Ansicht: „Liste“ zeigt Name, Art, Größe und den Zeitpunkt der letzten Änderung in Spalten, „Kacheln“ große Symbole, gut für viele Bilder. Die Wahl bleibt gespeichert. „Sortieren nach“ (Registerkarte „Ansicht“ oder Rechtsklick auf die freie Fläche) sortiert nach Name, Art, Größe oder Datum, aufsteigend oder absteigend; die aktuelle Wahl hat ein Häkchen. In der Liste sortiert ein Klick auf eine Spaltenüberschrift danach, ein zweiter kehrt die Reihenfolge um. Ordner stehen immer vorn.',
				options: {
					name: { label: 'Name (Standard)', text: 'Alphabetisch, Zahlen in ihrer natürlichen Reihenfolge („2“ vor „10“).' },
					kind: { label: 'Art', text: 'Nach Endung oder Tool, so stehen Dokumente einer Art beieinander.' },
					size: { label: 'Größe', text: 'Größte zuerst, wenn du es wählst – um zu finden, was Platz braucht.' },
					modified: { label: 'Geändert', text: 'Neueste zuerst, wenn du es wählst – um zu finden, woran du zuletzt gearbeitet hast.' }
				}
			},
		}
	},
	trash: {
		title: 'Papierkorb',
		items: {
			delete: {
				title: 'Löschen',
				text: '„Löschen“ im Menü (oder Entf) verschiebt die ausgewählten Einträge ohne Nachfrage in den Papierkorb. Ein Hinweis bietet ein paar Sekunden lang „Rückgängig“ an. Ist das Synchronisieren eingerichtet, verschwinden die Einträge auch auf deinen anderen Geräten und landen dort ebenfalls im Papierkorb – so holst du sie auf jedem Gerät zurück.',
				link: { href: '/help/sync', label: 'Löschen und Papierkorb mit mehreren Geräten' }
			},
			open: {
				title: 'Papierkorb öffnen',
				text: 'Der Papierkorb ist ein besonderer Ordner am Ende der Seitenleiste „Ordner“ (auf dem Handy: Registerkarte „Ansicht“ → „Ordner“). Klick ihn an, und er zeigt, was gelöscht wurde – hier oder auf einem anderen Gerät – wie einen Ordner: als Liste oder als Kacheln (Registerkarte „Ansicht“), genauso sortiert und durchsucht, mit den Spalten „Ursprünglicher Ort“ und „Gelöscht“; die Registerkarte „Papierkorb“ des Menübands enthält, was du damit tun kannst. Du kannst auch Einträge auf ihn ziehen, um sie zu löschen.'
			},
			restore: {
				title: 'Wiederherstellen',
				text: 'Wähle Einträge im Papierkorb aus wie in einem Ordner – ein Klick, Strg+Klick, Umschalt+Klick, Strg+A; auf dem Touchscreen wählt ein Tippen aus oder ab – und klick dann „Wiederherstellen“ in der Registerkarte „Papierkorb“ (oder im Menü eines Eintrags, oder drück die Eingabetaste): Sie kommen zurück in ihre alten Ordner, und eine Meldung sagt dir, wo einer gelandet ist. Ist ein Name inzwischen vergeben, bekommt der Eintrag eine Nummer, statt etwas zu überschreiben.'
			},
			remove: {
				title: 'Endgültig löschen',
				text: '„Endgültig löschen“ (oder Entf) entfernt die ausgewählten Einträge, „Papierkorb leeren“ alle – jeweils nach einer Rückfrage, auf allen deinen Geräten. Erst dann ist ihr Speicherplatz frei. „Papierkorb leeren“ bleibt ausgegraut, solange der Papierkorb leer ist.'
			},
			keep: {
				title: 'Wie lange er aufbewahrt',
				text: 'Der Papierkorb nennt, wie lange Einträge bleiben (30 Tage, wenn du nichts änderst). „In den Einstellungen ändern“ öffnet „Einstellungen“ → „Papierkorb“, wo du es für all deine Geräte wählst – auch über das Zahnrad oben rechts.',
				link: { href: '/help/settings#trash', label: 'Wie lange wählen' }
			},
			elsewhere: {
				title: 'Papierkorb im Ordner auf deinem Rechner',
				text: 'Im synchronisierten Ordner auf deinem Rechner und beim p2p-node ist der Papierkorb der versteckte Ordner „.in-browser-trash“. Dateien dort werden nach derselben Zeit entfernt.'
			}
		}
	},
	connected: {
		title: 'Verbundene Ordner',
		items: {
			connect: {
				title: 'Einen Ordner oder Server verbinden',
				text: '„Verbinden …“ (Registerkarte „Verbinden“ oder in der Seitenleiste „Ordner“ unter Meine Dateien) fragt, was du verbinden willst: Bei „Ordner auf diesem Rechner …“ wählst du einen Ordner, und der Browser fragt, ob in-browser ihn ansehen und bearbeiten darf (nur Chrome und Edge am Computer); „WebDAV-Server …“ und „S3-Speicher …“ fragen nach Adresse und Anmeldedaten und gehen in jedem Browser. Die Verbindung erscheint in der Seitenleiste „Ordner“ unter Meine Dateien mit ihrem Namen und öffnet sich live: Du siehst und änderst die Dateien direkt dort, nichts wird in den Browserspeicher kopiert und nichts synchronisiert.',
				tip: 'Verbinde einen Ordner, um Dateien dort zu bearbeiten, wo sie liegen (z. B. den Projektordner eines anderen Programms). Willst du stattdessen eine Kopie von Meine Dateien auf deinem Rechner? Nimm „Ordner auf deinem Rechner“ in den Sync-Einstellungen.',
				link: { href: '/help/connected', label: 'Verbundene Ordner' }
			},
			use: {
				title: 'Darin arbeiten',
				text: 'Alles geht wie in Meine Dateien: Öffnen, Vorschau, Hochladen, Herunterladen, Umbenennen, Verschieben und Kopieren – auch zwischen Meine Dateien und einem verbundenen Ordner (Ziehen vom einen ins andere kopiert, wie zwischen Laufwerken). Die untere Zeile zeigt „Live aus …“ statt der Speicherbelegung (bei einem für dich freigegebenen Ordner: „Freigegeben von … – eine Kopie auf diesem Gerät“). Notizbücher und Projekte öffnen sich direkt dort in ihrem Tool.'
			},
			access: {
				title: '„Zugriff erlauben“',
				text: 'Nach einem Neustart fragt der Browser meist erneut nach dem Zugriff. Der Ordner zeigt dann „Zugriff erlauben“ in der Seitenleiste „Ordner“ und wenn du ihn öffnest; klick darauf und bestätige die Frage des Browsers. Meldungen über eine fehlgeschlagene Aktion in so einem Ordner bieten „Zugriff erlauben“ ebenfalls an.',
				tip: 'Wähle „Bei jedem Besuch erlauben“ – dann bleibt er verbunden.'
			},
			manage: {
				title: 'Bearbeiten und trennen',
				text: 'Ein verbundener Ordner trägt den Namen des Ordners auf deinem Rechner, ein Server den Namen, den du ihm gegeben hast. „Bearbeiten …“ im Menü eines Servers ändert Namen, Adresse und Anmeldedaten (bleibt das Passwortfeld leer, gilt das gespeicherte); lehnt ein Server die Anmeldedaten ab, bieten Meldungen „Anmeldedaten ändern“ an. „Trennen“ – in der Registerkarte „Verbinden“, solange der Ordner offen ist, oder in seinem Menü in der Seitenleiste „Ordner“ (Rechtsklick, auf Touchscreens sein ⋮-Knopf) – entfernt ihn aus in-browser. Im Ordner wird nichts gelöscht.'
			},
			delete: {
				title: 'Löschen in einem verbundenen Ordner',
				text: 'Ein verbundener Ordner oder Server hat keinen Papierkorb von in-browser: „Löschen“ fragt erst „Endgültig löschen?“ und löscht dann sofort.'
			},
			share: {
				title: 'Für einen Gast freigeben',
				text: '„Freigeben …“ in der Registerkarte „Freigeben“ gibt die ausgewählte Datei oder den ausgewählten Ordner frei, sonst den geöffneten Ordner (in Meine Dateien; sonst fragt es, welchen Ordner) – ebenso im Menü einer Datei oder eines Ordners und „Ordner freigeben …“ in der Seitenleiste „Freigaben“. Es erzeugt einen Link und QR-Code für einen Browser außerhalb deiner Geräte – z. B. den Rechner eines Freundes, den du besuchst – und auf Wunsch vier Wörter zum Eintippen dort. Der Gast bekommt nur, was du freigegeben hast, als Kopie in seinem Browser, die mit diesem Gerät abgeglichen und beim Ende der Freigabe gelöscht wird; eine einzelne Datei öffnet sich dort in ihrem Tool. Wähle „Nur ansehen“ (Standard) oder „Bearbeiten“ und wie lange es gilt (standardmäßig einen Tag). Deine Freigaben stehen in der Seitenleiste „Freigaben“ (grüner Punkt: Gast verbunden); ein Klick zeigt den Link erneut, ein Rechtsklick (oder ⋮) bietet „Freigabe beenden“.',
				tip: '„Nur ansehen“, um Dateien weiterzugeben; „Bearbeiten“, wenn der Gast im Ordner speichern oder hochladen soll. Lass in-browser hier offen, solange er sie nutzt.',
				link: { href: '/help/connected#share', label: 'Für einen Gast freigeben' }
			},
			send: {
				title: 'An eine andere App senden',
				text: '„Senden …“ in der Registerkarte „Freigeben“, in „Auswahl“ und im Menü von Dateien gibt die ausgewählten Dateien an eine andere App dieses Geräts – Mail, einen Messenger, JW Library. Die App bekommt eine Kopie; danach bleibt nichts verbunden. Es geht nur für Dateien (nicht für Ordner) und nur für Arten, die dein Browser sendet – sonst ist es ausgegraut.',
				link: { href: '/help/install#system', label: 'Mit den anderen Apps deines Geräts' }
			},
			receive: {
				title: 'Dateien aus anderen Apps',
				text: 'Teilst du aus einer anderen App an das installierte in-browser (Android), kommen die Dateien hier an: Du wählst einen Ordner, und sie werden hineinkopiert. Eine einzelne PDF oder Textdatei öffnet sich stattdessen in ihrem Tool.',
				link: { href: '/help/install#system', label: 'Mit den anderen Apps deines Geräts' }
			},
			guest: {
				title: 'Eine Freigabe öffnen',
				text: 'Ein Link, den jemand für dich freigegeben hat, öffnet Dateien mit dem Ordner in der Seitenleiste „Ordner“ unter Meine Dateien, benannt nach ihm und dem, der ihn freigibt – dem Namen aus dessen Einstellungen, sonst dem seines Geräts (ein Schloss heißt nur ansehen); eine einzelne freigegebene Datei öffnet sich gleich in ihrem Tool. Ohne Link: „Verbinden …“ (unter Meine Dateien in der Seitenleiste „Ordner“ oder die Registerkarte „Verbinden“) → „Freigabe mit vier Wörtern …“ fragt nach den vier Wörtern, die das freigebende Gerät zeigt. Dein Browser merkt sich die Freigabe, bis sie endet, abläuft oder du „Trennen“ wählst; bis dahin liegt sie als abgeglichene Kopie in diesem Browser. Ist gerade ein anderer Browser drin, sagt Dateien das und versucht es selbst wieder. Kopiere Dateien nach Meine Dateien, um sie zu behalten. Endet die Freigabe, sagt Dateien das sofort; „Entfernen“ nimmt sie aus der Seitenleiste.',
				link: { href: '/help/connected#share', label: 'Vier Wörter statt des Links' }
			}
		}
	},
	folder: {
		title: 'Ordner auf deinem Rechner',
		items: {
			connect: {
				title: 'Mit einem Ordner synchronisieren',
				text: '„Sync-Einstellungen“ in der Registerkarte „Sync“ öffnet die Sync-Einstellungen; klick unter „Ordner auf deinem Rechner“ auf „Ordner wählen“ und wähle einen Ordner. Zuerst öffnet sich „Ordner für … auswählen“: jeder Ordner mit dem, was in den Browser käme und was in den Ordner ginge; nichts wird kopiert, bis du „Synchronisieren starten“ wählst („Später“ lässt ihn warten). Später ändert „Ordner auswählen …“ dort die Auswahl – ein abgewählter Ordner bleibt in Meine Dateien und im Ordner auf deinem Rechner, er wird nur nicht mehr abgeglichen. Ab dann hält Dateien den Browserspeicher und diesen Ordner in beide Richtungen gleich; wurde eine Datei auf beiden Seiten geändert, gewinnt die neuere Fassung. Das Synchronisieren läuft, solange irgendein Tool von in-browser in diesem Browser offen ist. Das können nur Chrome und Edge am Computer.',
				tip: 'Wähle einen leeren Ordner oder einen nur für in-browser – alles darin wird Teil von „Meine Dateien“. Ein Ordner, den dein Sync-Tool (Syncthing, Nextcloud, Dropbox …) mitnimmt, bringt deine Dokumente auch auf andere Rechner.',
				link: { href: '/help/storage', label: 'Der Ordner auf deinem Rechner' }
			},
			paused: {
				title: 'Pausiert: „Zugriff erlauben“',
				text: 'Der Browser erlaubt den Zugriff auf den Ordner oft nur, bis er geschlossen wird. Dann steht in den Sync-Einstellungen „Pausiert“, und Dateien ändert nichts im Ordner. Klicke auf „Zugriff erlauben“ und bestätige die Frage des Browsers; das Synchronisieren geht weiter und holt nach.',
				tip: 'Wähle in der Frage des Browsers „Bei jedem Besuch zulassen“ – dann läuft das Synchronisieren beim nächsten Mal von selbst weiter.'
			},
			deletes: {
				title: 'Löschungen im Ordner',
				text: 'Verschwinden viele Dateien auf einmal aus dem Ordner auf deinem Rechner, folgt Dateien nicht einfach: Die Sync-Einstellungen fragen, ob sie auch hier gelöscht werden sollen. „Auch hier löschen“ löscht sie in Dateien, „Stattdessen wiederherstellen“ schreibt sie zurück in den Ordner.',
				tip: 'Stelle sie wieder her, wenn du sie nicht absichtlich gelöscht hast – z. B. wenn ein Laufwerk fehlte oder ein Sync-Tool den Ordner geleert hat. Lösch sie auch hier, wenn du den Ordner selbst aufgeräumt hast.'
			},
			manage: {
				title: 'Jetzt synchronisieren und trennen',
				text: '„Jetzt synchronisieren“ (in den Sync-Einstellungen, oder in der Registerkarte „Sync“ für den Ordner und deine Geräte zugleich) synchronisiert sofort, statt auf die nächste Änderung zu warten. Lassen sich einzelne Dateien nicht synchronisieren, sagt eine Zeile, wie viele. „Trennen“ beendet das Synchronisieren mit dem Ordner; nichts wird gelöscht, weder in Dateien noch im Ordner, und du kannst jederzeit wieder einen Ordner wählen.'
			},
		}
	},
	devices: {
		title: 'Deine Geräte',
		items: {
			where: {
				title: 'Wo du es findest',
				text: 'Die Registerkarte „Sync“ enthält „Jetzt synchronisieren“, „Sync-Einstellungen“ (oben mit „Deine Geräte“), „Gerät hinzufügen“, „Ordner auswählen“ und „Auf diesem Gerät synchronisieren“. In jedem Tool zeigt das Sync-Symbol ganz rechts in der unteren Zeile den Stand und ein Warnsymbol, wenn etwas dich braucht; sein Menü führt mit „Geräte verwalten“ hierher.',
				link: { href: '/help/sync', label: 'Deine Geräte synchronisieren' }
			},
			first: {
				title: 'Die ersten Geräte verbinden',
				text: 'Klicke auf dem ersten Gerät auf „Geräte verbinden“: eine kurze Erklärung, dann ein Name für dieses Gerät (damit du sie auseinanderhältst), dann zeigt „Gerät hinzufügen“ einen Schlüssel als QR-Code. Auf dem zweiten Gerät scannst du den Code mit der Kamera, öffnest den Link aus „Link kopieren“ oder öffnest dort Dateien und tippst den Schlüssel unter „Schlüssel eingeben“ ein. Lass Dateien auf dem ersten Gerät geöffnet, bis das zweite hinzugefügt ist. Das zweite Gerät zeigt dann „Wähle, was dieses Gerät synchronisiert“: Hak ab, was es nicht bekommen soll, und wähle „Synchronisieren starten“ – vorher wird nichts übertragen.',
				link: { href: '/help/sync#connect', label: 'Geräte verbinden' }
			},
			held: {
				title: 'Wartende neue Ordner',
				text: 'Ein neuer Ordner, der größer ist als die Größe in den Einstellungen oder nicht in den freien Speicher des Browsers passt, wartet, statt anzukommen: Die Sync-Einstellungen zeigen ihn mit seiner Größe, unter „Deine Geräte“ oder „Ordner auf deinem Rechner“. „Synchronisieren“ holt ihn doch hierher, „Ausschließen“ lässt ihn aus; „Grenze ändern“ öffnet die Einstellungen.',
				link: { href: '/help/sync#changes', label: 'Große neue Ordner warten' }
			},
			add: {
				title: 'Weitere Geräte hinzufügen',
				text: '„Gerät hinzufügen“ (Registerkarte „Sync“ oder die Sync-Einstellungen) zeigt auf jedem verbundenen Gerät einen neuen Schlüssel. Er gilt einmal, für 24 Stunden, und nur, solange das Gerät, das ihn zeigt, online ist. Wer ihn hat, kann ein Gerät verbinden und alle deine synchronisierten Dateien lesen und ändern – gib ihn nur dir selbst.'
			},
			status: {
				title: 'Stand der Geräte',
				text: 'Die Liste zeigt dieses Gerät (ein Klick auf seinen Namen benennt es um) und jedes andere: verbunden, synchronisiert gerade, wann es zuletzt gesehen oder synchronisiert wurde. Hinweise in Warnfarbe sagen, wenn ein Gerät wahrscheinlich nicht aktuell ist, nicht erreichbar ist (oft Mobilfunk oder ein Firmennetz) oder ein Update braucht. Synchronisiert wird, solange mindestens zwei Geräte in-browser geöffnet haben; „Jetzt synchronisieren“ startet es sofort.',
				link: { href: '/help/sync', label: 'Wenn Geräte nicht synchronisieren' }
			},
			folders: {
				title: 'Ordner ausnehmen',
				text: '„Ordner auswählen“ (Registerkarte „Sync“) zeigt alle Ordner mit ihrer Größe und wo sie liegen – die dieses Geräts sofort, die nur auf deinen anderen Geräten, sobald sie antworten („Frage deine anderen Geräte …“; eines, das nicht innerhalb von 10 Sekunden antwortet, bleibt außen vor); nimm bei einem das Häkchen weg, damit er auf diesem Gerät nicht mehr synchronisiert wird. Für einen einzelnen Ordner: Wähle ihn aus (oder öffne ihn) und schalte „Auf diesem Gerät synchronisieren“ in der Registerkarte „Sync“ aus – dasselbe wie „Auf diesem Gerät nicht synchronisieren“ im Menü eines Ordners; zurück mit „Auf diesem Gerät wieder synchronisieren“. Die Kopie auf diesem Gerät wird gelöscht, die anderen Geräte behalten den Ordner. Er bleibt mit einer Wolke im Baum: Öffnest du ihn, wird er live von einem Gerät gelesen, das ihn hat, und du kannst darin arbeiten wie überall (Löschen landet im Papierkorb dieses Geräts). Ist keines davon verbunden, nennt Dateien, wo der Ordner liegt.',
				tip: 'Lass aus, was du hier selten brauchst, z. B. große Aufnahmen auf dem Handy – öffnen kannst du sie trotzdem live. Synchronisiere einen Ordner wieder, wenn du ihn brauchst, während deine anderen Geräte aus sind.',
				link: { href: '/help/sync', label: 'Live von deinen Geräten' }
			},
			deletes: {
				title: 'Löschungen von einem anderen Gerät',
				text: 'Wurden auf einem anderen Gerät viele Dateien auf einmal gelöscht, fragt dieses Gerät, bevor es folgt: „Hier auch löschen“ löscht sie hier. Bis du bestätigst, bleiben sie.'
			},
			remove: {
				title: 'Entfernen und trennen',
				text: 'Der Knopf neben einem anderen Gerät entfernt es nach einer Rückfrage: Es kann sich nicht mehr verbinden und bekommt nichts Neues, behält aber, was es schon hat. „Dieses Gerät trennen“ beendet nur das Synchronisieren hier; deine Dateien bleiben auf allen Geräten, und du kannst es später wieder verbinden. Ein entferntes Gerät sagt das und bietet an, neu anzufangen – mit oder ohne seine Dateien.',
				link: { href: '/help/sync', label: 'Geräte entfernen' }
			},
			explain: {
				title: 'So funktioniert’s und Diagnose',
				text: 'Das Fragezeichen neben „Deine Geräte“ öffnet „So funktioniert’s“: „Einfach“ erklärt das Prinzip, „Für Experten“ die Technik und zeigt, während Geräte verbunden sind, die Diagnose – wie jedes Gerät verbunden ist und welche Relays erreichbar sind. „Diagnose kopieren“ kopiert sie, z. B. für eine Fehlermeldung.'
			},
			log: {
				title: 'Fehlersuche',
				text: 'Unten in den Sync-Einstellungen kann „Fehlersuche“ ein Protokoll beider Arten des Synchronisierens (Geräte und Ordner) aufzeichnen. Schalte es auf jedem beteiligten Gerät ein, lass das Problem noch einmal auftreten und wähle dann auf jedem „Protokoll exportieren“. Das Protokoll bleibt auf dem Gerät, bis du es exportierst; es enthält Datei- und Gerätenamen, schau es also durch, bevor du es weitergibst. „Protokoll leeren“ löscht es.'
			},
			node: {
				title: 'Synchronisieren ohne offenen Browser',
				text: 'Ein p2p-node auf einem Rechner oder Heimserver macht wie ein weiterer Browser bei deinen Geräten mit und ist ständig online – so erreichen Änderungen dein Handy auch, wenn auf keinem anderen Gerät in-browser offen ist.',
				link: { href: '/help/p2p-node', label: 'p2p-node einrichten' }
			}
		}
	},
	keys: {
		title: 'Tastenkürzel',
		items: {
			focus: {
				title: 'Wann sie wirken',
				text: 'Die Tasten für die Liste wirken, solange die Liste den Fokus hat – nach einem Klick auf einen Eintrag oder die freie Fläche oder nach dem Wechsel in einen Ordner. Auf einer Schaltfläche, einem Menüeintrag oder in einem Feld drücken Eingabe und Leertaste stattdessen diese, und während du tippst oder ein Dialog offen ist, wirkt kein Kürzel. Menüs und Tooltips nennen die Taste jedes Befehls.'
			},
			move: {
				title: 'In der Liste bewegen',
				text: 'Die Pfeiltasten wählen den vorigen oder nächsten Eintrag; mit gedrückter Umschalttaste erweitern sie die Auswahl von dort, wo sie begann.',
				keys: [['↑'], ['↓'], ['Umschalt', '↓']]
			},
			open: { title: 'Öffnen', text: 'Öffnet den ausgewählten Eintrag: einen Ordner in Dateien, ein Dokument in seinem Tool, andere Dateien in der Vorschau.', keys: [['Eingabe']] },
			newTab: { title: 'In neuem Tab öffnen', text: 'Klick einen Eintrag oder einen Ordner in der Seitenleiste „Ordner“ mit der mittleren Maustaste an.' },
			up: { title: 'Einen Ordner nach oben', text: 'Wechselt in den Ordner, der den geöffneten enthält.', keys: [['Rücktaste'], ['Alt', '↑']] },
			preview: { title: 'Vorschau', text: 'Zeigt die ausgewählte Datei in der Vorschau.', keys: [['Leertaste']] },
			selectAll: { title: 'Alles auswählen und aufheben', text: 'Wählt jeden Eintrag des geöffneten Ordners aus; Esc hebt die Auswahl auf.', keys: [['Strg', 'A'], ['Esc']] },
			clipboard: { title: 'Kopieren, ausschneiden, einfügen', text: 'Kopiere oder schneide die Auswahl aus und füge sie dann in den geöffneten Ordner ein. Am Mac Cmd statt Strg.', keys: [['Strg', 'C'], ['Strg', 'X'], ['Strg', 'V']] },
			rename: { title: 'Umbenennen', text: 'Benennt den ausgewählten Eintrag um; Eingabe übernimmt den neuen Namen, Esc bricht ab.', keys: [['F2']] },
			delete: { title: 'Löschen', text: 'Verschiebt die Auswahl in den Papierkorb.', keys: [['Entf']] },
			undo: { title: 'Rückgängig', text: 'Nimmt das letzte Umbenennen, Verschieben, Einfügen, Duplizieren oder Löschen zurück.', keys: [['Strg', 'Z']] },
			ribbon: { title: 'Menüband', text: 'Strg+F1 zeigt oder verbirgt die Befehle des Menübands; Alt oder F10 zeigen die Zugriffstasten.', keys: [['Strg', 'F1'], ['Alt'], ['F10']] }
		}
	}
} satisfies HelpContent;

export default help;
