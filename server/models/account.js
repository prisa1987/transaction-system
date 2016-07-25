'use strict'

const Db = require('../database')
const Joi = require('joi')
const Boom = require('boom')
const P = require('bluebird')
const T = require('tcomb')

const validate = require('./validate')

const TYPE_MAIN = 11
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
    ['USD', 'THB', 'SEK']
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

function getByIds (accountIds) {
  return Db.query('SELECT * FROM account WHERE id IN (?)', [accountIds])
}

function create (account) {
  return Db.query('INSERT INTO account SET ?', validate(account, _account))
}

function getByUserId (userId) {
  return Db.query('SELECT * FROM account WHERE userId = ? ORDER BY id ASC', [userId])
}

function getMainAccountByUserId(userId) {
  return Db.findOne('SELECT * FROM account WHERE userId = ? AND type = ? ', [userId,TYPE_MAIN])
}

function getTransactionHistory (accountId, max) {
  return Db.query(`
    SELECT * FROM transaction_log WHERE
    (fromAccountId = ? OR toAccountId = ?)
    ORDER BY id DESC LIMIT ?
    `, [accountId, accountId, max]
  )
}

function getTransactionHistoryForAccountOwner (userId, max) {
  return Db.query(`
    SELECT * FROM transaction_log WHERE
    (
      (fromAccountId IN (SELECT id FROM account WHERE userId = ?))
      OR
      (toAccountId IN (SELECT id FROM account WHERE userId = ?))
    )
    ORDER BY id DESC LIMIT ?
    `, [userId, userId, max]
  )
} 

function getTransactionHistoryForAccountOwnerWithDetail (actorId, max) {
  return Db.query(`
    SELECT t.id,t.description,t.status, t.amount,t.created,t.type,t.fromUserId,t.toUserId,
      uf.name AS fromUserName,uf.email AS fromUserEmail,uf.profile AS fromUserProfile,
      ut.name AS toUserName,ut.email AS toUserEmail,ut.profile AS toUserProfile FROM 
      (SELECT t.id,t.description,t.status, t.amount,t.created,t.type,af.userId AS fromUserId,at.userId AS toUserId FROM
        (SELECT * FROM transaction_log t WHERE
          (
            (fromAccountId IN (SELECT id FROM account WHERE userId = ?))
            OR
            (toAccountId IN (SELECT id FROM account WHERE userId = ?))
          )
        ) t JOIN account af ON t.fromAccountId =af.id JOIN account at ON t.toAccountId = at.id
      ) t JOIN user uf ON t.fromUserId = uf.id JOIN user ut ON t.toUserId = ut.id 
    ORDER BY id DESC LIMIT ?
    `, [actorId, actorId, max]
  )
} 

function getTransactionHistoryForAccountOwnerWithDetailByToUserId (actorId, userId, max) {
  return Db.query(`
    SELECT t.id,t.description,t.status, t.amount,t.created,t.type,t.fromUserId,t.toUserId,
      uf.name AS fromUserName,uf.email AS fromUserEmail,uf.profile AS fromUserProfile,
      ut.name AS toUserName,ut.email AS toUserEmail,ut.profile AS toUserProfile FROM 
      (SELECT t.id,t.description,t.status, t.amount,t.created,t.type,af.userId AS fromUserId,at.userId AS toUserId FROM
        (SELECT * FROM transaction_log t WHERE
          (
            (
              (fromAccountId IN (SELECT id FROM account WHERE userId = ?)) AND (toAccountId IN (SELECT id FROM account WHERE userId = ?))
            ) OR
            (
              (fromAccountId IN (SELECT id FROM account WHERE userId = ?)) AND (toAccountId IN (SELECT id FROM account WHERE userId = ?))
            )
          )
        ) t JOIN account af ON t.fromAccountId =af.id JOIN account at ON t.toAccountId = at.id
      ) t JOIN user uf ON t.fromUserId = uf.id JOIN user ut ON t.toUserId = ut.id 
    ORDER BY id DESC LIMIT ?
    `, [actorId,userId, userId, actorId, max]
  )
} 

