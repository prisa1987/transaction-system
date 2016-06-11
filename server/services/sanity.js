'use strict'

const P = require('bluebird')

const User = require('./models/user')

const test = P.coroutine(function * () {
  const email = `${Date.now()}_${Math.ceil(Math.random() * 10000)}@example.com`

  let user = yield User.getByEmail(email)
  let res
  if (!user) {
    res = yield User.create({
      email,
      name: 'Mr Test'
    })
    user = yield User.getById(res.insertId)
  }

  yield User.deleteById(user.id)
})

module.exports = {
  test
}
