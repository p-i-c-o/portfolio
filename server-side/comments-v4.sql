-- Run once after comments-v3.sql. Existing comments remain anonymous until claimed.
CREATE TABLE comment_accounts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    key_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY comment_accounts_key_hash (key_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE comment_account_sessions (
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    account_id BIGINT UNSIGNED NOT NULL,
    expires_at DATETIME NOT NULL,
    PRIMARY KEY (token_hash),
    KEY comment_account_sessions_account (account_id),
    KEY comment_account_sessions_expiry (expires_at),
    CONSTRAINT comment_account_sessions_account_fk FOREIGN KEY (account_id) REFERENCES comment_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE comments
    ADD COLUMN account_id BIGINT UNSIGNED NULL AFTER owner_token_hash,
    ADD KEY comments_account (account_id),
    ADD CONSTRAINT comments_account_fk FOREIGN KEY (account_id) REFERENCES comment_accounts(id) ON DELETE SET NULL;
