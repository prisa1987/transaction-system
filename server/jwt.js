
const Jwt = require('jsonwebtoken')
const Hoek = require('hoek')
const T = require('tcomb')

const JWT_AUDIENCE = 'transact-app'
const JWT_ISSUER = 'transact-app'
const JWT_ALG = ['HS256']

Hoek.assert(
  process.env.TRANSACT_API_SECRET &&
  process.env.TRANSACT_API_SECRET.length > 30,
  'Missing env `TRANSACT_API_SECRET` (> 30 chars)'
)

function createToken (payload) {
  T.Object(payload)
  const opts = {
    expiresIn: '1h',
    audience: JWT_AUDIENCE,
    issuer: JWT_ISSUER
  }
  return Jwt.sign(payload, process.env.TRANSACT_API_SECRET, opts)
}

function verifyToken (token) {
  T.String(token)
  const opts = {
    algorithms: JWT_ALG,
    audience: JWT_AUDIENCE,
    issuer: JWT_ISSUER
  }
  return Jwt.verify(token, process.env.TRANSACT_API_SECRET, opts)
}

function runTest () {
  const Assert = require('assert')
  const token = createToken({ userId: 666 })
  // Test decoding.
  Assert.strictEqual(verifyToken(token).userId, 666)
  // Test failed decode.
  Assert.throws(() => (
    verifyToken(token.substr(1))
  ), /invalid token/)

  console.log('JWT Tests: OK.')
}

module.exports = {
  JWT_ISSUER,
  JWT_AUDIENCE,
  JWT_ALG,
  createToken,
  verifyToken,
  runTest
}
