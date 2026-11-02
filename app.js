/* Augmented Human Lab @ UIST 2026
   Renders data/entries.json into project cards, a day-by-day schedule and a
   live "Where to find us" list. Times are shown in the conference time zone. */

const $ = (s, el = document) => el.querySelector(s);
const scroller = document.body;

const TYPE_LABEL = {
  'Paper': 'Full paper',
  'Short Papers': 'Short paper',
  'Short Paper': 'Short paper',
  'Demo': 'Demo',
  'Poster': 'Poster',
  'Doctoral Symposium': 'Doctoral Symposium',
  'Doctoral Consortium': 'Doctoral Consortium',
};
const TYPE_ICON = {
  'Full paper': 'fa-file-lines',
  'Short paper': 'fa-file-lines',
  'Demo': 'fa-hand-pointer',
  'Poster': 'fa-chalkboard-user',
  'Doctoral Symposium': 'fa-graduation-cap',
  'Doctoral Consortium': 'fa-graduation-cap',
};
const isPaper = (e) => /paper/i.test(e.kind);

let TZ = 'America/Detroit';
let conf = {};
let entries = [];

/* ── Formatting ───────────────────────────────────────── */
const fmt = (opts) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, ...opts });
const dayShort = (d) => fmt({ weekday: 'short' }).format(d);
const dayDate = (d) => fmt({ day: 'numeric', month: 'short' }).format(d).replace(/(\w+) (\d+)/, '$2 $1');
const timeOf = (d) => fmt({ hour: 'numeric', minute: '2-digit' }).format(d);
const tzAbbr = (d) => fmt({ timeZoneName: 'short' }).formatToParts(d).find((p) => p.type === 'timeZoneName')?.value ?? '';
const dayKey = (d) => fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const range = (e) => `${timeOf(e.startD)}–${timeOf(e.endD)}`;
const whenLine = (e) => `${dayShort(e.startD)} ${dayDate(e.startD)} · ${timeOf(e.startD)}`;
const where = (e) => [e.room, (e.floor ?? '').replace(/^Renaissance Center /, '')].filter(Boolean).join(' · ');
const shortName = (t) => (t.includes(':') ? t.split(':')[0].trim() : t.split(' ').slice(0, 3).join(' '));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function status(e, now = new Date()) {
  if (now >= e.endD) return 'past';
  if (now >= e.startD) return 'now';
  return 'upcoming';
}

/* ── Data ─────────────────────────────────────────────── */
async function load() {
  const res = await fetch('data/entries.json', { cache: 'no-cache' });
  const data = await res.json();
  conf = data.conference ?? {};
  TZ = conf.timezone || TZ;
  entries = data.entries.map((e) => ({
    ...e,
    kind: TYPE_LABEL[e.type] ?? e.type,
    startD: new Date(e.start),
    endD: new Date(e.end),
    hash: `p-${e.id}`,
  })).sort((a, b) => a.startD - b.startD);
}

/* Group sessions into projects: a paper and its demo are one project.
   Paper-backed projects go in "Papers"; the rest in "Demos & Posters". */
function projects() {
  const byKey = new Map();
  for (const e of entries) {
    const key = shortName(e.title).toLowerCase();
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(e);
  }
  const list = [...byKey.values()].map((items) => {
    items.sort((x, y) => isPaper(y) - isPaper(x));
    const lead = items[0];
    const image = items.map((i) => i.ahl?.image).find(Boolean) ?? null;
    return { lead, items, image };
  });
  const order = { 'Full paper': 0, 'Short paper': 1, 'Demo': 2, 'Poster': 3 };
  list.sort((a, b) => (order[a.lead.kind] ?? 4) - (order[b.lead.kind] ?? 4) || a.lead.startD - b.lead.startD);
  return {
    papers: list.filter((p) => isPaper(p.lead)),
    others: list.filter((p) => !isPaper(p.lead)),
  };
}

