/* PrintDong! — prototipe interaktif (HTML/CSS/JS murni, tanpa backend) */
(function () {
  'use strict';
  const D = window.PD_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const app = $('#app');
  const phone = $('#phone');

  /* ---------- Util ---------- */
  const rp = n => 'Rp' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const pad2 = n => String(n).padStart(2, '0');
  const hhmm = d => pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  const addMin = (d, m) => new Date(d.getTime() + m * 60000);
  const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const dmy = d => d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear();
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const I = (n, s = 20, c = '') => `<svg class="ic ${c}" width="${s}" height="${s}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const shopOf = id => D.shops.find(s => s.id === id);
  const crowd = q => (q <= 3 ? 'sepi' : q <= 8 ? 'sedang' : 'ramai');
  const CROWD_LBL = { sepi: 'Sepi', sedang: 'Sedang', ramai: 'Ramai' };
  const fmtSize = b => (b / 1048576 >= 1 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');

  /* ---------- State ---------- */
  let S, cur = null, stack = [], timers = [], autoTimer = null;

  function freshState() {
    const now = new Date();
    const orders = D.orders.map(o => {
      const c = Object.assign({}, o);
      const created = addMin(now, o.offsetMin || -60);
      c.t = { recv: created, queue: addMin(created, 7), print: null, ready: o.status === 'ready' ? addMin(now, -3) : null };
      if (o.status === 'done') c.t = { recv: created, queue: created, print: created, ready: created };
      return c;
    });
    return {
      phone: '', otp: '', resendAt: 0, loggedIn: false,
      user: { name: 'Raka Pratama', first: 'Raka', init: 'RK', campus: 'UPN "Veteran" Jakarta · Informatika', plus: false, notif: true, plusUntil: null },
      sort: 'near', only24: false, q: '',
      fav: {}, draft: null, shopId: 'berkah',
      orders, notifs: D.notifs.map(n => Object.assign({}, n)),
      ordTab: 'aktif', ordSearch: false, ordQ: '', sheetOrder: null,
      nfFilter: 'all', qris: null, savedPromo: '', lastId: 4835
    };
  }

  /* ---------- Harga ---------- */
  function newDraft(shopId) {
    return { shopId, files: [], color: 'bw', paper: '70', sides: 1, copies: 1, binding: 'none', fixed: false, scanned: false, promo: S.savedPromo || '', note: '' };
  }
  const totalPages = d => d.files.reduce((a, f) => a + f.pages, 0);
  function issuesOf(d) {
    const tot = totalPages(d);
    if (tot < 3) return null;
    const blank = Math.min(12, tot);
    const cut = tot >= 8 ? 7 : 2;
    return { blank, cut, count: 2 };
  }
  function pricing(d) {
    const shop = shopOf(d.shopId);
    const iss = issuesOf(d);
    const raw = totalPages(d);
    const pages = d.fixed && iss ? raw - 1 : raw;
    const lbr = pages * d.copies;
    const unit = (d.color === 'color' ? shop.color : shop.bw) + (d.paper === '80' ? D.paper80Extra : 0);
    const print = unit * lbr;
    const bUnit = D.bindings[d.binding].price;
    const bind = bUnit * d.copies;
    const service = S.user.plus ? 0 : D.serviceFee;
    let disc = 0;
    if ((d.promo || '').toUpperCase() === D.promoCode && bind > 0) disc = Math.round(bind * 0.2);
    const total = print + bind + service - disc;
    return { shop, pages, raw, lbr, unit, print, bUnit, bind, service, disc, total, sheets: d.sides === 2 ? Math.ceil(pages / 2) * d.copies : lbr };
  }
  const optSummary = d => [
    d.color === 'color' ? 'Berwarna' : 'Hitam putih',
    'HVS ' + d.paper + ' gsm',
    d.sides === 2 ? 'Bolak-balik' : '1 sisi',
    D.bindings[d.binding].label
  ];

  /* ---------- QR palsu (visual saja) ---------- */
  function qrSvg(seedStr, n = 25) {
    let h = 2166136261;
    for (const ch of seedStr) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
    const m = Array.from({ length: n }, () => Array(n).fill(0));
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) m[y][x] = rnd() > 0.52 ? 1 : 0;
    const finder = (ox, oy) => {
      for (let y = -1; y <= 7; y++) for (let x = -1; x <= 7; x++) {
        const yy = oy + y, xx = ox + x;
        if (yy < 0 || xx < 0 || yy >= n || xx >= n) continue;
        const edge = x === 0 || y === 0 || x === 6 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        m[yy][xx] = (x < 0 || y < 0 || x > 6 || y > 6) ? 0 : (edge || core ? 1 : 0);
      }
    };
    finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
    for (let y = 9; y < 16; y++) for (let x = 9; x < 16; x++) if (x > 10 && x < 14 && y > 10 && y < 14) m[y][x] = 0; // ruang logo
    let d = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m[y][x]) d += `M${x} ${y}h1v1h-1z`;
    return `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#0a1f44"/></svg>`;
  }

  /* ---------- Toast ---------- */
  function toast(msg, o = {}) {
    const host = $('#toastHost');
    host.classList.toggle('bottom', !!o.bottom);
    const el = document.createElement('div');
    el.className = 'toast' + (o.kind ? ' ' + o.kind : '');
    el.setAttribute('role', 'status');
    el.innerHTML = `${I(o.kind === 'err' ? 'alert' : 'check-circle', 20)}<span>${esc(msg)}</span>` + (o.action ? `<button class="ta" type="button">${esc(o.actionLabel || 'Urungkan')}</button>` : '');
    host.appendChild(el);
    if (o.action) $('.ta', el).addEventListener('click', () => { o.action(); el.remove(); });
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, o.ms || 2600);
  }

  /* ---------- Navigasi ---------- */
  function later(fn, ms) { const t = setTimeout(fn, ms); timers.push(t); return t; }
  function every(fn, ms) { const t = setInterval(fn, ms); timers.push(t); return t; }
  function clearTimers() { timers.forEach(t => { clearTimeout(t); clearInterval(t); }); timers = []; }

  function setTone(light) {
    $('#statusbar').classList.toggle('light', !!light);
    $('.home-ind').classList.toggle('light', !!light);
  }

  function show(name, params = {}, dir = 'fwd', keepScroll) {
    const sc = SCREENS[name];
    if (!sc) return;
    let st = 0;
    if (keepScroll) { const s = $('.scroll', app); st = s ? s.scrollTop : 0; }
    clearTimers();
    cur = { name, params };
    app.innerHTML = sc.render(params);
    const el = app.firstElementChild;
    if (keepScroll) el.style.animation = 'none';
    else if (dir === 'back') el.classList.add('back');
    else if (dir === 'fade') el.classList.add('fade');
    if (keepScroll) { const s = $('.scroll', app); if (s) s.scrollTop = st; }
    setTone(typeof sc.dark === 'function' ? sc.dark(params) : sc.dark);
    sc.mount && sc.mount(el, params);
    updateDemo();
  }
  function go(name, params, opt = {}) {
    if (!opt.replace && cur) stack.push({ name: cur.name, params: cur.params });
    show(name, params, opt.dir || 'fwd');
  }
  function back() {
    const p = stack.pop();
    if (p) show(p.name, p.params, 'back'); else show('home', {}, 'back');
  }
  function root(name, params) { stack = []; show(name, params, 'fade'); }
  function rerender() { if (cur) show(cur.name, cur.params, 'fwd', true); }

  /* ---------- Pesanan ---------- */
  const isActive = o => o.status !== 'done';
  function latestActive() {
    const act = S.orders.filter(o => o.status === 'queue' || o.status === 'printing');
    if (act.length) return act.sort((a, b) => b.t.recv - a.t.recv)[0];
    const ready = S.orders.filter(o => o.status === 'ready');
    return ready.length ? ready.sort((a, b) => b.t.recv - a.t.recv)[0] : null;
  }
  const etaMin = o => (o.status === 'queue' ? o.pos * 3 : o.status === 'printing' ? Math.max(1, Math.ceil((o.sheets - o.printed) / 20) + 1) : 0);
  const pctPrinted = o => Math.round((o.printed / Math.max(1, o.sheets)) * 100);
  const unread = () => S.notifs.filter(n => n.unread).length;
  const activeCount = () => S.orders.filter(isActive).length;
  const STAT_LBL = { queue: 'Menunggu antrean', printing: 'Sedang dicetak', ready: 'Siap diambil', done: 'Selesai' };

  function pushNotif(n) { S.notifs.unshift(Object.assign({ id: 'n' + Date.now() + Math.random(), unread: true, group: 'Hari ini', time: hhmm(new Date()) }, n)); }

  function advance(o) {
    if (!o || o.status === 'ready' || o.status === 'done') return false;
    const now = new Date();
    if (o.status === 'queue') {
      if (o.pos > 1) { o.pos--; }
      else {
        o.status = 'printing'; o.printed = Math.ceil(o.sheets * 0.75); o.t.print = now;
        pushNotif({ type: 'order', icon: 'printer', tone: 'blue', title: 'Pesananmu sedang dicetak', body: `${o.id} · ${shopOf(o.shopId).name} · estimasi siap ± ${etaMin(o)} mnt.` });
      }
    } else if (o.status === 'printing') {
      o.status = 'ready'; o.printed = o.sheets; o.t.ready = now;
      pushNotif({ type: 'order', icon: 'check-circle', tone: 'ok', title: 'Pesanan siap diambil', body: `${o.id} di ${shopOf(o.shopId).name} sudah siap. Kode ambil: ${o.code}.` });
      toast(`${o.id} siap diambil! Kode: ${o.code}`, { action: () => go('pickup', { id: o.id }), actionLabel: 'Lihat', ms: 4000 });
    }
    afterStatus();
    return true;
  }
  function jumpTo(o, to) {
    if (!o) return;
    if (to === 'queue') { o.status = 'queue'; o.pos = Math.max(1, o.qTotal - 1 || 1); o.printed = 0; o.t.ready = null; }
    else if (to === 'printing') { o.status = 'printing'; o.printed = Math.ceil(o.sheets * 0.75); o.t.print = o.t.print || new Date(); o.t.ready = null; }
    else if (to === 'ready') { o.status = 'ready'; o.printed = o.sheets; o.t.ready = new Date(); }
    afterStatus();
  }
  function afterStatus() {
    if (cur && ['track', 'home', 'orders', 'pickup', 'notif'].includes(cur.name)) rerender();
    updateDemo();
  }

  /* ---------- Komponen UI ---------- */
  function tabbar(active, dark) {
    const t = (key, icon, label, extra = '') => `<button class="tab ${active === key ? 'on' : ''}" data-act="tab" data-to="${key}" aria-label="${label}">
      <span class="w">${I(icon, 22)}</span><span>${label}</span>${extra}</button>`;
    const n = activeCount();
    return `<nav class="tabbar ${dark ? 'dark' : ''}">${t('home', 'home', 'Beranda')}${t('orders', 'receipt', 'Pesanan', n ? `<span class="bd">${n}</span>` : '')}${t('plus', 'crown', 'Plus')}${t('profile', 'user', 'Profil')}</nav>`;
  }
  const header = (title, opts = {}) => `<header class="hdr">
    <button class="round" data-act="back" aria-label="Kembali">${I('chevron-left', 20)}</button>
    <h1>${title}</h1>${opts.right || '<span class="sp"></span>'}</header>`;
  const stepper = (n, label) => `<div class="stepper"><div class="lbl"><b>LANGKAH ${n} DARI 3</b> · ${label}</div><div class="bars">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div></div>`;
  const badge = q => { const c = crowd(q); return `<span class="badge ${c}"><span class="dot"></span>${CROWD_LBL[c]}</span>`; };
  const fileKind = n => { const e = (n.split('.').pop() || '').toLowerCase(); return e === 'pdf' ? ['', 'PDF'] : (e === 'doc' || e === 'docx') ? ['doc', 'DOC'] : ['img', 'JPG']; };
  const fileIcon = n => { const [c, l] = fileKind(n); return `<div class="fileicon ${c}">${I(c === 'img' ? 'image' : 'file', 18)}<span>${l}</span></div>`; };
  const logoMark = (s = 80) => `<svg width="${s}" height="${s}" viewBox="0 0 80 80" aria-hidden="true">
    <path d="M27 6h20l10 10v18H27z" fill="#fff"/><path d="M47 6l10 10H47z" fill="#c9d9ff"/>
    <rect x="33" y="14" width="12" height="3.2" rx="1.6" fill="#3b7bff"/><rect x="33" y="21" width="18" height="3.2" rx="1.6" fill="#9dbbff"/>
    <rect x="12" y="32" width="56" height="26" rx="9" fill="#fff"/><rect x="12" y="32" width="56" height="9" rx="4.5" fill="#e8eefb"/>
    <rect x="22" y="47" width="36" height="3" rx="1.5" fill="#0a1f44"/><circle cx="60" cy="38" r="2.6" fill="#12b76a"/>
    <rect x="25" y="53" width="30" height="21" rx="3" fill="#fff"/><rect x="31" y="60" width="18" height="2.6" rx="1.3" fill="#3b7bff"/><rect x="31" y="66" width="12" height="2.6" rx="1.3" fill="#9dbbff"/></svg>`;
  function ringSvg(frac, size = 48, w = 5, col = '#9dbbff', bg = 'rgba(255,255,255,.22)') {
    const r = (size - w) / 2, c = 2 * Math.PI * r;
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${bg}" stroke-width="${w}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.max(0.04, Math.min(1, frac)))}"/></svg>`;
  }
  const keypad = () => {
    const sub = { 2: 'A B C', 3: 'D E F', 4: 'G H I', 5: 'J K L', 6: 'M N O', 7: 'P Q R S', 8: 'T U V', 9: 'W X Y Z' };
    const k = n => `<button class="key" data-act="key" data-k="${n}" type="button"><b>${n}</b>${sub[n] ? `<small>${sub[n]}</small>` : ''}</button>`;
    return `<div class="pad-wrap" aria-label="Papan angka"><div class="pad-row">${k(1)}${k(2)}${k(3)}</div><div class="pad-row">${k(4)}${k(5)}${k(6)}</div><div class="pad-row">${k(7)}${k(8)}${k(9)}</div>
      <div class="pad-row"><span class="key blank"></span>${k(0)}<button class="key del" data-act="key" data-k="del" type="button" aria-label="Hapus">${I('backspace', 26)}</button></div></div>`;
  };

  /* ---------- Ilustrasi onboarding ---------- */
  function illus(i) {
    if (i === 0) return `<div class="illus"><div class="halo"></div><div class="ring"></div><div class="shadow-g"></div>
      <div class="mini-phone"><div class="body"></div><div class="scr"><div class="isl"></div><h5>Terdekat</h5>
        ${[56, 116, 176, 236].map(t => `<div class="mini-row" style="top:${t}px"><i></i><div><b></b><u></u></div></div>`).join('')}</div></div>
      <div class="pinbtn">${I('map-pin', 26)}</div>
      <div class="float" style="left:214px;top:50px"><span class="d" style="background:var(--ok)"></span>Sepi · 2 antre</div>
      <div class="float" style="left:236px;top:250px">Rp400/lbr</div>
      <div class="float" style="left:14px;top:262px;color:var(--ink)">${I('map-pin', 16, '')}250 m</div></div>`;
    if (i === 1) return `<div class="illus"><div class="halo"></div><div class="ring"></div>
      <svg style="position:absolute;left:0;top:0" width="362" height="392" viewBox="0 0 362 392" aria-hidden="true">
        <g transform="rotate(8 220 170)"><rect x="168" y="46" width="170" height="210" rx="14" fill="#fff" opacity=".7"/></g>
        <g transform="rotate(-6 150 180)"><rect x="60" y="60" width="178" height="230" rx="14" fill="#fff" opacity=".9" stroke="#e4e7ec"/></g>
        <rect x="80" y="62" width="170" height="226" rx="14" fill="#fff" stroke="#e4e7ec"/>
        <rect x="98" y="84" width="92" height="9" rx="4" fill="#0a1f44"/>
        <g fill="#d0d5dd"><rect x="98" y="104" width="130" height="5" rx="2.5"/><rect x="98" y="116" width="120" height="5" rx="2.5"/><rect x="98" y="128" width="136" height="5" rx="2.5"/><rect x="98" y="140" width="110" height="5" rx="2.5"/></g>
        <rect x="98" y="164" width="130" height="50" rx="8" fill="#dbe7ff"/>
        <g fill="#d0d5dd"><rect x="98" y="228" width="120" height="5" rx="2.5"/><rect x="98" y="240" width="90" height="5" rx="2.5"/></g>
        <ellipse cx="180" cy="344" rx="70" ry="12" fill="#0a1f44" opacity=".1"/>
        <circle cx="244" cy="200" r="48" fill="#fff" opacity=".35" stroke="#1e4fd8" stroke-width="12"/>
        <path d="M278 236l36 40" stroke="#0a1f44" stroke-width="14" stroke-linecap="round"/>
        <circle cx="264" cy="40" r="26" fill="#12b76a"/><path d="M252 40l9 9 15-17" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <div class="float" style="left:24px;top:62px"><span class="d" style="background:var(--ok)"></span>Margin pas</div>
      <div class="float" style="left:-2px;top:238px"><span class="d" style="background:var(--warn)"></span>Hal. 12 kosong</div></div>`;
    return `<div class="illus"><div class="halo"></div><div class="ring"></div>
      <svg style="position:absolute;left:0;top:0" width="362" height="392" viewBox="0 0 362 392" aria-hidden="true">
        <rect x="118" y="64" width="140" height="100" rx="10" fill="#fff" stroke="#e4e7ec" transform="rotate(4 188 114)"/>
        <g fill="#d0d5dd" transform="rotate(4 188 114)"><rect x="140" y="88" width="90" height="5" rx="2.5"/><rect x="140" y="102" width="86" height="5" rx="2.5"/><rect x="140" y="116" width="80" height="5" rx="2.5"/></g>
        <rect x="94" y="140" width="214" height="110" rx="22" fill="#e8eefb"/><rect x="94" y="140" width="214" height="30" rx="14" fill="#fff"/>
        <rect x="136" y="210" width="170" height="6" rx="3" fill="#0a1f44" opacity="0"/>
        <rect x="124" y="236" width="150" height="6" rx="3" fill="#0a1f44"/>
        <rect x="236" y="186" width="68" height="32" rx="10" fill="#0a1f44"/><text x="270" y="208" fill="#fff" font-size="16" font-weight="800" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif">#2</text>
        <rect x="126" y="258" width="150" height="70" rx="8" fill="#fff" stroke="#e4e7ec"/><g><rect x="142" y="272" width="100" height="5" rx="2.5" fill="#d0d5dd"/><rect x="142" y="284" width="100" height="5" rx="2.5" fill="#9dbbff"/><rect x="142" y="296" width="70" height="5" rx="2.5" fill="#9dbbff"/></g>
        <ellipse cx="190" cy="352" rx="76" ry="12" fill="#0a1f44" opacity=".1"/></svg>
      <div class="float" style="left:170px;top:30px;border-radius:20px;padding:10px 14px 10px 10px;gap:10px"><span style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#3b7bff,#1e4fd8);color:#fff;display:flex;align-items:center;justify-content:center">${I('bell', 18)}</span><span><b style="display:block;font-size:13px">Pesanan siap diambil</b><span style="font-weight:400;color:var(--ink3);font-size:12px">Kode ambil: 7Q4K</span></span></div>
      <div style="position:absolute;left:16px;top:176px;width:84px;height:84px;border-radius:50%;background:#fff;box-shadow:0 10px 24px rgba(10,31,68,.14);display:flex;align-items:center;justify-content:center">${ringSvg(.5, 72, 7, '#1e4fd8', '#dbe7ff')}<div style="position:absolute;text-align:center"><b style="display:block;font-size:20px;line-height:22px">2</b><small style="font-size:9px;color:var(--ink3)">POSISI</small></div></div></div>`;
  }

  /* ---------- Gambar toko (detail) ---------- */
  function storeSvg(name) {
    const stripes = Array.from({ length: 12 }, (_, i) => `<rect x="${30 + i * 28}" y="140" width="28" height="30" fill="${i % 2 ? '#fff' : '#2f6bff'}"/>`).join('');
    return `<svg class="store" viewBox="0 0 402 292" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <rect width="402" height="292" fill="url(#bg)"/><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1f44"/><stop offset="1" stop-color="#1e4fd8"/></linearGradient><linearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dbe7ff"/><stop offset="1" stop-color="#8fb0ff"/></linearGradient></defs>
      <rect x="30" y="110" width="342" height="170" rx="6" fill="#fff"/>${stripes}
      <rect x="86" y="98" width="232" height="34" rx="9" fill="#fff"/><text x="202" y="121" text-anchor="middle" font-size="13" font-weight="800" fill="#0a1f44" font-family="Plus Jakarta Sans,sans-serif" letter-spacing=".4">${esc(name.toUpperCase())}</text>
      <rect x="50" y="178" width="162" height="98" rx="8" fill="url(#gl)"/><rect x="58" y="214" width="48" height="34" rx="9" fill="#fff"/><rect x="64" y="236" width="36" height="3" rx="1.5" fill="#0a1f44"/><rect x="116" y="214" width="48" height="34" rx="9" fill="#fff"/><rect x="122" y="236" width="36" height="3" rx="1.5" fill="#0a1f44"/>
      <rect x="226" y="178" width="124" height="98" rx="8" fill="url(#gl)"/><rect x="262" y="198" width="32" height="76" rx="16" fill="#6c86c8" opacity=".7"/></svg>`;
  }

  /* =========================================================
     LAYAR
     ========================================================= */
  const SCREENS = {};

  /* --- Splash --- */
  SCREENS.splash = {
    dark: true,
    render: () => `<section class="screen splash"><i class="glow g1"></i><i class="glow g2"></i><i class="glow g3"></i>
      <div class="brand"><div class="markbox">${logoMark(80)}</div><h1>Print<span>Dong!</span></h1><p>Print tanpa antre, beres tanpa ribet.</p></div></section>`,
    mount: () => later(() => { stack = []; show('onb', { i: 0 }, 'fade'); }, 2200)
  };

  /* --- Onboarding --- */
  const ONB = [
    { t: 'Pilih percetakan paling sepi', p: 'Bandingkan antrean, estimasi waktu, dan harga per lembar dari percetakan di sekitar kampus.' },
    { t: 'File dicek otomatis sebelum dicetak', p: 'Halaman kosong dan margin terpotong terdeteksi lebih dulu, jadi kamu nggak bayar kertas sia-sia.' },
    { t: 'Pantau antrean, ambil pas siap', p: 'Lihat posisi antreanmu secara real-time. Kami kabari saat dokumen siap diambil.' }
  ];
  SCREENS.onb = {
    render: ({ i }) => `<section class="screen">
      <div class="onb-top"><span class="wordmark">Print<span>Dong!</span></span>${i < 2 ? '<button class="link" data-act="onb-skip">Lewati</button>' : ''}</div>
      ${illus(i)}
      <div class="dots">${[0, 1, 2].map(k => `<button class="${k === i ? 'on' : ''}" data-act="onb-go" data-i="${k}" aria-label="Halaman ${k + 1}"></button>`).join('')}</div>
      <div class="onb-text"><h2>${ONB[i].t}</h2><p>${ONB[i].p}</p></div>
      <div class="onb-cta"><button class="btn" data-act="onb-next" data-i="${i}">${i < 2 ? 'Lanjut' : 'Mulai sekarang'} ${I('arrow-right', 20)}</button>
        ${i === 2 ? '<div class="alt">Sudah punya akun? <button class="link" data-act="onb-skip">Masuk</button></div>' : ''}</div></section>`
  };

  /* --- Masuk: nomor HP --- */
  const fmtPhone = d => (d.slice(0, 3) + ' ' + d.slice(3, 7) + ' ' + d.slice(7, 11)).trim();
  const phoneOk = () => S.phone.length >= 9;
  SCREENS.phone = {
    render: () => `<section class="screen">
      <header class="hdr"><button class="round" data-act="back" aria-label="Kembali">${I('chevron-left', 20)}</button><span style="flex:1"></span>
        <div style="display:flex;gap:6px"><i style="width:28px;height:6px;border-radius:3px;background:var(--primary)"></i><i style="width:12px;height:6px;border-radius:3px;background:var(--line)"></i></div></header>
      <div class="auth-body"><h2>Masuk ke PrintDong!</h2><p>Pakai nomor HP aktif. Kami kirim kode verifikasi lewat WhatsApp — tanpa kata sandi.</p>
        <div style="height:16px"></div>
        <div class="field-label">Nomor HP</div>
        <div class="field focus"><span>+62</span><span class="div"></span>
          <span class="val">${S.phone ? esc(fmtPhone(S.phone)) : '<span class="ph">812 3456 7890</span>'}<span class="caret"></span></span></div>
        <div class="help">Kode OTP dikirim ke WhatsApp nomor ini.</div>
        <div class="infobox">${I('info', 18)}<span>Dengan melanjutkan, kamu menyetujui <b>Syarat &amp; Ketentuan</b> serta <b>Kebijakan Privasi</b> PrintDong!.</span></div></div>
      <div style="padding:0 20px 14px"><button class="btn" data-act="send-otp" ${phoneOk() ? '' : 'disabled'}>Kirim kode OTP</button></div>
      ${keypad()}</section>`
  };

  /* --- OTP --- */
  SCREENS.otp = {
    render: () => {
      const cells = Array.from({ length: 6 }, (_, i) => `<div class="${S.otp[i] ? 'fill' : i === S.otp.length ? 'cur' : ''}">${S.otp[i] || ''}</div>`).join('');
      return `<section class="screen">
      <header class="hdr"><button class="round" data-act="back" aria-label="Kembali">${I('chevron-left', 20)}</button><span style="flex:1"></span>
        <div style="display:flex;gap:6px"><i style="width:12px;height:6px;border-radius:3px;background:var(--primary)"></i><i style="width:28px;height:6px;border-radius:3px;background:var(--primary)"></i></div></header>
      <div class="auth-body"><h2>Masukkan kode OTP</h2>
        <p>Kode 6 digit sudah dikirim ke WhatsApp <b style="color:var(--ink)">+62 ${esc(fmtPhone(S.phone))}</b>. <button class="link" data-act="back">Ubah nomor</button></p>
        <div class="otp" id="otpBox">${cells}</div>
        <div class="help" id="resend"></div>
        <div class="help" style="margin-top:14px">Untuk demo, kode apa pun yang terdiri dari 6 digit akan diterima.</div></div>
      <div style="padding:0 20px 14px"><button class="btn" data-act="verify" ${S.otp.length === 6 ? '' : 'disabled'}>Verifikasi &amp; masuk</button></div>
      ${keypad()}</section>`;
    },
    mount: () => {
      const tick = () => {
        const el = $('#resend'); if (!el) return;
        const left = Math.max(0, Math.ceil((S.resendAt - Date.now()) / 1000));
        el.innerHTML = left > 0 ? `Belum dapat kode? <span style="color:var(--ink3)">Kirim ulang dalam 00:${pad2(left)}</span>` : 'Belum dapat kode? <button class="link" data-act="resend">Kirim ulang</button>';
      };
      tick(); every(tick, 1000);
    }
  };

  /* --- Beranda --- */
  function sortedShops() {
    let l = D.shops.slice();
    const q = S.q.trim().toLowerCase();
    if (q) l = l.filter(s => (s.name + ' ' + s.addr + (q.includes('jilid') ? ' jilid' : '')).toLowerCase().includes(q) || (q.includes('fotokopi') && s.name.toLowerCase().includes('fotokopi')));
    if (S.only24) l = l.filter(s => s.open24);
    const by = { near: (a, b) => a.dist - b.dist, sepi: (a, b) => a.queue - b.queue, murah: (a, b) => a.bw - b.bw }[S.sort];
    return l.sort(by);
  }
  const cheapestId = () => D.shops.slice().sort((a, b) => a.bw - b.bw)[0].id;
  function shopCard(s) {
    return `<button class="shop" data-act="open-shop" data-id="${s.id}" aria-label="${esc(s.name)}">
      <div class="head"><div class="logo">${s.ini}</div>
        <div class="nm">${s.id === cheapestId() ? '<span class="badge termurah">Termurah</span>' : ''}<b>${esc(s.name)}</b><span>${esc(s.addr)}</span></div>${badge(s.queue)}</div>
      <div class="meta"><div>${I('map-pin', 14)}${s.distLabel}</div><div>${I('clock', 14)}± ${s.eta} mnt</div><div>${I('users', 14)}${s.queue} antre</div></div>
      <div class="divider"></div>
      <div class="prices"><div>Hitam putih<br><b>${rp(s.bw)}</b>/lbr</div><div>Berwarna<br><b>${rp(s.color)}</b>/lbr</div></div></button>`;
  }
  function shopListHtml() {
    const l = sortedShops();
    return l.length ? l.map(shopCard).join('') : `<div class="empty-state">${I('search', 40)}<b style="display:block;color:var(--ink)">Percetakan tidak ditemukan</b>Coba kata kunci lain atau reset filter.</div>`;
  }
  function trackerHtml(o) {
    if (!o) return `<div class="tracker">${I('printer', 28)}<div class="info"><b>Belum ada pesanan aktif</b><span>Pilih percetakan di bawah untuk mulai mencetak.</span></div></div>`;
    const sh = shopOf(o.shopId);
    let ring, line;
    const eta = etaMin(o);
    if (o.status === 'queue') { ring = `${ringSvg((o.qTotal - o.pos + 0.7) / (o.qTotal + 0.7))}<b>${o.pos}</b>`; line = `Posisi ${o.pos} · siap ± ${eta} mnt (${hhmm(addMin(new Date(), eta))})`; }
    else if (o.status === 'printing') { ring = `${ringSvg(o.printed / o.sheets)}<b style="font-size:13px">${pctPrinted(o)}%</b>`; line = `Sedang dicetak · siap ± ${eta} mnt (${hhmm(addMin(new Date(), eta))})`; }
    else { ring = `${ringSvg(1, 48, 5, '#4ade9a')}<b>${I('check', 22)}</b>`; line = `Siap diambil · kode ${o.code}`; }
    const idx = { queue: 1, printing: 2, ready: 3 }[o.status];
    const seg = ['Diterima', 'Antre', 'Dicetak', 'Siap'].map((l, i) => `<div class="${i < idx ? 'done' : i === idx ? 'cur' : ''}"><i></i><span>${l}</span></div>`).join('');
    const last = o.status === 'ready' ? 'done' : '';
    return `<button class="tracker" data-act="${o.status === 'ready' ? 'open-pickup' : 'open-track'}" data-id="${o.id}">
      <div class="row"><div class="mring">${ring}</div><div class="info"><small>Pesanan aktif · ${o.id}</small><b>${esc(sh.name)}</b><span>${line}</span></div><span class="go">${I('chevron-right', 18)}</span></div>
      <div class="prog">${seg.replace(/class="cur"/, 'class="cur"')}</div></button>`;
  }
  SCREENS.home = {
    render: () => {
      const o = latestActive(); const un = unread();
      const chip = (k, l) => `<button class="chip ${S.sort === k ? 'on' : ''}" data-act="sort" data-k="${k}">${S.sort === k ? I('check', 16) : ''}${l}</button>`;
      return `<section class="screen canvas has-tabs">
      <div class="scroll">
        <div class="home-head"><div><h1>Hai, ${esc(S.user.first)}</h1><div class="loc">${I('map-pin', 16)}Kampus UPNVJ Pondok Labu${I('chevron-down', 14)}</div></div>
          <div class="head-actions"><button class="round l" data-act="open-notif" aria-label="Notifikasi">${I('bell', 22)}${un ? `<span class="cnt">${un}</span>` : ''}</button>
            <button class="avatar ${S.user.plus ? 'plus' : ''}" data-act="tab" data-to="profile" aria-label="Profil">${S.user.init}${S.user.plus ? `<span class="crown">${I('crown', 12)}</span>` : ''}</button></div></div>
        <label class="search">${I('search', 20)}<input id="q" type="search" placeholder="Cari percetakan, jilid, fotokopi…" value="${esc(S.q)}" autocomplete="off"><button class="fb" type="button" data-act="focus-q" aria-label="Fokus pencarian">${I('sliders', 18)}</button></label>
        <div class="hero ${o ? '' : 'empty'}"><i class="e1"></i><i class="e2"></i><div class="paper"><i style="top:17px;width:56px"></i><i style="top:29px;width:40px"></i><i style="top:41px;width:56px"></i><i style="top:53px;width:40px"></i></div>
          <div class="small">PrintDong!</div><h2>Print tanpa antre.<br>Tinggal ambil pas siap.</h2>${trackerHtml(o)}</div>
        <div class="sec-head"><div class="t"><h2 class="sec-title">Percetakan terdekat</h2><p>${D.shops.length} percetakan buka · diperbarui 1 menit lalu</p></div><button class="peta" data-act="soon" data-msg="Peta percetakan belum tersedia di prototipe.">${I('navigation', 16)}Peta</button></div>
        <div class="filters"><button class="chip icon" data-act="reset-filter" aria-label="Reset filter">${I('sliders', 18)}</button>${chip('near', 'Terdekat')}${chip('sepi', 'Tersepi')}${chip('murah', 'Termurah')}
          <button class="chip ${S.only24 ? 'on' : ''}" data-act="only24">${S.only24 ? I('check', 16) : ''}Buka 24 jam</button></div>
        <div class="shop-list" id="shopList">${shopListHtml()}</div><div style="height:12px"></div>
      </div>${tabbar('home')}</section>`;
    },
    mount: () => {
      const q = $('#q');
      q.addEventListener('input', () => { S.q = q.value; $('#shopList').innerHTML = shopListHtml(); });
    }
  };

  /* --- Detail percetakan --- */
  SCREENS.detail = {
    dark: true,
    render: ({ id }) => {
      const s = shopOf(id); const c = crowd(s.queue); const fav = S.fav[id];
      const hours = Array.from({ length: 15 }, (_, i) => { const h = 8 + i; const v = Math.abs(Math.sin((h + s.queue) * 0.7)) * 0.7 + (h >= 11 && h <= 14 ? 0.25 : 0); return { h, v: Math.min(1, v) }; });
      const nowH = Math.min(22, Math.max(8, new Date().getHours()));
      const q = Array.from({ length: s.queue }, (_, i) => i);
      return `<section class="screen has-bar">
      <div class="scroll" style="background:#fff">
        <div class="dhero">${storeSvg(s.name)}<div class="tl"><button class="round glass" data-act="back" aria-label="Kembali">${I('chevron-left', 20)}</button><span class="grow"></span>
          <button class="round glass" data-act="share" data-id="${id}" aria-label="Bagikan">${I('share', 20)}</button>
          <button class="round glass" data-act="fav" data-id="${id}" aria-label="Favorit" aria-pressed="${!!fav}">${I('heart', 20).replace('class="ic ', fav ? 'style="fill:#ff6b6b;stroke:#ff6b6b" class="ic ' : 'class="ic ')}</button></div><span class="pg">1/8</span></div>
        <div class="sheetbody">
          <div class="tags"><span class="badge ${c}"><span class="dot"></span>${CROWD_LBL[c]}</span><span class="badge sepi" style="color:var(--ok-text)">${I('check-circle', 14)} Buka sekarang</span></div>
          <h1>${esc(s.name)}</h1><p class="addr">${esc(s.addrFull)}</p>
          <div class="stats"><div><b>${I('star', 16, 'star')}${s.rating}</b><span>${s.reviews} ulasan</span></div><div><b>${I('map-pin', 16)}${s.distLabel}</b><span>${s.walk} mnt jalan</span></div><div><b>${I('clock', 16)}${s.hours}</b><span>${s.open24 ? 'Setiap hari' : 'Buka tiap hari'}</span></div></div>
          <div class="live"><div class="top"><div><div class="e"><i></i>Antrean live</div><div class="num">${s.queue}<small>antrean</small></div></div><div class="r"><b>± ${s.eta} menit</b><span>estimasi selesai</span></div></div>
            <div class="qchips"><span class="first">Dicetak</span>${q.slice(1, 4).map(i => `<span>#${i + 1}</span>`).join('')}<span class="you">Kamu</span></div>
            <p>Pesan sekarang, kamu jadi antrean ke-${s.queue + 1}.</p></div>
          <div class="card busy"><div class="h"><b>Jam ramai hari ini</b><span>Biasanya sepi ${s.calmAt}</span></div>
            <div class="bars-c">${hours.map(x => `<i class="${x.h === nowH ? 'now' : x.v > .75 ? 'hi' : x.v > .5 ? 'mid' : ''}" style="height:${Math.round(14 + x.v * 50)}px" title="${x.h}.00"></i>`).join('')}</div>
            <div class="bars-lbl"><span>08</span><span>12</span><span>16</span><span>22</span></div></div>
          <div class="svc"><div>${I('printer', 18)}Hitam putih ${rp(s.bw)}/lbr</div><div>${I('printer', 18)}Berwarna ${rp(s.color)}/lbr</div><div>${I('file', 18)}Jilid mulai ${rp(D.bindings.staples.price)}</div><div>${I('store', 18)}Ambil di toko</div></div>
        </div></div>
      <div class="bar"><div class="tot"><small>Mulai dari</small><b>${rp(s.bw)}/lbr</b></div><button class="btn fixedw" data-act="order-here" data-id="${id}">Pesan di sini</button></div></section>`;
    }
  };

  /* --- Upload --- */
  const maxFiles = () => (S.user.plus ? 10 : 3);
  SCREENS.upload = {
    render: () => {
      const d = S.draft, s = shopOf(d.shopId), n = d.files.length;
      return `<section class="screen canvas has-bar">${header('Unggah dokumen')}${stepper(1, 'Unggah dokumen')}
      <div class="scroll">
        <div class="shopline"><div class="logo">${s.ini}</div><div class="t"><b>${esc(s.name)}</b><span>${s.distLabel} · ${s.queue} antre · siap ± ${s.eta} mnt</span></div><button class="link" data-act="change-shop" style="font-size:13px">Ganti</button></div>
        <div class="drop" id="drop" role="button" tabindex="0" data-act="pick" aria-label="Pilih file"><div class="up">${I('upload', 28)}</div><b>Ketuk untuk pilih file</b><small>PDF, DOCX, JPG · maks 50 MB per file</small>
          <div class="srcs"><button type="button" data-act="pick">${I('file', 15)}File</button><button type="button" data-act="pick-drive">${I('upload', 15)}Google Drive</button><button type="button" data-act="pick-photo">${I('image', 15)}Foto</button></div></div>
        <input id="fileIn" type="file" multiple hidden accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,image/*">
        <div class="files-h"><b>File kamu</b><span>${n} dari ${maxFiles()}</span></div>
        ${d.files.map(f => `<div class="frow">${fileIcon(f.name)}<div class="t"><b>${esc(f.name)}</b><span>${f.pages} halaman · ${esc(f.size)} · A4</span></div><button class="del" data-act="del-file" data-id="${f.id}" aria-label="Hapus ${esc(f.name)}">${I('trash', 18)}</button></div>`).join('')}
        ${S.user.plus ? '' : `<button class="plusbanner" data-act="tab" data-to="plus">${I('info', 16)}<span class="t"><b>Gratis: maks 3 file per pesanan</b><span>${I('sparkle', 12)} Upload tanpa batas &amp; gabung PDF dengan Plus</span></span>${I('chevron-right', 16)}</button>`}
        <div style="height:20px"></div></div>
      <div class="bar stack"><button class="btn" data-act="to-setup" ${n ? '' : 'disabled'}>Lanjut atur cetak ${I('arrow-right', 20)}</button></div></section>`;
    },
    mount: el => {
      const inp = $('#fileIn', el), drop = $('#drop', el);
      inp.addEventListener('change', () => { addFiles(inp.files); inp.value = ''; });
      ['dragenter', 'dragover'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.add('over'); }));
      ['dragleave', 'drop'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.remove('over'); }));
      drop.addEventListener('drop', ev => addFiles(ev.dataTransfer.files));
      drop.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); inp.click(); } });
    }
  };
  function estimatePages(file) {
    return new Promise(res => {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (['jpg', 'jpeg', 'png'].includes(ext)) return res(1);
      if (ext === 'pdf') {
        const r = new FileReader();
        r.onload = () => {
          const m = String(r.result).match(/\/Type\s*\/Page(?![s\w])/g);
          res(m && m.length ? m.length : Math.max(1, Math.round(file.size / 45000)));
        };
        r.onerror = () => res(Math.max(1, Math.round(file.size / 45000)));
        r.readAsBinaryString(file.slice(0, 20 * 1048576));
        return;
      }
      res(Math.max(1, Math.round(file.size / 18000)));
    });
  }
  async function addFiles(list) {
    const d = S.draft; let added = 0;
    for (const f of Array.from(list)) {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      if (!['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'].includes(ext)) { toast(`Format .${ext} belum didukung`, { kind: 'err' }); continue; }
      if (f.size > 50 * 1048576) { toast(`${f.name} melebihi 50 MB`, { kind: 'err' }); continue; }
      if (d.files.length >= maxFiles()) { toast(`Maksimal ${maxFiles()} file per pesanan`, { kind: 'err' }); break; }
      const pages = Math.min(300, await estimatePages(f));
      d.files.push({ id: 'f' + Date.now() + Math.random().toString(36).slice(2, 6), name: f.name, pages, size: fmtSize(f.size) });
      added++;
    }
    if (added) { d.fixed = false; d.scanned = false; if (cur.name === 'upload') rerender(); }
  }
  function addSample(kind) {
    const d = S.draft;
    if (d.files.length >= maxFiles()) return toast(`Maksimal ${maxFiles()} file per pesanan`, { kind: 'err' });
    const smp = kind === 'photo' ? { name: 'Lampiran_ERD_Basdat.jpg', pages: 1, size: '2,4 MB' } : { name: 'Laporan_Praktikum_Basdat.pdf', pages: 24, size: '3,2 MB' };
    if (d.files.some(f => f.name === smp.name)) return toast('File contoh itu sudah ditambahkan', { kind: 'err' });
    d.files.push(Object.assign({ id: 'f' + Date.now() }, smp)); d.fixed = false; d.scanned = false;
    toast(kind === 'photo' ? 'Foto contoh ditambahkan' : 'Simulasi Google Drive: file contoh ditambahkan');
    rerender();
  }

  /* --- Atur cetak --- */
  SCREENS.setup = {
    render: () => {
      const d = S.draft, p = pricing(d), s = p.shop, f0 = d.files[0];
      const seg = (k, opts) => `<div class="seg" role="radiogroup">${opts.map(([v, l]) => `<button type="button" role="radio" aria-checked="${String(d[k]) === String(v)}" class="${String(d[k]) === String(v) ? 'on' : ''}" data-act="opt" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
      return `<section class="screen canvas has-bar">${header('Atur cetak')}${stepper(2, 'Atur cetak')}
      <div class="scroll">
        <div class="filecard">${fileIcon(f0.name)}<div class="t"><b>${esc(f0.name)}${d.files.length > 1 ? ` +${d.files.length - 1} file` : ''}</b><span>${p.raw} halaman · ${esc(s.name)}</span></div></div>
        <div class="opt"><div class="oh"><b>Warna</b><span>Hitam putih ${rp(s.bw)} · Berwarna ${rp(s.color)}</span></div>${seg('color', [['bw', 'Hitam putih'], ['color', 'Berwarna']])}</div>
        <div class="opt"><div class="oh"><b>Kertas A4</b></div>${seg('paper', [['70', 'HVS 70 gsm'], ['80', 'HVS 80 gsm +' + rp(D.paper80Extra)]])}</div>
        <div class="opt"><div class="oh"><b>Sisi cetak</b></div>${seg('sides', [[1, '1 sisi'], [2, 'Bolak-balik']])}</div>
        <div class="opt row"><div><b>Jumlah salinan</b><span>${p.raw} hlm × ${d.copies} salinan = ${p.raw * d.copies} lembar</span></div>
          <div class="stepc"><button type="button" data-act="copies" data-d="-1" ${d.copies <= 1 ? 'disabled' : ''} aria-label="Kurangi">${I('minus', 18)}</button><b>${d.copies}</b><button type="button" class="p" data-act="copies" data-d="1" ${d.copies >= 20 ? 'disabled' : ''} aria-label="Tambah">${I('plus', 18)}</button></div></div>
        <div class="opt"><div class="oh"><b>Jilid</b><span>per salinan</span></div>${seg('binding', Object.entries(D.bindings).map(([k, b]) => [k, b.label + (b.price ? ' ' + rp(b.price) : '')]))}</div>
        <div class="opt"><div class="oh"><b>Catatan untuk percetakan</b><span>opsional</span></div><textarea class="notes" id="note" maxlength="200" placeholder="Contoh: cover warna biru, jilid di sisi kiri">${esc(d.note)}</textarea></div>
        <div style="height:20px"></div></div>
      <div class="bar"><div class="tot"><small>Total · ${p.lbr} lbr</small><b>${rp(p.total)}</b></div><button class="btn fixedw" data-act="to-check">Cek file</button></div></section>`;
    },
    mount: () => { const n = $('#note'); n.addEventListener('input', () => { S.draft.note = n.value; }); }
  };

  /* --- Cek file --- */
  function pageGrid(d) {
    const iss = issuesOf(d), tot = totalPages(d), shown = Math.min(12, tot);
    let out = '';
    for (let i = 1; i <= shown; i++) {
      let cls = '', tag = '', inner = '<i></i><i class="s"></i><i></i><i class="s"></i><i></i><em></em>';
      if (iss && i === iss.cut) { cls = d.fixed ? 'ok' : 'cut'; tag = d.fixed ? '✓ Pas' : 'Terpotong'; }
      if (iss && i === iss.blank) { if (d.fixed) { cls = 'gone'; tag = ''; inner = I('trash', 20); } else { cls = 'blank'; tag = 'Kosong'; } }
      out += `<div class="pg ${cls}"><div class="pp">${inner}${tag ? `<span class="tg">${tag}</span>` : ''}</div><span>${i}</span></div>`;
    }
    return out;
  }
  SCREENS.check = {
    render: () => {
      const d = S.draft, p = pricing(d), iss = issuesOf(d);
      let body;
      if (!d.scanned) {
        body = `<div class="scanbox"><div class="doc"><i></i><i></i><i></i><i></i><i></i><span class="beam"></span></div><b>Memindai dokumen…</b><span>Mencari halaman kosong &amp; margin terpotong</span></div>`;
        return `<section class="screen canvas has-bar">${header('Cek file otomatis')}${stepper(3, 'Cek file')}<div class="scroll">${body}</div></section>`;
      }
      const tot = totalPages(d), shown = Math.min(12, tot);
      const banner = !iss
        ? `<div class="banner ok"><span class="bi">${I('check-circle', 22)}</span><div><b>Dokumen siap dicetak</b><span>Tidak ada masalah yang ditemukan di ${tot} halaman.</span></div></div>`
        : d.fixed
          ? `<div class="banner ok"><span class="bi">${I('check-circle', 22)}</span><div><b>Dokumen siap dicetak</b><span>Halaman ${iss.blank} dihapus · Tabel halaman ${iss.cut} diperkecil ke 96% agar pas. Total kini ${p.pages} halaman.</span></div></div>`
          : `<div class="banner warn"><span class="bi">${I('alert', 22)}</span><div><b>${iss.count} masalah ditemukan</b><span>${tot} halaman dipindai dalam 3 detik</span></div></div>`;
      const ok = !iss || d.fixed;
      return `<section class="screen canvas has-bar">${header('Cek file otomatis')}${stepper(3, 'Cek file')}
      <div class="scroll">${banner}
        <div class="pv"><div class="ph"><b>Pratinjau halaman</b><span>1–${shown} dari ${d.fixed && iss ? p.pages : tot}</span></div><div class="grid4">${pageGrid(d)}</div></div><div style="height:20px"></div></div>
      ${ok ? `<div class="bar"><div class="tot"><small>Total · ${p.lbr} lbr</small><b>${rp(p.total)}</b></div><button class="btn fixedw" data-act="to-checkout">Lanjut ke pembayaran</button></div>`
          : `<div class="bar stack"><button class="btn" data-act="fix-all">Perbaiki semua (${iss.count})</button><button class="linkbtn" data-act="to-checkout">Lanjut ke pembayaran</button></div>`}</section>`;
    },
    mount: () => { if (!S.draft.scanned) later(() => { S.draft.scanned = true; rerender(); }, 2200); }
  };

  /* --- Checkout + sheet QRIS --- */
  function qrisSheet() {
    const q = S.qris, p = pricing(S.draft), s = p.shop;
    const exp = Date.now() >= q.expireAt;
    return `<div class="overlay" id="ov"><div class="sheet" role="dialog" aria-label="Bayar dengan QRIS"><div class="grab"></div>
      <div class="sh"><h2>Bayar dengan QRIS</h2><button class="round" data-act="close-qris" aria-label="Tutup">${I('x', 18)}</button></div>
      <div class="amt"><small>Total pembayaran</small><b>${rp(p.total)}</b><span class="timer ${exp ? 'exp' : ''}" id="qrTimer">${I('clock', 14)}<span>${exp ? 'Kode kedaluwarsa' : 'Selesaikan dalam 14:59'}</span></span></div>
      <div class="qrcard"><div class="qh"><b>QRIS</b><span>PrintDong! · ${esc(s.name)}</span></div>
        <div class="qrbox ${exp ? 'expired' : ''}">${qrSvg(q.id + q.nonce)}<span class="lg">P!</span></div><div class="nm">NMID: ID1026318842097 · ${q.id}</div></div>
      <div class="steps"><div><i>1</i>Buka GoPay, OVO, DANA, atau m-banking</div><div><i>2</i>Pindai kode QR di atas</div><div><i>3</i>Konfirmasi — status diperbarui otomatis</div></div>
      ${exp ? `<button class="btn" data-act="renew-qris">Buat QR baru</button>` : `<button class="btn" data-act="save-qr">Simpan QR</button>
      <div class="waiting"><span class="spin"></span>Menunggu pembayaran…</div><button class="linkbtn" style="margin-top:6px" data-act="sim-pay">Simulasikan pembayaran berhasil</button>`}
    </div></div>`;
  }
  SCREENS.checkout = {
    dark: () => !!(S.qris),
    render: () => {
      const d = S.draft, p = pricing(d), s = p.shop, c = crowd(s.queue), f0 = d.files[0];
      return `<section class="screen canvas has-bar">${header('Checkout')}
      <div class="scroll"><div class="card" style="margin:0 20px 16px;padding:16px">
        <div class="shopline" style="margin:0;padding:0;border:0;box-shadow:none"><div class="logo sm" style="width:48px;height:48px;font-size:17px">${s.ini}</div><div class="t"><b style="font-size:15px">${esc(s.name)}</b><span>Ambil di toko · ${s.distLabel}</span></div>${badge(s.queue)}</div>
        <div class="divider" style="margin:12px 0"></div>
        <div style="display:flex;gap:12px;align-items:flex-start">${fileIcon(f0.name)}<div style="min-width:0"><b style="display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f0.name)}${d.files.length > 1 ? ` +${d.files.length - 1} file` : ''}</b>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><span class="tag">${p.pages} hlm</span><span class="tag">${d.copies} salinan</span>${optSummary(d).map(t => `<span class="tag">${t}</span>`).join('')}</div></div></div>
        <div class="divider" style="margin:14px 0 12px"></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;align-items:center"><span class="muted" style="display:flex;gap:8px;align-items:center">${I('clock', 16, '')}Estimasi siap</span><b>± ${s.eta + 4} mnt setelah bayar</b></div></div>
        <div class="card" style="margin:0 20px 16px"><h3 style="margin-bottom:14px">Rincian pembayaran</h3><div class="rows">
          <div class="r"><span>Cetak ${d.color === 'color' ? 'berwarna' : 'hitam putih'}<small>${p.lbr} lbr × ${rp(p.unit)}</small></span><b>${rp(p.print)}</b></div>
          ${p.bind ? `<div class="r"><span>Jilid ${D.bindings[d.binding].label.toLowerCase()}<small>${d.copies} × ${rp(p.bUnit)}</small></span><b>${rp(p.bind)}</b></div>` : ''}
          <div class="r"><span>Biaya layanan</span><b>${p.service ? rp(p.service) : 'Gratis'}</b></div>
          ${p.disc ? `<div class="r disc"><span>Promo ${D.promoCode}<small>Diskon 20% jilid</small></span><b>−${rp(p.disc)}</b></div>` : ''}
          ${S.user.plus ? '' : `<button class="plusnote" data-act="tab" data-to="plus">${I('sparkle', 14)}Bebas biaya layanan dengan PrintDong Plus</button>`}
          <div class="dashed" style="margin:2px 0 14px"></div><div class="total"><span>Total pembayaran</span><b>${rp(p.total)}</b></div></div>
          <div class="promo"><input id="promo" placeholder="Kode promo (mis. ${D.promoCode})" value="${esc(d.promo)}" aria-label="Kode promo" maxlength="14"><button type="button" data-act="apply-promo">Terapkan</button></div></div>
        <div class="card" style="margin:0 20px 16px"><h3>Metode pembayaran</h3>
          <button class="pay on" type="button" aria-pressed="true"><span class="pl">QRIS</span><span class="t"><b>QRIS</b><span>Disarankan · semua e-wallet &amp; m-banking</span></span><span class="radio"></span></button></div>
        <div style="height:20px"></div></div>
      <div class="bar"><div class="tot"><small>Total · ${p.lbr} lbr</small><b>${rp(p.total)}</b></div><button class="btn fixedw" data-act="pay">Bayar sekarang</button></div>
      ${S.qris ? qrisSheet() : ''}</section>`;
    },
    mount: () => {
      const pr = $('#promo'); if (pr) pr.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ACT['apply-promo'](); } });
      if (S.qris) {
        const tick = () => {
          const el = $('#qrTimer span'); if (!el || !S.qris) return;
          const left = Math.max(0, Math.round((S.qris.expireAt - Date.now()) / 1000));
          if (left <= 0) { clearTimers(); rerender(); return; }
          el.textContent = 'Selesaikan dalam ' + pad2(Math.floor(left / 60)) + ':' + pad2(left % 60);
        };
        tick(); every(tick, 1000);
      }
    }
  };

  /* --- Sukses --- */
  SCREENS.success = {
    render: ({ id }) => {
      const o = S.orders.find(x => x.id === id), sh = shopOf(o.shopId);
      const dots = [['10%', '8%', '12px', '34px', '#1e4fd8', 'rotate(-30deg)'], ['86%', '22%', '8px', '24px', '#3b7bff', 'rotate(45deg)'], ['4%', '38%', '8px', '16px', '#3b7bff', 'rotate(70deg)'], ['78%', '66%', '14px', '14px', '#12b76a', 'rotate(40deg)'], ['6%', '72%', '10px', '10px', '#12b76a', ''], ['48%', '97%', '10px', '10px', '#0a1f44', ''], ['50%', '1%', '10px', '10px', '#f79009', '']];
      return `<section class="screen success"><div class="scroll" style="display:flex;flex-direction:column">
        <div class="burst"><div class="c1"></div><div class="c2">${I('check', 46)}</div>${dots.map(([l, t, w, h, c, r]) => `<i style="left:${l};top:${t};width:${w};height:${h};background:${c};transform:${r};border-radius:${w === h ? '50%' : '6px'}"></i>`).join('')}</div>
        <h1>Pembayaran berhasil!</h1><p class="s">Pesananmu sudah masuk antrean di ${esc(sh.name)}. Kami kabari saat siap diambil.</p>
        <div class="card recap"><div class="id"><span>No. pesanan</span><b>${o.id}<button data-act="copy" data-v="${o.id}" aria-label="Salin nomor pesanan" style="display:flex">${I('copy', 14)}</button></b></div><div class="dashed" style="margin-bottom:14px"></div>
          <div class="r"><span>Total dibayar</span><b>${rp(o.total)}</b></div><div class="r"><span>Metode</span><b>QRIS</b></div><div class="r"><span>Waktu</span><b>${dmy(o.t.recv)}, ${hhmm(o.t.recv)}</b></div><div class="r"><span>Posisi antrean</span><b class="bl">#${o.pos} · siap ± ${etaMin(o)} mnt</b></div></div>
        <div style="margin-top:auto;padding:24px 20px calc(var(--bot) + 6px)"><button class="btn" data-act="open-track" data-id="${o.id}">Lacak pesanan ${I('arrow-right', 20)}</button><button class="btn ghost" style="margin-top:6px" data-act="tab" data-to="home">Kembali ke Beranda</button></div></div></section>`;
    }
  };

  /* --- Lacak pesanan --- */
  SCREENS.track = {
    render: ({ id }) => {
      const o = S.orders.find(x => x.id === id), sh = shopOf(o.shopId);
      const eta = etaMin(o), etaT = hhmm(addMin(new Date(), eta));
      const R = 95, C = 2 * Math.PI * R;
      let frac, col = '#1e4fd8', mid, head, sub, pill, chip;
      if (o.status === 'queue') {
        frac = (o.qTotal - o.pos + 0.7) / (o.qTotal + 0.7); chip = ['Menunggu antrean', ''];
        mid = `<small>Posisi</small><b>${o.pos}</b><span>dari ${o.qTotal} antrean</span>`; head = `Siap ± ${eta} menit`; sub = `Perkiraan pukul ${etaT}`;
        pill = `${I('printer', 16)}${o.pos > 1 ? `${o.pos - 1} pesanan di depanmu` : '1 pesanan sedang dicetak di depanmu'}`;
      } else if (o.status === 'printing') {
        frac = o.printed / o.sheets; col = '#3b7bff'; chip = ['Sedang dicetak', ''];
        mid = `<small>Sedang dicetak</small><b>${pctPrinted(o)}%</b><span>${o.printed} dari ${o.sheets} lbr</span>`; head = `Siap ± ${eta} menit`; sub = `Perkiraan pukul ${etaT}`;
        pill = `${I('printer', 16)}Dicetak di mesin 2${o.binding !== 'none' ? ' · lalu jilid ' + D.bindings[o.binding].label.toLowerCase() : ''}`;
      } else {
        frac = 1; col = '#12b76a'; chip = ['Siap diambil', 'sepi'];
        mid = `<small>Siap diambil</small>${I('check', 64, 'tick')}<span>Kode: ${o.code}</span>`; head = 'Siap diambil!'; sub = `Selesai pukul ${hhmm(o.t.ready || new Date())}`;
        pill = `${I('printer', 16)}Tunjukkan kode ambil ke kasir`;
      }
      const stepRows = [
        { k: 'recv', t: 'Diterima', s: `${hhmm(o.t.recv)} · Pembayaran QRIS berhasil` },
        { k: 'queue', t: 'Menunggu antrean', s: o.status === 'queue' ? `Posisi ${o.pos} dari ${o.qTotal} · diperbarui real-time` : `${hhmm(o.t.print || o.t.ready || o.t.queue)} · giliranmu tiba` },
        { k: 'print', t: 'Sedang dicetak', s: o.status === 'queue' ? `Estimasi mulai ${hhmm(addMin(new Date(), o.pos * 3))}` : o.status === 'printing' ? `Mulai ${hhmm(o.t.print)} · ${o.printed} dari ${o.sheets} lbr` : `Selesai ${hhmm(o.t.ready)}` },
        { k: 'ready', t: 'Siap diambil', s: o.status === 'ready' ? `Kode ambil: ${o.code}` : 'Kode ambil muncul saat selesai' }
      ];
      const idx = { queue: 1, printing: 2, ready: 3 }[o.status];
      const tl = stepRows.map((r, i) => `<div class="tstep ${i < idx || o.status === 'ready' && i === 3 ? 'done' : i === idx ? 'cur' : 'todo'}"><div class="dt"><i>${i < idx || (o.status === 'ready' && i === 3) ? I('check', 14) : ''}</i></div><div class="tx"><b>${r.t}</b><br><span>${r.s}</span></div></div>`).join('');
      return `<section class="screen canvas has-bar">${header('Lacak pesanan')}
      <div class="scroll"><div class="trk-top"><span class="mono">${o.id}</span><span class="badge ${chip[1] || 'info'}">${chip[1] ? '<span class="dot"></span>' : ''}${chip[0]}</span><span class="livetag"><i></i>Live</span></div>
        <div class="big"><div class="gauge"><svg viewBox="0 0 220 220"><circle class="bg" cx="110" cy="110" r="${R}"/><circle class="fg" cx="110" cy="110" r="${R}" style="stroke:${col}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - Math.max(0.04, frac))}"/></svg><div class="mid">${mid}</div></div>
          <h2>${head}</h2><div class="sub">${sub}</div><div class="pill">${pill}</div>
          ${o.status === 'ready' ? `<button class="btn" data-act="open-pickup" data-id="${o.id}">Lihat kode ambil ${I('arrow-right', 20)}</button>` : ''}</div>
        <div class="card tl-card"><div class="th"><b>Status pesanan</b><span>Diperbarui ${hhmm(new Date())}</span></div>${tl}</div>
        <div class="card shopmini"><div class="logo sm">${sh.ini}</div><div class="t"><b>${esc(sh.name)}</b><span>${esc(o.file)} · ${o.pages} hlm × ${o.copies}</span></div><button class="btn sm soft" data-act="soon" data-msg="Menghubungi percetakan belum tersedia di prototipe.">Hubungi</button></div>
        <div style="height:24px"></div></div></section>`;
    }
  };

  /* --- Kode ambil --- */
  SCREENS.pickup = {
    dark: true,
    render: ({ id }) => {
      const o = S.orders.find(x => x.id === id), sh = shopOf(o.shopId);
      return `<section class="screen pickup"><div class="scroll">
        <div class="pk-head"><button class="round glass" data-act="back" aria-label="Tutup">${I('x', 20)}</button><span class="ok">${I('check-circle', 14)}Selesai dicetak ${hhmm(o.t.ready || new Date())}</span><h1>Siap diambil!</h1><p>Tunjukkan kode ini ke kasir ${esc(sh.name)}.</p></div>
        <div class="ticket"><div class="k">Kode pengambilan</div><div class="code"><b>${o.code}</b><button data-act="copy" data-v="${o.code}" aria-label="Salin kode">${I('copy', 18)}</button></div><div class="hint">Tunjukkan kode atau QR ke kasir</div>
          <div class="perf"></div><div class="qrb">${qrSvg('pickup' + o.id + o.code, 21)}</div>
          <div class="shopn">${I('store', 16)}${esc(sh.name)} · Berlaku s.d. 22.00</div></div>
        <div class="ordmini">${fileIcon(o.file)}<div class="t"><b>${o.id} · ${esc(o.file.replace(/\.[^.]+$/, ''))}</b><span>${o.copies} ${o.binding === 'none' ? 'salinan' : 'bundel ' + D.bindings[o.binding].label.toLowerCase()} · ${o.sheets} lbr · ${rp(o.total)} lunas</span></div></div>
        <div style="padding:20px 30px calc(var(--bot) + 6px)"><button class="btn" data-act="finish" data-id="${o.id}">Selesai</button><button class="btn ghost" style="margin-top:6px" data-act="soon" data-msg="Menghubungi percetakan belum tersedia di prototipe.">Ada kendala? Hubungi percetakan</button></div></div></section>`;
    }
  };

  /* --- Pesanan --- */
  function orderCard(o) {
    const sh = shopOf(o.shopId), isReady = o.status === 'ready';
    const idx = { queue: 1, printing: 2, ready: 3 }[o.status];
    const chip = isReady ? '<span class="badge sepi"><span class="dot"></span>Siap diambil</span>' : `<span class="badge info">${STAT_LBL[o.status]}</span>`;
    const opts = `${o.pages} hlm${o.copies > 1 ? ' · ' + o.copies + ' salinan' : ''} · ${o.color === 'color' ? 'Berwarna' : 'Hitam putih'} · ${D.bindings[o.binding].label === 'Tanpa jilid' ? (o.sides === 2 ? 'Bolak-balik' : '1 sisi') : D.bindings[o.binding].label}`;
    return `<div class="ordcard ${isReady ? 'ready' : ''}"><div class="oh"><div class="logo sm">${sh.ini}</div><div class="t"><b>${esc(sh.name)}</b><span>${o.id} · ${o.label}</span></div>${chip}</div>
      <div class="f">${fileIcon(o.file)}<div class="t"><b>${esc(o.file)}</b><span>${opts}</span></div></div>
      ${isReady ? `<div class="codebox"><div><small>Kode ambil</small><b>${o.code}</b></div>${I('qr', 28)}</div><button class="btn" data-act="open-pickup" data-id="${o.id}">Tunjukkan kode ambil</button>`
        : `<div class="miniprog">${[0, 1, 2, 3].map(i => `<i class="${i < idx ? 'on' : i === idx ? 'cur' : ''}"></i>`).join('')}</div>
        <div class="posline">${o.status === 'queue' ? `Posisi ${o.pos} · siap ± ${etaMin(o)} mnt (${hhmm(addMin(new Date(), etaMin(o)))})` : `Dicetak ${pctPrinted(o)}% · siap ± ${etaMin(o)} mnt`}</div>
        <button class="btn soft" data-act="open-track" data-id="${o.id}" style="box-shadow:none">Lacak pesanan</button>`}</div>`;
  }
  function histCard(o) {
    const sh = shopOf(o.shopId);
    return `<div class="ordcard"><div class="oh"><div class="logo sm">${sh.ini}</div><div class="t"><b>${esc(sh.name)}</b><span>${o.id} · ${o.label}</span></div><span class="badge neutral">Selesai</span></div>
      <div class="f">${fileIcon(o.file)}<div class="t"><b>${esc(o.file)}</b><span>${o.pages} hlm · ${o.color === 'color' ? 'Berwarna' : 'Hitam putih'} · ${D.bindings[o.binding].label === 'Tanpa jilid' ? (o.sides === 2 ? 'Bolak-balik' : '1 sisi') : D.bindings[o.binding].label}</span></div></div>
      <div class="hist-foot"><div class="tot"><small>Total</small><b>${rp(o.total)}</b></div><span class="sp"></span><button class="btn sm out" data-act="order-detail" data-id="${o.id}">Detail</button><button class="btn sm" data-act="reprint" data-id="${o.id}">${I('printer', 16)}Cetak ulang</button></div></div>`;
  }
  SCREENS.orders = {
    render: () => {
      const act = S.orders.filter(isActive).sort((a, b) => (b.status === 'ready') - (a.status === 'ready') || b.t.recv - a.t.recv);
      const q = S.ordQ.trim().toLowerCase();
      const match = o => !q || (o.id + o.file + shopOf(o.shopId).name).toLowerCase().includes(q);
      const hist = S.orders.filter(o => o.status === 'done' && match(o));
      const groups = {}; hist.forEach(o => (groups[o.month] = groups[o.month] || []).push(o));
      const list = S.ordTab === 'aktif'
        ? (act.filter(match).map(orderCard).join('') || `<div class="empty-state">${I('receipt', 40)}<b style="display:block;color:var(--ink)">Belum ada pesanan aktif</b>Pesananmu yang sedang berjalan muncul di sini.</div>`)
        : (Object.keys(groups).map(m => `<div class="month">${m}</div>${groups[m].map(histCard).join('')}`).join('') || `<div class="empty-state">${I('receipt', 40)}<b style="display:block;color:var(--ink)">Belum ada riwayat</b></div>`);
      const sheet = S.sheetOrder ? orderSheet(S.orders.find(o => o.id === S.sheetOrder)) : '';
      return `<section class="screen canvas has-tabs"><div class="scroll">
        <div class="ttl"><h1>Pesanan</h1><button class="round" data-act="ord-search" aria-label="Cari pesanan">${I('search', 20)}</button></div>
        ${S.ordSearch ? `<label class="search s2">${I('search', 20)}<input id="oq" type="search" placeholder="Cari nomor, file, atau percetakan" value="${esc(S.ordQ)}" autocomplete="off"></label>` : ''}
        <div class="tabs2" role="tablist"><button role="tab" class="${S.ordTab === 'aktif' ? 'on' : ''}" data-act="ord-tab" data-t="aktif">Aktif (${act.length})</button><button role="tab" class="${S.ordTab === 'riwayat' ? 'on' : ''}" data-act="ord-tab" data-t="riwayat">Riwayat</button></div>
        <div id="ordList">${list}</div><div style="height:16px"></div></div>${tabbar('orders')}${sheet}</section>`;
    },
    mount: () => {
      const oq = $('#oq');
      if (oq) { oq.focus(); oq.setSelectionRange(oq.value.length, oq.value.length); oq.addEventListener('input', () => { S.ordQ = oq.value; const pos = oq.selectionStart; rerender(); const n = $('#oq'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }); }
    }
  };
  function orderSheet(o) {
    const sh = shopOf(o.shopId);
    const d = { shopId: o.shopId, files: [{ pages: o.pages }], color: o.color, paper: o.paper, sides: o.sides, copies: o.copies, binding: o.binding, fixed: false, promo: '' };
    const p = pricing(d);
    return `<div class="overlay"><div class="sheet" role="dialog" aria-label="Detail pesanan"><div class="grab"></div>
      <div class="sh"><h2>Detail pesanan</h2><button class="round" data-act="close-sheet" aria-label="Tutup">${I('x', 18)}</button></div>
      <div class="card" style="margin-top:16px"><div class="shopline" style="margin:0;padding:0;border:0;box-shadow:none"><div class="logo sm">${sh.ini}</div><div class="t"><b>${esc(sh.name)}</b><span>${o.id} · ${o.label}</span></div></div>
        <div class="divider" style="margin:12px 0"></div><b style="display:block;font-weight:600;margin-bottom:8px">${esc(o.file)}</b>
        <div style="display:flex;gap:6px;flex-wrap:wrap"><span class="tag">${o.pages} hlm</span><span class="tag">${o.copies} salinan</span>${optSummary(d).map(t => `<span class="tag">${t}</span>`).join('')}</div>
        <div class="divider" style="margin:14px 0"></div><div class="rows"><div class="r"><span>Cetak<small>${p.lbr} lbr × ${rp(p.unit)}</small></span><b>${rp(p.print)}</b></div>${p.bind ? `<div class="r"><span>Jilid</span><b>${rp(p.bind)}</b></div>` : ''}<div class="r"><span>Biaya layanan</span><b>${rp(D.serviceFee)}</b></div></div>
        <div class="total rows" style="display:flex;justify-content:space-between;font-weight:700"><span>Total dibayar</span><b style="font-size:20px;color:var(--navy)">${rp(o.total)}</b></div></div>
      <button class="btn" style="margin-top:16px" data-act="reprint" data-id="${o.id}">${I('printer', 18)}Cetak ulang</button></div></div>`;
  }

  /* --- Plus --- */
  SCREENS.plus = {
    dark: true,
    render: () => {
      const on = S.user.plus;
      const perks = [['upload', 'Upload tanpa batas + gabung PDF', 'Satukan banyak file jadi satu pesanan.'], ['wallet', 'Bebas biaya layanan', 'Hemat Rp1.000 di setiap pesanan.'], ['users', 'Prioritas antrean', 'Pesananmu didahulukan di percetakan mitra.'], ['file', 'Simpan file 90 hari', 'Cetak ulang kapan saja tanpa upload lagi.'], ['clock', 'Jadwalkan jam ambil', 'Pilih jam ambil, dokumen siap tepat waktu.']];
      return `<section class="screen plus has-tabs"><div class="scroll">
        <div class="ph"><div class="crownbox">${I('crown', 34)}</div><div class="ey">PRINTDONG PLUS</div><h1>Cetak lebih cepat,<br>lebih hemat.</h1><p class="lead">Untuk kamu yang rutin cetak laporan, makalah, sampai skripsi.</p>
          <div class="price">Rp10.000<small>/bulan</small></div>${on ? `<span class="gtag">Aktif s.d. ${dmy(S.user.plusUntil)}</span>` : '<span class="gtag">Gratis 1 bulan pertama</span>'}</div>
        <div class="perks">${perks.map(([ic, t, s]) => `<div class="perk"><span class="pi">${I(ic, 20)}</span><div><b>${t}</b><span>${s}</span></div></div>`).join('')}</div>
        <div class="plus-cta">${on ? `<button class="btn" style="background:rgba(255,255,255,.14);box-shadow:none" data-act="plus-off">Batalkan langganan</button>` : `<button class="btn gold" data-act="plus-on">Mulai gratis 1 bulan ${I('arrow-right', 20)}</button>`}
          <div class="s">${on ? 'Kamu bisa membatalkan kapan saja.' : 'Batalkan kapan saja. Tagihan pertama setelah masa gratis berakhir.'}</div></div></div>${tabbar('plus', true)}</section>`;
    }
  };

  /* --- Profil --- */
  SCREENS.profile = {
    render: () => {
      const u = S.user, lbr = S.orders.reduce((a, o) => a + o.sheets, 0), files = new Set(S.orders.map(o => o.file)).size;
      const mi = (ic, t, v, act = 'soon', extra = '') => `<button class="mi" data-act="${act}" data-msg="${esc(t)} belum tersedia di prototipe." ${extra}><span class="mx">${I(ic, 20)}</span><b>${t}</b>${v ? `<span>${v}</span>` : ''}${I('chevron-right', 16)}</button>`;
      const phone = S.phone ? '+62 ' + fmtPhone(S.phone) : '+62 812-9034-5521';
      return `<section class="screen canvas has-tabs"><div class="scroll">
        <div class="ttl"><h1>Profil</h1></div>
        <div class="pcard"><div class="top"><div class="avatar ${u.plus ? 'plus' : ''}">${u.init}${u.plus ? `<span class="crown">${I('crown', 15)}</span>` : ''}</div>
          <div><h2>${esc(u.name)}${u.plus ? '<span class="badge plus">✦ PLUS</span>' : ''}</h2><div class="nfo">${esc(phone)}<br>${esc(u.campus)}</div></div></div>
          ${u.plus ? `<button class="savebar" data-act="tab" data-to="plus"><span class="cb">${I('crown', 20)}</span><span class="t"><b>Kamu hemat ${rp(S.orders.length * 1000 + 15000)} bulan ini</b><span>Plus aktif s.d. ${dmy(u.plusUntil)}</span></span><em>Kelola</em></button>`
            : `<button class="savebar" data-act="tab" data-to="plus"><span class="cb">${I('crown', 20)}</span><span class="t"><b>Coba PrintDong Plus gratis</b><span>Bebas biaya layanan &amp; prioritas antrean</span></span><em>Coba</em></button>`}
          <div class="pstats"><div><b>${S.orders.length}</b><span>Pesanan</span></div><div><b>${lbr}</b><span>Lembar</span></div><div><b>${files}</b><span>File tersimpan</span></div></div></div>
        <div class="grp">Akun</div><div class="menu">${mi('user', 'Data diri', '')}${mi('wallet', 'Metode pembayaran', 'QRIS')}${mi('file', 'File tersimpan', files + ' file')}</div>
        <div class="grp">Preferensi</div><div class="menu">
          <button class="mi" data-act="toggle-notif" role="switch" aria-checked="${u.notif}"><span class="mx">${I('bell', 20)}</span><b>Notifikasi</b><span class="switch ${u.notif ? 'on' : ''}"></span></button>
          ${mi('map-pin', 'Lokasi kampus', 'UPNVJ Pondok Labu')}</div>
        <div class="grp">Lainnya</div><div class="menu"><button class="mi danger" data-act="logout"><span class="mx">${I('logout', 20)}</span><b>Keluar</b></button></div><div style="height:20px"></div></div>${tabbar('profile')}</section>`;
    }
  };

  /* --- Notifikasi --- */
  SCREENS.notif = {
    render: () => {
      const l = S.notifs.filter(n => S.nfFilter === 'all' || n.type === S.nfFilter);
      const groups = {}; l.forEach(n => (groups[n.group] = groups[n.group] || []).push(n));
      const chip = (k, t) => `<button class="chip ${S.nfFilter === k ? 'on' : ''}" data-act="nf-filter" data-k="${k}">${S.nfFilter === k ? I('check', 16) : ''}${t}</button>`;
      return `<section class="screen canvas">${header('Notifikasi')}
      <div class="nf-chips">${chip('all', 'Semua')}${chip('order', 'Pesanan')}${chip('promo', 'Promo')}<button class="mark" data-act="mark-read">Tandai dibaca</button></div>
      <div class="scroll">${Object.keys(groups).map(g => `<div class="ngrp">${g}</div>${groups[g].map(n => `<button class="nitem ${n.unread ? 'unread' : n.tone === 'plain' ? 'plainrow' : ''}" data-act="open-notif-item" data-id="${n.id}"><span class="ni ${n.tone}">${I(n.icon, 22)}</span><span class="t"><span class="l"><b>${esc(n.title)}</b><time>${n.time}</time></span><p>${esc(n.body)}</p></span></button>`).join('')}`).join('') || `<div class="empty-state">${I('bell', 40)}<b style="display:block;color:var(--ink)">Tidak ada notifikasi</b></div>`}<div style="height:30px"></div></div></section>`;
    }
  };

  /* =========================================================
     AKSI
     ========================================================= */
  function createOrder() {
    const d = S.draft, p = pricing(d), now = new Date();
    S.lastId += 1;
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const f0 = d.files[0];
    const o = { id: 'PD-' + S.lastId, shopId: d.shopId, file: f0.name + (d.files.length > 1 ? ` (+${d.files.length - 1})` : ''), pages: p.pages, copies: d.copies, color: d.color, paper: d.paper, sides: d.sides, binding: d.binding,
      total: p.total, status: 'queue', pos: p.shop.queue + 1, qTotal: p.shop.queue + 1, sheets: p.lbr, printed: 0, code, label: 'Hari ini, ' + hhmm(now), month: 'Hari ini',
      t: { recv: now, queue: now, print: null, ready: null } };
    S.orders.push(o);
    pushNotif({ type: 'order', icon: 'info', tone: 'plain', title: 'Pembayaran berhasil', body: `${rp(o.total)} via QRIS untuk ${o.id}.` });
    return o;
  }
  function ensureDraft() {
    if (!S.draft || !S.draft.files.length) {
      S.draft = newDraft(S.shopId || 'berkah');
      S.draft.files.push({ id: 'f0', name: 'Laporan_Praktikum_Basdat.pdf', pages: 24, size: '3,2 MB' });
      S.draft.copies = 2; S.draft.binding = 'soft';
    }
  }
  const goTab = to => { stack = []; show(to, {}, 'fade'); };

  const ACT = {
    back: () => { if (S.qris) { S.qris = null; return rerender(); } back(); },
    tab: el => goTab(el.dataset.to),
    soon: el => toast(el.dataset.msg || 'Fitur ini belum tersedia di prototipe.', { kind: 'dark' }),
    copy: el => { const v = el.dataset.v; try { navigator.clipboard.writeText(v); } catch (e) { /* abaikan */ } toast(`${v} disalin`); },

    /* onboarding */
    'onb-skip': () => { stack = []; show('phone', {}, 'fwd'); },
    'onb-go': el => show('onb', { i: +el.dataset.i }, +el.dataset.i < cur.params.i ? 'back' : 'fwd'),
    'onb-next': el => { const i = +el.dataset.i; if (i < 2) show('onb', { i: i + 1 }); else { stack = [{ name: 'onb', params: { i: 2 } }]; show('phone'); } },

    /* auth */
    key: el => {
      const k = el.dataset.k, s = cur.name;
      if (s === 'phone') { if (k === 'del') S.phone = S.phone.slice(0, -1); else if (S.phone.length < 12 && !(S.phone === '' && k === '0')) S.phone += k; rerender(); }
      else if (s === 'otp') { if (k === 'del') S.otp = S.otp.slice(0, -1); else if (S.otp.length < 6) S.otp += k; rerender(); }
    },
    'send-otp': () => { if (!phoneOk()) return; S.otp = ''; S.resendAt = Date.now() + 45000; go('otp'); },
    resend: () => { S.resendAt = Date.now() + 45000; S.otp = ''; toast('Kode OTP baru dikirim ke WhatsApp'); rerender(); },
    verify: () => {
      if (S.otp.length < 6) { const b = $('#otpBox'); b && b.classList.add('shake'); return toast('Masukkan 6 digit kode OTP', { kind: 'err' }); }
      S.loggedIn = true; toast(`Selamat datang, ${S.user.first}!`); stack = []; show('home', {}, 'fade');
    },

    /* beranda */
    sort: el => { S.sort = el.dataset.k; rerender(); },
    only24: () => { S.only24 = !S.only24; rerender(); },
    'reset-filter': () => { S.sort = 'near'; S.only24 = false; S.q = ''; rerender(); },
    'focus-q': () => { const q = $('#q'); q && q.focus(); },
    'open-notif': () => go('notif'),
    'open-shop': el => { S.shopId = el.dataset.id; go('detail', { id: el.dataset.id }); },
    'open-track': el => go('track', { id: el.dataset.id }),
    'open-pickup': el => go('pickup', { id: el.dataset.id }),

    /* detail */
    fav: el => { S.fav[el.dataset.id] = !S.fav[el.dataset.id]; toast(S.fav[el.dataset.id] ? 'Ditambahkan ke favorit' : 'Dihapus dari favorit'); rerender(); },
    share: el => {
      const s = shopOf(el.dataset.id), txt = `${s.name} — ${s.addrFull} (via PrintDong!)`;
      if (navigator.share) navigator.share({ title: s.name, text: txt }).catch(() => { }); else { try { navigator.clipboard.writeText(txt); } catch (e) { /* abaikan */ } toast('Info percetakan disalin'); }
    },
    'order-here': el => { S.shopId = el.dataset.id; S.draft = newDraft(el.dataset.id); go('upload'); },

    /* upload */
    pick: (el, ev) => { if (ev && ev.target.closest('button[data-act="pick-drive"],button[data-act="pick-photo"]')) return; const i = $('#fileIn'); if (i) { i.accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png'; i.click(); } },
    'pick-photo': (el, ev) => { ev.stopPropagation(); const i = $('#fileIn'); if (i) { i.accept = 'image/*'; i.click(); } },
    'pick-drive': (el, ev) => { ev.stopPropagation(); addSample('drive'); },
    'del-file': el => { S.draft.files = S.draft.files.filter(f => f.id !== el.dataset.id); S.draft.fixed = false; S.draft.scanned = false; rerender(); },
    'change-shop': () => { stack = []; show('home', {}, 'back'); toast('Pilih percetakan lain, file tetap tersimpan'); },
    'to-setup': () => { if (!S.draft.files.length) return; go('setup'); },

    /* atur cetak */
    opt: el => { const k = el.dataset.k; let v = el.dataset.v; if (k === 'sides') v = +v; S.draft[k] = v; S.draft.fixed = false; S.draft.scanned = false; rerender(); },
    copies: el => { const d = S.draft; d.copies = Math.max(1, Math.min(20, d.copies + +el.dataset.d)); rerender(); },
    'to-check': () => { S.draft.scanned = false; S.draft.fixed = false; go('check'); },

    /* cek file */
    'fix-all': () => {
      S.draft.fixed = true; rerender();
      toast(`${issuesOf(S.draft).count} perbaikan diterapkan`, { kind: 'dark', bottom: true, ms: 4500, action: () => { S.draft.fixed = false; rerender(); } });
    },
    'to-checkout': () => { if (S.draft.promo === '' && S.savedPromo) S.draft.promo = S.savedPromo; go('checkout'); },

    /* checkout */
    'apply-promo': () => {
      const v = ($('#promo').value || '').trim().toUpperCase(); const d = S.draft;
      if (!v) { d.promo = ''; rerender(); return toast('Kode promo dikosongkan', { kind: 'dark' }); }
      if (v !== D.promoCode) { d.promo = ''; rerender(); return toast('Kode promo tidak valid', { kind: 'err' }); }
      if (D.bindings[d.binding].price === 0) { d.promo = v; rerender(); return toast('Promo ini hanya berlaku untuk jilid', { kind: 'err' }); }
      d.promo = v; rerender(); toast('Promo UASAMAN diterapkan: diskon 20% jilid');
    },
    pay: () => { S.qris = { id: 'PD-' + (S.lastId + 1), nonce: String(Date.now()), expireAt: Date.now() + 15 * 60 * 1000 }; rerender(); },
    'close-qris': () => { S.qris = null; rerender(); },
    'renew-qris': () => { S.qris = { id: 'PD-' + (S.lastId + 1), nonce: String(Date.now()), expireAt: Date.now() + 15 * 60 * 1000 }; rerender(); toast('QR baru dibuat'); },
    'save-qr': () => {
      try {
        const blob = new Blob([qrSvg(S.qris.id + S.qris.nonce)], { type: 'image/svg+xml' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `QRIS_${S.qris.id}.svg`; document.body.appendChild(a); a.click(); a.remove();
      } catch (e) { /* abaikan */ }
      toast('Code QR berhasil disimpan');
    },
    'sim-pay': () => { const o = createOrder(); S.qris = null; S.draft = null; stack = [{ name: 'home', params: {} }]; show('success', { id: o.id }, 'fwd'); },

    /* pesanan */
    'ord-tab': el => { S.ordTab = el.dataset.t; rerender(); },
    'ord-search': () => { S.ordSearch = !S.ordSearch; if (!S.ordSearch) S.ordQ = ''; rerender(); },
    'order-detail': el => { S.sheetOrder = el.dataset.id; rerender(); },
    'close-sheet': () => { S.sheetOrder = null; rerender(); },
    reprint: el => {
      const o = S.orders.find(x => x.id === el.dataset.id);
      S.sheetOrder = null; S.shopId = o.shopId;
      const d = newDraft(o.shopId); d.files.push({ id: 'r' + Date.now(), name: o.file, pages: o.pages, size: '—' });
      Object.assign(d, { color: o.color, paper: o.paper, sides: o.sides, copies: o.copies, binding: o.binding });
      S.draft = d; toast('File dimuat ulang, tanpa upload lagi'); go('setup');
    },
    finish: el => { const o = S.orders.find(x => x.id === el.dataset.id); if (o) { o.status = 'done'; o.label = 'Hari ini, ' + hhmm(o.t.recv); } toast('Terima kasih! Pesanan masuk ke Riwayat'); S.ordTab = 'riwayat'; stack = []; show('orders', {}, 'fade'); },

    /* plus & profil */
    'plus-on': () => { S.user.plus = true; S.user.plusUntil = addMin(new Date(), 60 * 24 * 30); toast('PrintDong Plus aktif! Gratis 1 bulan'); rerender(); },
    'plus-off': () => { S.user.plus = false; toast('Langganan Plus dibatalkan', { kind: 'dark' }); rerender(); },
    'toggle-notif': () => { S.user.notif = !S.user.notif; rerender(); },
    logout: () => { S.loggedIn = false; S.phone = ''; S.otp = ''; stack = []; show('phone', {}, 'fade'); toast('Kamu sudah keluar', { kind: 'dark' }); },

    /* notifikasi */
    'nf-filter': el => { S.nfFilter = el.dataset.k; rerender(); },
    'mark-read': () => { S.notifs.forEach(n => (n.unread = false)); rerender(); },
    'open-notif-item': el => {
      const n = S.notifs.find(x => x.id === el.dataset.id); n.unread = false;
      const m = (n.body + n.title).match(/PD-\d+/);
      if (m) { const o = S.orders.find(x => x.id === m[0]); if (o) return go(o.status === 'ready' ? 'pickup' : o.status === 'done' ? 'orders' : 'track', { id: o.id }); }
      if (n.title.includes('UASAMAN') || n.body.includes('UASAMAN')) { S.savedPromo = D.promoCode; try { navigator.clipboard.writeText(D.promoCode); } catch (e) { /* abaikan */ } toast('Kode UASAMAN disimpan — otomatis terisi saat checkout'); return rerender(); }
      if (n.icon === 'crown') return goTab('plus');
      if (n.title.includes('Sinar Mas')) return go('detail', { id: 'sinarmas' });
      rerender();
    },

    /* panel demo */
    'demo-next': () => { const o = latestActive(); if (!o || o.status === 'ready') return toast('Tidak ada pesanan yang bisa dimajukan', { kind: 'dark' }); advance(o); },
    'demo-jump': el => { const o = latestActive() || S.orders.filter(isActive)[0]; if (!o) return toast('Belum ada pesanan aktif', { kind: 'dark' }); jumpTo(o, el.dataset.to); },
    'demo-reset': () => { S = freshState(); stack = []; $('#autoSim').checked = false; stopAuto(); show('splash', {}, 'fade'); toast('Data demo direset', { kind: 'dark' }); },
    'demo-toggle': () => $('#demoPanel').classList.toggle('open'),
    'demo-go': el => {
      const to = el.dataset.to;
      if (['setup', 'check', 'checkout', 'upload'].includes(to)) ensureDraft();
      if (to === 'detail') return root('detail', { id: S.shopId || 'berkah' });
      if (to === 'onb') return root('onb', { i: 0 });
      if (['track', 'pickup', 'success'].includes(to)) { const o = (to === 'pickup' ? S.orders.find(x => x.status === 'ready') : latestActive()) || S.orders[0]; return root(to, { id: o.id }); }
      if (to === 'qris') { ensureDraft(); S.qris = { id: 'PD-' + (S.lastId + 1), nonce: String(Date.now()), expireAt: Date.now() + 15 * 60 * 1000 }; return root('checkout'); }
      if (to === 'check') S.draft.scanned = false;
      if (to === 'otp' && !S.phone) S.phone = '81290345521';
      S.qris = null; root(to, {});
    }
  };

  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-act]');
    if (!el) return;
    const fn = ACT[el.dataset.act];
    if (fn) fn(el, ev);
  });

  /* keyboard fisik untuk papan angka */
  document.addEventListener('keydown', ev => {
    if (!cur || !['phone', 'otp'].includes(cur.name)) return;
    if (/^\d$/.test(ev.key)) ACT.key({ dataset: { k: ev.key } });
    else if (ev.key === 'Backspace') ACT.key({ dataset: { k: 'del' } });
    else if (ev.key === 'Enter') (cur.name === 'phone' ? ACT['send-otp'] : ACT.verify)();
  });

  /* ---------- Panel demo ---------- */
  const NAV = [['splash', 'Splash'], ['onb', 'Onboarding'], ['phone', 'Masuk'], ['otp', 'OTP'], ['home', 'Beranda'], ['detail', 'Detail toko'], ['upload', 'Unggah'], ['setup', 'Atur cetak'], ['check', 'Cek file'], ['checkout', 'Checkout'], ['qris', 'QRIS'], ['success', 'Berhasil'], ['track', 'Lacak'], ['pickup', 'Kode ambil'], ['orders', 'Pesanan'], ['plus', 'Plus'], ['profile', 'Profil'], ['notif', 'Notifikasi']];
  $('#demoNav').innerHTML = NAV.map(([k, l]) => `<button class="btn-mini" data-act="demo-go" data-to="${k}">${l}</button>`).join('');
  function updateDemo() {
    const el = $('#demoStatus'); if (!el || !S) return;
    const o = latestActive();
    el.textContent = o ? `${o.id} · ${STAT_LBL[o.status]}${o.status === 'queue' ? ' (posisi ' + o.pos + ')' : o.status === 'printing' ? ' (' + pctPrinted(o) + '%)' : ''}` : 'Belum ada pesanan aktif.';
  }
  function stopAuto() { clearInterval(autoTimer); autoTimer = null; }
  $('#autoSim').addEventListener('change', e => {
    stopAuto();
    if (e.target.checked) autoTimer = setInterval(() => { const o = latestActive(); if (o && o.status !== 'ready') advance(o); }, 6000);
  });

  /* ---------- Skala bingkai ponsel & jam ---------- */
  function fit() {
    const wrap = $('#phoneWrap');
    if (window.innerWidth <= 520) { phone.style.transform = ''; wrap.style.width = wrap.style.height = ''; return; }
    /* Dimensi prototipe: 1320 × 2868 px @ 460 ppi (≈3x) = 440 × 956 pt */
    const PW = 440, PH = 956;
    const sc = Math.min(1, (window.innerHeight - 56) / PH, (window.innerWidth - (window.innerWidth > 1000 ? 360 : 40)) / PW);
    phone.style.transform = `scale(${sc})`;
    wrap.style.width = Math.round(PW * sc) + 'px'; wrap.style.height = Math.round(PH * sc) + 'px';
  }
  window.addEventListener('resize', fit);
  const clock = () => { $('#sbTime').textContent = hhmm(new Date()); };
  clock(); setInterval(clock, 20000);

  /* ---------- Mulai ---------- */
  if (/[?&]demo/.test(location.search)) document.body.classList.add('show-demo');
  S = freshState();
  fit();
  const start = new URLSearchParams(location.search).get('screen');
  if (start && SCREENS[start]) { ACT['demo-go']({ dataset: { to: start } }); } else show('splash', {}, 'fade');
})();
