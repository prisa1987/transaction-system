'use strict'

const P = require('bluebird')
const Code = require('code')
const Lab = require('lab')
const lab = exports.lab = Lab.script()

const Db = require('./databaseHelper.js')
const server = require('../server/index')

const AccountService = require('../server/services/account')
const UserService = require('../server/services/user')

lab.experiment('REST API', () => {
  lab.before((done) => {
    Db.reset().wait(() => done())
  })

  let user1
  let user2
  let user3

  lab.test('user1 fails to sign up by omitting a name', (done) => {
    server.inject({
      method: 'POST',
      url: '/api/user',
      payload: {
        name: '',
        email: 'ace@base.se'
      }
    }, (res) => {
      Code.expect(res.result.error).to.include('"name" is not allowed to be empty')
      done()
    })
  })

  lab.test('user1 signs up', (done) => {
    server.inject({
      method: 'POST',
      url: '/api/user',
      payload: {
        name: 'Ace Spades',
        email: 'ace@base.se'
      }
    }, (res) => {
      // console.log('res.result=', res.result)
      Code.expect(res.result.user.id).to.exist()
      Code.expect(res.result.user.email).to.equal('ace@base.se')
      Code.expect(res.result.user.password.length).to.be.above(6)
      user1 = res.result.user
      done()
    })
  })

  lab.test('user1 fails to authenticate', (done) => {
    server.inject({
      method: 'POST',
      url: '/api/auth',
      payload: {
        email: 'ace@base.se',
        password: 'lotsofbs'
      }
    }, (res) => {
      // console.log('res.result=', res.result)
      Code.expect(res.result.error).to.include('Unauthorized')
      done()
    })
  })

  lab.test('user1 authenticates and gets an access token', (done) => {
    server.inject({
      method: 'POST',
      url: '/api/auth',
      payload: {
        email: 'ace@base.se',
        password: user1.password
      }
    }, (res) => {
      // console.log('res.result=', res.result)
      Code.expect(res.result.token).to.exist()
      Code.expect(res.result.token.length).to.be.above(100)
      user1.token = res.result.token
      done()
    })
  })

  lab.test('user1 can be fetched', (done) => {
    server.inject({
      method: 'GET',
      url: '/api/user',
      headers: { 'authorization': user1.token }
    }, (res) => {
      // console.log('res.result=', res.result)
      Code.expect(res.result.user.id).to.exist()
      Code.expect(res.result.user.email).to.equal('ace@base.se')
      done()
    })
  })

  lab.test('user1 creates a USD account', (done) => {
    server.inject({
      method: 'POST',
      url: '/api/account',
      headers: { 'authorization': user1.token },
      payload: {
        currency: 'USD'
      }
    }, (res) => {
      // console.log('res.result=', res.result)
      Code.expect(res.result.account).to.exist()
      Code.expect(res.result.account.name).to.equal('USD_1')
      Code.expect(res.result.account.userId).to.equal(user1.id)
      user1.account1 = res.result.account
      done()
    })
  })

  lab.test('user1 creates another USD account', (done) => {
    server.inject({
      method: 'POST',
      url: '/api/account',
      headers: { 'authorization': user1.token },
      payload: {
        currency: 'USD'
      }
    }, (res) => {
      // console.log('res.result=', res.result)
      Code.expect(res.result.account).to.exist()
      Code.expect(res.result.account.name).to.equal('USD_2')
      Code.expect(res.result.account.userId).to.equal(user1.id)
      user1.account2 = res.result.account
      done()
    })
  })

  lab.test('System deposits $25 USD money into user1’s account', (done) => {
    return AccountService.deposit({
      accountId: user1.account1.id,
      currency: 'USD',
      amount: '2500'
    })
    .then(() => AccountService.getAccountsForUser(user1.id, 'USD'))
    .tap((accounts) => {
      Code.expect(accounts[0].balance).to.equal('2500')
      Code.expect(accounts[0].currency).to.equal('USD')
    })
  })

  lab.test('user1 transfers $0.50 USD to his other account named `USD_2`', (done) => {
    server.inject({
      method: 'POST',
      url: '/api/transfer',
      headers: { 'authorization': user1.token },
      payload: {
        fromAccountId: user1.account1.id,
        toAccountId: user1.account2.id,
        amount: '50',
        currency: 'USD'
      }
    }, (res) => {
      AccountService.getAccountsForUser(user1.id, 'USD')
      .tap((accounts) => {
        const account1 = accounts.find((x) => x.name.indexOf('USD_1') !== -1)
        const account2 = accounts.find((x) => x.name.indexOf('USD_2') !== -1)
        Code.expect(account1.balance).to.equal('2450')
        Code.expect(account2.balance).to.equal('50')
        done()
      })
    })
  })

  lab.test('user2 signs up', (done) => {
    server.inject({
      method: 'POST',
      url: '/api/user',
      payload: {
        name: 'Kate Spade',
        email: 'kate@base.se'
      }
    }, (res) => {
      // console.log('res.result=', res.result)
      Code.expect(res.result.user.id).to.exist()
      Code.expect(res.result.user.email).to.equal('kate@base.se')
      user2 = res.result.user
      done()
    })
  })

  lab.test('user2 authenticates and gets an access token', (done) => {
    server.inject({
      method: 'POST',
      url: '/api/auth',
      payload: {
        email: 'kate@base.se',
        password: user2.password
      }
    }, (res) => {
      // console.log('res.result=', res.result)
      Code.expect(res.result.token).to.exist()
      Code.expect(res.result.token.length).to.be.above(100)
      user2.token = res.result.token
      done()
    })
  })

  lab.test('user2 creates a SEK account', (done) => {
    server.inject({
      method: 'POST',
      url: '/api/account',
      headers: { 'authorization': user2.token },
      payload: {
        currency: 'SEK'
      }
    }, (res) => {
      // console.log('res.result=', res.result)
      Code.expect(res.result.account).to.exist()
      Code.expect(res.result.account.name).to.equal('SEK_1')
      Code.expect(res.result.account.userId).to.equal(user2.id)
      user2.account1 = res.result.account
      done()
    })
  })

  lab.test('user1 fails to transfer $0.25 USD to user2’s SEK account', (done) => {
    server.inject({
      method: 'POST',
      url: '/api/transfer',
      headers: { 'authorization': user1.token },
      payload: {
        fromAccountId: user1.account1.id,
        toAccountId: user2.account1.id,
        amount: '25',
        currency: 'USD'
      }
    }, (res) => {
      Code.expect(res.statusCode).to.equal(400)
      Code.expect(res.payload).to.include('Could not find target account')
      Code.expect(res.payload).to.include('currency USD')
      done()
    })
  })

  lab.test('user2 creates a USD account', (done) => {
    server.inject({
      method: 'POST',
      url: '/api/account',
      headers: { 'authorization': user2.token },
      payload: {
        currency: 'USD'
      }
    }, (res) => {
      // console.log('res.result=', res.result)
      Code.expect(res.result.account).to.exist()
      Code.expect(res.result.account.name).to.equal('USD_1')
      user2.account2 = res.result.account
      done()
    })
  })

  lab.test('user1 transfers $0.25 USD to user2', (done) => {
    server.inject({
      method: 'POST',
      url: '/api/transfer',
      headers: { 'authorization': user1.token },
      payload: {
        fromAccountId: user1.account1.id,
        toAccountId: user2.account2.id,
        amount: '25',
        currency: 'USD'
      }
    }, (res) => {
      AccountService.getAccountsForUser(user2.id, 'USD')
      .tap((accounts) => {
        Code.expect(accounts[0].balance).to.equal('25')
        done()
      })
    })
  })

  lab.test('user1 get his latest transaction history', (done) => {
    server.inject({
      method: 'GET',
      url: '/api/history/' + user1.account1.id,
      headers: { 'authorization': user1.token }
    }, (res) => {
      // console.log('res.result=', res.result)
      const history = res.result.transactionHistory
      Code.expect(history[0].toAccountId).to.equal(user2.account2.id)
      Code.expect(history[0].amount).to.equal('25')
      Code.expect(history[1].toAccountId).to.equal(user1.account2.id)
      Code.expect(history[1].amount).to.equal('50')
      done()
    })
  })

  lab.test('user1 get his balance', (done) => {
    server.inject({
      method: 'GET',
      url: '/api/account/' + user1.account1.id,
      headers: { 'authorization': user1.token }
    }, (res) => {
      // console.log('res.result=', res.result)
      const account = res.result.account
      Code.expect(account.balance).to.equal('2425')
      Code.expect(account.currency).to.equal('USD')
      Code.expect(account.name).to.equal('USD_1')
      done()
    })
  })

  lab.test('user1 can list all his accounts', (done) => {
    server.inject({
      method: 'GET',
      url: '/api/accounts',
      headers: { 'authorization': user1.token }
    }, (res) => {
      // console.log('res.result=', res.result)
      const accounts = res.result.accounts
      Code.expect(accounts[0].name).to.equal('USD_1')
      Code.expect(accounts[1].name).to.equal('USD_2')
      Code.expect(accounts[1].userId).to.equal(user1.id)
      done()
    })
  })

  lab.test('user1 updates his profile', (done) => {
    server.inject({
      method: 'PATCH',
      url: '/api/user/profile',
      headers: { 'authorization': user1.token },
      payload: {
        first_name: 'Tasty',
        last_name: 'Test',
        settings: 'TESTING',
        photo: 'tasty.jpg'
      }
    }, (res) => {
      // console.log('res.result=', res.result)
      Code.expect(res.result.ok).to.equal(1)
      UserService.requireValidUser(user1.id)
      .then((user) => {
        // console.log('user=', user)
        Code.expect(user.profile.first_name).to.equal('Tasty')
        Code.expect(user.profile.photo).to.equal('tasty.jpg')
        done()
      })
    })
  })

  lab.test('user1 updates his profile again', (done) => {
    server.inject({
      method: 'PATCH',
      url: '/api/user/profile',
      headers: { 'authorization': user1.token },
      payload: {
        first_name: 'Tasty!'
      }
    }, (res) => {
      // console.log('res.result=', res.result)
      Code.expect(res.result.ok).to.equal(1)
      UserService.requireValidUser(user1.id)
      .then((user) => {
        // console.log('user=', user)
        Code.expect(user.profile.first_name).to.equal('Tasty!')
        Code.expect(user.profile.settings).to.equal('TESTING')
        done()
      })
    })
  })

  lab.test('user1 searches for contacts', (done) => {
    server.inject({
      method: 'POST',
      url: '/api/search/user',
      headers: { 'authorization': user1.token },
      payload: {
        query: ''
      }
    }, (res) => {
      // console.log('res.result=', res.result.result)
      Code.expect(res.result.result.suggestions[0].name).to.equal('Kate Spade')
      done()
    })
  })

  lab.test('user1 searches for `Sp` and finds Kate Spade', (done) => {
    server.inject({
      method: 'POST',
      url: '/api/search/user',
      headers: { 'authorization': user1.token },
      payload: {
        query: 'Sp'
      }
    }, (res) => {
      // console.log('res.result=', res.result.result)
      Code.expect(res.result.result.users[0].name).to.equal('Kate Spade')
      done()
    })
  })

  lab.test('user1 searches for `Spz` and gets stuffed', (done) => {
    server.inject({
      method: 'POST',
      url: '/api/search/user',
      headers: { 'authorization': user1.token },
      payload: {
        query: 'Spz'
      }
    }, (res) => {
      // console.log('res.result=', res.result.result)
      Code.expect(res.result.result.users.length).to.equal(0)
      Code.expect(res.result.result.suggestions[0].name).to.equal('Kate Spade')
      done()
    })
  })

  lab.test('user1 get a starter', (done) => {
    server.inject({
      method: 'GET',
      url: '/api/starter/THB',
      headers: { 'authorization': user1.token }
    }, (res) => {
      // console.log('res.result=', res.result.starter)
      const starter = res.result.starter
      Code.expect(starter.user.id).to.equal(user1.id)
      Code.expect(starter.accounts.length).to.equal(2)
      Code.expect(starter.suggestions.length).to.equal(1)
      Code.expect(starter.history.length).to.equal(3)
      done()
    })
  })

  lab.test('user3 signs up', (done) => {
    server.inject({
      method: 'POST',
      url: '/api/user',
      payload: {
        name: 'Turbo',
        email: 'turbo@base.se'
      }
    }, (res) => {
      // console.log('res.result=', res.result)
      Code.expect(res.result.user.email).to.equal('turbo@base.se')
      user3 = res.result.user
      user3.token = res.result.token
      done()
    })
  })

  lab.test('user3 get a starter', (done) => {
    server.inject({
      method: 'GET',
      url: '/api/starter/THB',
      headers: { 'authorization': user3.token }
    }, (res) => {
      // console.log('res.result=', res.result.starter)
      const starter = res.result.starter
      Code.expect(starter.user.id).to.equal(user3.id)

      // Expects the starter to contain a THB account that was created
      // on-the-fly as part of calling the /api/starter endpoint !
      Code.expect(starter.accounts.length).to.equal(1)
      Code.expect(starter.accounts[0].name).to.equal('THB_1')

      Code.expect(starter.suggestions.length).to.equal(0)
      Code.expect(starter.history.length).to.equal(0)
      done()
    })
  })

  lab.test('user3 renews his token', (done) => {
    server.inject({
      method: 'GET',
      url: '/api/token',
      headers: { 'authorization': user3.token }
    }, (res) => {
      // console.log('new: ', res.result.token)
      // console.log('old: ', user3.token)
      Code.expect(res.result.token).not.to.equal(user3.token)
      Code.expect(res.result.token.length).to.equal(user3.token.length)
      done()
    })
  })
})