/* ── Rendering ────────────────────────────────────────── */
function media(p, cls = 'card-media') {
  if (p.image) return `<div class="${cls}"><img src="${esc(p.image)}" alt="" loading="lazy"></div>`;
  return `<div class="${cls} placeholder"><span class="ph-name">${esc(shortName(p.lead.title))}</span></div>`;
}

function peopleLine(e) {
  return e.authors.map((a) => (a.ahlSlug ? `<b>${esc(a.name)}</b>` : esc(a.name))).join(', ');
}

function cardHTML(p) {
  const e = p.lead;
  const chips = p.items.map((i) => `<span class="chip"><i class="fa-solid ${TYPE_ICON[i.kind] ?? 'fa-circle'}" aria-hidden="true"></i>${esc(i.kind)}</span>`);
  if ((e.awards ?? []).length) chips.push(`<span class="chip award"><i class="fa-solid fa-award" aria-hidden="true"></i>${esc(e.awards[0].name ?? e.awards[0])}</span>`);
  const when = p.items.map((i) => `<div class="card-when"><i class="fa-regular fa-clock" aria-hidden="true"></i><span>${esc(i.kind)} · ${esc(whenLine(i))}</span></div>`).join('');
  return `
    <article class="card" data-open="${e.hash}">
      ${media(p)}
      <div class="card-body">
        <div class="card-chips">${chips.join('')}</div>
        <h3><button class="card-link" type="button" data-open="${e.hash}">${esc(e.title)}</button></h3>
        <p class="card-people">${peopleLine(e)}</p>
        ${when}
      </div>
    </article>`;
}

function renderCards() {
  const { papers, others } = projects();
  const pg = $('#papersGrid');
  pg.innerHTML = papers.map(cardHTML).join('');
  pg.style.setProperty('--cols', Math.min(papers.length, 3) || 1);
  const dg = $('#demosGrid');
  dg.innerHTML = others.map(cardHTML).join('');
  dg.style.setProperty('--cols', Math.min(others.length, 3) || 1);
  if (!papers.length) $('#papers').hidden = true;
}

/* Sessions that share a time slot (the demo + poster reception) collapse
   into one row in the hero list. */
function slots() {
  const m = new Map();
  for (const e of entries) {
    const k = `${e.start}|${e.room}`;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(e);
  }
  return [...m.values()];
}

function renderFindUs() {
  const now = new Date();
  const rows = slots().map((items) => {
    const e = items[0];
    const st = status(items.reduce((a, b) => (a.endD > b.endD ? a : b)), now);
    const title = items.length > 1
      ? [...new Set(items.map((i) => i.kind))].join(' & ') + ' session'
      : shortName(e.title);
    const sub = items.length > 1
      ? items.map((i) => shortName(i.title)).join(', ')
      : `${e.kind} · ${e.room ?? ''}`;
    const badge = st === 'now' ? '<span class="chip live"><span class="live-dot"></span>Now</span>' : '';
    return `<li class="${st}"><a href="#${e.hash}" data-open="${e.hash}">
      <span class="fu-day">${esc(dayShort(e.startD))} ${esc(dayDate(e.startD))}<small>${esc(timeOf(e.startD))}</small></span>
      <span class="fu-what"><span class="fu-title"><span class="fu-name">${esc(title)}</span>${badge}</span><span class="fu-sub">${esc(sub)}</span></span>
    </a></li>`;
  });
  $('#findUs').innerHTML = rows.join('');
  const next = entries.find((e) => status(e, now) !== 'past');
  $('#findUsTitle').textContent = !next ? 'Thanks for visiting us' : 'Where to find us';
}

