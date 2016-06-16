'use strict'

const Joi = require('joi')

const UserService = require('./services/user')
const AccountService = require('./services/account')
const validate = require('./models/validate')

function createHandler (func) {
  return (request, reply) => {
    return func(request, reply)
    .catch((reason) => {
      // Show fewer errors while testing.
      if (process.env.NODE_ENV === 'test') {
        console.error('Handler error:', reason.message)
      } else {
        // Keep validation errors compact.
        if (reason.name === 'ValidationError') {
          console.error('Validation error:', reason.message)
        // Something serious happened, log it in full.
        } else {
          console.error('Handler error:', reason)
        }
      }

      if (reason.message.indexOf('[tcomb]') !== -1) {
        console.error(reason.stack)
      }
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
    path: '/api/auth',
    config: { auth: false },
    handler: createHandler((request, reply) => {
      const valid = validate(request.payload, getTokenSchema)
      return UserService.authenticate(valid.email, valid.password)
      .then((token) => reply({ token }))
    })
  })

  const createAccountSchema = Joi.object().keys({
    currency: Joi.string().min(3).max(3).trim().uppercase().required()
  })

  server.route({
    method: 'POST',
    path: '/api/account',
    handler: createHandler((request, reply) => {
      const valid = validate(request.payload, createAccountSchema)
      const actorId = request.auth.credentials.id
      return AccountService.create(valid, actorId)
      .then((account) => reply({ account }))
    })
  })

  const transferSchema = Joi.object().keys({
    fromAccountId: Joi.string().min(1).required(),
    toAccountId: Joi.string().min(1).required(),
    amount: Joi.string().min(1).required(),
    currency: Joi.string().min(3).max(3).trim().uppercase().required()
  })

  server.route({
    method: 'POST',
    path: '/api/transfer',
    handler: createHandler((request, reply) => {
      const valid = validate(request.payload, transferSchema)
      const actorId = request.auth.credentials.id
      return AccountService.transfer(valid, actorId)
      .then((account) => reply({ account }))
    })
  })
}

module.exports = setupEndpoints
