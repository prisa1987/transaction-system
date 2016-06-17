'use strict'

const P = require('bluebird')
const Boom = require('boom')
const Hoek = require('hoek')
const Chalk = require('chalk')
const Argv = require('minimist')(process.argv.slice(2))

const Server = require('../server/index')
const Db = require('../server/database')

const AccountService = require('../server/services/account')

run()

function run () {
  return P.try(() => {
    if (Argv.deposit) {
      Hoek.assert(Argv.accountId, 'Missing --accountId arg')
      Hoek.assert(Argv.currency, 'Missing --currency arg')
      Hoek.assert(Argv.amount, 'Missing --amount arg')
      return AccountService.deposit({
        accountId: Argv.accountId.toString(),
        currency: Argv.currency,
        amount: Argv.amount.toString()
      })
      .tap((transactionHistory) => {
        console.log('Transaction:', JSON.stringify(transactionHistory, false, 2))
      })
    } else {
      throw Boom.notFound()
    }
  })
  .then((res) => {
    console.log('Done.')
  })
  .catch((reason) => {
    console.log('Error:', Chalk.bgRed.bold(reason.message))
    console.log(`
    Usage:
    node cli/admin.js
      ${Chalk.bgGreen.bold('--deposit')}             Deposit funds into an account
        --accountId         Target account id
        --currency          E.g. USD, SEK, ..
        --amount            Amount in smallest possible denomination of the currency,
                            i.e. US cents for USD accounts, or Swedish Ore for SEK accounts.
                            For example: If you want to deposit $5 USD, the set '--amount 500'
    `)
  })
  .finally(() => {
    Db.close()
  })
}
