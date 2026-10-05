"""발행 원문(HTML)을 구조화된 필드로 되돌린다.

봇의 publisher.render() 가 만든 문자열을 역으로 읽는다. 포맷이 바뀌면
여기만 고치면 된다. 원본 봇 코드는 절대 건드리지 않는다.
"""
import html
import re

# render() 가 쓰는 블록 구분자
_RE_HEAD = re.compile(r"^(?P<emoji>\S+)?\s*<b>(?P<title>.+?)</b>\s*$", re.M)
_RE_SECTION = re.compile(r"📁\s*<b>(?P<t>.+?)</b>")
_RE_QUOTE = re.compile(r"<blockquote(?: expandable)?>(?P<body>.*?)</blockquote>", re.S)
_RE_SOURCE = re.compile(r'<a href="(?P<url>[^"]+)">[^<]*</a>\s*(?:-\s*(?P<name>.+))?$', re.M)
_RE_TAGS = re.compile(r"(#[^\s#]+)")
_RE_POSTED = re.compile(r"🕒\s*(?P<v>.+?)\s*게시")
_RE_TAG_STRIP = re.compile(r"<[^>]+>")


def _text(s: str) -> str:
    return html.unescape(_RE_TAG_STRIP.sub("", s or "")).strip()


def parse(raw: str) -> dict:
    """발행 HTML → dict. 실패해도 예외를 내지 않고 가능한 만큼 채운다."""
    out = {
        "emoji": "📰", "headline": "", "lede": "", "section_title": "",
        "bullets": [], "comment": "", "posted": "", "source_url": "",
        "source_name": "", "tags": [], "quotes": [],
    }
    if not raw:
        return out

    lines = raw.split("\n")

    m = _RE_HEAD.search(raw)
    if m:
        out["emoji"] = (m.group("emoji") or "📰").strip()
        out["headline"] = _text(m.group("title"))

    for ln in lines:
        s = ln.strip()
        if s.startswith("☑️") and not out["lede"]:
            out["lede"] = _text(s[2:])
        elif s.startswith("🐧") and not out["comment"]:
            out["comment"] = _text(s[2:])

    m = _RE_SECTION.search(raw)
    if m:
        out["section_title"] = _text(m.group("t"))

    quotes = _RE_QUOTE.findall(raw)
    if quotes:
        # 첫 인용 블록이 핵심 bullet. 나머지(원문 인용)는 따로 둔다.
        out["bullets"] = [
            _text(b).lstrip("•").strip()
            for b in quotes[0].split("\n") if _text(b).strip()
        ]
        out["quotes"] = [_text(q) for q in quotes[1:]]

    m = _RE_POSTED.search(raw)
    if m:
        out["posted"] = _text(m.group("v"))

    m = _RE_SOURCE.search(raw)
    if m:
        out["source_url"] = m.group("url")
        out["source_name"] = _text(m.group("name") or "")

    tail = lines[-1].strip() if lines else ""
    if tail.startswith("#"):
        out["tags"] = [t.lstrip("#") for t in _RE_TAGS.findall(_text(tail))]

    return out
