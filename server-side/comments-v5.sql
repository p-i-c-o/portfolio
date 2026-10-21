-- Run once after comments-v4.sql. Existing accounts choose a username on next sign-in.
ALTER TABLE comment_accounts
    ADD COLUMN username VARCHAR(24) NULL AFTER id,
    ADD COLUMN username_key VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER username,
    ADD UNIQUE KEY comment_accounts_username_key (username_key);
