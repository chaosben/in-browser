import { createSocket } from 'node:dgram';

// Reachable from outside the home network: the sync process binds its WebRTC sockets to a fixed UDP range and asks
// the router (UPnP IGD) to forward it, so browsers behind any NAT reach the node at the router's public IPv4.
// Without UPnP (off, or not allowed for this computer) the log says which ports to forward by hand.

/** UDP ports of the node's WebRTC sockets: below the ephemeral ranges of Linux (32768–) and Windows (49152–), and
 * wide enough for several instances and devices (werift takes one port per local address and connection). */
export const ICE_PORTS: [number, number] = [29400, 29449];

const SSDP = { address: '239.255.255.250', port: 1900 };
const SEARCH_TARGETS = [
	'urn:schemas-upnp-org:device:InternetGatewayDevice:1',
	'urn:schemas-upnp-org:device:InternetGatewayDevice:2',
	'urn:schemas-upnp-org:service:WANIPConnection:1',
	'urn:schemas-upnp-org:service:WANIPConnection:2',
	'urn:schemas-upnp-org:service:WANPPPConnection:1'
];
const SERVICE = /^urn:schemas-upnp-org:service:WAN(IP|PPP)Connection:\d$/;
const DESCRIPTION = 'in-browser p2p-node';
/** Lease of a mapping (renewed every half of it); routers that only take permanent ones get 0 */
const LEASE = 60 * 60;
const TIMEOUT = 5000;

export interface Gateway {
	/** Address of the router (as seen from here) */
	host: string;
	serviceType: string;
	controlUrl: string;
}

export class UpnpError extends Error {
	constructor(readonly code: number) {
		super(`UPnP error ${code}`);
	}
}

const tag = (xml: string, name: string) => new RegExp(`<(?:\\w+:)?${name}>([^<]*)</(?:\\w+:)?${name}>`).exec(xml)?.[1]?.trim();

/** `LOCATION` of an SSDP response */
export function ssdpLocation(response: string): string | undefined {
	return /^location:\s*(\S+)/im.exec(response)?.[1];
}

/** WAN connection services of a device description, with absolute control URLs */
export function wanServices(xml: string, location: string): { serviceType: string; controlUrl: string }[] {
	const base = tag(xml, 'URLBase') || location;
	const services: { serviceType: string; controlUrl: string }[] = [];
	for (const [, block] of xml.matchAll(/<(?:\w+:)?service>([\s\S]*?)<\/(?:\w+:)?service>/g)) {
		const serviceType = tag(block, 'serviceType');
		const control = tag(block, 'controlURL');
		if (!serviceType || !control || !SERVICE.test(serviceType)) continue;
		try {
			services.push({ serviceType, controlUrl: new URL(control, base).href });
		} catch {
			// Broken URL: not this one
		}
	}
	return services;
}

const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function soapBody(serviceType: string, action: string, args: Record<string, string | number>): string {
	const params = Object.entries(args)
		.map(([key, value]) => `<${key}>${escape(String(value))}</${key}>`)
		.join('');
	return (
		'<?xml version="1.0"?>' +
		'<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">' +
		`<s:Body><u:${action} xmlns:u="${serviceType}">${params}</u:${action}></s:Body></s:Envelope>`
	);
}

/** `errorCode` of a SOAP fault */
export function soapError(xml: string): number | undefined {
	const code = Number(tag(xml, 'errorCode'));
	return Number.isInteger(code) && code > 0 ? code : undefined;
}

async function soap(gateway: Gateway, action: string, args: Record<string, string | number> = {}): Promise<string> {
	const response = await fetch(gateway.controlUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'text/xml; charset="utf-8"', SOAPAction: `"${gateway.serviceType}#${action}"` },
		body: soapBody(gateway.serviceType, action, args),
		signal: AbortSignal.timeout(TIMEOUT)
	});
	const text = await response.text();
	if (!response.ok) throw new UpnpError(soapError(text) ?? response.status);
	return text;
}

/** Locations of the gateways answering an SSDP search within `timeout` */
function search(timeout: number): Promise<{ location: string; host: string }[]> {
	return new Promise((done) => {
		const found = new Map<string, string>();
		const socket = createSocket('udp4');
		const finish = () => {
			socket.close();
			done([...found].map(([location, host]) => ({ location, host })));
		};
		socket.on('error', finish);
		socket.on('message', (message, remote) => {
			const location = ssdpLocation(message.toString());
			if (location && !found.has(location)) found.set(location, remote.address);
		});
		socket.bind(() => {
			for (const st of SEARCH_TARGETS) {
				const query = `M-SEARCH * HTTP/1.1\r\nHOST: ${SSDP.address}:${SSDP.port}\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: ${st}\r\n\r\n`;
				socket.send(query, SSDP.port, SSDP.address);
			}
			setTimeout(finish, timeout);
		});
	});
}

