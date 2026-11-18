import { parseLines } from '../table/jsonl.js';
import { removeLine } from '../table/model.js';
import { encodeValue, insertRaw, jsonFormat } from './json.js';
import { swap, type TreeFormat, type TreeNode } from './model.js';

// JSON Lines as a tree: one node per line, below it the line's value as in JSON. Changes inside a line work as in
// JSON but stay on that line; lines themselves are added, removed and moved as whole lines.

/** The node of a line: its object/array, or its single value */
function lineNode(root: TreeNode, range: { from: number; to: number }): TreeNode | null {
	const node = root.kind === 'document' ? root.children?.[0] : root;
	if (!node) return null;
	return { ...node, range, can: { ...node.can, remove: true, duplicate: true, move: true, rename: false } };
}

export const jsonlTreeFormat: TreeFormat = {
	parse(doc) {
		let error: number | null = null;
		const children: TreeNode[] = [];
		for (const line of parseLines(doc)) {
			error ??= line.error;
			const node = lineNode(line.root, line.range);
			if (node) children.push(node);
		}
		const root: TreeNode = { id: '', kind: 'document', range: { from: 0, to: doc.length }, children, can: { add: ['item'] } };
		return { root, error };
	},

	setValue: (doc, node, value) => jsonFormat.setValue(doc, node, value),
	rename: (doc, node, key) => jsonFormat.rename(doc, node, key),

	insert(doc, parent, index, child) {
		if (parent.id !== '') {
			if (child.kind === 'entry' && parent.kind === 'object') {
				return insertRaw(doc, parent, index, `${JSON.stringify(child.key)}: ${encodeValue(child.value)}`, true);
			}
			if (child.kind === 'item' && parent.kind === 'array') return insertRaw(doc, parent, index, encodeValue(child.value), true);
			return null;
		}
		if (child.kind !== 'item') return null;
		const line = encodeValue(child.value);
		const lines = parent.children ?? [];
		if (index < lines.length) return { from: lines[index].range.from, insert: `${line}\n` };
		const last = lines.at(-1);
		return last ? { from: last.range.to, insert: `\n${line}` } : { from: 0, to: doc.length, insert: `${line}\n` };
	},

	remove(doc, parent, node) {
		return parent.id === '' ? removeLine(doc, node.range) : jsonFormat.remove(doc, parent, node);
	},

	duplicate(doc, parent, node) {
		if (parent.id !== '') return jsonFormat.duplicate(doc, parent, node);
		return { from: node.range.to, insert: `\n${doc.slice(node.range.from, node.range.to)}` };
	},

	move(doc, parent, node, delta) {
		if (parent.id !== '') return jsonFormat.move(doc, parent, node, delta);
		const lines = parent.children ?? [];
		const other = lines[lines.indexOf(node) + delta];
		return other ? swap(doc, node.range, other.range) : null;
	}
};
