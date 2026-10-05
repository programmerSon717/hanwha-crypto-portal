/* 시세 모듈 — 공개 API 를 브라우저에서 직접 읽는다(정적 호스팅이라 서버가 없다).

   어떤 API 를 쓰고 안 쓰는지는 **실측으로 정했다**(2026-10-05, github.io origin):

     업비트 /v1/market/all   200 OK   한글 종목명 291개          → 이름 사전으로 쓴다
     업비트 /v1/ticker       차단      브라우저 origin 에서 실패   → 안 쓴다
     코인원 /public/v2/...   차단      CORS 거부                  → 안 쓴다
     빗썸  /public/ticker/ALL_KRW
                             200 OK   482개를 1회 요청으로        → 국내 시세의 기준
     CoinGecko /coins/markets
                             200 OK   1H·7D·시총을 1회 요청으로   → 보조 지표

   거래소가 429 를 뱉으면 그 응답에는 CORS 헤더가 없어서 브라우저에는
   'Failed to fetch' 로만 보인다. 그래서 요청 수를 늘리는 설계는 쓰지 않는다 —
   한 번에 전부 주는 엔드포인트만 고른다. */

const CG = 'https://api.coingecko.com/api/v3/coins/markets'
  + '?vs_currency=krw&order=market_cap_desc&per_page=250&page=1&sparkline=false'
  + '&price_change_percentage=1h,24h,7d';

const COLORS = ['#F7931A', '#627EEA', '#23292F', '#14F195', '#F3BA2F', '#26A17B',
  '#2775CA', '#0033AD', '#C2A633', '#EB0029', '#2A5ADA', '#E84142', '#4DA2FF',
  '#5A4FCF', '#FF0420', '#8247E5', '#E6007A', '#0098EA'];
const colorOf = sym => COLORS[[...sym].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

const jget = (url, ms = 12000) => {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  return fetch(url, { signal: ac.signal })
    .then(r => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); })
    .finally(() => clearTimeout(t));
};

const memo = new Map();
const once = (k, fn) => (memo.has(k) ? memo.get(k) : (memo.set(k, fn()), memo.get(k)));
const SAFE = (p, fallback) => p.catch(() => fallback);

/* ── 한글 종목명 사전 ──────────────────────────────
   빌드 때 굳혀 둔 data/names-ko.json 을 먼저 쓴다. 업비트를 런타임에
   직접 부르면 간헐적으로 막혀 종목명이 영문으로 떨어지기 때문이다(실측).
   업비트가 응답하면 그 결과로 덮어써 신규 상장까지 따라간다. */
const NAMES_URL = new URL('../../data/names-ko.json', import.meta.url).href;

const koNames = () => once('ko', async () => {
  const m = new Map();
  try {
    const baked = await jget(NAMES_URL, 6000);
    for (const [sym, name] of Object.entries(baked)) m.set(sym, name);
  } catch { /* 번들 사전이 없어도 아래 실시간 조회로 메울 수 있다 */ }

  try {
    const all = await jget('https://api.upbit.com/v1/market/all', 7000);
    for (const r of all) {
      const [q, sym] = r.market.split('-');
      if (q === 'KRW' && r.korean_name) m.set(sym, r.korean_name);
    }
  } catch { /* 막히면 번들 사전만으로 간다 */ }

  return m;
});

/* ── 글로벌 지표 (CoinGecko) ──────────────────────── */
const gecko = () => once('cg', () => SAFE(
  jget(CG).then(list => list.map(c => ({
    sym: c.symbol.toUpperCase(), name: c.name, image: c.image,
    price: c.current_price,
    chg1: c.price_change_percentage_1h_in_currency,
    chg24: c.price_change_percentage_24h_in_currency,
    chg7: c.price_change_percentage_7d_in_currency,
    cap: c.market_cap, vol24: c.total_volume,
  }))), []));

/* ── 국내 시세 (빗썸) ─────────────────────────────── */
const bithumb = () => once('bithumb', () => SAFE(
  jget('https://api.bithumb.com/public/ticker/ALL_KRW').then(d => {
    const out = new Map();
    for (const [sym, v] of Object.entries(d.data || {})) {
      if (sym === 'date' || !v?.closing_price) continue;
      const price = Number(v.closing_price);
      if (!(price > 0)) continue;
      out.set(sym, {
        sym, price,
        chg24: Number(v.fluctate_rate_24H),
        vol24: Number(v.acc_trade_value_24H),
      });
    }
    return out;
  }), new Map()));

