import { describe, expect, it } from 'vitest';
import { taskCommand, unitFile } from './service.js';

// Paths with spaces, quotes and % must survive the service definitions
describe('service', () => {
	it('writes one systemd template for all instances', () => {
		const unit = unitFile('/opt/100%/node', '/home/a b/.local/share/in-browser-p2p-node/starter.js');
		expect(unit).toContain('ExecStart="/opt/100%%/node" "/home/a b/.local/share/in-browser-p2p-node/starter.js" run %i');
		expect(unit).toContain('Restart=on-failure');
	});

	it('starts the Windows task without a window', () => {
		const command = taskCommand('C:\\Program Files\\nodejs\\node.exe', "C:\\Users\\O'Neil\\starter.js", 'home');
		expect(command).toContain('-WindowStyle Hidden');
		expect(command).toContain("'C:\\Program Files\\nodejs\\node.exe'");
		expect(command).toContain(`'"C:\\Users\\O''Neil\\starter.js" run home'`);
	});
});
