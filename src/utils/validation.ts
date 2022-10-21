import * as cheerio from 'cheerio'
import { defaults, isEqual } from 'lodash'
import { buildJsonSchema, JsonSchema } from './forms'

/**
 * Validation options
 */
export interface Options {
  /**
   * Ignore array, useful to exclude meta keywords like title or custom keywords.
   *
   * @defaultValue []
   */
  ignore: string[]
}

/**
 * Error object
 */
export interface Error {
  /**
   * Path in schema
   */
  path: string[]
  /**
   * Type of error
   */
  type: ErrorType
}

/**
 * Type of error, referenced to JSON schema keywords
 */
export enum ErrorType {
  Empty = 'EMPTY',
  Porperties = 'PROPERTIES:',
  Title = 'TITLE',
  Description = 'DESCRIPTION',
  Type = 'TYPE',
  Format = 'FORMAT',
  Required = 'REQUIRED',
  Pattern = 'PATTERN',
  Enum = 'ENUM',
  Items = 'ITEMS',
}

const isSubset = (first: string[] | undefined, second: string[] | undefined): boolean => {
  if (!first || first.length === 0) {
    return true
  } else if (!second || second.length == 0) {
    return false
  }

  return first.every((el) => second.includes(el))
}

const validate = (
  xsdSchema: JsonSchema | undefined,
  jsonSchema: JsonSchema | undefined,
  options: Options,
  path: string[]
): Error[] => {
  let errors: Error[] = []

  if (!xsdSchema || !jsonSchema) {
    return errors
  }

  if (!options.ignore.includes('title') && xsdSchema.title && xsdSchema.title !== jsonSchema.title) {
    errors.push({
      path,
      type: ErrorType.Title,
    })
  }

  if (
    !options.ignore.includes('description') &&
    xsdSchema.description &&
    xsdSchema.description !== jsonSchema.description
  ) {
    errors.push({
      path,
      type: ErrorType.Description,
    })
  }

  if (!options.ignore.includes('type') && xsdSchema.type !== jsonSchema.type) {
    errors.push({
      path,
      type: ErrorType.Type,
    })
  }

  if (!options.ignore.includes('format') && xsdSchema.format && xsdSchema.format !== jsonSchema.format) {
    errors.push({
      path,
      type: ErrorType.Format,
    })
  }

  if (!options.ignore.includes('required') && !isSubset(xsdSchema.required, jsonSchema.required)) {
    errors.push({
      path,
      type: ErrorType.Required,
    })
  }

  if (!options.ignore.includes('pattern') && xsdSchema.pattern && xsdSchema.pattern !== jsonSchema.pattern) {
    errors.push({
      path,
      type: ErrorType.Pattern,
    })
  }

  if (!options.ignore.includes('enum') && !isSubset(jsonSchema.enum, xsdSchema.enum)) {
    errors.push({
      path,
      type: ErrorType.Enum,
    })
  }

  if (!options.ignore.includes('items') && !isEqual(xsdSchema.items, jsonSchema.items)) {
    errors.push({
      path,
      type: ErrorType.Items,
    })
  }

  if (xsdSchema.properties) {
    Object.keys(xsdSchema.properties).forEach((key) => {
      if (xsdSchema.properties) {
        if (jsonSchema.properties && jsonSchema.properties[key]) {
          errors = [
            ...errors,
            ...validate(xsdSchema.properties?.[key], jsonSchema.properties[key], options, [...path, key]),
          ]
        } else {
          errors.push({
            path,
            type: ErrorType.Porperties,
          })
        }
      }
    })
  }

  return errors
}

/**
 * Validate JSON schema against XSD and return list of errors
 *
 * @param xsd - XSD schema
 * @param jsonSchema - JSON schema
 * @param options - Options object
 * @returns List of errors, empty array if JSON schema is valid
 */
export const loadAndValidate = (
  xsd: string,
  jsonSchema: JsonSchema,
  options: Options | undefined = undefined
): Error[] => {
  const $ = cheerio.load(xsd, { xmlMode: true })
  const xsdSchema = buildJsonSchema($, `xs\\:element[name='E-form'] xs\\:element[name='Body']`)

  options = defaults(options, {
    ignore: [],
  })

  const errors = validate(xsdSchema, jsonSchema, options, [])
  return errors
}