-- Run once on a database created with the original comments.sql.
-- Existing comments stay as top-level comments. They have no owner token.
ALTER TABLE comments
    ADD COLUMN parent_id BIGINT UNSIGNED NULL,
    ADD COLUMN root_id BIGINT UNSIGNED NULL,
    ADD COLUMN owner_token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    ADD COLUMN edited_at DATETIME NULL,
    ADD COLUMN deleted_at DATETIME NULL,
    ADD COLUMN hidden_at DATETIME NULL,
    ADD KEY comments_slug_root_id (slug, root_id, id);

CREATE TABLE comment_likes (
    comment_id BIGINT UNSIGNED NOT NULL,
    ip_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (comment_id, ip_hash),
    CONSTRAINT comment_likes_comment_fk FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE comment_reports (
    comment_id BIGINT UNSIGNED NOT NULL,
    ip_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    reason VARCHAR(32) NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (comment_id, ip_hash),
    CONSTRAINT comment_reports_comment_fk FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
