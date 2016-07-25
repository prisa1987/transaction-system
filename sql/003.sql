USE transact_dev;
ALTER TABLE transaction_log ADD status INT UNSIGNED NOT NULL DEFAULT 3;
ALTER TABLE transaction_log ADD description VARCHAR(255) NOT NULL DEFAULT '';
