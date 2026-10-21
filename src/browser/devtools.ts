export function createPanel(title: string, iconPath: string, pagePath: string) {
  chrome.devtools.panels.create(title, iconPath, pagePath)
}
