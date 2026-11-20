import type { InkMessages } from './index.svelte.js';

const de: InkMessages = {
	tools: {
		label: 'Werkzeuge',
		pen: 'Stift',
		highlighter: 'Textmarker',
		shape: 'Formen',
		eraser: 'Radierer',
		lasso: 'Auswählen',
		lassoHint: 'Auswählen – tippe ein Element an oder umkreise mehrere',
		laser: 'Laserpointer',
		eraserMode: 'Radiert',
		eraserModes: { stroke: 'Ganze Striche', pixel: 'Pixel' },
		size: 'Stärke',
		sizeValue: (n: number) => `Stärke ${n}`,
		options: 'Farbe, Stärke und Glättung',
		smoothing: 'Glättung',
		smoothingLevels: ['Aus', 'Leicht', 'Mittel', 'Stark'],
		smoothingHint: 'Glattere Linien, die dem Stift mit kleiner Verzögerung folgen',
		shapes: {
			line: 'Linie',
			arrow: 'Pfeil',
			doubleArrow: 'Doppelpfeil',
			rect: 'Rechteck',
			roundedRect: 'Abgerundetes Rechteck',
			ellipse: 'Ellipse',
			triangle: 'Dreieck',
			diamond: 'Raute',
			parallelogram: 'Parallelogramm',
			pentagon: 'Fünfeck',
			hexagon: 'Sechseck',
			star: 'Stern'
		},
		shapeHint: 'Zieh die Form auf der Seite auf. Fast quadratische Formen werden zu Quadrat oder Kreis.',
		snap: 'Einrasten',
		shapeName: 'Form',
		picture: 'Bild',
		icon: 'Symbol',
		snapHint: 'Linien in 15°-Schritten; Kanten und Mitten an Seite, Formen und Bildern; gleiche Abstände. Halte beim Ziehen Alt gedrückt für das Gegenteil.'
	},

	guides: {
		page: 'Rastet an der Seite ein',
		item: (name) => `Rastet an ${name} ein`
	},

	selection: {
		label: (n) => (n === 1 ? '1 Element ausgewählt' : `${n} Elemente ausgewählt`),
		color: 'Farbe',
		size: 'Stärke',
		sizeValue: (n) => `Stärke ${n}`,
		style: 'Stil',
		duplicate: 'Duplizieren',
		delete: 'Löschen'
	},

	arrange: {
		groups: { order: 'Reihenfolge', align: 'Ausrichten', distribute: 'Verteilen' },
		front: 'In den Vordergrund',
		forward: 'Eine Ebene nach vorne',
		backward: 'Eine Ebene nach hinten',
		back: 'In den Hintergrund',
		left: 'Linksbündig ausrichten',
		center: 'Horizontal zentrieren',
		right: 'Rechtsbündig ausrichten',
		top: 'Oben ausrichten',
		middle: 'Vertikal zentrieren',
		bottom: 'Unten ausrichten',
		alignTip: 'Richtet zwei oder mehr ausgewählte Elemente am Rahmen um alle aus',
		horizontal: 'Horizontal verteilen',
		vertical: 'Vertikal verteilen',
		distributeTip: 'Verteilt drei oder mehr ausgewählte Elemente mit gleichen Abständen'
	},

	shapeStyle: {
		fill: 'Füllung',
		noFill: 'Keine',
		line: 'Linie',
		dashes: { solid: 'Durchgezogen', dashed: 'Gestrichelt', dotted: 'Gepunktet' },
		sketch: 'Handgezeichnet',
		heads: 'Pfeilspitzen',
		headOptions: { none: 'Keine', end: 'Am Ende', start: 'Am Anfang', both: 'An beiden Enden' }
	},

	suggest: {
		label: (shape) => `In ${shape} umwandeln`,
		hint: 'Ersetzt den Strich durch eine Form, deren Punkte du verschieben kannst',
		names: {
			line: 'Linie',
			arrow: 'Pfeil',
			doubleArrow: 'Doppelpfeil',
			triangle: 'Dreieck',
			rectangle: 'Rechteck',
			quadrilateral: 'Viereck',
			polygon: 'Vieleck',
			roundedRect: 'abgerundetes Rechteck',
			circle: 'Kreis',
			ellipse: 'Ellipse'
		}
	}
};

export default de;
