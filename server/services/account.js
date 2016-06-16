'use strict'

const P = require('bluebird')
const T = require('tcomb')
const Boom = require('boom')

const Account = require('../models/account')

// Generates an account name like 'CURRENCY_1' e.g.;
// 'USD_1' if user no existing USD currency accounts.
// 'USD_2' if user has one existing USD currency account.
function generateNewAccountName (userId, currency) {
  return Account.getByUserIdAndCurrency(userId, currency)
  .then((existing) => `${currency}_${existing.length + 1}`)
}

const create = P.coroutine(function * (opts, actorId) {
  T.String(opts.currency)
  T.String(actorId)

  if (!opts.name) {
    opts.name = yield generateNewAccountName(actorId, opts.currency)
  }

  const result = yield Account.create({
    userId: actorId,
    // Type is hard-coded at this point.
    type: Account.TYPE_NORMAL,
    name: opts.name,
    currency: opts.currency
  })

  const account = yield Account.getById(result.insertId)
  return account
})

const deposit = P.coroutine(function * (opts) {
  T.String(opts.accountId)
  T.String(opts.currency)
  T.String(opts.amount)
  return yield Account.deposit(opts)
})

function getAccountsForUser (userId, currency) {
  T.String(userId)
  T.String(currency)
  return Account.getByUserIdAndCurrency(userId, currency)
}

function getTransactionHistory (accountId, max = 10) {
  T.String(accountId)
  return Account.getTransactionHistory(accountId, max)
}

function requireAccountAsOwner (accountId, userId) {
  return Account.getById(accountId)
  .tap((account) => {
    if (!account) {
      throw Boom.notFound()
    }
    if (account.userId !== userId) {
      throw Boom.unauthorized()
    }
  })
}

const transfer = P.coroutine(function * (opts, actorId) {
  T.String(opts.fromAccountId)
  T.String(opts.toAccountId)
  T.String(opts.currency)
  T.String(opts.amount)
  T.String(actorId)

  yield requireAccountAsOwner(opts.fromAccountId, actorId)

  return yield Account.transfer(opts)
})

module.exports = {
  create,
  deposit,
  getAccountsForUser,
  getTransactionHistory,
  transfer
}
