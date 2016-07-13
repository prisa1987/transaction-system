'use strict'

const P = require('bluebird')
const Db = require('../database')

function getAll (userId) {
  return Db.connect().then((conn) => get(conn, userId))
}

function deleteTestStats () {
  return Db.query('DELETE FROM stats WHERE userId < 10')
}

function updateTransferStats (userId, accountId) {
  return Db.transaction((conn) => _updateStats(conn, userId, accountId))
}

const _updateStats = P.coroutine(function * (conn, userId, accountId) {
  const st = yield get(conn, userId)
  const stats = st && st.stats || {
    transfers: []
  }

  // Recaluate stats.
  const stat = stats.transfers.find((x) => x.id === accountId)
  if (stat) {
    stat.count++
  } else {
    stats.transfers.push({ id: accountId, count: 1 })
  }
  stats.transfers.sort((a, b) => a.count < b.count)
  stats.transfers = stats.transfers.slice(0, 20)

  if (!st) {
    yield insert(conn, userId, stats)
  } else {
    yield update(conn, userId, stats)
  }

  yield conn.commitAsync()
})

function get (conn, userId) {
  return conn.queryAsync(
    'SELECT * FROM stats WHERE userId = ? FOR UPDATE',
    [userId]
  )
  .then(([st]) => {
    if (st && st.stats) {
      st.stats = JSON.parse(st.stats)
    }
    return st
  })
}

function insert (conn, userId, stats) {
  return conn.queryAsync(
    'INSERT INTO stats SET userId = ?, stats = ?',
    [userId, JSON.stringify(stats)]
  )
}

function update (conn, userId, stats) {
  return conn.queryAsync(
    'UPDATE stats SET stats = ? WHERE userId = ?',
    [JSON.stringify(stats), userId]
  )
}

module.exports = {
  getAll,
  updateTransferStats,
  deleteTestStats
}
