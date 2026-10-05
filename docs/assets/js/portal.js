/* 한화 크립토 포탈 — 공용 레이어
   헤더·푸터 주입, 데이터 로딩, 카드/칩 렌더러, 드롭다운·페이저 유틸. */

export const BASE = (() => {
  // /docs 아래 어디서 열어도(로컬 file:// 포함) data 를 찾게 한다.
  const p = location.pathname;
  const i = p.lastIndexOf('/');
  return p.slice(0, i + 1);
})();

/* ── 데이터 ───────────────────────────────────────── */
const cache = new Map();
export async function load(path) {
  if (cache.has(path)) return cache.get(path);
  const p = fetch(BASE + 'data/' + path).then(r => {
    if (!r.ok) throw new Error(path + ' ' + r.status);
    return r.json();
  });
  cache.set(path, p);
  return p;
}

/* ── 유틸 ─────────────────────────────────────────── */
export const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const qs = (k, d = '') => new URLSearchParams(location.search).get(k) ?? d;

export function setParams(obj, { replace = true } = {}) {
  const u = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(obj)) {
    if (v === '' || v == null) u.delete(k); else u.set(k, v);
  }
  const url = location.pathname + (u.toString() ? '?' + u : '');
  history[replace ? 'replaceState' : 'pushState'](null, '', url);
}

export const fmtInt = n => Number(n).toLocaleString('ko-KR');
export function fmtPrice(n) {
  if (n == null || isNaN(n)) return '-';
  const a = Math.abs(n);
  const d = a >= 1000 ? 0 : a >= 100 ? 1 : a >= 1 ? 2 : a >= 0.01 ? 4 : 6;
  return Number(n).toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
}
export function fmtKRW(n) {   // 2,324.1조 / 1,515.2억 — 레퍼런스 표기
  if (!n) return '-';
  if (n >= 1e12) return (n / 1e12).toLocaleString('ko-KR', { maximumFractionDigits: 2 }) + '조';
  if (n >= 1e8) return (n / 1e8).toLocaleString('ko-KR', { maximumFractionDigits: 2 }) + '억';
  if (n >= 1e4) return (n / 1e4).toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + '만';
  return fmtPrice(n);
}
export function pct(v) {
  if (v == null || isNaN(v)) return '<span class="pct">-</span>';
  const up = v >= 0;
  return `<span class="pct ${up ? 'up' : 'down'}">${up ? '▲' : '▼'}${Math.abs(v).toFixed(2)} %</span>`;
}

/* 분류 → 썸네일 그라데이션. 레퍼런스의 'Xangle Original' 카드 자리를 채운다. */
const GRAD = {
  '마켓':   ['#7B2EFF', '#B06BFF'],
  '정책':   ['#1B1B3A', '#3B2F8F'],
  '매크로': ['#131A2F', '#1E6B8C'],
};
export function gradient(group) {
  const [a, b] = GRAD[group] || GRAD['마켓'];
  return `background:linear-gradient(126deg,${a} 0%,${b} 100%)`;
}

export function initials(sym, name) {
  if (sym) return sym.slice(0, 4);
  return (name || '?').slice(0, 2);
}

/* ── 레이아웃 주입 ─────────────────────────────────── */
const NAV = [
  ['리서치', 'research.html'],
  ['최신정보', 'latest.html'],
  ['시장동향', 'market.html'],
  ['뉴스레터', 'newsletter.html'],
];

const LOGO = `<svg class="logo-mark" viewBox="0 0 32 32" aria-hidden="true">
  <path d="M6 5l10 11L6 27l4 0 8-9 8 9 4 0L20 16 30 5l-4 0-8 9-8-9z" fill="#7B2EFF"/>
</svg>`;

