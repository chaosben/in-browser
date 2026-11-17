import { describe, expect, it } from 'vitest';
import { taskCommand, unitFile, unitName } from './service.js';

describe('service', () => {
	it('writes one systemd template for all instances', () => {
		const unit = unitFile('/usr/bin/node', '/home/a b/.local/share/in-browser-p2p-node/starter.js');
		expect(unit).toContain('ExecStart="/usr/bin/node" "/home/a b/.local/share/in-browser-p2p-node/starter.js" run %i');
		expect(unit).toContain('Restart=on-failure');
		expect(unit).toContain('WantedBy=default.target');
		expect(unitName('anna')).toBe('in-browser-p2p-node@anna.service');
	});

	it('doubles % in systemd paths', () => {
		expect(unitFile('/opt/100%/node', '/s.js')).toContain('"/opt/100%%/node"');
	});

	it('starts the Windows task without a window', () => {
		const command = taskCommand('C:\\Program Files\\nodejs\\node.exe', "C:\\Users\\O'Neil\\starter.js", 'home');
		expect(command).toContain('-WindowStyle Hidden');
		expect(command).toContain("'C:\\Program Files\\nodejs\\node.exe'");
		expect(command).toContain(`'"C:\\Users\\O''Neil\\starter.js" run home'`);
	});
});
