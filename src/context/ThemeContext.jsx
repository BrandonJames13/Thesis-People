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
    id: "aurora-dark",
    name: "Aurora",
    mode: "dark",
    description: "Northern lights, icy glow",
    accent: "#00e5cc",
    preview: ["#080e1a", "#0d1630", "#00e5cc", "#a78bfa"],
  },
  {
    id: "crimson-dark",
    name: "Crimson",
    mode: "dark",
    description: "Bold red, dark steel",
    accent: "#ef4444",
    preview: ["#0f0a0a", "#1c1010", "#ef4444", "#fb923c"],
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
  {
    id: "mint-fresh",
    name: "Mint Fresh",
    mode: "light",
    description: "Crisp white, fresh teal",
    accent: "#0d9488",
    preview: ["#f0fdfa", "#ffffff", "#0d9488", "#6366f1"],
  },
  {
    id: "lavender-light",
    name: "Lavender",
    mode: "light",
    description: "Soft purple, airy white",
    accent: "#7c3aed",
    preview: ["#f5f3ff", "#ffffff", "#7c3aed", "#db2777"],
  },
  {
    id: "tsu-maroon",
    name: "TSU Maroon",
    mode: "dark",
    description: "Tarlac State University",
    accent: "#C9A227",
    preview: ["#2a0a0a", "#3d1212", "#C9A227", "#e8c85a"],
  },
  {
    id: "tsu-gold",
    name: "TSU Gold",
    mode: "light",
    description: "Tarlac State University",
    accent: "#8B1A1A",
    preview: ["#fdf5e0", "#fffbf0", "#8B1A1A", "#C9A227"],
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
  "aurora-dark": {
    "--bg": "#080e1a",
    "--surface": "#0b1225",
    "--surface2": "#0d1630",
    "--surface3": "#111e3d",
    "--border": "#1a2d50",
    "--accent": "#00e5cc",
    "--accent2": "#33edd9",
    "--green": "#34d399",
    "--red": "#f87171",
    "--orange": "#fb923c",
    "--purple": "#a78bfa",
    "--text": "#e0f2fe",
    "--text2": "#7ab4cc",
    "--text3": "#3d6880",
  },
  "crimson-dark": {
    "--bg": "#0f0a0a",
    "--surface": "#160d0d",
    "--surface2": "#1c1010",
    "--surface3": "#231414",
    "--border": "#3a1a1a",
    "--accent": "#ef4444",
    "--accent2": "#f87171",
    "--green": "#4ade80",
    "--red": "#ff6b6b",
    "--orange": "#fb923c",
    "--purple": "#c084fc",
    "--text": "#fef2f2",
    "--text2": "#c4908a",
    "--text3": "#7a5058",
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
  "mint-fresh": {
    "--bg": "#f0fdfa",
    "--surface": "#ffffff",
    "--surface2": "#f0fdf9",
    "--surface3": "#ccfbf1",
    "--border": "#99f6e4",
    "--accent": "#0d9488",
    "--accent2": "#0f766e",
    "--green": "#059669",
    "--red": "#dc2626",
    "--orange": "#d97706",
    "--purple": "#6366f1",
    "--text": "#134e4a",
    "--text2": "#2d6b65",
    "--text3": "#5eaba3",
  },
  "lavender-light": {
    "--bg": "#f5f3ff",
    "--surface": "#ffffff",
    "--surface2": "#faf5ff",
    "--surface3": "#ede9fe",
    "--border": "#ddd6fe",
    "--accent": "#7c3aed",
    "--accent2": "#6d28d9",
    "--green": "#059669",
    "--red": "#dc2626",
    "--orange": "#d97706",
    "--purple": "#db2777",
    "--text": "#1e1b4b",
    "--text2": "#4c3d8f",
    "--text3": "#7c6fba",
  },
  "tsu-maroon": {
    "--bg": "#1a0505",
    "--surface": "#260909",
    "--surface2": "#3d1212",
    "--surface3": "#4f1a1a",
    "--border": "#6b2424",
    "--accent": "#C9A227",
    "--accent2": "#e8c85a",
    "--green": "#4ade80",
    "--red": "#f87171",
    "--orange": "#fb923c",
    "--purple": "#c084fc",
    "--text": "#fff5e0",
    "--text2": "#d4a96a",
    "--text3": "#8a6040",
  },
  "tsu-gold": {
    "--bg": "#fdf5e0",
    "--surface": "#fffbf0",
    "--surface2": "#fff8e1",
    "--surface3": "#faefc8",
    "--border": "#e8d48a",
    "--accent": "#8B1A1A",
    "--accent2": "#6e1212",
    "--green": "#15803d",
    "--red": "#b91c1c",
    "--orange": "#c2410c",
    "--purple": "#7c3aed",
    "--text": "#2d0a0a",
    "--text2": "#6b2020",
    "--text3": "#a05050",
  },
};

const ThemeContext = createContext();

function applyDisplayPrefs({ fontSize, density, animationsEnabled }) {
  const el = document.documentElement;

  // Font size → CSS vars used across the app
  const fontMap = {
    small: { base: "12px", sm: "11px", xs: "10px", lg: "14px", xl: "18px" },
    medium: { base: "13px", sm: "12px", xs: "11px", lg: "16px", xl: "20px" },
    large: { base: "15px", sm: "13px", xs: "12px", lg: "18px", xl: "24px" },
  };
  const f = fontMap[fontSize] ?? fontMap.medium;
  el.style.setProperty("--font-base", f.base);
  el.style.setProperty("--font-sm", f.sm);
  el.style.setProperty("--font-xs", f.xs);
  el.style.setProperty("--font-lg", f.lg);
  el.style.setProperty("--font-xl", f.xl);

  // Density → spacing vars
  const densityMap = {
    compact: { pad: "16px", gap: "10px", pagePad: "18px" },
    comfortable: { pad: "24px", gap: "16px", pagePad: "28px" },
    spacious: { pad: "32px", gap: "24px", pagePad: "40px" },
  };
  const d = densityMap[density] ?? densityMap.comfortable;
  el.style.setProperty("--spacing-pad", d.pad);
  el.style.setProperty("--spacing-gap", d.gap);
  el.style.setProperty("--page-pad", d.pagePad);

  // Animations
  const speed = animationsEnabled ? "0.15s" : "0s";
  const speedSlow = animationsEnabled ? "0.4s" : "0s";
  el.style.setProperty("--transition-speed", speed);
  el.style.setProperty("--transition-slow", speedSlow);
  document.body.setAttribute(
    "data-animations",
    animationsEnabled ? "on" : "off",
  );
}

export function ThemeProvider({ children }) {
  const load = (key, fallback) => {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  };
  const loadBool = (key, fallback) => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v === "true";
    } catch {
      return fallback;
    }
  };

  const [paletteId, setPaletteIdRaw] = useState(() =>
    load("paletteId", "default-dark"),
  );
  const [darkPaletteId, setDarkPaletteId] = useState(() =>
    load("darkPaletteId", "default-dark"),
  );
  const [lightPaletteId, setLightPaletteId] = useState(() =>
    load("lightPaletteId", "default-light"),
  );
  const [fontSize, setFontSize] = useState(() => load("fontSize", "medium"));
  const [density, setDensity] = useState(() => load("density", "comfortable"));
  const [sidebarStyle, setSidebarStyle] = useState(() =>
    load("sidebarStyle", "full"),
  );
  const [animationsEnabled, setAnimationsEnabled] = useState(() =>
    loadBool("animationsEnabled", true),
  );

  const palette = PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0];
  const theme = palette.mode;

  const applyPalette = (id) => {
    const p = PALETTES.find((x) => x.id === id);
    if (!p) return;
    setPaletteIdRaw(id);
    try {
      localStorage.setItem("paletteId", id);
    } catch {}
  };

  // Apply palette color vars + body.light class
  useEffect(() => {
    const vars = PALETTE_VARS[paletteId] ?? PALETTE_VARS["default-dark"];
    Object.entries(vars).forEach(([key, val]) =>
      document.body.style.setProperty(key, val),
    );
    document.body.classList.toggle("light", theme === "light");
    try {
      localStorage.setItem("theme", theme);
    } catch {}
  }, [paletteId, theme]);

  // Apply display prefs whenever any of them change
  useEffect(() => {
    applyDisplayPrefs({ fontSize, density, animationsEnabled });
    try {
      localStorage.setItem("fontSize", fontSize);
      localStorage.setItem("density", density);
      localStorage.setItem("animationsEnabled", String(animationsEnabled));
    } catch {}
  }, [fontSize, density, animationsEnabled]);

  // Sidebar style persistence
  useEffect(() => {
    try {
      localStorage.setItem("sidebarStyle", sidebarStyle);
    } catch {}
  }, [sidebarStyle]);

  // Bulk save from settings modal — nothing applies until Save is clicked
  const savePrefs = ({
    darkPaletteId: dp,
    lightPaletteId: lp,
    fontSize: fs,
    density: dn,
    sidebarStyle: ss,
    animationsEnabled: ae,
  }) => {
    try {
      localStorage.setItem("darkPaletteId", dp);
      localStorage.setItem("lightPaletteId", lp);
    } catch {}
    setDarkPaletteId(dp);
    setLightPaletteId(lp);
    setFontSize(fs);
    setDensity(dn);
    setSidebarStyle(ss);
    setAnimationsEnabled(ae);
    const currentMode = (
      PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0]
    ).mode;
    applyPalette(currentMode === "dark" ? dp : lp);
  };

  const toggleTheme = () => {
    if (theme === "dark") applyPalette(lightPaletteId);
    else applyPalette(darkPaletteId);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        paletteId,
        setPaletteId: applyPalette,
        palette,
        darkPaletteId,
        lightPaletteId,
        fontSize,
        density,
        sidebarStyle,
        animationsEnabled,
        savePrefs,
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
