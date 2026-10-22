import { describe, expect, it } from "vitest"
import { prettyXml } from "./xml"

describe("prettyXml", () => {
  const pretty = [
    '<?xml version="1.0"?>',
    '<a x="1">',
    "  <b>hi there</b>",
    "  <c/>",
    "  <!-- note -->",
    "  <d><![CDATA[<raw> & ]]></d>",
    "</a>",
  ].join("\n")

  it("indents nested elements and keeps text and CDATA intact", () => {
    expect(
      prettyXml(
        '<?xml version="1.0"?><a x="1"><b>hi there</b><c/><!-- note --><d><![CDATA[<raw> & ]]></d></a>',
      ),
    ).toBe(pretty)
  })

  it("drops whitespace between tags", () => {
    expect(prettyXml(pretty)).toBe(pretty)
  })

  it("returns unbalanced and non-XML input unchanged", () => {
    for (const text of ["<p><br></p>", "hello", '{"a":1}'])
      expect(prettyXml(text)).toBe(text)
  })
})
