'use strict'

const P = require('bluebird')
const T = require('tcomb')

const Account = require('../models/account')

const create = P.coroutine(function * (opts) {
  // Type is hard-coded at this point.
  opts.type = Account.TYPE_NORMAL
  const result = yield Account.create(opts)
  const account = yield Account.getById(result.insertId)
  // TODO: Generate a password !
  return account
})

const deposit = P.coroutine(function * (opts) {
  T.String(opts.accountId)
  T.String(opts.currency)
  T.Number(opts.amount)
  return yield Account.deposit(opts)
})

function getAccountForUser (userId, currency) {
  T.String(userId)
  T.String(currency)
  return Account.getByUserIdAndCurrency(userId, currency)
}

function getTransactionHistory (accountId, max = 10) {
  T.String(accountId)
  return Account.getTransactionHistory(accountId, max)
}

const transfer = P.coroutine(function * (opts) {
  T.String(opts.fromAccountId)
  T.String(opts.toAccountId)
  T.String(opts.currency)
  T.Number(opts.amount)
  return yield Account.transfer(opts)
})

module.exports = {
  create,
  deposit,
  getAccountForUser,
  getTransactionHistory,
  transfer
}
