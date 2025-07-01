/**
 * Safely parses a JSON string into a typed object.
 *
 * @template T - The expected return type after parsing. Defaults to `unknown`.
 * @param {string} [text] - The JSON string to parse.
 * @param {(this: any, key: string, value: any) => any} [reviver] - Optional reviver function to transform values during parsing.
 * @returns {(T | null)} The parsed object of type `T`, or `null` if parsing fails or input is not a string.
 *
 * @example
 * const obj = parse<{ name: string }>('{"name":"Alice"}');
 * if (obj) {
 *   console.log(obj.name); // "Alice"
 * }
 */
export function parse<T = unknown>(
  text?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reviver?: (this: any, key: string, value: any) => any
): T | null {
  if (typeof text !== "string") return null

  try {
    return JSON.parse(text, reviver) as T
  } catch {
    return null
  }
}
