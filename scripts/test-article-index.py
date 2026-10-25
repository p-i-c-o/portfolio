"""Checks for generated article navigation."""
import runpy
import unittest
from html.parser import HTMLParser
from pathlib import Path

BLOG = runpy.run_path(str(Path(__file__).with_name('build-blog.py')))


class Outline(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        if tag == 'a' and attrs.get('href', '').startswith('#'):
            self.links.append(attrs['href'][1:])


class ArticleIndexTests(unittest.TestCase):
    def render(self, markdown):
        return ''.join(BLOG['article_parts'](BLOG['markdown_to_html'](markdown)))

    def test_duplicate_and_colliding_headings(self):
        output = self.render('## Result\n\n## Result\n\n## Result-2\n\n## Result')
        parsed = Outline()
        parsed.feed(output)
        self.assertEqual(len(parsed.ids), len(set(parsed.ids)))
        self.assertEqual(parsed.links, [anchor for anchor in parsed.ids if anchor.startswith('section-')])

    def test_nested_headings_and_literal_labels(self):
        output = self.render('## **Tools** & `<script>`\n\n### [`io.BytesIO`](https://example.com)\n\n## Result')
        self.assertIn('class="article-index-subsections"', output)
        self.assertIn('class="article-index-label">Tools &amp; &lt;script&gt;</span>', output)
        self.assertIn('class="article-index-label">io.BytesIO</span>', output)
        self.assertNotIn('<script>', output)

    def test_short_posts_and_code_fences(self):
        output = self.render('## One section\n\n```markdown\n## Not a section\n```')
        self.assertIn('class="block article-index"', output)
        self.assertIn('id="section-one-section"', output)
        self.assertNotIn('id="section-not-a-section"', output)

    def test_hierarchical_numbers_and_reset(self):
        output = self.render('# Title\n\n## First\n\n### Child\n\n#### Deep\n\n##### Deeper\n\n###### Last\n\n## Second\n\n### Child')
        for number in ('1', '1.1', '1.1.1', '1.1.1.1', '1.1.1.1.1', '2', '2.1'):
            self.assertIn(f'class="article-heading-number">{number}</span>', output)
            self.assertIn(f'class="article-index-number">{number}</span>', output)

    def test_skipped_levels_have_no_zero_components(self):
        output = self.render('#### Deep\n\n## Next')
        self.assertIn('class="article-heading-number">1.1.1</span>', output)
        self.assertIn('class="article-heading-number">2</span>', output)

    def test_title_only_articles_get_an_index(self):
        index, content = BLOG['article_parts']('<p>No subheadings.</p>', 'Short article')
        self.assertNotIn('href="#article-title"', index)
        self.assertIn('No subsections.', index)
        self.assertEqual(content, '<p>No subheadings.</p>')

    def test_explicit_title_is_preserved_without_numbering(self):
        index, content = BLOG['article_parts'](BLOG['markdown_to_html']('# Title\n\n## Section'), 'Title')
        self.assertIn('<h1 id="section-title" class="article-heading"><span>Title</span></h1>', content)
        self.assertIn('class="article-heading-number">1</span><span>Section</span>', content)
        self.assertNotIn('href="#article-title"', index)
        self.assertNotIn('href="#section-title"', index)
        self.assertIn('href="#section-section"', index)

    def test_file_info_escapes_metadata_and_handles_missing_dates(self):
        output = BLOG['file_info']('A & B', '<example>', '', 'Guest Author', '<a href="/">home</a>')
        self.assertIn('A &amp; B', output)
        self.assertIn('&lt;example&gt;', output)
        self.assertIn('<dt>Published</dt><dd>Not specified</dd>', output)
        self.assertIn('<dt>Author</dt><dd>Guest Author</dd>', output)

    def test_every_blog_post_gets_an_index(self):
        root = Path(__file__).resolve().parents[1]
        for page in (root / 'blog').glob('*/index.html'):
            output = page.read_text()
            self.assertIn('class="block article-index"', output, str(page))
            self.assertTrue('class="article-index-label"' in output or 'No subsections.' in output, str(page))
            self.assertIn('id="article-title"', output, str(page))

    def test_generated_blog_and_ctf_articles(self):
        root = Path(__file__).resolve().parents[1]
        for relative in ('blog/understanding-rsa-from-first-principles/index.html',
                         'ctf/warwick-cybersoc-gym/broken-file/index.html'):
            output = (root / relative).read_text()
            self.assertIn('<nav class="block article-index"', output)
            self.assertLess(output.index('class="block file-info"'), output.index('class="block article-index"'))
            self.assertLess(output.index('aria-label="Breadcrumb"'), output.index('class="block article-index"'))
            self.assertNotIn('<details', output)
            self.assertLess(output.index('class="block article-index"'), output.index('class="body blog-post"'))
            parsed = Outline()
            parsed.feed(output)
            self.assertEqual(len(parsed.ids), len(set(parsed.ids)))
            for anchor in parsed.links:
                self.assertIn(anchor, parsed.ids)
        for relative in ('blog/index.html', 'ctf/index.html',
                         'ctf/warwick-cybersoc-gym/index.html'):
            self.assertNotIn('class="block article-index"', (root / relative).read_text())


if __name__ == '__main__':
    unittest.main()