function renderSchedule() {
  const days = new Map();
  for (const items of slots()) {
    const k = dayKey(items[0].startD);
    if (!days.has(k)) days.set(k, []);
    days.get(k).push(items);
  }
  const html = [...days.values()].map((list) => {
    const d = list[0][0].startD;
    const rows = list.map((items) => {
      const e = items[0];
      const st = status(e);
      const head = `<span class="slot-time">${esc(range(e))}</span>
        <button class="icon-btn ics" type="button" data-ics="${e.hash}" aria-label="Add to calendar" title="Add to calendar"><i class="fa-regular fa-calendar-plus" aria-hidden="true"></i></button>`;
      const place = `<span class="slot-where"><i class="fa-solid fa-location-dot" aria-hidden="true"></i>${esc(where(e) || 'See program')}</span>`;
      if (items.length === 1) {
        return `<li class="slot ${st}" data-open="${e.hash}">${head}
          <span class="slot-title"><span class="chip soft">${esc(e.kind)}</span>${esc(shortName(e.title))}</span>${place}</li>`;
      }
      const kinds = [...new Set(items.map((i) => i.kind))].join(' & ');
      const names = items.map((i) => `<button class="name-pill" type="button" data-open="${i.hash}">${esc(shortName(i.title))}</button>`).join('');
      return `<li class="slot multi ${st}">${head}
        <span class="slot-title">${esc(e.session?.name?.replace(/,? and Student Innovation Contest/i, '') ?? `${kinds} session`)}</span>
        <span class="slot-names">${names}</span>${place}</li>`;
    }).join('');
    return `<div class="day"><div class="day-head"><h3>${esc(fmt({ weekday: 'long' }).format(d))}</h3><span>${esc(dayDate(d))}</span></div><ul class="slots">${rows}</ul></div>`;
  }).join('');
  const el = $('#days');
  el.innerHTML = html;
  el.style.setProperty('--days', days.size);
  if (entries[0]) $('#tzNote').textContent = `All times are Detroit local time (${tzAbbr(entries[0].startD)}).`;
}

function renderConf() {
  const s = conf.dates?.start && new Date(`${conf.dates.start}T12:00:00`);
  const e = conf.dates?.end && new Date(`${conf.dates.end}T12:00:00`);
  const f = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const dates = s && e ? `${s.getDate()}–${f.format(e)}` : (conf.dates?.label ?? '');
  $('[data-k="dates"]').textContent = dates;
  $('[data-k="venue"]').textContent = conf.city ? conf.city.replace(/\s*USA$/, '') : 'Detroit, MI';
  if (conf.url) $('#footConf').href = conf.url;
  if (conf.programUrl) $('#footProgram').href = conf.programUrl;
}

/* ── Detail dialog (deep-linkable: #p-<id>) ───────────── */
const dlg = $('#detail');

