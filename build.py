#!/usr/bin/env python3
"""한화 크립토 포탈 — 정적 데이터 빌더.

원본 봇(crypto-news-bot)의 발행 이력 DB를 **읽기 전용 사본**으로만 읽어
docs/data/ 아래에 정적 JSON 을 만든다. 원본 봇의 파일은 어떤 경우에도
쓰지 않는다 — 사본을 만든 뒤 그 사본만 연다.

  python3 build.py [--db <경로>] [--limit N]
"""
import argparse
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "scripts"))
import parse as parser_mod          # noqa: E402
from assets_map import detect       # noqa: E402

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "docs", "data")
KST = timezone(timedelta(hours=9))

DEFAULT_DB = os.path.expanduser(
    "~/Desktop/03_한화_업무/HanwhaDAPnews/crypto-news-bot/botstate.sqlite3"
)

# 봇 저장소가 public 이라 발행 이력 DB 를 그대로 내려받을 수 있다.
# CI 에서는 이 경로를 쓴다 — 로컬 맥이 꺼져 있어도 포탈이 갱신된다.
DEFAULT_DB_URL = ("https://raw.githubusercontent.com/"
                  "programmerSon717/crypto-news-bot/main/botstate.sqlite3")

# 봇의 topics.CATEGORIES 와 같은 키. 표시 이름만 포탈용으로 손봤다.
CATEGORIES = {
    "이슈":               {"label": "주요이슈",   "group": "마켓",   "color": "#7B2EFF"},
    "거래소이슈":          {"label": "거래소이슈", "group": "마켓",   "color": "#FFB020"},
    "국내정책":            {"label": "한국정책",   "group": "정책",   "color": "#2F6BFF"},
    "US Policy":          {"label": "미국정책",   "group": "정책",   "color": "#FF4D4F"},
    "Japan Policy":       {"label": "일본정책",   "group": "정책",   "color": "#FF7AA2"},
    "Hong Kong Policy":   {"label": "홍콩정책",   "group": "정책",   "color": "#FF4D4F"},
    "Singapore Policy":   {"label": "싱가포르정책", "group": "정책", "color": "#0ABF7F"},
    "UAE Policy":         {"label": "UAE정책",    "group": "정책",   "color": "#0ABF7F"},
    "Vietnam Policy":     {"label": "베트남정책", "group": "정책",   "color": "#FFC53D"},
    "해외정책":            {"label": "해외정책",   "group": "정책",   "color": "#FFC53D"},
    "China":              {"label": "중국정책",   "group": "정책",   "color": "#FF4D4F"},
    "Korea Rates":        {"label": "한국매크로", "group": "매크로", "color": "#2F6BFF"},
    "US Rates":           {"label": "미국매크로", "group": "매크로", "color": "#FF4D4F"},
    "Korea Equities":     {"label": "한국증시",   "group": "매크로", "color": "#2F6BFF"},
    "US Equities":        {"label": "미국증시",   "group": "매크로", "color": "#FF4D4F"},
    "Global Macro":       {"label": "글로벌매크로", "group": "매크로", "color": "#A855F7"},
}

GROUPS = ["마켓", "정책", "매크로"]


def fetch_db(url: str, dest: str):
    """공개 저장소에서 발행 이력 DB 를 내려받는다(CI 경로).

    macOS 의 python.org 빌드는 시스템 CA 를 안 보고 자체 번들을 쓰는데,
    그게 설치돼 있지 않으면 urllib 가 인증서 검증에서 바로 죽는다.
    그럴 때는 시스템 curl 로 받는다 — 어차피 같은 CA 를 쓰면 되는 일이다.
    """
    print(f"[build] DB 내려받는 중: {url}")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "hanwha-portal-build"})
        with urllib.request.urlopen(req, timeout=300) as r, open(dest, "wb") as f:
            shutil.copyfileobj(r, f)
    except Exception as e:
        print(f"[build] urllib 실패({type(e).__name__}) — curl 로 재시도")
        rc = subprocess.call(["curl", "-sSLf", "--retry", "3", "-o", dest, url])
        if rc != 0:
            raise SystemExit(f"DB 내려받기 실패: {url}")
    size = os.path.getsize(dest)
    if size < 1_000_000:
        raise SystemExit(f"받은 DB 가 너무 작다({size} bytes) — 경로를 확인해라.")
    print(f"[build] 내려받음: {size / 1e6:.1f} MB")


