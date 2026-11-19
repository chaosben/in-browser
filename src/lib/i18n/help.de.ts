import { BRAND } from '@in-browser/brand/brand.js';
import type enHelp from './help.en.js';

const install = {
	unix: `curl -fsSL ${BRAND.suiteUrl}/p2p-node/install.sh | sh`,
	windows: `irm ${BRAND.suiteUrl}/p2p-node/install.ps1 | iex`
};

const help: typeof enHelp = {
	title: 'Hilfe',
	intro: 'Wie die Tools von in-browser funktionieren, wo deine Dateien liegen und wie sich deine Geräte abgleichen.',
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
							text: 'Jedes Tool von in-browser speichert in einen Speicher deines Browsers auf diesem Gerät. Nichts wird hochgeladen – es gibt keinen Server, der deine Dateien speichern könnte. Alle Tools teilen sich diesen Speicher: ein Notizbuch aus Notizen, ein Projekt aus der Bildschirmaufnahme und ein Text aus dem Texteditor sind dort Dateien. Das Tool Dateien zeigt und verwaltet sie, wie der Dateimanager deines Rechners.'
						},
						perBrowser: {
							title: 'Ein Speicher pro Browser',
							text: 'Der Speicher gehört zu diesem Browser auf diesem Gerät. Ein anderer Browser, ein anderes Browserprofil oder ein privates Fenster hat einen eigenen, leeren Speicher. Wenn du die Websitedaten dieser Seite löschst oder den Browser zurücksetzt oder deinstallierst, ist er weg.',
							tip: 'Halte eine Kopie woanders – in einem Ordner auf deinem Rechner oder auf deinen anderen Geräten –, wenn dir deine Dateien wichtig sind.'
						},
						kept: {
							title: 'Dauerhaft aufbewahrt',
							text: 'in-browser bittet den Browser, seinen Speicher auch dann zu behalten, wenn der Platz knapp wird. Die meisten Browser stimmen ohne Nachfrage zu. Safari kann die Daten von Seiten löschen, die du einige Wochen nicht benutzt hast; auf dem Home-Bildschirm (iPhone, iPad) oder im Dock (Mac) behält eine Seite ihre Daten.'
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
							text: 'Wähle in Dateien „Ordner auf deinem Rechner“ → „Ordner wählen“. Ab dann werden die Dateien in beide Richtungen mit diesem echten Ordner abgeglichen: Die neuere Version gewinnt, Löschungen im Ordner bestätigst du, bevor sie hier gelten. Der Abgleich läuft, solange irgendein Tool von in-browser in diesem Browser offen ist. Nur Chrome und Edge am Rechner können auf Ordner zugreifen.',
							tip: 'Wähle einen Ordner, den dein Sync-Programm (Syncthing, Nextcloud, Dropbox …) oder deine Datensicherung schon erfasst – dann kommen deine Dateien von selbst auf deine anderen Rechner und in die Sicherung. Fragt der Browser erneut nach Zugriff, wähle „Bei jedem Besuch zulassen“, dann läuft der Abgleich ohne Nachfrage weiter.'
						},
						devices: {
							title: 'Auf deinen anderen Geräten',
							text: 'Verbinde dein Telefon, deinen Laptop oder dein Tablet in Dateien unter „Deine Geräte“: Die Dateien gleichen sich dann direkt untereinander ab, ohne Cloud. Jedes Gerät hat eine vollständige Kopie.',
							link: { href: '/help/sync', label: 'Abgleich zwischen deinen Geräten' }
						},
						download: {
							title: 'Herunterladen',
							text: 'Markiere in Dateien die gewünschten Dateien und dann „Herunterladen“, oder „Als ZIP herunterladen“ für einen Ordner oder mehrere Dateien. Die meisten Tools exportieren ihre Dokumente außerdem in gängige Formate, z. B. Notizbücher als PDF, Bildschirmaufnahmen als MP4.'
						}
					}
				},
				space: {
					title: 'Speicherplatz',
					items: {
						quota: {
							title: 'Wie viel passt',
							text: 'Browser geben einer Seite einen Anteil am freien Platz des Geräts – meist einen großen. Die Fußzeile von Dateien zeigt, wie viel in-browser belegt und wie viel der Browser erlaubt. Aufnahmen und importierte Videos brauchen den meisten Platz, Texte und Notizbücher sehr wenig.'
						},
						free: {
							title: 'Platz freigeben',
							text: 'Was du löschst, landet zuerst im Papierkorb und belegt dort weiter Platz. Frei wird er, wenn der Papierkorb geleert wird – von Hand in Dateien („Papierkorb“ → „Papierkorb leeren“) oder von selbst nach der Zeit, die du unter „Aufbewahren“ gewählt hast.',
							link: { href: '/help/sync#trash', label: 'So funktioniert der Papierkorb' }
						}
					}
				}
			}
		},

		sync: {
			title: 'Abgleich zwischen deinen Geräten',
			summary: 'Verbinde Telefon, Laptop und Tablet – direkt, verschlüsselt, ohne Cloud',
			topics: {
				basics: {
					title: 'So funktioniert’s',
					items: {
						direct: {
							title: 'Direkt zwischen deinen Geräten',
							text: 'Deine Geräte tauschen ihre Dateien direkt miteinander aus, verschlüsselt, ohne Cloud und ohne Konto. Jedes Gerät hat eine vollständige Kopie der abgeglichenen Dateien und funktioniert auch ohne die anderen.'
						},
						connected: {
							title: 'Nur Meine Dateien',
							text: 'Abgeglichen werden Meine Dateien. Ordner unter „Verbunden“ bleiben, wo sie sind, und reisen nicht zu deinen anderen Geräten.',
							link: { href: '/help/connected', label: 'Verbundene Ordner' }
						},
						when: {
							title: 'Wann sich Geräte abgleichen',
							text: 'Zwei Geräte gleichen sich ab, solange auf beiden in-browser offen ist – ein Tab mit irgendeinem Tool reicht, auch im Hintergrund. Auf dem Telefon muss die Seite im Vordergrund sein. Was ein Gerät verpasst hat, holt es nach, sobald es wieder auf eines der anderen trifft; der Hinweis „Wahrscheinlich nicht aktuell“ in Dateien zeigt, welchem Gerät noch Änderungen fehlen könnten.',
							tip: 'Sind deine Geräte selten gleichzeitig offen, richte einen p2p-node auf einem Rechner oder Heimserver ein, der immer läuft: Er gleicht sich mit jedem Gerät ab, sobald es offen ist.'
						},
						p2pNode: {
							title: 'Immer an: der p2p-node',
							text: 'Ein kleines Programm für einen Rechner oder Heimserver, das sich wie ein Browser zu deinen Geräten gesellt und die Dateien in einem gewöhnlichen Ordner hält. Änderungen kommen dann auch an, wenn deine anderen Geräte nie gleichzeitig online sind.',
							link: { href: '/help/p2p-node', label: 'p2p-node einrichten' }
						},
						browsers: {
							title: 'Browser',
							text: 'Der Abgleich zwischen Geräten funktioniert in aktuellen Versionen von Chrome, Edge, Firefox und Safari, am Rechner und auf dem Telefon.'
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
							tip: 'Wer den Schlüssel hat, kann ein Gerät verbinden und alle abgeglichenen Dateien lesen und ändern. Gib ihn nur auf deinen eigenen Geräten ein und schick ihn nie jemandem.'
						},
						folders: {
							title: 'Ordner auswählen',
							text: 'Unter „Ordner auswählen“ legst du pro Gerät fest, welche Ordner es bekommt. Abgewählte Ordner bleiben auf den anderen Geräten und gleichen sich dort weiter ab – nur dieses Gerät bekommt sie nicht, und seine Kopie wird hier gelöscht. Einen Ordner auszulassen löscht ihn nirgendwo sonst.',
							tip: 'Lass große Ordner (z. B. Bildschirmaufnahmen) auf einem Telefon mit wenig Platz aus – öffnen kannst du sie trotzdem live.'
						},
						live: {
							title: 'Live von deinen Geräten',
							text: 'Ein Ordner, den dieses Gerät nicht abgleicht, erscheint trotzdem in Dateien, mit einer Wolke statt des Ordnersymbols. Öffnest du ihn, liest dieses Gerät ihn live von einem deiner Geräte, das ihn hat – einem p2p-node oder einem Browser mit offenem in-browser. Jedes Tool funktioniert dort: öffnen, speichern, hochladen, umbenennen, löschen (in den Papierkorb jenes Geräts). Videos spielen schon beim Laden, geholt wird nur der Teil, den du ansiehst. Die Änderungen gleichen sich von jenem Gerät zu den anderen ab. Ist keins davon verbunden, sagt Dateien das und nennt, wo der Ordner liegt.',
							tip: 'Ordner, die du auf diesem Gerät selten brauchst: auslassen und live öffnen. Gleich den Ordner wieder ab („Auf diesem Gerät wieder abgleichen“), wenn du ihn ohne die anderen Geräte brauchst.'
						}
					}
				},
				changes: {
					title: 'Änderungen, Konflikte und Löschen',
					items: {
						newer: {
							title: 'Die neuere Version gewinnt',
							text: 'Hat sich eine Datei seit dem letzten Abgleich auf zwei Geräten geändert, behält die neuere Version den Namen, die andere bleibt als Konfliktkopie daneben erhalten. Nichts geht verloren; sieh dir beide an und lösche die, die du nicht brauchst.',
							tip: 'Bevor du auf einem Gerät weitermachst, das länger nicht offen war, öffne zuerst in-browser auf einem deiner anderen Geräte und lass es abgleichen. Dateien warnt dich, wenn dieses Gerät wahrscheinlich hinterher ist.'
						},
						safe: {
							title: 'Was sich zwischendurch ändert, wird nicht überschrieben',
							text: 'Unmittelbar bevor ein Gerät eine Datei überschreibt oder löscht, prüft es, ob sie noch die Version ist, mit der es geplant hat. Hast du sie inzwischen geändert, bleibt deine Änderung und wird beim nächsten Durchgang abgeglichen.'
						},
						deletions: {
							title: 'Löschen',
							text: 'Was du auf einem Gerät löschst, wird auch auf den anderen gelöscht und landet im Papierkorb. Wurden auf einem anderen Gerät viele Dateien auf einmal gelöscht, fragt Dateien vorher: „Hier auch löschen“.'
						}
					}
				},
				trash: {
					title: 'Papierkorb',
					items: {
						everywhere: {
							title: 'Auf allen deinen Geräten',
							text: 'Was du in Dateien löschst – oder ein Notizbuch oder Projekt in seinem Tool –, landet im Papierkorb, und zwar auf jedem Gerät. So holst du es auf jedem davon zurück: Dateien → „Papierkorb“ → „Wiederherstellen“.'
						},
						keep: {
							title: 'Wie lange',
							text: 'Unter „Aufbewahren“ im Papierkorb wählst du, wie lange Gelöschtes bleibt. Die Einstellung gilt für alle deine Geräte.',
							options: {
								d7: { label: '7 Tage', text: 'Gibt am schnellsten Platz frei.' },
								d30: { label: '30 Tage (Standard)', text: 'Genug Zeit, um ein Versehen zu bemerken.' },
								d90: { label: '90 Tage', text: 'Für Dateien, die du selten ansiehst.' },
								never: { label: 'Bis ich ihn leere', text: 'Nichts verschwindet von selbst – leere den Papierkorb ab und zu.' }
							}
						},
						folder: {
							title: 'In einem Ordner auf der Festplatte',
							text: 'Im abgeglichenen Ordner auf deinem Rechner und bei einem p2p-node ist der Papierkorb der versteckte Ordner „.in-browser-trash“. Dateien, die du in so einem Ordner mit einem anderen Programm löschst, werden als Löschung abgeglichen – die behält der Papierkorb deines Systems.'
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
							text: '„Dieses Gerät trennen“ beendet den Abgleich hier. Deine Dateien bleiben auf diesem Gerät und auf den anderen; später kannst du es mit einem neuen Schlüssel wieder verbinden.'
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
							title: '„Braucht ein Update“',
							text: 'Auf dem anderen Gerät läuft eine ältere Version. Öffne dort in-browser und lade die Seite neu.'
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
			summary: 'Öffne einen Ordner auf deinem Rechner live in jedem Tool – nichts wird in den Browser kopiert',
			topics: {
				basics: {
					title: 'Meine Dateien und Verbunden',
					items: {
						rule: {
							title: 'Zwei Arten von Speicher',
							text: '„Meine Dateien“ liegen im Speicher deines Browsers und reisen mit deinen Geräten. Ein Ordner unter „Verbunden“ bleibt, wo er ist: in-browser öffnet ihn live, liest und speichert direkt dort und behält keine Kopie. Trennst du ihn, bleibt nichts davon im Browser.'
						},
						everywhere: {
							title: 'In jedem Tool',
							text: 'Verbundene Ordner erscheinen in Dateien unter „Verbunden“ und im Öffnen- und Speichern-Dialog der Tools (die Auswahl vor dem Ordnerpfad). Jedes Tool öffnet und speichert direkt dort: Texte im Texteditor, Notizbücher in Notizen, Projekte und Aufnahmen in der Bildschirmaufnahme. Die Startseiten von Notizen und der Bildschirmaufnahme zeigen Notizbücher und Projekte aus verbundenen Ordnern, sobald du sie dort angelegt oder geöffnet hast – verbundene Ordner werden nicht durchsucht, sie können groß sein.'
						},
						notSynced: {
							title: 'Nicht abgeglichen',
							text: 'Ein verbundener Ordner wird weder mit deinen anderen Geräten abgeglichen noch mit dem Ordner, mit dem du Meine Dateien abgleichst. Jedes Gerät hat seine eigenen Verbindungen.',
							tip: 'Soll ein Ordner auf deinem Rechner eine Kopie von Meine Dateien halten? Nimm stattdessen den Abgleich mit einem Ordner (Dateien → „Abgleich“ → „Ordner auf deinem Rechner“). Willst du Dateien dort bearbeiten, wo sie liegen, z. B. den Projektordner eines anderen Programms? Verbinde ihn.',
							link: { href: '/help/sync', label: 'Abgleich zwischen deinen Geräten' }
						}
					}
				},
				use: {
					title: 'Einen Ordner verbinden',
					items: {
						connect: {
							title: 'Verbinden',
							text: 'Klicke in Dateien in der Seitenleiste auf „Ordner verbinden …“ und wähle einen Ordner; der Browser fragt, ob in-browser ihn ansehen und bearbeiten darf. Der Ordner erscheint dann mit seinem Namen unter „Verbunden“. Das können nur Chrome und Edge am Computer.'
						},
						access: {
							title: 'Zugriff nach einem Neustart',
							text: 'Browser fragen nach einem Neustart meist erneut nach dem Zugriff. Der Ordner zeigt dann „Zugriff erlauben“; ein Klick, und er ist wieder da. Tools, die dort speichern, sagen es in ihrem Speicherstatus, und ihre Meldungen, Öffnen-Dialoge und Startseiten bieten ebenfalls „Zugriff erlauben“ an.',
							tip: 'Wähle „Bei jedem Besuch erlauben“, wenn der Browser fragt – dann bleibt er verbunden.'
						},
						manage: {
							title: 'Umbenennen und trennen',
							text: 'Das Menü eines verbundenen Ordners (Rechtsklick in der Seitenleiste oder das Menü an seinem Namen in der oberen Leiste) hat „Umbenennen“ – das ändert nur den Namen hier, nicht den Ordner – und „Trennen“, das ihn aus in-browser entfernt, ohne darin etwas zu löschen.'
						},
						deleting: {
							title: 'Löschen',
							text: 'Ein verbundener Ordner hat keinen Papierkorb von in-browser. Löschen fragt dort vorher und löscht dann endgültig; auch im Papierkorb deines Systems landet es nicht.'
						}
					}
				},
				share: {
					title: 'Mit einem Gast teilen',
					items: {
						start: {
							title: 'Einen Ordner teilen',
							text: 'Wähle in Dateien „Ordner teilen …“ unter „Freigaben“ in der Seitenleiste und such einen Ordner in Meine Dateien aus – oder wähle „Teilen …“ im Menü eines Ordners. Wähle, was der Gast darf, dann „Teilen“: Der Dialog zeigt einen Link und einen QR-Code. Der Gast öffnet den Link in einem beliebigen aktuellen Browser – ohne Konto, ohne eines deiner Geräte zu sein. Der Ordner öffnet sich dort live von diesem Gerät; in seinem Browser bleibt nichts davon, und es ist weg, wenn er den Tab schließt.',
							options: {
								view: { label: '„Nur ansehen“ (Standard)', text: 'Dateien öffnen, ansehen und herunterladen. Hier ändert sich nichts.' },
								edit: { label: '„Bearbeiten“', text: 'Auch speichern, hochladen, umbenennen und löschen. Was der Gast löscht, landet hier im Papierkorb.' }
							},
							tip: 'Teile zum Ansehen, um Fotos oder Dokumente weiterzugeben; nimm „Bearbeiten“, wenn der Gast Dateien zurückbringen soll, z. B. seine Bilder von einer Reise.'
						},
						valid: {
							title: 'Wie lange und für wen',
							text: 'Eine Freigabe gilt, bis du sie beendest. Sie kann jeweils ein Browser nutzen: Solange ein Gast verbunden ist, erfährt ein zweiter Browser, dass die Freigabe gerade in einem anderen Browser geöffnet ist, und versucht es selbst wieder. Der Gast kann den Tab schließen und den Link später wieder öffnen. Wer den Link hat, kommt also hinein, solange niemand sonst drin ist – gib ihn nur deinem Gast und beende Freigaben, die du nicht mehr brauchst. Lass in-browser auf diesem Gerät offen, solange der Gast ihn nutzt – im selben WLAN ist die Verbindung am schnellsten und zuverlässigsten.'
						},
						guest: {
							title: 'Als Gast',
							text: 'Der geteilte Ordner erscheint in Dateien unter „Verbunden“ als „Ordner“ von dem Gerät, das ihn teilt, mit einem Schloss, wenn du nur ansehen darfst – dann fehlen dort in den Menüs „Ausschneiden“, „Duplizieren“, „Verschieben nach …“, „Umbenennen“ und „Löschen“, und nichts lässt sich hineinziehen oder hochladen. Du kannst die Dateien in jedem Tool öffnen, herunterladen oder in deine eigenen Dateien kopieren. „Trennen“ oder das Schließen des Tabs beendet es für dich; der Link öffnet es wieder, solange die Freigabe besteht. Ist gerade ein anderer Browser drin, sagt Dateien das und versucht es selbst wieder. Beendet das teilende Gerät die Freigabe, siehst du sofort „Die Freigabe wurde beendet.“ – „Entfernen“ nimmt sie weg; was du in deine eigenen Dateien kopiert hast, bleibt. Ist das teilende Gerät nicht erreichbar, sagt Dateien das: Dort muss in-browser offen sein.'
						},
						end: {
							title: 'Eine Freigabe beenden',
							text: 'Deine aktiven Freigaben stehen in Dateien unter „Freigaben“, mit einem Punkt, der grün wird, solange ein Gast verbunden ist. Ein Klick zeigt Link und QR-Code wieder; Rechtsklick (oder gedrückt halten) für „Freigabe beenden“. Beenden trennt den Gast sofort und sagt es ihm; im Ordner ändert sich nichts. Freigaben enden auch von selbst, wenn ihre Zeit um ist.'
						}
					}
				}
			}
		},
		p2pNode: {
			title: 'p2p-node: ein Gerät, das immer läuft',
			summary: 'Halte den Abgleich auf einem Rechner oder Heimserver am Laufen, auch wenn kein Browser offen ist',
			topics: {
				about: {
					title: 'Was das ist',
					items: {
						what: {
							title: 'Ein Gerät, das immer läuft',
							text: 'Deine Geräte gleichen sich nur ab, solange auf mindestens zweien in-browser offen ist. Der p2p-node ist ein kleines Programm für einen Rechner oder Heimserver, der immer an ist: Er gesellt sich wie ein Browser zu deinen Geräten und hält die Dateien in einem gewöhnlichen Ordner. Änderungen kommen dann auch an, wenn deine anderen Geräte nie gleichzeitig online sind, und du kannst in dem Ordner mit jedem Programm arbeiten.'
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
							text: 'Der Starter nur für deinen Benutzer – in „~/.local/share/in-browser-p2p-node“, unter Windows in „%LOCALAPPDATA%\\in-browser-p2p-node“ – und der Befehl „in-browser-p2p-node“. Den Abgleich selbst lädt der Starter und hält ihn aktuell.'
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
								pair: { label: 'pair <name> <link>', text: 'Fügt eine neue Instanz als Gerät hinzu. „--folder <dir>“ wählt den abgeglichenen Ordner (Standard: im Datenordner), „--name <device name>“ den Namen, den deine Geräte sehen.' },
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
							text: 'Der Papierkorb deiner Geräte ist der versteckte Ordner „.in-browser-trash“ im abgeglichenen Ordner: ein Ordner pro gelöschtem Element. Der Node leert ihn nach der Zeit, die in Dateien gewählt ist. Dateien, die du selbst im Ordner löschst, werden als Löschung abgeglichen – die behält der Papierkorb deines Systems.',
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
							text: 'Der Starter sucht jede Stunde nach einer neuen Version, und sofort, wenn ein anderes Gerät eine neuere nutzt. Er wartet, bis ein laufender Abgleich fertig ist. Stürzt eine neue Version immer wieder ab, geht er zur vorigen zurück und überspringt die fehlerhafte.'
						},
						signed: {
							title: 'Signiert',
							text: 'Eine Version wird nur mit gültiger Signatur des Release-Schlüssels übernommen, jede Datei nur mit ihrer signierten Prüfsumme. Wer allein die Website kontrolliert, kann keinen Code auf deinem Rechner ausführen. Dem Installer selbst vertraust du beim ersten Mal, wie jedem Installer, den du herunterlädst.'
						},
						sandbox: {
							title: 'Abgeschottet',
							text: 'Der Abgleich läuft im Berechtigungsmodell von Node: Er darf nur seine eigenen Daten und den abgeglichenen Ordner lesen und schreiben, dazu das Netz nutzen.'
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
							text: 'Installierst du von der Übersicht aus, bekommst du in-browser mit allen Tools. Jedes Tool lässt sich auch einzeln installieren – dann öffnet es direkt dieses Tool.'
						}
					}
				},
				offline: {
					title: 'Offline und Updates',
					items: {
						offline: {
							title: 'Ohne Internet',
							text: 'Nach dem ersten Besuch starten in-browser und seine Tools auch ohne Internetverbindung – installiert oder nicht. Deine Dateien sind ohnehin auf dem Gerät. Nur der Abgleich zwischen Geräten braucht ein Netz.'
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
								sync: { label: 'Abgleich zwischen Geräten', text: 'Alle unterstützten Browser; auf dem Telefon nur, solange die Seite im Vordergrund ist.' }
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
