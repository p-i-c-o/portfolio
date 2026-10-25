"""Regression checks for CTF publishing and navigation."""
import runpy
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

BUILDER = runpy.run_path(str(Path(__file__).with_name("build-ctf.py")))


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.targets = []

    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in {"href", "src"}:
                self.targets.append(value)


class CTFBuildTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "sources"
        self.source.mkdir()
        self.output = self.root / "ctf"

    def content(self, path, title, extra="", body="An introduction."):
        target = self.source / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(f"---\ntitle: {title}\n{extra}---\n\n{body}\n", encoding="utf-8")

    def build(self):
        BUILDER["build"](self.source, self.output)

    def test_multiple_events_and_challenge_links(self):
        self.content("older/index.md", "Older", "date: 2025-01-01\n")
        self.content("newer/index.md", "Newer", "date: 2026-01-01\n")
        self.content("newer/first/index.md", "Ignored nested content")
        self.content("newer/first.md", "First", "category: Encoding\ndifficulty: Easy\n", "```python\nprint('hello')\n```")
        self.content("newer/second.md", "Second")
        self.build()
        index = (self.output / "index.html").read_text()
        self.assertLess(index.index('href="newer/"'), index.index('href="older/"'))
        self.assertIn("2 write-ups", index)
        event = (self.output / "newer/index.html").read_text()
        self.assertIn('href="first/"', event)
        self.assertIn('href="second/"', event)
        challenge = (self.output / "newer/first/index.html").read_text()
        self.assertIn('href="../">newer</a>/<span aria-current="page">first.md</span>', challenge)
        self.assertIn('href="../../../styles.css"', challenge)
        self.assertIn("Encoding · Easy", challenge)
        self.assertIn('class="copy-code"', challenge)
        self.assertIn("No challenge write-ups published yet", (self.output / "older/index.html").read_text())

    def test_drafts_and_removed_challenges_disappear_on_rebuild(self):
        self.content("event/index.md", "Event")
        self.content("event/solution.md", "Solution")
        self.build()
        self.assertTrue((self.output / "event/solution/index.html").exists())
        self.content("event/solution.md", "Solution", "draft: true\n")
        self.build()
        self.assertFalse((self.output / "event/solution").exists())
        self.content("event/index.md", "Event", "draft: true\n")
        self.build()
        self.assertFalse((self.output / "event").exists())
        self.assertIn("No CTFs published yet", (self.output / "index.html").read_text())

    def test_invalid_source_preserves_previous_build(self):
        self.content("event/index.md", "Event")
        self.build()
        original = (self.output / "index.html").read_bytes()
        self.content("event/bad.md", "Bad", "date: yesterday\n")
        with self.assertRaises(ValueError):
            self.build()
        self.assertEqual(original, (self.output / "index.html").read_bytes())

    def test_metadata_is_escaped(self):
        self.content("event/index.md", "<script>alert(1)</script>", "description: <img src=x>\n")
        self.build()
        index = (self.output / "index.html").read_text()
        self.assertIn("&lt;script&gt;alert(1)&lt;/script&gt;", index)
        self.assertIn("&lt;img src=x&gt;", index)

    def test_generated_site_local_links_resolve(self):
        root = Path(__file__).resolve().parents[1]
        pages = list((root / "ctf").rglob("*.html"))
        self.assertGreaterEqual(len(pages), 1)
        for page in pages:
            parser = Links()
            parser.feed(page.read_text())
            for target in parser.targets:
                url = urlsplit(target)
                if url.scheme or url.netloc or not url.path:
                    continue
                destination = (page.parent / url.path).resolve()
                if destination.is_dir():
                    destination /= "index.html"
                self.assertTrue(destination.is_file(), f"{page}: {target}")


if __name__ == "__main__":
    unittest.main()
