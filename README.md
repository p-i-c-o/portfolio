# monnickendam.ch

Static personal portfolio website for [monnickendam.ch](https://monnickendam.ch).

The site introduces Elie Monnickendam, links to projects and writing, lists selected certifications and experience, and includes a small contact form.

## Project Structure

```text
.
├── index.html        # Main page content
├── styles.css        # Site styling
├── contact.js        # Contact form submission handler
├── blog-posts/       # Markdown source files for blog posts
├── blog/             # Generated static blog HTML
├── scripts/          # Local build scripts
├── assets/           # Images, fonts, and other static assets
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

## Blog

Blog posts are written as Markdown files in `blog-posts/` and converted into static HTML under `blog/`.

To rebuild the blog after editing or adding posts, run:

```bash
python3 scripts/build-blog.py
```

Each post supports front matter:

```markdown
---
title: Example Post
slug: example-post
date: 2026-08-11
description: Short summary for the blog index.
---
```

Use an ISO-like timestamp in `date` when publication order matters:

```markdown
date: 2026-08-11 19:00
```

The blog index displays newest posts first, but article numbers are assigned from oldest to newest publication timestamp, so existing articles keep their number when newer posts are added.

### Graphs

Use `mermaid` fences for diagrams such as flowcharts, sequence diagrams, state machines, and git graphs.

Use `bar-chart`, `line-chart`, `scatter-chart`, `area-chart`, `stacked-bar-chart`, `horizontal-bar-chart`, `pie-chart`, or `donut-chart` fences for Chart.js data graphs. Chart.js is loaded from jsDelivr at runtime, and the chart body accepts optional `title:`, `x:`, and `y:` lines followed by CSV-like rows:

````markdown
```line-chart
title: Render Time Trend
x: build run
y: milliseconds
Run, Markdown, Full page
1, 31, 74
2, 29, 70
```
````

## Deployment

Deploy the repository contents as static files with `index.html` at the web root. The production site is expected to be served from:

```text
https://monnickendam.ch
```

The `server-side/deploy-monnickendam.sh` script can be run from outside the web directory. It clones the GitHub repository into a temporary directory, builds the blog pages, then syncs the site files into:

```text
~/www/monnickendam.ch
```

It pulls from:

```text
https://github.com/p-i-c-o/portfolio
```

See `server-side/README.md` for the manual command and cron example.

The deploy script uses the `main` branch by default. Set `REPO_BRANCH=blogs` to deploy this blog branch before it is merged.

## External Services

The frontend currently makes browser-side network requests for:

- `contact.js` posts contact form submissions to an n8n webhook.
- Generated blog pages load MathJax from `https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js` for TeX math rendering.
- Generated blog pages load Mermaid from `https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs` for diagram rendering.

If the contact workflow changes, update the `WEBHOOK_URL` constant in `contact.js`.

## Notes

- No build step is required.
- No package manager dependencies are required.
- Keep image assets under `assets/` and reference them with relative paths from `index.html`.
- The JetBrains Mono webfont is bundled under `assets/fonts/`.
