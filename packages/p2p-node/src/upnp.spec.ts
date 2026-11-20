import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { addMappings, wanServices, type Gateway } from './upnp.js';

const SERVICE = 'urn:schemas-upnp-org:service:WANIPConnection:1';

const description = (control: string) => `<?xml version="1.0"?>
<root xmlns="urn:schemas-upnp-org:device-1-0"><device>
	<serviceList><service><serviceType>urn:schemas-upnp-org:service:Layer3Forwarding:1</serviceType><controlURL>/l3f</controlURL></service></serviceList>
	<deviceList><device><deviceList><device><serviceList>
		<service><serviceType>${SERVICE}</serviceType><controlURL>${control}</controlURL></service>
	</serviceList></device></deviceList></device></deviceList>
</device></root>`;

const fault = (code: number) =>
	`<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><s:Fault><detail><UPnPError xmlns="urn:schemas-upnp-org:control-1-0"><errorCode>${code}</errorCode><errorDescription>x</errorDescription></UPnPError></detail></s:Fault></s:Body></s:Envelope>`;

/** A router answering AddPortMapping via `answer` (status 200 or an error code) */
let server: Server | undefined;
afterEach(() => new Promise<void>((done) => (server ? server.close(() => done()) : done())));

async function fakeRouter(answer: (args: Record<string, string>) => number | undefined) {
	const calls: Record<string, string>[] = [];
	server = createServer((req, res) => {
		let body = '';
		req.on('data', (chunk) => (body += chunk));
		req.on('end', () => {
			const args = Object.fromEntries([...body.matchAll(/<(New\w+)>([^<]*)<\/\1>/g)].map(([, k, v]) => [k, v]));
			calls.push(args);
			const code = answer(args);
			res.statusCode = code ? 500 : 200;
			res.end(code ? fault(code) : '<s:Envelope/>');
		});
	});
	await new Promise<void>((done) => server!.listen(0, '127.0.0.1', done));
	const gateway: Gateway = { host: '127.0.0.1', serviceType: SERVICE, controlUrl: `http://127.0.0.1:${(server!.address() as AddressInfo).port}/ctl` };
	return { gateway, calls };
}

describe('UPnP port forwarding', () => {
	it('finds nested WAN connection services with absolute control URLs', () => {
		expect(wanServices(description('/igdupnp/control/WANIPConn1'), 'http://192.168.178.1:49000/igddesc.xml')).toEqual([
			{ serviceType: SERVICE, controlUrl: 'http://192.168.178.1:49000/igdupnp/control/WANIPConn1' }
		]);
	});

	it('forwards every port as UDP, falling back to permanent mappings and skipping ports of other computers', async () => {
		const { gateway, calls } = await fakeRouter((args) => (args.NewLeaseDuration !== '0' ? 725 : args.NewExternalPort === '29401' ? 718 : undefined));
		expect(await addMappings(gateway, '192.168.178.20', [29400, 29401, 29402])).toEqual({ mapped: [29400, 29402], taken: [29401], permanent: true });
		expect(calls[0]).toMatchObject({ NewExternalPort: '29400', NewInternalPort: '29400', NewProtocol: 'UDP', NewInternalClient: '192.168.178.20', NewLeaseDuration: '3600' });
		expect(calls.map((c) => c.NewLeaseDuration)).toEqual(['3600', '0', '0', '0']);
	});
});
