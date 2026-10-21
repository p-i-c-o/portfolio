# Server-side Deployment

This folder contains the cron-friendly deployment script for `monnickendam.ch`.

The script clones:

```text
https://github.com/p-i-c-o/portfolio
```

into a temporary directory, builds the Markdown blog pages, then syncs the site files into:

```text
~/www/monnickendam.ch
```

The web directory does not need to be a git repository. The script is designed to be run from outside the web directory.

The server needs `git`, `python3`, and `rsync` available.

By default, the script deploys the `main` branch. To deploy another branch, set `REPO_BRANCH`:

```bash
REPO_BRANCH=blogs ./server-side/deploy-monnickendam.sh
```

## Manual Run

```bash
./server-side/deploy-monnickendam.sh
```

## Cron Example

Run every five minutes:

```cron
*/5 * * * * /path/to/portfolio/server-side/deploy-monnickendam.sh >> "$HOME/monnickendam.ch.deploy.log" 2>&1
```

Example for the `blogs` branch:

```cron
*/5 * * * * REPO_BRANCH=blogs /path/to/portfolio/server-side/deploy-monnickendam.sh >> "$HOME/monnickendam.ch.deploy.log" 2>&1
```

Use the absolute path to this script on the server.

## Blog Comments

The comment API runs as PHP on Hostpoint and stores comments in MariaDB. It uses the same origin as the website. Visitors can post comments and replies, upvote or downvote a comment, sort discussions by newest or highest net score, and report spam, harassment, or other issues. A comment's score is upvotes minus downvotes; clicking an active vote again removes it. Comments appear immediately. Reports from three distinct IP addresses automatically hide a comment.

Visitors can create an optional anonymous account at `/account/` with a unique, case-insensitive username and a 12-character uppercase alphanumeric key displayed as `XXXX-XXXX-XXXX`. Usernames are set at account creation and cannot be changed. The key is shown only at creation or replacement and is the sole means of signing in on another device. No email address or password is collected, and a lost key cannot be recovered. The database stores an HMAC of the key rather than the key itself. Sign-in sets a 90-day HTTP-only, same-site cookie with Secure on the production host. The account page provides a reply inbox, paginated comment editing/deletion, key replacement, individual session revocation, sign-out everywhere, JSON export, and account deletion. Account deletion can either erase comment text into deleted placeholders or keep the comments under “Anonymous commenter”; replies from others remain. Replacing the key invalidates the old key and all other sessions. Public profiles at `/profile/?u=USERNAME` show an identicon and visible comments. Signed-in comments show the account username and can be edited or deleted from any signed-in browser. Comments posted earlier in a browser are claimed for the account when that browser still holds their ownership tokens. New guest comments use the fixed name “Anonymous commenter”; historical guest names remain as originally stored. Guest edit/delete tokens stay in browser local storage until claimed. Votes by signed-in visitors follow the account across devices; reports remain limited by hashed IP address.

The API limits comments to 1,000 characters and at most two links, rejects duplicate posts, uses a hidden bot trap and signed, time-limited submission tokens, and rate-limits posting attempts. It allows up to five published comments per IP address in 15 minutes, with additional per-IP and site-wide attempt limits. Account creation is limited to two attempts per IP in 15 minutes and five per day; sign-in to eight attempts in 15 minutes and 30 per day. IP addresses are stored only as keyed hashes. These controls reduce routine spam, but public anonymous comments can still attract spam from distributed or persistent bots.

Because the server deploys `main` automatically, finish the database and config setup before merging the comments PR. The next deployment after the merge publishes the PHP API and generated comment pages.

The Elie account is the site's initial administrator. Admin status is stored on the account row, checked for every privileged API request, and shown as a Comment moderation tab in the account area. The administrator can review reports and all comments, hide or restore comments, clear reports when restoring, and delete comment text while keeping replies. This does not grant database or Hostpoint control-panel access. Protect the account key as an admin credential.

To activate comments:

1. In Hostpoint Control Panel, make sure the website runs with PHP. If it uses Nginx, select **Nginx (proxy) with Apache/PHP** rather than **static website with Nginx**. For a fresh database, create it with a dedicated user and import all tables in [`comments.sql`](comments.sql) using phpMyAdmin. The current development database already has the v7 migration and Elie admin grant, so do not import the schema or run migrations again when reusing it. For another older installation, apply the needed migrations through [`comments-v7.sql`](comments-v7.sql) in numeric order. On a fresh database, create the Elie account first, then grant it with `UPDATE comment_accounts SET is_admin = 1 WHERE username_key = 'elie';` in phpMyAdmin after confirming the intended account row.
2. On the Hostpoint server, copy [`comments-config.example.ini`](comments-config.example.ini) to `~/.monnickendam-comments.ini`. Use the internal database host `arebezat.mysql.db.internal` there, and fill in the database name, permanent user, and password. For a fresh database, generate `hash_secret` with `php -r 'echo bin2hex(random_bytes(32)), PHP_EOL;'`. When reusing the development database, copy its existing `hash_secret` exactly; a different secret invalidates the existing account key. The configuration file must be outside `~/www/monnickendam.ch`, so `rsync --delete` does not remove it. Limit its permissions with `chmod 600 ~/.monnickendam-comments.ini`.
3. Deploy the site with the existing script. It will deploy `api/comments.php`, `comments.js`, `blog-account.js`, `account.js`, `profile.js`, `/account/`, `/profile/`, and the generated article pages. Sign in to the existing Elie account with its saved key, confirm the Admin tab appears, then post a test comment and reply.

The API expects the production layout `~/www/monnickendam.ch/api/comments.php` and reads `~/.monnickendam-comments.ini`. If the document root changes, update the config path in `api/comments.php`. Keep the credential file out of Git and outside the public website. Hidden comments and reports can be reviewed in phpMyAdmin. Database backups should include the account, session, comment, notification, vote, and report tables. Back up the configuration file securely too: losing or changing `hash_secret` prevents existing account keys from working.

### Local preview

With PHP and the `pdo_mysql` and `mbstring` extensions installed, place a development config file outside the repository and run:

```bash
COMMENTS_CONFIG_PATH=/path/to/comments.local.ini php -S 127.0.0.1:6969 -t /path/to/portfolio
```

Open `http://127.0.0.1:6969/blog/` and select an article. The config path environment variable affects only the running PHP process; do not put database credentials in the repository or browser code. Local development uses the external database hostname instead of Hostpoint's internal hostname, and Hostpoint requires the local machine's external IP to be allowed for the database user under **Databases → Database users → Hosts**.
