const emoji = it => {
  if (it.icon) return it.icon;
  for (const [r, e] of ICONS) if (r.test(it.name)) return e;
  return '📍';
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s)
  .toLowerCase()
  .replace(/ي/g, 'ی')
  .replace(/ك/g, 'ک')
  .replace(/[‌‏]/g, ' ')
  .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
  .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const fa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const isMobile = () => matchMedia('(max-width:760px)').matches;

let map = null, sel = null, activeCat = 'all', query = '';

// کدام مکان‌ها از اول روی نقشه دیده شوند؛ بقیه فقط با زوم زیاد (مثل گوگل‌مپ)، جست‌وجو یا انتخاب
const OVERVIEW_CATS = new Set(['edu', 'admin', 'parking']);
const DETAIL_ZOOM = 18;
let introDone = false, introDelay = 450;
const $ = id => document.getElementById(id);
const toast = (m, ms = 2800) => {
  const t = $('toast');
  t.textContent = m;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), ms);
};

/* ---------- انیمیشن پخش قلب روی دکمه انجمن کامپیوتر ---------- */
function burstHearts(sourceEl) {
  if (!sourceEl) return;
  const rect = sourceEl.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;

  sourceEl.classList.remove('pop');
  void sourceEl.offsetWidth;
  sourceEl.classList.add('pop');

  if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;

  const symbols = ['❤️', '💖', '💗', '💓', '💕', '🩷'];
  const count = 22;

  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'heart-particle';
    el.textContent = symbols[Math.floor(Math.random() * symbols.length)];

    const size = 13 + Math.random() * 13;
    el.style.fontSize = size + 'px';

    // پخش به صورت فواره‌ای به سمت پایین و اطراف (چون دکمه در بالای صفحه است)
    const angle = (Math.PI * 0.12) + Math.random() * (Math.PI * 0.76);
    const speed = 55 + Math.random() * 115;
    const dx = Math.cos(angle) * speed * (Math.random() < 0.35 ? -1 : 1);
    const dy = Math.sin(angle) * speed + (15 + Math.random() * 45);
    const rot = (Math.random() - 0.5) * 140;
    const duration = 680 + Math.random() * 380;

    document.body.appendChild(el);

    const anim = el.animate([
      {
        transform: `translate3d(${originX - size / 2}px, ${originY - size / 2}px, 0) scale(0.35) rotate(0deg)`,
        opacity: 1
      },
      {
        transform: `translate3d(${originX + dx * 0.55 - size / 2}px, ${originY + dy * 0.45 - size / 2}px, 0) scale(1.15) rotate(${rot * 0.5}deg)`,
        opacity: 1,
        offset: 0.45
      },
      {
        transform: `translate3d(${originX + dx - size / 2}px, ${originY + dy - size / 2}px, 0) scale(0.6) rotate(${rot}deg)`,
        opacity: 0
      }
    ], {
      duration,
      easing: 'cubic-bezier(0.16, 0.88, 0.32, 1)',
      fill: 'forwards'
    });

    anim.onfinish = () => el.remove();
  }
}

/* ---------- مدیریت پنل و جست‌وجو ---------- */
function setSheetOpen(open) {
  const p = $('panel'), l = $('launcher');
  if (!isMobile()) return;
  p.classList.toggle('open', open);
  l.classList.toggle('hide', open);
}

function visible(it) {
  if (activeCat !== 'all' && it.cat !== activeCat) return false;
  if (!query) return true;
  return norm(it.name + ' ' + CATS[it.cat].n + ' ' + it.desc.join(' ') + ' ' + (it.tags || []).join(' ')).includes(norm(query));
}

