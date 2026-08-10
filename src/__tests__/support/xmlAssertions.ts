import { DOMParser } from '@xmldom/xmldom'

/**
 * Parse XML strictly and return every well-formedness complaint.
 *
 * `@xmldom/xmldom` reports recoverable problems through `onError` and throws on
 * fatal ones, so both paths have to be collected to get a complete verdict.
 */
export const xmlErrors = (xml: string): string[] => {
  const errors: string[] = []
  try {
    const parser = new DOMParser({
      onError: (level: string, message: string) => {
        if (level !== 'warning') {
          errors.push(`${level}: ${message}`)
        }
      },
    })
    parser.parseFromString(xml, 'text/xml')
  } catch (e) {
    errors.push(`fatal: ${(e as Error).message}`)
  }
  return errors
}

const VALID_ENTITY = /^&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/

/**
 * Every `&` that does not start a valid entity reference.
 *
 * Needed because `@xmldom/xmldom` tolerates a bare `&` followed by whitespace,
 * while a conforming XML parser such as libxml2 rejects it.
 */
export const unescapedAmpersands = (xml: string): string[] => {
  const found: string[] = []
  for (let i = 0; i < xml.length; i += 1) {
    if (xml[i] === '&' && !VALID_ENTITY.test(xml.slice(i, i + 12))) {
      found.push(xml.slice(i, i + 20))
    }
  }
  return found
}

export const expectWellFormed = (xml: string): void => {
  expect(xmlErrors(xml)).toEqual([])
  expect(unescapedAmpersands(xml)).toEqual([])
}

const parse = (xml: string) => new DOMParser({ onError: () => undefined }).parseFromString(xml, 'text/xml')

const attr = (el: Element, name: string): string | null => (el.hasAttribute(name) ? el.getAttribute(name) : null)

const elements = (xml: string, tag: string): Element[] => Array.from(parse(xml).getElementsByTagName(tag)) as Element[]

/** All `<xs:element>` declarations inside the named `<xs:complexType>`. */
export const complexTypeElements = (xsd: string, complexTypeName: string): Element[] => {
  const complexType = elements(xsd, 'xs:complexType').find((el) => attr(el, 'name') === complexTypeName)
  if (!complexType) {
    return []
  }
  return Array.from(complexType.getElementsByTagName('xs:element')) as Element[]
}

/** `type` attribute of a single `<xs:element>` inside a `<xs:complexType>`, or `null` when absent. */
export const elementType = (xsd: string, complexTypeName: string, elementName: string): string | null => {
  const el = complexTypeElements(xsd, complexTypeName).find((e) => attr(e, 'name') === elementName)
  return el ? attr(el, 'type') : null
}

export const elementNames = (xsd: string, complexTypeName: string): string[] =>
  complexTypeElements(xsd, complexTypeName).map((el) => attr(el, 'name') ?? '')

export const complexTypeNames = (xsd: string): string[] =>
  elements(xsd, 'xs:complexType')
    .map((el) => attr(el, 'name'))
    .filter((name): name is string => Boolean(name))

/** Enumeration values of the named `<xs:simpleType>`, as the parser sees them. */
export const enumerationValues = (xsd: string, simpleTypeName: string): string[] => {
  const simpleType = elements(xsd, 'xs:simpleType').find((el) => attr(el, 'name') === simpleTypeName)
  if (!simpleType) {
    return []
  }
  return (Array.from(simpleType.getElementsByTagName('xs:enumeration')) as Element[]).map((el) => attr(el, 'value') ?? '')
}

export const patternValue = (xsd: string, simpleTypeName: string): string | null => {
  const simpleType = elements(xsd, 'xs:simpleType').find((el) => attr(el, 'name') === simpleTypeName)
  if (!simpleType) {
    return null
  }
  const pattern = (Array.from(simpleType.getElementsByTagName('xs:pattern')) as Element[])[0]
  return pattern ? attr(pattern, 'value') : null
}

/** Names of every `<xsl:template name="...">` in a stylesheet. */
export const definedTemplates = (xslt: string): string[] =>
  elements(xslt, 'xsl:template')
    .map((el) => attr(el, 'name'))
    .filter((name): name is string => Boolean(name))

/** Names referenced by every `<xsl:call-template name="...">` in a stylesheet. */
export const calledTemplates = (xslt: string): string[] =>
  elements(xslt, 'xsl:call-template')
    .map((el) => attr(el, 'name'))
    .filter((name): name is string => Boolean(name))

/** Every `select` expression bound to an `<xsl:with-param>`. */
export const withParamSelects = (xslt: string): string[] =>
  elements(xslt, 'xsl:with-param')
    .map((el) => attr(el, 'select'))
    .filter((select): select is string => Boolean(select))

/** `name`/`select` pairs of every `<xsl:with-param>`, independent of serialization. */
export const withParams = (xslt: string): Array<{ name: string; select: string | null }> =>
  elements(xslt, 'xsl:with-param').map((el) => ({ name: attr(el, 'name') ?? '', select: attr(el, 'select') }))
