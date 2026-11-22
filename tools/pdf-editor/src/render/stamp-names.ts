// The words of the PDF standard's stamps (apart from the drawing code, so plain logic can use them)

/** The stamps of the PDF standard offered here, with their colors */
export const STAMPS = {
	Approved: '#15803d',
	Final: '#15803d',
	Draft: '#1d4ed8',
	ForComment: '#1d4ed8',
	AsIs: '#1d4ed8',
	NotApproved: '#b91c1c',
	Confidential: '#b91c1c',
	TopSecret: '#b91c1c',
	Expired: '#b91c1c',
	Sold: '#7e22ce'
} as const;
export type StampName = keyof typeof STAMPS;
export const STAMP_NAMES = Object.keys(STAMPS) as StampName[];