function renderChips() {
  const box = $('chips');
  box.innerHTML = '';
  const mk = (k, label, color, count) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.setAttribute('aria-pressed', activeCat === k);
    if (color) b.style.setProperty('--c', color);
    b.innerHTML = (color ? '<i></i>' : '') + esc(label) + ' ' + fa(count);
    b.onclick = () => { activeCat = k; apply(); };
    box.appendChild(b);
  };
  mk('all', 'همه', null, DATA.length);
  Object.keys(CATS).forEach(k => {
    const n = DATA.filter(d => d.cat === k).length;
    if (n) mk(k, CATS[k].n, CATS[k].c, n);
  });
}

function renderList() {
  const ul = $('list');
  ul.innerHTML = '';
  const vis = DATA.filter(visible);
  $('launcherCount').textContent = fa(vis.length) + ' مکان';
  if (!vis.length) {
    ul.innerHTML = '<li class="empty">مکانی در دانشگاه پیدا نشد.<br>عبارت دیگری را امتحان کنید یا دسته‌بندی را روی «همه» بگذارید.</li>';
    return;
  }
  const frag = document.createDocumentFragment();
  vis.forEach(it => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.className = 'row' + (sel === it.id ? ' on' : '');
    b.style.setProperty('--c', CATS[it.cat].c);
    b.innerHTML = `<span class="ic">${emoji(it)}</span><span><b>${esc(it.name)}</b><small>${esc(CATS[it.cat].n)}</small></span>`;
    b.onclick = () => select(it.id);
    li.appendChild(b);
    frag.appendChild(li);
  });
  ul.appendChild(frag);
}

function renderDetail() {
  const d = $('detail');
  if (sel === null) {
    d.hidden = true;
    $('launcherText').textContent = 'جست‌وجو و مکان‌های دانشگاه...';
    return;
  }
  const it = DATA[sel], c = CATS[it.cat];
  $('launcherText').textContent = emoji(it) + ' ' + it.name;
  d.hidden = false;
  d.style.setProperty('--c', c.c);
  const lines = it.desc.length
    ? `<ul class="d-lines">${it.desc.map(l => `<li>${esc(l)}</li>`).join('')}</ul>`
    : '<p class="d-empty">برای این بخش از دانشگاه هنوز توضیحی ثبت نشده است.</p>';
  const photo = it.photo
    ? `<figure class="d-photo"><img src="${esc(it.photo)}" alt="${esc(it.name)}" decoding="async"></figure>`
    : '';
  d.innerHTML = photo + `<div class="d-top"><div class="d-ico">${emoji(it)}</div><div><h2>${esc(it.name)}</h2><small>${esc(c.n)}</small></div><button class="d-x" id="dx" aria-label="بستن">×</button></div>${lines}
  <a class="go" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${it.ll[0]},${it.ll[1]}&travelmode=walking"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l18-8-8 18-2-8-8-2z"/></svg>مسیریابی با گوگل‌مپ</a>
  <div class="rt"><b>🧭 از اینجا به کجا می‌خواهید بروید؟</b><div class="rch" id="rch"></div><select id="rsel" aria-label="انتخاب مقصد"><option value="">مقصد دیگر...</option></select></div>`;
  $('dx').onclick = () => select(null);
  // پیشنهاد نزدیک‌ترین مقصدها + فهرست کامل
  const near = DATA
    .filter(x => x.id !== it.id && !x.poly && !/سرویس/.test(x.name))
    .map(x => [x, dist(it.ll, x.ll)])
    .sort((p, q) => p[1] - q[1])
    .slice(0, 4);
  near.forEach(([x, m]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.innerHTML = emoji(x) + ' ' + esc(x.name) + ' <small>' + fa(Math.round(m / 10) * 10) + ' م</small>';
    b.onclick = () => goRoute(it.id, x.id);
    $('rch').appendChild(b);
  });
  DATA.filter(x => x.id !== it.id)
    .sort((p, q) => p.name.localeCompare(q.name, 'fa'))
    .forEach(x => {
      const o = document.createElement('option');
      o.value = x.id;
      o.textContent = x.name;
      $('rsel').appendChild(o);
    });
  $('rsel').onchange = e => {
    const v = e.target.value;
    e.target.value = '';
    if (v !== '') goRoute(it.id, +v);
  };
  const img = d.querySelector('.d-photo img');
  if (img) {
    const fig = img.parentElement;
    const ok = () => fig.classList.add('ok');
    if (img.complete && img.naturalWidth) ok();
    else {
      img.onload = ok;
      img.onerror = () => fig.remove();
    }
  }
}