function openDetail(hash, push = true) {
  const e = entries.find((x) => x.hash === hash);
  if (!e) return;
  const siblings = entries.filter((x) => shortName(x.title).toLowerCase() === shortName(e.title).toLowerCase());
  const image = siblings.map((i) => i.ahl?.image).find(Boolean);
  const m = $('#detailMedia');
  m.className = `detail-media${image ? '' : ' placeholder'}`;
  m.innerHTML = image ? `<img src="${esc(image)}" alt="">` : `<span class="ph-name">${esc(shortName(e.title))}</span>`;

  const chips = siblings.map((s) => `<span class="chip"><i class="fa-solid ${TYPE_ICON[s.kind] ?? 'fa-circle'}" aria-hidden="true"></i>${esc(s.kind)}</span>`);
  (e.awards ?? []).forEach((a) => chips.push(`<span class="chip award"><i class="fa-solid fa-award" aria-hidden="true"></i>${esc(a.name ?? a)}</span>`));
  $('#detailChips').innerHTML = chips.join('');
  $('#detailTitle').textContent = e.title;
  $('#detailAuthors').innerHTML = e.authors.map((a) => {
    const aff = a.affiliations?.[0]?.institution;
    const name = a.ahlSlug ? `<a href="https://ahlab.org/people/${esc(a.ahlSlug)}/" target="_blank" rel="noopener">${esc(a.name)}</a>` : esc(a.name);
    return `${name}${aff ? ` <span class="aff">(${esc(aff)})</span>` : ''}`;
  }).join(', ');
  $('#detailWhen').innerHTML = siblings.map((s) => `
    <div><i class="fa-regular fa-clock" aria-hidden="true"></i><span><strong>${esc(s.kind)}</strong> · ${esc(dayShort(s.startD))} ${esc(dayDate(s.startD))}, ${esc(range(s))} ${esc(tzAbbr(s.startD))}</span></div>
    <div><i class="fa-solid fa-location-dot" aria-hidden="true"></i><span>${esc(where(s) || 'See program')}${s.session?.name ? ` · ${esc(s.session.name)}` : ''}</span></div>`).join('');
  $('#detailAbstract').textContent = e.abstract ?? '';

  const links = [];
  if (e.acmDlUrl || e.doi) links.push(`<a class="btn primary" href="${esc(e.acmDlUrl || `https://doi.org/${e.doi}`)}" target="_blank" rel="noopener"><i class="fa-solid fa-file-pdf" aria-hidden="true"></i>ACM Digital Library</a>`);
  siblings.forEach((s) => links.push(`<a class="btn" href="${esc(s.url)}" target="_blank" rel="noopener"><i class="fa-solid fa-calendar-days" aria-hidden="true"></i>${siblings.length > 1 ? `${esc(s.kind)} in program` : 'UIST program'}</a>`));
  const projOf = siblings.find((s) => s.ahl?.projectUrl);
  if (projOf) {
    const related = /^related/i.test(projOf.ahl.matchNote ?? '');
    links.push(`<a class="btn" href="${esc(projOf.ahl.projectUrl)}" target="_blank" rel="noopener"><i class="fa-solid fa-flask" aria-hidden="true"></i>${related ? 'Related project' : 'Project page'}</a>`);
  }
  (e.videos ?? []).forEach((v) => links.push(`<a class="btn" href="${esc(v.url ?? v)}" target="_blank" rel="noopener"><i class="fa-solid fa-play" aria-hidden="true"></i>${esc(v.label ?? 'Video')}</a>`));
  links.push(`<button class="btn" type="button" data-ics="${e.hash}"><i class="fa-regular fa-calendar-plus" aria-hidden="true"></i>Add to calendar</button>`);
  links.push(`<button class="btn" type="button" data-share="${e.hash}"><i class="fa-solid fa-link" aria-hidden="true"></i>Copy link</button>`);
  $('#detailLinks').innerHTML = links.join('');

  if (push && location.hash !== `#${hash}`) history.pushState(null, '', `#${hash}`);
  if (!dlg.open) dlg.showModal();
  $('.detail-body').scrollTop = 0;
}

function closeDetail() {
  if (dlg.open) dlg.close();
}
dlg.addEventListener('close', () => {
  if (location.hash.startsWith('#p-')) history.pushState(null, '', location.pathname + location.search);
});
dlg.addEventListener('click', (ev) => { if (ev.target === dlg) closeDetail(); });
$('#detailClose').addEventListener('click', closeDetail);

/* ── Calendar (.ics) ──────────────────────────────────── */
function icsFor(e) {
  const multi = entries.filter((x) => x.start === e.start && x.room === e.room).length > 1;
  const z = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const txt = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  const body = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Augmented Human Lab//UIST 2026//EN', 'BEGIN:VEVENT',
    `UID:uist2026-${e.id}@ahlab.org`, `DTSTAMP:${z(new Date())}`, `DTSTART:${z(e.startD)}`, `DTEND:${z(e.endD)}`,
    `SUMMARY:${txt(multi ? `AHL at UIST: ${e.session?.name ?? 'Demos & Posters'}` : `${e.kind}: ${e.title}`)}`,
    `LOCATION:${txt(`${where(e)}, Detroit Marriott at the Renaissance Center`)}`,
    `DESCRIPTION:${txt(`${e.session?.name ?? ''}\n${e.url}`)}`, `URL:${e.url}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([body], { type: 'text/calendar' }));
  a.download = `uist2026-${shortName(e.title).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${e.kind.toLowerCase().replace(/\s+/g, '-')}.ics`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ── Share ────────────────────────────────────────────── */
let toastTimer = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
async function share(url, title) {
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ title, url }); } catch (e) { /* cancelled */ }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied');
  } catch (e) {
    toast(url);
  }
}
$('#shareBtn').addEventListener('click', () => share('https://uist2026.ahlab.org/', 'Augmented Human Lab at UIST 2026'));

/* ── Clicks ───────────────────────────────────────────── */
document.addEventListener('click', (ev) => {
  const ics = ev.target.closest('[data-ics]');
  if (ics) { ev.stopPropagation(); ev.preventDefault(); icsFor(entries.find((x) => x.hash === ics.dataset.ics)); return; }
  const sh = ev.target.closest('[data-share]');
  if (sh) { const e = entries.find((x) => x.hash === sh.dataset.share); share(`https://uist2026.ahlab.org/#${e.hash}`, e.title); return; }
  const op = ev.target.closest('[data-open]');
  if (op && !ev.target.closest('dialog')) { ev.preventDefault(); openDetail(op.dataset.open); }
});
window.addEventListener('popstate', () => {
  if (location.hash.startsWith('#p-')) openDetail(location.hash.slice(1), false);
  else closeDetail();
});

/* ── Theme ────────────────────────────────────────────── */
const themeBtn = $('#themeBtn');
const sysDark = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => (document.documentElement.dataset.theme ?? (sysDark.matches ? 'dark' : 'light')) === 'dark';
function labelTheme() {
  const l = isDark() ? 'Switch to light theme' : 'Switch to dark theme';
  themeBtn.setAttribute('aria-label', l);
  themeBtn.title = l;
}
themeBtn.addEventListener('click', () => {
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('ahl-theme', next); } catch (e) { /* private mode */ }
  labelTheme();
});
sysDark.addEventListener('change', labelTheme);
labelTheme();

