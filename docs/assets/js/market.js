/* 시세 모듈 — 공개 API 를 브라우저에서 직접 읽는다(정적 호스팅이라 서버가 없다).

   · 1H / 24H / 7D / 시가총액 : CoinGecko (KRW 환산, 한 번의 요청으로 전부)
   · 한국 거래소 가격         : 업비트 · 빗썸 · 코인원 공개 시세
   · '한국 기준시가'          : 위 세 거래소에서 잡힌 가격의 평균
   어느 한 곳이 실패해도 나머지로 표를 그린다. */

const CG = 'https://api.coingecko.com/api/v3/coins/markets'
  + '?vs_currency=krw&order=market_cap_desc&per_page=250&page=1&sparkline=false'
  + '&price_change_percentage=1h,24h,7d';

const COLORS = ['#F7931A', '#627EEA', '#23292F', '#14F195', '#F3BA2F', '#26A17B',
  '#2775CA', '#0033AD', '#C2A633', '#EB0029', '#2A5ADA', '#E84142', '#4DA2FF',
  '#7B2EFF', '#FF0420', '#8247E5', '#E6007A', '#0098EA'];
const colorOf = sym => COLORS[[...sym].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

const jget = (url, ms = 9000) => {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  return fetch(url, { signal: ac.signal })
    .then(r => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); })
    .finally(() => clearTimeout(t));
};

const memo = new Map();
const once = (k, fn) => (memo.has(k) ? memo.get(k) : (memo.set(k, fn()), memo.get(k)));

/* ── 소스별 로더 ──────────────────────────────────── */
const gecko = () => once('cg', () => jget(CG).then(list => list.map(c => ({
  sym: c.symbol.toUpperCase(), name: c.name, image: c.image,
  price: c.current_price,
  chg1: c.price_change_percentage_1h_in_currency,
  chg24: c.price_change_percentage_24h_in_currency,
  chg7: c.price_change_percentage_7d_in_currency,
  cap: c.market_cap, vol24: c.total_volume,
}))).catch(() => []));

const upbit = () => once('upbit', async () => {
  const all = await jget('https://api.upbit.com/v1/market/all');
  const krw = all.filter(m => m.market.startsWith('KRW-'));
  const names = new Map(krw.map(m => [m.market.slice(4), m.korean_name]));
  const out = new Map();
  for (let i = 0; i < krw.length; i += 100) {
    const chunk = krw.slice(i, i + 100).map(m => m.market).join(',');
    const t = await jget('https://api.upbit.com/v1/ticker?markets=' + chunk);
    for (const r of t) {
      const sym = r.market.slice(4);
      out.set(sym, {
        sym, name: names.get(sym) || sym,
        price: r.trade_price,
        chg24: r.signed_change_rate * 100,
        vol24: r.acc_trade_price_24h,
      });
    }
  }
  return out;
});

const bithumb = () => once('bithumb', async () => {
  const d = await jget('https://api.bithumb.com/public/ticker/ALL_KRW');
  const out = new Map();
  for (const [sym, v] of Object.entries(d.data || {})) {
    if (sym === 'date' || !v?.closing_price) continue;
    out.set(sym, {
      sym, name: sym,
      price: Number(v.closing_price),
      chg24: Number(v.fluctate_rate_24H),
      vol24: Number(v.acc_trade_value_24H),
    });
  }
  return out;
}).catch(() => new Map());

const coinone = () => once('coinone', async () => {
  const d = await jget('https://api.coinone.co.kr/public/v2/ticker_new/KRW?additional_data=false');
  const out = new Map();
  for (const t of d.tickers || []) {
    out.set(t.target_currency.toUpperCase(), {
      sym: t.target_currency.toUpperCase(), name: t.target_currency.toUpperCase(),
      price: Number(t.last), chg24: null,
      vol24: Number(t.quote_volume),
    });
  }
  return out;
}).catch(() => new Map());

const SAFE = p => p.catch(() => new Map());

