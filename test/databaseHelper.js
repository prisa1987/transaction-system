'use strict'

const P = require('bluebird')
const Jwt = require('../server/jwt')
const Hoek = require('hoek')

const Db = require('../server/database')

const User = require('../server/models/user')
const Account = require('../server/models/account')
const Stats = require('../server/models/stats')

const UserService = require('../server/services/user')
const AccountService = require('../server/services/account')

module.exports = {
  _chain: P.resolve(),
  _context: { },

  // Enqueue expect a function as it’s first argument.
  // All queued functions will be executed in sequence (waterfall) and their
  // results added to our context.
  queue (func, name) {
    this._chain = this._chain
    .then(() => P.resolve(func()))
    .tap((result) => {
      if (name) {
        // console.log(`Adding ${name} to context:`, result)
        this._context[name] = result
      }
    })
    return this
  },

  getToken (userId) {
    return Jwt.createToken({ userId })
  },

  wait (func) {
    return this._chain.then(() => func(this._context))
  },

  reset () {
    const removeTestData = P.all([
      User.deleteAll(),
      Account.deleteAll(),
      Account.deleteTestTransactions(),
      Stats.deleteTestStats()
    ])
    this.queue(() => removeTestData)

    const removeMoreTestData = P.all([
      User.deleteInvalidPasswords()
    ])
    return this.queue(() => removeMoreTestData)
  },

  user (name) {
    return this.queue(() => {
      const email = `${name}@test.test`
      return UserService.create({
        email,
        name
      })
    }, name)
  },

  account (name, ownerName) {
    return this.queue(() => {
      const owner = this._context[ownerName]
      Hoek.assert(owner, `Missing user in context: ${ownerName}`)
      return AccountService.create({
        name: `${name}.test.test`,
        type: 1,
        userId: owner.id
      })
    }, name)
  },

  printStats () {
    console.log('Database stats:', Db.getStats())
  }
}