function onMap(it) {
  if (!visible(it)) return false;
  if (it.id === sel) return true;
  if (activeCat !== 'all' || query) return true; // فیلتر یا جست‌وجو فعال است: همه‌ی نتیجه‌ها دیده شوند
  return OVERVIEW_CATS.has(it.cat) || (map && map.getZoom() >= DETAIL_ZOOM);
}

function syncPins() {
  if (!map) return;
  // در ورودِ اول پین‌ها از شمال به جنوب یکی‌یکی فرود می‌آیند
  const list = introDone ? DATA : [...DATA].sort((a, b) => b.ll[0] - a.ll[0]);
  list.forEach(it => {
    const on = onMap(it);
    if (on && !map.hasLayer(it._g)) it._g.addTo(map);
    if (!on && map.hasLayer(it._g)) map.removeLayer(it._g);
  });
}

function apply() {
  renderChips();
  renderList();
  syncPins();
}

function setSelClass(id, on) {
  const it = DATA[id];
  if (!it || !it._m) return;
  const el = it._m.getElement && it._m.getElement();
  if (!el) return;
  el.classList.toggle('sel-z', on);
  const p = el.querySelector('.pin');
  if (p) p.classList.toggle('sel', on);
}

function select(id) {
  if (sel !== null) setSelClass(sel, false);
  sel = id;
  if (id !== null) {
    const it = DATA[id];
    if (!visible(it)) {
      activeCat = 'all';
      query = '';
      $('q').value = '';
    }
    apply();
    setSelClass(id, true);
    if (map) {
      const off = isMobile() ? window.innerHeight * 0.24 : 0;
      if (it.poly) {
        map.fitBounds(L.latLngBounds(it.poly), {
          maxZoom: 18,
          paddingTopLeft: [30, 110],
          paddingBottomRight: [30, isMobile() ? window.innerHeight * 0.66 : 30]
        });
      } else {
        map.setView(it.ll, Math.max(map.getZoom(), 18.5), { animate: true });
        if (off) map.once('moveend', () => map.panBy([0, off], { animate: true }));
      }
    }
    setSheetOpen(true);
    $('body').scrollTop = 0;
  } else {
    apply();
  }
  renderDetail();
}

