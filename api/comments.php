<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(int $status, array $data): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function valid_slug(mixed $slug): bool
{
    return is_string($slug)
        && (bool) preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $slug)
        && strlen($slug) <= 120
        && is_file(dirname(__DIR__) . '/blog/' . $slug . '/index.html');
}

function positive_id(mixed $value): ?int
{
    return is_int($value) && $value > 0 ? $value : null;
}

function query_offset(): int
{
    $offset = filter_input(INPUT_GET, 'offset', FILTER_VALIDATE_INT, [
        'options' => ['default' => 0, 'min_range' => 0, 'max_range' => 10000],
    ]);
    if ($offset === false || $offset === null) respond(400, ['error' => 'Invalid offset.']);
    return $offset;
}

function database(): array
{
    $path = getenv('COMMENTS_CONFIG_PATH') ?: dirname(__DIR__, 3) . '/.monnickendam-comments.ini';
    $config = @parse_ini_file($path);
    foreach (['db_host', 'db_name', 'db_user', 'db_password', 'hash_secret'] as $key) {
        if (!is_array($config) || !isset($config[$key]) || !is_string($config[$key]) || $config[$key] === '') {
            throw new RuntimeException('Comments are not configured');
        }
    }
    if (!preg_match('/^[a-f0-9]{64}$/i', $config['hash_secret'])) {
        throw new RuntimeException('Invalid comments secret');
    }
    $pdo = new PDO(
        'mysql:host=' . $config['db_host'] . ';dbname=' . $config['db_name'] . ';charset=utf8mb4',
        $config['db_user'],
        $config['db_password'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
    return [$pdo, $config['hash_secret']];
}

function visitor_hash(string $secret): string
{
    return hash_hmac('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown', $secret);
}

function account_key_hash(string $key, string $secret): string
{
    return hash_hmac('sha256', 'account-key:' . $key, $secret);
}

function account_vote_hash(int $accountId, string $secret): string
{
    return hash_hmac('sha256', 'account-vote:' . $accountId, $secret);
}

function current_session(PDO $pdo): ?array
{
    $cookie = $_COOKIE['comment_account'] ?? null;
    if (!is_string($cookie) || !preg_match('/^[a-f0-9]{64}$/D', $cookie)) return null;
    $query = $pdo->prepare('SELECT id, account_id FROM comment_account_sessions WHERE token_hash = ? AND expires_at > UTC_TIMESTAMP()');
    $query->execute([hash('sha256', $cookie)]);
    $session = $query->fetch();
    if (!$session) return null;
    $pdo->prepare('UPDATE comment_account_sessions SET last_seen_at = UTC_TIMESTAMP() WHERE id = ? AND last_seen_at < UTC_TIMESTAMP() - INTERVAL 1 HOUR')
        ->execute([(int) $session['id']]);
    return ['id' => (int) $session['id'], 'account_id' => (int) $session['account_id']];
}

function account_id(PDO $pdo): ?int
{
    return current_session($pdo)['account_id'] ?? null;
}

function set_account_cookie(string $token, int $expires): void
{
    $localDevelopment = in_array($_SERVER['SERVER_NAME'] ?? '', ['localhost', '127.0.0.1'], true);
    setcookie('comment_account', $token, [
        'expires' => $expires,
        'path' => '/',
        'secure' => !$localDevelopment,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}

function start_account_session(PDO $pdo, int $accountId): void
{
    $oldToken = $_COOKIE['comment_account'] ?? null;
    if (is_string($oldToken) && preg_match('/^[a-f0-9]{64}$/D', $oldToken)) {
        $query = $pdo->prepare('DELETE FROM comment_account_sessions WHERE token_hash = ?');
        $query->execute([hash('sha256', $oldToken)]);
    }
    if (random_int(1, 100) === 1) {
        $pdo->exec('DELETE FROM comment_account_sessions WHERE expires_at < UTC_TIMESTAMP() LIMIT 100');
    }
    $token = bin2hex(random_bytes(32));
    $expires = time() + 90 * 86400;
    $query = $pdo->prepare('INSERT INTO comment_account_sessions (token_hash, account_id, user_agent, expires_at) VALUES (?, ?, ?, FROM_UNIXTIME(?))');
    $query->execute([hash('sha256', $token), $accountId, mb_substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255), $expires]);
    set_account_cookie($token, $expires);
}

function require_account(PDO $pdo): int
{
    $id = account_id($pdo);
    if ($id === null) respond(401, ['error' => 'Sign in to your comment account first.']);
    return $id;
}

function is_admin(PDO $pdo, int $accountId): bool
{
    $query = $pdo->prepare('SELECT is_admin FROM comment_accounts WHERE id = ?');
    $query->execute([$accountId]);
    return (int) $query->fetchColumn() === 1;
}

function require_admin(PDO $pdo): int
{
    $accountId = require_account($pdo);
    if (!is_admin($pdo, $accountId)) respond(403, ['error' => 'Admin access required.']);
    return $accountId;
}

function account_username(PDO $pdo, int $accountId): ?string
{
    $query = $pdo->prepare('SELECT username FROM comment_accounts WHERE id = ?');
    $query->execute([$accountId]);
    $name = $query->fetchColumn();
    return $name === false || $name === null ? null : (string) $name;
}

function valid_username(mixed $value): array
{
    if (!is_string($value)) respond(400, ['error' => 'Choose a username of 3–24 letters, numbers, or underscores.']);
    $name = trim($value);
    if (!preg_match('/^[A-Za-z][A-Za-z0-9_]{2,23}$/D', $name)) {
        respond(400, ['error' => 'Use 3–24 characters, starting with a letter; letters, numbers, and underscores only.']);
    }
    $key = strtolower($name);
    if (in_array($key, ['admin', 'administrator', 'mod', 'moderator', 'system', 'support', 'deleted', 'anonymous', 'elie'], true)) {
        respond(400, ['error' => 'That username is reserved.']);
    }
    return [$name, $key];
}

function submission_token(string $slug, string $ipHash, string $secret): string
{
    $issued = (string) time();
    return $issued . '.' . hash_hmac('sha256', $slug . ':' . $issued . ':' . $ipHash, $secret);
}

function valid_submission_token(mixed $token, string $slug, string $ipHash, string $secret): bool
{
    if (!is_string($token) || !preg_match('/^([0-9]{10})\.([a-f0-9]{64})$/D', $token, $parts)) {
        return false;
    }
    $age = time() - (int) $parts[1];
    return $age >= 3 && $age <= 7200
        && hash_equals(hash_hmac('sha256', $slug . ':' . $parts[1] . ':' . $ipHash, $secret), $parts[2]);
}

function count_attempt(PDO $pdo, string $key, int $bucket): int
{
    $query = $pdo->prepare(
        'INSERT INTO comment_rate_limits (rate_key, bucket, attempts, created_at) '
        . 'VALUES (?, ?, 1, UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE attempts = attempts + 1'
    );
    $query->execute([$key, $bucket]);
    $query = $pdo->prepare('SELECT attempts FROM comment_rate_limits WHERE rate_key = ? AND bucket = ?');
    $query->execute([$key, $bucket]);
    return (int) $query->fetchColumn();
}

function check_rate_limits(PDO $pdo, string $ipHash, string $category): void
{
    $limits = [
        'all' => ['a', 100, 500],
        'comment' => ['c', 8, 30],
        'edit' => ['e', 20, 60],
        'vote' => ['v', 60, 200],
        'report' => ['r', 10, 20],
        'account_create' => ['ac', 2, 5],
        'account_login' => ['al', 8, 30],
        'account_claim' => ['acl', 10, 30],
        'account_settings' => ['as', 5, 20],
        'username_lookup' => ['ul', 30, 100],
        'account_export' => ['ax', 5, 20],
    ];
    [$prefix, $quarterHourLimit, $dayLimit] = $limits[$category];
    $now = time();
    foreach ([
        [$prefix . '15:' . $ipHash, intdiv($now, 900), $quarterHourLimit],
        [$prefix . 'day:' . $ipHash, intdiv($now, 86400), $dayLimit],
    ] as [$key, $bucket, $limit]) {
        if (count_attempt($pdo, $key, $bucket) > $limit) {
            header('Retry-After: 900');
            respond(429, ['error' => 'Too many attempts. Please try again later.']);
        }
    }
    if ($category === 'all' && count_attempt($pdo, 'global', intdiv($now, 3600)) > 2000) {
        header('Retry-After: 900');
        respond(429, ['error' => 'Comments are busy. Please try again later.']);
    }
    if ($category === 'all' && random_int(1, 100) === 1) {
        $pdo->exec('DELETE FROM comment_rate_limits WHERE created_at < UTC_TIMESTAMP() - INTERVAL 2 DAY LIMIT 100');
    }
}

function comment_fields(PDO $pdo, string $slug, string $voteHash, string $ipHash, ?int $accountId, ?int $rootId, int $offset, string $sort): array
{
    $sql = 'SELECT c.id, c.parent_id, c.root_id, COALESCE(a.username, c.name) AS name, a.username AS profile_username, c.body, c.created_at, c.edited_at, '
        . 'c.deleted_at, c.hidden_at, (c.account_id = ?) AS owned_by_me, COALESCE(pa.username, p.name) AS reply_to_name, p.deleted_at AS reply_to_deleted_at, '
        . 'p.hidden_at AS reply_to_hidden_at, '
        . '(SELECT COALESCE(SUM(v.value), 0) FROM comment_votes v WHERE v.comment_id = c.id) AS score, '
        . '(SELECT COUNT(*) FROM comments r WHERE r.root_id = c.id) AS reply_count, '
        . '(SELECT v.value FROM comment_votes v WHERE v.comment_id = c.id AND v.ip_hash = ?) AS user_vote, '
        . 'EXISTS(SELECT 1 FROM comment_reports r WHERE r.comment_id = c.id AND r.ip_hash = ?) AS reported_by_me '
        . 'FROM comments c LEFT JOIN comments p ON p.id = c.parent_id '
        . 'LEFT JOIN comment_accounts a ON a.id = c.account_id '
        . 'LEFT JOIN comment_accounts pa ON pa.id = p.account_id WHERE c.slug = ? AND ';
    $sql .= $rootId === null ? 'c.root_id IS NULL ' : 'c.root_id = ? ';
    if ($rootId === null) {
        $sql .= $sort === 'top' ? 'ORDER BY score DESC, c.id DESC ' : 'ORDER BY c.id DESC ';
    } else {
        // Parent comments must arrive before their children for paginated threads.
        $sql .= 'ORDER BY c.id ASC ';
    }
    $sql .= 'LIMIT 21 OFFSET ?';
    $query = $pdo->prepare($sql);
    $query->bindValue(1, $accountId, $accountId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
    $query->bindValue(2, $voteHash);
    $query->bindValue(3, $ipHash);
    $query->bindValue(4, $slug);
    if ($rootId === null) {
        $query->bindValue(5, $offset, PDO::PARAM_INT);
    } else {
        $query->bindValue(5, $rootId, PDO::PARAM_INT);
        $query->bindValue(6, $offset, PDO::PARAM_INT);
    }
    $query->execute();
    $rows = $query->fetchAll();
    $hasMore = count($rows) > 20;
    return [array_map('public_comment', array_slice($rows, 0, 20)), $hasMore];
}

function public_comment(array $row): array
{
    $deleted = $row['deleted_at'] !== null;
    $hidden = $row['hidden_at'] !== null;
    $replyToName = $row['reply_to_name'];
    if ($row['reply_to_deleted_at'] !== null) $replyToName = 'Deleted';
    if ($row['reply_to_hidden_at'] !== null) $replyToName = 'Hidden';
    return [
        'id' => (int) $row['id'],
        'parent_id' => $row['parent_id'] === null ? null : (int) $row['parent_id'],
        'root_id' => $row['root_id'] === null ? null : (int) $row['root_id'],
        'reply_to_name' => $replyToName,
        'name' => $deleted ? 'Deleted' : ($hidden ? 'Hidden' : $row['name']),
        'profile_username' => ($deleted || $hidden) ? null : $row['profile_username'],
        'body' => ($deleted || $hidden) ? '' : $row['body'],
        'created_at' => str_replace(' ', 'T', $row['created_at']) . 'Z',
        'edited_at' => $row['edited_at'] === null ? null : str_replace(' ', 'T', $row['edited_at']) . 'Z',
        'deleted' => $deleted,
        'hidden' => $hidden,
        'score' => (int) $row['score'],
        'user_vote' => $row['user_vote'] === null ? 0 : (int) $row['user_vote'],
        'reported_by_me' => (bool) $row['reported_by_me'],
        'owned_by_me' => (bool) $row['owned_by_me'],
        'reply_count' => (int) $row['reply_count'],
    ];
}

function json_body(): array
{
    if (!preg_match('~^application/json(?:\s*;|$)~i', $_SERVER['CONTENT_TYPE'] ?? '')) {
        respond(415, ['error' => 'Expected JSON.']);
    }
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 8192) {
        respond(413, ['error' => 'Request is too long.']);
    }
    $raw = file_get_contents('php://input', false, null, 0, 8193);
    if ($raw === false || strlen($raw) > 8192) respond(413, ['error' => 'Request is too long.']);
    $body = json_decode($raw, true);
    if (!is_array($body)) respond(400, ['error' => 'Invalid request.']);
    return $body;
}

function validate_comment(mixed $name, mixed $body): array
{
    if (!is_string($name) || !is_string($body)) respond(400, ['error' => 'Invalid comment.']);
    $name = trim($name);
    $body = trim($body);
    if (mb_strlen($name) < 1 || mb_strlen($name) > 60 || mb_strlen($body) < 2 || mb_strlen($body) > 1000) {
        respond(400, ['error' => 'Use a name of up to 60 characters and a comment of 2–1000 characters.']);
    }
    if (preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $name . $body)
        || str_contains($name, "\n") || str_contains($name, "\r")) {
        respond(400, ['error' => 'Comment contains invalid characters.']);
    }
    if (preg_match('~https?://|www\.~i', $name) || preg_match_all('~https?://|www\.~i', $body) > 2) {
        respond(400, ['error' => 'Please remove links from the name and use at most two links in the comment.']);
    }
    return [$name, $body];
}

function existing_comment(PDO $pdo, int $id, string $slug): array
{
    $query = $pdo->prepare('SELECT * FROM comments WHERE id = ? AND slug = ?');
    $query->execute([$id, $slug]);
    $comment = $query->fetch();
    if (!$comment) respond(404, ['error' => 'Comment not found.']);
    return $comment;
}

function check_owner(array $comment, mixed $token, ?int $accountId): void
{
    $byAccount = $accountId !== null && $comment['account_id'] !== null && (int) $comment['account_id'] === $accountId;
    $byToken = $comment['account_id'] === null && is_string($token) && preg_match('/^[a-f0-9]{64}$/D', $token)
        && $comment['owner_token_hash'] !== null
        && hash_equals($comment['owner_token_hash'], hash('sha256', $token));
    if (!$byAccount && !$byToken) {
        respond(403, ['error' => 'This browser cannot change that comment.']);
    }
    if ($comment['deleted_at'] !== null || $comment['hidden_at'] !== null) {
        respond(409, ['error' => 'This comment can no longer be changed.']);
    }
}

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if (!in_array($method, ['GET', 'POST', 'PATCH', 'DELETE'], true)) {
    header('Allow: GET, POST, PATCH, DELETE');
    respond(405, ['error' => 'Method not allowed.']);
}

try {
    if ($method === 'GET') {
        if (isset($_GET['username_available'])) {
            [$username, $usernameKey] = valid_username($_GET['username_available']);
            [$pdo, $secret] = database();
            check_rate_limits($pdo, visitor_hash($secret), 'username_lookup');
            $query = $pdo->prepare('SELECT id FROM comment_accounts WHERE username_key = ?');
            $query->execute([$usernameKey]);
            respond(200, ['username' => $username, 'available' => $query->fetchColumn() === false]);
        }
        if (($_GET['account'] ?? null) === '1') {
            [$pdo] = database();
            $accountId = account_id($pdo);
            if ($accountId === null) respond(200, ['signed_in' => false]);
            $query = $pdo->prepare('SELECT username, created_at, is_admin FROM comment_accounts WHERE id = ?');
            $query->execute([$accountId]);
            $account = $query->fetch();
            $query = $pdo->prepare('SELECT COUNT(*) FROM comments WHERE account_id = ? AND deleted_at IS NULL');
            $query->execute([$accountId]);
            $commentCount = (int) $query->fetchColumn();
            $query = $pdo->prepare('SELECT COUNT(*) FROM comment_account_sessions WHERE account_id = ? AND expires_at > UTC_TIMESTAMP()');
            $query->execute([$accountId]);
            $sessionCount = (int) $query->fetchColumn();
            $query = $pdo->prepare('SELECT COUNT(*) FROM comment_notifications WHERE account_id = ? AND read_at IS NULL');
            $query->execute([$accountId]);
            respond(200, [
                'signed_in' => true,
                'username' => $account['username'],
                'is_admin' => (bool) $account['is_admin'],
                'created_at' => str_replace(' ', 'T', $account['created_at']) . 'Z',
                'comment_count' => $commentCount,
                'session_count' => $sessionCount,
                'unread_count' => (int) $query->fetchColumn(),
            ]);
        }
        if (($_GET['admin_comments'] ?? null) === '1') {
            [$pdo] = database();
            require_admin($pdo);
            $filter = $_GET['filter'] ?? 'reported';
            if (!in_array($filter, ['reported', 'all'], true)) respond(400, ['error' => 'Invalid filter.']);
            $sql = 'SELECT c.id, c.slug, c.body, c.created_at, c.deleted_at, c.hidden_at, '
                . 'COALESCE(a.username, c.name) AS name, COALESCE(r.report_count, 0) AS report_count, '
                . 'COALESCE(r.spam_count, 0) AS spam_count, COALESCE(r.harassment_count, 0) AS harassment_count, '
                . 'COALESCE(r.other_count, 0) AS other_count '
                . 'FROM comments c LEFT JOIN comment_accounts a ON a.id = c.account_id '
                . 'LEFT JOIN (SELECT comment_id, COUNT(*) AS report_count, '
                . "SUM(reason = 'spam') AS spam_count, SUM(reason = 'harassment') AS harassment_count, "
                . "SUM(reason = 'other') AS other_count FROM comment_reports GROUP BY comment_id) r ON r.comment_id = c.id "
                . ($filter === 'reported' ? 'WHERE r.comment_id IS NOT NULL ' : '')
                . 'ORDER BY c.id DESC LIMIT 21 OFFSET ?';
            $query = $pdo->prepare($sql);
            $query->bindValue(1, query_offset(), PDO::PARAM_INT);
            $query->execute();
            $rows = $query->fetchAll();
            respond(200, ['comments' => array_slice($rows, 0, 20), 'has_more' => count($rows) > 20]);
        }
        if (isset($_GET['profile'])) {
            $requested = $_GET['profile'];
            if (!is_string($requested) || !preg_match('/^[A-Za-z][A-Za-z0-9_]{2,23}$/D', $requested)) {
                respond(400, ['error' => 'Invalid username.']);
            }
            [$pdo, $secret] = database();
            $query = $pdo->prepare('SELECT id, username, created_at FROM comment_accounts WHERE username_key = ? AND username IS NOT NULL');
            $query->execute([strtolower($requested)]);
            $account = $query->fetch();
            if (!$account) respond(404, ['error' => 'Profile not found.']);
            $accountId = (int) $account['id'];
            $query = $pdo->prepare('SELECT COUNT(*) FROM comments WHERE account_id = ? AND deleted_at IS NULL AND hidden_at IS NULL');
            $query->execute([$accountId]);
            $count = (int) $query->fetchColumn();
            $query = $pdo->prepare('SELECT slug, id, LEFT(body, 180) AS excerpt, created_at FROM comments '
                . 'WHERE account_id = ? AND deleted_at IS NULL AND hidden_at IS NULL ORDER BY id DESC LIMIT 21 OFFSET ?');
            $query->bindValue(1, $accountId, PDO::PARAM_INT);
            $query->bindValue(2, query_offset(), PDO::PARAM_INT);
            $query->execute();
            $rows = $query->fetchAll();
            respond(200, [
                'username' => $account['username'],
                'created_at' => str_replace(' ', 'T', $account['created_at']) . 'Z',
                'comment_count' => $count,
                'avatar_seed' => substr(hash_hmac('sha256', 'avatar:' . $accountId, $secret), 0, 20),
                'comments' => array_slice($rows, 0, 20),
                'has_more' => count($rows) > 20,
            ]);
        }
        if (($_GET['my_comments'] ?? null) === '1') {
            [$pdo] = database();
            $accountId = require_account($pdo);
            $query = $pdo->prepare('SELECT slug, id, body, created_at, edited_at, deleted_at, hidden_at FROM comments '
                . 'WHERE account_id = ? ORDER BY id DESC LIMIT 21 OFFSET ?');
            $query->bindValue(1, $accountId, PDO::PARAM_INT);
            $query->bindValue(2, query_offset(), PDO::PARAM_INT);
            $query->execute();
            $rows = $query->fetchAll();
            respond(200, ['comments' => array_slice($rows, 0, 20), 'has_more' => count($rows) > 20]);
        }
        if (($_GET['inbox'] ?? null) === '1') {
            [$pdo] = database();
            $accountId = require_account($pdo);
            $query = $pdo->prepare('SELECT n.id, n.created_at, n.read_at, c.slug, c.id AS comment_id, '
                . 'c.deleted_at, c.hidden_at, LEFT(c.body, 180) AS excerpt, COALESCE(a.username, c.name) AS actor_name '
                . 'FROM comment_notifications n JOIN comments c ON c.id = n.comment_id '
                . 'LEFT JOIN comment_accounts a ON a.id = c.account_id '
                . 'WHERE n.account_id = ? ORDER BY n.id DESC LIMIT 21 OFFSET ?');
            $query->bindValue(1, $accountId, PDO::PARAM_INT);
            $query->bindValue(2, query_offset(), PDO::PARAM_INT);
            $query->execute();
            $rows = $query->fetchAll();
            respond(200, ['notifications' => array_slice($rows, 0, 20), 'has_more' => count($rows) > 20]);
        }
        if (($_GET['sessions'] ?? null) === '1') {
            [$pdo] = database();
            $session = current_session($pdo);
            if ($session === null) respond(401, ['error' => 'Sign in to your comment account first.']);
            $query = $pdo->prepare('SELECT id, user_agent, created_at, last_seen_at, expires_at FROM comment_account_sessions '
                . 'WHERE account_id = ? AND expires_at > UTC_TIMESTAMP() ORDER BY last_seen_at DESC');
            $query->execute([$session['account_id']]);
            $sessions = array_map(static fn(array $row): array => [
                'id' => (int) $row['id'],
                'user_agent' => $row['user_agent'],
                'created_at' => str_replace(' ', 'T', $row['created_at']) . 'Z',
                'last_seen_at' => str_replace(' ', 'T', $row['last_seen_at']) . 'Z',
                'expires_at' => str_replace(' ', 'T', $row['expires_at']) . 'Z',
                'current' => (int) $row['id'] === $session['id'],
            ], $query->fetchAll());
            respond(200, ['sessions' => $sessions]);
        }
        if (($_GET['account_export'] ?? null) === '1') {
            [$pdo, $secret] = database();
            $accountId = require_account($pdo);
            check_rate_limits($pdo, visitor_hash($secret), 'account_export');
            $query = $pdo->prepare('SELECT username, created_at FROM comment_accounts WHERE id = ?');
            $query->execute([$accountId]);
            $account = $query->fetch();
            $query = $pdo->prepare('SELECT id, slug, parent_id, name, body, created_at, edited_at, deleted_at, hidden_at '
                . 'FROM comments WHERE account_id = ? ORDER BY id ASC');
            $query->execute([$accountId]);
            $comments = $query->fetchAll();
            $query = $pdo->prepare('SELECT comment_id, value, created_at FROM comment_votes WHERE ip_hash = ? ORDER BY created_at ASC');
            $query->execute([account_vote_hash($accountId, $secret)]);
            $votes = $query->fetchAll();
            $query = $pdo->prepare('SELECT comment_id, created_at, read_at FROM comment_notifications WHERE account_id = ? ORDER BY id ASC');
            $query->execute([$accountId]);
            $notifications = $query->fetchAll();
            $query = $pdo->prepare('SELECT user_agent, created_at, last_seen_at, expires_at FROM comment_account_sessions WHERE account_id = ? ORDER BY id ASC');
            $query->execute([$accountId]);
            respond(200, ['account' => $account, 'comments' => $comments, 'votes' => $votes,
                'notifications' => $notifications, 'sessions' => $query->fetchAll()]);
        }
        $slug = $_GET['slug'] ?? null;
        if (!valid_slug($slug)) respond(400, ['error' => 'Unknown article.']);
        $sort = $_GET['sort'] ?? 'newest';
        if (!is_string($sort) || !in_array($sort, ['newest', 'top'], true)) {
            respond(400, ['error' => 'Invalid sort order.']);
        }
        $offset = filter_input(INPUT_GET, 'offset', FILTER_VALIDATE_INT, [
            'options' => ['default' => 0, 'min_range' => 0, 'max_range' => 10000],
        ]);
        if ($offset === false) respond(400, ['error' => 'Invalid offset.']);
        $rootId = null;
        if (isset($_GET['thread_id'])) {
            $rootId = filter_input(INPUT_GET, 'thread_id', FILTER_VALIDATE_INT, [
                'options' => ['min_range' => 1],
            ]);
            if ($rootId === false || $rootId === null) respond(400, ['error' => 'Invalid thread.']);
        }
        [$pdo, $secret] = database();
        if ($rootId !== null) {
            $root = existing_comment($pdo, $rootId, $slug);
            if ($root['root_id'] !== null) respond(400, ['error' => 'Invalid thread.']);
        }
        $ipHash = visitor_hash($secret);
        $accountId = account_id($pdo);
        $voteHash = $accountId === null ? $ipHash : account_vote_hash($accountId, $secret);
        [$comments, $hasMore] = comment_fields($pdo, $slug, $voteHash, $ipHash, $accountId, $rootId, $offset, $sort);
        $unreadCount = 0;
        if ($accountId !== null) {
            $query = $pdo->prepare('SELECT COUNT(*) FROM comment_notifications WHERE account_id = ? AND read_at IS NULL');
            $query->execute([$accountId]);
            $unreadCount = (int) $query->fetchColumn();
        }
        respond(200, [
            'comments' => $comments,
            'has_more' => $hasMore,
            'submission_token' => submission_token($slug, $ipHash, $secret),
            'signed_in' => $accountId !== null,
            'username' => $accountId === null ? null : account_username($pdo, $accountId),
            'unread_count' => $unreadCount,
        ]);
    }

    if (isset($_SERVER['HTTP_SEC_FETCH_SITE']) && $_SERVER['HTTP_SEC_FETCH_SITE'] !== 'same-origin') {
        respond(403, ['error' => 'Invalid request.']);
    }
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '') {
        $originHost = parse_url($origin, PHP_URL_HOST);
        $requestHost = explode(':', $_SERVER['HTTP_HOST'] ?? '')[0];
        if (!is_string($originHost) || !hash_equals(strtolower($requestHost), strtolower($originHost))) {
            respond(403, ['error' => 'Invalid origin.']);
        }
    }

    [$pdo, $secret] = database();
    $ipHash = visitor_hash($secret);
    check_rate_limits($pdo, $ipHash, 'all');
    $input = json_body();
    $accountAction = $method === 'POST' ? ($input['action'] ?? null) : null;
    if ($accountAction === 'admin_moderate') {
        require_admin($pdo);
        $id = positive_id($input['id'] ?? null);
        $decision = $input['decision'] ?? null;
        if ($id === null || !in_array($decision, ['hide', 'restore', 'delete'], true)) {
            respond(400, ['error' => 'Invalid moderation action.']);
        }
        $query = $pdo->prepare('SELECT id, deleted_at FROM comments WHERE id = ?');
        $query->execute([$id]);
        $comment = $query->fetch();
        if (!$comment) respond(404, ['error' => 'Comment not found.']);
        if ($comment['deleted_at'] !== null) respond(409, ['error' => 'This comment was deleted.']);
        $pdo->beginTransaction();
        if ($decision === 'hide') {
            $pdo->prepare('UPDATE comments SET hidden_at = COALESCE(hidden_at, UTC_TIMESTAMP()) WHERE id = ?')->execute([$id]);
        } elseif ($decision === 'restore') {
            $pdo->prepare('UPDATE comments SET hidden_at = NULL WHERE id = ?')->execute([$id]);
            $pdo->prepare('DELETE FROM comment_reports WHERE comment_id = ?')->execute([$id]);
        } else {
            $pdo->prepare("UPDATE comments SET name = 'Deleted', body = '', owner_token_hash = NULL, deleted_at = UTC_TIMESTAMP(), hidden_at = NULL WHERE id = ?")
                ->execute([$id]);
            $pdo->prepare('DELETE FROM comment_reports WHERE comment_id = ?')->execute([$id]);
            $pdo->prepare('DELETE FROM comment_notifications WHERE comment_id = ?')->execute([$id]);
        }
        $pdo->commit();
        respond(200, ['ok' => true]);
    }
    if ($accountAction === 'account_create') {
        check_rate_limits($pdo, $ipHash, 'account_create');
        [$username, $usernameKey] = valid_username($input['username'] ?? null);
        $query = $pdo->prepare('SELECT id FROM comment_accounts WHERE username_key = ?');
        $query->execute([$usernameKey]);
        if ($query->fetchColumn() !== false) respond(409, ['error' => 'That username is already taken.']);
        $alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        do {
            $key = '';
            for ($i = 0; $i < 12; $i++) $key .= $alphabet[random_int(0, 35)];
            $query = $pdo->prepare('INSERT IGNORE INTO comment_accounts (username, username_key, key_hash, created_at) VALUES (?, ?, ?, UTC_TIMESTAMP())');
            $query->execute([$username, $usernameKey, account_key_hash($key, $secret)]);
            if ($query->rowCount() === 0) {
                $check = $pdo->prepare('SELECT id FROM comment_accounts WHERE username_key = ?');
                $check->execute([$usernameKey]);
                if ($check->fetchColumn() !== false) respond(409, ['error' => 'That username is already taken.']);
            }
        } while ($query->rowCount() === 0);
        $accountId = (int) $pdo->lastInsertId();
        start_account_session($pdo, $accountId);
        respond(201, ['signed_in' => true, 'username' => $username, 'key' => implode('-', str_split($key, 4))]);
    }
    if ($accountAction === 'account_login') {
        check_rate_limits($pdo, $ipHash, 'account_login');
        $key = $input['key'] ?? null;
        if (!is_string($key)) respond(400, ['error' => 'Enter a key in XXXX-XXXX-XXXX format.']);
        $key = strtoupper(str_replace('-', '', trim($key)));
        if (!preg_match('/^[A-Z0-9]{12}$/D', $key)) respond(400, ['error' => 'Enter a key in XXXX-XXXX-XXXX format.']);
        $query = $pdo->prepare('SELECT id FROM comment_accounts WHERE key_hash = ?');
        $query->execute([account_key_hash($key, $secret)]);
        $accountId = $query->fetchColumn();
        if ($accountId === false) respond(401, ['error' => 'Key not found. Check it and try again.']);
        start_account_session($pdo, (int) $accountId);
        respond(200, ['signed_in' => true, 'username' => account_username($pdo, (int) $accountId)]);
    }
    if ($accountAction === 'account_set_username') {
        respond(403, ['error' => 'Usernames cannot be changed.']);
    }
    if ($accountAction === 'account_rotate_key') {
        check_rate_limits($pdo, $ipHash, 'account_settings');
        $accountId = require_account($pdo);
        $currentKey = $input['current_key'] ?? null;
        if (!is_string($currentKey)) respond(400, ['error' => 'Enter your current key.']);
        $currentKey = strtoupper(str_replace('-', '', trim($currentKey)));
        if (!preg_match('/^[A-Z0-9]{12}$/D', $currentKey)) respond(400, ['error' => 'Enter your current key.']);
        $query = $pdo->prepare('SELECT key_hash FROM comment_accounts WHERE id = ?');
        $query->execute([$accountId]);
        if (!hash_equals((string) $query->fetchColumn(), account_key_hash($currentKey, $secret))) {
            respond(403, ['error' => 'Current key is incorrect.']);
        }
        $alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        do {
            $key = '';
            for ($i = 0; $i < 12; $i++) $key .= $alphabet[random_int(0, 35)];
            $query = $pdo->prepare('UPDATE IGNORE comment_accounts SET key_hash = ? WHERE id = ?');
            $query->execute([account_key_hash($key, $secret), $accountId]);
        } while ($query->rowCount() === 0);
        $query = $pdo->prepare('DELETE FROM comment_account_sessions WHERE account_id = ?');
        $query->execute([$accountId]);
        start_account_session($pdo, $accountId);
        respond(200, ['key' => implode('-', str_split($key, 4))]);
    }
    if ($accountAction === 'account_logout_all') {
        check_rate_limits($pdo, $ipHash, 'account_settings');
        $accountId = require_account($pdo);
        $query = $pdo->prepare('DELETE FROM comment_account_sessions WHERE account_id = ?');
        $query->execute([$accountId]);
        set_account_cookie('', time() - 3600);
        respond(200, ['signed_in' => false]);
    }
    if ($accountAction === 'account_logout') {
        $cookie = $_COOKIE['comment_account'] ?? null;
        if (is_string($cookie) && preg_match('/^[a-f0-9]{64}$/D', $cookie)) {
            $query = $pdo->prepare('DELETE FROM comment_account_sessions WHERE token_hash = ?');
            $query->execute([hash('sha256', $cookie)]);
        }
        set_account_cookie('', time() - 3600);
        respond(200, ['signed_in' => false]);
    }
    if ($accountAction === 'account_claim') {
        check_rate_limits($pdo, $ipHash, 'account_claim');
        $accountId = require_account($pdo);
        $claims = $input['claims'] ?? null;
        if (!is_array($claims) || count($claims) > 100) respond(400, ['error' => 'Invalid claims.']);
        $query = $pdo->prepare('UPDATE comments SET account_id = ?, owner_token_hash = NULL WHERE id = ? AND account_id IS NULL AND owner_token_hash = ?');
        $claimed = [];
        foreach ($claims as $claim) {
            if (!is_array($claim) || ($id = positive_id($claim['id'] ?? null)) === null) continue;
            $token = $claim['token'] ?? null;
            if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/D', $token)) continue;
            $query->execute([$accountId, $id, hash('sha256', $token)]);
            if ($query->rowCount() === 1) $claimed[] = $id;
        }
        respond(200, ['claimed' => $claimed]);
    }
    if ($accountAction === 'notifications_read') {
        $accountId = require_account($pdo);
        $id = $input['id'] ?? null;
        if ($id === null) {
            $query = $pdo->prepare('UPDATE comment_notifications SET read_at = UTC_TIMESTAMP() WHERE account_id = ? AND read_at IS NULL');
            $query->execute([$accountId]);
        } else {
            $id = positive_id($id);
            if ($id === null) respond(400, ['error' => 'Invalid notification.']);
            $query = $pdo->prepare('UPDATE comment_notifications SET read_at = UTC_TIMESTAMP() WHERE id = ? AND account_id = ? AND read_at IS NULL');
            $query->execute([$id, $accountId]);
        }
        respond(200, ['ok' => true]);
    }
    if ($accountAction === 'account_revoke_session') {
        check_rate_limits($pdo, $ipHash, 'account_settings');
        $session = current_session($pdo);
        if ($session === null) respond(401, ['error' => 'Sign in to your comment account first.']);
        $id = positive_id($input['id'] ?? null);
        if ($id === null) respond(400, ['error' => 'Invalid session.']);
        $query = $pdo->prepare('DELETE FROM comment_account_sessions WHERE id = ? AND account_id = ?');
        $query->execute([$id, $session['account_id']]);
        if ($query->rowCount() === 0) respond(404, ['error' => 'Session not found.']);
        if ($id === $session['id']) set_account_cookie('', time() - 3600);
        respond(200, ['ok' => true, 'signed_out' => $id === $session['id']]);
    }
    if ($accountAction === 'account_delete') {
        check_rate_limits($pdo, $ipHash, 'account_settings');
        $accountId = require_account($pdo);
        $mode = $input['comments'] ?? null;
        if (!in_array($mode, ['delete', 'anonymize'], true) || ($input['confirm'] ?? null) !== 'DELETE') {
            respond(400, ['error' => 'Choose what happens to your comments and confirm deletion.']);
        }
        $key = $input['current_key'] ?? null;
        if (!is_string($key)) respond(400, ['error' => 'Enter your account key.']);
        $key = strtoupper(str_replace('-', '', trim($key)));
        if (!preg_match('/^[A-Z0-9]{12}$/D', $key)) respond(400, ['error' => 'Enter your account key.']);
        $query = $pdo->prepare('SELECT key_hash FROM comment_accounts WHERE id = ?');
        $query->execute([$accountId]);
        if (!hash_equals((string) $query->fetchColumn(), account_key_hash($key, $secret))) {
            respond(403, ['error' => 'Account key is incorrect.']);
        }
        $pdo->beginTransaction();
        if ($mode === 'delete') {
            $query = $pdo->prepare('DELETE FROM comment_notifications WHERE comment_id IN (SELECT id FROM comments WHERE account_id = ?)');
            $query->execute([$accountId]);
            $query = $pdo->prepare("UPDATE comments SET name = 'Deleted', body = '', owner_token_hash = NULL, account_id = NULL, "
                . 'deleted_at = COALESCE(deleted_at, UTC_TIMESTAMP()) WHERE account_id = ?');
            $query->execute([$accountId]);
        } else {
            $query = $pdo->prepare("UPDATE comments SET name = 'Anonymous commenter', owner_token_hash = NULL, account_id = NULL WHERE account_id = ?");
            $query->execute([$accountId]);
        }
        $query = $pdo->prepare('DELETE FROM comment_votes WHERE ip_hash = ?');
        $query->execute([account_vote_hash($accountId, $secret)]);
        $query = $pdo->prepare('DELETE FROM comment_accounts WHERE id = ?');
        $query->execute([$accountId]);
        $pdo->commit();
        set_account_cookie('', time() - 3600);
        respond(200, ['ok' => true]);
    }
    $slug = $input['slug'] ?? null;
    if (!valid_slug($slug)) respond(400, ['error' => 'Unknown article.']);
    $action = $method === 'POST' ? ($input['action'] ?? 'create') : ($method === 'PATCH' ? 'edit' : 'delete');
    $accountId = account_id($pdo);

    if ($action === 'create' && $method === 'POST') {
        check_rate_limits($pdo, $ipHash, 'comment');
        if (!valid_submission_token($input['submission_token'] ?? null, $slug, $ipHash, $secret)) {
            respond(400, ['error' => 'Comment form expired. Refresh the page and try again.']);
        }
        if (!is_string($input['website'] ?? '')) respond(400, ['error' => 'Invalid comment.']);
        if (($input['website'] ?? '') !== '') respond(201, ['ok' => true]);
        $accountName = $accountId === null ? null : account_username($pdo, $accountId);
        if ($accountId !== null && $accountName === null) respond(409, ['error' => 'This account has no username and cannot post.']);
        [$name, $body] = validate_comment($accountName ?? 'Anonymous commenter', $input['body'] ?? null);
        $parentId = null;
        $rootId = null;
        $notifyAccountId = null;
        if (array_key_exists('parent_id', $input) && $input['parent_id'] !== null) {
            $parentId = positive_id($input['parent_id']);
            if ($parentId === null) respond(400, ['error' => 'Invalid reply target.']);
            $parent = existing_comment($pdo, $parentId, $slug);
            if ($parent['deleted_at'] !== null || $parent['hidden_at'] !== null) {
                respond(409, ['error' => 'This comment cannot receive replies.']);
            }
            $rootId = $parent['root_id'] === null ? $parentId : (int) $parent['root_id'];
            if ($parent['account_id'] !== null && (int) $parent['account_id'] !== $accountId) {
                $notifyAccountId = (int) $parent['account_id'];
            }
        }
        $query = $pdo->prepare(
            'SELECT COUNT(*) FROM comments WHERE ip_hash = ? AND created_at >= UTC_TIMESTAMP() - INTERVAL 15 MINUTE'
        );
        $query->execute([$ipHash]);
        if ((int) $query->fetchColumn() >= 5) {
            header('Retry-After: 900');
            respond(429, ['error' => 'Too many comments. Please try again later.']);
        }
        $query = $pdo->prepare(
            'SELECT COUNT(*) FROM comments WHERE ip_hash = ? AND slug = ? AND body = ? '
            . 'AND created_at >= UTC_TIMESTAMP() - INTERVAL 15 MINUTE'
        );
        $query->execute([$ipHash, $slug, $body]);
        if ((int) $query->fetchColumn() > 0) respond(409, ['error' => 'You already posted this comment.']);

        $ownerToken = $accountId === null ? bin2hex(random_bytes(32)) : null;
        $pdo->beginTransaction();
        $query = $pdo->prepare(
            'INSERT INTO comments (slug, name, body, ip_hash, parent_id, root_id, owner_token_hash, account_id, created_at) '
            . 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())'
        );
        $query->execute([$slug, $name, $body, $ipHash, $parentId, $rootId, $ownerToken === null ? null : hash('sha256', $ownerToken), $accountId]);
        $commentId = (int) $pdo->lastInsertId();
        if ($notifyAccountId !== null) {
            $query = $pdo->prepare('INSERT INTO comment_notifications (account_id, comment_id) VALUES (?, ?)');
            $query->execute([$notifyAccountId, $commentId]);
        }
        $pdo->commit();
        respond(201, ['ok' => true, 'id' => $commentId, 'owner_token' => $ownerToken]);
    }

    if ($action === 'edit' && $method === 'PATCH') {
        check_rate_limits($pdo, $ipHash, 'edit');
        $id = positive_id($input['id'] ?? null);
        if ($id === null) respond(400, ['error' => 'Invalid comment.']);
        $comment = existing_comment($pdo, $id, $slug);
        check_owner($comment, $input['owner_token'] ?? null, $accountId);
        $accountName = $accountId === null ? null : account_username($pdo, $accountId);
        if ($accountId !== null && $accountName === null) respond(409, ['error' => 'This account has no username and cannot edit comments.']);
        [, $body] = validate_comment($accountName ?? (string) $comment['name'], $input['body'] ?? null);
        $name = $accountName ?? $comment['name'];
        $query = $pdo->prepare('UPDATE comments SET name = ?, body = ?, edited_at = UTC_TIMESTAMP() WHERE id = ?');
        $query->execute([$name, $body, $id]);
        respond(200, ['ok' => true]);
    }

    if ($action === 'delete' && $method === 'DELETE') {
        check_rate_limits($pdo, $ipHash, 'edit');
        $id = positive_id($input['id'] ?? null);
        if ($id === null) respond(400, ['error' => 'Invalid comment.']);
        $comment = existing_comment($pdo, $id, $slug);
        check_owner($comment, $input['owner_token'] ?? null, $accountId);
        $query = $pdo->prepare(
            "UPDATE comments SET name = 'Deleted', body = '', owner_token_hash = NULL, deleted_at = UTC_TIMESTAMP() WHERE id = ?"
        );
        $query->execute([$id]);
        respond(200, ['ok' => true]);
    }

    if ($action === 'vote' && $method === 'POST') {
        check_rate_limits($pdo, $ipHash, 'vote');
        $voteHash = $accountId === null ? $ipHash : account_vote_hash($accountId, $secret);
        $id = positive_id($input['id'] ?? null);
        $value = $input['value'] ?? null;
        if ($id === null || !is_int($value) || !in_array($value, [-1, 0, 1], true)) {
            respond(400, ['error' => 'Invalid vote.']);
        }
        $comment = existing_comment($pdo, $id, $slug);
        if ($comment['deleted_at'] !== null || $comment['hidden_at'] !== null) {
            respond(409, ['error' => 'This comment is unavailable.']);
        }
        if ($value === 0) {
            $query = $pdo->prepare('DELETE FROM comment_votes WHERE comment_id = ? AND ip_hash = ?');
            $query->execute([$id, $voteHash]);
        } else {
            $query = $pdo->prepare(
                'INSERT INTO comment_votes (comment_id, ip_hash, value, created_at) VALUES (?, ?, ?, UTC_TIMESTAMP()) '
                . 'ON DUPLICATE KEY UPDATE value = VALUES(value)'
            );
            $query->execute([$id, $voteHash, $value]);
        }
        $query = $pdo->prepare('SELECT COALESCE(SUM(value), 0) FROM comment_votes WHERE comment_id = ?');
        $query->execute([$id]);
        respond(200, ['score' => (int) $query->fetchColumn(), 'user_vote' => $value]);
    }

    if ($action === 'report' && $method === 'POST') {
        check_rate_limits($pdo, $ipHash, 'report');
        $id = positive_id($input['id'] ?? null);
        $reason = $input['reason'] ?? null;
        if ($id === null || !in_array($reason, ['spam', 'harassment', 'other'], true)) {
            respond(400, ['error' => 'Invalid report.']);
        }
        $comment = existing_comment($pdo, $id, $slug);
        if ($comment['deleted_at'] !== null || $comment['hidden_at'] !== null) {
            respond(409, ['error' => 'This comment is unavailable.']);
        }
        $query = $pdo->prepare(
            'INSERT IGNORE INTO comment_reports (comment_id, ip_hash, reason, created_at) VALUES (?, ?, ?, UTC_TIMESTAMP())'
        );
        $query->execute([$id, $ipHash, $reason]);
        $query = $pdo->prepare('SELECT COUNT(*) FROM comment_reports WHERE comment_id = ?');
        $query->execute([$id]);
        $hidden = (int) $query->fetchColumn() >= 3;
        if ($hidden) {
            $query = $pdo->prepare('UPDATE comments SET hidden_at = UTC_TIMESTAMP() WHERE id = ? AND hidden_at IS NULL');
            $query->execute([$id]);
        }
        respond(200, ['reported' => true, 'hidden' => $hidden]);
    }

    respond(400, ['error' => 'Unknown action.']);
} catch (Throwable $error) {
    error_log('Comments API: ' . $error->getMessage());
    respond(503, ['error' => 'Comments are unavailable right now.']);
}
