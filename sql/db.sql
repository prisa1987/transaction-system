
CREATE DATABASE IF NOT EXISTS transact_dev;
GRANT ALL ON transact_dev.* TO 'transact'@'localhost' IDENTIFIED BY 'transact';

USE transact_dev;

# NOTE: The absence of foreign key constraints and cascade rules
# is entirely deliberate. Don’t go there.

# --------------------------------------------
# Users.
# --------------------------------------------
DROP TABLE IF EXISTS user;
CREATE TABLE user (
  id BIGINT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL DEFAULT '',
  email VARCHAR(128) NOT NULL,
  isInternal BOOLEAN NOT NULL DEFAULT false,
  isEnabled BOOLEAN NOT NULL DEFAULT true,
  created TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(email)
);

# --------------------------------------------
# Big Popa is our system user.
# --------------------------------------------
INSERT INTO user VALUES (
  10, '[BIGPOPA]', 'bigpopa_internal@transact.com', true, true, NULL
);

# --------------------------------------------
# Keep passwords and token separate.
# --------------------------------------------
DROP TABLE IF EXISTS passwords;
CREATE TABLE passwords (
  userId BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  salt VARCHAR(255) NOT NULL,
  hashedPassword VARCHAR(255) NOT NULL,
  updated TIMESTAMP NOT NULL DEFAULT NOW()
);

# --------------------------------------------
# Accounts of various types and currencies.
# --------------------------------------------
DROP TABLE IF EXISTS account;
CREATE TABLE account (
  id BIGINT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
  userId BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL DEFAULT '',
  type INT UNSIGNED NOT NULL DEFAULT 0,
  isInternal BOOLEAN NOT NULL DEFAULT false,
  created TIMESTAMP NOT NULL DEFAULT NOW(),
  balance BIGINT UNSIGNED NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  INDEX(userId)
) AUTO_INCREMENT=10000;

# --------------------------------------------
# Internal accounts.
# --------------------------------------------
INSERT INTO account VALUES (1, 10, 'THE_THIN_AIR', 10, true, NULL, 0, 'USD');
INSERT INTO account VALUES (100, 10, 'WORLD', 10, true, NULL, 0, 'USD');
INSERT INTO account VALUES (101, 10, 'HOUSE', 10, true, NULL, 0, 'USD');

# --------------------------------------------
# The ledger.
# --------------------------------------------
DROP TABLE IF EXISTS transaction_log;
CREATE TABLE transaction_log (
  id BIGINT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
  fromAccountId BIGINT UNSIGNED NOT NULL,
  toAccountId BIGINT UNSIGNED NOT NULL,
  amount BIGINT SIGNED NOT NULL DEFAULT 0,
  created TIMESTAMP NOT NULL DEFAULT NOW(),
  type INT UNSIGNED NOT NULL DEFAULT 0,
  INDEX(fromAccountId),
  INDEX(toAccountId)
);

# --------------------------------------------
# All the riches of the world.
# Created out of thin air.
# --------------------------------------------
INSERT INTO transaction_log VALUES (
  1, 1, 100, 100000000000000, NULL, 10
);
UPDATE account SET balance = 100000000000000 WHERE id = 100;

source 001.sql
source 002.sql
source 003.sql
