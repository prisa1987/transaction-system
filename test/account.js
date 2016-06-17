'use strict'

const P = require('bluebird')
const Code = require('code')
const Lab = require('lab')
const lab = exports.lab = Lab.script()

const Db = require('./databaseHelper.js')
const Account = require('../server/models/account')
const AccountService = require('../server/services/account')

lab.experiment('Accounts', () => {
  let context
  let account1
  let account2
  lab.before((done) => {
    Db.reset()
    .user('user1')
    .user('user2')
    .wait((_context) => {
      context = _context
      done()
    })
  })

  lab.test('user1 creates an account', () => {
    return AccountService.create({
      name: 'test.test',
      currency: 'USD'
    }, context.user1.id)
    .then((account) => {
      Code.expect(account.id).to.be.above(9999)
      Code.expect(account.userId).to.equal(context.user1.id)
      account1 = account
    })
  })

  lab.test('user1 deposits $10 USD', () => {
    return AccountService.deposit({
      accountId: account1.id,
      amount: '1000', // Deposit $10 USD (1,000 US Cents)
      currency: 'USD',
      transactionType: Account.TXN_TYPE_TEST
    })
    .tap((transactionHistory) => {
      Code.expect(transactionHistory.amount).to.equal('1000')
    })
    .then(() => AccountService.getAccountsForUser(context.user1.id, 'USD'))
    .tap((accounts) => {
      Code.expect(accounts[0].balance).to.equal('1000')
      Code.expect(accounts[0].currency).to.equal('USD')
    })
    .then((accounts) => AccountService.getTransactionHistory(accounts[0].id))
    .tap((history) => {
      Code.expect(history.length).to.equal(1)
      Code.expect(history[0].fromAccountId).to.equal(Account.ACCOUNT_HOUSE)
      Code.expect(history[0].toAccountId).to.equal(account1.id)
      Code.expect(history[0].amount).to.equal('1000')
      Code.expect(history[0].type).to.equal(Account.TXN_TYPE_TEST)
    })
  })

  lab.test('user2 creates an account', () => {
    return AccountService.create({
      name: 'test.test',
      currency: 'USD'
    }, context.user2.id)
    .then((account) => {
      Code.expect(account.id).to.be.above(9999)
      Code.expect(account.userId).to.equal(context.user2.id)
      account2 = account
    })
  })

  lab.test('user1 transfers $2 USD', () => {
    return AccountService.transfer({
      fromAccountId: account1.id,
      toAccountId: account2.id,
      amount: '200', // Deposit $2 USD (200 US Cents)
      currency: 'USD',
      transactionType: Account.TXN_TYPE_TEST
    }, context.user1.id)
    .tap((transactionHistory) => Code.expect(transactionHistory.amount).to.equal('200'))
    .then(() => AccountService.getAccountsForUser(context.user1.id, 'USD'))
    .tap((accounts) => {
      Code.expect(accounts[0].balance).to.equal('800')
      Code.expect(accounts[0].currency).to.equal('USD')
    })
    .then(() => AccountService.getTransactionHistory(account2.id))
    .tap((history) => {
      Code.expect(history.length).to.equal(1)
      Code.expect(history[0].fromAccountId).to.equal(account1.id)
      Code.expect(history[0].toAccountId).to.equal(account2.id)
      Code.expect(history[0].amount).to.equal('200')
      Code.expect(history[0].type).to.equal(Account.TXN_TYPE_TEST)
    })
  })

  lab.test('user1 fails to transfer $9 USD', () => {
    return AccountService.transfer({
      fromAccountId: account1.id,
      toAccountId: account2.id,
      amount: '900', // Deposit $2 USD (200 US Cents)
      currency: 'USD',
      transactionType: Account.TXN_TYPE_TEST
    }, context.user1.id)
    .tap((result) => Code.fail('Expected an exception!'))
    .catch((reason) => {
      Code.expect(reason.output.payload.message).to.include('Insufficient balance')
    })
  })

  lab.test('user1 and user2 transfer $0.01 USD between them a 100 times', (done) => {
    const promises = []
    for (let i = 0; i < 100; ++i) {
      promises.push(
        AccountService.transfer({
          fromAccountId: account1.id,
          toAccountId: account2.id,
          amount: '1', // $0.01
          currency: 'USD',
          transactionType: Account.TXN_TYPE_TEST
        }, context.user1.id))
      promises.push(
        AccountService.transfer({
          fromAccountId: account2.id,
          toAccountId: account1.id,
          amount: '1', // $0.01
          currency: 'USD',
          transactionType: Account.TXN_TYPE_TEST
        }, context.user2.id))
    }

    return P.all(promises)
    .tap((result) => Code.expect(result.filter((x) => x.amount === '1').length).to.equal(200))
    .then(() => AccountService.getAccountsForUser(context.user1.id, 'USD'))
    .tap((accounts) => {
      Code.expect(accounts[0].balance).to.equal('800')
      Code.expect(accounts[0].currency).to.equal('USD')
    })
    .then(() => AccountService.getTransactionHistory(account2.id, 300))
    .tap((history) => {
      Code.expect(history.length).to.equal(201)

      const fromUser1 = history
      .filter((x) => x.fromAccountId === account1.id)
      .reduce((acc, x) => {
        acc += Number(x.amount)
        return acc
      }, 0)

      const fromUser2 = history
      .filter((x) => x.fromAccountId === account2.id)
      .reduce((acc, x) => {
        acc += Number(x.amount)
        return acc
      }, 0)

      Code.expect(fromUser1).to.equal(300)
      Code.expect(fromUser2).to.equal(100)
    })
  })

  lab.after((done) => {
    Db.printStats()
    done()
  })
})
