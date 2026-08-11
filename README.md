# monnickendam.ch

Static personal portfolio website for [monnickendam.ch](https://monnickendam.ch).

The site introduces Elie Monnickendam, links to projects and writing, lists selected certifications and experience, and includes a small contact form.

## Project Structure

```text
.
├── index.html        # Main page content
├── styles.css        # Site styling
├── contact.js        # Contact form submission handler
├── assets/           # Images and other static assets
└── server-side/      # Server deployment helper and cron notes
```

## Local Preview

This is a static site, so it can be opened directly in a browser:

```bash
xdg-open index.html
```

For a local HTTP preview, run:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Deployment

Deploy the repository contents as static files with `index.html` at the web root. The production site is expected to be served from:

```text
https://monnickendam.ch
```

The `server-side/deploy-monnickendam.sh` script can be run from outside the web directory. It clones the GitHub repository into a temporary directory, then syncs the site files into:

```text
~/www/monnickendam.ch
```

It pulls from:

```text
https://github.com/p-i-c-o/portfolio
```

See `server-side/README.md` for the manual command and cron example.

## External Services

The frontend currently makes one browser-side network request:

- `contact.js` posts contact form submissions to an n8n webhook.

If the contact workflow changes, update the `WEBHOOK_URL` constant in `contact.js`.

## Notes

- No build step is required.
- No package manager dependencies are required.
- Keep image assets under `assets/` and reference them with relative paths from `index.html`.
