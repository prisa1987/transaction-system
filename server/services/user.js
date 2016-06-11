'use strict'

const P = require('bluebird')
const T = require('tcomb')
const Boom = require('boom')

const User = require('../models/user')
const Crypt = require('../crypt')
const Jwt = require('../jwt')

const create = P.coroutine(function * (data) {
  const result = yield User.create(data)
  const user = yield User.getById(result.insertId)

  const password = yield Crypt.createRandomPassword()
  yield User.setPassword(user.id, password.salt, password.hash)

  // Add generated password to response.
  user.password = password.plain

  return user
})

function createToken (user) {
  T.Object(user)
  T.String(user.id)
  return Jwt.createToken({ id: user.id })
}

const authenticate = P.coroutine(function * (email, plainTextPassword) {
  T.String(email)
  T.String(plainTextPassword)
  // TODO: Limit authentication attempts !

  const user = yield User.getByEmail(email)
  if (!user) {
    console.error('Auth failed. Missing user:', email)
    throw Boom.unauthorized('Invalid email or password')
  }

  const password = yield User.getPassword(user.id)
  if (!password) {
    console.error('Auth failed. Missing password entry:', email)
    throw Boom.unauthorized('Invalid email or password')
  }

  const isValid = yield Crypt.verifyPassword(plainTextPassword, password.hashedPassword, password.salt)
  if (!isValid) {
    console.error('Auth failed. Invalid password:', email)
    throw Boom.unauthorized('Invalid email or password')
  }

  return createToken(user)
})

module.exports = {
  create,
  authenticate
}
