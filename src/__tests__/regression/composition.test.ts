import { describe, expect, test } from '@jest/globals'
import { JsonSchema, loadAndBuildXsd, mergeJsonSchema } from '../../core/forms'
import { complexTypeNames, elementNames } from '../support/xmlAssertions'

/**
 * Shape taken from ohlasenieOVznikuAleboZanikuUbytovaciehoZariadeniaPO: a fully
 * defined object property, plus an `if/then` branch that only tightens
 * `required` for that same property.
 */
const conditionalSchema = (): JsonSchema =>
  ({
    type: 'object',
    properties: {
      druh: { type: 'string', title: 'Druh', enum: ['vznik', 'zanik'] },
      zariadenie: {
        type: 'object',
        title: 'Ubytovacie zariadenie',
        properties: {
          nazov: { type: 'string', title: 'Názov' },
          kapacita: { type: 'integer', title: 'Kapacita' },
          datumZacatia: { type: 'string', format: 'date', title: 'Dátum začatia' },
        },
      },
    },
    required: ['druh'],
    allOf: [
      {
        if: { properties: { druh: { const: 'vznik' } } },
        then: { properties: { zariadenie: { required: ['nazov', 'datumZacatia'] } } },
      },
    ],
  } as unknown as JsonSchema)

describe('conditional branches refine properties instead of replacing them', () => {
  test('a then-branch that only sets required keeps the full property definition', () => {
    const { properties } = mergeJsonSchema(conditionalSchema())
    const zariadenie = properties.zariadenie as JsonSchema

    expect(zariadenie.type).toBe('object')
    expect(Object.keys(zariadenie.properties ?? {})).toEqual(['nazov', 'kapacita', 'datumZacatia'])
  })

  test('the conditionally required fields are merged in', () => {
    const { properties } = mergeJsonSchema(conditionalSchema())
    const zariadenie = properties.zariadenie as JsonSchema

    expect(zariadenie.required).toEqual(expect.arrayContaining(['nazov', 'datumZacatia']))
  })

  test('the whole section survives into the generated XSD', () => {
    const xsd = loadAndBuildXsd(conditionalSchema(), 'test.form', '1.0')

    expect(complexTypeNames(xsd)).toContain('ZariadenieType')
    expect(elementNames(xsd, 'ZariadenieType')).toEqual(['Nazov', 'Kapacita', 'DatumZacatia'])
  })

  test('an else-branch contributes its properties too', () => {
    const schema = {
      type: 'object',
      properties: { druh: { type: 'string', title: 'Druh' } },
      allOf: [
        {
          if: { properties: { druh: { const: 'vznik' } } },
          then: { properties: { datumZacatia: { type: 'string', format: 'date', title: 'Začiatok' } } },
          else: { properties: { datumUkoncenia: { type: 'string', format: 'date', title: 'Koniec' } } },
        },
      ],
    } as unknown as JsonSchema

    expect(Object.keys(mergeJsonSchema(schema).properties)).toEqual(
      expect.arrayContaining(['datumZacatia', 'datumUkoncenia'])
    )
  })
})

describe('mergeJsonSchema is a pure function', () => {
  const composedSchema = (): JsonSchema =>
    ({
      type: 'object',
      properties: { zaklad: { type: 'string', title: 'Základ' } },
      required: ['zaklad'],
      allOf: [
        {
          type: 'object',
          properties: { doplnok: { type: 'string', title: 'Doplnok' } },
          required: ['doplnok'],
        },
      ],
    } as unknown as JsonSchema)

  test('the input schema is not modified', () => {
    const schema = composedSchema()
    const before = JSON.parse(JSON.stringify(schema))

    mergeJsonSchema(schema)

    expect(schema).toEqual(before)
  })

  test('repeated calls return the same result', () => {
    const schema = composedSchema()

    // Deep copies, because the current implementation hands back live
    // references into the input schema and would compare equal to itself.
    const first = JSON.parse(JSON.stringify(mergeJsonSchema(schema)))
    const second = JSON.parse(JSON.stringify(mergeJsonSchema(schema)))
    const third = JSON.parse(JSON.stringify(mergeJsonSchema(schema)))

    expect(second).toEqual(first)
    expect(third).toEqual(first)
  })

  test('required fields are not duplicated across calls', () => {
    const schema = composedSchema()

    mergeJsonSchema(schema)
    const { required } = mergeJsonSchema(schema)

    expect(required).toEqual([...new Set(required)])
  })

  test('generating XSLT after XSD does not change what the schema means', () => {
    // convert_to_xsd.ts reuses one parsed schema for the XSD and all three stylesheets.
    const schema = composedSchema()
    const first = loadAndBuildXsd(schema, 'test.form', '1.0')
    const second = loadAndBuildXsd(schema, 'test.form', '1.0')

    expect(second).toEqual(first)
  })
})
