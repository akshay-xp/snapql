import { describe, expect, it } from "vitest"
import type { RequestView } from "./types"
import { prettyXml, xml } from "./xml"

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

function post(text?: string, mimeType = "application/xml"): RequestView {
  return {
    method: "POST",
    url: "https://x/api",
    status: 200,
    mimeType: "text/xml",
    requestBody: text === undefined ? undefined : { mimeType, text },
  }
}

describe("xml", () => {
  it("summarizes by the root local name, skipping the prolog", () => {
    const body =
      '<?xml version="1.0"?><!-- c --><!DOCTYPE r><ns:Order id="1"><Item/></ns:Order>'
    expect(xml.decode(post(body))).toEqual({
      summary: "Order",
      data: { xml: prettyXml(body) },
    })
  })

  it("matches a body starting with < whatever the mime", () => {
    expect(xml.decode(post("  <Order/>", "text/plain"))?.summary).toBe("Order")
  })

  it("ignores non-XML", () => {
    expect(xml.decode(post("not xml", "text/xml"))).toBeUndefined()
    expect(xml.decode(post('{"a":1}', "application/json"))).toBeUndefined()
    expect(xml.decode(post())).toBeUndefined()
  })
})