/* ── Video (load YouTube only on click) ───────────────── */
$('#videoPoster').addEventListener('click', () => {
  $('#videoFrame').innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/tT8RRAO4VyQ?autoplay=1&playsinline=1&rel=0&modestbranding=1" title="Augmented Human Lab overview" allow="autoplay; encrypted-media; picture-in-picture; web-share" allowfullscreen></iframe>';
});

/* ── Screen-fit groups + ↑/↓ paging ───────────────────── */
const topbar = $('#topbar');
const root = $('#home');
const barH = () => topbar.offsetHeight + 12;
new ResizeObserver(() => document.documentElement.style.setProperty('--bar-h', `${barH()}px`)).observe(topbar);

function layout() {
  const groups = [...root.querySelectorAll('.group:not([hidden])')];
  const avail = scroller.clientHeight - barH();
  groups.forEach((g) => { g.style.minHeight = ''; });
  if (innerWidth <= 900) { groups.forEach((g) => g.classList.add('screen')); return; }
  const heights = groups.map((g) => g.getBoundingClientRect().height);
  const screens = [];
  let cur = null;
  groups.forEach((g, i) => {
    const solo = g.hasAttribute('data-solo') || cur?.solo;
    if (cur && !solo && cur.sum + heights[i] <= avail + 1) {
      cur.items.push(i); cur.sum += heights[i];
    } else {
      cur = { items: [i], sum: heights[i], solo: g.hasAttribute('data-solo') };
      screens.push(cur);
    }
  });
  for (const sc of screens) {
    const extra = Math.max(0, avail - sc.sum) / sc.items.length;
    sc.items.forEach((i, k) => {
      groups[i].style.minHeight = `${heights[i] + extra}px`;
      groups[i].classList.toggle('screen', k === 0);
    });
  }
}
let raf = 0;
const relayout = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(layout); };
new ResizeObserver(relayout).observe(scroller);
document.fonts?.ready.then(relayout);
window.addEventListener('load', relayout);

