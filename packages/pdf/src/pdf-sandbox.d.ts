// PDF.js's scripting sandbox ships without types
declare module 'pdfjs-dist/build/pdf.sandbox.min.mjs' {
	interface Sandbox {
		create(data: unknown): void;
		dispatchEvent(event: unknown): void;
		nukeSandbox(): void;
	}
	export function QuickJSSandbox(wasmUrl: string): Promise<Sandbox>;
}
