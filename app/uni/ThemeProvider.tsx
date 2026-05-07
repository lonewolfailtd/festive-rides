"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Mode = "light" | "dark";
export type Palette = "rose" | "sage" | "lavender" | "coral" | "classic";

export const PALETTES: {
  key: Palette;
  label: string;
  blurb: string;
  swatch: string; // hex for the picker preview swatch
}[] = [
  {
    key: "rose",
    label: "Rose Quartz",
    blurb: "Dusty pink + plum, warm and sophisticated.",
    swatch: "#db5074",
  },
  {
    key: "sage",
    label: "Sage Study",
    blurb: "Calm botanical green for long sessions.",
    swatch: "#607a55",
  },
  {
    key: "lavender",
    label: "Lavender Twilight",
    blurb: "Soft and dreamy, lands well at night.",
    swatch: "#7960af",
  },
  {
    key: "coral",
    label: "Sunrise Coral",
    blurb: "Warm and energetic, morning-person fuel.",
    swatch: "#e8552e",
  },
  {
    key: "classic",
    label: "Classic Sky",
    blurb: "The original sky-blue. Reliable and clean.",
    swatch: "#0ea5e9",
  },
];

interface ThemeContextValue {
  mode: Mode;
  palette: Palette;
  toggle: () => void;
  setMode: (m: Mode) => void;
  setPalette: (p: Palette) => void;
  // Backwards compat with earlier name used in components
  theme: Mode;
  setTheme: (m: Mode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const MODE_KEY = "uni-tool-theme"; // light/dark
const PALETTE_KEY = "uni-tool-palette"; // accent palette

const DEFAULT_PALETTE: Palette = "rose";

function applyMode(mode: Mode) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", mode === "dark");
}

function applyPalette(palette: Palette) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", palette);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>("light");
  const [palette, setPaletteState] = useState<Palette>(DEFAULT_PALETTE);

  useEffect(() => {
    // Restore mode (light/dark) from localStorage or OS preference.
    const storedMode = window.localStorage.getItem(MODE_KEY) as Mode | null;
    if (storedMode === "light" || storedMode === "dark") {
      setModeState(storedMode);
      applyMode(storedMode);
    } else {
      const prefersDark =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initial: Mode = prefersDark ? "dark" : "light";
      setModeState(initial);
      applyMode(initial);
    }

    // Restore palette
    const storedPalette = window.localStorage.getItem(PALETTE_KEY) as Palette | null;
    const validPalettes: Palette[] = ["rose", "sage", "lavender", "coral", "classic"];
    if (storedPalette && validPalettes.includes(storedPalette)) {
      setPaletteState(storedPalette);
      applyPalette(storedPalette);
    } else {
      applyPalette(DEFAULT_PALETTE);
    }
  }, []);

  const setMode = (m: Mode) => {
    setModeState(m);
    applyMode(m);
    window.localStorage.setItem(MODE_KEY, m);
  };

  const setPalette = (p: Palette) => {
    setPaletteState(p);
    applyPalette(p);
    window.localStorage.setItem(PALETTE_KEY, p);
  };

  const toggle = () => setMode(mode === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider
      value={{
        mode,
        palette,
        toggle,
        setMode,
        setPalette,
        theme: mode,
        setTheme: setMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition-colors hover:border-sky-500 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:text-sky-300 ${className}`}
    >
      {theme === "dark" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

/**
 * Compact palette swatch picker. 5 dots, click one to apply.
 * Drops anywhere — used in the dashboard top toolbar and Settings.
 */
export function PalettePicker({ className = "" }: { className?: string }) {
  const { palette, setPalette } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={`inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 ${className}`}
    >
      {PALETTES.map((p) => {
        const selected = p.key === palette;
        return (
          <button
            key={p.key}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setPalette(p.key)}
            title={`${p.label} — ${p.blurb}`}
            aria-label={p.label}
            className={`relative h-5 w-5 rounded-full transition-transform ${
              selected ? "ring-2 ring-offset-2 ring-slate-700 dark:ring-slate-200 dark:ring-offset-slate-900 scale-110" : "hover:scale-110"
            }`}
            style={{ backgroundColor: p.swatch }}
          >
            <span className="sr-only">{p.label}</span>
          </button>
        );
      })}
    </div>
  );
}
