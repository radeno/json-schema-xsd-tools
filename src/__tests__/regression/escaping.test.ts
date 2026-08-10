import { describe, expect, test } from '@jest/globals'
import { JsonSchema, loadAndBuildXsd } from '../../core/forms'
import { loadAndBuildDefaultXslt } from '../../core/xslt'
import { enumerationValues, expectWellFormed, patternValue } from '../support/xmlAssertions'

/** Characters that must survive a round trip through generated XML markup. */
const HOSTILE = 'Kúpa & predaj "domu" <2024> \'ihneď\''

const schemaWith = (property: Record<string, unknown>): JsonSchema =>
  ({
    type: 'object',
    properties: { pole: property },
  } as unknown as JsonSchema)

describe('XSD output escapes user supplied values', () => {
  test('enum values containing markup characters stay well formed', () => {
    const xsd = loadAndBuildXsd(
      schemaWith({ type: 'string', title: 'Voľba', enum: ['a&b', 'c"d', 'e<f'] }),
      'test.form',
      '1.0'
    )

    expectWellFormed(xsd)
  })

  test('enum values round trip unchanged', () => {
    const xsd = loadAndBuildXsd(
      schemaWith({ type: 'string', title: 'Voľba', enum: ['a&b', 'c"d', 'e<f'] }),
      'test.form',
      '1.0'
    )

    expect(enumerationValues(xsd, 'PoleType')).toEqual(['a&b', 'c"d', 'e<f'])
  })

  test('a pattern containing an ampersand and a quote stays well formed', () => {
    const xsd = loadAndBuildXsd(
      schemaWith({ type: 'string', title: 'Kód', pattern: '^[A-Z]&"[0-9]$' }),
      'test.form',
      '1.0'
    )

    expectWellFormed(xsd)
    expect(patternValue(xsd, 'PoleType')).toBe('^[A-Z]&"[0-9]$')
  })

})

describe('XSLT output escapes user supplied values', () => {
  const transformations = ['text', 'html', 'pdf'] as const

  test.each(transformations)('%s stylesheet stays well formed with a hostile title', (transformation) => {
    const xslt = loadAndBuildDefaultXslt(
      schemaWith({ type: 'string', title: HOSTILE }),
      transformation,
      'test.form',
      '1.0'
    )

    expectWellFormed(xslt)
  })

  test.each(transformations)('%s stylesheet keeps an apostrophe out of the XPath literal', (transformation) => {
    const xslt = loadAndBuildDefaultXslt(
      schemaWith({ type: 'string', title: "Meno 'X'" }),
      transformation,
      'test.form',
      '1.0'
    )

    // select="'Meno 'X''" would terminate the XPath string literal early.
    expect(xslt).not.toContain("select=\"'Meno 'X''\"")
  })

  test('a section title with an ampersand is escaped in the XPath literal', () => {
    const xslt = loadAndBuildDefaultXslt(
      {
        type: 'object',
        properties: {
          skupina: {
            type: 'object',
            title: 'Príjem & výdaj',
            properties: { suma: { type: 'number', title: 'Suma' } },
          },
        },
      } as unknown as JsonSchema,
      'html',
      'test.form',
      '1.0'
    )

    expectWellFormed(xslt)
    expect(xslt).toContain("select=\"'Príjem &amp; výdaj'\"")
  })
})
