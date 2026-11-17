import { MediaQuery } from 'svelte/reactivity';

/** The primary pointer is a finger (phones, tablets): show touch alternatives to right-click, hover and drag */
export const coarsePointer = new MediaQuery('pointer: coarse', false);