/* ── 합치기 ───────────────────────────────────────── */
function merge(base, local, ko, { localOnly }) {
  const rows = [];
  const seen = new Set();

  for (const b of base) {
    const l = local?.get(b.sym);
    if (localOnly && !l) continue;         // 국내에 없는 종목은 뺀다
    seen.add(b.sym);

    // 거래량 열의 뜻은 '국내 거래량'이다. 국내에 상장되지 않은 종목에
    // 글로벌 거래량을 적어 넣으면 단위가 다른 값이 한 줄에 섞여
    // 순위가 통째로 뒤집힌다(실측: 국내 1위가 글로벌 코인에 밀렸다).
    // 그런 종목은 값을 비워 둔다 — 표에는 '-' 로 나오고 정렬에서는 뒤로 간다.
    const domestic = !!l || !local;
    rows.push({
      sym: b.sym,
      name: ko.get(b.sym) || b.name,       // 한글명이 있으면 언제나 그것을 쓴다
      color: colorOf(b.sym), image: b.image,
      price: l?.price ?? b.price,
      chg1: b.chg1,
      chg24: l?.chg24 ?? b.chg24,
      chg7: b.chg7,
      cap: b.cap,
      vol24: domestic ? (l?.vol24 ?? b.vol24) : null,
      offshore: !domestic,                 // 국내 미상장 표시
    });
  }

  if (local) {                              // 국내에만 상장된 종목도 살린다
    for (const [sym, l] of local) {
      if (seen.has(sym)) continue;
      rows.push({
        sym, name: ko.get(sym) || sym, color: colorOf(sym), image: '',
        price: l.price, chg1: null, chg24: l.chg24, chg7: null,
        cap: null, vol24: l.vol24,
      });
    }
  }
  return rows.sort((a, b) => (b.vol24 || 0) - (a.vol24 || 0));
}

/** source: 'korea' | 'global'
 *
 *  korea 는 **합집합**이다 — 국내 원화 마켓 종목에, 국내에 상장되지 않은
 *  주요 토큰(BUIDL 같은 토큰화 펀드·스테이블코인)까지 글로벌 시세로 함께 싣는다.
 *  국내 상장 종목은 국내 체결가로 덮어쓴다. */
export async function fetchMarket(source = 'korea') {
  const [base, ko] = await Promise.all([gecko(), koNames()]);
  if (source === 'global') return merge(base, null, ko, {});
  const bt = await bithumb();
  return merge(base, bt, ko, { localOnly: false });
}

/** 심볼 → 공식 로고 URL. 아이콘을 늦게 끼워 넣을 때 쓴다. */
export async function logoMap() {
  const base = await gecko();
  const m = new Map();
  for (const c of base) if (c.image) m.set(c.sym, c.image);
  return m;
}

/* 정렬 기준. 레퍼런스의 자산시세 목록과 같은 자리에 둔다.
   이름순은 한국어 로케일로 비교하므로 한글은 ㄱㄴㄷ, 영문 종목은 A→Z 로 묶인다. */
export const SORTS = [
  { value: 'vol',      label: '거래량 많은순' },
  { value: 'chg_desc', label: '변동률 높은순' },
  { value: 'chg_asc',  label: '변동률 낮은순' },
  { value: 'cap',      label: '시가총액순' },
  { value: 'price',    label: '가격 높은순' },
  { value: 'name',     label: '이름 ㄱㄴㄷ·ABC순' },
  { value: 'sym',      label: '심볼 ABC순' },
];

const nz = v => (v == null || isNaN(v) ? null : v);

export function sortRows(rows, key) {
  const by = (pick, dir = -1) => (a, b) => {
    const x = nz(pick(a)), y = nz(pick(b));
    if (x == null && y == null) return 0;
    if (x == null) return 1;            // 값 없는 종목은 언제나 뒤로
    if (y == null) return -1;
    return dir * (x - y);
  };
  const out = [...rows];
  switch (key) {
    case 'chg_desc': return out.sort(by(r => r.chg24, -1));
    case 'chg_asc':  return out.sort(by(r => r.chg24, 1));
    case 'cap':      return out.sort(by(r => r.cap, -1));
    case 'price':    return out.sort(by(r => r.price, -1));
    case 'name':     return out.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    case 'sym':      return out.sort((a, b) => a.sym.localeCompare(b.sym, 'en'));
    default:         return out.sort(by(r => r.vol24, -1));
  }
}

export const SOURCES = [
  { key: 'korea', label: '국내 시세', color: '#F37321' },
  { key: 'global', label: '글로벌 시가', color: '#2F6BFF' },
];

export const SOURCE_NOTE = {
  korea: '국내 원화 마켓(빗썸) 체결가를 기준으로 하고, 국내 미상장 주요 토큰(BUIDL 등 토큰화 펀드·'
       + '스테이블코인)은 글로벌 시세로 함께 싣습니다. 1H·7D 변동률과 시가총액은 글로벌 기준(CoinGecko), '
       + '종목명은 업비트 한글 표기를 따릅니다.',
  global: 'CoinGecko 기준 글로벌 시세를 원화로 환산한 값입니다.',
};
