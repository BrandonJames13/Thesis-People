import { createContext, useContext, useState, useEffect } from "react";

export const PALETTES = [
  {
    id: "default-dark",
    name: "Midnight",
    mode: "dark",
    description: "Classic deep dark",
    accent: "#6c8ef7",
    preview: ["#0e1018", "#1d2235", "#6c8ef7", "#3ecf8e"],
  },
  {
    id: "sunset-studio",
    name: "Sunset Studio",
    mode: "dark",
    description: "Purple nights, pink lights",
    accent: "#ff6b9d",
    preview: ["#1a0f2e", "#251440", "#ff6b9d", "#50dc78"],
  },
  {
    id: "ocean-depth",
    name: "Ocean Depth",
    mode: "dark",
    description: "Deep navy, teal currents",
    accent: "#0097e6",
    preview: ["#071e2c", "#0c2d42", "#0097e6", "#00c9a7"],
  },
  {
    id: "forest-glow",
    name: "Forest Glow",
    mode: "dark",
    description: "Emerald dark, vivid green",
    accent: "#39d353",
    preview: ["#0d1f14", "#152a1e", "#39d353", "#f7c948"],
  },
  {
    id: "volcanic-ember",
    name: "Volcanic Ember",
    mode: "dark",
    description: "Charred black, fire orange",
    accent: "#ff6b35",
    preview: ["#150b05", "#1e1008", "#ff6b35", "#ffc857"],
  },
  {
    id: "default-light",
    name: "Slate",
    mode: "light",
    description: "Clean cool-toned light",
    accent: "#4361ee",
    preview: ["#eef0f7", "#ffffff", "#4361ee", "#1a9e6e"],
  },
  {
    id: "warm-parchment",
    name: "Warm Parchment",
    mode: "light",
    description: "Cream base, burnt orange",
    accent: "#e85d04",
    preview: ["#fdf6ed", "#fff8f0", "#e85d04", "#0d8a54"],
  },
  {
    id: "rose-gold",
    name: "Rose Gold",
    mode: "light",
    description: "Warm white, deep rose",
    accent: "#d63884",
    preview: ["#fdf0f3", "#fff5f8", "#d63884", "#0d8a54"],
  },
];

