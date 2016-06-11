'use strict'

const Hapi = require('hapi')
const Hoek = require('hoek')
const Fs = require('fs')

const IS_PRODUCTION = process.env.NODE_ENV === 'production'

Hoek.assert(process.env.TRANSACT_HOST, 'Missing env `TRANSACT_HOST`')
if (IS_PRODUCTION) {
  Hoek.assert(process.env.TRANSACT_TLS_CERT, 'Missing env `TRANSACT_TLS_CERT`')
  Hoek.assert(process.env.TRANSACT_TLS_PRIVKEY, 'Missing env `TRANSACT_TLS_PRIVKEY`')
}

// JWT Tokens.
const Jwt = require('./jwt')
Jwt.runTest()

// Connect to MySQL.
const Db = require('./database.js')
Db.query('SELECT NOW() as nowgdamitnow').then((rows) => (
  console.log('MySQL select now test ok:', rows[0].nowgdamitnow)
))

createServer()

function createServer () {
  const server = new Hapi.Server()
  const tls = IS_PRODUCTION ? {
    key: Fs.readFileSync(process.env.TRANSACT_TLS_PRIVKEY),
    cert: Fs.readFileSync(process.env.TRANSACT_TLS_CERT)
  } : null

  server.connection({
    host: process.env.TRANSACT_HOST,
    port: 3991,
    tls
  })

  registerPlugins(server, () => {
    setupRoutes(server)
    startServer(server)
  })
}

function setupRoutes (server) {
  server.route({
    method: 'GET',
    path: '/',
    handler: function (request, reply) {
      reply.view('app.html')
    }
  })

  server.route({
    method: 'GET',
    path: '/test',
    handler: function (request, reply) {
      require('./service')
      .sanityTest()
      .then(() => reply({ ok: 1 }))
      .catch((reason) => {
        console.error('Error:', reason)
        reply({ error: reason }).code(400)
      })
    }
  })

  require('./endpoints')(server)
}

function registerPlugins (server, done) {
  const goodPlugin = {
    register: require('good'),
    options: {
      reporters: {
        console: [{
          module: 'good-squeeze',
          name: 'Squeeze',
          args: [{
            response: '*',
            log: '*'
          }]
        },
          {
            module: 'good-console'
          }, 'stdout'
        ]
      }
    }
  }

  server.register([
    goodPlugin,               // Logging.
    require('vision'),        // Views, templates and layouts.
    require('inert'),         // Serve static files.
    require('hapi-auth-jwt2') // Use JWT tokens as part of our authentication strategy.
  ], (err) => {
    Hoek.assert(!err, err)

    // Setup our auth strategy.
    setupAuth(server)

    server.views({
      engines: {
        html: require('handlebars')
      },
      relativeTo: __dirname,
      path: './templates',
      layout: true,
      layoutPath: './templates/layouts'
    })

    done()
  })
}

function setupAuth (server) {
  const users = {
    '[TESTUSER]': 1
  }

  server.auth.strategy('jwt', 'jwt', {
    key: process.env.TRANSACT_API_SECRET,
    // Custom token validation function.
    validateFunc: (decoded, request, callback) => {
      // Do your checks to see if the person is valid.
      if (!users[decoded.id]) {
        // Failed !
        return callback(null, false)
      }
      // Passed ok.
      callback(null, true)
    },
    verifyOptions: { algorithms: Jwt.JWT_ALG }
  })

  server.auth.default('jwt')

  server.route([
    {
      method: 'GET', path: '/public', config: { auth: false },
      handler: (request, reply) => {
        reply({ text: 'Token not required.' })
      }
    },
    {
      method: 'GET', path: '/test-token', config: { auth: false },
      handler: (request, reply) => {
        reply({
          token: Jwt.createToken({ id: '[TESTUSER]' })
        })
      }
    },
    {
      method: 'GET', path: '/restricted', config: { auth: 'jwt' },
      handler: (request, reply) => {
        reply({ text: 'You used a valid token.' })
        .header('Authorization', request.headers.authorization)
      }
    }
  ])
}

function startServer (server) {
  server.start((err) => {
    if (err) {
      throw err
    }
    console.log('Server running at:', server.info.uri)
  })
}
