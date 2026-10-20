-- Run once after comments-v2.sql. Existing likes become upvotes.
RENAME TABLE comment_likes TO comment_votes;

ALTER TABLE comment_votes
    ADD COLUMN value TINYINT NOT NULL DEFAULT 1 AFTER ip_hash,
    ADD CONSTRAINT comment_votes_value_check CHECK (value IN (-1, 1));