/** The router's WAN connection: the first connected one, else the first one at all */
export async function discover(timeout = 3000): Promise<Gateway | undefined> {
	const gateways: Gateway[] = [];
	for (const { location, host } of await search(timeout)) {
		try {
			const response = await fetch(location, { signal: AbortSignal.timeout(TIMEOUT) });
			for (const service of wanServices(await response.text(), location)) gateways.push({ host, ...service });
		} catch {
			// Not reachable or no description: another one may answer
		}
	}
	for (const gateway of gateways) {
		const status = await soap(gateway, 'GetStatusInfo').catch(() => '');
		if (tag(status, 'NewConnectionStatus') === 'Connected') return gateway;
	}
	return gateways[0];
}

/** This computer's address towards `remote` (no packet is sent) */
export function localAddress(remote: string): Promise<string | undefined> {
	return new Promise((done) => {
		const socket = createSocket('udp4');
		socket.on('error', () => {
			socket.close();
			done(undefined);
		});
		socket.connect(9, remote, () => {
			const { address } = socket.address();
			socket.close();
			done(address);
		});
	});
}

export interface Mapped {
	mapped: number[];
	/** Ports the router already forwards to another computer */
	taken: number[];
	/** The router only takes mappings without lease (they stay until removed there) */
	permanent: boolean;
}

/** Forwards each port (UDP, same port outside) to `client`. Throws when the router refuses (e.g. not allowed). */
export async function addMappings(gateway: Gateway, client: string, ports: number[], lease = LEASE): Promise<Mapped> {
	const result: Mapped = { mapped: [], taken: [], permanent: lease === 0 };
	for (const port of ports) {
		const add = (duration: number) =>
			soap(gateway, 'AddPortMapping', {
				NewRemoteHost: '',
				NewExternalPort: port,
				NewProtocol: 'UDP',
				NewInternalPort: port,
				NewInternalClient: client,
				NewEnabled: 1,
				NewPortMappingDescription: DESCRIPTION,
				NewLeaseDuration: duration
			});
		try {
			await add(result.permanent ? 0 : lease);
		} catch (e) {
			if (e instanceof UpnpError && e.code === 725 && !result.permanent) {
				result.permanent = true;
				try {
					await add(0);
				} catch (again) {
					if (!(again instanceof UpnpError && again.code === 718)) throw again;
					result.taken.push(port);
					continue;
				}
			} else if (e instanceof UpnpError && e.code === 718) {
				result.taken.push(port);
				continue;
			} else throw e;
		}
		result.mapped.push(port);
	}
	return result;
}

export async function externalAddress(gateway: Gateway): Promise<string | undefined> {
	return tag(await soap(gateway, 'GetExternalIPAddress'), 'NewExternalIPAddress') || undefined;
}

/** Private, shared (carrier-grade NAT) or link-local IPv4: the router itself sits behind another NAT */
export function isPrivateIpv4(address: string): boolean {
	const [a, b] = address.split('.').map(Number);
	return a === 10 || (a === 172 && b >= 16 && b < 32) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b < 128) || (a === 169 && b === 254);
}

/** One line on the forwarding of `range` (for the log) */
export async function forward([from, to]: [number, number], find: () => Promise<Gateway | undefined> = discover): Promise<string> {
	const ports = Array.from({ length: to - from + 1 }, (_, i) => from + i);
	const range = `UDP ${from}-${to}`;
	const gateway = await find();
	const client = await localAddress(gateway?.host ?? '1.1.1.1');
	const manual = `to sync from outside your home network, forward ${range} to ${client ?? 'this computer'} in your router`;
	if (!gateway) return `Router: no automatic port forwarding (no UPnP answer) – ${manual}`;
	if (!client) return `Router: no local address towards ${gateway.host} – ${manual}`;
	let result: Mapped;
	try {
		result = await addMappings(gateway, client, ports);
	} catch (e) {
		return `Router: automatic port forwarding refused (${e instanceof Error ? e.message : e}; on a FRITZ!Box allow "permit independent port sharing" for this computer) – ${manual}`;
	}
	if (!result.mapped.length) return `Router: ${range} is forwarded to another computer already – forward it to ${client} instead`;
	const external = await externalAddress(gateway).catch(() => undefined);
	return [
		`Router: ${range} forwarded to ${client} via UPnP`,
		external ? ` (public ${external})` : '',
		result.permanent ? ', kept by the router until removed there' : '',
		result.taken.length ? `; forwarded to another computer: ${result.taken.join(', ')}` : '',
		external && isPrivateIpv4(external)
			? ` – but the router has no public IPv4 (${external}), so this won't help from outside`
			: ` – if this computer has a firewall, allow ${range} there too`
	].join('');
}

/** Forwards `range` now and every half lease (the router may allow it later); logs when the outcome changes */
export function keepForwarded(range: [number, number], log: (line: string) => void): () => void {
	let last = '';
	const once = async () => {
		const line = await forward(range).catch((e: unknown) => `Router: port forwarding failed (${e instanceof Error ? e.message : e})`);
		if (line !== last) log(line);
		last = line;
	};
	void once();
	const timer = setInterval(() => void once(), (LEASE / 2) * 1000);
	return () => clearInterval(timer);
}