export function mountChrome(current) {
  const hdr = document.createElement('header');
  hdr.className = 'hdr';
  hdr.innerHTML = `<div class="container hdr-in">
    <a class="logo" href="${BASE}index.html">${LOGO}<b>Hanwha</b><span>Crypto</span></a>
    <nav class="gnb">${NAV.map(([t, h]) =>
      `<a href="${BASE}${h}"${h === current ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav>
    <form class="hdr-search" role="search" action="${BASE}latest.html">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9A9AA5" stroke-width="2">
        <circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input name="q" placeholder="검색" aria-label="검색" value="${esc(qs('q'))}">
      <span class="kbd">⌘+K</span>
    </form>
    <div class="lang">한국어
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 9l6 6 6-6"/></svg>
    </div>
  </div>`;
  document.body.prepend(hdr);

  const ftr = document.createElement('footer');
  ftr.className = 'ftr';
  ftr.innerHTML = `<div class="container">
    <div class="ftr-in">
      <div>
        <a class="logo" href="${BASE}index.html">${LOGO}<b>Hanwha</b><span>Crypto</span></a>
        <div class="ftr-co">
          한화 디지털자산팀 · 크립토 뉴스 포탈<br>
          본 포탈은 사내 참고용으로 운영되는 비공개 서비스입니다.<br>
          데이터 출처: 한화 크립토 뉴스봇 발행 이력
        </div>
        <div class="social">
          <a href="#" aria-label="Telegram"><svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21.5 4.3 2.9 11.4c-1 .4-1 1.8 0 2.1l4.6 1.4 1.8 5.5c.3.9 1.4 1.1 2 .4l2.5-2.6 4.5 3.3c.8.6 1.9.1 2.1-.8l3-14c.2-1-.8-1.8-1.9-1.4z"/></svg></a>
          <a href="#" aria-label="X"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.2 2H21l-6.5 7.4L22 22h-6.3l-4.9-6.4L5.1 22H2.3l7-8L2 2h6.4l4.4 5.9zM17 20.3h1.6L7.1 3.6H5.4z"/></svg></a>
        </div>
      </div>
      <div><h5>서비스</h5><nav>${NAV.map(([t, h]) => `<a href="${BASE}${h}">${t}</a>`).join('')}</nav></div>
      <div><h5>안내</h5><nav><a href="#">공지사항</a><a href="#">자주 묻는 질문</a><a href="#">데이터 기준</a></nav></div>
      <div><h5>약관</h5><nav><a href="#">서비스 이용 약관</a><a href="#">개인정보처리방침</a></nav></div>
      <div><h5>문의</h5><nav><a href="#">운영팀 문의</a><a href="#">소스 제보</a></nav></div>
    </div>
    <div class="ftr-bot">
      <span>© Hanwha Digital Asset Team. 사내 참고용.</span>
      <span class="pill">Disclaimer</span>
      <button class="to-top" type="button">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M12 19V5M5 12l7-7 7 7"/></svg> 위로 가기</button>
    </div>
  </div>`;
  document.body.append(ftr);
  ftr.querySelector('.to-top').onclick = () => scrollTo({ top: 0, behavior: 'smooth' });

  addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      document.querySelector('.hdr-search input')?.focus();
    }
  });
}

/* ── 아이콘 ───────────────────────────────────────── */
export const ICON = {
  search: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9A9AA5" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  caret: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>',
  check: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12l5.5 5.5L20 7"/></svg>',
  reset: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
  grid: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg>',
  list: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  info: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
};

/* ── 커스텀 셀렉트 ─────────────────────────────────── */
export function select(el, { options, value, placeholder, searchable, onChange }) {
  let cur = value ?? '';
  const render = () => {
    const sel = options.find(o => o.value === cur);
    el.innerHTML = `
      <button type="button" ${sel ? '' : 'data-placeholder="1"'}>
        <span>${esc(sel ? sel.label : (placeholder || '전체'))}</span>${ICON.caret}
      </button>
      <div class="menu">
        ${searchable ? `<div class="menu-search">${ICON.search}
          <input placeholder="${esc(placeholder || '검색')}" aria-label="옵션 검색"></div>` : ''}
        <div class="menu-list">${options.map(o =>
          `<button type="button" data-v="${esc(o.value)}" aria-selected="${o.value === cur}">
             <span>${esc(o.label)}</span>${o.value === cur ? ICON.check : ''}</button>`).join('')}</div>
      </div>`;
    el.classList.add('select');
    el.querySelector('button').onclick = e => {
      e.stopPropagation();
      document.querySelectorAll('.select.open').forEach(s => s !== el && s.classList.remove('open'));
      el.classList.toggle('open');
      el.querySelector('.menu-search input')?.focus();
    };
    el.querySelectorAll('.menu-list button').forEach(b => {
      b.onclick = () => { cur = b.dataset.v; el.classList.remove('open'); render(); onChange?.(cur); };
    });
    const si = el.querySelector('.menu-search input');
    if (si) si.oninput = () => {
      const q = si.value.trim().toLowerCase();
      el.querySelectorAll('.menu-list button').forEach(b =>
        b.style.display = b.textContent.toLowerCase().includes(q) ? '' : 'none');
    };
  };
  render();
  addEventListener('click', () => el.classList.remove('open'));
  return { set(v) { cur = v; render(); }, get() { return cur; } };
}

/* ── 페이저 ───────────────────────────────────────── */
export function pager(el, { page, total, perPage, onGo, edges = false }) {
  const last = Math.max(1, Math.ceil(total / perPage));
  page = Math.min(Math.max(1, page), last);
  const win = 5;
  let s = Math.max(1, page - Math.floor(win / 2));
  const e = Math.min(last, s + win - 1);
  s = Math.max(1, e - win + 1);
  const btn = (label, p, dis, cur) =>
    `<button type="button" data-p="${p}" ${dis ? 'disabled' : ''}
       ${cur ? 'aria-current="true"' : ''}>${label}</button>`;
  el.innerHTML = [
    edges ? btn('«', 1, page === 1) : '',
    btn('‹', page - 1, page === 1),
    ...Array.from({ length: e - s + 1 }, (_, i) => btn(s + i, s + i, false, s + i === page)),
    btn('›', page + 1, page === last),
    edges ? btn('»', last, page === last) : '',
  ].join('');
  el.querySelectorAll('button:not(:disabled)').forEach(b => {
    b.onclick = () => onGo(Number(b.dataset.p));
  });
  el.style.display = last <= 1 ? 'none' : '';
}

/* ── 카드 ─────────────────────────────────────────── */
export function thumb(item, kind = 'HANWHA BRIEF') {
  return `<div class="thumb" style="${gradient(item.g)}">
    <span class="badge-orig">Hanwha Original</span>
    <span class="thumb-k">${esc(kind)}</span>
    <span class="thumb-t">${esc(item.cl)}</span>
    <span class="thumb-s">${esc(item.date)}</span>
    <span class="thumb-brand">Hanwha <i>CRYPTO</i></span>
  </div>`;
}

export const hrefOf = it => BASE + (it.href || `article.html?id=${it.id}&ym=${it.ym}`);

export function cardHTML(it) {
  return `<a class="card" href="${hrefOf(it)}">
    ${thumb(it)}
    <div class="card-pad">
      <h3 class="card-title">${esc(it.t)}</h3>
      <p class="card-desc">${esc(it.d)}</p>
      <div class="card-tags">${(it.tg || []).slice(0, 3).map(t =>
        `<span class="chip">${esc(t)}</span>`).join('')}</div>
      <div class="card-meta">
        <span class="author">
          <span class="avatar" style="background:${esc(it.ac)}">${esc(initials(it.as, it.an))}</span>
          ${esc(it.an)}
        </span>
        <span class="date">${esc(it.date)}</span>
      </div>
    </div>
  </a>`;
}

export function listHTML(it) {
  return `<a class="list-item" href="${hrefOf(it)}">
    ${thumb(it)}
    <div>
      <span class="date">${esc(it.date)}</span>
      <h3 class="card-title">${esc(it.t)}</h3>
      <p class="card-desc">${esc(it.d)}</p>
      <div class="card-tags">${(it.tg || []).slice(0, 3).map(t =>
        `<span class="chip">${esc(t)}</span>`).join('')}</div>
      <span class="author">
        <span class="avatar" style="background:${esc(it.ac)}">${esc(initials(it.as, it.an))}</span>
        ${esc(it.an)}
      </span>
    </div>
  </a>`;
}

/* 기간 필터 — 레퍼런스와 같은 구간 */
export const PERIODS = [
  { value: '', label: '기간 전체' }, { value: '1', label: '1일' },
  { value: '7', label: '1주' }, { value: '30', label: '1개월' },
  { value: '90', label: '3개월' }, { value: '180', label: '6개월' },
  { value: '365', label: '1년' },
];
export function withinPeriod(ts, days) {
  if (!days) return true;
  return ts * 1000 >= Date.now() - Number(days) * 864e5;
}
