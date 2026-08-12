#!/usr/bin/env python3
from __future__ import annotations

import html
import hashlib
import json
import re
import shutil
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
POSTS_DIR = ROOT / "blog-posts"
OUTPUT_DIR = ROOT / "blog"


@dataclass
class Post:
    title: str
    slug: str
    date: str
    description: str
    body: str
    html: str


@dataclass
class ChartSeries:
    name: str
    values: list[float]


def parse_front_matter(raw: str) -> tuple[dict[str, str], str]:
    if not raw.startswith("---\n"):
        return {}, raw

    _, front_matter, body = raw.split("---\n", 2)
    meta: dict[str, str] = {}

    for line in front_matter.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        meta[key.strip().lower()] = value.strip().strip('"')

    return meta, body.strip()


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "post"


def inline_markdown(value: str) -> str:
    value = html.escape(value)
    value = re.sub(r"`([^`]+)`", r"<code>\1</code>", value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", value)
    value = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", value)
    value = re.sub(
        r"\[([^\]]+)\]\((https?://[^)]+|[^)]+)\)",
        lambda match: (
            f'<a href="{html.escape(html.unescape(match.group(2)), quote=True)}">'
            f"{html.escape(html.unescape(match.group(1)))}</a>"
        ),
        value,
    )
    return value


def flush_paragraph(parts: list[str], output: list[str]) -> None:
    if not parts:
        return
    output.append(f"<p>{inline_markdown(' '.join(parts))}</p>")
    parts.clear()


def flush_list(items: list[str], output: list[str]) -> None:
    if not items:
        return
    output.append("<ul>")
    for item in items:
        output.append(f"  <li>{inline_markdown(item)}</li>")
    output.append("</ul>")
    items.clear()


def flush_quote(lines: list[str], output: list[str]) -> None:
    if not lines:
        return

    output.append("<blockquote>")
    output.append(f"  <p>{inline_markdown(' '.join(lines))}</p>")
    output.append("</blockquote>")
    lines.clear()


def is_table_separator(line: str) -> bool:
    cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells)


