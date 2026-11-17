import type { IconData } from '../types.js';

export type IconCategory = 'arrows' | 'notices' | 'status' | 'input' | 'objects' | 'people';

export interface IconCategoryGroup {
	id: IconCategory;
	icons: IconData[];
}
