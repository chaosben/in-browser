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
		laser: 'Laser pointer',
		eraserMode: 'Erases',
		eraserModes: { stroke: 'Whole strokes', pixel: 'Pixels' },
		size: 'Thickness',
		sizeValue: (n: number) => `Thickness ${n}`,
		options: 'Color, thickness and smoothing',
		smoothing: 'Smoothing',
		smoothingLevels: ['Off', 'Light', 'Medium', 'Strong'] as string[],
		smoothingHint: 'Smoother lines that follow the pen with a small delay',
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
			star: 'Star'
		},
		shapeHint: 'Drag on the page. Nearly square shapes become a square or circle.',
		snap: 'Snap',
		shapeName: 'Shape',
		picture: 'Picture',
		icon: 'Icon',
		snapHint: 'Lines in 15° steps; edges and centers to the page, shapes and pictures; equal spacing. Hold Alt while dragging for the opposite.'
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
		alignTip: 'Lines up two or more selected items with the box around them',
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
		heads: 'Arrowheads',
		headOptions: { none: 'None', end: 'At the end', start: 'At the start', both: 'At both ends' }
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
