
export type GraphColorConfig = Partial<{
	backgroundColor: string;
	nodeColor: string;
	nodeColorHover: string;
	nodeColorAdjacent: string;
	nodeColorMuted: string;
	nodeColorCurrent: string;
	nodeColorVisited: string;
	nodeColorUnresolved: string;
	nodeColorExternal: string;
	nodeColorTag: string;
	nodeColor1: string;
	nodeColor2: string;
	nodeColor3: string;
	nodeColor4: string;
	nodeColor5: string;
	nodeColor6: string;
	nodeColor7: string;
	nodeColor8: string;
	nodeColor9: string;
	linkColor: string;
	linkColorHover: string;
	linkColorMuted: string;
	labelColor: string;
	labelColorHover: string;
	labelColorMuted: string;
}> & Record<string, string>;

function getHexColor(color: string): string {
	const trimmed = color.trim();
	if (!trimmed) return '#888888';
	if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed;
	if (/^#[0-9A-Fa-f]{3}$/.test(trimmed)) {
		return '#' + trimmed[1].repeat(2) + trimmed[2].repeat(2) + trimmed[3].repeat(2);
	}
	try {
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = 1;
		const ctx = canvas.getContext('2d')!;
		ctx.fillStyle = trimmed;
		ctx.fillRect(0, 0, 1, 1);
		const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
		return '#' + r.toString(16).padStart(2, '0')
		           + g.toString(16).padStart(2, '0')
		           + b.toString(16).padStart(2, '0');
	} catch {
		return '#888888';
	}
}

function readCssVar(varName: string): string | null {
	const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
	return raw ? getHexColor(raw) : null;
}

// Read a Tailwind palette channel var ("R G B") set by applyTheme() and convert to hex.
// Does NOT go through canvas — parses the channel triple directly.
function readChannelVar(varName: string): string | null {
	const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
	if (!raw) return null;
	const parts = raw.split(/\s+/).map(Number);
	if (parts.length !== 3 || parts.some(v => isNaN(v) || v < 0 || v > 255)) return null;
	return '#' + parts.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}

export const cssVariablesMap = {
	'backgroundColor':      '--slsg-graph-bg-color',
	'nodeColor':            '--slsg-node-color',
	'nodeColorHover':       '--slsg-node-color-hover',
	'nodeColorAdjacent':    '--slsg-node-color-adjacent',
	'nodeColorMuted':       '--slsg-node-color-muted',
	'nodeColorCurrent':     '--slsg-node-color-current',
	'nodeColorVisited':     '--slsg-node-color-visited',
	'nodeColorUnresolved':  '--slsg-node-color-unresolved',
	'nodeColorExternal':    '--slsg-node-color-external',
	'nodeColorTag':         '--slsg-node-color-tag',
	'nodeColor1':           '--slsg-node-color-1',
	'nodeColor2':           '--slsg-node-color-2',
	'nodeColor3':           '--slsg-node-color-3',
	'nodeColor4':           '--slsg-node-color-4',
	'nodeColor5':           '--slsg-node-color-5',
	'nodeColor6':           '--slsg-node-color-6',
	'nodeColor7':           '--slsg-node-color-7',
	'nodeColor8':           '--slsg-node-color-8',
	'nodeColor9':           '--slsg-node-color-9',
	'linkColor':            '--slsg-link-color',
	'linkColorHover':       '--slsg-link-color-hover',
	'linkColorMuted':       '--slsg-link-color-muted',
	'labelColor':           '--slsg-label-color',
	'labelColorHover':      '--slsg-label-color-hover',
	'labelColorMuted':      '--slsg-label-color-muted',
} as const;

export function getGraphColors(_node: HTMLElement, included_colors: string[], custom_color_map: Record<string, string>): GraphColorConfig {
	const isDark = document.documentElement.classList.contains('dark');
	const colors: GraphColorConfig = {};

	// backgroundColor for hollow tag nodes — resolve from page body, not from a CSS var
	const pageBackground = (() => {
		const bg = window.getComputedStyle(document.body).backgroundColor;
		if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return getHexColor(bg);
		return isDark ? '#0f172a' : '#f8fafc';
	})();

	const all_colors = [
		'nodeColorHover', 'nodeColorAdjacent', 'nodeColorMuted',
		'linkColor', 'linkColorHover', 'linkColorMuted',
		...included_colors,
	];

	// Step 1: Read from --slsg-* CSS vars (hardcoded hex in graph.css — safe fallbacks)
	for (const identifier of all_colors) {
		if (identifier === 'backgroundColor') {
			colors['backgroundColor'] = pageBackground;
			continue;
		}

		const cssVar = cssVariablesMap[identifier as keyof typeof cssVariablesMap];
		if (cssVar) {
			colors[identifier] = readCssVar(cssVar) ?? '#888888';
		} else {
			// custom colors (nodeColorCustomN etc.)
			const customVar = custom_color_map[identifier];
			if (customVar?.startsWith('--')) {
				colors[identifier] = readCssVar(customVar) ?? '#888888';
			} else if (customVar) {
				colors[identifier] = getHexColor(customVar);
			} else {
				colors[identifier] = '#888888';
			}
		}
	}

	// Step 2: Override with live palette values from applyTheme().
	// applyTheme() sets --color-primary/highlight/secondary-* as "R G B" channel
	// triples on :root.style. readChannelVar() converts them directly to hex without
	// going through the CSS custom-property chain (which is unreliable for getPropertyValue).
	const p   = (s: string) => readChannelVar(`--color-primary-${s}`);
	const hl  = (s: string) => readChannelVar(`--color-highlight-${s}`);
	const sec = (s: string) => readChannelVar(`--color-secondary-${s}`);

	const paletteOverrides: Record<string, string | null> = isDark ? {
		nodeColor:           p('400'),
		nodeColorHover:      hl('400'),
		nodeColorAdjacent:   p('600'),
		nodeColorMuted:      p('800'),
		nodeColorCurrent:    hl('500'),
		// Lighter than default node (p400) and adjacent (p600), distinct from current (highlight)
		nodeColorVisited:    p('300'),
		nodeColorUnresolved: p('700'),
		nodeColorExternal:   p('600'),
		nodeColorTag:        hl('300'),
		nodeColor1:          hl('400'),
		nodeColor2:          hl('300'),
		nodeColor4:          sec('400'),
		nodeColor5:          sec('300'),
		linkColor:           p('700'),
		linkColorHover:      hl('400'),
		linkColorMuted:      p('800'),
		labelColor:          p('200'),
		labelColorHover:     p('50'),
		labelColorMuted:     p('600'),
	} : {
		nodeColor:           p('400'),
		nodeColorHover:      hl('500'),
		nodeColorAdjacent:   p('500'),
		nodeColorMuted:      p('200'),
		nodeColorCurrent:    hl('600'),
		// Darker than default node (p400) and adjacent (p500), distinct from current (highlight)
		nodeColorVisited:    p('700'),
		nodeColorUnresolved: p('300'),
		nodeColorExternal:   p('400'),
		nodeColorTag:        hl('400'),
		nodeColor1:          hl('400'),
		nodeColor2:          hl('300'),
		nodeColor4:          sec('400'),
		nodeColor5:          sec('500'),
		linkColor:           p('200'),
		linkColorHover:      hl('500'),
		linkColorMuted:      p('100'),
		labelColor:          p('600'),
		labelColorHover:     p('900'),
		labelColorMuted:     p('400'),
	};

	for (const [key, val] of Object.entries(paletteOverrides)) {
		if (val != null) colors[key] = val;
	}

	return colors;
}
