'use strict'

const Db = require('../database')
const Joi = require('joi')
const Boom = require('boom')

const validate = require('./validate')

const _user = Joi.object().keys({
  name: Joi.string().min(3).required(),
  email: Joi.string().email().required(),
  profile: Joi.string()
})

function deleteInvalidPasswords () {
  return Db.query(`
    DELETE p FROM passwords p
      LEFT JOIN user u ON u.id = p.userId
        WHERE u.id IS NULL
  `)
}

function deleteAll () {
  return Db.query('DELETE FROM user WHERE isInternal = false')
}

function deleteById (id) {
  return Db.query('DELETE FROM user WHERE id = ? AND isInternal = false', [id])
}

function getById (id) {
  return Db.findOne('SELECT * FROM user WHERE id = ?', [id])
}

function isValid (id) {
  return getById(id).tap((user) => {
    if (!user) {
      throw Boom.badRequest('User account does not exist.')
    }
    if (!user.isEnabled) {
      throw Boom.badRequest('User account is temporarily suspended.')
    }
  })
  .then((user) => {
    if (user.profile) {
      user.profile = JSON.parse(user.profile)
    }
    return user
  })
}

function getByEmail (email) {
  return Db.findOne('SELECT * FROM user WHERE email = ?', [email])
}

function create (user) {
  return Db.query('INSERT INTO user SET ?', validate(user, _user))
}

function setPassword (userId, salt, hashedPassword) {
  return Db.query(
    'REPLACE passwords SET userId = ?, salt = ?, hashedPassword = ?, updated = NULL',
    [userId, salt, hashedPassword]
  )
}

function getPassword (userId) {
  return Db.findOne('SELECT * FROM passwords WHERE userId = ?', [userId])
}

module.exports = {
  getById,
  getByEmail,
  deleteById,
  deleteAll,
  create,
  setPassword,
  getPassword,
  deleteInvalidPasswords,
  isValid
}
