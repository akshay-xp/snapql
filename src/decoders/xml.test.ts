import { describe, expect, it } from "vitest"
import type { RequestView } from "./types"
import { prettyXml, soap, xml } from "./xml"

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

const soap11 =
  '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Header><a:Auth/></soap:Header><soap:Body><m:GetPrice><m:Item>Apples</m:Item></m:GetPrice></soap:Body></soap:Envelope>'

describe("soap", () => {
  it("names a SOAP 1.1 call by its Body operation, skipping Header", () => {
    expect(soap.decode(post(soap11, "text/xml"))).toEqual({
      summary: "GetPrice",
      data: { xml: prettyXml(soap11) },
    })
  })

  it("handles SOAP 1.2 and unprefixed envelopes", () => {
    const soap12 =
      '<env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope"><env:Body><GetStock/></env:Body></env:Envelope>'
    expect(
      soap.decode(post(soap12, "application/soap+xml; charset=utf-8"))?.summary,
    ).toBe("GetStock")
    expect(
      soap.decode(post("<Envelope><Body><Ping/></Body></Envelope>"))?.summary,
    ).toBe("Ping")
  })

  it("ignores empty Bodies and plain XML", () => {
    expect(
      soap.decode(post("<Envelope><Body></Body></Envelope>")),
    ).toBeUndefined()
    expect(soap.decode(post("<Order/>"))).toBeUndefined()
  })
})
