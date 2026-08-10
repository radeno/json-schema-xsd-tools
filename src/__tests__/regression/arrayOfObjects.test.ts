import { describe, expect, test } from '@jest/globals'
import { JsonSchema, loadAndBuildXsd } from '../../core/forms'
import { TransformationType, loadAndBuildDefaultXslt } from '../../core/xslt'
import { loadAndValidate } from '../../core/validation'
import {
  calledTemplates,
  complexTypeNames,
  definedTemplates,
  elementNames,
  elementType,
  withParamSelects,
  withParams,
} from '../support/xmlAssertions'

/** Shape taken from podavanieDanovehoPriznaniaKDaniZaPsaFO. */
const dogSchema = (): JsonSchema =>
  ({
    type: 'object',
    properties: {
      udajeOPsoch: {
        type: 'array',
        title: 'Údaje o psoch',
        minItems: 1,
        items: {
          type: 'object',
          title: 'Údaje o psovi',
          properties: {
            evidencneCislo: { type: 'string', title: 'Evidenčné číslo psa' },
            plemeno: { type: 'string', title: 'Plemeno psa' },
          },
          required: ['evidencneCislo'],
        },
      },
    },
    required: ['udajeOPsoch'],
  } as unknown as JsonSchema)

const TRANSFORMATIONS: TransformationType[] = ['text', 'html', 'pdf']

/** Templates the stock stylesheet ships with, before any schema is applied. */
const stockTemplates = (transformation: TransformationType): string[] =>
  definedTemplates(
    loadAndBuildDefaultXslt({ type: 'object', properties: {} } as JsonSchema, transformation, 'test.form', '1.0')
  )

describe('XSD generation for an array of objects', () => {
  test('the item object becomes its own complexType', () => {
    const xsd = loadAndBuildXsd(dogSchema(), 'test.form', '1.0')

    expect(complexTypeNames(xsd)).toContain('UdajeOPsochType')
    expect(elementNames(xsd, 'UdajeOPsochType')).toEqual(['EvidencneCislo', 'Plemeno'])
  })

  test('the array element repeats and honours minItems', () => {
    const xsd = loadAndBuildXsd(dogSchema(), 'test.form', '1.0')

    expect(elementType(xsd, 'E-formBodyType', 'UdajeOPsoch')).toBe('UdajeOPsochType')
    expect(xsd).toContain('name="UdajeOPsoch" type="UdajeOPsochType" minOccurs="1" maxOccurs="unbounded"')
  })

  test('required fields of the item object are required in the XSD', () => {
    const xsd = loadAndBuildXsd(dogSchema(), 'test.form', '1.0')

    expect(xsd).toContain('name="EvidencneCislo" type="xs:string" minOccurs="1"')
  })
})

describe('XSLT generation for an array of objects', () => {
  test.each(TRANSFORMATIONS)('%s stylesheet invokes every template it generates', (transformation) => {
    const xslt = loadAndBuildDefaultXslt(dogSchema(), transformation, 'test.form', '1.0')
    const stock = stockTemplates(transformation)

    const generated = definedTemplates(xslt).filter((name) => !stock.includes(name))
    const called = calledTemplates(xslt)
    const orphans = generated.filter((name) => !called.includes(name))

    expect(orphans).toEqual([])
  })

  test.each(TRANSFORMATIONS)('%s stylesheet never passes a template name as an XPath', (transformation) => {
    const xslt = loadAndBuildDefaultXslt(dogSchema(), transformation, 'test.form', '1.0')
    const templateNames = definedTemplates(xslt)

    // `select="wrapper__udaje_o_psoch"` looks like a call but selects a child
    // element that never exists, so the row renders empty.
    const misused = withParamSelects(xslt).filter((select) => templateNames.includes(select))

    expect(misused).toEqual([])
  })

  test.each(TRANSFORMATIONS)('%s stylesheet passes the row context to the item template', (transformation) => {
    const xslt = loadAndBuildDefaultXslt(dogSchema(), transformation, 'test.form', '1.0')

    // The item template declares <xsl:param name="values"/>, so each row has to
    // receive the current node or it renders against an empty context.
    expect(withParams(xslt)).toContainEqual({ name: 'values', select: '.' })
  })
})

describe('an array of objects survives the XSD round trip', () => {
  test('validation of a freshly generated pair reports no errors', () => {
    const schema = dogSchema()
    const xsd = loadAndBuildXsd(schema, 'test.form', '1.0')

    expect(loadAndValidate(xsd, schema)).toEqual([])
  })

  test('item properties are recovered when reading the XSD back', () => {
    const schema = dogSchema()
    const xsd = loadAndBuildXsd(schema, 'test.form', '1.0')

    const errors = loadAndValidate(xsd, schema).filter((error) => error.path.includes('udajeOPsoch'))

    expect(errors).toEqual([])
  })
})