export const PALETTE_VARS = {
  "default-dark": {
    "--bg": "#0e1018",
    "--surface": "#161923",
    "--surface2": "#1d2235",
    "--surface3": "#242840",
    "--border": "#2e3350",
    "--accent": "#6c8ef7",
    "--accent2": "#8aa3fa",
    "--green": "#3ecf8e",
    "--red": "#f66d6d",
    "--orange": "#f0a04b",
    "--purple": "#b987fa",
    "--text": "#e8eaf6",
    "--text2": "#8b90a8",
    "--text3": "#565b78",
  },
  "sunset-studio": {
    "--bg": "#1a0f2e",
    "--surface": "#201338",
    "--surface2": "#251440",
    "--surface3": "#2e1850",
    "--border": "#3d2060",
    "--accent": "#ff6b9d",
    "--accent2": "#ff8db5",
    "--green": "#50dc78",
    "--red": "#ff5c5c",
    "--orange": "#f0a04b",
    "--purple": "#c44dff",
    "--text": "#f0e6ff",
    "--text2": "#b89fd4",
    "--text3": "#7a6698",
  },
  "ocean-depth": {
    "--bg": "#071e2c",
    "--surface": "#0a2538",
    "--surface2": "#0c2d42",
    "--surface3": "#103650",
    "--border": "#1a4560",
    "--accent": "#0097e6",
    "--accent2": "#33b0f0",
    "--green": "#00c9a7",
    "--red": "#ff6b6b",
    "--orange": "#f7c948",
    "--purple": "#9b7fe8",
    "--text": "#e0f4ff",
    "--text2": "#7ab8d4",
    "--text3": "#3d6e88",
  },
  "forest-glow": {
    "--bg": "#0d1f14",
    "--surface": "#10261a",
    "--surface2": "#152a1e",
    "--surface3": "#1a3324",
    "--border": "#1e3d28",
    "--accent": "#39d353",
    "--accent2": "#5ce374",
    "--green": "#66e0a0",
    "--red": "#ff6b6b",
    "--orange": "#f7c948",
    "--purple": "#b987fa",
    "--text": "#d4f0dc",
    "--text2": "#7ab898",
    "--text3": "#3d6e52",
  },
  "volcanic-ember": {
    "--bg": "#150b05",
    "--surface": "#1a0e07",
    "--surface2": "#1e1008",
    "--surface3": "#261408",
    "--border": "#3a1e0a",
    "--accent": "#ff6b35",
    "--accent2": "#ff8c5e",
    "--green": "#50dc78",
    "--red": "#ff4f4f",
    "--orange": "#ffc857",
    "--purple": "#c44dff",
    "--text": "#ffe8d0",
    "--text2": "#c4906a",
    "--text3": "#7a5438",
  },
  "default-light": {
    "--bg": "#eef0f7",
    "--surface": "#ffffff",
    "--surface2": "#f4f5fb",
    "--surface3": "#e8eaf4",
    "--border": "#ced3e8",
    "--accent": "#4361ee",
    "--accent2": "#2744d4",
    "--green": "#1a9e6e",
    "--red": "#e03e3e",
    "--orange": "#c97a1a",
    "--purple": "#7c4ddb",
    "--text": "#1e2235",
    "--text2": "#4a5070",
    "--text3": "#7c84a8",
  },
  "warm-parchment": {
    "--bg": "#fdf6ed",
    "--surface": "#fffbf5",
    "--surface2": "#fff8f0",
    "--surface3": "#f5e8d4",
    "--border": "#e8d5b5",
    "--accent": "#e85d04",
    "--accent2": "#c44d00",
    "--green": "#0d8a54",
    "--red": "#c0392b",
    "--orange": "#f4a261",
    "--purple": "#8e44ad",
    "--text": "#2c1e0f",
    "--text2": "#6b4c2a",
    "--text3": "#a07850",
  },
  "rose-gold": {
    "--bg": "#fdf0f3",
    "--surface": "#ffffff",
    "--surface2": "#fff5f8",
    "--surface3": "#fce8ef",
    "--border": "#f0c8d8",
    "--accent": "#d63884",
    "--accent2": "#b02068",
    "--green": "#0d8a54",
    "--red": "#c0392b",
    "--orange": "#e07020",
    "--purple": "#7c4ddb",
    "--text": "#2d1520",
    "--text2": "#7a3858",
    "--text3": "#b07090",
  },
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [paletteId, setPaletteId] = useState(() => {
    try {
      return localStorage.getItem("paletteId") || "default-dark";
    } catch {
      return "default-dark";
    }
  });

  // Remember the last chosen palette per mode so the toggle can restore it
  const [lastDarkId, setLastDarkId] = useState(() => {
    try {
      return localStorage.getItem("lastDarkId") || "default-dark";
    } catch {
      return "default-dark";
    }
  });
  const [lastLightId, setLastLightId] = useState(() => {
    try {
      return localStorage.getItem("lastLightId") || "default-light";
    } catch {
      return "default-light";
    }
  });

  const palette = PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0];
  const theme = palette.mode;

  // Wrapped setter: also tracks last-used per mode
  const applyPalette = (id) => {
    const p = PALETTES.find((x) => x.id === id);
    if (!p) return;
    setPaletteId(id);
    if (p.mode === "dark") {
      setLastDarkId(id);
      try {
        localStorage.setItem("lastDarkId", id);
      } catch {
        /* ignore */
      }
    } else {
      setLastLightId(id);
      try {
        localStorage.setItem("lastLightId", id);
      } catch {
        /* ignore */
      }
    }
  };

  useEffect(() => {
    const vars = PALETTE_VARS[paletteId] ?? PALETTE_VARS["default-dark"];

    // ── KEY FIX ──────────────────────────────────────────────────────────────
    // Apply vars to document.body, NOT document.documentElement (:root).
    // index.css has `body.light { --bg: ... }` which has HIGHER specificity
    // than :root, so it was overriding JS-injected :root vars for light themes.
    // Setting vars directly on body.style beats both :root AND body.light rules.
    // ─────────────────────────────────────────────────────────────────────────
    const el = document.body;
    Object.entries(vars).forEach(([key, val]) => {
      el.style.setProperty(key, val);
    });

    // Keep .light class for any remaining mode-based CSS (shadows, table hover)
    el.classList.toggle("light", theme === "light");

    try {
      localStorage.setItem("paletteId", paletteId);
      localStorage.setItem("theme", theme);
    } catch {
      /* ignore */
    }
  }, [paletteId, theme]);

  // Toggle: flips mode and restores the last-used palette for that mode
  const toggleTheme = () => {
    if (theme === "dark") {
      applyPalette(lastLightId);
    } else {
      applyPalette(lastDarkId);
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        paletteId,
        setPaletteId: applyPalette,
        palette,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
