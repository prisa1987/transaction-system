`use strict`

const Db = require('../database')
const Joi = require('joi')

const validate = require('./validate')

const TYPE_BANK_ACCOUNT = 10
const TYPE_CREDIT_CARD = 11

const _sourceOfFund = Joi.object().keys({
  userId: Joi.string().min(1).required(),
  type: Joi.number().integer().positive().required(),
  metadata: Joi.string().min(1).required()
})

function getById(id) {
  return Db.findOne('SELECT * FROM source_of_fund WHERE id = ?', [id])
}

function getByUserId(id) {
  return Db.query('SELECT * FROM source_of_fund WHERE userId = ?', [id])
}

function deleteById(id) {
  return Db.query('DELETE FROM source_of_fund WHERE id = ?', [id])
}

function create(source) {
  return Db.query('INSERT INTO source_of_fund SET ?', validate(source, _sourceOfFund))
}

module.exports = {
  TYPE_BANK_ACCOUNT,
  TYPE_CREDIT_CARD,

  getById,
  getByUserId,
  deleteById,
  create

}
