'use strict'

const Joi = require('joi')

function validate (data, schema) {
  const valid = Joi.validate(data, schema, { stripUnknown: true })
  if (valid.error) {
    throw valid.error
  }
  return valid.value
}

module.exports = validate
