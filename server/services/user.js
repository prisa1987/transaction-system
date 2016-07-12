'use strict'

const P = require('bluebird')
const T = require('tcomb')
const Boom = require('boom')

const User = require('../models/user')
const Crypt = require('../crypt')
const Jwt = require('../jwt')

const facebookLogin = P.coroutine(function * (accessToken) {
  const Graph = require('fbgraph')
  P.promisifyAll(Graph)

  const fields = 'email,name,picture,first_name,last_name'
  const info = yield Graph.getAsync(`/me?$fields=${fields}&access_token=${accessToken}&version=v2.6`)
  if (!info || !info.email) {
    console.error('Auth failed. Missing email in user info.', info)
    throw Boom.badRequest('Missing email')
  }
  const email = info.email

  if (!info.verified) {
    console.error('Auth failed. Facebook account is unverified.', info)
    throw Boom.badRequest('Unverified account')
  }
  if (!info.name && !info.first_name && !info.last_name) {
    console.error('Auth failed. Facebook account does not have a name.', info)
    throw Boom.badRequest('Account is missing name')
  }
  const name = info.name || `${info.first_name} ${info.last_name}`

  const picture = yield Graph.getAsync(`/me/picture?access_token=${accessToken}&version=v2.6`)
  if (picture && picture.location) {
    info.picture = picture.location
  }

  let user = yield User.getByEmail(email)
  if (!user) {
    // Clean out profile somewhat.
    delete info.email
    delete info.name
    // Create a new user based on facebook profile data.
    user = yield create({
      name,
      email,
      profile: JSON.stringify(info)
    })
  }

  return createToken(user)
})

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

function requireValidUser (userId) {
  T.String(userId)
  return User.isValid(userId)
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
  authenticate,
  requireValidUser,
  facebookLogin
}