/* ---------- مسیریابی پیاده بین دو مکان ---------- */
const dist = (a, b) => {
  const R = 6371000, r = Math.PI / 180;
  const dA = (b[0] - a[0]) * r, dB = (b[1] - a[1]) * r;
  const h = Math.sin(dA / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dB / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
let routeL = null, routeSeq = 0;

function clearRoute() {
  routeSeq++;
  if (routeL && map) map.removeLayer(routeL);
  routeL = null;
  $('rbar').classList.remove('show');
}

async function goRoute(fi, ti) {
  if (!map) { toast('نقشه بارگذاری نشده است.'); return; }
  clearRoute();
  const my = routeSeq;
  const A = DATA[fi], B = DATA[ti];
  const bar = $('rbar');
  bar.innerHTML = 'در حال پیدا کردن مسیر...';
  bar.classList.add('show');
  setSheetOpen(false);

  const straight = dist(A.ll, B.ll);
  let pts = null, m = 0;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    const url = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/' +
      A.ll[1] + ',' + A.ll[0] + ';' + B.ll[1] + ',' + B.ll[0] + '?overview=full&geometries=geojson';
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error('http ' + r.status);
    const rt = (await r.json()).routes[0];
    pts = rt.geometry.coordinates.map(x => [x[1], x[0]]);
    m = rt.distance;
  } catch (e) {
    pts = null;
  } finally {
    clearTimeout(timer);
  }
  if (my !== routeSeq) return; // کاربر در این فاصله مسیر دیگری خواسته یا بسته است

  // نقطه‌ها روی نزدیک‌ترین مسیر OSM قرار می‌گیرند؛ فاصله‌ی پین تا آن مسیر را هم حساب می‌کنیم
  let gapA = null, gapB = null;
  if (pts) {
    gapA = [A.ll, pts[0]];
    gapB = [pts[pts.length - 1], B.ll];
    m += dist(A.ll, pts[0]) + dist(B.ll, pts[pts.length - 1]);
    // مسیر خیلی دورتر از خط مستقیم یعنی احتمالاً داخل پردیس در OSM مسیری ثبت نشده است
    if (m > straight * 1.8 + 80) pts = null;
  }
  const approx = !pts;
  if (approx) {
    pts = [A.ll, B.ll];
    m = straight * 1.25;
    gapA = gapB = null;
  }

  const min = Math.max(1, Math.round(m / 75));
  const mm = Math.round(m / 5) * 5;
  const layers = [
    L.polyline(pts, { color: '#fff', weight: 10, opacity: .95 }),
    L.polyline(pts, { color: '#2563eb', weight: 5, lineCap: 'round', dashArray: approx ? '1 10' : null })
  ];
  [gapA, gapB].forEach(g => { if (g) layers.push(L.polyline(g, { color: '#2563eb', weight: 3, dashArray: '2 8', lineCap: 'round' })); });
  layers.push(
    L.circleMarker(A.ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#16a34a', fillOpacity: 1 }),
    L.circleMarker(B.ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#dc2626', fillOpacity: 1 })
  );
  routeL = L.layerGroup(layers).addTo(map);

  bar.innerHTML =
    '<div class="rt-title">' + esc(A.name) + ' ← ' + esc(B.name) + '</div>' +
    '<div>' + fa(mm) + ' متر، حدود ' + fa(min) + ' دقیقه پیاده' +
    (approx ? ' <small>(تقریبی؛ مسیر دقیق در دسترس نبود)</small>' : '') + '</div>' +
    '<div class="rb"><button type="button" id="rsw">🔁 برعکس</button>' +
    '<a class="g" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&origin=' +
    A.ll[0] + ',' + A.ll[1] + '&destination=' + B.ll[0] + ',' + B.ll[1] + '&travelmode=walking">گوگل‌مپ</a>' +
    '<button type="button" id="rcl">بستن</button></div>';
  $('rsw').onclick = () => goRoute(ti, fi);
  $('rcl').onclick = clearRoute;

  map.fitBounds(L.latLngBounds(pts), {
    paddingTopLeft: [40, isMobile() ? 115 : 95],
    paddingBottomRight: [40, isMobile() ? 230 : 140],
    maxZoom: 19
  });
}

/* ---------- محدود کردن نقشه به دانشگاه و خیابان‌های اطرافش ---------- */
// BOUNDS در bounds.js تعریف شده است. اگر آن فایل نباشد، نقشه بدون محدودیت کار می‌کند.
const HAS_BOUNDS = typeof BOUNDS !== 'undefined' && BOUNDS.length > 2;
const BOUNDS_MASK = true; // false = بیرون محدوده تیره نشود

function inCampus(ll) {
  if (!HAS_BOUNDS) return true;
  let c = false;
  for (let i = 0, j = BOUNDS.length - 1; i < BOUNDS.length; j = i++) {
    const [yi, xi] = BOUNDS[i], [yj, xj] = BOUNDS[j];
    if ((yi > ll[0]) !== (yj > ll[0]) && ll[1] < (xj - xi) * (ll[0] - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function applyBounds() {
  if (!HAS_BOUNDS) return;
  const bb = L.latLngBounds(BOUNDS);
  map.setMaxBounds(bb);
  map.setMinZoom(map.getBoundsZoom(bb, false)); // کل محدوده یک‌جا دیده شود، دورتر نشود
}

function drawBoundsMask() {
  if (!HAS_BOUNDS) return;
  if (BOUNDS_MASK) {
    const b = L.latLngBounds(BOUNDS), pad = 0.25;
    const outer = [
      [b.getSouth() - pad, b.getWest() - pad], [b.getSouth() - pad, b.getEast() + pad],
      [b.getNorth() + pad, b.getEast() + pad], [b.getNorth() + pad, b.getWest() - pad]
    ];
    L.polygon([outer, BOUNDS], { stroke: false, fillColor: '#072329', fillOpacity: .62, interactive: false }).addTo(map);
  }
  L.polygon(BOUNDS, { color: '#f59e0b', weight: 2, dashArray: '6 6', fill: false, interactive: false }).addTo(map);
}

/* ---------- نقشه و لایه‌ها ---------- */
const BASE = {
  sat: {
    n: 'ماهواره',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    o: { maxNativeZoom: 18, maxZoom: 21, attribution: 'Imagery © Esri', updateWhenIdle: false, keepBuffer: 3 }
  },
  gsat: {
    n: 'ماهواره ۲',
    url: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    o: { subdomains: '0123', maxNativeZoom: 20, maxZoom: 21, attribution: 'Imagery © Google', updateWhenIdle: false, keepBuffer: 3 }
  }
};
const ORDER = ['sat', 'gsat'];
let curLayer = null, curKey = null;

function useBase(key, auto) {
  if (curLayer) map.removeLayer(curLayer);
  const b = BASE[key];
  curKey = key;
  const layer = curLayer = L.tileLayer(b.url, b.o).addTo(map);
  let ok = 0, bad = 0, moved = false;
  const next = () => {
    if (moved || layer !== curLayer || !auto) return;
    const nx = ORDER[ORDER.indexOf(key) + 1];
    if (nx) {
      moved = true;
      toast('تغییر سریع به «' + BASE[nx].n + '»...');
      useBase(nx, true);
    }
  };
  layer.on('tileload', () => { ok++; });
  layer.on('tileerror', () => { bad++; if (!ok && bad >= 2) next(); });
  if (auto) setTimeout(() => { if (!ok) next(); }, 3500);
  document.querySelectorAll('#seg button').forEach(x => x.setAttribute('aria-pressed', x.dataset.k === curKey));
}

function pinIcon(it) {
  return L.divIcon({
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: `<div class="pin" style="--c:${CATS[it.cat].c}"><span>${emoji(it)}</span><b class="lbl">${esc(it.name)}</b></div>`
  });
}

function updLabels() {
  const z = map.getZoom();
  map.getContainer().classList.toggle('zl', z >= (map.getSize().x > 700 ? 17 : 18));
}

function fitAll() {
  const b = L.latLngBounds(DATA.map(d => d.ll));
  map.fitBounds(b, {
    paddingTopLeft: [25, isMobile() ? 115 : 95],
    paddingBottomRight: [25, isMobile() ? 75 : 35],
    animate: false
  });
}

function bootMap() {
  map = L.map('map', { zoomControl: false, zoomSnap: .5, maxZoom: 21, preferCanvas: true, maxBoundsViscosity: 1 });
  L.control.zoom({ position: 'bottomleft' }).addTo(map);
  fitAll();
  applyBounds();
  drawBoundsMask();

  const seg = $('seg');
  ORDER.forEach(k => {
    const b = document.createElement('button');
    b.className = 'seg-btn';
    b.dataset.k = k;
    b.textContent = BASE[k].n;
    b.onclick = () => useBase(k, false);
    seg.appendChild(b);
  });
  useBase('sat', true);

  DATA.forEach(it => {
    const parts = [];
    if (it.poly) {
      const c = CATS[it.cat].c;
      const pg = L.polygon(it.poly, { color: c, weight: 3, fillColor: c, fillOpacity: .28 });
      pg.on('click', () => select(it.id));
      parts.push(pg);
    }
    const m = L.marker(it.ll, { icon: pinIcon(it), keyboard: true, title: it.name, riseOnHover: true });
    m.on('click', () => select(it.id));
    it._m = m;
    parts.push(m);
    m.on('add', () => {
      const el = m.getElement && m.getElement();
      const p = el && el.querySelector('.pin');
      if (!p || introDone) return;
      p.classList.add('drop');
      p.style.setProperty('--d', introDelay + 'ms');
      introDelay += 45;
    });
    it._g = L.layerGroup(parts);
  });

  map.on('zoomend', () => { updLabels(); syncPins(); });
  updLabels();
  map.on('click', () => setSheetOpen(false));
  apply();
  if (sel !== null) setSelClass(sel, true);
  setTimeout(() => { introDone = true; }, introDelay + 900);
  setTimeout(() => toast('برای دیدن مکان‌های بیشتر نقشه را زوم کنید یا از جست‌وجو و دسته‌بندی‌ها استفاده کنید.', 4800), introDelay + 1300);

  $('fit').onclick = () => { select(null); setSheetOpen(false); fitAll(); };

  let me = null;
  $('loc').onclick = () => {
    if (!navigator.geolocation) {
      toast('مرورگر شما موقعیت‌یابی را پشتیبانی نمی‌کند.');
      return;
    }
    toast('در حال یافتن موقعیت شما...', 2200);
    navigator.geolocation.getCurrentPosition(p => {
      const ll = [p.coords.latitude, p.coords.longitude];
      if (!inCampus(ll)) {
        toast('شما بیرون از محدوده‌ی نقشه‌ی دانشگاه هستید.');
        return;
      }
      if (me) map.removeLayer(me);
      me = L.layerGroup([
        L.circle(ll, { radius: p.coords.accuracy, color: '#0ea5e9', weight: 1.5, fillOpacity: .16 }),
        L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#0ea5e9', fillOpacity: 1 })
      ]).addTo(map);
      map.setView(ll, Math.max(map.getZoom(), 17.5));
      setSheetOpen(false);
    }, () => toast('دسترسی به موقعیت داده نشد. اجازه مکان‌یابی را در تنظیمات مرورگر فعال کنید.'), {
      enableHighAccuracy: true,
      timeout: 10000
    });
  };

  addEventListener('resize', () => {
    map.invalidateSize();
    applyBounds();
    updLabels();
  });
}

/* ---------- رویدادهای رابط کاربری ---------- */
$('q').oninput = e => { query = e.target.value.trim(); apply(); };
$('openSheetBtn').onclick = () => { setSheetOpen(true); setTimeout(() => $('q').focus(), 200); };
$('closeSheetBtn').onclick = () => setSheetOpen(false);
$('grip').onclick = () => setSheetOpen(false);

$('csBadge').onclick = e => burstHearts(e.currentTarget);
$('csFooterBtn').onclick = e => burstHearts(e.currentTarget);

renderChips();
renderList();

/* ---------- بارگذاری Leaflet با سرورهای پشتیبان ---------- */
const CSS = [
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
];
const JS = [
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

function loadCSS(i) {
  if (i >= CSS.length) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = CSS[i];
  l.onerror = () => { l.remove(); loadCSS(i + 1); };
  document.head.appendChild(l);
}

function loadJS(i) {
  if (window.L) return bootMap();
  if (i >= JS.length) { $('fail').classList.add('show'); return; }
  const s = document.createElement('script');
  const to = setTimeout(() => { s.onload = s.onerror = null; s.remove(); loadJS(i + 1); }, 3500);
  s.onload = () => { clearTimeout(to); window.L ? bootMap() : loadJS(i + 1); };
  s.onerror = () => { clearTimeout(to); s.remove(); loadJS(i + 1); };
  s.src = JS[i];
  document.head.appendChild(s);
}

loadCSS(0);
loadJS(0);
