export type Target = "chrome" | "firefox"

const base = {
  manifest_version: 3,
  name: "SnapQL",
  description: "Inspect GraphQL requests and responses in DevTools",
  devtools_page: "devtools.html",
  icons: { "128": "128.png" },
}

export function manifestFor(_target: Target, version: string) {
  return { ...base, version }
}
