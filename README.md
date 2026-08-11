# monnickendam.ch

Static personal portfolio website for [monnickendam.ch](https://monnickendam.ch).

The site introduces Elie Monnickendam, links to projects and writing, lists selected certifications and experience, and includes a small contact form.

## Project Structure

```text
.
├── index.html        # Main page content
├── styles.css        # Site styling
├── script.js         # Visitor IP display
├── contact.js        # Contact form submission handler
└── assets/           # Images and other static assets
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

## External Services

The frontend currently makes two browser-side network requests:

- `script.js` calls `https://api.ipify.org?format=json` to display the visitor's public IP address.
- `contact.js` posts contact form submissions to an n8n webhook.

If the contact workflow changes, update the `WEBHOOK_URL` constant in `contact.js`.

## Notes

- No build step is required.
- No package manager dependencies are required.
- Keep image assets under `assets/` and reference them with relative paths from `index.html`.
