
# Migration 002.
USE transact_dev;

# --------------------------------------------
# Stats table.
# --------------------------------------------
CREATE TABLE IF NOT EXISTS stats (
  userId BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  stats TEXT
);