let target = null;
scroller.addEventListener('scrollend', () => { target = null; });
const stops = () => [...root.querySelectorAll('.screen')].map((s) => Math.round(s.getBoundingClientRect().top + scroller.scrollTop - barH()));
function pageBy(dir) {
  const pos = target ?? scroller.scrollTop;
  const step = scroller.clientHeight - barH();
  const max = scroller.scrollHeight - scroller.clientHeight;
  const s = stops();
  let dest = dir > 0
    ? Math.min(s.find((t) => t > pos + 4) ?? max, pos + step)
    : Math.max(s.filter((t) => t < pos - 4).pop() ?? 0, pos - step);
  dest = Math.min(Math.max(dest, 0), max);
  if (dest === Math.round(pos)) return;
  target = dest;
  scroller.scrollTo({ top: dest, behavior: 'smooth' });
}
document.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || dlg.open) return;
  if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
  e.preventDefault();
  pageBy(e.key === 'ArrowDown' ? 1 : -1);
});

/* Section links land just under the app bar (body is the scroller). */
document.addEventListener('click', (ev) => {
  const a = ev.target.closest('a[href^="#"]:not([data-open])');
  if (!a) return;
  const id = a.getAttribute('href').slice(1);
  const el = id === 'top' ? root : document.getElementById(id);
  if (!el) return;
  ev.preventDefault();
  scroller.scrollTo({ top: id === 'top' ? 0 : el.getBoundingClientRect().top + scroller.scrollTop - barH(), behavior: 'smooth' });
  history.replaceState(null, '', id === 'top' ? location.pathname : `#${id}`);
});

/* App bar marks the section on screen. */
function markNav() {
  const probe = barH() + (scroller.clientHeight - barH()) * 0.4;
  let current = null;
  for (const s of root.querySelectorAll('[data-nav-section]:not([hidden])')) {
    const r = s.getBoundingClientRect();
    if (r.top <= probe && r.bottom > probe) current = s.dataset.navSection;
  }
  if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) current = 'lab';
  document.querySelectorAll('[data-nav]').forEach((a) => a.toggleAttribute('aria-current', a.dataset.nav === current));
  document.querySelectorAll('[data-nav][aria-current]').forEach((a) => a.setAttribute('aria-current', 'true'));
}
scroller.addEventListener('scroll', markNav, { passive: true });

