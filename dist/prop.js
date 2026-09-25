// Предметы — отдельные окна 120×120 поверх всех: мячик, лазерная точка, бабочка, лежанка, мышь.
// window.PROP = { kind, x, y } ставит Rust при создании. Общее: окно ездит командой frame,
// раз в 100 мс рассылает prop-pos { kind, x, y, … }; питомцы отвечают событиями prop-kick
// (мяч, бабочка) и prop-carry (мяч в зубах). Без дела предмет просит Rust себя закрыть.
(() => {
  'use strict';
  const T = window.__TAURI__; if (!T) return;
  const invoke = T.core.invoke;
  const P = window.PROP || { kind: 'ball', x: 600, y: 600 };
  const KIND = P.kind || 'ball';
  const W = ({ bubbles: 260, post: 140, nest: 180, gift: 300, bed: 190, poll: 280 })[KIND] || 120, H = ({ bubbles: 520, post: 180, gift: 260, bed: 160, poll: 130 })[KIND] || 120;
  const canvas = document.getElementById('c'), ctx = canvas.getContext('2d');
  let DPR = 1;
  function resize() { DPR = Math.max(1, window.devicePixelRatio || 1); canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR); }
  resize();
  const S = () => window.devicePixelRatio || 1;
  const rnd = (a, b) => a + Math.random() * (b - a);
  let mons = [], cur = { x: 0, y: 0 }, btn = false, ignoreSent = null, inflight = false, pending = null;
  const MAC = /Mac/i.test(navigator.platform || navigator.userAgent); let btnJS = false;   // на macOS кнопку мыши даёт само окно
  canvas.addEventListener('pointerdown', e => { if (e.button === 0) btnJS = true; });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(ev, () => { btnJS = false; });
  const monAt = (px, py) => mons.find(m => px >= m.x && px < m.x + m.w && py >= m.y && py < m.y + m.h) || mons[0];
  function send(a) { pending = a; if (inflight) return; inflight = true; const q = pending; pending = null;
    invoke('frame', q).then(r => { cur = { x: r.cx, y: r.cy }; btn = MAC ? btnJS : r.btn; }).catch(() => {}).finally(() => { inflight = false; if (pending) send(pending); }); }
  const hide = () => invoke('prop_hide', { kind: KIND }).catch(() => {});
  canvas.addEventListener('contextmenu', e => { e.preventDefault(); hide(); });   // правый клик — убрать предмет
  function shadeHex(hex, k) { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)); return '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); }
  let lastPos = 0;
  function emitPos(extra) { const n = performance.now(); if (n - lastPos < 100) return; lastPos = n; T.event.emit('prop-pos', Object.assign({ kind: KIND, t: n }, extra)).catch(() => {}); }
  // положение точки предмета (cx, cy — экранные физические координаты) → позиция окна
  function place(cx, cy, ax, ay, ignore) { const s = S(), a = { x: Math.round(cx - ax * s), y: Math.round(cy - ay * s) }; if (ignore !== ignoreSent) { a.ignore = ignoreSent = ignore; } send(a); }

  // ======================= МЯЧИК / КЛУБОК =======================
  if (KIND === 'ball' || KIND === 'yarn') {
    const YARN = KIND === 'yarn', yarnC = ['#d94f6a', '#4f8fd6', '#e0a12b', '#6fbf73', '#9b6fd6'][Math.floor(Math.random() * 5)];
    const R = 14, BY = H - R - 8;
    let cx = P.x, cy = P.y, vx = 0, vy = 0, ang = 0, squash = 1, lastKick = performance.now(), grab = null, carried = null, userKick = 0, goal = null;
    const cv = { x: 0, y: 0 }; let curPrev = null, curT = 0;
    canvas.addEventListener('pointerdown', e => { if (e.button !== 0) return; canvas.setPointerCapture(e.pointerId); grab = { x: cur.x, y: cur.y, t: performance.now(), moved: false }; });
    canvas.addEventListener('pointerup', e => { if (e.button !== 0 || !grab) return; releaseGrab(); });
    function releaseGrab() {
      const s = S(), g = grab; grab = null; lastKick = performance.now(); userKick = lastKick; carried = null;
      if (!g.moved) { const dir = cur.x < cx ? 1 : -1; vx = dir * 620 * s; vy = -520 * s; return; }   // щелчок — пинок от курсора
      vx = cv.x; vy = cv.y;
    }
    function draw() {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
      const m = monAt(cx, cy), s = S(), floor = m ? m.y + m.h - 2 * s : cy;
      const h = Math.max(0, (floor - R * s - cy) / s), k = Math.max(.25, 1 - h / 120);
      ctx.fillStyle = `rgba(0,0,0,${.22 * k})`; ctx.beginPath(); ctx.ellipse(W / 2, BY + R + (floor - R * s - cy) / s + 1, R * (.9 + .2 * (1 - k)), 3.5 * k, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(W / 2, BY); ctx.scale(2 - squash, squash); ctx.rotate(ang);
      if (YARN) {                                 // клубок: намотанные нитки и торчащий хвостик
        const gy = ctx.createRadialGradient(-5, -6, 2, 0, 0, R + 2); gy.addColorStop(0, shadeHex(yarnC, .35)); gy.addColorStop(1, shadeHex(yarnC, -.25));
        ctx.fillStyle = gy; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.clip(); ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 1.2;
        for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.ellipse(0, 0, R + 1, 2 + i * 1.8, i * .5, 0, Math.PI * 2); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(0, 0, R + 1, 3 + i * 2.2, -.7 + i * .5, 0, Math.PI * 2); ctx.stroke(); }
        ctx.restore();
        ctx.strokeStyle = yarnC; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(R - 2, 4); ctx.quadraticCurveTo(R + 12, 6, R + 18, 16); ctx.stroke();
        ctx.restore(); return;
      }
      const g = ctx.createRadialGradient(-5, -6, 2, 0, 0, R + 2);
      g.addColorStop(0, '#ff8a7a'); g.addColorStop(.6, '#e0392b'); g.addColorStop(1, '#8f1d16');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#3a6fd6'; ctx.beginPath(); ctx.ellipse(0, 0, R + 1, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f4d64c'; ctx.beginPath(); ctx.ellipse(0, 0, R + 1, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(-5, -6, 4, 2.5, -.6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    let last = performance.now();
    function loop() {
      const n = performance.now(), dt = Math.min(.05, (n - last) / 1000); last = n;
      const s = S(), m = monAt(cx, cy);
      if (curPrev) { const ddt = Math.max(.008, (n - curT) / 1000); cv.x = cv.x * .5 + (cur.x - curPrev.x) / ddt * .5; cv.y = cv.y * .5 + (cur.y - curPrev.y) / ddt * .5; }
      curPrev = { x: cur.x, y: cur.y }; curT = n;
      if (grab) {
        if (Math.hypot(cur.x - grab.x, cur.y - grab.y) > 6 * s) grab.moved = true;
        if (!btn && n - grab.t > 150) releaseGrab(); else { cx = cur.x; cy = cur.y; vx = vy = 0; }
      } else if (carried && n - carried.t < 700) { cx = carried.x; cy = carried.y; vx = vy = 0; }
      else if (m) {
        const floor = m.y + m.h - 2 * s, left = m.x + R * s, right = m.x + m.w - R * s;
        vy += 2400 * s * dt; cx += vx * dt; cy += vy * dt;
        if (cy > floor - R * s) { cy = floor - R * s; if (vy > 60 * s) { vy = -vy * .55; squash = .72; } else vy = 0; vx *= Math.pow(.35, dt); if (Math.abs(vx) < 4 * s) vx = 0; }
        if (cx < left) { if (Math.abs(vx) > 420 * s && !YARN) goal = { side: 'left', t: n }; cx = left; vx = -vx * .6; }   // ворота — края экрана
        if (cx > right) { if (Math.abs(vx) > 420 * s && !YARN) goal = { side: 'right', t: n }; cx = right; vx = -vx * .6; }
        ang += vx * dt / (R * s); squash += (1 - squash) * Math.min(1, dt * 12);
      }
      draw();
      const over = Math.hypot(cur.x - cx, cur.y - cy) < (R + 4) * s;
      place(cx, cy, W / 2, BY, !(over || grab));
      emitPos({ x: cx, y: cy, vx, vy, userKick, carried: carried && n - carried.t < 700 ? carried.by : null, goal });
      if (n - lastKick > 90000 && Math.abs(vx) + Math.abs(vy) < 5 * s) return hide();
      requestAnimationFrame(loop);
    }
    T.event.listen('prop-kick', e => { const k = e.payload || {}; if (k.kind && k.kind !== KIND && !(k.kind === 'ball' && YARN)) return; carried = null; vx = k.vx || 0; vy = k.vy || 0; lastKick = performance.now(); if (k.x !== undefined) { cx = k.x; cy = k.y; } });
    T.event.listen('prop-carry', e => { const k = e.payload || {}; carried = { by: k.by, x: k.x, y: k.y, t: performance.now() }; lastKick = performance.now(); });
    invoke('screens').then(r => { mons = r.monitors; requestAnimationFrame(loop); }).catch(() => {});
  }

  // ======================= ЛАЗЕРНАЯ ТОЧКА =======================
  if (KIND === 'laser') {
    let cx = P.x, cy = P.y, born = performance.now(), last = born;
    function loop() {
      const n = performance.now(), dt = Math.min(.05, (n - last) / 1000); last = n;
      // точка чуть отстаёт от курсора и дрожит, как настоящая
      cx += (cur.x + Math.sin(n / 90) * 3 - cx) * Math.min(1, dt * 14); cy += (cur.y + Math.cos(n / 70) * 3 - cy) * Math.min(1, dt * 14);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 16);
      g.addColorStop(0, 'rgba(255,60,50,.95)'); g.addColorStop(.25, 'rgba(255,40,40,.7)'); g.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W / 2, H / 2, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff5a48'; ctx.beginPath(); ctx.arc(W / 2, H / 2, 4.5, 0, Math.PI * 2); ctx.fill();
      place(cx, cy, W / 2, H / 2, true);
      emitPos({ x: cx, y: cy });
      if (n - born > 40000) return hide();
      requestAnimationFrame(loop);
    }
    invoke('screens').then(r => { mons = r.monitors; requestAnimationFrame(loop); }).catch(() => {});
  }

  // ======================= БАБОЧКА =======================
  if (KIND === 'butterfly') {
    const pal = [['#f2b134', '#e07b1a'], ['#7fb3f0', '#3e6fc4'], ['#f08ab8', '#c94f8a'], ['#a9d86e', '#5d9c3a'], ['#e8dfc8', '#b7a98a']][Math.floor(Math.random() * 5)];
    let cx = P.x, cy = P.y, tx = cx, ty = cy, ang = 0, born = performance.now(), last = born, landUntil = 0, phase = 0, gone = false, caught = 0;
    const life = rnd(50000, 90000);
    function newTarget() {
      const m = monAt(cx, cy) || mons[0]; if (!m) return;
      const s = S(), floor = m.y + m.h - 2 * s;
      if (Math.random() < .15) { tx = cx + rnd(-60, 60) * s; ty = floor - 12 * s; }                 // присесть на пол
      else { tx = m.x + rnd(60, m.w / s - 60) * s; ty = floor - rnd(60, 420) * s; }
    }
    function draw(n) {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
      if (caught) { const k = (n - caught) / 400; ctx.globalAlpha = Math.max(0, 1 - k); }
      const flap = landUntil > n ? .15 : Math.abs(Math.sin(phase)) * .95 + .05;
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(ang);
      for (const s_ of [-1, 1]) {
        ctx.save(); ctx.scale(s_ * flap, 1);
        ctx.fillStyle = pal[0]; ctx.beginPath(); ctx.moveTo(1, 0); ctx.bezierCurveTo(10, -18, 24, -14, 20, -3); ctx.bezierCurveTo(16, 2, 8, 2, 1, 0); ctx.fill();
        ctx.beginPath(); ctx.moveTo(1, 1); ctx.bezierCurveTo(8, 3, 18, 6, 15, 13); ctx.bezierCurveTo(12, 17, 4, 8, 1, 1); ctx.fill();
        ctx.fillStyle = pal[1]; ctx.beginPath(); ctx.arc(14, -6, 3, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(10, 9, 2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(1, 0); ctx.bezierCurveTo(10, -18, 24, -14, 20, -3); ctx.bezierCurveTo(16, 2, 8, 2, 1, 0); ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = '#2a2320'; ctx.beginPath(); ctx.ellipse(0, 1, 2, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2a2320'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(-1, -8); ctx.quadraticCurveTo(-4, -14, -6, -13); ctx.moveTo(1, -8); ctx.quadraticCurveTo(4, -14, 6, -13); ctx.stroke();
      ctx.restore();
    }
    function loop() {
      const n = performance.now(), dt = Math.min(.05, (n - last) / 1000); last = n;
      const s = S();
      if (caught && n - caught > 400) return hide();
      if (!caught) {
        if (n > landUntil) {
          if (Math.hypot(tx - cx, ty - cy) < 12 * s) { const m = monAt(cx, cy); if (m && cy > m.y + m.h - 20 * s && Math.random() < .5) landUntil = n + rnd(1500, 4000); newTarget(); }
          const spd = 150 * s;
          cx += (tx - cx) / Math.max(1, Math.hypot(tx - cx, ty - cy)) * spd * dt + Math.sin(n / 120) * 1.4 * s;
          cy += (ty - cy) / Math.max(1, Math.hypot(tx - cx, ty - cy)) * spd * dt + Math.cos(n / 95) * 1.6 * s;
          phase += dt * 22;
          ang = Math.atan2(ty - cy, tx - cx) + Math.PI / 2;
        } else ang = 0;
        if (gone) { cy -= 220 * s * dt; cx += 120 * s * dt; }
      }
      draw(n);
      place(cx, cy, W / 2, H / 2, true);
      emitPos({ x: cx, y: cy, landed: n < landUntil, caught: !!caught });
      if (!gone && n - born > life) gone = true;
      if (gone) { const m = monAt(cx, cy); if (!m || cy < m.y - 60 * s) return hide(); }
      requestAnimationFrame(loop);
    }
    T.event.listen('prop-kick', e => { const k = e.payload || {}; if (k.kind !== 'butterfly' || caught) return; if (k.caught) caught = performance.now(); else { gone = false; newTarget(); ty -= 150 * S(); } });
    invoke('screens').then(r => { mons = r.monitors; newTarget(); requestAnimationFrame(loop); }).catch(() => {});
  }

  // ======================= МЫШЬ =======================
  // Хитрая мышь: бегает по полу всех экранов и слушает pet-pos — знает, где чьи лапы (foot).
  // Подошли ближе ~230 px — срывается прочь быстрее любого кота; прижали к краю — ныряет в норку
  // и выскакивает из другой (чаще на другом мониторе) или проскакивает под лапами. Поймать нельзя,
  // в этом и игра: поживёт 50–90 с и уйдёт в норку насовсем. Рассылает prop-pos { x, y, dir, mode,
  // hidden, gone, slip }; коты гонятся, остальные реагируют по-своему (pet.js, onMouse).
  if (KIND === 'mouse') {
    const pick = a => a[Math.floor(Math.random() * a.length)], clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const fur = pick(['#8d8781', '#a39a90', '#6f6a66', '#b9a48a', '#e4ded6']);
    const paws = new Map();                       // label → { x, y, t }: лапы питомцев, кроме хомяка (родня) и Скрепыша
    T.event.listen('pet-pos', e => { const p = e.payload; if (p && p.foot && !['hamster', 'clippy'].includes(p.sp)) paws.set(p.label, { x: p.foot.x, y: p.foot.y, t: performance.now() }); });
    let cx = P.x, cy = P.y, dir = 1, mode = 'hole', until = 0, tx = 0, spd = 0, phase = 0, hole = null, holeTarget = null;
    let born = performance.now(), last = born, gone = false, squeakT = -1e9, slipT = -1e9, escaping = false;
    let md = {}; try { md = JSON.parse(P.data || '{}') || {}; } catch (_) { /* своя мышь */ }   // прибежала от коллеги: { from }
    const life = rnd(50000, 90000);
    const floorOf = m => m.y + m.h - 2 * S();
    const holesAll = () => { const s = S(), out = []; for (const m of mons) { out.push({ x: m.x + 6 * s, y: floorOf(m), side: -1, m }); out.push({ x: m.x + m.w - 6 * s, y: floorOf(m), side: 1, m }); } return out; };
    function nearestThreat() { const n = performance.now(), s = S(); let best = null; for (const p of paws.values()) { if (n - p.t > 1500 || Math.abs(p.y - cy) > 260 * s) continue; const d = Math.abs(p.x - cx); if (!best || d < best.d) best = { d, x: p.x }; } return best; }
    function pickTarget(m, d) {
      const s = S(), lo = m.x + 40 * s, hi = m.x + m.w - 40 * s;
      if (Math.random() < .18) { const h = pick(holesAll().filter(q => q.m === m)); if (h) { holeTarget = h; tx = h.x; return; } }   // сама нырнёт и выскочит в другом месте
      tx = d ? clampN(cx + d * rnd(200, 600) * s, lo, hi) : rnd(lo, hi);
      if (Math.abs(tx - cx) < 60 * s) tx = clampN(cx + (tx >= cx ? 1 : -1) * 160 * s, lo, hi);
    }
    function enterHole(h) { mode = 'hole'; hole = h; cx = h.x; cy = h.y; holeTarget = null; until = performance.now() + (gone ? 500 : rnd(700, 1800)); }
    function leaveHole() {                        // выскочить из другой норки — в 60 % на другом мониторе
      const all = holesAll().filter(h => !hole || h.x !== hole.x || h.y !== hole.y), other = all.filter(h => hole && h.m !== hole.m);
      const h = pick(other.length && Math.random() < .6 ? other : all) || hole; if (!h) return hide();
      hole = h; cx = h.x; cy = h.y; dir = -h.side; mode = 'peek'; until = performance.now() + rnd(400, 900);
    }
    function startDash(t, m) {
      const s = S(), away = t.x > cx ? -1 : 1, edge = away < 0 ? cx - m.x : m.x + m.w - cx;
      squeakT = performance.now(); mode = 'dash'; holeTarget = null;
      if (Math.random() < .25 && edge > 150 * s) { tx = clampN(t.x - away * 300 * s, m.x + 30 * s, m.x + m.w - 30 * s); spd = 760 * s; slipT = performance.now(); return; }   // и просто так иногда — под лапами
      if (edge < 150 * s) {
        if (Math.random() < .55) { tx = clampN(t.x - away * 300 * s, m.x + 30 * s, m.x + m.w - 30 * s); spd = 760 * s; slipT = performance.now(); return; }   // проскочить под лапами
        const h = holesAll().find(q => q.m === m && q.side === away); if (h) { holeTarget = h; tx = h.x; spd = 620 * s; return; }
      }
      tx = clampN(cx + away * rnd(280, 460) * s, m.x + 30 * s, m.x + m.w - 30 * s); spd = 580 * s;
    }
    function arrive(m) {
      if (holeTarget) return enterHole(holeTarget);
      if (mode === 'dash') { mode = 'run'; const room = dir < 0 ? cx - m.x : m.x + m.w - cx; pickTarget(m, room < 320 * S() ? -dir : dir); return; }   // после рывка бежит дальше; у края разворачивается
      if (Math.random() < .55) { mode = 'pause'; until = performance.now() + rnd(600, 2500); } else pickTarget(m);
    }
    function draw(n) {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
      const s = S(), bx = W / 2, by = H - 8;
      if (hole && (mode === 'hole' || mode === 'peek' || Math.abs(cx - hole.x) < 40 * s)) {   // норка у края: тёмная арка
        ctx.save(); ctx.translate(bx + (hole.x - cx) / s, by); ctx.fillStyle = '#2b2320'; ctx.beginPath(); ctx.ellipse(0, 0, 15, 12, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#5a4a40'; ctx.fillRect(-17, -1, 34, 2); ctx.restore();
      }
      if (mode === 'hole') return;
      const run = mode === 'run' || mode === 'dash', k = mode === 'dash' ? 1.25 : 1, peek = mode === 'peek', up = mode === 'pause' ? 1 : 0;
      ctx.save(); ctx.translate(bx, by); ctx.scale(dir, 1);
      if (!peek) {
        ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(0, 2, 16 * k, 3, 0, 0, Math.PI * 2); ctx.fill();
        const wag = run ? Math.sin(phase * 2) * 4 : Math.sin(n / 400) * 2;                                        // хвост волной
        ctx.strokeStyle = '#d9a3a0'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-12 * k, -4);
        ctx.bezierCurveTo(-20 * k, -4 + wag, -26 * k, -14 + wag, -34 * k, -6 + wag * 1.5); ctx.stroke();
        ctx.strokeStyle = '#c98f8c'; ctx.lineWidth = 1.5;                                                            // лапки
        for (const [lx, ph] of [[-7, 0], [-3, Math.PI], [5, Math.PI], [9, 0]]) { const o = run ? Math.sin(phase + ph) * 3 : 0; ctx.beginPath(); ctx.moveTo(lx, -3); ctx.lineTo(lx + o, 1); ctx.stroke(); }
        ctx.fillStyle = fur; ctx.beginPath(); ctx.ellipse(-2, -7 - up * 3, 13 * k, 7 + up * 2, up ? -.5 : 0, 0, Math.PI * 2); ctx.fill();   // тело
        ctx.fillStyle = shadeHex(fur, .25); ctx.beginPath(); ctx.ellipse(-2, -4 - up * 2, 9 * k, 3.5, 0, 0, Math.PI * 2); ctx.fill();          // брюшко
      }
      const hx = peek ? 2 : 9, hy = peek ? -6 : -10 - up * 6;                                                        // голова с острой мордочкой
      ctx.fillStyle = fur; ctx.beginPath(); ctx.moveTo(hx - 6, hy - 6); ctx.quadraticCurveTo(hx + 4, hy - 8, hx + 12, hy + 1); ctx.quadraticCurveTo(hx + 4, hy + 6, hx - 6, hy + 4); ctx.closePath(); ctx.fill();
      for (const [ex, ey] of [[hx - 5, hy - 8], [hx + 1, hy - 9]]) { ctx.fillStyle = fur; ctx.beginPath(); ctx.arc(ex, ey, 4.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#e8a7a4'; ctx.beginPath(); ctx.arc(ex, ey, 2.4, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#1e1a18'; ctx.beginPath(); ctx.arc(hx + 3, hy - 2, 1.7, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx + 3.6, hy - 2.6, .6, 0, Math.PI * 2); ctx.fill();
      const tw = mode === 'pause' || peek ? Math.sin(n / 60) * .6 : 0;                                              // нос дёргается, когда принюхивается
      ctx.fillStyle = '#e07a7a'; ctx.beginPath(); ctx.arc(hx + 12, hy + 1 + tw, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(40,30,30,.55)'; ctx.lineWidth = .7; for (const a of [-.35, 0, .35]) { ctx.beginPath(); ctx.moveTo(hx + 10, hy + 1); ctx.lineTo(hx + 10 + Math.cos(a) * 9, hy + 1 + Math.sin(a) * 9 + tw * 3); ctx.stroke(); }
      ctx.restore();
      if (n - squeakT < 600) { ctx.fillStyle = '#333'; ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('пи!', bx + dir * 14, by - 30 - (n - squeakT) / 40); }
    }
    function loop() {
      const n = performance.now(), dt = Math.min(.05, (n - last) / 1000); last = n; const s = S();
      const m = monAt(cx, cy) || mons[0]; if (!m) return hide();
      if (!gone && n - born > life) {           // пожила — уход; в половине случаев «сбегает» к коллеге (шлёт старший кот)
        escaping = Math.random() < .5;
        gone = true; const hs = holesAll().filter(h => h.m === m).sort((a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx)); holeTarget = hs[0] || null; if (holeTarget) { tx = holeTarget.x; mode = 'dash'; spd = 260 * s; }
      }
      if (mode === 'hole') { if (n > until) { if (gone) return hide(); leaveHole(); } }
      else if (mode === 'peek') { if (n > until) { mode = 'run'; pickTarget(m); } }
      else {
        if (mode !== 'dash' && !gone) { const t = nearestThreat(); if (t && t.d < 210 * s) startDash(t, m); }
        if (mode === 'pause') { if (n > until) { mode = 'run'; pickTarget(m); } }
        else {
          const v = (mode === 'dash' ? spd : 130 * s) * dt, dx = tx - cx;
          if (Math.abs(dx) <= v) { cx = tx; arrive(m); } else { cx += Math.sign(dx) * v; dir = dx > 0 ? 1 : -1; phase += dt * (mode === 'dash' ? 40 : 22); }
        }
        cy = floorOf(m);
      }
      draw(n);
      const over = Math.abs(cur.x - cx) < 24 * s && cur.y > cy - 34 * s && cur.y < cy + 6 * s;
      place(cx, cy, W / 2, H - 8, !over);
      emitPos({ x: cx, y: cy, dir, mode, hidden: mode === 'hole' || mode === 'peek', gone, escape: gone && escaping, from: md.from || '', slip: n - slipT < 400 });
      requestAnimationFrame(loop);
    }
    canvas.addEventListener('pointerdown', e => { if (e.button !== 0 || mode === 'hole' || gone) return; const m = monAt(cx, cy) || mons[0]; if (m) startDash({ x: cur.x, d: 0 }, m); });   // щёлкнули — пискнула и удрала
    T.event.listen('prop-kick', e => { const k = e.payload || {}; if (k.kind !== 'mouse' || gone) return; if (k.pounce && mode !== 'dash' && mode !== 'hole') { const m = monAt(cx, cy) || mons[0]; if (m) startDash({ x: k.x, d: 0 }, m); } });
    invoke('screens').then(r => {
      mons = r.monitors;
      setTimeout(() => {                        // полсекунды слушаем pet-pos: норка на мониторе, где больше всего питомцев
        const cnt = new Map(); for (const p of paws.values()) { const m = monAt(p.x, p.y); if (m) cnt.set(m, (cnt.get(m) || 0) + 1); }
        const best = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0];
        const m0 = (best && best[0]) || monAt(P.x, P.y) || mons[0], hs = holesAll(); hole = pick(hs.filter(h => h.m === m0)) || hs[0]; if (!hole) return hide();
        cx = hole.x; cy = hole.y; dir = -hole.side; mode = 'peek'; until = performance.now() + rnd(500, 1000); squeakT = performance.now(); requestAnimationFrame(loop);
      }, 600);
    }).catch(() => {});
  }

  // ======================= ПОДАРОК =======================
  // Подарок от коллеги: сам подарок (эмодзи), лента «от кого» и подпись. Ложится на пол там, где
  // больше всего питомцев. Еду питомцы съедают (prop-kick eaten), шарики лопают по одному
  // (prop-kick hit), остальное лежит несколько минут и тает. Правый клик убирает.
  if (KIND === 'gift') {
    let d = {}; try { d = JSON.parse(P.data || '{}') || {}; } catch (_) { /* без данных — общий подарок */ }
    const G = (window.GIFTS || {})[d.what] || { ico: '🎁', name: 'подарок', dur: 240000 };
    const from = String(d.from || 'кто-то').slice(0, 40), msg = String(d.msg || '').slice(0, 80);
    const paws = new Map();
    T.event.listen('pet-pos', e => { const p = e.payload; if (p && p.foot) paws.set(p.label, { x: p.foot.x, y: p.foot.y, t: performance.now() }); });
    const Wg = W, Hg = H, EMO = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    let cx = P.x, cy = P.y, born = performance.now(), gone = 0, balloons = G.pop ? 3 : 0, pops = [], lastPop = 0, eaten = 0;
    const life = G.dur || 240000;
    function box(x, y, w, h, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; ctx.stroke(); }
    // первые три секунды — большой показ: подарок крупно, лента «Подарок от …» и подпись всплывают с отскоком,
    // потом всё сжимается в обычный предмет на полу
    function drawPop(n) {
      const t = n - born, k = t < 450 ? (() => { const x = t / 450, c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); })() : t > 3200 ? Math.max(0, 1 - (t - 3200) / 450) : 1;
      if (k <= 0) return false;
      ctx.save(); ctx.translate(Wg / 2, 118); ctx.scale(k, k); ctx.globalAlpha = Math.min(1, k);
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.roundRect(-128, -104, 256, 200, 22); ctx.fill();
      ctx.fillStyle = '#fff8ea'; ctx.strokeStyle = '#e8a04a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-130, -108, 256, 200, 22); ctx.fill(); ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '84px ' + EMO; ctx.fillText(G.pop ? '🎈' : G.ico, -2, -34 + Math.sin(n / 260) * 3);
      ctx.fillStyle = '#e8623a'; ctx.beginPath(); ctx.roundRect(-118, 26, 232, 26, 13); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '700 14px system-ui, sans-serif'; ctx.fillText(`🎁 ${G.name || 'Подарок'} от ${from}`, -2, 39, 220);
      if (msg) { ctx.fillStyle = '#3a2a1a'; ctx.font = '600 12px system-ui, sans-serif'; ctx.fillText(msg, -2, 68, 236); }
      for (let i = 0; i < 6; i++) { const a = n / 700 + i * 1.05, r = 118 + Math.sin(n / 300 + i) * 8; ctx.fillStyle = ['#e8763a', '#f4d64c', '#6fbf73', '#4f8fd6', '#d94f6a', '#9b6fd6'][i]; ctx.beginPath(); ctx.arc(Math.cos(a) * r, -10 + Math.sin(a) * r * .55, 3.5, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore(); return true;
    }
    function draw(n) {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, Wg, Hg);
      if (!gone && drawPop(n) && n - born < 3200) return;
      ctx.globalAlpha = gone ? Math.max(0, 1 - (n - gone) / 600) : Math.min(1, (n - born - 3200) / 450);   // после большого показа — предмет на полу; тает в конце
      const bx = Wg / 2, by = Hg - 34;
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(bx, by + 4, 34, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      if (G.pop) {                                  // три шарика на ниточках; лопнувший — вспышка
        for (let i = 0; i < 3; i++) {
          const px = bx + (i - 1) * 36, py = by - 44 + Math.sin(n / 600 + i * 2) * 5;
          if (i < balloons) { ctx.strokeStyle = 'rgba(80,80,80,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + 6, py + 30, bx, by); ctx.stroke(); ctx.font = '44px ' + EMO; ctx.fillText('🎈', px, py); }
          else if (pops[i] && n - pops[i] < 500) { ctx.font = '36px ' + EMO; ctx.fillText('💥', px, py); }
        }
      } else if (!eaten) { ctx.font = '56px ' + EMO; ctx.fillText(G.ico, bx, by + (G.food ? 0 : Math.sin(n / 700) * 2)); }
      else if (n - eaten < 700) { ctx.font = '40px ' + EMO; ctx.fillText('✨', bx, by - 10); }
      ctx.font = '600 12px system-ui, sans-serif'; const label = 'прислал(а) ' + from, w = Math.min(Wg - 8, ctx.measureText(label).width + 16);   // лента «от кого» — без склонения имени
      box(bx - w / 2, Hg - 28, w, 20, 10, '#e8623a'); ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(label, bx, Hg - 18, Wg - 24);
      if (msg) { ctx.font = '12px system-ui, sans-serif'; const w2 = Math.min(Wg - 8, ctx.measureText(msg).width + 16); box(bx - w2 / 2, 6, w2, 22, 8, 'rgba(255,255,255,.95)'); ctx.fillStyle = '#222'; ctx.fillText(msg, bx, 17, Wg - 24); }
      ctx.globalAlpha = 1;
    }
    function loop() {
      const n = performance.now(), s = S();
      draw(n);
      const over = Math.abs(cur.x - cx) < 40 * s && cur.y > cy - 100 * s && cur.y < cy + 6 * s;
      place(cx, cy, Wg / 2, Hg - 30, !over);
      emitPos({ x: cx, y: cy, what: d.what || '', from, msg, food: G.food || false, pop: !!G.pop, balloons, eaten: !!eaten, gone: !!gone });
      if (!gone && (n - born > life || (eaten && n - eaten > 900) || (G.pop && balloons <= 0 && n - lastPop > 1200))) gone = n;
      if (gone && n - gone > 700) return hide();
      requestAnimationFrame(loop);
    }
    T.event.listen('prop-kick', e => { const k = e.payload || {}; if (k.kind !== 'gift' || gone) return;
      if (k.eaten && G.food && !eaten) eaten = performance.now();
      if (k.hit && G.pop && balloons > 0) { balloons--; pops[balloons] = lastPop = performance.now(); } });
    invoke('screens').then(r => {
      mons = r.monitors;
      setTimeout(() => {                        // полсекунды слушаем pet-pos: класть туда, где больше всего питомцев
        const cnt = new Map(); for (const p of paws.values()) { const m = monAt(p.x, p.y); if (m) cnt.set(m, (cnt.get(m) || 0) + 1); }
        const best = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0], m = (best && best[0]) || monAt(P.x, P.y) || mons[0]; if (!m) return hide();
        const s = S(); cx = Math.max(m.x + 120 * s, Math.min(m.x + m.w - 120 * s, m.x + m.w / 2 + rnd(-300, 300) * s)); cy = m.y + m.h - 2 * s; born = performance.now();
        requestAnimationFrame(loop);
      }, 600);
    }).catch(() => {});
  }

  // ======================= ОПРОС =======================
  // Микроопрос от коллеги: вопрос, чей, кнопки с вариантами. Окно ловит курсор внутри карточки; щелчок по
  // варианту — голос на портал, показ итога и уход через 4 с. Правый клик — закрыть; само уходит через 10 мин.
  if (KIND === 'poll') {
    let d = {}; try { d = JSON.parse(P.data || '{}') || {}; } catch (_) { /* нет данных */ }
    const opts = Array.isArray(d.options) ? d.options.slice(0, 3) : [], text = String(d.text || '').slice(0, 80), owner = String(d.owner || 'кто-то').slice(0, 40);
    const API = (window.KOTIK_EDITION || {}).api || '';
    let cx = P.x, cy = P.y, born = performance.now(), hover = -1, voted = -1, counts = null, doneAt = 0, msg = '';
    const btns = () => opts.map((o, i) => { const w = (W - 20 - (opts.length - 1) * 8) / opts.length; return { i, x: 10 + i * (w + 8), y: H - 40, w, h: 28, o }; });
    function draw(n) {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.roundRect(4, 6, W - 8, H - 8, 14); ctx.fill();
      ctx.fillStyle = '#fff8ea'; ctx.strokeStyle = '#c9a074'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(2, 2, W - 8, H - 10, 14); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7a6a5a'; ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(`❓ ${owner} спрашивает:`, 12, 20, W - 24);
      ctx.fillStyle = '#2a2018'; ctx.font = '600 13px system-ui, sans-serif';
      const words = text.split(' '), lines = []; let cur = '';
      for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > W - 24 && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur);
      lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, 12, 40 + i * 17, W - 24));
      if (voted < 0) {
        for (const b of btns()) { ctx.fillStyle = hover === b.i ? '#e8763a' : '#f2e2cc'; ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 8); ctx.fill(); ctx.fillStyle = hover === b.i ? '#fff' : '#3a2a1a'; ctx.font = '600 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.o, b.x + b.w / 2, b.y + b.h / 2, b.w - 8); }
      } else { ctx.fillStyle = '#3a7a3a'; ctx.font = '600 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(msg, W / 2, H - 26, W - 24); }
    }
    async function vote(i) {
      if (voted >= 0) return; voted = i; msg = 'отправляю…';
      try { const r = await fetch(API + '/poll/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ poll: d.id, client: d.client, choice: i }) }); const j = await r.json();
        counts = j.counts || null; msg = r.ok ? 'Спасибо! ' + (counts ? opts.map((o, k) => `${o} ${counts[k]}`).join(' · ') : '') : (j.message || 'не принято'); }
      catch (_) { msg = 'портал недоступен'; }
      doneAt = performance.now();
    }
    canvas.addEventListener('pointerdown', e => { if (e.button !== 0) return; const b = btns().find(b => hover === b.i); if (b) vote(b.i); });
    function loop() {
      const n = performance.now(), s = S();
      const lx = (cur.x - cx) / s + W / 2, ly = (cur.y - cy) / s + H / 2;   // курсор в координатах окна (якорь — центр)
      hover = voted < 0 ? (btns().find(b => lx >= b.x && lx <= b.x + b.w && ly >= b.y && ly <= b.y + b.h) || { i: -1 }).i : -1;
      draw(n);
      const over = lx >= 2 && lx <= W - 6 && ly >= 2 && ly <= H - 8;
      place(cx, cy, W / 2, H / 2, !over);
      emitPos({ x: cx, y: cy, id: d.id, text, owner, voted: voted >= 0 });
      if ((doneAt && n - doneAt > 4000) || n - born > 600000) return hide();
      requestAnimationFrame(loop);
    }
    invoke('screens').then(r => { mons = r.monitors; const m = monAt(P.x, P.y) || mons[0]; if (m) { const s = S(); cx = Math.max(m.x + 160 * s, Math.min(m.x + m.w - 160 * s, P.x)); cy = m.y + m.h - 190 * s; } requestAnimationFrame(loop); }).catch(() => {});
  }

  // ======================= МИСКА =======================
  // Миска для «просьбы поесть»: кот толкает её носом, пёс несёт в зубах (событие bowl-carry {by, x, y}),
  // у курсора роняют (prop-kick drop) и просят. Щелчок по миске — насыпать (питомец идёт есть), ест —
  // уровень падает (prop-kick eat). Пустая и без дела 90 с — уходит. Правый клик убирает.
  if (KIND === 'bowl') {
    let cx = P.x, cy = P.y, held = null, foodK = 0, full = false, lastUse = performance.now(), fillT = 0, wob = 0, vx = 0, vy = 0, lastT = performance.now(), food = '';
    const FOOD_ICO = { fish: '🐟', bone: '🦴', seeds: '🌻', carrot: '🥕', apple: '🍎' };
    T.event.listen('bowl-carry', e => { const k = e.payload || {}; held = { by: k.by, t: performance.now() }; cx = k.x; cy = k.y; lastUse = performance.now(); });
    T.event.listen('prop-kick', e => { const k = e.payload || {}; if (k.kind !== 'bowl') return; lastUse = performance.now();
      if (k.drop) { held = null; wob = 1; const m = monAt(cx, cy); if (m) cy = m.y + m.h - 2 * S(); }
      if (k.vx !== undefined) { held = null; vx = +k.vx || 0; vy = +k.vy || 0; wob = 1; }   // пинок: летит и катится
      if (k.bang) { wob = 1; vy = Math.min(vy, -150 * S()); }                                 // стук лапой: подпрыгнула
      if (k.fill) { full = true; foodK = 1; fillT = performance.now(); food = String(k.food || ''); }
      if (k.eat) { foodK = Math.max(0, foodK - (k.k || .1)); if (foodK <= .01) { full = false; foodK = 0; } }
      if (k.hide) hide(); });
    canvas.addEventListener('pointerdown', e => { if (e.button !== 0 || full) return; full = true; foodK = 1; fillT = performance.now(); lastUse = performance.now(); });
    function draw(n) {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
      const bx = W / 2, by = H - 14, tilt = held ? Math.sin(n / 90) * .06 : Math.sin(wob * 20) * .08 * wob;
      ctx.save(); ctx.translate(bx, by); ctx.rotate(tilt);
      ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath(); ctx.ellipse(0, 4, 30, 6, 0, 0, Math.PI * 2); ctx.fill();
      const g = ctx.createLinearGradient(0, -22, 0, 4); g.addColorStop(0, '#6fb0e0'); g.addColorStop(1, '#3f78ad');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-30, -18); ctx.quadraticCurveTo(-28, 4, -20, 4); ctx.lineTo(20, 4); ctx.quadraticCurveTo(28, 4, 30, -18); ctx.closePath(); ctx.fill();   // корпус
      ctx.fillStyle = '#2f5f8d'; ctx.beginPath(); ctx.ellipse(0, -18, 30, 8, 0, 0, Math.PI * 2); ctx.fill();                       // обод
      ctx.fillStyle = full ? (food === 'water' ? '#5fb8ff' : '#8a5a2a') : '#4c7fb0'; ctx.beginPath(); ctx.ellipse(0, -18, 25, 5.5, 0, 0, Math.PI * 2); ctx.fill();   // внутри
      if (full && food === 'water') { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(-8 + Math.sin(n / 400) * 3, -19, 7, 2, 0, 0, Math.PI * 2); ctx.fill(); }
      if (full && FOOD_ICO[food]) { ctx.font = '11px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; for (let i = 0; i < Math.max(1, Math.round(4 * foodK)); i++) ctx.fillText(FOOD_ICO[food], -12 + i * 8, -19 + (i % 2) * 2); }
      else if (full && food !== 'water') { ctx.fillStyle = '#b07a3a'; for (let i = 0; i < Math.round(9 * foodK); i++) { const a = i * 2.3, r = 4 + (i % 3) * 5; ctx.beginPath(); ctx.ellipse(Math.cos(a) * r, -19 + Math.sin(a) * r * .22, 3.2, 2.2, a, 0, Math.PI * 2); ctx.fill(); } }
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = '11px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🐾', 0, -2);
      ctx.restore();
      if (!full && !held) { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 3; ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.strokeText('пусто · щёлкни', bx, 24); ctx.fillText('пусто · щёлкни', bx, 24); }
    }
    function loop() {
      const n = performance.now(), s = S(), dt = Math.min(.05, (n - lastT) / 1000); lastT = n;
      if (held && n - held.t > 1500) held = null;
      wob = Math.max(0, wob - .02);
      if (!held && (vx || vy)) {                  // физика после пинка/стука: гравитация, отскок от пола, трение
        cx += vx * dt; cy += vy * dt; vy += 1500 * s * dt;
        const m = monAt(cx, cy), floor = m ? m.y + m.h - 2 * s : cy;
        if (cy >= floor) { cy = floor; vy = Math.abs(vy) > 70 * s ? -vy * .35 : 0; vx *= .7; }
        vx *= .97; if (Math.abs(vx) < 3 * s && !vy) vx = 0;
        if (m) cx = Math.max(m.x + 34 * s, Math.min(m.x + m.w - 34 * s, cx));
        lastUse = n;
      }
      draw(n);
      const over = Math.abs(cur.x - cx) < 32 * s && cur.y > cy - 30 * s && cur.y < cy + 8 * s;
      place(cx, cy, W / 2, H - 14, !over);
      emitPos({ x: cx, y: cy, full, foodK, food, held: held ? held.by : null });
      if (!held && !full && n - lastUse > 90000) return hide();
      if (full && n - fillT > 15 * 60000) { full = false; foodK = 0; }   // засохло — убрать еду
      requestAnimationFrame(loop);
    }
    invoke('screens').then(r => { mons = r.monitors; const m = monAt(P.x, P.y) || mons[0]; if (m) { const s = S(); cy = m.y + m.h - 2 * s; cx = Math.max(m.x + 40 * s, Math.min(m.x + m.w - 40 * s, P.x)); } requestAnimationFrame(loop); }).catch(() => {});
  }

  // ======================= КОГТЕТОЧКА =======================
  if (KIND === 'post') {
    let cx = P.x, cy = P.y, grab = null, wob = 0;
    canvas.addEventListener('pointerdown', e => { if (e.button !== 0) return; canvas.setPointerCapture(e.pointerId); grab = { dx: cur.x - cx, dy: cur.y - cy, t: performance.now() }; });
    canvas.addEventListener('pointerup', e => { if (e.button === 0) grab = null; });
    function draw() {
      const Wp = 140, Hp = 180;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, Wp, Hp);
      const bx = Wp / 2, by = Hp - 12;
      ctx.save(); ctx.translate(bx, by); ctx.rotate(Math.sin(wob * 30) * .04 * Math.min(1, wob));
      ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(0, 4, 40, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8f7a6a'; ctx.beginPath(); ctx.ellipse(0, 0, 38, 9, 0, 0, Math.PI * 2); ctx.fill();          // основание
      const g = ctx.createLinearGradient(-14, 0, 14, 0); g.addColorStop(0, '#b89a78'); g.addColorStop(.5, '#e0c39c'); g.addColorStop(1, '#a9896a');
      ctx.fillStyle = g; ctx.fillRect(-14, -140, 28, 140);                                                           // столбик в верёвке
      ctx.strokeStyle = 'rgba(90,60,30,.35)'; ctx.lineWidth = 1.2; for (let i = 0; i < 26; i++) { ctx.beginPath(); ctx.moveTo(-14, -138 + i * 5.3); ctx.lineTo(14, -136 + i * 5.3); ctx.stroke(); }
      ctx.fillStyle = '#c9b3a0'; ctx.beginPath(); ctx.ellipse(0, -140, 22, 7, 0, 0, Math.PI * 2); ctx.fill();       // площадка сверху
      ctx.restore();
    }
    function loop() {
      const n = performance.now(), s = S();
      if (grab) { if (!btn && n - grab.t > 150) grab = null; else { cx = cur.x - grab.dx; cy = cur.y - grab.dy; } }
      wob = Math.max(0, wob - .016);
      draw();
      const over = Math.abs(cur.x - cx) < 40 * s && cur.y > cy - 160 * s && cur.y < cy + 10 * s;
      place(cx, cy, 70, 180 - 12, !(over || grab));
      emitPos({ x: cx, y: cy });
      requestAnimationFrame(loop);
    }
    T.event.listen('prop-kick', e => { const k = e.payload || {}; if (k.kind === 'post') wob = 1; });   // кот дерёт — качается
    invoke('screens').then(r => { mons = r.monitors; requestAnimationFrame(loop); }).catch(() => {});
  }

  // ======================= МЫЛЬНЫЕ ПУЗЫРИ =======================
  // ======================= ГНЕЗДО =======================
  // Кучка в углу основного монитора: питомцы таскают туда «находки». Размер запоминается.
  if (KIND === 'nest') {
    const Wn = 180, Hn = 120; let n = 0; try { n = +localStorage.getItem('nest:n') || 0; } catch (_) { /* без сохранения */ }
    let pop = 0, last = performance.now(), ox = P.x, oy = P.y;
    const ITEMS = ['🧦', '🍂', '🧶', '🪶', '🔩', '📎', '🍬', '🧢', '🥄', '🎀'];
    function draw(t) {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, Wn, Hn);
      const cx = Wn / 2, base = Hn - 12, r = Math.min(70, 22 + n * 3), h = Math.min(60, 10 + n * 2.2);
      ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.beginPath(); ctx.ellipse(cx, base + 2, r + 6, 6, 0, 0, Math.PI * 2); ctx.fill();
      const g = ctx.createRadialGradient(cx - 10, base - h * .6, 4, cx, base - h * .3, r); g.addColorStop(0, '#c9a06a'); g.addColorStop(1, '#8a6238');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, base - h * .35, r, h * .55, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(80,50,20,.35)'; ctx.lineWidth = 1.2; for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * .3, base - h * .35 + Math.sin(a) * h * .2); ctx.lineTo(cx + Math.cos(a + .6) * r * .95, base - h * .35 + Math.sin(a + .6) * h * .5); ctx.stroke(); }
      ctx.font = '16px system-ui, "Segoe UI Emoji", "Apple Color Emoji"'; ctx.textAlign = 'center';
      for (let i = 0; i < Math.min(n, 14); i++) { const a = (i * 2.4) % (Math.PI * 2), rr = r * .7 * ((i * 7 % 10) / 10); ctx.fillText(ITEMS[i % ITEMS.length], cx + Math.cos(a) * rr, base - h * .35 + Math.sin(a) * h * .35 - (pop && i === Math.min(n, 14) - 1 ? Math.max(0, 30 - (t - pop) / 12) : 0)); }
      ctx.fillStyle = '#5a3a1a'; ctx.font = '600 12px system-ui'; ctx.fillText(n ? `гнездо · ${n}` : 'гнездо пустое', cx, 14);
    }
    function loop() {
      const t = performance.now(); last = t; draw(t);
      place(ox, oy, Wn / 2, Hn - 12, true);
      emitPos({ x: ox, y: oy, n });
      requestAnimationFrame(loop);
    }
    T.event.listen('prop-kick', e => { const k = e.payload || {}; if (k.kind !== 'nest') return; if (k.add) { n += k.add; pop = performance.now(); try { localStorage.setItem('nest:n', String(n)); } catch (_) { /* приватный режим */ } } if (k.clear) { n = 0; try { localStorage.setItem('nest:n', '0'); } catch (_) {} } });
    canvas.addEventListener('dblclick', () => { n = 0; try { localStorage.setItem('nest:n', '0'); } catch (_) {} });
    invoke('screens').then(r => { mons = r.monitors; const m = monAt(P.x, P.y) || mons[0]; const s = S(); if (m) { ox = m.x + 110 * s; oy = m.y + m.h - 4 * s; } requestAnimationFrame(loop); }).catch(() => {});   // на том мониторе, где кликнули трей
  }

  if (KIND === 'bubbles') {
    const Wb = 260, Hb = 520, bubbles = [], born = performance.now();
    const ox = P.x, oy = P.y;                     // точка выдувания — где был курсор
    let nextId = 1, last = born;
    function spawn() { bubbles.push({ id: nextId++, x: Wb / 2 + rnd(-30, 30), y: Hb - 20, r: rnd(9, 20), vx: rnd(-14, 14), vy: -rnd(28, 55), ph: Math.random() * 6, t: 0 }); }
    function draw() {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, Wb, Hb);
      for (const b of bubbles) {
        if (b.pop) { const k = (performance.now() - b.pop) / 250; if (k > 1) continue; ctx.strokeStyle = `rgba(255,255,255,${1 - k})`; ctx.lineWidth = 1.5; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(b.x + Math.cos(a) * b.r * (1 + k), b.y + Math.sin(a) * b.r * (1 + k)); ctx.lineTo(b.x + Math.cos(a) * b.r * (1.4 + k), b.y + Math.sin(a) * b.r * (1.4 + k)); ctx.stroke(); } continue; }
        const g = ctx.createRadialGradient(b.x - b.r * .3, b.y - b.r * .3, b.r * .1, b.x, b.y, b.r);
        g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(.7, 'rgba(180,220,255,.18)'); g.addColorStop(1, 'rgba(160,200,255,.45)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(b.x - b.r * .35, b.y - b.r * .4, b.r * .25, b.r * .14, -.7, 0, Math.PI * 2); ctx.fill();
      }
    }
    function loop() {
      const n = performance.now(), dt = Math.min(.05, (n - last) / 1000); last = n; const s = S();
      if (n - born < 25000 && Math.random() < dt * 1.6) spawn();
      for (const b of bubbles) { if (b.pop) continue; b.t += dt; b.y += b.vy * dt; b.x += (b.vx + Math.sin(b.t * 2 + b.ph) * 12) * dt; if (b.y < -30 || b.t > 14) b.pop = n - 300; }
      for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].pop && n - bubbles[i].pop > 300) bubbles.splice(i, 1);
      draw();
      place(ox, oy, Wb / 2, Hb - 20, true);
      // экранные координаты пузырей — питомцам, чтобы прыгать
      emitPos({ x: ox, y: oy, bubbles: bubbles.filter(b => !b.pop).map(b => ({ id: b.id, x: ox + (b.x - Wb / 2) * s, y: oy + (b.y - (Hb - 20)) * s, r: b.r * s })) });
      if (n - born > 25000 && !bubbles.length) return hide();
      requestAnimationFrame(loop);
    }
    T.event.listen('prop-kick', e => { const k = e.payload || {}; if (k.kind !== 'bubbles') return; const b = bubbles.find(q => q.id === k.pop); if (b && !b.pop) b.pop = performance.now(); });
    invoke('screens').then(r => { mons = r.monitors; for (let i = 0; i < 3; i++) spawn(); requestAnimationFrame(loop); }).catch(() => {});
  }

  // ======================= ЛЕЖАНКА =======================
  if (KIND === 'bed') {
    let cx = P.x, cy = P.y, grab = null, moved = 0, house = false, lastRead = 0, sleeper = 0;
    let nearAwake = 0;   // свет в окошке горит ночью, пока рядом кто-то не спит; уснули — гаснет
    T.event.listen('pet-pos', e => { const p = e.payload; if (!p || !p.foot || Math.abs(p.foot.x - cx) >= 90 * S()) return; if (p.act === 'sleep') sleeper = performance.now(); else nearAwake = performance.now(); });
    function readHouse() { try { house = localStorage.getItem('bed:house') === '1'; } catch (_) { /* без памяти */ } }
    function drawHouse() {
      const bx = W / 2, by = H - 16, night = (h => h >= 22 || h < 7)(new Date().getHours()), lit = night && performance.now() - nearAwake < 5000 && performance.now() - sleeper > 5000;
      ctx.fillStyle = '#c9a074'; ctx.fillRect(bx - 78, by - 92, 156, 90);                                          // стены
      ctx.strokeStyle = 'rgba(90,60,30,.35)'; ctx.lineWidth = 1; for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(bx - 78, by - 92 + i * 15); ctx.lineTo(bx + 78, by - 92 + i * 15); ctx.stroke(); }
      ctx.fillStyle = '#a0402c'; ctx.beginPath(); ctx.moveTo(bx - 92, by - 90); ctx.lineTo(bx, by - 140); ctx.lineTo(bx + 92, by - 90); ctx.closePath(); ctx.fill();   // крыша
      ctx.fillStyle = '#7a2e20'; ctx.fillRect(bx + 30, by - 132, 14, 22);                                            // труба
      ctx.fillStyle = '#5a3a1e'; ctx.beginPath(); ctx.moveTo(bx - 58, by - 2); ctx.lineTo(bx - 58, by - 62); ctx.arc(bx, by - 62, 58, Math.PI, 0); ctx.lineTo(bx + 58, by - 2); ctx.closePath(); ctx.fill();   // проём — корзинка внутри
      ctx.fillStyle = lit ? '#ffd982' : '#4a5566'; ctx.beginPath(); ctx.arc(bx - 52, by - 70, 11, 0, Math.PI * 2); ctx.fill();   // окошко
      if (lit) { const gr = ctx.createRadialGradient(bx - 52, by - 70, 4, bx - 52, by - 70, 26); gr.addColorStop(0, 'rgba(255,220,130,.45)'); gr.addColorStop(1, 'rgba(255,220,130,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(bx - 52, by - 70, 26, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = 'rgba(60,40,20,.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bx - 63, by - 70); ctx.lineTo(bx - 41, by - 70); ctx.moveTo(bx - 52, by - 81); ctx.lineTo(bx - 52, by - 59); ctx.stroke();
    }
    canvas.addEventListener('pointerdown', e => { if (e.button !== 0) return; canvas.setPointerCapture(e.pointerId); grab = { dx: cur.x - cx, dy: cur.y - cy, t: performance.now() }; });
    canvas.addEventListener('pointerup', e => { if (e.button !== 0) return; if (grab) { grab = null; invoke('bed_pos', { x: Math.round(cx), y: Math.round(cy) }).catch(() => {}); } });
    function draw() {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
      const bx = W / 2, by = H - 16;
      if (house) drawHouse();
      ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.beginPath(); ctx.ellipse(bx, by + 6, 54, 8, 0, 0, Math.PI * 2); ctx.fill();
      const g = ctx.createLinearGradient(0, by - 30, 0, by + 8); g.addColorStop(0, '#c99a6a'); g.addColorStop(1, '#8f6540');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(bx, by - 4, 54, 22, 0, 0, Math.PI * 2); ctx.fill();          // корзинка
      ctx.strokeStyle = 'rgba(80,50,25,.35)'; ctx.lineWidth = 1;
      for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.ellipse(bx, by - 4 + i * 4, 54 - Math.abs(i) * 1.5, 22 - Math.abs(i) * 3, 0, Math.PI * .08, Math.PI * .92); ctx.stroke(); }
      const c = ctx.createRadialGradient(bx - 10, by - 16, 4, bx, by - 10, 46); c.addColorStop(0, '#f3dfe8'); c.addColorStop(1, '#d9b7c8');
      ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(bx, by - 10, 44, 14, 0, 0, Math.PI * 2); ctx.fill();         // подушка
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(bx - 12, by - 14, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(110,70,90,.4)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.ellipse(bx, by - 10, 40, 11, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    function loop() {
      const n = performance.now(), s = S();
      if (grab) { if (!btn && n - grab.t > 150) { grab = null; invoke('bed_pos', { x: Math.round(cx), y: Math.round(cy) }).catch(() => {}); } else { cx = cur.x - grab.dx; cy = cur.y - grab.dy; } }
      if (n - lastRead > 2000) { lastRead = n; readHouse(); }
      draw();
      const over = Math.abs(cur.x - cx) < (house ? 80 : 54) * s && cur.y > cy - (house ? 130 : 40) * s && cur.y < cy + 12 * s;
      place(cx, cy, W / 2, H - 16, !(over || grab));
      emitPos({ x: cx, y: cy });                   // точка — центр подушки; питомцы ложатся сюда
      requestAnimationFrame(loop);
    }
    invoke('screens').then(r => { mons = r.monitors; requestAnimationFrame(loop); }).catch(() => {});
  }
})();
