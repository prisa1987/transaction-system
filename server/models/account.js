'use strict'

const Db = require('../database')
const Joi = require('joi')
const Boom = require('boom')
const P = require('bluebird')
const T = require('tcomb')

const validate = require('./validate')

const TYPE_NORMAL = 1
const TYPE_INTERNAL = 10
const ACCOUNT_WORLD = '100'
const ACCOUNT_HOUSE = '101'
const TXN_TYPE_REAL = 1
const TXN_TYPE_INTERNAL = 10
const TXN_TYPE_TEST = 1000

const _account = Joi.object().keys({
  userId: Joi.string().min(1).required(),
  type: Joi.number().integer().positive().required(),
  name: Joi.string().min(2),
  // TODO: Add more currencies
  currency: Joi.string().allow(
    ['USD', 'THB']
  )
})

function deleteAll () {
  return Db.query('DELETE FROM account WHERE isInternal = false')
}

function deleteTestTransactions () {
  return Db.query('DELETE FROM transaction_log WHERE type = ?', [TXN_TYPE_TEST])
}

function deleteById (id) {
  return Db.query('DELETE FROM account WHERE id = ? AND isInternal = false', [id])
}

function getByUserIdAndCurrency (userId, currency) {
  return Db.query('SELECT * FROM account WHERE userId = ? AND currency = ?', [userId, currency])
}

function getById (id) {
  return Db.findOne('SELECT * FROM account WHERE id = ?', [id])
}

function create (account) {
  return Db.query('INSERT INTO account SET ?', validate(account, _account))
}

function getTransactionHistory (accountId, max) {
  return Db.query(`
    SELECT * FROM transaction_log WHERE
    (fromAccountId = ? OR toAccountId = ?)
    ORDER BY id DESC LIMIT ?
    `, [accountId, accountId, max]
  )
}

function _debitCredit (conn, opts) {
  return P.try(() => {
    T.String(opts.fromAccountId)
    T.String(opts.toAccountId)
    T.Number(opts.amount)

    return conn.queryAsync(
      'UPDATE account SET balance = balance - ? WHERE balance >= ? AND id = ?',
      [opts.amount, opts.amount, opts.fromAccountId]
    )
    .tap((result) => {
      if (result.affectedRows !== 1) {
        throw Boom.badRequest(
          `Overdraw. Insufficient balance in account id ${opts.fromAccountId}. Amount = ${opts.amount}`
        )
      }
    })
    .then(() => conn.queryAsync(
      'UPDATE account SET balance = balance + ? WHERE id = ?',
      [opts.amount, opts.toAccountId]
    ))
    .tap((result) => {
      if (result.affectedRows !== 1) {
        throw Boom.badRequest(`Could not credit account id ${opts.fromAccountId}. Amount = ${opts.amount}`)
      }
    })
    .then(() => {
      const txn = {
        fromAccountId: opts.fromAccountId,
        toAccountId: opts.toAccountId,
        amount: opts.amount,
        type: opts.transactionType || TXN_TYPE_REAL
      }
      return conn.queryAsync('INSERT INTO transaction_log SET ?', [txn])
    })
    .tap((result) => {
      if (!result.insertId) {
        throw Boom.badRequest(
          `Failed to log transaction between accounts ${opts.fromAccountId} -> ${opts.toAccountId}. Amount = ${opts.amount}`
        )
      }
    })
  })
}

function _deposit (conn, opts) {
  return P.try(() => {
    return conn.queryAsync(
      'SELECT * FROM account WHERE id = ? AND currency = ?',
      [opts.accountId, opts.currency]
    )
    .tap((targetAccount) => {
      if (!targetAccount.length) {
        throw Boom.notFound(`Could not find target account id ${opts.accountId} currency ${opts.currency}`)
      }
    })
    .then(() => _debitCredit(conn, {
      fromAccountId: ACCOUNT_WORLD,
      toAccountId: ACCOUNT_HOUSE,
      amount: opts.amount,
      transactionType: opts.transactionType
    }))
    .then(() => _debitCredit(conn, {
      fromAccountId: ACCOUNT_HOUSE,
      toAccountId: opts.accountId,
      amount: opts.amount,
      transactionType: opts.transactionType
    }))
    .then(() => conn.commitAsync())
    .then(() => true)
  })
}

function deposit (opts) {
  return Db.transaction((conn) => _deposit(conn, opts))
}

function _transfer (conn, opts) {
  return P.try(() => {
    return conn.queryAsync(
      'SELECT * FROM account WHERE id = ? AND currency = ?',
      [opts.fromAccountId, opts.currency]
    )
    .then((fromAccount) => {
      if (!fromAccount.length) {
        throw Boom.notFound(`Could not find source account id ${opts.fromAccountId} currency ${opts.currency}`)
      }
      return conn.queryAsync(
        'SELECT * FROM account WHERE id = ? AND currency = ?',
        [opts.toAccountId, opts.currency]
      )
      .then((toAccount) => {
        if (!toAccount.length) {
          throw Boom.notFound(`Could not find target account id ${opts.toAccountId} currency ${opts.currency}`)
        }

        return _debitCredit(conn, {
          fromAccountId: fromAccount[0].id,
          toAccountId: toAccount[0].id,
          amount: opts.amount,
          transactionType: opts.transactionType
        })
      })
      .then(() => conn.commitAsync())
      .then(() => true)
    })
  })
}

function transfer (opts) {
  return Db.transaction((conn) => _transfer(conn, opts))
}

module.exports = {
  TYPE_NORMAL,
  TYPE_INTERNAL,
  ACCOUNT_WORLD,
  ACCOUNT_HOUSE,
  TXN_TYPE_REAL,
  TXN_TYPE_INTERNAL,
  TXN_TYPE_TEST,

  getById,
  deleteById,
  deleteAll,
  deleteTestTransactions,
  create,
  deposit,
  getByUserIdAndCurrency,
  getTransactionHistory,

  transfer
}