/* ── Ambient particles: on-topic line glyphs ──────────── */
function particles() {
  const cv = $('#particles');
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, dpr = 1, items = [], color = '97, 0, 255', running = true;

  // eye (gaze), haptic ripple, waveform, drone, glasses (wearable), cursor, hand-tap
  const glyphs = [
    (c) => { c.beginPath(); c.moveTo(-1, 0); c.quadraticCurveTo(0, -0.75, 1, 0); c.quadraticCurveTo(0, 0.75, -1, 0); c.stroke(); c.beginPath(); c.arc(0, 0, 0.28, 0, Math.PI * 2); c.stroke(); },
    (c) => { for (const r of [0.3, 0.62, 0.95]) { c.beginPath(); c.arc(0, 0, r, -0.9, 0.9); c.stroke(); } },
    (c) => { c.beginPath(); for (let x = -1; x <= 1.001; x += 0.1) { const y = Math.sin(x * Math.PI * 2) * 0.35; x === -1 ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke(); },
    (c) => { c.strokeRect(-0.22, -0.22, 0.44, 0.44); for (const [x, y] of [[-0.62, -0.62], [0.62, -0.62], [-0.62, 0.62], [0.62, 0.62]]) { c.beginPath(); c.arc(x, y, 0.3, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.moveTo(x * 0.4, y * 0.4); c.lineTo(x * 0.6, y * 0.6); c.stroke(); } },
    (c) => { c.beginPath(); c.arc(-0.48, 0.1, 0.36, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(0.48, 0.1, 0.36, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.moveTo(-0.12, 0.02); c.quadraticCurveTo(0, -0.1, 0.12, 0.02); c.stroke(); c.beginPath(); c.moveTo(-0.84, 0); c.lineTo(-1, -0.2); c.moveTo(0.84, 0); c.lineTo(1, -0.2); c.stroke(); },
    (c) => { c.beginPath(); c.moveTo(-0.5, -0.9); c.lineTo(-0.5, 0.6); c.lineTo(-0.15, 0.28); c.lineTo(0.12, 0.85); c.lineTo(0.3, 0.76); c.lineTo(0.04, 0.2); c.lineTo(0.5, 0.2); c.closePath(); c.stroke(); },
    (c) => { c.beginPath(); c.arc(0, 0, 0.18, 0, Math.PI * 2); c.stroke(); c.setLineDash([0.12, 0.14]); c.beginPath(); c.arc(0, 0, 0.6, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); },
  ];

  function readColor() { color = getComputedStyle(document.documentElement).getPropertyValue('--particle').trim() || color; }
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const n = Math.round(Math.min(46, (W * H) / 32000));
    items = Array.from({ length: n }, () => {
      const depth = Math.random();
      return {
        x: Math.random() * W, y: Math.random() * H,
        s: 9 + depth * 16, a: 0.05 + depth * 0.08,
        vx: (Math.random() - 0.5) * 0.18, vy: (Math.random() - 0.5) * 0.18,
        r: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.003,
        g: glyphs[Math.floor(Math.random() * glyphs.length)],
      };
    });
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (const p of items) {
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(p.s, p.s);
      ctx.lineWidth = 1.3 / p.s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = `rgba(${color}, ${p.a})`;
      p.g(ctx);
      ctx.restore();
    }
  }
  function step() {
    if (!running) return;
    for (const p of items) {
      p.vx += (Math.random() - 0.5) * 0.01; p.vy += (Math.random() - 0.5) * 0.01;
      p.vx = Math.max(-0.25, Math.min(0.25, p.vx)); p.vy = Math.max(-0.25, Math.min(0.25, p.vy));
      p.x += p.vx; p.y += p.vy; p.r += p.vr;
      const m = p.s * 1.2;
      if (p.x < -m) p.x = W + m; if (p.x > W + m) p.x = -m;
      if (p.y < -m) p.y = H + m; if (p.y > H + m) p.y = -m;
    }
    draw();
    requestAnimationFrame(step);
  }
  readColor(); resize();
  addEventListener('resize', () => { resize(); if (reduce) draw(); });
  new MutationObserver(() => { readColor(); if (reduce) draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  sysDark.addEventListener('change', () => { readColor(); if (reduce) draw(); });
  if (reduce) { draw(); return; }
  document.addEventListener('visibilitychange', () => {
    const was = running; running = !document.hidden;
    if (running && !was) requestAnimationFrame(step);
  });
  requestAnimationFrame(step);
}

/* ── Boot ─────────────────────────────────────────────── */
(async function boot() {
  particles();
  try {
    await load();
  } catch (e) {
    $('#papersGrid').innerHTML = '<p class="section-note">Could not load the program data. See the <a href="https://programs.sigchi.org/uist/2026/search/content?searchKey=Suranga">UIST program</a>.</p>';
    return;
  }
  renderConf();
  renderCards();
  renderFindUs();
  renderSchedule();
  setInterval(() => { renderFindUs(); renderSchedule(); }, 60_000);
  relayout();
  markNav();
  if (location.hash.startsWith('#p-')) openDetail(location.hash.slice(1), false);
  else if (location.hash.length > 1) {
    const land = () => {
      const el = document.getElementById(location.hash.slice(1));
      if (el) scroller.scrollTo({ top: el.getBoundingClientRect().top + scroller.scrollTop - barH() });
    };
    await document.fonts?.ready;
    requestAnimationFrame(() => { layout(); land(); markNav(); });
  }
})();
