import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { addMappings, forward, isPrivateIpv4, soapBody, soapError, ssdpLocation, wanServices, type Gateway } from './upnp.js';

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
			const action = /#(\w+)"/.exec(String(req.headers.soapaction ?? ''))?.[1];
			const args = Object.fromEntries([...body.matchAll(/<(New\w+)>([^<]*)<\/\1>/g)].map(([, k, v]) => [k, v]));
			if (action === 'GetExternalIPAddress') {
				res.end(`<s:Envelope><s:Body><u:GetExternalIPAddressResponse><NewExternalIPAddress>203.0.113.7</NewExternalIPAddress></u:GetExternalIPAddressResponse></s:Body></s:Envelope>`);
				return;
			}
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

describe('parsing', () => {
	it('reads the location of an SSDP answer', () => {
		expect(ssdpLocation('HTTP/1.1 200 OK\r\nCACHE-CONTROL: max-age=1800\r\nLocation: http://192.168.178.1:49000/igddesc.xml\r\n\r\n')).toBe(
			'http://192.168.178.1:49000/igddesc.xml'
		);
		expect(ssdpLocation('HTTP/1.1 200 OK\r\n\r\n')).toBeUndefined();
	});

	it('finds nested WAN connection services with absolute control URLs', () => {
		expect(wanServices(description('/igdupnp/control/WANIPConn1'), 'http://192.168.178.1:49000/igddesc.xml')).toEqual([
			{ serviceType: SERVICE, controlUrl: 'http://192.168.178.1:49000/igdupnp/control/WANIPConn1' }
		]);
	});

	it('builds SOAP bodies and reads fault codes', () => {
		const body = soapBody(SERVICE, 'AddPortMapping', { NewExternalPort: 29400, NewPortMappingDescription: 'a<b' });
		expect(body).toContain(`<u:AddPortMapping xmlns:u="${SERVICE}"><NewExternalPort>29400</NewExternalPort><NewPortMappingDescription>a&lt;b</NewPortMappingDescription></u:AddPortMapping>`);
		expect(soapError(fault(718))).toBe(718);
		expect(soapError('<s:Envelope/>')).toBeUndefined();
	});

	it('recognizes addresses behind another NAT', () => {
		expect(['10.1.2.3', '172.20.0.1', '192.168.0.1', '100.64.0.1', '100.127.255.255'].every(isPrivateIpv4)).toBe(true);
		expect(['203.0.113.7', '100.128.0.1', '172.32.0.1'].some(isPrivateIpv4)).toBe(false);
	});
});

describe('addMappings', () => {
	it('forwards every port as UDP to the client with a lease', async () => {
		const { gateway, calls } = await fakeRouter(() => undefined);
		expect(await addMappings(gateway, '192.168.178.20', [29400, 29401])).toEqual({ mapped: [29400, 29401], taken: [], permanent: false });
		expect(calls[0]).toMatchObject({ NewExternalPort: '29400', NewInternalPort: '29400', NewProtocol: 'UDP', NewInternalClient: '192.168.178.20', NewLeaseDuration: '3600' });
	});

	it('falls back to permanent mappings and skips ports of other computers', async () => {
		const { gateway, calls } = await fakeRouter((args) => (args.NewLeaseDuration !== '0' ? 725 : args.NewExternalPort === '29401' ? 718 : undefined));
		expect(await addMappings(gateway, '192.168.178.20', [29400, 29401, 29402])).toEqual({ mapped: [29400, 29402], taken: [29401], permanent: true });
		expect(calls.map((c) => c.NewLeaseDuration)).toEqual(['3600', '0', '0', '0']);
	});

	it('stops when the router refuses', async () => {
		const { gateway, calls } = await fakeRouter(() => 606);
		await expect(addMappings(gateway, '192.168.178.20', [29400, 29401])).rejects.toThrow('UPnP error 606');
		expect(calls).toHaveLength(1);
	});
});

describe('forward', () => {
	it('reports the forwarded range with the public address', async () => {
		const { gateway } = await fakeRouter(() => undefined);
		expect(await forward([29400, 29401], async () => gateway)).toBe('Router: UDP 29400-29401 forwarded to 127.0.0.1 via UPnP (public 203.0.113.7)');
	});

	it('says what to forward by hand when the router refuses or is missing', async () => {
		const { gateway } = await fakeRouter(() => 606);
		expect(await forward([29400, 29401], async () => gateway)).toMatch(/^Router: automatic port forwarding refused \(UPnP error 606.*forward UDP 29400-29401 to 127\.0\.0\.1 in your router$/);
		expect(await forward([29400, 29401], async () => undefined)).toMatch(/^Router: no automatic port forwarding .* forward UDP 29400-29401 to /);
	});
});
