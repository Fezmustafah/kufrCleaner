declare module 'astro:prefetch' {
	export function prefetch(url: string): void;
}

declare module '*.astro' {
	const Component: any;
	export default Component;
}

declare module 'virtual:starlight-site-graph/config' {
	const config: {
		trackVisitedPages: 'disable' | 'session' | 'local';
		debug: boolean;
		[key: string]: unknown;
	};
	export default config;
}

declare module 'pixi-stats' {
	export class Stats {
		constructor(options: unknown, ticker: unknown): void;
		domElement: HTMLElement | null;
	}
}

interface Navigator {
	msMaxTouchPoints?: number;
}

interface Window {
	opera?: any;
}
