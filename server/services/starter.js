'use strict'

const P = require('bluebird')
const T = require('tcomb')

const User = require('../models/user')

const AccountService = require('./account')
const Account = require('../models/account')
const UserService = require('./user')

const getStarter = P.coroutine(function * (userId, defaultCurrency) {
  T.String(userId)
  T.String(defaultCurrency)

  // Fetch the current user.
  const user = yield User.isValid(userId)

  // Fetch all accounts.
  let accounts = yield AccountService.getAll(userId)

  // If we have no accounts, create a new account on-the-fly
  // using the default currency.
  if (!accounts.length) {
    const account = yield AccountService.create({
      currency: defaultCurrency,
      type: Account.TYPE_MAIN
    }, userId)
    accounts = [account]
  }

  // Get latest suggestions.
  const searchResult = yield UserService.search(userId)
  const suggestions = searchResult.suggestions

  // Get transaction history
  const history = yield AccountService.getTransactionHistoryForAccountOwner(userId, 20)

  return {
    user,
    accounts,
    suggestions,
    history
  }
})

module.exports = {
  getStarter
}
