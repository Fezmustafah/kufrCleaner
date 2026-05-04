// Custom Theme Template
// Rename this file to custom-theme.ts (or any name you prefer)
// Then set theme: "custom" in src/config.ts - it will work automatically!

export const customTheme = {
  // Al Andalus — warm parchment to deep charcoal
  primary: {
    50:  "#FAF6EF",  // manuscript ivory
    100: "#F2EAD8",  // aged parchment
    200: "#E0CEAF",  // warm sand
    300: "#C9B08A",  // dry earth
    400: "#A88C65",  // sienna mid
    500: "#8A6E4A",  // warm sienna
    600: "#6B5038",  // dark ochre
    700: "#4E3822",  // deep umber
    800: "#332410",  // near-black brown
    900: "#1E1409",  // ink
    950: "#120D05",  // deepest ink
  },
  // Al Andalus — burnished Alhambra gold
  highlight: {
    50:  "#FBF5E6",  // pale gilded parchment
    100: "#F5E9C8",  // light gold wash
    200: "#EAD08A",  // warm gold
    300: "#D4AC52",  // Alhambra gold mid
    400: "#C8963E",  // burnished gold
    500: "#B8840A",  // deep gold
    600: "#9A6C05",  // antique gold
    700: "#7A5203",  // dark gold
    800: "#5A3A02",  // bronze
    900: "#3A2501",  // dark bronze
    950: "#1E1200",  // near-black gold
  }
};

// Usage in src/config.ts:
// theme: "custom",
// customTheme: customTheme
