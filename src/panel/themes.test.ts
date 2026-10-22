import { describe, expect, it } from "vitest"
import { colorTokens, defaultTheme, themes, themeVars } from "./themes"

describe("themes", () => {
  it("defaults to the DevTools theme of the same kind", () => {
    expect(defaultTheme("light").id).toBe("devtools-light")
    expect(defaultTheme("dark").id).toBe("devtools-dark")
  })

  it("defines every color token, including SnapQL's own", () => {
    expect(colorTokens).toEqual([
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
    ])
    expect(defaultTheme("dark").colors).toMatchObject({
      border: "#3d3d3d",
      surface: "#1f1f1f",
      accent: "#7cacf8",
      success: "#81c995",
      "syntax-key": "#7cacf8",
      "syntax-string": "#f2a275",
      "syntax-number": "#b39dff",
    })
    expect(defaultTheme("light").colors).toMatchObject({
      border: "#e3e3e3",
      surface: "#f1f3f4",
      accent: "#0b57d0",
      success: "#188038",
      "syntax-key": "#0b57d0",
      "syntax-string": "#a8461b",
      "syntax-number": "#6a3fb8",
    })
  })

  it("has unique ids", () => {
    const ids = themes.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("turns every color token into one CSS variable", () => {
    for (const theme of themes) {
      expect(themeVars(theme)).toEqual(
        Object.fromEntries(
          colorTokens.map((token) => [`--theme-${token}`, theme.colors[token]]),
        ),
      )
    }
  })
})