def open_readonly(db_path: str, db_url: str = ""):
    """원본을 건드리지 않기 위해 임시 폴더로 복사한 뒤 읽기 전용으로 연다.

    db_url 이 있으면 내려받은 것을 쓴다. 어느 쪽이든 **사본만** 열며,
    원본 봇 파일에는 쓰기 경로가 없다.
    """
    tmp = tempfile.mkdtemp(prefix="hanwha-portal-")
    copy = os.path.join(tmp, "snapshot.sqlite3")

    if db_url:
        fetch_db(db_url, copy)
        conn = sqlite3.connect(f"file:{copy}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        return conn, tmp

    if not os.path.exists(db_path):
        raise SystemExit(f"DB 를 찾을 수 없다: {db_path}\n"
                         f"  → 로컬에 없으면 --db-url 로 공개 저장소에서 받아라.")
    shutil.copy2(db_path, copy)
    for ext in ("-wal", "-shm"):          # 열려 있는 DB 의 미반영 쓰기까지 함께
        side = db_path + ext
        if os.path.exists(side):
            shutil.copy2(side, copy + ext)
    conn = sqlite3.connect(f"file:{copy}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn, tmp


def ts_of(row) -> float:
    """정렬·표시에 쓸 시각. 기사 원래 게시 시각을 우선한다."""
    for key in ("origin_at", "published_at"):
        v = row[key]
        if v in (None, ""):
            continue
        try:
            f = float(v)
        except (TypeError, ValueError):
            continue
        if f > 1_000_000_000:
            return f
    return 0.0


def iso_week(dt: datetime):
    y, w, _ = dt.isocalendar()
    return f"{y}-W{w:02d}"


def build_items(conn, limit):
    rows = conn.execute(
        "SELECT key, headline, category, lede, text, source_url, published_at,"
        " origin_at, message_id FROM published"
        " WHERE headline IS NOT NULL AND headline <> ''"
        " ORDER BY COALESCE(CAST(origin_at AS REAL), published_at) DESC"
        + (f" LIMIT {int(limit)}" if limit else "")
    ).fetchall()

    items, articles = [], defaultdict(dict)
    for r in rows:
        ts = ts_of(r)
        if not ts:
            continue
        dt = datetime.fromtimestamp(ts, KST)
        cat = r["category"] or "이슈"
        if cat not in CATEGORIES:
            cat = "이슈"
        p = parser_mod.parse(r["text"] or "")

        headline = p["headline"] or r["headline"]
        lede = p["lede"] or re.sub(r"^☑️\s*", "", (r["lede"] or "")).strip()
        tags = p["tags"]
        meta = CATEGORIES[cat]
        a_name, a_sym, a_color = detect(tags, headline, cat)
        iid = r["key"][:12]
        ym = dt.strftime("%Y-%m")

        items.append({
            "id": iid, "ym": ym,
            "t": headline,
            "d": lede,
            "c": cat, "cl": meta["label"], "g": meta["group"],
            "an": a_name, "as": a_sym, "ac": a_color,
            "ts": int(ts), "date": dt.strftime("%Y.%m.%d"),
            "tg": tags[:4],
            "nb": len(p["bullets"]),
        })
        articles[ym][iid] = {
            "id": iid, "headline": headline, "emoji": p["emoji"] or "📰",
            "lede": lede, "section_title": p["section_title"] or "주요 내용",
            "bullets": p["bullets"], "comment": p["comment"],
            "quotes": p["quotes"], "tags": tags,
            "category": cat, "category_label": meta["label"],
            "group": meta["group"], "color": meta["color"],
            "asset": a_name, "symbol": a_sym, "asset_color": a_color,
            "source_url": p["source_url"] or (r["source_url"] or ""),
            "source_name": p["source_name"] or "",
            "posted": p["posted"],
            "ts": int(ts),
            "datetime": dt.strftime("%Y.%m.%d %H:%M"),
            "date": dt.strftime("%Y.%m.%d"),
        }
    return items, articles


def build_research(items, articles, weeks=40):
    """주차별 리포트([Weekly Hanwha]) 를 만든다.

    쟁글의 [Weekly Xangle] 과 같은 자리를 차지한다 — 한 주의 시황 코멘트,
    분류별 분포, 주요 뉴스 표를 한 장으로 묶는다. 재료는 전부 봇이 이미
    발행한 글이고, 새로 지어내는 문장은 없다.
    """
    by_week = defaultdict(list)
    for it in items:
        by_week[iso_week(datetime.fromtimestamp(it["ts"], KST))].append(it)

    reports = []
    for wk in sorted(by_week, reverse=True)[:weeks]:
        group = sorted(by_week[wk], key=lambda x: x["ts"], reverse=True)
        if len(group) < 8:          # 표본이 너무 적은 주는 리포트로 내지 않는다
            continue
        end = datetime.fromtimestamp(group[0]["ts"], KST)
        start = datetime.fromtimestamp(group[-1]["ts"], KST)
        counts = Counter(i["cl"] for i in group)
        gcounts = Counter(i["g"] for i in group)
        assets = Counter(i["an"] for i in group if i["as"])

        # 대표 기사: 불릿이 많은(=내용이 두꺼운) 순으로
        top = sorted(group, key=lambda x: (x["nb"], x["ts"]), reverse=True)[:12]
        highlights = []
        for t in top:
            art = articles[t["ym"]].get(t["id"], {})
            highlights.append({
                "id": t["id"], "ym": t["ym"], "title": t["t"],
                "lede": t["d"], "cl": t["cl"], "date": t["date"],
                "bullets": art.get("bullets", [])[:3],
            })

        slug = f"weekly-{wk}"
        reports.append({
            "slug": slug, "week": wk,
            "title": f"[Weekly Hanwha] {start.strftime('%m월 %d일')}~{end.strftime('%m월 %d일')} 가상자산 주간 브리핑",
            "range": f"{start.strftime('%Y.%m.%d')} ~ {end.strftime('%Y.%m.%d')}",
            "date": end.strftime("%Y.%m.%d"),
            "ts": group[0]["ts"],
            "total": len(group),
            "by_category": counts.most_common(),
            "by_group": [[g, gcounts.get(g, 0)] for g in GROUPS],
            "top_assets": assets.most_common(8),
            "highlights": highlights,
            "tags": [c for c, _ in counts.most_common(3)],
            "author": "한화 크립토 리서치봇",
        })
    return reports


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=os.getenv("BOT_DB", DEFAULT_DB))
    ap.add_argument("--db-url", default=os.getenv("BOT_DB_URL", ""),
                    help=f"공개 저장소에서 받기. 'default' 로 주면 {DEFAULT_DB_URL}")
    ap.add_argument("--limit", type=int, default=0, help="0 이면 전체")
    args = ap.parse_args()

    url = DEFAULT_DB_URL if args.db_url == "default" else args.db_url
    conn, tmp = open_readonly(args.db, url)
    try:
        items, articles = build_items(conn, args.limit)
    finally:
        conn.close()
        shutil.rmtree(tmp, ignore_errors=True)

    if not items:
        raise SystemExit("발행 이력이 비어 있다.")

    os.makedirs(os.path.join(OUT, "articles"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "research"), exist_ok=True)
    for f in os.listdir(os.path.join(OUT, "articles")):
        os.remove(os.path.join(OUT, "articles", f))
    for f in os.listdir(os.path.join(OUT, "research")):
        os.remove(os.path.join(OUT, "research", f))

    def dump(path, obj):
        with open(os.path.join(OUT, path), "w", encoding="utf-8") as fh:
            json.dump(obj, fh, ensure_ascii=False, separators=(",", ":"))

    dump("items.json", items)
    dump("items-recent.json", items[:600])   # 홈·사이드바용 경량 묶음
    for ym, group in articles.items():
        dump(f"articles/{ym}.json", group)

    reports = build_research(items, articles)
    dump("research.json", [
        {k: v for k, v in r.items() if k != "highlights"} for r in reports
    ])
    for r in reports:
        dump(f"research/{r['slug']}.json", r)

    latest = datetime.fromtimestamp(items[0]["ts"], KST)
    cat_counts = Counter(i["c"] for i in items)
    dump("meta.json", {
        "generated_at": datetime.now(KST).strftime("%Y.%m.%d %H:%M"),
        "latest_at": latest.strftime("%Y.%m.%d %H:%M"),
        "total": len(items),
        "research_total": len(reports),
        "months": sorted(articles.keys(), reverse=True),
        "categories": [
            {"key": k, "label": v["label"], "group": v["group"],
             "color": v["color"], "count": cat_counts.get(k, 0)}
            for k, v in CATEGORIES.items()
        ],
        "groups": GROUPS,
    })

    print(f"[build] 최신정보 {len(items)}건 / 리서치 {len(reports)}편 / "
          f"월 묶음 {len(articles)}개 → docs/data")


if __name__ == "__main__":
    main()
