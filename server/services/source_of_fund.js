'use strict'

const P = require('bluebird')
const T = require('tcomb')
const Boom = require('boom')

const sof = require('../models/source_of_fund')
const User = require('../models/user')

const createBankAccountType = P.coroutine(function * (data, userId) {

  T.String(userId)
  T.Object(data)

  const result = yield sof.create({
    userId: userId,
    type: sof.TYPE_BANK_ACCOUNT,
    metadata: JSON.stringify({
      number: data.number,
      issuer: data.issuer,
    })
  })
  const source = yield sof.getById(result.insertId)

  return source
})

function getAllBankAccount(userId) {
  T.String(userId)
  return sof.getByUserIdAndType(userId, sof.TYPE_BANK_ACCOUNT)
}

module.exports = {
  createBankAccountType,
  getAllBankAccount
}
