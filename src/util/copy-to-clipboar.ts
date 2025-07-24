/**
 * Copies the given text to the clipboard using a hidden textarea.
 *
 * @param textToCopy - The text content to copy to the clipboard.
 */
export function copyToClipboard(textToCopy: string) {
  const textarea = document.createElement("textarea")
  textarea.value = textToCopy

  // Keep it completely out of view
  textarea.style.position = "absolute"
  textarea.style.left = "-9999px"
  textarea.setAttribute("readonly", "")

  document.body.appendChild(textarea)
  textarea.select()

  try {
    document.execCommand("copy")
  } catch (err) {
    console.error("Copy failed", err)
  }

  document.body.removeChild(textarea)
}
