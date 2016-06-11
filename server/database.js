'use strict'

const P = require('bluebird')
const Mysql = require('mysql')

P.promisifyAll(Mysql)
P.promisifyAll(require('mysql/lib/Connection').prototype)
P.promisifyAll(require('mysql/lib/Pool').prototype)

const Db = {
  _pool: null,
  _stats: {
    connectedToPool: 0,
    waitingForConnection: 0,
    failedTransactions: 0,
    retriedTransactions: 0,
    deadlocks: 0
  },

  connect () {
    if (this._pool) {
      return this._pool.getConnectionAsync()
    }
    const host = process.env.TRANSACT_MYSQL_HOST || 'localhost'
    const port = process.env.TRANSACT_MYSQL_PORT || 3306
    const database = process.env.TRANSACT_MYSQL_DB
    const user = process.env.TRANSACT_MYSQL_USER
    const password = process.env.TRANSACT_MYSQL_PASS

    this._pool = Mysql.createPool({
      connectionLimit: 20,
      host,
      port,
      user,
      password,
      database,
      supportBigNumbers: true,
      bigNumberStrings: true
    })

    this._pool.on('connection', (conn) => {
      this._stats.connectedToPool++
      // console.log('Connected to pool.')
    })
    this._pool.on('enqueue', () => {
      this._stats.waitingForConnection++
      // console.log('Waiting for available connection slot')
    })

    return this._pool.getConnectionAsync()
    .tap((conn) => console.log('Connected to MySQL:', conn.threadId))
    .catch((reason) => console.error('Could not connect to MySQL:', reason))
  },

  query (sql, params) {
    return this.connect().then((conn) => (
      conn.queryAsync(sql, params)
      .tap(() => conn.release())
    ))
  },

  transaction (func, opts = { }) {
    return this.connect().then((conn) => (
      conn.beginTransactionAsync()
      .then(() => func(conn))
      .catch((reason) => {
        conn.rollback()
        if (reason.code === 'ER_LOCK_DEADLOCK') {
          this._stats.deadlocks++
          if (!opts.retries) {
            opts.retries = 0
          }
          if (++opts.retries <= 10) {
            this._stats.retriedTransactions++
            // console.log('Deadlock found. Retrying transaction ..')
            return this.transaction(func, opts)
          }
        }
        this._stats.failedTransactions++
        // console.error('MySQL transaction error, rolling back.')
        throw reason
      })
      .finally(() => {
        // console.error('MySQL release connection.')
        conn.release()
      })
    ))
  },

  findOne (sql, params) {
    return this.query(sql, params).then((res) => res[0] || null)
  },

  getStats () {
    return this._stats
  }
}

module.exports = Db
