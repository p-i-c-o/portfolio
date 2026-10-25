# monnickendam.ch

Static personal portfolio website for [monnickendam.ch](https://monnickendam.ch).

The site introduces Elie Monnickendam, covers work and education, links to projects and writing, lists selected certifications and experiences, and includes a small contact form.

## Project Structure

```text
.
├── index.html        # Main page content
├── styles.css        # Site styling
├── contact.js        # Contact form submission handler
├── comments.js       # Blog comment interface
├── api/              # PHP comment API for Hostpoint
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

Blog articles and CTF write-ups automatically receive a file-info block and a
linked contents block. File info uses the front matter title, description, date,
and optional `author` (default: Elie Monnickendam). Missing dates are displayed
as “Not specified.”

An opening `# Title` stays in the article, without a number or contents entry.
Use `##` for main sections numbered `1`, `2`, and so on; `###` headings become
`1.1`, `1.2`, with deeper levels supported through `######`. Contents links and
heading numbers are generated on rebuild. Articles without sections display
“No subsections.” in their contents block.

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

## CTF write-ups

The CTF area lives at `/ctf/`. Each event has a challenge index, and each
challenge opens as a blog-style solution write-up. The section starts empty,
ready for events and challenges to be added.

Keep Markdown sources in this structure:

```text
ctf-posts/
└── event-name/
    ├── index.md             # Event title, summary, and introduction
    ├── first-challenge.md   # A solution write-up
    └── second-challenge.md
```

Use lowercase letters, numbers, and hyphens for directory and file names.
They determine the URLs: `/ctf/event-name/first-challenge/`.
Each event requires an `index.md` with front matter:

```markdown
---
title: Event Name
date: 2026-10-24
description: A short summary of the event.
---

An introduction to the event.
```

Each challenge is another Markdown file in that event directory:

Copy `ctf-posts/_template.md` into the event folder as `challenge-name.md`
for the standard structure: challenge, approach, solution, flag, and takeaway.
Fill in the placeholders and set `draft: false` when ready to publish.
The template itself is ignored by the builder because it sits outside event folders.

```markdown
---
title: First Challenge
date: 2026-10-24
description: A short summary of the challenge.
category: Forensics
difficulty: Medium
---

## The challenge

Describe the task here.

## Solution

Explain the approach, include code, and discuss what you learned.
```

Only `title` is required. Dates use `YYYY-MM-DD`; dated entries appear newest
first, followed by undated entries. Add `draft: true` to hide a challenge or
an entire event. Empty published events show a message until write-ups are added.
Write-ups support the same Markdown, code blocks, tables, math, diagrams, and
charts as the blog.

Rebuild after changing the sources, then refresh the running local site:

```bash
python3 scripts/build-ctf.py
```

The generated `ctf/` directory is replaced on each build, so edit the Markdown
sources instead of generated HTML. Deployment builds both the blog and CTF area.

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

## Blog Comments

Article pages include public comments with threaded replies, upvotes and downvotes, sorting by newest or score, reporting, and editing or deleting your comments. Visitors can create an anonymous account with a unique username and a 12-character login key at `/account/`; guest comments use the name “Anonymous commenter.” Account features include reply notifications, comment management, session controls, export, and deletion. Public profiles are available at `/profile/?u=USERNAME`. Comments are published immediately and stored in Hostpoint MariaDB through `api/comments.php`. The PHP endpoint is deployed with the static site; the Markdown blog remains statically generated. See [server-side/README.md](server-side/README.md#blog-comments) for setup.

## Notes

- No build step is required.
- No package manager dependencies are required.
- Keep image assets under `assets/` and reference them with relative paths from `index.html`.
- The JetBrains Mono webfont is bundled under `assets/fonts/`.

## Interactive homelab

The homepage graph is a curated portfolio tour of tools, grouped by purpose:
automation, personal media/files, infrastructure, and technical utilities.
Edit `topics` in `homelab.js` to change the groupings and tool stories.
Each entry has a name, short subtitle, description, and takeaway.
Edit `projectLinks` to maintain official websites and source repositories;
GitHub links use the bundled icon in `assets/github.svg`.

Branches unfold inside the existing graph and tool selections update its side
panel. “Surprise me” explores a different tool on each click. Back or Escape
returns to the overview with keyboard focus restored. Connection animations
respect reduced-motion preferences. All interactions stay in the browser.

This is editorial content, not an infrastructure inventory. Avoid adding private
host mappings, addresses, hardware allocations, runtime status, or credentials.
No build step or new dependencies are required.
