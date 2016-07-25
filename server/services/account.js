'use strict'

const P = require('bluebird')
const T = require('tcomb')
const Boom = require('boom')

const Account = require('../models/account')
const Stats = require('../models/stats')
const Constants = require('../constants')

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

  if(!opts.type) {
    opts.type = Account.TYPE_NORMAL
  }

  const result = yield Account.create({
    userId: actorId,
    // Type is hard-coded at this point.
    type: opts.type,
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
  const transactionHistoryId = yield Account.deposit(opts)
  return yield Account.getTransactionHistoryById(transactionHistoryId)
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

function getTransactionHistoryForAccountOwner (userId, max = 10) {
  T.String(userId)
  return Account.getTransactionHistoryForAccountOwner(userId, max)
}

const getTransactionHistoryForAccountOwnerWithDetail =  P.coroutine(function * (userId, max=10) {
  T.String(userId)
  var transactions = yield Account.getTransactionHistoryForAccountOwnerWithDetail(userId, max)
  return transactions.map(function(t) {
    return {
       id: t.id,
       description: t.description,
       status: t.status,
       amount: t.amount,
       created: t.created,
       type:t.type,
       from: {
          id: t.fromUserId,
          name: t.fromUserName,
          email: t.fromUserEmail,
          profile: JSON.parse(t.fromUserProfile)
       },
       to: {
          id: t.toUserId,
          name: t.toUserName,
          email: t.toUserEmail,
          profile: JSON.parse(t.toUserProfile)
       },
       status: Constants.TRANSACTION_STATUS[t.status],
       description: t.description
    }
  })
})

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

function getTransactionHistoryForUser (accountId, max, userId) {
  return requireAccountAsOwner(accountId, userId)
  .then(() => getTransactionHistory(accountId, max))
}

const transfer = P.coroutine(function * (opts, actorId) {
  T.String(opts.fromAccountId)
  T.String(opts.toAccountId)
  T.String(opts.currency)
  T.String(opts.amount)
  T.String(actorId)

  yield requireAccountAsOwner(opts.fromAccountId, actorId)

  // Fetch target account.
  const toAccount = yield Account.getById(opts.toAccountId)
  if (!toAccount) {
    throw Boom.notFound('Could not find target account')
  }

  // Make the transfer.
  const transactionHistoryId = yield Account.transfer(opts)

  // Update transfer stats.
  yield Stats.updateTransferStats(actorId, toAccount.id, toAccount.userId)

  // Return latest transaction history.
  return yield Account.getTransactionHistoryById(transactionHistoryId)
})

const transferByUserId = P.coroutine(function * (opts, actorId) {
  T.String(opts.fromAccountId)
  T.String(opts.toUserId)
  T.String(opts.currency)
  T.String(opts.amount)
  T.String(actorId)

  yield requireAccountAsOwner(opts.fromAccountId, actorId)

  // Fetch target account.
  const toAccount = yield Account.getMainAccountByUserId(opts.toUserId)
  if (!toAccount) {
    throw Boom.notFound('Could not find target account')
  }

  // Make the transfer.
  const transactionHistoryId = yield Account.transferByUserId(opts)
  // Update transfer stats.
  yield Stats.updateTransferStats(actorId, toAccount.id, toAccount.userId)

  // Return latest transaction history.
  return yield Account.getTransactionHistoryById(transactionHistoryId)
})

const getAll = P.coroutine(function * (actorId) {
  T.String(actorId)
  const accounts = yield Account.getByUserId(actorId)
  return accounts
})

module.exports = {
  create,
  deposit,
  getAccountsForUser,
  getTransactionHistory,
  getTransactionHistoryForUser,
  getTransactionHistoryForAccountOwner,
  getTransactionHistoryForAccountOwnerWithDetail,
  requireAccountAsOwner,
  transfer,
  transferByUserId,
  getAll
}
