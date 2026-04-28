
// Import custom theme if it exists (e.g. future "Al Andalus" theme)
let customTheme = null;
try {
  const custom = require('./custom/custom');
  customTheme = custom.customTheme;
} catch (error) {
  // Custom theme not found — fall back to a neutral palette so build doesn't crash
  customTheme = {
    primary: {
      50: "#f8fafc",
      100: "#f1f5f9",
      200: "#e2e8f0",
      300: "#cbd5e1",
      400: "#94a3b8",
      500: "#64748b",
      600: "#475569",
      700: "#334155",
      800: "#1e293b",
      900: "#0f172a",
      950: "#020617"
    },
    highlight: {
      50: "#fef2f2",
      100: "#fee2e2",
      200: "#fecaca",
      300: "#fca5a5",
      400: "#f87171",
      500: "#ef4444",
      600: "#dc2626",
      700: "#b91c1c",
      800: "#991b1b",
      900: "#7f1d1d",
      950: "#450a0a"
    }
  };
}

// Theme color definitions — kept lean: one bare reader-friendly default + custom slot
export const themes = {
  minimal: {
    primary: {
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#e5e5e5',
      300: '#d4d4d4',
      400: '#a3a3a3',
      500: '#737373',
      600: '#525252',
      700: '#404040',
      800: '#262626',
      900: '#212121',
      950: '#1a1a1a',
    },
    highlight: {
      50: '#f0f7f9',
      100: '#e1eff3',
      200: '#c3dfe7',
      300: '#a5cfdb',
      400: '#87bfcf',
      500: '#708794',
      600: '#5a6d77',
      700: '#43535a',
      800: '#2d383c',
      900: '#161d1f',
    }
  },
  ...(customTheme ? { custom: customTheme } : {})
} as const;

// Valid theme names type
export type ThemeName = keyof typeof themes;

// Helper function to get theme
export function getTheme(themeName: ThemeName) {
  return themes[themeName];
}

// Get all theme names
export function getThemeNames(): ThemeName[] {
  return Object.keys(themes) as ThemeName[];
}

// Check if a theme name is a custom theme (not in built-in themes)
export function isCustomTheme(themeName: string): boolean {
  return themeName !== 'minimal' && themeName !== 'custom';
}

// Load a custom theme by filename (for dynamic loading)
export async function loadCustomTheme(themeName: string) {
  try {
    const customTheme = await import(`./custom/${themeName}`);
    return customTheme.customTheme;
  } catch (error) {
    console.warn(`Custom theme "${themeName}" not found in themes/custom/`);
    return null;
  }
}