function getTransactionHistoryById (id) {
  return Db.findOne('SELECT * FROM transaction_log WHERE id = ?', [id])
}

function _debitCredit (conn, opts) {
  return P.try(() => {
    T.String(opts.fromAccountId)
    T.String(opts.toAccountId)
    T.String(opts.amount)

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
    .then((result) => {
      if (!result.insertId) {
        throw Boom.badRequest(
          `Failed to log transaction between accounts ${opts.fromAccountId} -> ${opts.toAccountId}. Amount = ${opts.amount}`
        )
      }
      return result.insertId
    })
  })
}

function _deposit (conn, opts) {
  return P.try(() => {
    return conn.queryAsync(
      'SELECT * FROM account WHERE id = ? AND currency = ? FOR UPDATE',
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
    .then((transactionHistoryId) => {
      return conn.commitAsync()
      .then(() => transactionHistoryId)
    })
  })
}

function deposit (opts) {
  return Db.transaction((conn) => _deposit(conn, opts))
}

function _transfer (conn, opts) {
  return P.try(() => {
    return conn.queryAsync(
      'SELECT * FROM account WHERE id = ? AND currency = ? FOR UPDATE',
      [opts.fromAccountId, opts.currency]
    )
    .then((fromAccount) => {
      if (!fromAccount.length) {
        throw Boom.notFound(`Could not find source account id ${opts.fromAccountId} currency ${opts.currency}`)
      }
      return conn.queryAsync(
        'SELECT * FROM account WHERE id = ? AND currency = ? FOR UPDATE',
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
      .then((transactionHistoryId) => (
        conn.commitAsync()
        .then(() => transactionHistoryId)
      ))
    })
  })
}

function _transferByUserId (conn, opts) {
  return P.try(() => {
    return conn.queryAsync(
      'SELECT * FROM account WHERE id = ? FOR UPDATE',
      [opts.fromAccountId]
    )
    .then((fromAccount) => {
      if (!fromAccount.length) {
        throw Boom.notFound(`Could not find source account id ${opts.fromAccountId} currency ${opts.currency}`)
      }
      return conn.queryAsync(
        'SELECT * FROM account WHERE userId = ? AND type = ? FOR UPDATE',
        [opts.toUserId, TYPE_MAIN]
      )
      .then((toUserId) => {
        if (!toUserId.length) {
          throw Boom.notFound(`Could not find target user id ${opts.toUserId}`)
        }

        return _debitCredit(conn, {
          fromAccountId: fromAccount[0].id,
          toAccountId: toUserId[0].id,
          amount: opts.amount,
          transactionType: opts.transactionType
        })
      })
      .then((transactionHistoryId) => (
        conn.commitAsync()
        .then(() => transactionHistoryId)
      ))
    })
  })
}

function transfer (opts) {
  return Db.transaction((conn) => _transfer(conn, opts))
}

function transferByUserId(opts) {
  return Db.transaction((conn) => _transferByUserId(conn, opts))
}
module.exports = {
  TYPE_MAIN,
  TYPE_NORMAL,
  TYPE_INTERNAL,
  ACCOUNT_WORLD,
  ACCOUNT_HOUSE,
  TXN_TYPE_REAL,
  TXN_TYPE_INTERNAL,
  TXN_TYPE_TEST,

  getById,
  getByIds,
  deleteById,
  deleteAll,
  deleteTestTransactions,
  create,
  deposit,
  getByUserIdAndCurrency,
  getByUserId,
  getTransactionHistory,
  getTransactionHistoryById,
  getTransactionHistoryForAccountOwner,
  getTransactionHistoryForAccountOwnerWithDetail,
  getTransactionHistoryForAccountOwnerWithDetailByToUserId,
  getMainAccountByUserId,
  transferByUserId,
  transfer
}
