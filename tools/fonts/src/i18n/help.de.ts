import type enHelp from './help.en.js';

const help: typeof enHelp = {
	start: {
		title: 'Deine Schriften',
		items: {
			what: {
				title: 'Wofür „Schriften“ da ist',
				text: 'Schriften, die du hier hinzufügst, sind „Meine Schriften“ in jedem Tool, das Text formatiert – in den Textfeldern des PDF-Editors und bei Text und Sprechblasen der Bildschirmaufnahme: Das Menü „Schriftart“ zeigt sie unter den Schriften, die das Tool mitbringt, und „Schriften verwalten …“ an seinem Ende öffnet dieses Tool in einem neuen Tab. Die Startseite zeigt deine Schriften als Karten, jede in sich selbst geschrieben; ein Klick öffnet eine Schrift mit ihren Dateien. Sie liegen als Dateien in einem versteckten Ordner deiner Dateien und kommen so wie deine Dateien auf deine anderen Geräte (siehe die Hilfe zum Synchronisieren); eine Schrift, die auf einem Gerät fehlt, steht im Menü mit „(nicht auf diesem Gerät)“, und der Text erscheint in einer Ersatzschrift, bis sie da ist.',
				link: { href: '/help/sync', label: 'Synchronisieren zwischen Geräten' }
			},
			add: {
				title: 'Schriften hinzufügen',
				text: '„Aus Dateien hinzufügen …“ (Registerkarte „Start“) nimmt Schriftdateien aus deinen Dateien, „Vom Rechner importieren …“ Dateien deines Rechners; du kannst Schriftdateien auch auf die Seite ziehen oder eine Schriftdatei in Dateien öffnen („Mit Schriften öffnen“) und „Zu meinen Schriften hinzufügen“ wählen. TrueType- (.ttf) und OpenType-Dateien (.otf) funktionieren. Dateien derselben Familie – nach dem Namen in der Datei – ergeben eine Schrift mit bis zu vier Schnitten: normal, fett, kursiv und fett kursiv (von mehreren Stärken die, die normal und fett am nächsten sind). Ein Schnitt, der fehlt, wird im normalen gezeichnet, hier wie in Dokumenten.',
				tip: 'Füge alle vier Dateien einer Familie hinzu (normal, fett, kursiv, fett kursiv): Dann sehen Fett und Kursiv in deinen Texten so aus, wie sie gezeichnet wurden.'
			},
			family: {
				title: 'Eine Schrift und ihre Dateien',
				text: 'Die Seite einer Schrift zeigt jeden Schnitt in einem Beispiel und jede Datei mit Schnitt, Stärke, Anzahl der Zeichen, Version, Gestaltung, Urheberrecht und Lizenz, wie die Datei sie angibt. „Sagt über sich“ zeigt die eigene Angabe der Datei zum Einbetten in Dokumente. in-browser zeigt sie, hält dich aber nie ab – ob du eine Schrift verwenden darfst, regeln du und ihre Lizenz.'
			},
			organize: {
				title: 'Auswählen und löschen',
				text: 'Ein Klick öffnet eine Schrift; Strg+Klick oder Umschalt+Klick wählen mehrere aus, Strg+A alle. „Löschen“ verschiebt die Dateien der ausgewählten Schriften in den Papierkorb – „Rückgängig“ in der Meldung holt sie zurück. Auf einem Touchscreen öffnet langes Drücken das Menü einer Schrift und beginnt das Auswählen; jede Karte hat auch einen ⋯-Knopf. Das Feld in der Gruppe „Vorschau“ ändert den Beispieltext der Karten, das Größenfeld seine Größe; beides wird auf diesem Gerät gemerkt.',
				keys: [['Strg', 'A'], ['Entf']]
			}
		}
	},
	catalog: {
		title: 'Der Katalog',
		items: {
			search: {
				title: 'Suchen und installieren',
				text: '„Online suchen“ öffnet den Katalog freier Schriften (Fontsource – die Schriften von Google Fonts und mehr). Gefragt wird erst, wenn du suchst oder eine Art von Schrift wählst: Tippe einen Namen und drücke „Suchen“, oder wähle eine Art in der Reihe von Knöpfen über der Liste – „Alle“, „Serifenlos“, „Serifen“, „Auszeichnung“, „Handschrift“, „Feste Breite“, „Andere“; eine Art ohne Namen listet alle ihre Schriften, ein Name sucht innerhalb der Art. Die gewählte Art wird gemerkt. Bis zu 150 Ergebnisse werden gezeigt; tippe mehr vom Namen, um sie einzugrenzen. Auf einem breiten Bildschirm scrollen Liste und Vorschau jede für sich; auf dem Handy bleibt die gewählte Schrift über der Liste stehen. Ein Klick auf ein Ergebnis zeigt es in einer Vorschau; wähle die Zeichen, die es enthalten soll, und drücke „Installieren“ – seine Dateien für normal, fett, kursiv und fett kursiv (soweit die Schrift sie hat) kommen zu deinen Schriften und funktionieren danach auch offline.',
				options: {
					subset: { label: '„Zeichen“', text: 'Der Katalog teilt eine Schrift in Zeichensätze. „latin“ enthält die Buchstaben westeuropäischer Sprachen (Deutsch, Französisch, Spanisch …), „latin-ext“ die des übrigen Europas (Polnisch, Tschechisch, Türkisch …); andere Sätze für Griechisch, Kyrillisch und mehr, wo die Schrift sie hat.' }
				},
				tip: 'Für deutschen oder englischen Text reicht „latin“; für einen Text mit polnischen oder tschechischen Namen nimm „latin-ext“.'
			},
			privacy: {
				title: 'Was der Katalog sieht',
				text: 'Das Suchen (auch das Wählen einer Art von Schrift) fragt Fontsource (api.fontsource.org) nach der Liste der Schriften, das Installieren lädt die Dateien von jsDelivr. Beide sehen deine IP-Adresse, die Suche und die Schrift, die du installierst – nichts von deinen Dateien. Nur diese Seite des Tools erreicht sie; keine andere Seite von in-browser.'
			}
		}
	}
};

export default help;
