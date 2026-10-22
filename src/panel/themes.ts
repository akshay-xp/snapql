import type { ThemeKind } from "../browser/devtools"

export const colorTokens = [
  "bg",
  "fg",
  "muted",
  "border",
  "selected",
  "error",
  "surface",
  "accent",
  "success",
  "syntax-key",
  "syntax-string",
  "syntax-number",
] as const

export type ColorToken = (typeof colorTokens)[number]

export type Theme = {
  id: string
  name: string
  kind: ThemeKind
  colors: Record<ColorToken, string>
}

// Values copied from the DevTools document's --sys-color-* variables, so the
// panel looks native. Source variable per token:
// bg cdt-base-container, fg on-surface, muted token-subtle (dark only; the
// light value fails 4.5:1 on surface), selected tonal-container, error error. The rest are SnapQL's own: border is softer
// than DevTools' divider, and surface, accent, success and syntax-* have no
// DevTools counterpart.
export const themes: Theme[] = [
  {
    id: "devtools-light",
    name: "DevTools Light",
    kind: "light",
    colors: {
      bg: "#ffffff",
      fg: "#1f1f1f",
      muted: "#5f6368",
      border: "#e3e3e3",
      selected: "#d3e3fd",
      error: "#b3261e",
      surface: "#f1f3f4",
      accent: "#0b57d0",
      success: "#188038",
      "syntax-key": "#0b57d0",
      "syntax-string": "#a8461b",
      "syntax-number": "#6a3fb8",
    },
  },
  {
    id: "devtools-dark",
    name: "DevTools Dark",
    kind: "dark",
    colors: {
      bg: "#282828",
      fg: "#e3e3e3",
      muted: "#8f8f8f",
      border: "#3d3d3d",
      selected: "#004a77",
      error: "#f2b8b5",
      surface: "#1f1f1f",
      accent: "#7cacf8",
      success: "#81c995",
      "syntax-key": "#7cacf8",
      "syntax-string": "#f2a275",
      "syntax-number": "#b39dff",
    },
  },
]

export function defaultTheme(kind: ThemeKind): Theme {
  return themes.find((t) => t.id === `devtools-${kind}`) as Theme
}

export function themeVars(theme: Theme): Record<string, string> {
  return Object.fromEntries(
    colorTokens.map((token) => [`--theme-${token}`, theme.colors[token]]),
  )
}
