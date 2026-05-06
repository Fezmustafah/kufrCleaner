// Al Andalus — Alhambra candlelight palette
//
// Dark mode philosophy: Gruvbox-quality steps (≥6% L gap per surface) at a
// warm amber register — textured walnut, NOT digital void. Body bg is dark
// enough for sharp contrast (13:1) but warm enough to feel like layered wood.
//
// Light mode: manuscript ivory & warm sienna — unchanged.

export const customTheme = {
  primary: {
    50:  "#FAF5EC",  // manuscript ivory
    100: "#F1E6D0",  // aged parchment
    200: "#DECFAB",  // warm sand
    300: "#C6AB83",  // dry earth
    400: "#A6875F",  // sienna mid
    500: "#886944",  // warm sienna
    600: "#6A5033",  // dark ochre
    // Dark-mode layered surfaces — Gruvbox-quality steps, warm amber texture
    700: "#6A4422",  // warm umber — cards, callouts, elevated surfaces  (L≈27%)
    800: "#4A2E12",  // dark amber — sidebar, secondary bg               (L≈18%)
    900: "#2E1C09",  // very dark walnut — body background               (L≈12%)
    950: "#180E04",  // near-black amber — deepest: code bg, depths      (L≈6%)
  },
  highlight: {
    // Burnished Alhambra gold — accent, links, active states
    50:  "#FBF4E4",
    100: "#F4E7C2",
    200: "#E8CE82",
    300: "#D4AD50",
    400: "#C8953C",  // primary dark-mode link/accent
    500: "#B8840A",
    600: "#9A6C05",
    700: "#7A5203",
    800: "#5A3A02",
    900: "#3A2401",
    950: "#1E1200",
  },
  secondary: {
    // Zellige turquoise — cool relief, tags, info states
    50:  "#EBF8F5",
    100: "#C6ECE4",
    200: "#8BD5C7",
    300: "#49BFAC",
    400: "#26A692",
    500: "#178D79",
    600: "#107562",
    700: "#0C5A4C",
    800: "#073F37",
    900: "#042823",
    950: "#021512",
  }
};
