CREATE TABLE comment_accounts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    username VARCHAR(24) NULL,
    username_key VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
    key_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    is_admin TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY comment_accounts_key_hash (key_hash),
    UNIQUE KEY comment_accounts_username_key (username_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE comment_account_sessions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    account_id BIGINT UNSIGNED NOT NULL,
    user_agent VARCHAR(255) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY comment_account_sessions_token (token_hash),
    KEY comment_account_sessions_account (account_id),
    KEY comment_account_sessions_expiry (expires_at),
    CONSTRAINT comment_account_sessions_account_fk FOREIGN KEY (account_id) REFERENCES comment_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE comments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    slug VARCHAR(120) NOT NULL,
    name VARCHAR(60) NOT NULL,
    body TEXT NOT NULL,
    ip_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    parent_id BIGINT UNSIGNED NULL,
    root_id BIGINT UNSIGNED NULL,
    owner_token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    account_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    edited_at DATETIME NULL,
    deleted_at DATETIME NULL,
    hidden_at DATETIME NULL,
    PRIMARY KEY (id),
    KEY comments_slug_root_id (slug, root_id, id),
    KEY comments_rate_limit (ip_hash, created_at),
    KEY comments_account (account_id),
    CONSTRAINT comments_account_fk FOREIGN KEY (account_id) REFERENCES comment_accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE comment_votes (
    comment_id BIGINT UNSIGNED NOT NULL,
    ip_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    value TINYINT NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (comment_id, ip_hash),
    CONSTRAINT comment_votes_comment_fk FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    CONSTRAINT comment_votes_value_check CHECK (value IN (-1, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE comment_reports (
    comment_id BIGINT UNSIGNED NOT NULL,
    ip_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    reason VARCHAR(32) NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (comment_id, ip_hash),
    CONSTRAINT comment_reports_comment_fk FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE comment_notifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    account_id BIGINT UNSIGNED NOT NULL,
    comment_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY comment_notifications_account_comment (account_id, comment_id),
    KEY comment_notifications_unread (account_id, read_at, id),
    CONSTRAINT comment_notifications_account_fk FOREIGN KEY (account_id) REFERENCES comment_accounts(id) ON DELETE CASCADE,
    CONSTRAINT comment_notifications_comment_fk FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE comment_rate_limits (
    rate_key VARCHAR(72) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    bucket BIGINT UNSIGNED NOT NULL,
    attempts INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (rate_key, bucket),
    KEY comment_rate_limits_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
