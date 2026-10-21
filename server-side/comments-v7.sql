-- Run once after comments-v6.sql on an existing installation.
-- The reserved username belongs to the existing Elie account; new accounts cannot claim it.
ALTER TABLE comment_accounts
    ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER key_hash;

UPDATE comment_accounts SET is_admin = 1 WHERE username_key = 'elie';
