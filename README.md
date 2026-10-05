# 한화 크립토 포탈 (Hanwha Crypto Portal)

한화 크립토 뉴스봇이 발행한 글을 **웹 포탈** 형태로 보여주는 정적 사이트입니다.
구조·레이아웃·상호작용은 `Desktop/쟁글 포탈사이트 벤치마킹/` 의 레퍼런스를 그대로 따라 만들었고,
안에 들어가는 내용과 분류 로직은 전부 한화 봇의 것입니다.

> **원본 봇은 건드리지 않습니다.** 빌드 스크립트는 봇의 `botstate.sqlite3` 를
> 임시 폴더로 **복사한 뒤 읽기 전용(`mode=ro`)으로만** 엽니다. 쓰기 경로가 없습니다.

## 구성

```
HanwhaCryptoPortal/
├── build.py                # 봇 DB(읽기전용 사본) → docs/data/*.json
├── scripts/
│   ├── parse.py            # 발행 HTML → 구조화 필드 역파싱
│   └── assets_map.py       # 해시태그·제목 → 가상자산 매핑
├── docs/                   # ← GitHub Pages 루트
│   ├── index.html          # 홈 (리서치 / 최신정보 / 자산시세 3단)
│   ├── research.html       # 리서치 (필터·정렬·기간·카드/목록·페이지네이션)
│   ├── latest.html         # 최신정보 (표 + 많이 본 / 다가오는 일정)
│   ├── market.html         # 시장동향 (거래소 탭·정렬 가능한 시세표)
│   ├── newsletter.html     # 뉴스레터 (히어로·구독 폼·소개 3단)
│   ├── article.html        # 글 상세 (사이드바 분류/태그/관련 시세 + 연관 글)
│   ├── report.html         # Weekly Hanwha 주간 리포트 상세
│   ├── assets/css/portal.css
│   ├── assets/js/portal.js # 레이아웃·셀렉트·페이저·카드 렌더러
│   ├── assets/js/market.js # 업비트·빗썸·코인원·CoinGecko 시세
│   └── data/               # 빌드 산출물(JSON)
└── .github/workflows/pages.yml
```

## 레퍼런스 ↔ 한화 봇 매핑

| 레퍼런스 화면 | 포탈 화면 | 재료 |
|---|---|---|
| 리서치 목록·필터 | `research.html` | 요점 3개 이상인 발행 글 + 주간 리포트 |
| 리서치 상세 | `article.html` | `publisher.render()` 출력 역파싱 (헤드라인/리드/소제목/불릿/코멘트/태그/출처) |
| Weekly Xangle | `report.html` | 주차별 발행 집계 + 분류 분포 + 주요 소식 표 |
| 최신정보 표 | `latest.html` | 전체 발행 이력 (제목·가상자산·분류·작성일) |
| 시장동향 | `market.html` | 국내 3대 거래소 + CoinGecko 실시간 |
| 카테고리 필터 | 공통 | 봇 `topics.CATEGORIES` 16개 키 그대로 |

필터의 "카테고리 → 하위 카테고리" 2단 구조는 봇의 분류 체계를
`마켓 / 정책 / 매크로` 세 묶음으로 올려 묶은 것입니다. 라우팅 키는 봇과 동일합니다.

## 쓰는 법

```bash
# 1) 데이터 빌드 (봇이 글을 더 발행했을 때 다시 돌린다)
python3 build.py
python3 build.py --db /다른/경로/botstate.sqlite3   # DB 위치를 바꿀 때

# 2) 로컬 확인
cd docs && python3 -m http.server 8787
# → http://localhost:8787

# 3) 배포 (GitHub Pages)
git init && git add -A && git commit -m "한화 크립토 포탈"
git branch -M main
git remote add origin git@github.com:<계정>/<저장소>.git
git push -u origin main
# 저장소 Settings → Pages → Source: GitHub Actions
```

`docs/` 를 Pages 루트로 쓰므로, Actions 없이 **Settings → Pages → Deploy from a branch →
main / docs** 로도 바로 배포됩니다.

## 시세 데이터

정적 호스팅이라 서버가 없어, 브라우저가 공개 API 를 직접 호출합니다.

- 1H / 7D / 시가총액 — CoinGecko (KRW 환산, 1회 요청)
- 한국 거래소 가격 — 업비트 · 빗썸 · 코인원 공개 시세
- **한국 기준시가** — 위 거래소에서 잡힌 가격의 평균

어느 한 곳이 실패해도 나머지로 표를 그립니다. API 호출 제한에 걸리면 표가 비는데,
잠시 뒤 새로고침하면 됩니다.

## 한계

- 레퍼런스의 카드 이미지는 디자인 자산이라 가져올 수 없어, 분류별 그라데이션 썸네일로 대체했습니다.
- 뉴스레터 구독은 접수 서버가 없어 브라우저 저장소에만 기록됩니다.
- "많이 본" 순서는 조회수 집계가 없어 글의 분량(요점 개수)을 대리 지표로 씁니다.
- 글의 조회수·일정 캘린더의 예정 일정은 봇이 수집하지 않는 데이터라 비어 있을 수 있습니다.
