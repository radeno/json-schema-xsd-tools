import { describe, test } from '@jest/globals'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { cwd } from 'node:process'
import { loadAndValidate } from '../../src'
import { loadAndBuildXsd } from '../../src/utils/forms'

describe('generate xsd', () => {
  test('generate xsd', async () => {
    const templatePath = resolve(cwd(), 'forms', '00603481.dopravneZnacenie.sk', 'template.xsd')
    const xsdPath = resolve(cwd(), 'forms', '00603481.dopravneZnacenie.sk', 'schema.generated.xsd')

    const templateBuffer = await readFile(templatePath)
    const jsonSchemaPath = resolve(cwd(), 'forms', '00603481.dopravneZnacenie.sk', 'schema.json')
    const jsonSchemaBuffer = await readFile(jsonSchemaPath)

    const xsd = loadAndBuildXsd(JSON.parse(jsonSchemaBuffer.toString()), templateBuffer.toString());
    await writeFile(xsdPath, xsd)
  })

  test('valid xsd', async () => {
    const xsdSchemaPath = resolve(cwd(), 'forms', '00603481.dopravneZnacenie.sk', 'schema.generated.xsd')
    const xsdSchemaBuffer = await readFile(xsdSchemaPath)

    const jsonSchemaPath = resolve(cwd(), 'forms', '00603481.dopravneZnacenie.sk', 'schema.json')
    const jsonSchemaBuffer = await readFile(jsonSchemaPath)

    const errors = loadAndValidate(xsdSchemaBuffer.toString(), JSON.parse(jsonSchemaBuffer.toString()))
    expect(errors).toHaveLength(0)
  })
})