/* ── 합치기 ───────────────────────────────────────── */
function merge(base, local, { priceFrom }) {
  // base(CoinGecko) 가 1H/7D/시총을 쥐고 있고, 국내 가격이 있으면 가격·24H를 덮어쓴다.
  const rows = [];
  const seen = new Set();
  for (const b of base) {
    const l = local?.get(b.sym);
    if (priceFrom && !l) continue;             // 그 거래소에 없는 종목은 뺀다
    seen.add(b.sym);
    rows.push({
      sym: b.sym,
      name: l?.name && /[가-힣]/.test(l.name) ? l.name : b.name,
      color: colorOf(b.sym), image: b.image,
      price: l?.price ?? b.price,
      chg1: b.chg1,
      chg24: l?.chg24 ?? b.chg24,
      chg7: b.chg7,
      cap: b.cap,
      vol24: l?.vol24 ?? b.vol24,
    });
  }
  if (local) {                                  // 국내에만 있는 종목도 살린다
    for (const [sym, l] of local) {
      if (seen.has(sym)) continue;
      rows.push({
        sym, name: l.name, color: colorOf(sym), image: '',
        price: l.price, chg1: null, chg24: l.chg24, chg7: null,
        cap: null, vol24: l.vol24,
      });
    }
  }
  return rows.sort((a, b) => (b.vol24 || 0) - (a.vol24 || 0));
}

/** source: 'korea' | 'global' | 'upbit' | 'bithumb' | 'coinone' */
export async function fetchMarket(source = 'korea') {
  const base = await gecko();

  if (source === 'global') return merge(base, null, {});
  if (source === 'upbit') return merge(base, await SAFE(upbit()), { priceFrom: 1 });
  if (source === 'bithumb') return merge(base, await SAFE(bithumb()), { priceFrom: 1 });
  if (source === 'coinone') return merge(base, await SAFE(coinone()), { priceFrom: 1 });

  // 한국 기준시가 — 잡히는 거래소 가격의 평균
  const [u, b, c] = await Promise.all([SAFE(upbit()), SAFE(bithumb()), SAFE(coinone())]);
  const avg = new Map();
  for (const sym of new Set([...u.keys(), ...b.keys(), ...c.keys()])) {
    const hits = [u.get(sym), b.get(sym), c.get(sym)].filter(x => x?.price > 0);
    if (!hits.length) continue;
    const named = hits.find(h => /[가-힣]/.test(h.name));
    avg.set(sym, {
      sym, name: named?.name || sym,
      price: hits.reduce((s, h) => s + h.price, 0) / hits.length,
      chg24: (() => {
        const v = hits.map(h => h.chg24).filter(x => x != null && !isNaN(x));
        return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
      })(),
      vol24: hits.reduce((s, h) => s + (h.vol24 || 0), 0),
      n: hits.length,
    });
  }
  return merge(base, avg, { priceFrom: 1 });
}

export const SOURCES = [
  { key: 'korea', label: '한국 기준시가', color: '#7B2EFF' },
  { key: 'global', label: '글로벌 시가', color: '#2F6BFF' },
  { key: 'upbit', label: '업비트', color: '#0E3C96' },
  { key: 'bithumb', label: '빗썸', color: '#F37321' },
  { key: 'coinone', label: '코인원', color: '#1261FF' },
];

export const SOURCE_NOTE = {
  korea: '국내 거래소인 업비트, 빗썸, 코인원의 가격을 기준으로 산출한 값으로 국내 평균 시세를 확인할 수 있습니다.',
  global: 'CoinGecko 기준 글로벌 시세를 원화로 환산한 값입니다.',
  upbit: '업비트 원화 마켓 기준 시세입니다. 1H·7D 변동률과 시가총액은 글로벌 기준입니다.',
  bithumb: '빗썸 원화 마켓 기준 시세입니다. 1H·7D 변동률과 시가총액은 글로벌 기준입니다.',
  coinone: '코인원 원화 마켓 기준 시세입니다. 1H·7D 변동률과 시가총액은 글로벌 기준입니다.',
};
