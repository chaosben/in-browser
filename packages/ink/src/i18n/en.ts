// Texts of the shared ink components (tools, selection menu and commands, shape style, shape suggestion). English leads: de.ts has the same keys.

const en = {
	tools: {
		label: 'Tools',
		pen: 'Pen',
		highlighter: 'Highlighter',
		shape: 'Shapes',
		eraser: 'Eraser',
		lasso: 'Select',
		lassoHint: 'Select – tap an item, or draw a loop around several',
		eraserMode: 'Erases',
		eraserModes: { stroke: 'Whole strokes', pixel: 'Pixels' },
		size: 'Thickness',
		sizeValue: (n: number) => `Thickness ${n}`,
		options: 'Color, thickness and smoothing',
		smoothing: 'Smoothing',
		smoothingLevels: ['Off', 'Light', 'Medium', 'Strong'] as string[],
		smoothingHint: 'Smoother lines that follow the pen with a small delay',
		penOnly: 'Only the pen draws',
		penOnlyTip: 'Fingers only scroll and zoom, from the first touch on',
		penOnlyOn: 'Only the pen draws – fingers move the page',
		shapes: {
			line: 'Line',
			arrow: 'Arrow',
			doubleArrow: 'Double arrow',
			rect: 'Rectangle',
			roundedRect: 'Rounded rectangle',
			ellipse: 'Ellipse',
			triangle: 'Triangle',
			diamond: 'Diamond',
			parallelogram: 'Parallelogram',
			pentagon: 'Pentagon',
			hexagon: 'Hexagon',
			star: 'Star',
			polyline: 'Polyline',
			freePolygon: 'Polygon'
		},
		shapeHint: 'Drag on the page. Nearly square shapes become a square or circle. “Polyline” and “Polygon” take a click or drag per point; a double click, Enter or Esc ends them.',
		snap: 'Snap',
		shapeName: 'Shape',
		snapHint: 'Lines in 15° steps; edges and centers to the page, shapes; equal spacing. Hold Alt while dragging for the opposite.'
	},

	guides: {
		page: 'Snaps to the page',
		item: (name: string) => `Snaps to ${name}`
	},

	selection: {
		label: (n: number) => (n === 1 ? '1 item selected' : `${n} items selected`),
		color: 'Color',
		size: 'Thickness',
		sizeValue: (n: number) => `Thickness ${n}`,
		style: 'Style',
		duplicate: 'Duplicate',
		delete: 'Delete'
	},

	/** Draw order, aligning and distributing a selection (the ribbon's tab "Arrange") */
	arrange: {
		groups: { order: 'Order', align: 'Align', distribute: 'Distribute' },
		front: 'Bring to front',
		forward: 'Bring forward',
		backward: 'Send backward',
		back: 'Send to back',
		left: 'Align left',
		center: 'Align center',
		right: 'Align right',
		top: 'Align top',
		middle: 'Align middle',
		bottom: 'Align bottom',
		alignTip: 'Lines up the selected items with the box around them – a single one with the page',
		horizontal: 'Distribute horizontally',
		vertical: 'Distribute vertically',
		distributeTip: 'Spreads three or more selected items with equal gaps'
	},

	shapeStyle: {
		fill: 'Fill',
		noFill: 'None',
		line: 'Line',
		dashes: { solid: 'Solid', dashed: 'Dashed', dotted: 'Dotted' },
		sketch: 'Hand-drawn',
		cloud: 'Cloud',
		ends: { start: 'Start', end: 'End' },
		endOptions: { none: 'None', arrow: 'Arrow', closed: 'Closed arrow', circle: 'Circle', square: 'Square', diamond: 'Diamond', bar: 'Bar' }
	},

	suggest: {
		label: (shape: string) => `Convert to ${shape}`,
		hint: 'Replaces the stroke with a shape whose points you can move',
		names: {
			line: 'line',
			arrow: 'arrow',
			doubleArrow: 'double arrow',
			triangle: 'triangle',
			rectangle: 'rectangle',
			quadrilateral: 'quadrilateral',
			polygon: 'polygon',
			roundedRect: 'rounded rectangle',
			circle: 'circle',
			ellipse: 'ellipse'
		}
	}
};

export default en;
