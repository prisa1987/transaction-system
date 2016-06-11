'use strict'

const Joi = require('joi')

const UserService = require('./services/user')
const validate = require('./models/validate')

function createHandler (func) {
  return (request, reply) => {
    return func(request, reply)
    .catch((reason) => {
      console.error('Handler error:', reason)
      reply({ error: reason.message || 'server error' }).code(400)
    })
  }
}

function setupEndpoints (server) {
  // Rock some endpoints.

  server.route({
    method: 'POST',
    path: '/api/user',
    config: { auth: false },
    handler: createHandler((request, reply) => {
      return UserService.create(request.payload)
      .then((user) => reply({ user }))
    })
  })

  const getTokenSchema = Joi.object().keys({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
  })

  server.route({
    method: 'POST',
    path: '/api/token',
    config: { auth: false },
    handler: createHandler((request, reply) => {
      const valid = validate(request.payload, getTokenSchema)
      return UserService.authenticate(valid.email, valid.password)
      .then((token) => reply({ token }))
    })
  })
}

module.exports = setupEndpoints
