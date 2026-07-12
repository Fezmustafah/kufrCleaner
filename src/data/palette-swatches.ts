// Palette preview swatches: [surface, accent, tertiary] per theme.
// Values mirror the runtime theme registry in BaseLayout.astro (primary-100 /
// highlight-500 / secondary-500 or primary-500) — keep in sync when a theme
// is added there. House palettes first, the rest alphabetical.
// Shared by NavDrawer's palette dropdown and the homepage palette showcase.

export const SWATCHES: Record<string, [string, string, string]> = {
  'al-andalus':    ['#F2EAD8', '#B8840A', '#198D7B'],
  'ottoman-slate': ['#ECEEF1', '#C12B40', '#B9882A'],
  'minimal':       ['#F5F5F5', '#708794', '#737373'],
  'atom':          ['#EAEAEB', '#3D74E2', '#71717A'],
  'ayu':           ['#FCFCFC', '#E6913D', '#A8A8A8'],
  'catppuccin':    ['#F2E9E1', '#DCB6AF', '#7F849C'],
  'charcoal':      ['#FFFFFF', '#808080', '#454545'],
  'dracula':       ['#FAF8FF', '#8B5CF6', '#6272A4'],
  'everforest':    ['#F4F4F1', '#A7C080', '#A89984'],
  'flexoki':       ['#F2F0E5', '#319089', '#B7B5AC'],
  'gruvbox':       ['#F2E5BC', '#D79921', '#A89984'],
  'macos':         ['#F9F9F9', '#007AFF', '#A0A0A0'],
  'nord':          ['#E5E9F0', '#5E81AC', '#81A1C1'],
  'obsidian':      ['#E5E5E5', '#8257E7', '#525252'],
  'oxygen':        ['#F1F5F9', '#0EA5E9', '#64748B'],
  'rose-pine':     ['#F2E9E1', '#EB6F92', '#908CAA'],
  'sky':           ['#EDEDEC', '#2EAADC', '#72706C'],
  'solarized':     ['#EEE8D5', '#268BD2', '#93A1A1'],
  'things':        ['#F5F6F8', '#1B61C2', '#A9ABB0'],
};

export const swatchStyle = (t: string): string => {
  const [surface, accent, tertiary] = SWATCHES[t];
  return `background:
    radial-gradient(circle at 68% 70%, ${tertiary} 0 16%, transparent 17.5%),
    linear-gradient(135deg, ${surface} 0 49.5%, ${accent} 50.5% 100%);`;
};
