'use strict'

const P = require('bluebird')
const Scrypt = require('scrypt')
const Crypto = require('crypto')
const Boom = require('boom')
const Shortid = require('shortid')

P.promisifyAll(Scrypt)

function createNewId () {
  return createPassword(String(Date.now()))
  .then(result => result.hash.substr(0, 24))
}

function createRandomPassword () {
  return createPassword(Shortid.generate())
}

function createPassword (password) {
  const salt = Crypto.randomBytes(64).toString('hex')
  return _encrypt(password, salt)
  .then(result => {
    return {
      hash: result.toString('hex'),
      salt,
      plain: password
    }
  })
}

function verifyPassword (password, hash, salt) {
  return _encrypt(password, salt)
  .then(result => {
    if (hash !== result.toString('hex')) {
      throw Boom.unauthorized()
    }
    return true
  })
}

function _encrypt (password, salt) {
  return Scrypt.hashAsync(password, { N: 1024, r: 8, p: 16 }, 64, salt)
}

module.exports = {
  createPassword,
  verifyPassword,
  createNewId,
  createRandomPassword
}
