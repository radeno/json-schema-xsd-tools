import { describe, expect, test } from '@jest/globals'
import { JsonSchema, loadAndBuildXsd } from '../../core/forms'
import { elementNames, elementType, expectWellFormed } from '../support/xmlAssertions'

const BODY = 'E-formBodyType'

/** Wrap a single property in a minimal form schema and generate the XSD. */
const buildWith = (property: Record<string, unknown>): string =>
  loadAndBuildXsd(
    {
      type: 'object',
      properties: { pole: property as unknown as JsonSchema },
    } as JsonSchema,
    'test.form',
    '1.0'
  )

describe('JSON Schema type and format map to XSD types', () => {
  const cases: Array<{ label: string; property: Record<string, unknown>; expected: string }> = [
    { label: 'string', property: { type: 'string' }, expected: 'xs:string' },
    { label: 'boolean', property: { type: 'boolean' }, expected: 'xs:boolean' },
    { label: 'integer', property: { type: 'integer' }, expected: 'xs:integer' },
    { label: 'number', property: { type: 'number' }, expected: 'xs:decimal' },
    { label: 'date', property: { type: 'string', format: 'date' }, expected: 'xs:date' },
    { label: 'date-time', property: { type: 'string', format: 'date-time' }, expected: 'xs:dateTime' },
    { label: 'email', property: { type: 'string', format: 'email' }, expected: 'EmailType' },
    { label: 'file', property: { type: 'string', format: 'file' }, expected: 'PrilohaType' },
    { label: 'data-url', property: { type: 'string', format: 'data-url' }, expected: 'PrilohaType' },
    { label: 'ciselnik', property: { type: 'string', format: 'ciselnik' }, expected: 'EnumerationType' },
  ]

  test.each(cases)('$label -> $expected', ({ property, expected }) => {
    expect(elementType(buildWith(property), BODY, 'Pole')).toBe(expected)
  })

  test('array of a formatted type uses the item type', () => {
    const xsd = buildWith({ type: 'array', items: { type: 'string', format: 'data-url' } })
    expect(elementType(xsd, BODY, 'Pole')).toBe('PrilohaType')
  })

  test('JSON Schema number allows decimals, so xs:integer would reject valid input', () => {
    // Regression guard for tax amounts such as "sadzba dane" = 1.50.
    expect(elementType(buildWith({ type: 'number' }), BODY, 'Pole')).not.toBe('xs:integer')
  })
})

describe('a property without an explicit type is treated as an object', () => {
  // `opravnenaOsoba` in podavanieDanovehoPriznaniaKDaniZaPsaFO declares
  // `properties` but no `type`, and its whole subtree disappeared from the XSD.
  const untyped = { title: 'Bez typu', properties: { meno: { type: 'string', title: 'Meno' } } }

  test('the element gets a real type name', () => {
    expect(elementType(buildWith(untyped), BODY, 'Pole')).toBe('PoleType')
  })

  test('its children are generated into a complexType', () => {
    expect(elementNames(buildWith(untyped), 'PoleType')).toEqual(['Meno'])
  })

  test('no generated element anywhere carries type=""', () => {
    const xsd = loadAndBuildXsd(
      {
        type: 'object',
        properties: {
          rok: { type: 'integer', title: 'Na rok' },
          bezTypu: { title: 'Bez typu', properties: { a: { type: 'string' } } },
        },
      } as unknown as JsonSchema,
      'test.form',
      '1.0'
    )
    expectWellFormed(xsd)
    expect(xsd).not.toContain('type=""')
  })
})

describe('documented current behaviour', () => {
  test('format "time" degrades to xs:string on purpose', () => {
    // Intentionally disabled upstream until sk-bratislava-fop can render xs:time.
    // Locked in so the degradation stays a deliberate choice rather than a silent regression.
    expect(elementType(buildWith({ type: 'string', format: 'time' }), BODY, 'Pole')).toBe('xs:string')
  })
})
