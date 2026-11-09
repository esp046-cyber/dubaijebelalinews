/* Daily Dubai & Jebel Ali News — app logic (zero dependencies) */
(() => {
  'use strict';

  const TZ = 'Asia/Dubai';
  const REFRESH_MS = 5 * 60 * 1000;
  const WEATHER_MS = 15 * 60 * 1000;
  const FETCH_TIMEOUT = 9000;
  const KEYS = {
    theme: 'dj_theme', mode: 'dj_mode', saved: 'dj_saved', cache: 'dj_feed_cache',
    weather: 'dj_weather', installDismissed: 'dj_install_dismissed'
  };

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } }
  };
  const SVGNS = 'http://www.w3.org/2000/svg';
  function el(tag, props, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === false || v == null) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null) n.append(kid);
    return n;
  }
  function icon(id) {
    const s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('class', 'ico'); s.setAttribute('aria-hidden', 'true');
    const u = document.createElementNS(SVGNS, 'use');
    u.setAttribute('href', '#i-' + id); s.append(u); return s;
  }
  function safeUrl(u) {
    try { const x = new URL(u); return (x.protocol === 'https:' || x.protocol === 'http:') ? x.href : '#'; } catch (e) { return '#'; }
  }
  function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
  function stripHtml(html) {
    if (!html) return '';
    try { return (new DOMParser().parseFromString(String(html), 'text/html').body.textContent || '').replace(/\s+/g, ' ').trim(); }
    catch (e) { return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
  }
  function clip(s, n) { s = s || ''; return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; }
  function timeAgo(ts) {
    const d = Date.now() - ts;
    if (d < 60e3) return 'Just now';
    if (d < 3600e3) return Math.floor(d / 60e3) + ' min ago';
    if (d < 86400e3) return Math.floor(d / 3600e3) + ' h ago';
    if (d < 7 * 86400e3) return Math.floor(d / 86400e3) + ' d ago';
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: TZ });
  }
  function clockTime(ts) {
    return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
  }

  /* ---------- config ---------- */
  const TAGS = {
    'all': 'All', 'jebel-ali': 'Jebel Ali', 'discovery-gardens': 'Discovery Gardens',
    'rta': 'RTA/Traffic', 'real-estate': 'Real Estate', 'uae': 'UAE National'
  };
  const TAG_RULES = {
    'jebel-ali': /jebel\s*ali|jafza|dubai\s*south|al\s*maktoum|dp\s*world|expo\s*city|palm\s*jebel/i,
    'discovery-gardens': /discovery\s*gardens|furjan|the\s*gardens|ibn\s*battuta|dubai\s*investments?\s*park|\bdip\b/i,
    'rta': /\brta\b|salik|metro|\btram\b|traffic|road\s*clos|\bbus(es)?\b|parking|\be11\b|\be311\b|sheikh\s*zayed\s*road|emirates\s*road|detour|congestion|transport/i,
    'real-estate': /real\s*estate|propert(y|ies)|\brent(al|s)?\b|\bdld\b|mortgage|off-plan|villa|apartment|developer|housing|landlord|tenant|ejari/i,
    'uae': /\buae\b|emirat|abu\s*dhabi|sharjah|federal|ministry|sheikh|president|cabinet|visa|\bnational\b/i
  };
  const gn = (q) => 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=en-AE&gl=AE&ceid=AE:en';
  // Outlets are queried through Google News RSS (direct publisher RSS URLs change often).
  // Add your own entries here: { id, kind:'rss', url, tags:[...] } or { id, kind:'reddit', sub:'name' }.
  const FEEDS = [
    { id: 'jebel', kind: 'rss', url: gn('"Jebel Ali" OR JAFZA OR "Dubai South" when:14d'), tags: ['jebel-ali'] },
    { id: 'discovery', kind: 'rss', url: gn('"Discovery Gardens" OR "Al Furjan" Dubai when:30d'), tags: ['discovery-gardens'] },
    { id: 'rta', kind: 'rss', url: gn('RTA Dubai traffic OR metro OR Salik OR bus when:3d'), tags: ['rta'] },
    { id: 'realestate', kind: 'rss', url: gn('Dubai real estate OR property OR rents when:3d'), tags: ['real-estate'] },
    { id: 'outlets', kind: 'rss', url: gn('UAE OR Dubai (site:gulfnews.com OR site:khaleejtimes.com OR site:thenationalnews.com) when:2d'), tags: ['uae'] },
    { id: 'dmo', kind: 'rss', url: gn('site:mediaoffice.ae when:14d'), tags: ['uae'] },
    { id: 'r-dubai', kind: 'reddit', sub: 'dubai', tags: [] },
    { id: 'r-uae', kind: 'reddit', sub: 'uae', tags: ['uae'] }
  ];

  /* ---------- state ---------- */
  const state = {
    items: [], saved: store.get(KEYS.saved, []), filter: 'all', query: '', view: 'latest',
    mode: 'normal', theme: 'auto', source: 'none', updatedAt: null, okCount: 0, total: FEEDS.length,
    loading: false, weather: store.get(KEYS.weather, null), deferredPrompt: null,
    pollTimer: null, wakeLock: null, lastFocus: null
  };
  if (!Array.isArray(state.saved)) state.saved = [];

  /* ---------- network ---------- */
  // acc counts how many feed responses came from the network vs the service-worker cache (set per refresh).
  let acc = null;
  async function http(url, as, noTrack) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), FETCH_TIMEOUT);
    try {
      const r = await fetch(url, { signal: c.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      if (!noTrack && acc) {
        if (r.headers.get('x-dj-cache')) {
          acc.cache++;
          const s = parseInt(r.headers.get('x-dj-stored-at'), 10);
          if (s) acc.storedAt = acc.storedAt ? Math.min(acc.storedAt, s) : s;
        } else acc.net++;
      }
      return as === 'json' ? await r.json() : await r.text();
    } finally { clearTimeout(t); }
  }
  const proxy = (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u);

  function parseXml(text) {
    const doc = new DOMParser().parseFromString(text, 'text/xml');
    if (doc.querySelector('parsererror')) throw new Error('Bad XML');
    const g = (it, n) => { const x = it.getElementsByTagName(n)[0]; return x ? x.textContent : ''; };
    return $$('item', doc).slice(0, 25).map((it) => ({
      title: g(it, 'title'), link: g(it, 'link'), pubDate: g(it, 'pubDate'),
      description: g(it, 'description'), source: g(it, 'source')
    }));
  }
  async function loadRss(feed) {
    let raw;
    try {
      const j = await http('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(feed.url), 'json');
      if (j.status !== 'ok' || !Array.isArray(j.items)) throw new Error('rss2json failed');
      raw = j.items.map((i) => ({
        title: i.title, link: i.link, description: i.description || i.content, source: i.author || '',
        pubDate: i.pubDate ? i.pubDate.replace(' ', 'T') + 'Z' : ''
      }));
    } catch (e) {
      raw = parseXml(await http(proxy(feed.url), 'text'));
    }
    return raw.map((r) => normalize(r, feed)).filter(Boolean);
  }
  async function loadReddit(feed) {
    const url = 'https://www.reddit.com/r/' + feed.sub + '/hot.json?limit=25&raw_json=1';
    let j;
    try { j = await http(url, 'json'); } catch (e) { j = JSON.parse(await http(proxy(url), 'text')); }
    const kids = (j && j.data && j.data.children) || [];
    return kids.filter((c) => c.data && !c.data.stickied && !c.data.over_18).map((c) => {
      const d = c.data;
      return finish({
        id: 'r' + d.id, title: stripHtml(d.title), url: 'https://www.reddit.com' + d.permalink,
        source: 'r/' + feed.sub, kind: 'community', ts: (d.created_utc || 0) * 1000,
        summary: clip(stripHtml(d.selftext), 220)
      }, feed.tags);
    });
  }
  function normalize(r, feed) {
    let title = stripHtml(r.title);
    let source = stripHtml(r.source);
    const m = title.match(/^(.*\S)\s+-\s+([^-]{2,60})$/); // Google News: "Headline - Publisher"
    if (m) { title = m[1]; if (!source) source = m[2]; }
    const url = safeUrl(r.link);
    if (!title || url === '#') return null;
    const parsed = Date.parse(r.pubDate);
    // Google News descriptions only repeat the headline, so drop summaries that duplicate it.
    let summary = clip(stripHtml(r.description), 220);
    if (summary.toLowerCase().startsWith(title.toLowerCase().slice(0, 40))) summary = '';
    return finish({
      id: 'n' + hash(url + title), title, url, source: source || 'News', kind: 'news',
      ts: isNaN(parsed) ? Date.now() : parsed, summary
    }, feed.tags);
  }
  function finish(item, baseTags) {
    const hay = item.title + ' ' + item.summary + ' ' + item.source;
    const tags = new Set(baseTags || []);
    for (const [t, re] of Object.entries(TAG_RULES)) if (re.test(hay)) tags.add(t);
    item.tags = Array.from(tags);
    if (!item.id) item.id = 'n' + hash(item.url + item.title);
    return item;
  }
  function loadFeed(feed) { return feed.kind === 'reddit' ? loadReddit(feed) : loadRss(feed); }
  function dedupe(list) {
    const seen = new Set(), out = [];
    for (const it of list.sort((a, b) => b.ts - a.ts)) {
      const k = it.title.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 80);
      if (!k || seen.has(k)) continue;
      seen.add(k); out.push(it);
    }
    return out.slice(0, 90);
  }

  /* Honest fallback: evergreen quick links, clearly marked as samples (not news). */
  function sampleItems() {
    const s = (id, title, summary, url, source, tags) => ({ id: 'sample-' + id, title, summary, url, source, kind: 'sample', sample: true, ts: 0, tags });
    return [
      s('jafza', 'Jebel Ali & JAFZA: official notices and announcements', 'Live headlines could not be loaded. Open JAFZA for official free-zone updates.', 'https://www.jafza.ae/', 'JAFZA', ['jebel-ali']),
      s('dubaisouth', 'Dubai South: district news and events', 'Live headlines could not be loaded. Open the Dubai South site for the latest.', 'https://www.dubaisouth.ae/', 'Dubai South', ['jebel-ali']),
      s('agac', 'Discovery Gardens & Al Furjan: community updates', 'Live headlines could not be loaded. Visit the community site for local announcements.', 'https://agac.ae/', 'agac.ae', ['discovery-gardens']),
      s('rta', 'RTA: live traffic, Dubai Metro, bus and Salik notices', 'Check the Roads and Transport Authority for real-time service status.', 'https://www.rta.ae/', 'RTA', ['rta']),
      s('dld', 'Dubai Land Department: rental index and tenant tools', 'Official real-estate services and market information.', 'https://dubailand.gov.ae/', 'Dubai Land Department', ['real-estate']),
      s('dmo', 'Dubai Media Office: official government news', 'Press releases and announcements from the Government of Dubai.', 'https://mediaoffice.ae/', 'Dubai Media Office', ['uae']),
      s('gn', 'Gulf News: latest UAE headlines', 'Open the publisher for current stories.', 'https://gulfnews.com/', 'Gulf News', ['uae']),
      s('kt', 'Khaleej Times: latest UAE headlines', 'Open the publisher for current stories.', 'https://www.khaleejtimes.com/', 'Khaleej Times', ['uae']),
      s('national', 'The National: latest UAE headlines', 'Open the publisher for current stories.', 'https://www.thenationalnews.com/', 'The National', ['uae']),
      s('uae', 'UAE Government portal: federal announcements', 'Official information and services.', 'https://u.ae/en', 'u.ae', ['uae']),
      s('rdubai', 'r/dubai: community discussion', 'Residents share tips, questions and local updates.', 'https://www.reddit.com/r/dubai/', 'Reddit', []),
      s('ruae', 'r/UAE: community discussion', 'Country-wide community threads.', 'https://www.reddit.com/r/UAE/', 'Reddit', ['uae'])
    ];
  }

  async function refresh() {
    if (state.loading) return;
    state.loading = true;
    $('#feed').setAttribute('aria-busy', 'true');
    render(); updateStatus();
    try {
      acc = { net: 0, cache: 0, storedAt: 0 };
      const results = await Promise.allSettled(FEEDS.map(loadFeed));
      const okCount = results.filter((r) => r.status === 'fulfilled' && r.value.length).length;
      const items = dedupe(results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])));
      const fromCache = acc.cache > 0 && acc.net === 0; // offline: service worker answered from its saved copies
      if (items.length && fromCache) {
        state.items = items; state.source = 'cache'; state.updatedAt = acc.storedAt || state.updatedAt;
      } else if (items.length) {
        state.items = items; state.source = 'live'; state.updatedAt = Date.now(); state.okCount = okCount;
        store.set(KEYS.cache, { at: state.updatedAt, items: items.slice(0, 60) });
      } else if (state.items.length && state.source !== 'sample') {
        state.source = 'stale';
      } else {
        const c = store.get(KEYS.cache, null);
        if (c && Array.isArray(c.items) && c.items.length) { state.items = c.items; state.source = 'cache'; state.updatedAt = c.at; }
        else { state.items = sampleItems(); state.source = 'sample'; state.updatedAt = null; }
      }
    } catch (e) {
      if (!state.items.length) { state.items = sampleItems(); state.source = 'sample'; }
    } finally {
      state.loading = false;
      $('#feed').setAttribute('aria-busy', 'false');
      render(); renderGlance(); updateStatus();
    }
  }

  /* ---------- weather ---------- */
  function wxText(code) {
    if (code === 0) return 'Clear';
    if (code === 1) return 'Mostly clear';
    if (code === 2) return 'Partly cloudy';
    if (code === 3) return 'Overcast';
    if (code === 45 || code === 48) return 'Fog / haze';
    if (code >= 51 && code <= 57) return 'Drizzle';
    if (code >= 61 && code <= 67) return 'Rain';
    if (code >= 80 && code <= 82) return 'Showers';
    if (code >= 95) return 'Thunderstorm';
    return 'Conditions';
  }
  async function refreshWeather() {
    try {
      const j = await http('https://api.open-meteo.com/v1/forecast?latitude=25.00&longitude=55.12&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code&timezone=Asia%2FDubai', 'json', true);
      const c = j.current;
      state.weather = {
        t: Math.round(c.temperature_2m), feels: Math.round(c.apparent_temperature),
        rh: Math.round(c.relative_humidity_2m), code: c.weather_code, at: Date.now()
      };
      store.set(KEYS.weather, state.weather);
    } catch (e) { /* keep any cached value */ }
    renderGlance();
  }

  /* ---------- time / metro / glance ---------- */
  function dubaiParts(d) {
    const f = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour12: false, weekday: 'short', hour: '2-digit', minute: '2-digit' });
    const p = {}; f.formatToParts(d).forEach((x) => { p[x.type] = x.value; });
    return { wd: p.weekday, min: (parseInt(p.hour, 10) % 24) * 60 + parseInt(p.minute, 10) };
  }
  // Timetable-based (not live): Sat-Wed 05:00-24:00, Thu-Fri 05:00-01:00 (next day). RTA publishes the authoritative times.
  function metroStatus(d) {
    const { wd, min } = dubaiParts(d);
    const lateNight = min < 60 && (wd === 'Fri' || wd === 'Sat');
    if (min >= 300 || lateNight) return 'Running per timetable · check RTA for live alerts';
    return 'Outside service hours · first trains about 05:00';
  }
  function currentHeadline() {
    const live = state.items.find((i) => !i.sample);
    return live || null;
  }
  function renderGlance() {
    const now = new Date();
    const tp = {};
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(now).forEach((x) => { tp[x.type] = x.value; });
    const date = now.toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
    const w = state.weather;
    const h = currentHeadline();
    const vals = {
      time: (tp.hour || '') + ':' + (tp.minute || ''), ampm: (tp.dayPeriod || '').toUpperCase(), date,
      temp: w ? w.t + '°' : '--°',
      wx: w ? wxText(w.code) + ' · feels ' + w.feels + '° · ' + w.rh + '% humidity' : 'Weather unavailable',
      metro: metroStatus(now),
      headline: h ? h.title : (state.loading ? 'Loading headlines…' : 'Live headlines appear here when you are online.')
    };
    for (const [k, v] of Object.entries(vals)) {
      $$('[data-bind="' + k + '"]').forEach((n) => {
        if (n.textContent !== v) n.textContent = v;
        if (k === 'headline' && n.tagName === 'A') n.href = h ? safeUrl(h.url) : '#feed';
      });
    }
  }
  let clockTimer = null;
  function scheduleClock() {
    clearTimeout(clockTimer);
    renderGlance();
    clockTimer = setTimeout(scheduleClock, 60000 - (Date.now() % 60000) + 50); // once per minute, aligned
  }

  /* ---------- render ---------- */
  function updateStatus() {
    let t = '';
    if (state.loading) t = 'Refreshing…';
    else if (state.source === 'live') t = 'Live · updated ' + clockTime(state.updatedAt) + ' GST · ' + state.okCount + '/' + state.total + ' sources' + (state.mode === 'battery' ? ' · auto-refresh paused (Battery Saver)' : '');
    else if (state.source === 'stale') t = 'Could not refresh. Showing the earlier results.';
    else if (state.source === 'cache') t = (navigator.onLine === false ? 'Offline' : 'Feeds unreachable') + ' · showing saved copy from ' + clockTime(state.updatedAt) + ' GST';
    else if (state.source === 'sample') t = 'Feeds unreachable right now. Showing official quick links instead of news.';
    $('#status').textContent = t;
  }
  function visibleItems() {
    const base = state.view === 'saved' ? state.saved : state.items;
    const q = state.query.trim().toLowerCase();
    return base.filter((i) => (state.filter === 'all' || (i.tags || []).includes(state.filter)) &&
      (!q || (i.title + ' ' + (i.summary || '') + ' ' + i.source).toLowerCase().includes(q)));
  }
  function isSaved(id) { return state.saved.some((s) => s.id === id); }
  function card(it) {
    const tagLabels = (it.tags || []).map((t) => el('span', { text: TAGS[t] || t }));
    return el('article', { class: 'card', 'data-id': it.id },
      el('div', { class: 'card-top' },
        el('span', { class: 'badge' + (it.sample ? ' sample' : ''), text: it.sample ? 'Quick link' : it.source }),
        it.sample ? null : el('span', { text: timeAgo(it.ts) }),
        it.kind === 'community' ? el('span', { text: 'Community' }) : null),
      el('h2', { class: 'card-title' }, el('a', { href: safeUrl(it.url), target: '_blank', rel: 'noopener noreferrer', text: it.title })),
      it.summary ? el('p', { class: 'card-sum', text: it.summary }) : null,
      tagLabels.length ? el('div', { class: 'card-tags' }, tagLabels) : null,
      el('div', { class: 'card-actions' },
        el('button', { type: 'button', class: 'act', 'data-action': 'share', 'aria-label': 'Share: ' + it.title }, icon('share'), 'Share'),
        el('button', { type: 'button', class: 'act', 'data-action': 'save', 'aria-pressed': String(isSaved(it.id)), 'aria-label': 'Save story: ' + it.title }, icon('bookmark'), isSaved(it.id) ? 'Saved' : 'Save'),
        el('a', { class: 'act', href: safeUrl(it.url), target: '_blank', rel: 'noopener noreferrer', 'aria-label': 'Open story' }, icon('external'), 'Open')));
  }
  function render() {
    const feed = $('#feed'), empty = $('#empty');
    $('#saved-count').textContent = String(state.saved.length);
    feed.replaceChildren();
    if (state.loading && !state.items.length && state.view === 'latest') {
      for (let i = 0; i < 4; i++) feed.append(el('div', { class: 'card skeleton', 'aria-hidden': 'true' }));
      empty.hidden = true; return;
    }
    const list = visibleItems();
    if (!list.length) {
      empty.hidden = false;
      empty.textContent = state.view === 'saved' && !state.saved.length
        ? 'No saved stories yet. Tap Save on any story to read it later, even offline.'
        : 'No stories match your search or filter.';
      return;
    }
    empty.hidden = true;
    const frag = document.createDocumentFragment();
    list.forEach((it) => frag.append(card(it)));
    feed.append(frag);
  }

  /* ---------- actions: share / save / toast ---------- */
  let toastTimer = null;
  function toast(msg, action) {
    const t = $('#toast');
    t.replaceChildren(el('span', { text: msg }));
    if (action) t.append(el('button', { type: 'button', text: action.label, onclick: action.fn }));
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, action ? 8000 : 3200);
  }
  function findItem(id) { return state.items.find((i) => i.id === id) || state.saved.find((i) => i.id === id); }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* fall through */ }
    try {
      const ta = el('textarea', { readonly: true, style: 'position:fixed;opacity:0;top:0;left:0' });
      ta.value = text; document.body.append(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch (e) { return false; }
  }
  async function shareItem(it) {
    const data = { title: it.title, text: it.title, url: it.url };
    if (navigator.share) {
      try { await navigator.share(data); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const ok = await copyText(it.title + '\n' + it.url);
    toast(ok ? 'Link copied to clipboard' : 'Could not share. Long-press the title to copy the link.');
  }
  function toggleSave(it) {
    if (isSaved(it.id)) { state.saved = state.saved.filter((s) => s.id !== it.id); toast('Removed from saved'); }
    else { state.saved.unshift(Object.assign({}, it, { savedAt: Date.now() })); toast('Saved for offline reading'); }
    store.set(KEYS.saved, state.saved);
    render();
  }

  /* ---------- display modes ---------- */
  function applyDisplay() {
    const r = document.documentElement;
    r.setAttribute('data-theme', state.theme);
    r.setAttribute('data-mode', state.mode);
    $('#btn-sunlight').setAttribute('aria-pressed', String(state.mode === 'sunlight'));
    $('#btn-battery').setAttribute('aria-pressed', String(state.mode === 'battery'));
    const names = { auto: 'Auto', light: 'Light', dark: 'Dark' };
    $('#theme-label').textContent = names[state.theme];
    const tb = $('#btn-theme');
    tb.disabled = state.mode !== 'normal';
    tb.title = state.mode !== 'normal' ? 'Theme is fixed while Sunlight or Battery mode is on' : 'Theme: ' + names[state.theme] + ' (tap to change)';
    const dark = state.theme === 'dark' || (state.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    $('#meta-theme').setAttribute('content', state.mode === 'sunlight' ? '#FFFFFF' : state.mode === 'battery' ? '#000000' : dark ? '#06122A' : '#0B1F3A');
    schedulePoll(); updateStatus();
  }
  function setMode(m) {
    state.mode = state.mode === m ? 'normal' : m;
    store.set(KEYS.mode, state.mode);
    applyDisplay();
    toast(state.mode === 'sunlight' ? 'Direct Sunlight mode on' : state.mode === 'battery' ? 'Battery Saver on: auto-refresh paused' : 'Normal display');
  }
  function cycleTheme() {
    state.theme = state.theme === 'auto' ? 'light' : state.theme === 'light' ? 'dark' : 'auto';
    store.set(KEYS.theme, state.theme);
    applyDisplay();
  }

  /* ---------- polling (paused in Battery Saver and when hidden) ---------- */
  let lastWeatherTry = 0;
  function poll() {
    if (document.hidden || state.mode === 'battery') return;
    refresh();
    if (Date.now() - lastWeatherTry > WEATHER_MS) { lastWeatherTry = Date.now(); refreshWeather(); }
  }
  function schedulePoll() {
    clearInterval(state.pollTimer); state.pollTimer = null;
    if (state.mode !== 'battery' && !document.hidden) state.pollTimer = setInterval(poll, REFRESH_MS);
  }

  /* ---------- focus trap for dialogs ---------- */
  function trap(container, e) {
    if (e.key !== 'Tab') return;
    const f = $$('button, a[href], input, [tabindex]:not([tabindex="-1"])', container).filter((n) => !n.disabled && n.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------- ambient mode ---------- */
  async function acquireWakeLock() {
    try {
      if ('wakeLock' in navigator && state.mode !== 'battery') state.wakeLock = await navigator.wakeLock.request('screen');
    } catch (e) { state.wakeLock = null; }
  }
  function openAmbient() {
    state.lastFocus = document.activeElement;
    $('#ambient').hidden = false;
    document.body.classList.add('no-scroll');
    renderGlance();
    $('#amb-close').focus();
    acquireWakeLock();
    const a = $('#ambient');
    if (a.requestFullscreen) { a.requestFullscreen().catch(() => {}); }
  }
  function closeAmbient() {
    $('#ambient').hidden = true;
    document.body.classList.remove('no-scroll');
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    if (state.wakeLock) { state.wakeLock.release().catch(() => {}); state.wakeLock = null; }
    if (state.lastFocus && state.lastFocus.focus) state.lastFocus.focus();
  }

  /* ---------- install prompt ---------- */
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function installDismissed() { const t = store.get(KEYS.installDismissed, 0); return t && Date.now() - t < 7 * 86400e3; }
  function showBanner(kind) {
    if (isStandalone() || installDismissed()) return;
    $('#install-banner').hidden = false;
    $('#install-banner').dataset.kind = kind;
    $('#install-text').textContent = kind === 'ios'
      ? 'Add Daily Dubai News to your Home Screen for full-screen reading and offline stories.'
      : 'Install Daily Dubai News for one-tap access and offline reading.';
    $('#btn-install').textContent = kind === 'ios' ? 'Show me how' : 'Install';
  }
  function openIosModal() {
    state.lastFocus = document.activeElement;
    $('#ios-modal').hidden = false; $('#ios-close').focus();
  }
  function closeIosModal() { $('#ios-modal').hidden = true; if (state.lastFocus && state.lastFocus.focus) state.lastFocus.focus(); }

  /* ---------- wiring ---------- */
  function setFilter(tag) {
    state.filter = tag;
    $$('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.tag === tag)));
    render();
  }
  function setView(v) {
    state.view = v;
    $('#tab-latest').setAttribute('aria-pressed', String(v === 'latest'));
    $('#tab-saved').setAttribute('aria-pressed', String(v === 'saved'));
    render();
  }
  function wire() {
    $('#btn-sunlight').addEventListener('click', () => setMode('sunlight'));
    $('#btn-battery').addEventListener('click', () => setMode('battery'));
    $('#btn-theme').addEventListener('click', cycleTheme);
    $('#btn-ambient').addEventListener('click', openAmbient);
    $('#btn-ambient-2').addEventListener('click', openAmbient);
    $('#amb-close').addEventListener('click', closeAmbient);
    $('#ambient').addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAmbient(); else trap($('#ambient'), e); });
    $('#ios-modal').addEventListener('keydown', (e) => { if (e.key === 'Escape') closeIosModal(); else trap($('#ios-modal'), e); });
    $('#ios-close').addEventListener('click', closeIosModal);
    $('#btn-refresh').addEventListener('click', () => { refresh(); refreshWeather(); });
    $('#tab-latest').addEventListener('click', () => setView('latest'));
    $('#tab-saved').addEventListener('click', () => setView('saved'));
    $('#chips').addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (b) setFilter(b.dataset.tag); });
    $('#search').addEventListener('input', debounce((e) => { state.query = e.target.value; render(); }, 120));
    $('#feed').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-action]'); if (!b) return;
      const it = findItem(b.closest('.card').dataset.id); if (!it) return;
      if (b.dataset.action === 'share') shareItem(it); else toggleSave(it);
    });

    $('#btn-install').addEventListener('click', async () => {
      if ($('#install-banner').dataset.kind === 'ios') { openIosModal(); return; }
      const p = state.deferredPrompt; if (!p) return;
      p.prompt();
      try { await p.userChoice; } catch (e) { /* ignore */ }
      state.deferredPrompt = null; $('#install-banner').hidden = true;
    });
    $('#btn-install-dismiss').addEventListener('click', () => { store.set(KEYS.installDismissed, Date.now()); $('#install-banner').hidden = true; });
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); state.deferredPrompt = e; showBanner('android'); });
    window.addEventListener('appinstalled', () => { $('#install-banner').hidden = true; state.deferredPrompt = null; toast('App installed'); });
    if (isIOS() && !isStandalone()) showBanner('ios');

    document.addEventListener('visibilitychange', () => {
      schedulePoll();
      if (!document.hidden) {
        scheduleClock();
        if (!$('#ambient').hidden) acquireWakeLock();
        if (state.mode !== 'battery' && (!state.updatedAt || Date.now() - state.updatedAt > REFRESH_MS)) refresh();
      }
    });
    window.addEventListener('online', () => { toast('Back online'); if (state.mode !== 'battery') { refresh(); refreshWeather(); } });
    window.addEventListener('offline', () => { toast('You are offline. Saved stories still work.'); updateStatus(); });
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyDisplay);
    } catch (e) { /* older Safari */ }
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).then((reg) => {
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing; if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              toast('A new version is ready.', { label: 'Reload', fn: () => location.reload() });
            }
          });
        });
      }).catch(() => { /* SW needs https or localhost; the app still works without it */ });
    });
  }

  function init() {
    const t = store.get(KEYS.theme, 'auto'), m = store.get(KEYS.mode, 'normal');
    state.theme = ['auto', 'light', 'dark'].includes(t) ? t : 'auto';
    state.mode = ['normal', 'sunlight', 'battery'].includes(m) ? m : 'normal';
    wire(); applyDisplay(); scheduleClock();

    const params = new URLSearchParams(location.search);
    if (params.get('view') === 'saved') setView('saved');

    const c = store.get(KEYS.cache, null);
    if (c && Array.isArray(c.items) && c.items.length) {
      state.items = c.items; state.source = 'cache'; state.updatedAt = c.at;
    }
    render(); renderGlance(); updateStatus();

    lastWeatherTry = Date.now();
    refreshWeather();
    refresh();
    registerSW();
    if (params.get('ambient') === '1') openAmbient();
  }

  init();
})();
