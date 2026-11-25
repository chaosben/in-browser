import { BRAND } from '@in-browser/brand/brand.js';
import type enHelp from './help.en.js';

/** CORS rule a bucket needs for the site (help page “Connected folders”) */
const s3Cors = JSON.stringify([{ AllowedOrigins: [BRAND.suiteUrl], AllowedMethods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'], AllowedHeaders: ['*'], ExposeHeaders: ['ETag'], MaxAgeSeconds: 3600 }]);

const install = {
	unix: `curl -fsSL ${BRAND.suiteUrl}/p2p-node/install.sh | sh`,
	windows: `irm ${BRAND.suiteUrl}/p2p-node/install.ps1 | iex`
};

const help: typeof enHelp = {
	title: 'Hilfe',
	intro: 'Wie die Tools von in-browser funktionieren, wo deine Dateien liegen und wie sich deine Geräte synchronisieren.',
	searchLabel: 'Hilfe durchsuchen',
	searchPlaceholder: 'Ganze Hilfe durchsuchen …',
	noMatch: (query) => `Nichts in der Hilfe passt zu „${query}“.`,
	suite: 'Alles rund um in-browser',
	tools: 'Tools',
	toolTitle: (tool) => `Hilfe zu ${tool}`,
	toolSummary: (tool) => `Alles zu ${tool}, Schritt für Schritt`,
	openTool: (tool) => `${tool} öffnen`,
	contents: 'Inhalt',
	allHelp: 'Ganze Hilfe',

	pages: {
		storage: {
			title: 'Deine Dateien und der Speicher',
			summary: 'Wo deine Dateien liegen, wie viel Platz sie brauchen und wie du eine Kopie behältst',
			topics: {
				where: {
					title: 'Wo deine Dateien liegen',
					items: {
						browser: {
							title: 'In deinem Browser, nicht auf einem Server',
							text: 'Jedes Tool von in-browser speichert in einen Speicher deines Browsers auf diesem Gerät. Nichts wird hochgeladen – es gibt keinen Server, der deine Dateien speichern könnte. Alle Tools teilen sich diesen Speicher: eine PDF aus dem PDF-Editor, ein Projekt aus der Bildschirmaufnahme und ein Text aus dem Texteditor sind dort Dateien. Das Tool Dateien zeigt und verwaltet sie, wie der Dateimanager deines Rechners.'
						},
						perBrowser: {
							title: 'Ein Speicher pro Browser',
							text: 'Der Speicher gehört zu diesem Browser auf diesem Gerät. Ein anderer Browser, ein anderes Browserprofil oder ein privates Fenster hat einen eigenen, leeren Speicher. Wenn du die Websitedaten dieser Seite löschst oder den Browser zurücksetzt oder deinstallierst, ist er weg.',
							tip: 'Halte eine Kopie woanders – in einem Ordner auf deinem Rechner oder auf deinen anderen Geräten –, wenn dir deine Dateien wichtig sind.'
						},
						kept: {
							title: 'Dauerhaft aufbewahrt',
							text: 'Wenn du zum ersten Mal etwas speicherst, bittet in-browser den Browser, seinen Speicher auch dann zu behalten, wenn der Platz knapp wird. Chrome und Edge entscheiden das selbst (eher bei einer Seite, die du oft benutzt oder installiert hast), Firefox fragt dich. Safari löscht die Daten von Seiten, die du sieben Tage nicht geöffnet hast; auf dem Home-Bildschirm (iPhone, iPad) oder im Dock (Mac) behält eine Seite ihre Daten. Solange der Browser nicht zugestimmt hat und nichts synchronisiert wird, steht in der Fußzeile von Dateien „Der Browser kann diesen Speicher leeren“.',
							tip: 'Verlass dich nicht allein auf den Browser: Synchronisiere mit einem Ordner auf deinem Rechner oder mit einem anderen Gerät. Dann kostet dich ein geleerter Speicher nichts.'
						},
						tabs: {
							title: 'Mehrere Tabs',
							text: 'Alle Tabs dieses Browsers sehen dieselben Dateien. Änderungen aus einem anderen Tab erscheinen von selbst. Ein Dokument, das in einem Tab zum Bearbeiten offen ist, kann in einem zweiten gesperrt sein – das Tool sagt es dann.'
						},
						connected: {
							title: 'Ordner, die auf deinem Rechner bleiben',
							text: 'Neben Meine Dateien kann Dateien Ordner auf deinem Rechner live öffnen („Verbunden“). Sie belegen keinen Platz im Browserspeicher.',
							link: { href: '/help/connected', label: 'Verbundene Ordner' }
						}
					}
				},
				copy: {
					title: 'Eine Kopie behalten',
					items: {
						folder: {
							title: 'Ordner auf deinem Rechner',
							text: 'Wähle in Dateien „Ordner auf deinem Rechner“ → „Ordner wählen“. Bevor etwas kopiert wird, zeigt „Ordner auswählen“, was hierher käme und was dorthin ginge; „Synchronisieren starten“ legt los. Ab dann werden die Dateien in beide Richtungen mit diesem echten Ordner synchronisiert: Die neuere Version gewinnt, Löschungen im Ordner bestätigst du, bevor sie hier gelten. Das Synchronisieren läuft, solange in-browser in diesem Browser offen ist – die Übersicht oder irgendein Tool. Nach einem Neustart fragt der Browser vielleicht erneut nach Zugriff: In den Sync-Einstellungen steht dann „Pausiert“, und „Zugriff erlauben“ setzt fort. Nur Chrome und Edge am Rechner können auf Ordner zugreifen.',
							tip: 'Wähle einen Ordner, den dein Sync-Programm (Syncthing, Nextcloud, Dropbox …) oder deine Datensicherung schon erfasst – dann kommen deine Dateien von selbst auf deine anderen Rechner und in die Sicherung. Fragt der Browser erneut nach Zugriff, wähle „Bei jedem Besuch zulassen“, dann läuft das Synchronisieren ohne Nachfrage weiter.'
						},
						devices: {
							title: 'Auf deinen anderen Geräten',
							text: 'Verbinde dein Telefon, deinen Laptop oder dein Tablet in Dateien unter „Deine Geräte“: Die Dateien synchronisieren sich dann direkt untereinander, ohne Cloud. Jedes Gerät hat eine vollständige Kopie.',
							link: { href: '/help/sync', label: 'Synchronisieren zwischen deinen Geräten' }
						},
						download: {
							title: 'Herunterladen',
							text: 'Markiere in Dateien die gewünschten Dateien und dann „Herunterladen“, oder „Als ZIP herunterladen“ für einen Ordner oder mehrere Dateien. Die meisten Tools exportieren ihre Dokumente außerdem in gängige Formate, z. B. Bildschirmaufnahmen als MP4.'
						}
					}
				},
				space: {
					title: 'Speicherplatz',
					items: {
						quota: {
							title: 'Wie viel passt',
							text: 'Browser geben einer Seite einen Anteil am freien Platz des Geräts – meist einen großen. Die Fußzeile von Dateien zeigt, wie viel in-browser belegt und wie viel der Browser erlaubt. Aufnahmen und importierte Videos brauchen den meisten Platz, Texte sehr wenig. Ist der Speicher voll, sagt das Speichern es („… passt nicht mehr: Der Speicher dieses Browsers ist voll“), und die Synchronisierung lässt Dateien aus, die nicht passen, bis wieder Platz ist.'
						},
						free: {
							title: 'Platz freigeben',
							text: 'Was du löschst, landet zuerst im Papierkorb und belegt dort weiter Platz. Frei wird er, wenn der Papierkorb geleert wird – von Hand in Dateien („Papierkorb“ → „Papierkorb leeren“) oder von selbst nach der Zeit, die du in den Einstellungen („Papierkorb“) gewählt hast.',
							link: { href: '/help/sync#trash', label: 'So funktioniert der Papierkorb' }
						}
					}
				}
			}
		},

		sync: {
			title: 'Synchronisieren zwischen deinen Geräten',
			summary: 'Verbinde Telefon, Laptop und Tablet – direkt, verschlüsselt, ohne Cloud',
			topics: {
				basics: {
					title: 'So funktioniert’s',
					items: {
						direct: {
							title: 'Direkt zwischen deinen Geräten',
							text: 'Deine Geräte tauschen ihre Dateien direkt miteinander aus, verschlüsselt, ohne Cloud und ohne Konto. Jedes Gerät hat eine vollständige Kopie der synchronisierten Dateien und funktioniert auch ohne die anderen.'
						},
						connected: {
							title: 'Nur Meine Dateien',
							text: 'Synchronisiert werden Meine Dateien. Ordner unter „Verbunden“ bleiben, wo sie sind, und reisen nicht zu deinen anderen Geräten.',
							link: { href: '/help/connected', label: 'Verbundene Ordner' }
						},
						when: {
							title: 'Wann sich Geräte synchronisieren',
							text: 'Zwei Geräte synchronisieren sich, solange auf beiden in-browser offen ist – ein Tab reicht, die Übersicht oder irgendein Tool, auch im Hintergrund. Auf dem Telefon muss die Seite im Vordergrund sein. Was ein Gerät verpasst hat, holt es nach, sobald es wieder auf eines der anderen trifft; der Hinweis „Wahrscheinlich nicht aktuell“ in Dateien zeigt, welchem Gerät noch Änderungen fehlen könnten.',
							tip: 'Sind deine Geräte selten gleichzeitig offen, richte einen p2p-node auf einem Rechner oder Heimserver ein, der immer läuft: Er synchronisiert sich mit jedem Gerät, sobald es offen ist.'
						},
						p2pNode: {
							title: 'Immer an: der p2p-node',
							text: 'Ein kleines Programm für einen Rechner oder Heimserver, das sich wie ein Browser zu deinen Geräten gesellt und die Dateien in einem gewöhnlichen Ordner hält. Änderungen kommen dann auch an, wenn deine anderen Geräte nie gleichzeitig online sind.',
							link: { href: '/help/p2p-node', label: 'p2p-node einrichten' }
						},
						browsers: {
							title: 'Browser',
							text: 'Das Synchronisieren zwischen Geräten funktioniert in aktuellen Versionen von Chrome, Edge, Firefox und Safari, am Rechner und auf dem Telefon.'
						}
					}
				},
				connect: {
					title: 'Ein Gerät verbinden',
					items: {
						first: {
							title: 'Auf einem Gerät, das du schon nutzt',
							text: 'Öffne Dateien, dann „Deine Geräte“ → „Geräte verbinden“. Gib diesem Gerät einen Namen, an dem du es erkennst, z. B. „Laptop Büro“, und wähle „Verbinden“. Ein QR-Code und ein Schlüssel erscheinen. Für weitere Geräte später: „Deine Geräte“ → „Gerät hinzufügen“.'
						},
						second: {
							title: 'Auf dem neuen Gerät',
							text: 'Scanne den QR-Code mit der Kamera deines Telefons – der Link öffnet dort in-browser. Oder öffne Dateien auf dem neuen Gerät, wähle „Deine Geräte“ → „Schlüssel eingeben“ und tippe den Schlüssel ein. Lass in-browser auf dem ersten Gerät offen, bis das neue verbunden ist.'
						},
						key: {
							title: 'Der Schlüssel',
							text: 'Ein Schlüssel gilt einmal, 24 Stunden lang und nur, solange das Gerät online ist, das ihn zeigt.',
							tip: 'Wer den Schlüssel hat, kann ein Gerät verbinden und alle synchronisierten Dateien lesen und ändern. Gib ihn nur auf deinen eigenen Geräten ein und schick ihn nie jemandem.'
						},
						setup: {
							title: 'Erst ansehen, dann synchronisieren',
							text: 'Gleich nach dem Verbinden zeigt das neue Gerät „Wähle, was dieses Gerät synchronisiert“: jeden Ordner mit dem, was hierher käme („… kommt hierher“), was nur dieses Gerät hat („… geht an deine Geräte“), und den freien Platz im Browser. Nichts wird übertragen, bis du „Synchronisieren starten“ wählst. Ordner, die die Größe aus den Einstellungen erreichen („groß“) oder nicht in den freien Platz passen („passt nicht“), sind zuerst abgewählt – hak sie an, wenn du sie hier haben willst. „Später“ lässt das Gerät warten; „Deine Geräte“ → „Ordner auswählen …“ holt die Auswahl zurück.',
							tip: 'Wähle auf einem Telefon ab, was du dort nicht brauchst (Aufnahmen, Archive) – öffnen kannst du es trotzdem live. Ordner, die nur auf dem neuen Gerät liegen, kannst du nicht abwählen: Sie gehen immer an deine anderen Geräte.',
							link: { href: '/help/settings#sync', label: 'Größe, ab der gefragt wird' }
						},
						folders: {
							title: 'Ordner auswählen',
							text: 'Unter „Ordner auswählen“ legst du pro Gerät fest, welche Ordner es bekommt. Abgewählte Ordner bleiben auf den anderen Geräten und synchronisieren sich dort weiter – nur dieses Gerät bekommt sie nicht, und seine Kopie wird hier gelöscht. Einen Ordner auszulassen löscht ihn nirgendwo sonst.',
							tip: 'Lass große Ordner (z. B. Bildschirmaufnahmen) auf einem Telefon mit wenig Platz aus – öffnen kannst du sie trotzdem live.'
						},
						live: {
							title: 'Live von deinen Geräten',
							text: 'Ein Ordner, den dieses Gerät nicht synchronisiert, erscheint trotzdem in Dateien, mit einer Wolke statt des Ordnersymbols. Öffnest du ihn, liest dieses Gerät ihn live von einem deiner Geräte, das ihn hat – einem p2p-node oder einem Browser mit offenem in-browser. Jedes Tool funktioniert dort: öffnen, speichern, hochladen, umbenennen, löschen (in den Papierkorb jenes Geräts). Videos spielen schon beim Laden, geholt wird nur der Teil, den du ansiehst. Die Änderungen synchronisieren sich von jenem Gerät zu den anderen. Ist keins davon verbunden, sagt Dateien das und nennt, wo der Ordner liegt.',
							tip: 'Ordner, die du auf diesem Gerät selten brauchst: auslassen und live öffnen. Synchronisiere den Ordner wieder („Auf diesem Gerät wieder synchronisieren“), wenn du ihn ohne die anderen Geräte brauchst.'
						}
					}
				},
				changes: {
					title: 'Änderungen, Konflikte und Löschen',
					items: {
						newer: {
							title: 'Die neuere Version gewinnt',
							text: 'Hat sich eine Datei seit dem letzten Sync auf zwei Geräten geändert, behält die neuere Version den Namen, die andere bleibt als Konfliktkopie daneben erhalten. Ein Projekt der Bildschirmaufnahme ist ein Dokument: Dort bleibt das ganze Dokument, wie es auf diesem Gerät war, als Kopie erhalten, z. B. „Reise (Konflikt Laptop)“ neben „Reise“. Nichts geht verloren; sieh dir beide an und lösche die, die du nicht brauchst.',
							tip: 'Bevor du auf einem Gerät weitermachst, das länger nicht offen war, öffne zuerst in-browser auf einem deiner anderen Geräte und lass es synchronisieren. Dateien warnt dich, wenn dieses Gerät wahrscheinlich hinterher ist.'
						},
						open: {
							title: 'Eine geöffnete Datei',
							text: 'Ändert sich eine Datei, die du in einem Tool offen hast, woanders – auf einem anderen Gerät, in einem anderen Tab oder durch ein anderes Programm – und hast du keine ungespeicherten Änderungen, fragt das Tool „… wurde woanders geändert“, bevor es die andere Version zeigt. Jedes Tool fragt gleich, einmal pro Version. Hast du ungespeicherte Änderungen, behält das Tool sie und sagt es dir (Texteditor und PDF-Editor pausieren das Speichern und lassen dich in einer Leiste wählen).',
							options: {
								reload: { label: 'Neu laden', text: 'Zeigt die andere Version. Von dir geht nichts verloren – ungespeicherte Änderungen gab es keine.' },
								keep: { label: 'Nicht neu laden', text: 'Zeigt weiter deine Version. Änderst du sie, sagt dir das Tool Bescheid, bevor deine Version die andere ersetzt (die Bildschirmaufnahme schreibt darüber).' },
								dontAsk: { label: 'Nicht mehr fragen, solange die Datei offen ist', text: 'Trifft bei weiteren Änderungen dieselbe Wahl ohne Frage, bis du die Datei schließt. Öffnest du sie wieder, fragt es wieder.' }
							},
							tip: 'Arbeitest du auf zwei Geräten gleichzeitig an derselben Datei? Wähl auf dem, auf dem du nur schaust, „Neu laden“ und „Nicht mehr fragen“.'
						},
						safe: {
							title: 'Was sich zwischendurch ändert, wird nicht überschrieben',
							text: 'Unmittelbar bevor ein Gerät eine Datei überschreibt oder löscht, prüft es, ob sie noch die Version ist, mit der es geplant hat. Hast du sie inzwischen geändert, bleibt deine Änderung und wird beim nächsten Durchgang synchronisiert.'
						},
						deletions: {
							title: 'Löschen',
							text: 'Was du auf einem Gerät löschst, wird auch auf den anderen gelöscht und landet im Papierkorb. Wurden auf einem anderen Gerät viele Dateien auf einmal gelöscht, fragt Dateien vorher: „Hier auch löschen“.'
						},
						large: {
							title: 'Große neue Ordner warten',
							text: 'Käme ein neuer Ordner auf ein Gerät und ist er größer als die Größe in den Einstellungen oder passt nicht in den freien Speicher des Browsers, wartet er: Der Sync-Dialog in Dateien sagt „Neuer Ordner … wartet auf deine Bestätigung“, die Fußzeile jedes Tools „Neuer Ordner … wartet“. Alles andere synchronisiert weiter. Für den Ordner auf deinem Rechner gilt dasselbe: Dort zählt, was in den Browser kommt. Ein p2p-node wartet nie, er hat die Platte für sich.',
							options: {
								sync: { label: 'Synchronisieren', text: 'Der Ordner kommt doch auf dieses Gerät.' },
								exclude: { label: 'Ausschließen', text: 'Dieses Gerät lässt den Ordner aus (er bleibt auf den anderen Geräten, hier öffnet er sich live). Beim Ordner auf deinem Rechner: Er bleibt an beiden Orten und wird nur nicht abgeglichen.' }
							},
							tip: 'Wähle „Synchronisieren“, wenn das Gerät den Platz hat und du den Ordner offline brauchst, sonst „Ausschließen“. Fragt es dir zu oft, erhöhe die Größe mit „Grenze ändern“.',
							link: { href: '/help/settings#sync', label: 'Vor dem Synchronisieren neuer Ordner fragen ab' }
						}
					}
				},
				trash: {
					title: 'Papierkorb',
					items: {
						everywhere: {
							title: 'Auf allen deinen Geräten',
							text: 'Was du in Dateien löschst – oder ein Projekt in seinem Tool –, landet im Papierkorb, und zwar auf jedem Gerät. So holst du es auf jedem davon zurück: Dateien → „Papierkorb“ → „Wiederherstellen“.'
						},
						keep: {
							title: 'Wie lange',
							text: 'Wie lange Gelöschtes bleibt (30 Tage, wenn du nichts änderst), stellst du unter „Einstellungen“ (Zahnrad oben rechts) → „Papierkorb“ ein, für all deine Geräte.',
							link: { href: '/help/settings#trash', label: 'Wie lange wählen' }
						},
						folder: {
							title: 'In einem Ordner auf der Festplatte',
							text: 'Im synchronisierten Ordner auf deinem Rechner und bei einem p2p-node ist der Papierkorb der versteckte Ordner „.in-browser-trash“. Dateien, die du in so einem Ordner mit einem anderen Programm löschst, werden als Löschung synchronisiert – die behält der Papierkorb deines Systems.'
						}
					}
				},
				devices: {
					title: 'Geräte verwalten',
					items: {
						remove: {
							title: 'Ein Gerät entfernen',
							text: 'Öffne in Dateien unter „Deine Geräte“ das Menü eines Geräts und wähle „Gerät entfernen“. Es kann sich nicht mehr verbinden und bekommt nichts Neues. Was es schon hat, bleibt darauf – aus der Ferne löschen geht nicht.',
							tip: 'Telefon verloren? Entferne es gleich von einem anderen Gerät aus; die übrigen Geräte nutzen dann neue Verbindungsgeheimnisse.'
						},
						leave: {
							title: 'Dieses Gerät trennen',
							text: '„Dieses Gerät trennen“ beendet das Synchronisieren hier. Deine Dateien bleiben auf diesem Gerät und auf den anderen; später kannst du es mit einem neuen Schlüssel wieder verbinden.'
						}
					}
				},
				privacy: {
					title: 'Datenschutz und Sicherheit',
					items: {
						encrypted: {
							title: 'Durchgehend verschlüsselt',
							text: 'Dateien gehen direkt über verschlüsselte Verbindungen (WebRTC) zwischen deinen Geräten. Jedes Gerät hat ein eigenes Schlüsselpaar, das es nie verlässt; ein Gerät kommt nur mit einem Einmalschlüssel von einem deiner Geräte dazu.'
						},
						relays: {
							title: 'Was Dritte sehen',
							text: 'Um sich zu finden, legen die Geräte verschlüsselte Verbindungsangebote auf öffentlichen Nostr-Relays ab. Die Relays sehen IP-Adressen und Zeitpunkte, aber weder deine Dateien noch Datei- oder Gerätenamen. Ein STUN-Server von Cloudflare nennt jedem Gerät seine öffentliche Adresse.'
						}
					}
				},
				trouble: {
					title: 'Wenn sich Geräte nicht verbinden',
					items: {
						unreachable: {
							title: '„Online, aber nicht erreichbar“',
							text: 'Beide Geräte sind online, aber das Netz blockiert direkte Verbindungen – oft Mobilfunk, Firmen- oder Hotel-WLAN. Einen Umweg-Server für Dateien gibt es nicht. Versuch es im selben WLAN, oder richte zu Hause einen p2p-node mit freigegebenen Ports ein: Den erreichen deine Geräte fast überall.'
						},
						outdated: {
							title: '„Braucht ein Update“ oder „Hat eine neuere Version“',
							text: 'Geräte synchronisieren nur, solange auf ihnen dieselbe Version läuft. „Braucht ein Update“: Auf dem anderen Gerät läuft eine ältere – öffne dort in-browser und lade die Seite neu. „Hat eine neuere Version“: Dieses Gerät ist das ältere – lade diese Seite neu. Ein p2p-node aktualisiert sich innerhalb einer Stunde selbst.'
						},
						diagnostics: {
							title: 'Diagnose',
							text: 'In Dateien zeigt „Deine Geräte“ → „So funktioniert’s“ → „Für Experten“, wie jedes Gerät verbunden ist und ob die Relays erreichbar sind. „Diagnose kopieren“ kopiert das für eine Fehlermeldung.'
						}
					}
				}
			}
		},

		connected: {
			title: 'Verbundene Ordner',
			summary: 'Öffne einen Ordner auf deinem Rechner, einen WebDAV-Server oder S3-Speicher live in jedem Tool – nichts wird in den Browser kopiert',
			topics: {
				basics: {
					title: 'Meine Dateien und Verbunden',
					items: {
						rule: {
							title: 'Zwei Arten von Speicher',
							text: '„Meine Dateien“ liegen im Speicher deines Browsers und reisen mit deinen Geräten. Was unter „Verbunden“ steht, gehört nicht dazu und reist nie mit deinen Geräten. Ein Ordner auf deinem Rechner oder einem Server bleibt, wo er ist: in-browser öffnet ihn live, liest und speichert direkt dort und behält keine Kopie. Was dir jemand freigibt, ist die eine Ausnahme: Es wird in diesen Browser kopiert, damit es ohne das freigebende Gerät funktioniert, liegt getrennt von Meine Dateien und wird gelöscht, wenn die Freigabe endet. Trennst du eines davon, bleibt nichts davon im Browser.'
						},
						everywhere: {
							title: 'In jedem Tool',
							text: 'Verbundene Ordner erscheinen in Dateien in der Seitenleiste „Ordner“ unter Meine Dateien und im Öffnen- und Speichern-Dialog der Tools (die Auswahl vor dem Ordnerpfad). Jedes Tool öffnet und speichert direkt dort: Texte im Texteditor, PDFs im PDF-Editor, Projekte und Aufnahmen in der Bildschirmaufnahme. Die Startseite der Bildschirmaufnahme zeigt Projekte aus verbundenen Ordnern, sobald du sie dort angelegt oder geöffnet hast – verbundene Ordner werden nicht durchsucht, sie können groß sein.'
						},
						notSynced: {
							title: 'Nicht synchronisiert',
							text: 'Ein verbundener Ordner wird weder mit deinen anderen Geräten synchronisiert noch mit dem Ordner, mit dem du Meine Dateien synchronisierst. Jedes Gerät hat seine eigenen Verbindungen.',
							tip: 'Soll ein Ordner auf deinem Rechner eine Kopie von Meine Dateien halten? Nimm stattdessen das Synchronisieren mit einem Ordner (Dateien → „Sync“ → „Ordner auf deinem Rechner“). Willst du Dateien dort bearbeiten, wo sie liegen, z. B. den Projektordner eines anderen Programms? Verbinde ihn.',
							link: { href: '/help/sync', label: 'Synchronisieren zwischen deinen Geräten' }
						}
					}
				},
				use: {
					title: 'Einen Ordner verbinden',
					items: {
						connect: {
							title: 'Verbinden',
							text: 'Klick in Dateien auf „Verbinden …“ (Registerkarte „Verbinden“ oder in der Seitenleiste „Ordner“ unter Meine Dateien) und wähle, was du verbinden willst: „Ordner auf diesem Rechner …“, „WebDAV-Server …“ oder „S3-Speicher …“. Bei einem Ordner fragt der Browser, ob in-browser ihn ansehen und bearbeiten darf; das können nur Chrome und Edge am Computer. Server gehen in jedem Browser, auch auf Telefonen. Die Verbindung erscheint dann mit ihrem Namen in der Seitenleiste „Ordner“ unter Meine Dateien.'
						},
						access: {
							title: 'Zugriff nach einem Neustart',
							text: 'Browser fragen nach einem Neustart meist erneut nach dem Zugriff. Der Ordner zeigt dann „Zugriff erlauben“; ein Klick, und er ist wieder da. Tools, die dort speichern, sagen es in ihrem Speicherstatus, und ihre Meldungen, Öffnen-Dialoge und Startseiten bieten ebenfalls „Zugriff erlauben“ an.',
							tip: 'Wähle „Bei jedem Besuch erlauben“, wenn der Browser fragt – dann bleibt er verbunden.'
						},
						manage: {
							title: 'Name und trennen',
							text: 'Ein verbundener Ordner trägt immer den Namen des Ordners auf deinem Rechner, ein Server den Namen, den du ihm gegeben hast („Bearbeiten …“ in seinem Menü ändert ihn, zusammen mit Adresse und Anmeldedaten). „Trennen“ – im Menü des verbundenen Ordners (Rechtsklick in der Seitenleiste „Ordner“) oder in der Registerkarte „Verbinden“, solange er offen ist – entfernt ihn aus in-browser, ohne darin etwas zu löschen.'
						},
						deleting: {
							title: 'Löschen',
							text: 'Ein verbundener Ordner hat keinen Papierkorb von in-browser. Löschen fragt dort vorher und löscht dann endgültig; auch im Papierkorb deines Systems landet es nicht. Auf einem Server ist es ebenso weg – Nextcloud und ownCloud behalten Gelöschtes in ihrem eigenen Papierkorb auf dem Server.'
						}
					}
				},
				servers: {
					title: 'WebDAV und S3',
					items: {
						webdav: {
							title: 'WebDAV-Server',
							text: '„Verbinden …“ → „WebDAV-Server …“ fragt nach der Adresse eines Ordners auf dem Server, deinem Benutzernamen und Passwort. Bei Nextcloud steht die Adresse unter „Dateien-Einstellungen“ → „WebDAV“, z. B. https://cloud.example.com/remote.php/dav/files/anna/. „Verbinden“ probiert sie zuerst aus und behält die Verbindung nur, wenn sich der Ordner auflisten lässt.',
							tip: 'Nimm ein App-Passwort (Nextcloud, ownCloud: Einstellungen → Sicherheit) statt deines echten Passworts – du kannst es jederzeit widerrufen, ohne sonst etwas zu ändern.'
						},
						s3: {
							title: 'S3-Speicher',
							text: '„Verbinden …“ → „S3-Speicher …“ nimmt einen Bucket von Amazon S3, Cloudflare R2, Backblaze B2, Wasabi, MinIO oder anderem S3-kompatiblem Speicher. „Anbieter“ füllt Endpunkt, Region und Adressierung aus; bei R2 trägst du deine Account-ID in den Endpunkt ein. „Ordner im Bucket“ öffnet nur diesen Ordner; leer den ganzen Bucket.',
							options: {
								bucket: { label: 'Bucket und Region', text: 'So, wie dein Anbieter sie zeigt. R2 nimmt „auto“ als Region.' },
								pathStyle: { label: 'Bucket im Pfad (Path-Style-Adressen)', text: 'An für MinIO und die meisten selbst betriebenen Speicher; aus für AWS (der Standard jedes Anbieters ist voreingestellt).' },
								keys: { label: 'Zugriffsschlüssel-ID und geheimer Zugriffsschlüssel', text: 'Leg einen Schlüssel an, der nur diesen Bucket lesen und schreiben darf.' }
							},
							tip: 'Gib in-browser einen eigenen Schlüssel nur für diesen einen Bucket – geht das Gerät verloren, löschst du nur diesen Schlüssel.'
						},
						cors: {
							title: 'Der Server muss den Browser zulassen (CORS)',
							text: 'Ein Browser darf nur mit einem Server sprechen, der in-browser zulässt. Ohne das sagt „Verbinden“: „Der Server ist nicht erreichbar oder erlaubt keinen Zugriff aus dem Browser (CORS)“. Für S3 gib dem Bucket eine CORS-Regel, die den Ursprung von in-browser (siehe unten), die Methoden GET, HEAD, PUT, POST und DELETE und alle Header erlaubt und den Header ETag freigibt. Für WebDAV muss der Server die Methoden OPTIONS, PROPFIND, GET, PUT, MKCOL, DELETE und MOVE von diesem Ursprung beantworten und die Header Authorization, Depth, Destination, Overwrite, Range, If-Match und Content-Type erlauben.',
							code: s3Cors
						},
						https: {
							title: 'Nur HTTPS',
							text: 'Browser lassen eine HTTPS-Seite keinen reinen HTTP-Server nutzen, ein NAS unter http://192.168.… lässt sich also nicht verbinden. Nimm seine HTTPS-Adresse mit gültigem Zertifikat. Ein Server auf diesem Rechner (http://localhost) geht.'
						},
						secrets: {
							title: 'Passwort und Schlüssel',
							text: 'Das Passwort oder der geheime Schlüssel bleibt auf diesem Gerät, verschlüsselt mit einem Schlüssel, den der Browser verwahrt und nie herausgibt. Es wird nie synchronisiert – verbinde den Server auf jedem Gerät, auf dem du ihn willst. Lehnt der Server sie später ab, bieten Meldungen „Anmeldedaten ändern“ an.'
						},
						changes: {
							title: 'Änderungen auf dem Server',
							text: 'Ein Server sagt dem Browser nicht, wenn sich dort etwas ändert. Dateien schaut wieder nach, wenn du zum Tab zurückkommst, und alle 30 Sekunden, solange er offen ist.'
						}
					}
				},
				share: {
					title: 'Für einen Gast freigeben',
					items: {
						start: {
							title: 'Einen Ordner oder eine Datei freigeben',
							text: 'Wähle „Freigeben …“ im Menü eines Ordners oder einer Datei in Dateien, „Ordner freigeben …“ unter „Freigaben“ in seiner Seitenleiste – oder „Freigeben …“ auf der Registerkarte „Datei“ von PDF-Editor, Texteditor und Bildschirmaufnahme für das offene Dokument. Wähle, was der Gast darf und wie lange es gilt, dann „Freigeben“: Der Dialog zeigt einen Link und einen QR-Code, und „Vier Wörter zeigen“ gibt Wörter zum Eintippen. Der Gast öffnet es in einem beliebigen aktuellen Browser – ohne Konto, ohne eines deiner Geräte zu sein. Was du freigibst, wird in den Browser des Gasts kopiert und mit diesem Gerät abgeglichen, solange in-browser hier offen ist; eine einzelne Datei öffnet sich dort gleich in ihrem Tool, und der Gast bekommt nur diese Datei, nie das, was daneben liegt.',
							options: {
								view: { label: '„Nur ansehen“ (Standard)', text: 'Öffnen, ansehen und herunterladen. Hier ändert sich nichts.' },
								edit: { label: '„Bearbeiten“', text: 'Auch speichern, hochladen, umbenennen und löschen. Was der Gast löscht, landet hier im Papierkorb; eine freigegebene Datei selbst lässt sich nicht löschen oder verschieben.' }
							},
							tip: 'Gib zum Ansehen frei, um Fotos oder Dokumente weiterzugeben – oder eine Präsentation an einen Rechner am Beamer; nimm „Bearbeiten“, wenn der Gast Dateien zurückbringen soll.'
						},
						words: {
							title: 'Vier Wörter statt des Links',
							text: 'Ein Rechner ohne Kamera kann den QR-Code nicht scannen, und der Link ist lang zum Abtippen. „Vier Wörter zeigen“ im Freigabe-Dialog zeigt vier kurze Wörter in deiner Sprache. Öffne am anderen Rechner in-browser, wähle in Dateien „Verbinden …“ (unter Meine Dateien in der Seitenleiste „Ordner“ oder die Registerkarte „Verbinden“), dann „Freigabe mit vier Wörtern …“, und tippe sie – auf Deutsch oder Englisch, groß oder klein, ä oder ae gleich; das gerade getippte Wort wird ergänzt. Die Wörter gelten einmal und 10 Minuten lang; „Neue Wörter“ macht neue. Sie übergeben nur den eigentlichen Schlüssel der Freigabe: Niemand kann sie rechtzeitig erraten, und nach dem Benutzen öffnen sie nichts mehr.',
							tip: 'Lies die Wörter vor oder zeig deinen Bildschirm – sie gehen nie über einen Chat. Sind sie abgelaufen, bevor die andere Seite sie getippt hat, mach einfach neue.'
						},
						valid: {
							title: 'Wie lange und für wen',
							text: 'Beim Freigeben wählst du, wie lange es gilt: eine Stunde, einen Tag (Standard), eine Woche oder bis du sie beendest – eine vergessene Freigabe endet von selbst. Sie kann jeweils ein Browser nutzen: Solange ein Gast verbunden ist, erfährt ein zweiter Browser, dass die Freigabe gerade in einem anderen Browser geöffnet ist, und versucht es selbst wieder. Wer den Link hat, kommt also hinein, solange niemand sonst drin ist – gib ihn nur deinem Gast und beende Freigaben, die du nicht mehr brauchst. Lass in-browser auf diesem Gerät offen, bis der Gast alles hat und wann immer Änderungen ankommen sollen – im selben WLAN ist die Verbindung am schnellsten und zuverlässigsten. Was der Gast schon hat, bleibt dort nutzbar, während dieses Gerät weg ist.'
						},
						guest: {
							title: 'Als Gast',
							text: 'Ein freigegebener Ordner erscheint in Dateien in der Seitenleiste „Ordner“ unter Meine Dateien als „Ordner von“ dem, der ihn freigibt – dem Namen aus dessen Einstellungen („Profil“ → „Dein Name“), sonst dem seines Geräts –, mit einem Schloss, wenn du nur ansehen darfst – dann fehlen dort in den Menüs „Ausschneiden“, „Duplizieren“, „Verschieben nach …“, „Umbenennen“ und „Löschen“, und nichts lässt sich hineinziehen oder hochladen. Du kannst die Dateien in jedem Tool öffnen, herunterladen oder in deine eigenen Dateien kopieren. Was freigegeben ist, wird in deinen Browser kopiert und mit dem freigebenden Gerät abgeglichen; eine Zeile über der Liste sagt, was gerade geschieht („Die Freigabe wird geholt …“ oder dass das freigebende Gerät gerade nicht erreichbar ist – dann siehst du die Freigabe so, wie sie zuletzt war, und kannst sie weiter nutzen). Bevor eine Freigabe geholt wird, die groß ist (standardmäßig ab 1 GB, die Einstellung „Vor dem Synchronisieren neuer Ordner fragen ab“ unter „Sync“) oder nicht in den freien Speicher deines Browsers passt, wirst du gefragt: „Holen“ startet es. Dein Browser merkt sich die Freigabe – auch nachdem er geschlossen war –, bis sie endet, abläuft oder du „Trennen“ wählst. Beendet das freigebende Gerät sie, siehst du sofort „Die Freigabe wurde beendet.“, und ihre Kopie wird aus deinem Browser gelöscht – „Entfernen“ nimmt den Eintrag weg; was du in deine eigenen Dateien kopiert hast, bleibt.'
						},
						copies: {
							title: 'Was beim Gast bleibt',
							text: 'Alles, was du freigibst, wird in den Browser des Gasts kopiert – du hast es ihm bewusst gegeben, und so öffnet es sich auch, wenn dieses Gerät nicht erreichbar ist. Bei „Nur ansehen“ folgt die Kopie nur diesem Gerät: Der Gast kann sie dort nicht ändern, und von ihm kommt nie etwas zurück. Bei „Bearbeiten“ gehen Änderungen in beide Richtungen; haben beide Seiten dieselbe Datei geändert, gilt die neuere Fassung, und die andere bleibt als Kopie mit „(Konflikt …)“ im Namen daneben. Die Kopie liegt getrennt von den eigenen Dateien des Gasts: Sie gehört nicht zu seinen „Meine Dateien“, wird nie zu seinen anderen Geräten synchronisiert und landet nie in einem Ordner auf seinem Rechner. Sie wird gelöscht, wenn die Freigabe endet oder abläuft oder der Gast „Trennen“ wählt – wird der Browser des Gasts nicht mehr geöffnet, dann beim nächsten Öffnen. Was der Gast in seine eigenen Dateien kopiert oder heruntergeladen hat, bleibt bei ihm.',
							tip: 'Gib mit einer Dauer frei, wenn du Dateien an einen Rechner gibst, der nicht deiner ist – die Kopie geht mit der Freigabe. Gib nur frei, was der Gast behalten darf: Eine Kopie, die er während der Freigabe gemacht hat, lässt sich nicht zurückholen.'
						},
						live: {
							title: 'Live mit einem Gast oder deinen Geräten',
							text: 'Startet der Gast – oder eines deiner eigenen Geräte – mit dem, was du freigibst, etwas live, z. B. eine Präsentation einer PDF, sagt es jedes Tool von in-browser auf deiner Seite in einer Meldung („Dein Gast präsentiert …“) mit dem Weg hinein („Fernsteuern“) – in einem Tab, der im Hintergrund war, sobald du zu ihm zurückkommst; solange es läuft, steht es auch im Menü des Sync-Symbols unten rechts. Diese Live-Verbindungen gehen direkt zwischen den beiden Browsern wie die Freigabe selbst und brauchen auf beiden Seiten offenes in-browser. Die Seite, die du dafür öffnest, übernimmt die Verbindungen dieses Browsers von seinen anderen Tabs, damit ein Handy sie behält, auch wenn diese Tabs schlafen.',
							link: { href: '/help/pdf-editor#present', label: 'Präsentieren mit Fernsteuerung' }
						},
						end: {
							title: 'Eine Freigabe beenden',
							text: 'Deine aktiven Freigaben stehen in Dateien unter „Freigaben“, mit einem Punkt, der grün wird, solange ein Gast verbunden ist. Ein Klick zeigt Link und QR-Code wieder; Rechtsklick (oder gedrückt halten) für „Freigabe beenden“. Beenden trennt den Gast sofort und sagt es ihm; an dem, was du freigegeben hast, ändert sich nichts. Eine Freigabe mit Dauer endet von selbst.'
						}
					}
				}
			}
		},
		p2pNode: {
			title: 'p2p-node: ein Gerät, das immer läuft',
			summary: 'Halte das Synchronisieren auf einem Rechner oder Heimserver am Laufen, auch wenn kein Browser offen ist',
			topics: {
				about: {
					title: 'Was das ist',
					items: {
						what: {
							title: 'Ein Gerät, das immer läuft',
							text: 'Deine Geräte synchronisieren sich nur, solange auf mindestens zweien in-browser offen ist. Der p2p-node ist ein kleines Programm für einen Rechner oder Heimserver, der immer an ist: Er gesellt sich wie ein Browser zu deinen Geräten und hält die Dateien in einem gewöhnlichen Ordner. Änderungen kommen dann auch an, wenn deine anderen Geräte nie gleichzeitig online sind, und du kannst in dem Ordner mit jedem Programm arbeiten.'
						},
						needs: {
							title: 'Was du brauchst',
							text: 'Einen Rechner mit Linux, macOS oder Windows, der an bleibt, mit Node.js 26 oder neuer. Root- oder Administratorrechte brauchst du nicht.'
						}
					}
				},
				install: {
					title: 'Installieren',
					items: {
						unix: {
							title: 'Linux und macOS',
							text: 'Führe das in einem Terminal aus:',
							code: install.unix
						},
						windows: {
							title: 'Windows',
							text: 'Führe das in der PowerShell aus:',
							code: install.windows
						},
						where: {
							title: 'Was installiert wird',
							text: 'Der Starter nur für deinen Benutzer – in „~/.local/share/in-browser-p2p-node“, unter Windows in „%LOCALAPPDATA%\\in-browser-p2p-node“ – und der Befehl „in-browser-p2p-node“. Das Sync-Programm selbst lädt der Starter und hält ihn aktuell.'
						}
					}
				},
				pair: {
					title: 'Verbinden und starten',
					items: {
						link: {
							title: '1. Link holen',
							text: 'Öffne in Dateien auf einem deiner Geräte „Deine Geräte“ → „Gerät hinzufügen“ und wähle „Link kopieren“.'
						},
						pair: {
							title: '2. Rechner hinzufügen',
							text: 'Setz den Link anstelle von <link> ein. „home“ ist der Name dieser Instanz; der Rechner erscheint unter seinem eigenen Namen bei deinen Geräten.',
							code: 'in-browser-p2p-node pair home "<link>"'
						},
						service: {
							title: '3. Dauerhaft laufen lassen',
							text: 'Richtet einen Hintergrunddienst ein: unter Linux einen systemd-Benutzerdienst, unter Windows eine Aufgabe bei der Anmeldung.',
							code: 'in-browser-p2p-node install home',
							tip: 'Unter Linux endet ein Benutzerdienst, wenn du dich abmeldest. Auf einem Server erlaubst du ihm mit „loginctl enable-linger $USER“ weiterzulaufen.'
						},
						commands: {
							title: 'Befehle',
							text: 'Alle Befehle bekommen den Namen der Instanz.',
							options: {
								pair: { label: 'pair <name> <link>', text: 'Fügt eine neue Instanz als Gerät hinzu. „--folder <dir>“ wählt den synchronisierten Ordner (Standard: im Datenordner), „--name <device name>“ den Namen, den deine Geräte sehen, „--exclude <ordner>“ lässt einen Ordner von Meine Dateien aus (für mehrere wiederholen, z. B. „--exclude Videos --exclude Fotos/2019“). Ohne „--exclude“ bekommt der Rechner alles.' },
								run: { label: 'run <name>', text: 'Startet eine Instanz im Vordergrund, z. B. um zuzusehen.' },
								install: { label: 'install <name>', text: 'Lässt sie im Hintergrund und bei jedem Start laufen. „uninstall <name>“ beendet das und behält die Daten.' },
								status: { label: 'status [<name>]', text: 'Zeigt Geräte, Ordner und Papierkorb einer oder aller Instanzen.' },
								update: { label: 'update', text: 'Sucht jetzt nach einer neuen Version statt innerhalb der Stunde.' }
							}
						},
						several: {
							title: 'Mehrere Personen, ein Server',
							text: 'Jede Instanz ist ein eigenes Gerät mit eigenem Ordner. Ein Server kann die Dateien mehrerer Personen halten: „pair anna …“, „pair ben …“.'
						},
						logs: {
							title: 'Protokoll',
							text: 'Unter Linux mit „journalctl --user -u in-browser-p2p-node@home -f“; auf jedem System in der Datei „node.log“ im Ordner der Instanz.'
						},
						remove: {
							title: 'Entfernen',
							text: 'Entferne den Rechner in Dateien unter „Deine Geräte“ wie jedes andere Gerät; die Instanz beendet sich dann von selbst.'
						},
						trash: {
							title: 'Papierkorb im Ordner',
							text: 'Der Papierkorb deiner Geräte ist der versteckte Ordner „.in-browser-trash“ im synchronisierten Ordner: ein Ordner pro gelöschtem Element. Der Node leert ihn nach der Zeit, die in Dateien gewählt ist. Dateien, die du selbst im Ordner löschst, werden als Löschung synchronisiert – die behält der Papierkorb deines Systems.',
							link: { href: '/help/sync#trash', label: 'So funktioniert der Papierkorb' }
						}
					}
				},
				outside: {
					title: 'Von außen erreichbar',
					items: {
						why: {
							title: 'Warum das wichtig ist',
							text: 'Geräte verbinden sich direkt, ohne Umweg-Server. Zu Hause klappt das immer. Von unterwegs – ein Telefon im Mobilfunk, ein Laptop im Hotel – kommt die Verbindung nur durch deinen Router, wenn der Node dort erreichbar ist.'
						},
						upnp: {
							title: 'Automatisch: UPnP',
							text: 'Der Node nutzt immer die UDP-Ports 29400–29449 und bittet deinen Router, sie an ihn weiterzuleiten. Sein Protokoll sagt, ob das geklappt hat, z. B. „Router: UDP 29400-29449 forwarded to 192.168.178.20 via UPnP“.'
						},
						fritzbox: {
							title: 'FRITZ!Box und andere Router',
							text: 'FRITZ!Box: Öffne unter „Heimnetz“ → „Netzwerk“ diesen Rechner und setz den Haken bei „Selbstständige Portfreigaben für dieses Gerät erlauben“. Andere Router: Schalte UPnP ein (Portfreigaben durch Geräte).'
						},
						manual: {
							title: 'Von Hand',
							text: 'Ohne UPnP leitest du UDP 29400–29449 in deinem Router an diesen Rechner weiter; das Protokoll nennt seine Adresse.'
						},
						firewall: {
							title: 'Firewall',
							text: 'Hat der Rechner eine eigene Firewall, erlaube denselben Bereich auch dort, z. B. mit ufw:',
							code: 'sudo ufw allow 29400:29449/udp'
						},
						cgnat: {
							title: 'DS-Lite und Carrier-Grade-NAT',
							text: 'Eine Weiterleitung braucht zu Hause eine öffentliche IPv4-Adresse. Hinter DS-Lite oder Carrier-Grade-NAT hilft sie nicht – das Protokoll sagt es dann. Geräte mit IPv6 an beiden Enden können sich trotzdem verbinden.'
						},
						debug: {
							title: 'Der Ursache auf der Spur',
							text: 'Setz IN_BROWSER_DEBUG=1 in der Umgebung des Dienstes (Linux: „systemctl --user edit in-browser-p2p-node@home“, dann „Environment=IN_BROWSER_DEBUG=1“ unter „[Service]“) und achte im Protokoll auf „peer.unreachable“. IN_BROWSER_ICE_PORTS=off schaltet die festen Ports und die Weiterleitung ab.'
						}
					}
				},
				security: {
					title: 'Updates und Sicherheit',
					items: {
						updates: {
							title: 'Updates',
							text: 'Der Starter sucht jede Stunde nach einer neuen Version, und sofort, wenn ein anderes Gerät eine neuere nutzt. Er wartet, bis ein laufendes Synchronisieren fertig ist. Stürzt eine neue Version immer wieder ab, geht er zur vorigen zurück und überspringt die fehlerhafte.'
						},
						signed: {
							title: 'Signiert',
							text: 'Eine Version wird nur mit gültiger Signatur des Release-Schlüssels übernommen, jede Datei nur mit ihrer signierten Prüfsumme. Wer allein die Website kontrolliert, kann keinen Code auf deinem Rechner ausführen. Dem Installer selbst vertraust du beim ersten Mal, wie jedem Installer, den du herunterlädst.'
						},
						sandbox: {
							title: 'Abgeschottet',
							text: 'Das Sync-Programm läuft im Berechtigungsmodell von Node: Es darf nur seine eigenen Daten und den synchronisierten Ordner lesen und schreiben, dazu das Netz nutzen.'
						},
						router: {
							title: 'Router',
							text: 'Der Node leitet nur seinen eigenen UDP-Bereich an sich selbst weiter, jeweils für eine Stunde und erneuert, solange er läuft.'
						},
						unencrypted: {
							title: 'Dateien auf der Festplatte',
							text: 'Die Dateien liegen unverschlüsselt im Ordner, wie jede andere Datei auf diesem Rechner.',
							tip: 'Auf einem Laptop oder einem Rechner, an den andere herankommen, schalte die Festplattenverschlüsselung deines Systems ein.'
						}
					}
				}
			}
		},

		settings: {
			title: 'Einstellungen',
			summary: 'Dein Name, wie lange der Papierkorb aufbewahrt – für all deine Geräte',
			topics: {
				open: {
					title: 'Einstellungen öffnen',
					items: {
						where: {
							title: 'Das Zahnrad oben rechts',
							text: 'Jedes Tool und die Übersicht haben ein Zahnrad am rechten Ende der oberen Leiste. Es öffnet „Einstellungen“: links die Kategorien, rechts die Einstellungen der gewählten; am Handy erst die Kategorien, dann die gewählte als eigene Seite (der Pfeil führt zurück). Manche Stellen öffnen direkt eine Kategorie, z. B. „Ändern“ neben deinem Namen in den Kommentaren des PDF-Editors.'
						},
						saved: {
							title: 'Sofort gespeichert, auf allen Geräten',
							text: 'Es gibt kein „OK“: Jede Änderung gilt sofort. Die Einstellungen liegen bei deinen Dateien und werden wie sie synchronisiert – mit deinen anderen Geräten, dem synchronisierten Ordner auf deinem Rechner und einem p2p-node. Nur das Erscheinungsbild (hell, dunkel) wählst du je Gerät, mit dem Schalter neben dem Zahnrad.',
							link: { href: '/help/sync', label: 'So funktioniert das Synchronisieren' }
						}
					}
				},
				profile: {
					title: 'Profil',
					items: {
						name: {
							title: 'Dein Name',
							text: 'Wo ein Tool einen Namen einträgt, nimmt es diesen – zum Beispiel als Autor deiner Kommentare und Antworten im PDF-Editor, den andere auch in Acrobat oder PDF-XChange sehen. Leer: Es wird kein Name eingetragen.',
							tip: 'Nimm den Namen, unter dem dich die Leute kennen, für die du Dateien freigibst – bei der Arbeit z. B. deinen vollen Namen.'
						}
					}
				},
				trash: {
					title: 'Papierkorb',
					items: {
						days: {
							title: 'Gelöschtes endgültig entfernen nach',
							text: 'Wie lange Gelöschtes im Papierkorb bleibt, bevor es von selbst entfernt wird – auf jedem Gerät und auf einem p2p-node.',
							options: {
								d7: { label: '7 Tagen', text: 'Gibt Platz bald frei; ein Versehen musst du innerhalb einer Woche bemerken.' },
								d30: { label: '30 Tagen (Standard)', text: 'Genug Zeit, ein Versehen zu bemerken, ohne den Speicher lange zu füllen.' },
								d90: { label: '90 Tagen', text: 'Für Dokumente, die du selten anschaust; gelöschte Medien belegen lange Platz.' },
								never: { label: 'Nie', text: 'Nichts wird von selbst entfernt – du leerst den Papierkorb selbst (Dateien → „Papierkorb“).' }
							},
							tip: 'Bleib bei 30 Tagen. Nimm 7 Tage, wenn der Speicher knapp wird (große Aufnahmen), 90 Tage oder „Nie“, wenn du mit Dokumenten arbeitest, die du nur ab und zu ansiehst.'
						}
					}
				},
				sync: {
					title: 'Synchronisieren',
					items: {
						askAbove: {
							title: 'Vor dem Synchronisieren neuer Ordner fragen ab',
							text: 'Ein neuer Ordner, der auf ein Gerät käme und mindestens so groß ist, wartet auf deine Bestätigung – wenn ein Gerät zu synchronisieren beginnt und später, sobald so ein Ordner auftaucht. Ein Ordner, der nicht in den freien Speicher des Browsers passt, wartet immer, egal was du hier wählst.',
							options: {
								mb100: { label: '100 MB', text: 'Fragt oft – für Telefone mit wenig Platz.' },
								gb1: { label: '1 GB (Standard)', text: 'Dokumente und Fotos fließen frei; Aufnahmen und Archive warten.' },
								gb10: { label: '10 GB', text: 'Nur sehr große Ordner warten.' },
								never: { label: 'Nie fragen', text: 'Jeder neue Ordner kommt sofort, solange er passt.' }
							},
							tip: 'Bleib bei 1 GB. Nimm 100 MB, wenn eines deiner Geräte ein oft volles Telefon ist, „Nie fragen“, wenn alle deine Geräte viel Platz haben.',
							link: { href: '/help/sync', label: 'Synchronisieren zwischen deinen Geräten' }
						}
					}
				}
			}
		},
		install: {
			title: 'Installieren, offline und Browser',
			summary: 'Nutze in-browser wie eine App, ohne Internet, in dem Browser, den du hast',
			topics: {
				install: {
					title: 'Als App installieren',
					items: {
						how: {
							title: 'So geht’s',
							text: 'Bietet dein Browser es an, fügst du in-browser wie ein Programm hinzu: in Chrome und Edge am Rechner über das Installieren-Symbol in der Adresszeile, unter Android über „App installieren“ im Browsermenü, auf iPhone und iPad über „Teilen“ → „Zum Home-Bildschirm“, in Safari am Mac über „Ablage“ → „Zum Dock hinzufügen“. Die App öffnet sich dann in einem eigenen Fenster.'
						},
						which: {
							title: 'Die ganze Suite oder ein Tool',
							text: 'Installierst du von der Übersicht aus, bekommst du in-browser mit allen Tools. Jedes Tool lässt sich auch einzeln installieren – dann öffnet es direkt dieses Tool.',
							tip: 'Installiere die ganze Suite: Nur die App „in-browser“ erscheint im Teilen-Menü und unter „Öffnen mit“ deines Geräts. Die App eines einzelnen Tools nicht.'
						}
					}
				},
				system: {
					title: 'Mit den anderen Apps deines Geräts',
					items: {
						share: {
							title: 'An in-browser teilen',
							text: 'Unter Android erscheint die installierte App „in-browser“ im Teilen-Menü anderer Apps. Teilst du eine PDF, öffnet sie sich im PDF-Editor, eine Textdatei oder einen Text im Texteditor; andere Dateien landen in Dateien. Bevor etwas abgelegt wird, wählst du, wo – die Datei wird in deine Dateien kopiert, nichts wird hochgeladen.',
							options: {
								where: { label: 'Wo es geht', text: 'Chrome und Samsung Internet unter Android, mit installiertem in-browser. Nicht auf iPhone und iPad – dort speicherst du die Datei und lädst sie in Dateien hoch.' }
							}
						},
						openWith: {
							title: 'Mit in-browser öffnen',
							text: 'Am Computer öffnet „Öffnen mit“ → „in-browser“ PDFs im PDF-Editor und Textdateien im Texteditor – auch aus der Download-Leiste des Browsers und als Standard-App, wenn du es so einstellst. Eine PDF wird zuerst in deine Dateien kopiert (du wählst, wohin), ein Text öffnet sich als neuer Text, den du speicherst, wo du willst. Die Datei auf deinem Computer bleibt, wie sie ist.',
							options: {
								where: { label: 'Wo es geht', text: 'Chrome und Edge am Computer, mit installiertem in-browser. Beim ersten Mal fragt der Browser, ob in-browser solche Dateien öffnen darf.' }
							}
						},
						send: {
							title: 'An eine andere App senden',
							text: '„Senden …“ im Tab „Datei“ von PDF-Editor und Texteditor, in Dateien (Tab „Freigeben“, das Menü von Dateien) und in „Exportieren …“ des PDF-Editors gibt Dateien an eine andere App deines Geräts – Mail, einen Messenger, JW Library. Anders als „Freigeben …“, das eine Datei für einen Gast in seinem Browser öffnet, bekommt die App eine Kopie.',
							options: {
								where: { label: 'Wo es geht', text: 'Auf Handys und Tablets, unter Windows und auf dem Mac. Jeder Browser sendet nur die Arten, die er zulässt – Chrome z. B. Bilder, Videos, Ton, PDFs und reinen Text, aber keine Playlists; dafür bleibt „Senden …“ ausgegraut.' }
							},
							tip: 'Nach einem längeren Export zählt der Browser deinen Klick nicht mehr: Eine Meldung „… bereit zum Senden“ bietet dann „Senden“ an.'
						}
					}
				},
				offline: {
					title: 'Offline und Updates',
					items: {
						offline: {
							title: 'Ohne Internet',
							text: 'Nach dem ersten Besuch starten in-browser und seine Tools auch ohne Internetverbindung – installiert oder nicht. Deine Dateien sind ohnehin auf dem Gerät. Nur das Synchronisieren zwischen Geräten braucht ein Netz.'
						},
						updates: {
							title: 'Neue Versionen',
							text: 'Eine neue Version kündigt „Eine neue Version ist verfügbar.“ an – „Neu laden“ übernimmt sie, mit „Später“ arbeitest du mit der aktuellen weiter. Sie wird nie ungefragt übernommen, eine laufende Aufnahme oder ungesicherte Eingabe ist also sicher.'
						}
					}
				},
				browsers: {
					title: 'Browser',
					items: {
						supported: {
							title: 'Unterstützte Browser',
							text: 'Die jeweils letzten zwei Versionen von Chrome, Edge, Firefox und Samsung Internet sowie die letzten zwei Hauptversionen von Safari – am Rechner, auf Telefon und Tablet. Auf iPhone und iPad nutzen alle Browser die Technik von Safari.',
							tip: 'Halte deinen Browser aktuell. In einem älteren können einzelne Funktionen fehlen; die Tools sagen es dann.'
						},
						differences: {
							title: 'Was sich unterscheidet',
							text: 'Manche Funktionen brauchen, was nicht jeder Browser hat. Die Tools blenden aus, was deinem fehlt, oder erklären es.',
							options: {
								folder: { label: 'Ordner auf deinem Rechner', text: 'Nur Chrome und Edge am Rechner.' },
								screen: { label: 'Bildschirmaufnahme', text: 'Nur am Rechner; Systemton und Installieren nicht in Firefox.' },
								sync: { label: 'Synchronisieren zwischen Geräten', text: 'Alle unterstützten Browser; auf dem Telefon nur, solange die Seite im Vordergrund ist.' }
							}
						},
						language: {
							title: 'Sprache',
							text: 'in-browser folgt der Sprache deines Browsers: Deutsch oder Englisch, sonst Englisch.'
						}
					}
				},
				privacy: {
					title: 'Datenschutz',
					items: {
						nothing: {
							title: 'Kein Konto, kein Tracking',
							text: 'Es gibt kein Konto, keine Cookies, keine Statistik und keine Werbung. Die Website liefert nur das Programm aus; alles andere passiert auf deinem Gerät.'
						},
						open: {
							title: 'Open Source',
							text: 'Der Quellcode von in-browser ist öffentlich unter der MIT-Lizenz – jeder kann nachprüfen, was er tut.'
						}
					}
				}
			}
		}
	}
};

export default help;
