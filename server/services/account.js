'use strict'

const P = require('bluebird')
const T = require('tcomb')

const Account = require('../models/account')

// Generates an account name like 'CURRENCY_1' e.g.;
// 'USD_1' if user no existing USD currency accounts.
// 'USD_2' if user has one existing USD currency account.
function generateNewAccountName (userId, currency) {
  return Account.getByUserIdAndCurrency(userId, currency)
  .then((existing) => `${currency}_${existing.length + 1}`)
}

const create = P.coroutine(function * (opts) {
  T.String(opts.userId)
  T.String(opts.currency)

  // Type is hard-coded at this point.
  opts.type = Account.TYPE_NORMAL

  if (!opts.name) {
    opts.name = yield generateNewAccountName(opts.userId, opts.currency)
  }

  const result = yield Account.create(opts)
  const account = yield Account.getById(result.insertId)

  return account
})

const deposit = P.coroutine(function * (opts) {
  T.String(opts.accountId)
  T.String(opts.currency)
  T.Number(opts.amount)
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
  getAccountsForUser,
  getTransactionHistory,
  transfer
}