def split_table_row(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def flush_table(rows: list[list[str]], output: list[str]) -> None:
    if len(rows) < 2:
        rows.clear()
        return

    headers = rows[0]
    body_rows = rows[2:] if is_table_separator("|".join(rows[1])) else rows[1:]

    output.append('<div class="table-wrap">')
    output.append("<table>")
    output.append("  <thead>")
    output.append("    <tr>")
    for header in headers:
        output.append(f"      <th>{inline_markdown(header)}</th>")
    output.append("    </tr>")
    output.append("  </thead>")
    output.append("  <tbody>")
    for row in body_rows:
        output.append("    <tr>")
        for cell in row:
            output.append(f"      <td>{inline_markdown(cell)}</td>")
        output.append("    </tr>")
    output.append("  </tbody>")
    output.append("</table>")
    output.append("</div>")
    rows.clear()


def code_block_to_html(language: str, code: str) -> str:
    if language == "mermaid":
        return f'<div class="mermaid">{html.escape(code)}</div>'

    if language in {"math", "tex", "latex"}:
        return f'<div class="math-block">\\[\n{html.escape(code)}\n\\]</div>'

    chart_type = chart_language(language)
    if chart_type:
        return chart_to_html(chart_type, code)

    class_name = f' class="language-{html.escape(language, quote=True)}"' if language else ""
    label = f'<div class="code-label">{html.escape(language)}</div>' if language else ""
    lines = code.splitlines() or [""]
    numbered_lines = []

    for number, line in enumerate(lines, start=1):
        numbered_lines.append(
            '<span class="code-line">'
            f'<span class="line-number" aria-hidden="true">{number}</span>'
            f'<span class="line-content">{highlight_code_line(language, line)}</span>'
            "</span>"
        )

    return (
        '<div class="code-block">'
        f"{label}"
        '<button class="copy-code" type="button">copy</button>'
        f"<pre><code{class_name}>{''.join(numbered_lines)}</code></pre>"
        "</div>"
    )


def chart_language(language: str) -> str | None:
    normalized = language.replace("_", "-")
    aliases = {
        "bar": "bar",
        "bar-chart": "bar",
        "chart-bar": "bar",
        "line": "line",
        "line-chart": "line",
        "chart-line": "line",
        "scatter": "scatter",
        "scatter-chart": "scatter",
        "chart-scatter": "scatter",
        "area": "area",
        "area-chart": "area",
        "chart-area": "area",
        "stacked-bar": "stacked-bar",
        "stacked-bar-chart": "stacked-bar",
        "chart-stacked-bar": "stacked-bar",
        "horizontal-bar": "horizontal-bar",
        "horizontal-bar-chart": "horizontal-bar",
        "chart-horizontal-bar": "horizontal-bar",
        "pie": "pie",
        "pie-chart": "pie",
        "chart-pie": "pie",
        "donut": "donut",
        "donut-chart": "donut",
        "chart-donut": "donut",
    }
    return aliases.get(normalized)


def chart_to_html(chart_type: str, source: str) -> str:
    title, x_label, y_label, labels, series = parse_chart(source)
    if not labels or not series:
        return code_block_to_html("", source)

    chart_id = "chart-" + hashlib.sha1(f"{chart_type}\n{source}".encode()).hexdigest()[:12]
    payload = {
        "type": chart_type,
        "title": title,
        "xLabel": x_label,
        "yLabel": y_label,
        "labels": labels,
        "series": [{"name": item.name, "values": item.values} for item in series],
    }

    chart_json = json.dumps(payload, separators=(",", ":")).replace("</", "<\\/")

    return (
        f'<div class="chart-wrap" data-chart-type="{html.escape(chart_type, quote=True)}">'
        f'<canvas id="{chart_id}" class="data-chart" aria-label="{html.escape(title or "Data chart", quote=True)}"></canvas>'
        f'<script type="application/json" class="chart-data" data-chart-target="{chart_id}">'
        f"{chart_json}"
        "</script>"
        "</div>"
    )


def parse_chart(source: str) -> tuple[str, str, str, list[str], list[ChartSeries]]:
    title = ""
    x_label = ""
    y_label = ""
    rows: list[list[str]] = []

    for raw_line in source.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        key_match = re.match(r"^(title|x|y)\s*:\s*(.+)$", line, re.IGNORECASE)
        if key_match:
            key = key_match.group(1).lower()
            value = key_match.group(2).strip()
            if key == "title":
                title = value
            elif key == "x":
                x_label = value
            elif key == "y":
                y_label = value
            continue

        delimiter = "|" if "|" in line else ","
        rows.append([cell.strip() for cell in line.split(delimiter)])

    if len(rows) < 2:
        return title, x_label, y_label, [], []

    first_data_index = 0
    if any(not is_float(cell) for cell in rows[0][1:]):
        headers = rows[0]
        first_data_index = 1
    else:
        headers = ["Label", "Value"]

    labels: list[str] = []
    columns: list[list[float]] = [[] for _ in range(max(1, len(headers) - 1))]

    for row in rows[first_data_index:]:
        if len(row) < 2:
            continue
        numeric_values = [parse_float(cell) for cell in row[1:]]
        if any(value is None for value in numeric_values):
            continue
        labels.append(row[0])
        for index, value in enumerate(numeric_values):
            if index >= len(columns):
                columns.append([])
            columns[index].append(float(value))

    series = [
        ChartSeries(headers[index + 1] if index + 1 < len(headers) else f"Series {index + 1}", values)
        for index, values in enumerate(columns)
        if len(values) == len(labels)
    ]
    return title, x_label, y_label, labels, series


def is_float(value: str) -> bool:
    return parse_float(value) is not None


def parse_float(value: str) -> float | None:
    try:
        return float(value.replace("_", ""))
    except ValueError:
        return None


def highlight_code_line(language: str, line: str) -> str:
    comment_start = comment_index(language, line)

    if comment_start is None:
        return highlight_code_without_comment(language, line)

    code = line[:comment_start]
    comment = line[comment_start:]
    return (
        highlight_code_without_comment(language, code)
        + f'<span class="tok-comment">{html.escape(comment)}</span>'
    )


def comment_index(language: str, line: str) -> int | None:
    if language not in {"python", "py", "bash", "sh", "shell", "yaml", "yml"}:
        return None

    quote: str | None = None
    escaped = False

    for index, character in enumerate(line):
        if escaped:
            escaped = False
            continue

        if character == "\\":
            escaped = True
            continue

        if quote:
            if character == quote:
                quote = None
            continue

        if character in {'"', "'"}:
            quote = character
            continue

        if character == "#":
            return index

    return None


def highlight_code_without_comment(language: str, line: str) -> str:
    parts = re.split(r'("(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\')', line)
    highlighted = []

    for part in parts:
        if not part:
            continue

        if part.startswith(('"', "'")):
            highlighted.append(f'<span class="tok-string">{html.escape(part)}</span>')
        else:
            highlighted.append(highlight_plain_code(language, part))

    return "".join(highlighted)


def highlight_plain_code(language: str, text: str) -> str:
    escaped = html.escape(text)

    if language in {"python", "py"}:
        keywords = (
            "False|None|True|and|as|assert|async|await|break|class|continue|def|"
            "del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|"
            "nonlocal|not|or|pass|raise|return|try|while|with|yield"
        )
        escaped = re.sub(
            rf"\b({keywords})\b",
            r'<span class="tok-keyword">\1</span>',
            escaped,
        )

    elif language in {"bash", "sh", "shell"}:
        keywords = "case|do|done|elif|else|esac|fi|for|function|if|in|then|while"
        escaped = re.sub(
            rf"\b({keywords})\b",
            r'<span class="tok-keyword">\1</span>',
            escaped,
        )
        escaped = re.sub(r"(?<!\w)(-{1,2}[a-zA-Z0-9-]+)", r'<span class="tok-flag">\1</span>', escaped)

    elif language in {"yaml", "yml"}:
        escaped = re.sub(
            r"^(\s*-?\s*)([A-Za-z0-9_-]+)(:)",
            r'\1<span class="tok-key">\2</span>\3',
            escaped,
        )

    escaped = re.sub(r"\b(\d+(?:\.\d+)?)\b", r'<span class="tok-number">\1</span>', escaped)
    return escaped


def markdown_to_html(markdown: str) -> str:
    output: list[str] = []
    paragraph: list[str] = []
    list_items: list[str] = []
    table_rows: list[list[str]] = []
    quote_lines: list[str] = []
    code_lines: list[str] = []
    code_language = ""
    in_code = False

    for raw_line in markdown.splitlines():
        line = raw_line.rstrip()

        if line.startswith("```"):
            if in_code:
                output.append(code_block_to_html(code_language, chr(10).join(code_lines)))
                code_lines.clear()
                code_language = ""
                in_code = False
            else:
                flush_paragraph(paragraph, output)
                flush_list(list_items, output)
                flush_table(table_rows, output)
                flush_quote(quote_lines, output)
                code_language = line.removeprefix("```").strip().lower()
                in_code = True
            continue

        if in_code:
            code_lines.append(line)
            continue

        if not line:
            flush_paragraph(paragraph, output)
            flush_list(list_items, output)
            flush_table(table_rows, output)
            flush_quote(quote_lines, output)
            continue

        if line.startswith(">"):
            flush_paragraph(paragraph, output)
            flush_list(list_items, output)
            flush_table(table_rows, output)
            quote_lines.append(line.removeprefix(">").strip())
            continue

        heading = re.match(r"^(#{1,3})\s+(.+)$", line)
        if heading:
            flush_paragraph(paragraph, output)
            flush_list(list_items, output)
            flush_table(table_rows, output)
            flush_quote(quote_lines, output)
            level = len(heading.group(1))
            output.append(f"<h{level}>{inline_markdown(heading.group(2))}</h{level}>")
            continue

        item = re.match(r"^[-*]\s+(.+)$", line)
        if item:
            flush_paragraph(paragraph, output)
            flush_table(table_rows, output)
            flush_quote(quote_lines, output)
            list_items.append(item.group(1))
            continue

        if "|" in line and line.strip().startswith("|") and line.strip().endswith("|"):
            flush_paragraph(paragraph, output)
            flush_list(list_items, output)
            flush_quote(quote_lines, output)
            table_rows.append(split_table_row(line))
            continue

        flush_table(table_rows, output)
        flush_quote(quote_lines, output)
        paragraph.append(line)

    flush_paragraph(paragraph, output)
    flush_list(list_items, output)
    flush_table(table_rows, output)
    flush_quote(quote_lines, output)

    if in_code:
        output.append(code_block_to_html(code_language, chr(10).join(code_lines)))

    return "\n".join(output)


def remove_duplicate_title_heading(body: str, title: str) -> str:
    lines = body.splitlines()
    if not lines:
        return body

    first_heading = re.match(r"^#\s+(.+)$", lines[0].strip())
    if first_heading and first_heading.group(1).strip().lower() == title.strip().lower():
        return "\n".join(lines[1:]).lstrip()

    return body


def page_shell(title: str, body: str, stylesheet: str, banner: str, home: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{html.escape(title)} | monnickendam.ch</title>
    <link rel="stylesheet" href="{stylesheet}">
    <script>
      window.MathJax = {{
        tex: {{
          inlineMath: [["$", "$"], ["\\\\(", "\\\\)"]],
          displayMath: [["$$", "$$"], ["\\\\[", "\\\\]"]]
        }},
        svg: {{ fontCache: "global" }}
      }};
    </script>
    <script defer src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
    <script type="module">
      import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";
      mermaid.initialize({{
        startOnLoad: true,
        theme: "base",
        themeVariables: {{
          background: "#020305",
          mainBkg: "#050608",
          primaryColor: "#050608",
          primaryTextColor: "#EFE5C0",
          primaryBorderColor: "#EFE5C0",
          lineColor: "#EFE5C0",
          secondaryColor: "#020305",
          secondaryTextColor: "#EFE5C0",
          secondaryBorderColor: "#EFE5C0",
          tertiaryColor: "#050608",
          tertiaryTextColor: "#EFE5C0",
          tertiaryBorderColor: "#EFE5C0",
          nodeTextColor: "#EFE5C0",
          textColor: "#EFE5C0",
          actorBkg: "#050608",
          actorTextColor: "#EFE5C0",
          actorBorder: "#EFE5C0",
          signalColor: "#EFE5C0",
          signalTextColor: "#EFE5C0",
          labelBoxBkgColor: "#050608",
          labelTextColor: "#EFE5C0",
          noteBkgColor: "#050608",
          noteTextColor: "#EFE5C0",
          noteBorderColor: "#EFE5C0",
          activationBkgColor: "#050608",
          activationBorderColor: "#EFE5C0",
          git0: "#EFE5C0",
          git1: "#EFE5C0",
          git2: "#EFE5C0",
          git3: "#EFE5C0",
          git4: "#EFE5C0",
          git5: "#EFE5C0",
          git6: "#EFE5C0",
          git7: "#EFE5C0",
          gitBranchLabel0: "#EFE5C0",
          gitBranchLabel1: "#EFE5C0",
          gitBranchLabel2: "#EFE5C0",
          gitBranchLabel3: "#EFE5C0",
          gitBranchLabel4: "#EFE5C0",
          gitBranchLabel5: "#EFE5C0",
          gitBranchLabel6: "#EFE5C0",
          gitBranchLabel7: "#EFE5C0",
          gitBranchLabelBackground: "#050608",
          commitLabelColor: "#EFE5C0",
          commitLabelBackground: "#050608",
          commitLabelFontSize: "11px",
          commitLabelPadding: "6px",
          tagLabelColor: "#EFE5C0",
          tagLabelBackground: "#050608",
          tagLabelBorder: "#EFE5C0",
          fontFamily: "JetBrains Mono, Courier New, monospace"
        }}
      }});
    </script>
    <script defer>
      document.addEventListener("DOMContentLoaded", () => {{
        const chartText = "#EFE5C0";
        const chartPanel = "#050608";
        const chartGrid = "rgba(239, 229, 192, 0.25)";
        const chartSeries = [
          {{ backgroundColor: "#EFE5C0", borderColor: "#EFE5C0" }},
          {{ backgroundColor: "rgba(239, 229, 192, 0.18)", borderColor: "#EFE5C0", borderDash: [6, 4] }},
          {{ backgroundColor: "rgba(239, 229, 192, 0.42)", borderColor: "#EFE5C0", borderDash: [2, 3] }},
          {{ backgroundColor: "rgba(239, 229, 192, 0.08)", borderColor: "#EFE5C0", borderWidth: 3 }}
        ];

        const commonChartOptions = (payload, extra = {{}}) => ({{
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          layout: {{ padding: 8 }},
          plugins: {{
            title: {{
              display: Boolean(payload.title),
              text: payload.title,
              color: chartText,
              font: {{ family: "JetBrains Mono, Courier New, monospace", size: 14, weight: "normal" }},
              padding: {{ bottom: 14 }}
            }},
            legend: {{
              display: payload.series.length > 1 || ["pie", "donut"].includes(payload.type),
              labels: {{
                color: chartText,
                boxWidth: 14,
                boxHeight: 10,
                font: {{ family: "JetBrains Mono, Courier New, monospace", size: 11 }}
              }}
            }},
            tooltip: {{
              backgroundColor: chartPanel,
              borderColor: chartText,
              borderWidth: 1,
              titleColor: chartText,
              bodyColor: chartText,
              displayColors: false,
              titleFont: {{ family: "JetBrains Mono, Courier New, monospace" }},
              bodyFont: {{ family: "JetBrains Mono, Courier New, monospace" }}
            }}
          }},
          scales: {{
            x: {{
              stacked: payload.type === "stacked-bar",
              title: {{
                display: Boolean(payload.xLabel),
                text: payload.xLabel,
                color: chartText,
                font: {{ family: "JetBrains Mono, Courier New, monospace", size: 11 }}
              }},
              ticks: {{
                color: chartText,
                maxRotation: 35,
                minRotation: 0,
                font: {{ family: "JetBrains Mono, Courier New, monospace", size: 11 }}
              }},
              grid: {{ color: chartGrid }},
              border: {{ color: chartText }}
            }},
            y: {{
              stacked: payload.type === "stacked-bar",
              title: {{
                display: Boolean(payload.yLabel),
                text: payload.yLabel,
                color: chartText,
                font: {{ family: "JetBrains Mono, Courier New, monospace", size: 11 }}
              }},
              ticks: {{
                color: chartText,
                font: {{ family: "JetBrains Mono, Courier New, monospace", size: 11 }}
              }},
              grid: {{ color: chartGrid }},
              border: {{ color: chartText }}
            }}
          }},
          ...extra
        }});

        const seriesStyle = (index, overrides = {{}}) => ({{
          borderColor: chartSeries[index % chartSeries.length].borderColor,
          backgroundColor: chartSeries[index % chartSeries.length].backgroundColor,
          borderDash: chartSeries[index % chartSeries.length].borderDash,
          borderWidth: chartSeries[index % chartSeries.length].borderWidth ?? 1.5,
          pointBackgroundColor: chartPanel,
          pointBorderColor: chartText,
          pointRadius: 3,
          tension: 0.25,
          ...overrides
        }});

        const doughnutPalette = (count) => Array.from({{ length: count }}, (_, index) => [
          "#EFE5C0",
          "rgba(239, 229, 192, 0.18)",
          "rgba(239, 229, 192, 0.42)",
          "rgba(239, 229, 192, 0.08)"
        ][index % 4]);

        const chartConfig = (payload) => {{
          if (payload.type === "scatter") {{
            return {{
              type: "scatter",
              data: {{
                datasets: [{{
                  label: payload.yLabel || payload.series[1]?.name || "Value",
                  data: payload.labels.map((label, index) => ({{
                    x: payload.series[0].values[index],
                    y: payload.series[1].values[index],
                    label
                  }})),
                  ...seriesStyle(0)
                }}]
              }},
              options: commonChartOptions(payload)
            }};
          }}

          if (["pie", "donut"].includes(payload.type)) {{
            return {{
              type: payload.type === "donut" ? "doughnut" : "pie",
              data: {{
                labels: payload.labels,
                datasets: [{{
                  label: payload.series[0]?.name || "Value",
                  data: payload.series[0]?.values || [],
                  backgroundColor: doughnutPalette(payload.labels.length),
                  borderColor: chartText,
                  borderWidth: 1.5
                }}]
              }},
              options: commonChartOptions(payload, {{ scales: {{}} }})
            }};
          }}

          const type = ["bar", "stacked-bar", "horizontal-bar"].includes(payload.type) ? "bar" : "line";
          return {{
            type,
            data: {{
              labels: payload.labels,
              datasets: payload.series.map((item, index) => seriesStyle(index, {{
                label: item.name,
                data: item.values,
                fill: payload.type === "area",
                backgroundColor: payload.type === "area"
                  ? chartSeries[index % chartSeries.length].backgroundColor
                  : chartSeries[index % chartSeries.length].backgroundColor
              }}))
            }},
            options: commonChartOptions(payload, payload.type === "horizontal-bar" ? {{ indexAxis: "y" }} : {{}})
          }};
        }};

        if (window.Chart) {{
          Chart.defaults.color = chartText;
          Chart.defaults.font.family = "JetBrains Mono, Courier New, monospace";

          document.querySelectorAll(".chart-data").forEach((script) => {{
            const target = document.getElementById(script.dataset.chartTarget);
            if (!target) return;
            const payload = JSON.parse(script.textContent);
            new Chart(target, chartConfig(payload));
          }});
        }}

        document.querySelectorAll(".copy-code").forEach((button) => {{
          button.addEventListener("click", async () => {{
            const block = button.closest(".code-block");
            const code = Array.from(block?.querySelectorAll(".line-content") ?? [])
              .map((line) => line.textContent)
              .join("\\n");
            const originalText = button.textContent;

            try {{
              await navigator.clipboard.writeText(code);
              button.textContent = "copied";
              setTimeout(() => {{
                button.textContent = originalText;
              }}, 1200);
            }} catch {{
              button.textContent = "failed";
              setTimeout(() => {{
                button.textContent = originalText;
              }}, 1200);
            }}
          }});
        }});
      }});
    </script>
</head>
<body>
<div class="container">
    <a class="banner" href="{home}">
      <img src="{banner}" alt="monnickendam.ch">
    </a>
{body}
</div>
</body>
</html>
"""


def read_posts() -> list[Post]:
    posts: list[Post] = []

    for path in sorted(POSTS_DIR.glob("*.md")):
        meta, body = parse_front_matter(path.read_text(encoding="utf-8"))
        title = meta.get("title", path.stem.replace("-", " ").title())
        slug = meta.get("slug", slugify(title))
        date = meta.get("date", "")
        description = meta.get("description", "")
        body = remove_duplicate_title_heading(body, title)
        posts.append(
            Post(
                title=title,
                slug=slug,
                date=date,
                description=description,
                body=body,
                html=markdown_to_html(body),
            )
        )

    return sorted(posts, key=lambda post: post.date, reverse=True)


def publication_numbers(posts: list[Post]) -> dict[str, int]:
    ordered_posts = sorted(posts, key=lambda post: (post.date, post.slug))
    return {post.slug: number for number, post in enumerate(ordered_posts, start=1)}


def build_index(posts: list[Post]) -> None:
    items = []
    numbers = publication_numbers(posts)

    for post in posts:
        number = numbers[post.slug]
        date = f"<p>{html.escape(post.date)}</p>" if post.date else ""
        description = (
            f"<p>{inline_markdown(post.description)}</p>" if post.description else ""
        )
        items.append(
            f"""          <div class="blog-list-entry">
            <h3>[{number:02d}] <a href="{post.slug}/">{html.escape(post.title)}</a></h3>
            {date}
            {description}
          </div>"""
        )

    if not items:
        items.append("          <p>No posts yet.</p>")

    body = f"""    <div class="block">
        <div class="header path-header"><a href="../index.html">home</a>/blog</div>
        <div class="body blog-list">
{chr(10).join(items)}
        </div>
    </div>"""

    (OUTPUT_DIR / "index.html").write_text(
        page_shell("Blog", body, "../styles.css", "../assets/banner.png", "../index.html"),
        encoding="utf-8",
    )


def build_post(post: Post) -> None:
    post_dir = OUTPUT_DIR / post.slug
    post_dir.mkdir(parents=True, exist_ok=True)

    date = f"<p class=\"blog-date\">{html.escape(post.date)}</p>" if post.date else ""
    body = f"""    <div class="block">
        <div class="header path-header"><a href="../../index.html">home</a>/<a href="../">blog</a>/{html.escape(post.slug)}.md</div>
        <div class="body blog-post">
          <h1>{html.escape(post.title)}</h1>
          {date}
{post.html}
        </div>
    </div>"""

    (post_dir / "index.html").write_text(
        page_shell(
            post.title,
            body,
            "../../styles.css",
            "../../assets/banner.png",
            "../../index.html",
        ),
        encoding="utf-8",
    )


def main() -> None:
    posts = read_posts()

    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)
    OUTPUT_DIR.mkdir(parents=True)

    build_index(posts)
    for post in posts:
        build_post(post)

    print(f"Built {len(posts)} blog post(s) into {OUTPUT_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
