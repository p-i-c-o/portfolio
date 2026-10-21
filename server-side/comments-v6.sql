-- Run once after comments-v5.sql.
ALTER TABLE comment_account_sessions
    DROP PRIMARY KEY,
    ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST,
    ADD COLUMN user_agent VARCHAR(255) NOT NULL DEFAULT '' AFTER account_id,
    ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER user_agent,
    ADD COLUMN last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER created_at,
    ADD UNIQUE KEY comment_account_sessions_token (token_hash);

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
