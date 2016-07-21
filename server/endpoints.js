'use strict'

const P = require('bluebird')
const Joi = require('joi')

const UserService = require('./services/user')
const AccountService = require('./services/account')
const StarterService = require('./services/starter')
const validate = require('./models/validate')

function createHandler (func) {
  return (request, reply) => {
    return P.try(() => func(request, reply))
    .catch((reason) => {
      // Show fewer errors while testing.
      if (process.env.NODE_ENV === 'test') {
        console.error('Handler error:', reason.message)
        // console.error('Handler error:', reason.stack)
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
      .then((user) => reply({
        user,
        token: UserService.createToken(user)
      }))
    })
  })

  server.route({
    method: 'GET',
    path: '/api/user',
    handler: createHandler((request, reply) => {
      const actorId = request.auth.credentials.id
      return UserService.requireValidUser(actorId)
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
      .then((transactionHistory) => reply({ transactionHistory }))
    })
  })

  const transferByUserIdSchema = Joi.object().keys({
    fromAccountId: Joi.string().min(1).required(),
    toUserId: Joi.string().min(1).required(),
    amount: Joi.string().min(1).required(),
    currency: Joi.string().min(3).max(3).trim().uppercase().required()
  })
  server.route({
    method: 'POST',
    path: '/api/transferByUserId',
    handler: createHandler((request, reply) => {
      const valid = validate(request.payload, transferByUserIdSchema)
      const actorId = request.auth.credentials.id
      return AccountService.transferByUserId(valid, actorId)
      .then((transactionHistory) => reply({ transactionHistory }))
    })
  })

  server.route({
    method: 'GET',
    path: '/api/history/{accountId}',
    handler: createHandler((request, reply) => {
      const accountId = request.params.accountId
      const max = request.query.max || 10
      const actorId = request.auth.credentials.id
      return AccountService.getTransactionHistoryForUser(accountId, max, actorId)
      .then((transactionHistory) => reply({ transactionHistory }))
    })
  })

  server.route({
    method: 'GET',
    path: '/api/account/{accountId}',
    handler: createHandler((request, reply) => {
      const accountId = request.params.accountId
      const actorId = request.auth.credentials.id
      return AccountService.requireAccountAsOwner(accountId, actorId)
      .then((account) => reply({ account }))
    })
  })

  const facebookLoginSchema = Joi.object().keys({
    accessToken: Joi.string().min(10).required()
  })

  server.route({
    method: 'POST',
    path: '/api/facebook-login',
    config: { auth: false },
    handler: createHandler((request, reply) => {
      const valid = validate(request.payload, facebookLoginSchema)
      return UserService.facebookLogin(valid.accessToken)
      .then((token) => reply({ token }))
    })
  })

  server.route({
    method: 'GET',
    path: '/api/accounts',
    handler: createHandler((request, reply) => {
      const actorId = request.auth.credentials.id
      return AccountService.getAll(actorId)
      .then((accounts) => reply({ accounts }))
    })
  })

  const updateProfileSchema = Joi.object().keys({
    first_name: Joi.string().max(128),
    last_name: Joi.string().max(128),
    photo: Joi.string().max(1024),
    picture: Joi.string().max(1024),
    settings: Joi.string().max(1024)
  })

  server.route({
    method: 'PATCH',
    path: '/api/user/profile',
    handler: createHandler((request, reply) => {
      const valid = validate(request.payload, updateProfileSchema)
      const actorId = request.auth.credentials.id
      return UserService.updateProfile(actorId, valid)
      .then(() => reply({ ok: 1 }))
    })
  })

  const searchSchema = Joi.object().keys({
    query: Joi.string().allow('')
  })

  server.route({
    method: 'POST',
    path: '/api/search/user',
    handler: createHandler((request, reply) => {
      const valid = validate(request.payload, searchSchema)
      const actorId = request.auth.credentials.id
      return UserService.search(actorId, valid.query)
      .then((result) => reply({ result }))
    })
  })

  server.route({
    method: 'GET',
    path: '/api/starter/{currency}',
    handler: createHandler((request, reply) => {
      const currency = request.params.currency
      const actorId = request.auth.credentials.id
      return StarterService.getStarter(actorId, currency)
      .then((starter) => reply({ starter }))
    })
  })

  server.route({
    method: 'GET',
    path: '/api/token',
    handler: createHandler((request, reply) => {
      const actorId = request.auth.credentials.id
      return UserService.renewToken(actorId)
      .then((token) => reply({ token }))
    })
  })
}

module.exports = setupEndpoints
