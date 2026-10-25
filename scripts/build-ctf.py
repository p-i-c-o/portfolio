#!/usr/bin/env python3
"""Build CTF event indexes and Markdown challenge write-ups."""
from __future__ import annotations

import html
import re
import runpy
import shutil
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BLOG = runpy.run_path(str(ROOT / "scripts/build-blog.py"))
parse_front_matter = BLOG["parse_front_matter"]
markdown_to_html = BLOG["markdown_to_html"]
page_shell = BLOG["page_shell"]
article_parts = BLOG["article_parts"]
file_info = BLOG["file_info"]
breadcrumb_path = BLOG["breadcrumb_path"]
escape = html.escape


def read_content(path: Path) -> dict:
    meta, body = parse_front_matter(path.read_text(encoding="utf-8"))
    if not meta.get("title"):
        raise ValueError(f"{path}: title is required")
    if meta.get("date"):
        date.fromisoformat(meta["date"])
    if meta.get("draft", "false").lower() not in {"true", "false"}:
        raise ValueError(f"{path}: draft must be true or false")
    meta["body"] = markdown_to_html(body)
    return meta


def validate_slug(slug: str) -> None:
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
        raise ValueError(f"Use lowercase words separated by hyphens for CTF paths: {slug}")


def read_events(source: Path) -> list[dict]:
    events = []
    for folder in sorted(source.iterdir()):
        if not folder.is_dir() or folder.name.startswith("."):
            continue
        validate_slug(folder.name)
        event = read_content(folder / "index.md")
        if event.get("draft", "false").lower() == "true":
            continue
        event["slug"] = folder.name
        event["challenges"] = []
        for path in sorted(folder.glob("*.md")):
            if path.name == "index.md":
                continue
            validate_slug(path.stem)
            challenge = read_content(path)
            if challenge.get("draft", "false").lower() == "true":
                continue
            challenge["slug"] = path.stem
            event["challenges"].append(challenge)
        event["challenges"].sort(key=lambda item: (item.get("date", ""), item["slug"]), reverse=True)
        events.append(event)
    return sorted(events, key=lambda item: (item.get("date", ""), item["slug"]), reverse=True)


def metadata(item: dict) -> str:
    parts = [escape(item[key]) for key in ("date", "category", "difficulty") if item.get(key)]
    return f'<p class="blog-date">{" · ".join(parts)}</p>' if parts else ""


def listing(items: list[dict], events: bool = False, show_category: bool = True) -> str:
    entries = []
    for item in items:
        count = len(item.get("challenges", []))
        detail = f'<p>{count} write-up{"s" if count != 1 else ""}</p>' if events else ""
        description = f'<p>{escape(item["description"])}</p>' if item.get("description") else ""
        details = metadata(item if show_category else {key: value for key, value in item.items() if key != "category"})
        entries.append(f'''<article class="blog-list-entry">
<h3><a href="{item['slug']}/">{escape(item['title'])}</a></h3>
{details}{description}{detail}
</article>''')
    empty = "No CTFs published yet. Check back for challenge write-ups." if events else "No challenge write-ups published yet. Check back soon."
    return "\n".join(entries) or f"<p>{empty}</p>"


def category_blocks(challenges: list[dict]) -> str:
    groups: dict[str, list[dict]] = {}
    labels: dict[str, str] = {}
    for challenge in challenges:
        label = challenge.get("category", "").strip() or "Other"
        key = label.casefold()
        labels.setdefault(key, label)
        groups.setdefault(key, []).append(challenge)

    if not groups:
        return ('<section class="block"><h2 class="header">Challenges</h2>'
                f'<div class="body blog-list">{listing([])}</div></section>')

    blocks = []
    for number, key in enumerate(sorted(groups, key=lambda key: (key == "other", key)), start=1):
        items = groups[key]
        blocks.append(f'''<section class="block" aria-labelledby="category-{number}">
<h2 class="header ctf-category-header" id="category-{number}"><span>{escape(labels[key])}</span></h2>
<div class="body blog-list">{listing(items, show_category=False)}</div>
</section>''')
    return "\n".join(blocks)


def write_page(path: Path, title: str, body: str, depth: int) -> None:
    prefix = "../" * depth
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(page_shell(title, f'<main class="ctf-page">\n{body}\n</main>', prefix + "styles.css", prefix + "assets/banner.png", prefix + "index.html"), encoding="utf-8")


def panel(breadcrumbs: str, content: str) -> str:
    return f'''<section class="block">
<nav class="header path-header" aria-label="Breadcrumb">{breadcrumbs}</nav>
<div class="body blog-post">{content}</div>
</section>'''


def build(source: Path = ROOT / "ctf-posts", output: Path = ROOT / "ctf") -> None:
    events = read_events(source)
    # Validate and render every source before replacing generated pages.
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)
    body = panel(breadcrumb_path([("home", "../index.html"), ("ctf", None)]), f'''<h1>CTF write-ups</h1>
<p>Capture the flag challenges, the paths to their solutions, and what I learned along the way.</p>
<h2 class="ctf-list-title">Events</h2>
<div class="blog-list">{listing(events, events=True)}</div>''')
    write_page(output / "index.html", "CTF write-ups", body, 1)
    for event in events:
        title = escape(event["title"])
        body = panel(breadcrumb_path([("home", "../../index.html"), ("ctf", "../"), (event["slug"], None)]), f'''<h1>{title}</h1>
{metadata(event)}{event['body']}''')
        body += category_blocks(event["challenges"])
        write_page(output / event["slug"] / "index.html", event["title"], body, 2)
        for challenge in event["challenges"]:
            index, content = article_parts(challenge["body"], challenge["title"])
            fields = [("CTF", event["title"])] + [
                (label, challenge.get(key, "")) for key, label in (
                    ("category", "Category"), ("difficulty", "Difficulty"),
                    ("score", "Score"), ("solves", "Solves"),
                    ("creator", "Creator"), ("files", "Files"),
                )
            ]
            info = file_info(challenge["title"], challenge.get("description", ""),
                             challenge.get("date", ""), challenge.get("author", ""),
                             breadcrumb_path([("home", "../../../index.html"), ("ctf", "../../"),
                                              (event["slug"], "../"), (challenge["slug"] + ".md", None)]),
                             extra_fields=fields, date_label="Write-up date", author_label="Write-up by",
                             hide_empty=True)
            body = info + index + f'''<section class="block">
<div id="article-title" class="body blog-post" aria-label="Article">
{content}
<p class="ctf-back"><a href="../">← All challenges in {title}</a></p>
</div></section>'''
            write_page(output / event["slug"] / challenge["slug"] / "index.html", f"{challenge['title']} | {event['title']}", body, 3)
    print(f"Built {len(events)} CTF event(s) and {sum(len(event['challenges']) for event in events)} write-up(s)")


if __name__ == "__main__":
    build()
