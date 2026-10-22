import { describe, expect, it } from "vitest"
import { colorTokens, defaultTheme, themes, themeVars } from "./themes"

describe("themes", () => {
  it("defaults to the DevTools theme of the same kind", () => {
    expect(defaultTheme("light").id).toBe("devtools-light")
    expect(defaultTheme("dark").id).toBe("devtools-dark")
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
