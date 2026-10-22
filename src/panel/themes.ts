import type { ThemeKind } from "../browser/devtools"

export const colorTokens = [
  "bg",
  "fg",
  "muted",
  "border",
  "selected",
  "error",
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
// bg cdt-base-container, fg on-surface, muted token-subtle, border divider,
// selected tonal-container, error error.
export const themes: Theme[] = [
  {
    id: "devtools-light",
    name: "DevTools Light",
    kind: "light",
    colors: {
      bg: "#ffffff",
      fg: "#1f1f1f",
      muted: "#757575",
      border: "#d3e3fd",
      selected: "#d3e3fd",
      error: "#b3261e",
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
      border: "#5e5e5e",
      selected: "#004a77",
      error: "#f2b8b5",
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
