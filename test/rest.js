'use strict'

const P = require('bluebird')
const Code = require('code')
const Lab = require('lab')
const lab = exports.lab = Lab.script()

const Db = require('./databaseHelper.js')
const server = require('../server/index')

lab.experiment('REST API', () => {
  lab.before((done) => {
    Db.reset().wait(() => done())
  })

  let user1
  let user2

  lab.test('user1 fails to create an account by omitting a name', (done) => {
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

  lab.test('user1 creates an account', (done) => {
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

  lab.test('user1 creates a USD account', (done) => {
    server.inject({
      method: 'POST',
      url: '/api/account',
      headers: { 'authorization': user1.token },
      payload: {
        userId: user1.id,
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
        userId: user1.id,
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
})
