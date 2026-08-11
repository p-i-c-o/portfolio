# Server-side Deployment

This folder contains the cron-friendly deployment script for `monnickendam.ch`.

The script clones:

```text
https://github.com/p-i-c-o/portfolio
```

into a temporary directory, then syncs the site files into:

```text
~/www/monnickendam.ch
```

The web directory does not need to be a git repository. The script is designed to be run from outside the web directory.

## Manual Run

```bash
./server-side/deploy-monnickendam.sh
```

## Cron Example

Run every five minutes:

```cron
*/5 * * * * /path/to/portfolio/server-side/deploy-monnickendam.sh >> "$HOME/monnickendam.ch.deploy.log" 2>&1
```

Use the absolute path to this script on the server.
