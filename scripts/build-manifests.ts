export type Target = "chrome" | "firefox"

// Provisional until an AMO account exists.
const GECKO_ID = "snapql@akshay-xp"

const base = {
  manifest_version: 3,
  name: "SnapQL",
  description: "Inspect GraphQL requests and responses in DevTools",
  devtools_page: "devtools.html",
  icons: { "128": "128.png" },
}

export function manifestFor(target: Target, version: string) {
  const manifest = { ...base, version }
  if (target === "firefox") {
    return {
      ...manifest,
      browser_specific_settings: { gecko: { id: GECKO_ID } },
    }
  }
  return manifest
}
