// Чиби-питомцы: вид спереди / в три четверти, большая голова, огромные блестящие глаза,
// мягкая светотень без жёсткого контура, шерстинки по краю. Один рендер на пять видов.
//
// drawChibi(g, o) — рисует в текущих координатах: начало — точка на земле под центром зверя,
// x вправо, y вверх отрицательный. o: { sp, pal, pose: 'sit'|'loaf'|'up'|'hang'|'fly',
//   yaw(-1..1), bob, tilt(°), squash, pawL/pawR (подъём лап 0..1, <0 — свисают), armL/armR (0..1 к морде),
//   headY, headTilt(°), eye(0..1), pup(0..1), look{x,y}, happy(0..1 глаза ^^), mouth(0..1 открыт),
//   tongue, ear(-1..1), tail(размах °), tailUp(0..1), cheek, crest, wing(0..1), wingA(°), puff, t }.
// Возвращает { head:{x,y,r}, top:{x,y}, bbox:{l,t,r,b} } — для пузыря речи и попадания курсора.
(function () {
  'use strict';
  const V = (x, y) => ({ x, y });
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rad = d => d * Math.PI / 180;
  function shade(hex, k) {
    if (!hex || hex[0] !== '#') return hex;
    const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  }
  function spline(g, pts, closed = true) {
    const n = pts.length, P = i => closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)];
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      g.bezierCurveTo(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6, p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6, p2.x, p2.y);
    }
    if (closed) g.closePath();
  }
  const hash = i => { const h = Math.sin(i * 12.9898) * 43758.5453; return h - Math.floor(h); };
  function fluffRing(cx, cy, rx, ry, a0, a1, n, depth, seed) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = lerp(a0, a1, i / n), k = i % 2 ? 1 + depth * (.6 + hash(seed + i) * .6) : 1;
      pts.push(V(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k));
    }
    return pts;
  }
  const ellipsePts = (cx, cy, rx, ry, n = 16) => { const p = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; p.push(V(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry)); } return p; };

  // праздничные шапочки: колпак Деда Мороза и колпак именинника; (x,y) — макушка, k — масштаб
  function drawHat(g, x, y, kind, k = 1) {
    if (!kind) return;
    g.save(); g.translate(x, y); g.scale(k, k); g.rotate(-.18);
    if (kind === 'santa') {
      g.fillStyle = '#d8342c'; g.beginPath(); g.moveTo(-20, 4); g.quadraticCurveTo(-6, -30, 14, -40); g.quadraticCurveTo(6, -18, 20, 4); g.closePath(); g.fill();
      g.fillStyle = '#f7f3ee'; g.beginPath(); g.ellipse(0, 4, 23, 7, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(15, -41, 6, 0, Math.PI * 2); g.fill();
    } else if (kind === 'party') {
      const gr = g.createLinearGradient(-14, 0, 14, 0); gr.addColorStop(0, '#f2b134'); gr.addColorStop(.5, '#7fb3f0'); gr.addColorStop(1, '#f08ab8');
      g.fillStyle = gr; g.beginPath(); g.moveTo(-15, 4); g.lineTo(0, -36); g.lineTo(15, 4); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = '#e0392b'; g.beginPath(); g.arc(0, -37, 4.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.7)'; for (const q of [[-6, -6], [4, -16], [-2, -24]]) { g.beginPath(); g.arc(q[0], q[1], 1.8, 0, Math.PI * 2); g.fill(); }
    } else if (kind === 'musketeer') {                          // шляпа Кота в сапогах
      g.rotate(.18); g.fillStyle = '#5a3a1e'; g.beginPath(); g.ellipse(0, 2, 36, 8, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#6e4a26'; g.beginPath(); g.moveTo(-18, 2); g.quadraticCurveTo(-16, -26, 0, -28); g.quadraticCurveTo(16, -26, 18, 2); g.closePath(); g.fill();
      g.strokeStyle = '#e9c34a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-17, -2); g.quadraticCurveTo(0, 2, 17, -2); g.stroke();
      g.fillStyle = '#e8462a'; g.beginPath(); g.moveTo(8, -6); g.quadraticCurveTo(30, -30, 46, -22); g.quadraticCurveTo(30, -20, 12, -2); g.closePath(); g.fill();
    } else if (kind === 'propeller') {                          // пропеллер Карлсона (крутится)
      g.rotate(.18); const tt = (performance.now() / 1000) % 1000;
      g.fillStyle = '#8a8f95'; g.fillRect(-3, -2, 6, 10); g.fillStyle = '#d9382e'; g.beginPath(); g.arc(0, -4, 5, 0, Math.PI * 2); g.fill();
      g.save(); g.translate(0, -4); g.scale(Math.cos(tt * 40), 1); g.fillStyle = 'rgba(120,120,130,.85)'; g.fillRect(-32, -2.5, 64, 5); g.restore();
    } else if (kind === 'pumpkin') {                            // тыква на Хэллоуин
      g.rotate(.18); g.fillStyle = '#e8801e'; g.beginPath(); g.ellipse(0, -8, 24, 18, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(120,60,10,.45)'; g.lineWidth = 1.5; for (const q of [-12, 0, 12]) { g.beginPath(); g.ellipse(q, -8, 7, 17, 0, 0, Math.PI * 2); g.stroke(); }
      g.fillStyle = '#3e7a2a'; g.fillRect(-3, -30, 6, 8);
      g.fillStyle = '#3a2410'; g.beginPath(); g.moveTo(-12, -12); g.lineTo(-6, -4); g.lineTo(-16, -4); g.closePath(); g.fill(); g.beginPath(); g.moveTo(12, -12); g.lineTo(6, -4); g.lineTo(16, -4); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(-10, 0); g.quadraticCurveTo(0, 6, 10, 0); g.lineTo(6, 2); g.lineTo(2, 0); g.lineTo(-2, 2); g.lineTo(-6, 0); g.closePath(); g.fill();
    } else if (kind === 'crown') {                              // корона «кота недели»
      g.rotate(.18); g.fillStyle = '#f2c230'; g.beginPath(); g.moveTo(-20, 4); g.lineTo(-20, -18); g.lineTo(-10, -6); g.lineTo(0, -24); g.lineTo(10, -6); g.lineTo(20, -18); g.lineTo(20, 4); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(120,80,0,.5)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = '#e0392b'; for (const q of [[-20, -18], [0, -24], [20, -18]]) { g.beginPath(); g.arc(q[0], q[1], 3, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#4f8fd6'; g.beginPath(); g.arc(0, -2, 3.5, 0, Math.PI * 2); g.fill();
    } else if (kind === 'hearts') {
      g.fillStyle = '#ff5c7a'; for (const q of [[-14, -6, 1], [0, -14, 1.3], [14, -6, 1]]) { g.save(); g.translate(q[0], q[1]); g.scale(q[2], q[2]); g.beginPath(); g.moveTo(0, 4); g.bezierCurveTo(-6, -1, -3, -6, 0, -3); g.bezierCurveTo(3, -6, 6, -1, 0, 4); g.fill(); g.restore(); }
    }
    g.restore();
  }
  function drawChibi(g, o) {
    const sp = o.sp || 'cat', p = o.pal, yaw = clamp(o.yaw || 0, -1, 1), t = o.t || 0;
    const CAT = sp === 'cat', DOG = sp === 'dog', HAM = sp === 'hamster', RAB = sp === 'rabbit', BIRD = sp === 'bird', DRAGON = sp === 'dragon';
    const pose = o.pose || 'sit', loaf = pose === 'loaf', up = pose === 'up', hang = pose === 'hang', fly = pose === 'fly';
    const puff = o.puff || 1;
    const line = p.line || '#3a2519';
    const outline = 'rgba(50,30,25,.28)';
    const fur = p.fur, chest = p.chest || p.fur, paws = p.paws || chest;
    const info = { head: { x: 0, y: 0, r: 0 }, top: { x: 0, y: 0 }, bbox: { l: -60, t: -150, r: 60, b: 4 } };

    g.save();
    g.translate(0, o.bob || 0);
    g.rotate(rad(o.tilt || 0));
    g.scale(1, o.squash || 1);
    g.lineJoin = g.lineCap = 'round';
    const soft = (col, cx, cy, r, k = 1) => {
      const gr = g.createRadialGradient(cx - r * .3, cy - r * .45, r * .1, cx, cy, r * 1.15);
      gr.addColorStop(0, shade(col, .15 * k)); gr.addColorStop(.7, col); gr.addColorStop(1, shade(col, -.22 * k));
      return gr;
    };
    const fill = (col, path, grad, noLine) => {
      g.beginPath(); path(); g.fillStyle = grad || col; g.fill();
      if (!noLine) { g.strokeStyle = outline; g.lineWidth = 1; g.stroke(); }
    };
    const furStrokes = (pts, col, len, seed, step = 1) => {
      if (p.sphynx || DRAGON) return;
      if (p.curly) { len *= 1.6; step = 1; }
      if (p.fluffy) { len *= .9; step = 1; }
      if (p.fluffK !== undefined) len *= .4 + p.fluffK * 1.2;
      g.strokeStyle = col; g.lineWidth = p.fluffy ? 1.3 : 1.05;
      for (let i = 0; i < pts.length; i += step) {
        const a = pts[i], b = pts[(i + 1) % pts.length], nx = b.y - a.y, ny = -(b.x - a.x), l = Math.hypot(nx, ny) || 1;
        const h = hash(seed + i), L = len * (.45 + h);
        g.beginPath(); g.moveTo(a.x, a.y); g.quadraticCurveTo(a.x + nx / l * L * .6, a.y + ny / l * L * .6, a.x + nx / l * L + (h - .5) * 3, a.y + ny / l * L); g.stroke();
      }
    };
    const halo = (path, col, w) => { if (DRAGON || (!p.fluffy && !(p.fluffK > .7))) return; g.save(); g.filter = 'blur(2.2px)'; g.strokeStyle = col; g.lineWidth = w; g.beginPath(); path(); g.stroke(); g.restore(); };
    const sx = -yaw * 3;

    // ======================= СПРАЙТ (картинка вместо рисунка) =======================
    if (p.sprite) {
      const cache = drawChibi._img || (drawChibi._img = {});
      let img = cache[p.sprite];
      if (!img) { img = cache[p.sprite] = new Image(); img.onload = () => window.dispatchEvent(new Event('sprite-load')); img.src = p.sprite.startsWith('data:') ? p.sprite : 'sprites/' + p.sprite; }
      const H0 = 140 * (p.spriteK || 1), ready = img.complete && img.naturalWidth;
      const W0 = ready ? H0 * img.naturalWidth / img.naturalHeight : H0 * .75;
      const flip = yaw < -.05 ? -1 : 1, sq = loaf ? .82 : pose === 'crouch' ? .88 : hang ? 1.06 : 1;
      const lean = (o.headTilt || 0) * (p.parts ? .12 : .35) + (o.tilt || 0) + (hang ? Math.sin(t * 3) * 4 : 0);
      g.save(); g.translate(sx, 0); g.rotate(rad(lean)); g.scale(flip, 1); g.scale(1 + (1 - sq) * .5, sq);
      if (!ready) { g.fillStyle = p.fur; g.beginPath(); g.ellipse(0, -H0 / 2, W0 / 2, H0 / 2, 0, 0, Math.PI * 2); g.fill(); }
      else if (p.parts) {                                               // марионетка: ноги шагают, голова кивает
        const iw = img.naturalWidth, ih = img.naturalHeight, k = H0 / ih, neck = p.parts.neck || 0, legs = p.parts.legs || 0;
        const hy = ih * neck, ly = ih * (1 - legs);
        const pawL = o.pawL || 0, pawR = o.pawR || 0, gaitK = pose === 'walk' || pose === 'stand' ? 1 : 0;
        // ноги: левая и правая половины нижней полосы, каждая поднимается по своей фазе
        if (legs > 0 && !loaf) for (const [s, lift] of [[-1, pawL], [1, pawR]]) {
          const x0 = s < 0 ? 0 : iw / 2, dy = -lift * H0 * .11 * gaitK;
          g.save(); g.beginPath(); g.rect(-W0 / 2 + x0 * k, -H0 + ly * k - 2 + dy, iw / 2 * k, (ih - ly) * k + 2); g.clip();
          g.drawImage(img, x0, ly - 4, iw / 2, ih - ly + 4, -W0 / 2 + x0 * k, -H0 + ly * k - 4 * k + dy, iw / 2 * k, (ih - ly + 4) * k); g.restore();
        }
        // туловище (вместе с ногами, если сидит)
        const bodyTop = hy, bodyBot = loaf || legs <= 0 ? ih : ly;
        g.drawImage(img, 0, bodyTop, iw, bodyBot - bodyTop, -W0 / 2, -H0 + bodyTop * k, W0, (bodyBot - bodyTop) * k);
        // голова: поворот вокруг шеи, лёгкий кивок
        if (neck > 0) {
          const px = 0, py = -H0 + hy * k;
          const walkNod = gaitK * Math.max(pawL, pawR) * 3;
          g.save(); g.translate(px, py + (o.headY || 0) * .5 + walkNod * .6); g.rotate(rad((o.headTilt || 0) * .6 + walkNod * (pawL > pawR ? -1 : 1))); g.translate(-px, -py);
          g.drawImage(img, 0, 0, iw, hy + 3, -W0 / 2, -H0, W0, (hy + 3) * k); g.restore();
        } else g.drawImage(img, 0, 0, iw, hy + 1, -W0 / 2, -H0, W0, (hy + 1) * k);
      } else g.drawImage(img, -W0 / 2, -H0, W0, H0);
      if (p.eyeY !== -1 && ((o.happy || 0) > .5 || (o.eye !== undefined && o.eye < .15))) {   // закрытые глаза поверх картинки (eyeY −1 — глаза не размечены)
        const ex = (p.eyeX || 0), ey = -H0 * (p.eyeY || .55), er = H0 * .06;
        g.strokeStyle = p.line || '#2a1d18'; g.lineWidth = 2; g.lineCap = 'round'; g.globalAlpha = .85;
        for (const s of [-1, 1]) { g.beginPath(); if ((o.happy || 0) > .5) { g.moveTo(ex + s * (p.eyeDX || .12) * H0 - er, ey + 2); g.quadraticCurveTo(ex + s * (p.eyeDX || .12) * H0, ey - er, ex + s * (p.eyeDX || .12) * H0 + er, ey + 2); } else { g.moveTo(ex + s * (p.eyeDX || .12) * H0 - er, ey); g.quadraticCurveTo(ex + s * (p.eyeDX || .12) * H0, ey + er * .8, ex + s * (p.eyeDX || .12) * H0 + er, ey); } g.stroke(); }
        g.globalAlpha = 1;
      }
      if ((o.mouth || 0) > .3 && p.mouthOverlay) { g.fillStyle = '#5a1f28'; g.beginPath(); g.ellipse((p.eyeX || 0), -H0 * (p.mouthY || .4), 4 + (o.mouth || 0) * 3, 3 + (o.mouth || 0) * 4, 0, 0, Math.PI * 2); g.fill(); }
      drawHat(g, 0, -H0 * (p.hatY || 1.0), (o.hat || p.hat), 1);
      g.restore();
      info.head = { x: sx, y: -H0 * (p.eyeY || .55), r: H0 * .28 }; info.top = { x: sx, y: -H0 * sq };
      info.bbox = { l: -W0 / 2 - 10, t: -H0 - 10, r: W0 / 2 + 10, b: 4 };
      g.restore();
      return info;
    }

    // ======================= КРУГЛЫШИ: Смешарики, Миньон, Губка Боб =======================
    if (sp === 'round') {
      const body = p.fur, shape = p.shape || 'round', bK = p.bodyK || 1;
      const R0 = 46 * bK * puff, ry0 = shape === 'capsule' ? 60 : shape === 'square' ? 48 : R0, rx0 = shape === 'capsule' ? 34 : shape === 'square' ? 44 : R0;
      const cy0 = -ry0 - 10 + (loaf ? 8 : 0), sq = loaf ? .9 : pose === 'crouch' ? .9 : 1;
      g.save(); g.translate(sx, 0); g.scale(1, sq);
      const bodyPath = () => {
        if (shape === 'square') { const r = 8; g.moveTo(-rx0 + r, cy0 - ry0); g.arcTo(rx0, cy0 - ry0, rx0, cy0 + ry0, r); g.arcTo(rx0, cy0 + ry0, -rx0, cy0 + ry0, r); g.arcTo(-rx0, cy0 + ry0, -rx0, cy0 - ry0, r); g.arcTo(-rx0, cy0 - ry0, rx0, cy0 - ry0, r); g.closePath(); }
        else if (shape === 'capsule') { g.moveTo(-rx0, cy0 - ry0 + rx0); g.arc(0, cy0 - ry0 + rx0, rx0, Math.PI, 0); g.lineTo(rx0, cy0 + ry0 - rx0 * .4); g.arc(0, cy0 + ry0 - rx0 * .4, rx0, 0, Math.PI); g.closePath(); }
        else g.ellipse(0, cy0, rx0, ry0, 0, 0, Math.PI * 2);
      };
      // ножки и ручки
      for (const s of [-1, 1]) {
        const lift = (s < 0 ? o.pawL : o.pawR) || 0, lx = s * rx0 * .45, ly = -lift * 8;
        if (p.pants) { g.fillStyle = p.pants; g.fillRect(-rx0 * .9, cy0 + ry0 * .35, rx0 * 1.8, ry0 * .55); }
        g.strokeStyle = p.limb || shade(body, -.25); g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(lx, cy0 + ry0 * .7); g.lineTo(lx, ly - 4); g.stroke();
        g.fillStyle = p.shoe || shade(body, -.35); g.beginPath(); g.ellipse(lx + s * 2, ly - 2, 9, 5, 0, 0, Math.PI * 2); g.fill();
      }
      for (const [s, arm] of [[-1, o.armL || 0], [1, o.armR || 0]]) {
        const ax = s * rx0 * .95, ay = cy0 + ry0 * .1, ex = ax + s * lerp(10, 2, arm), ey = arm > .05 ? lerp(ay + 18, cy0 - ry0 * .3, arm) : ay + 20;
        g.strokeStyle = p.limb || shade(body, -.25); g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(ax, ay); g.lineTo(ex, ey); g.stroke();
        g.fillStyle = p.hand || p.limb || shade(body, -.25); g.beginPath(); g.arc(ex, ey + 2, 5, 0, Math.PI * 2); g.fill();
      }
      // уши/детали за телом
      const earA = o.ear || 0;
      if (p.ears === 'long') for (const s of [-1, 1]) {                       // Крош
        g.save(); g.translate(s * rx0 * .35, cy0 - ry0 * .75); g.rotate(s * rad(10 + earA * 20)); fill(body, () => g.ellipse(0, -30, 11, 34, 0, 0, Math.PI * 2), soft(body, 0, -30, 20)); g.fillStyle = p.earIn || shade(body, .35); g.beginPath(); g.ellipse(0, -30, 6, 26, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
      if (p.ears === 'round') for (const s of [-1, 1]) { fill(body, () => g.arc(s * rx0 * .7, cy0 - ry0 * .7, 14, 0, Math.PI * 2), soft(body, s * rx0 * .7, cy0 - ry0 * .7, 12)); g.fillStyle = p.earIn || shade(body, .3); g.beginPath(); g.arc(s * rx0 * .7, cy0 - ry0 * .7, 8, 0, Math.PI * 2); g.fill(); }
      if (p.ears === 'pig') for (const s of [-1, 1]) { fill(body, () => { g.moveTo(s * rx0 * .5, cy0 - ry0 * .75); g.lineTo(s * rx0 * .95, cy0 - ry0 * 1.15); g.lineTo(s * rx0 * .95, cy0 - ry0 * .55); g.closePath(); }); }
      if (p.spikes) { g.fillStyle = p.spikes; for (let i = 0; i < 9; i++) { const a = Math.PI + (i + .5) / 9 * Math.PI; g.beginPath(); g.moveTo(Math.cos(a - .12) * rx0 * .95, cy0 + Math.sin(a - .12) * ry0 * .95); g.lineTo(Math.cos(a) * rx0 * 1.3, cy0 + Math.sin(a) * ry0 * 1.3); g.lineTo(Math.cos(a + .12) * rx0 * .95, cy0 + Math.sin(a + .12) * ry0 * .95); g.closePath(); g.fill(); } }
      if (p.curl) { g.strokeStyle = p.curl; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(-8, cy0 - ry0 + 4); g.quadraticCurveTo(-4, cy0 - ry0 - 22, 14, cy0 - ry0 - 18); g.stroke(); g.fillStyle = p.curl; g.beginPath(); g.arc(14, cy0 - ry0 - 18, 6, 0, Math.PI * 2); g.fill(); }
      // тело
      fill(body, bodyPath, soft(body, 0, cy0, ry0));
      g.save(); g.beginPath(); bodyPath(); g.clip();
      if (p.belly) { g.fillStyle = p.belly; g.beginPath(); g.ellipse(0, cy0 + ry0 * .35, rx0 * .6, ry0 * .5, 0, 0, Math.PI * 2); g.fill(); }
      if (p.holes) { g.fillStyle = shade(body, -.22); for (let i = 0; i < 9; i++) { g.beginPath(); g.arc((hash(i * 3 + 1) - .5) * rx0 * 1.8, cy0 + (hash(i * 5 + 2) - .5) * ry0 * 1.8, 3 + hash(i) * 4, 0, Math.PI * 2); g.fill(); } }
      if (p.pants) { g.fillStyle = p.pants; g.fillRect(-rx0 - 2, cy0 + ry0 * .45, rx0 * 2 + 4, ry0); if (p.overalls) { g.fillRect(-rx0 * .55, cy0 - ry0 * .3, rx0 * 1.1, ry0 * .8); g.fillRect(-rx0 * .55, cy0 - ry0 * .9, 6, ry0 * .7); g.fillRect(rx0 * .55 - 6, cy0 - ry0 * .9, 6, ry0 * .7); } if (p.belt) { g.fillStyle = p.belt; g.fillRect(-rx0 - 2, cy0 + ry0 * .45, rx0 * 2 + 4, 4); } }
      if (p.tie) { g.fillStyle = p.tie; g.beginPath(); g.moveTo(0, cy0 + ry0 * .3); g.lineTo(-5, cy0 + ry0 * .38); g.lineTo(-3, cy0 + ry0 * .6); g.lineTo(0, cy0 + ry0 * .68); g.lineTo(3, cy0 + ry0 * .6); g.lineTo(5, cy0 + ry0 * .38); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-9, cy0 + ry0 * .22); g.lineTo(0, cy0 + ry0 * .34); g.lineTo(9, cy0 + ry0 * .22); g.lineTo(9, cy0 + ry0 * .3); g.lineTo(0, cy0 + ry0 * .42); g.lineTo(-9, cy0 + ry0 * .3); g.closePath(); g.fill(); }
      g.restore();
      // лицо
      const fx = yaw * 8, eyY = cy0 - ry0 * .2 + (o.headY || 0) * .5;
      const happy = clamp(o.happy || 0, 0, 1), open = clamp((o.eye === undefined ? 1 : o.eye) * (1 - happy), 0, 1);
      const lx = clamp(o.look ? o.look.x : 0, -1, 1) * 3 + yaw * 3, ly = clamp(o.look ? o.look.y : 0, -1, 1) * 3;
      if (p.goggles) {                                                  // миньон: очки-гоглы (одно или два стекла)
        const n = p.goggles === 1 ? [0] : [-1, 1], gr_ = p.goggles === 1 ? 17 : 13;
        g.strokeStyle = '#2a2a2e'; g.lineWidth = 5; g.beginPath(); g.moveTo(-rx0, eyY); g.lineTo(rx0, eyY); g.stroke();
        for (const s of n) { const ex = s * 15 + fx; g.fillStyle = '#c9ccd0'; g.beginPath(); g.arc(ex, eyY, gr_ + 4, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(ex, eyY, gr_, 0, Math.PI * 2); g.fill();
          if (open > .12) { g.fillStyle = p.iris || '#7a4a2a'; g.beginPath(); g.arc(ex + lx, eyY + ly, gr_ * .5, 0, Math.PI * 2); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(ex + lx, eyY + ly, gr_ * .28, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + lx - 3, eyY + ly - 3, 2, 0, Math.PI * 2); g.fill(); }
          else { g.fillStyle = body; g.beginPath(); g.arc(ex, eyY, gr_, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#2a2a2e'; g.lineWidth = 2; g.beginPath(); g.moveTo(ex - 10, eyY); g.lineTo(ex + 10, eyY); g.stroke(); }
          g.strokeStyle = '#7a7d82'; g.lineWidth = 3; g.beginPath(); g.arc(ex, eyY, gr_ + 4, 0, Math.PI * 2); g.stroke(); }
      } else {
        for (const s of [-1, 1]) {
          const ex = s * (p.eyeGap || 15) + fx, rr = 11 * (p.eyeK || 1), ry_ = rr * 1.2;
          g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ex, eyY, rr, ry_, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.stroke();
          if (open > .12) { g.save(); g.beginPath(); g.ellipse(ex, eyY, rr, ry_ * open, 0, 0, Math.PI * 2); g.clip();
            if (p.iris) { g.fillStyle = p.iris; g.beginPath(); g.arc(ex + lx, eyY + ly, rr * .6, 0, Math.PI * 2); g.fill(); }
            g.fillStyle = '#111'; g.beginPath(); g.arc(ex + lx, eyY + ly, rr * .38, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + lx - 3, eyY + ly - 3, 2.2, 0, Math.PI * 2); g.fill(); g.restore(); }
          else { g.strokeStyle = '#222'; g.lineWidth = 2; g.beginPath(); if (happy > .5) { g.moveTo(ex - 7, eyY + 2); g.quadraticCurveTo(ex, eyY - 6, ex + 7, eyY + 2); } else { g.moveTo(ex - 7, eyY); g.lineTo(ex + 7, eyY); } g.stroke(); }
          if (p.lashes) { g.strokeStyle = '#222'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(ex + s * rr * .8, eyY - ry_ * .5); g.lineTo(ex + s * (rr + 4), eyY - ry_ * .8); g.stroke(); }
        }
        if (p.glasses) { g.strokeStyle = '#2a2a30'; g.lineWidth = 2.5; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * (p.eyeGap || 15) + fx, eyY, 15, 0, Math.PI * 2); g.stroke(); } g.beginPath(); g.moveTo(-3 + fx, eyY); g.lineTo(3 + fx, eyY); g.stroke(); }
      }
      const my = eyY + ry0 * .35, mouth = o.mouth || 0;
      if (p.snout) { g.fillStyle = p.snout; g.beginPath(); g.ellipse(fx, my - 6, 13, 9, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = shade(p.snout, -.35); for (const s of [-1, 1]) { g.beginPath(); g.ellipse(fx + s * 4, my - 6, 2, 3, 0, 0, Math.PI * 2); g.fill(); } }
      else if (p.nose) { g.fillStyle = p.nose; g.beginPath(); g.ellipse(fx, my - 8, p.noseK ? 8 * p.noseK : 5, p.noseK ? 5 * p.noseK : 3.5, 0, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = '#222'; g.lineWidth = 1.6;
      if (mouth > .15) { g.fillStyle = '#5a1f28'; g.beginPath(); g.ellipse(fx, my + 4, 5 + mouth * 6, 3 + mouth * 6, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
      else { const w = p.smile ? 16 : 9; g.beginPath(); g.moveTo(fx - w, my - 1); g.quadraticCurveTo(fx, my + 8 + (happy * 4), fx + w, my - 1); g.stroke();
        if (p.teeth) { g.fillStyle = '#fffaf0'; g.fillRect(fx - 5, my + 2, 4.5, p.teeth === 'big' ? 9 : 6); g.fillRect(fx + .5, my + 2, 4.5, p.teeth === 'big' ? 9 : 6); } }
      if (p.cheekC) { g.fillStyle = p.cheekC; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * rx0 * .62 + fx, my - 4, 7, 5, 0, 0, Math.PI * 2); g.fill(); } }
      if (p.freckles) { g.fillStyle = 'rgba(150,90,60,.5)'; for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(s * (14 + i * 5) + fx, my - 10 + (i % 2) * 4, 1.3, 0, Math.PI * 2); g.fill(); } }
      if (p.hair === 'short') { g.strokeStyle = p.hairC || '#222'; g.lineWidth = 2.5; g.lineCap = 'round'; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 5, cy0 - ry0 + 2); g.lineTo(i * 6, cy0 - ry0 - 12 - Math.abs(i) * -2); g.stroke(); } }
      drawHat(g, fx * .2, cy0 - ry0 + 2, (o.hat || p.hat), 1);
      g.restore();
      info.head = { x: sx, y: eyY * sq, r: rx0 * .8 }; info.top = { x: sx, y: (cy0 - ry0 - (p.ears === 'long' ? 60 : p.spikes ? 16 : 4)) * sq };
      info.bbox = { l: -rx0 - 40, t: info.top.y - 8, r: rx0 + 40, b: 4 };
      g.restore();
      return info;
    }

    // ======================= ПТИЦА =======================
    if (BIRD) {
      const body = p.fur, wingC = p.wing || shade(body, -.12), prim = p.prim || shade(body, -.35);
      const bK = p.bodyK || 1, tK = p.tailK || 1;
      const bx = sx, by = fly ? -44 : loaf ? -32 : -36, bry = (fly ? 26 : loaf ? 30 : 32) * puff, brx = (fly ? 30 : 26) * puff * bK;
      const flap = (o.wing || 0);
      const wingA = o.wingA || 0;
      // хвост — веер перьев назад-вниз
      const tside = yaw > .1 ? -1 : 1;
      for (const k of [-1, 0, 1]) {
        const a = rad(95 + tside * 25 + k * 12 + (fly ? -tside * 50 : 0)), L = (fly ? 30 : 26) * tK, bx0 = bx + tside * 10, by0 = by + bry * .55;
        g.fillStyle = k ? (p.tail2 || p.tail || prim) : (p.tail || prim);
        g.beginPath(); g.ellipse(bx0 + Math.cos(a) * L / 2, by0 + Math.sin(a) * L / 2, L / 2, 4.5, a, 0, Math.PI * 2); g.fill();
      }
      // лапки
      if (!fly) for (const s of [-1, 1]) {
        const fx = bx + s * 9 - yaw * 4, lift = (s < 0 ? o.pawL : o.pawR) || 0, fy = -lift * 5;
        g.strokeStyle = p.feet || '#8d8680'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(fx, by + bry * .7); g.lineTo(fx, fy - 1); g.stroke();
        g.lineWidth = 1.6; g.beginPath(); for (const dx of [-5, 0, 5]) { g.moveTo(fx, fy); g.lineTo(fx + dx, fy + 3); } g.stroke();
      }
      // дальнее крыло (в полёте — за телом)
      const wing = (s, back) => {
        const shx = bx + s * brx * .75, shy = by - bry * .35;
        g.save(); g.translate(shx, shy);
        if (flap > .5) g.rotate(s * rad(-70 + wingA)); else g.rotate(s * rad(8 + (o.ear || 0) * 15));
        const L = flap > .5 ? 44 : 34, W = flap > .5 ? 15 : 12;
        const pts = flap > .5
          ? [V(0, -4), V(s * L * .5, -9), V(s * L, -3), V(s * L * .92, 6), V(s * L * .7, 9), V(s * L * .45, 12), V(s * L * .2, 11), V(0, 6)]
          : [V(0, -5), V(s * 9, -3), V(s * 12, L * .35), V(s * 8, L * .8), V(s * 2, L), V(-s * 4, L * .7), V(-s * 5, L * .3)];
        g.beginPath(); spline(g, pts); g.fillStyle = back ? shade(wingC, -.25) : soft(wingC, s * 8, 10, 30); g.fill();
        g.save(); g.clip();
        g.fillStyle = back ? shade(prim, -.25) : prim;
        if (flap > .5) { g.beginPath(); g.ellipse(s * L * .75, 5, L * .3, W * .55, 0, 0, Math.PI * 2); g.fill(); }
        else { g.beginPath(); g.ellipse(s * 5, L * .8, 10, L * .3, 0, 0, Math.PI * 2); g.fill(); }
        if (p.bars) { g.strokeStyle = p.bars; g.lineWidth = 1; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(s * 5, 4 + i * 6, 6, .3, Math.PI - .3); g.stroke(); } }
        if (p.patch) { g.fillStyle = p.patch; g.beginPath(); g.ellipse(s * 5, 8, 5, 8, 0, 0, Math.PI * 2); g.fill(); }
        g.restore();
        g.strokeStyle = outline; g.lineWidth = 1; g.beginPath(); spline(g, pts); g.stroke();
        g.restore();
      };
      if (flap > .5) wing(yaw >= 0 ? 1 : -1, true);
      // тело-яйцо
      fill(body, () => g.ellipse(bx, by, brx, bry, 0, 0, Math.PI * 2), soft(body, bx, by, bry));
      if (p.belly) { g.fillStyle = p.belly; g.beginPath(); g.ellipse(bx - yaw * 5, by + bry * .25, brx * .6, bry * .55, 0, 0, Math.PI * 2); g.fill(); }
      if (p.ring) { g.strokeStyle = p.ring; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.ellipse(bx - yaw * 3, by - bry * .5, brx * .72, 7, 0, .1, Math.PI - .1); g.stroke(); }
      furStrokes(ellipsePts(bx, by, brx, bry, 22).slice(2, 20), shade(body, -.2), 2.5, 5, 2);
      // крылья по бокам
      if (flap > .5) wing(yaw >= 0 ? -1 : 1, false);
      else { wing(-1, false); wing(1, false); }
      // голова
      const hr = 30 * (1 + (puff - 1) * .5), H = V(sx + yaw * 4, by - bry * .55 - hr * .55 + (o.headY || 0));
      g.save(); g.translate(H.x, H.y); g.rotate(rad(o.headTilt || 0));
      const fx = yaw * 8;
      if (p.crest) {                                        // хохолок кореллы
        g.strokeStyle = p.crest; g.lineCap = 'round';
        for (let i = 0; i < 4; i++) { const a = rad(-100 - i * 12 - (1 - (o.crest || 0)) * 40), L = (26 - i * 3) * (p.crestK || 1); g.lineWidth = (5 - i * .8) * (p.crestK || 1); g.beginPath(); g.moveTo(fx * .5 - 2 + i * 2, -hr * .8); g.quadraticCurveTo(fx * .5 + Math.cos(a) * L * .5, -hr * .8 + Math.sin(a) * L * .5 - 4, fx * .5 + Math.cos(a - .4) * L, -hr * .8 + Math.sin(a - .3) * L); g.stroke(); }
      }
      fill(p.head || body, () => g.ellipse(fx * .2, 0, hr, hr * .95, 0, 0, Math.PI * 2), soft(p.head || body, fx * .2, 0, hr));
      if (p.face) { g.fillStyle = p.face; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 14 + fx, 1, 11, 10, 0, 0, Math.PI * 2); g.fill(); } }
      if (p.cheek) { g.fillStyle = p.cheek; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 18 + fx, 10, p.kind === 'budgie' ? 3.5 : 6, p.kind === 'budgie' ? 4 : 5.5, 0, 0, Math.PI * 2); g.fill(); } }
      if (p.kind === 'budgie' || p.throat) { g.fillStyle = p.throat && p.throat !== true ? p.throat : '#1d1b1a'; for (const q of [[-8, 16], [0, 18], [8, 16]]) { g.beginPath(); g.arc(q[0] + fx, q[1], 1.6, 0, Math.PI * 2); g.fill(); } }
      birdEyes(g, o, fx, hr, p);
      // клюв
      const bk = p.beakK || 1, bx0 = fx * 1.1, by0 = 6;
      if (p.cere) { g.fillStyle = p.cere; g.beginPath(); g.ellipse(bx0, by0 - 3.5 * bk, 5.5 * bk, 3 * bk, 0, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = p.beakLo || p.beak; g.beginPath(); g.moveTo(bx0 - 5 * bk, by0 + 2 * bk); g.quadraticCurveTo(bx0, by0 + (7 + (o.mouth || 0) * 6) * bk, bx0 + 5 * bk, by0 + 2 * bk); g.closePath(); g.fill();
      g.fillStyle = p.beak; g.beginPath(); g.moveTo(bx0 - 7 * bk, by0 - 3 * bk); g.quadraticCurveTo(bx0, by0 - 6 * bk, bx0 + 7 * bk, by0 - 3 * bk);
      g.quadraticCurveTo(bx0 + 5 * bk, by0 + 5 * bk, bx0, by0 + 9 * bk); g.quadraticCurveTo(bx0 - 5 * bk, by0 + 5 * bk, bx0 - 7 * bk, by0 - 3 * bk); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = .8; g.stroke();
      drawHat(g, fx * .2 + 2, -hr * .9, (o.hat || p.hat), .9);
      g.restore();
      info.head = { x: H.x, y: H.y, r: hr }; info.top = { x: H.x, y: H.y - hr - (p.crest ? 22 * (p.crestK || 1) : 4) };
      info.bbox = { l: -brx - 34, t: H.y - hr - 24, r: brx + 34, b: 4 };
      g.restore();
      return info;
    }

    // ======================= ДОМОВЁНОК КУЗЯ =======================
    if (sp === 'kuzya') {
      const skin = p.skin || '#f6d3b0', shirt = p.fur, hair = p.hair || '#e8b84a', pants = p.pants || '#4a3a5a', belt = p.belt || '#e9c34a', lapti = p.lapti || '#c9a15a';
      const sitting = loaf || pose === 'loaf', crouch = pose === 'crouch', upP = up;
      const bK = p.bodyK || 1, bw = 24 * bK * puff, bh = sitting ? 30 : 40, by = sitting ? -18 : -24;   // низ тела у пола
      const hy = (sitting ? -62 : upP ? -84 : -78) + (o.headY || 0), hr = 40 * (p.headK || 1), hry = 36 * (p.headK || 1);
      // ноги в лаптях
      if (!sitting) for (const s of [-1, 1]) {
        const lift = (s < 0 ? o.pawL : o.pawR) || 0, lx = sx + s * 11, ly = -lift * 9;
        g.strokeStyle = pants; g.lineWidth = 11; g.lineCap = 'round'; g.beginPath(); g.moveTo(lx, by - 6); g.lineTo(lx, ly - 6); g.stroke();
        g.strokeStyle = '#f2e6cf'; g.lineWidth = 7; g.beginPath(); g.moveTo(lx, ly - 14); g.lineTo(lx, ly - 5); g.stroke();      // онучи
        fill(lapti, () => g.ellipse(lx + s * 2, ly - 2, 11, 5.5, 0, 0, Math.PI * 2), soft(lapti, lx, ly - 2, 10));
        g.strokeStyle = shade(lapti, -.3); g.lineWidth = .8; g.beginPath(); for (let i = -1; i <= 1; i++) { g.moveTo(lx - 6 + i * 4, ly - 6); g.lineTo(lx + 2 + i * 4, ly + 2); g.moveTo(lx + 6 + i * 4, ly - 6); g.lineTo(lx - 2 + i * 4, ly + 2); } g.stroke();
      } else for (const s of [-1, 1]) {                                   // сидит по-турецки
        fill(pants, () => g.ellipse(sx + s * 16, -6, 16, 8, s * .3, 0, Math.PI * 2), soft(pants, sx + s * 16, -6, 12));
        fill(lapti, () => g.ellipse(sx + s * 5, -3, 8, 5, 0, 0, Math.PI * 2));
      }
      // рубаха-косоворотка
      const bodyPts = [V(-bw * .8, -bh - 2), V(-bw, by - bh * .3), V(-bw * 1.05, by + 2), V(bw * 1.05, by + 2), V(bw, by - bh * .3), V(bw * .8, -bh - 2)].map(q => V(q.x + sx, q.y - (sitting ? 0 : 0)));
      const top = -bh - 2 + by + bh; // верх рубахи
      const shirtPath = () => { g.moveTo(sx - bw * .8, hy + hry * .75); g.quadraticCurveTo(sx - bw * 1.1, by - bh * .3, sx - bw * 1.05, by + 2); g.lineTo(sx + bw * 1.05, by + 2); g.quadraticCurveTo(sx + bw * 1.1, by - bh * .3, sx + bw * .8, hy + hry * .75); g.closePath(); };
      fill(shirt, shirtPath, soft(shirt, sx, (hy + by) / 2, bw * 1.4));
      g.save(); g.beginPath(); shirtPath(); g.clip();
      if (!p.dots) { g.strokeStyle = shade(shirt, .55); g.lineWidth = 2; g.beginPath(); g.moveTo(sx - 6 - yaw * 4, hy + hry * .75); g.lineTo(sx - 6 - yaw * 4, by - 4); g.stroke(); }   // застёжка сбоку
      if (p.dots) { g.fillStyle = p.dots === true ? '#ffffff' : p.dots; for (let i = 0; i < 16; i++) { g.beginPath(); g.arc(sx + (hash(i * 3 + 1) - .5) * bw * 2.2, hy + hry * .75 + 4 + hash(i * 5 + 2) * (by - hy - hry * .75 - 8), 2.2, 0, Math.PI * 2); g.fill(); } }
      g.fillStyle = '#f4efe4'; g.beginPath(); g.arc(sx + 2 - yaw * 4, hy + hry * .75 + 18, 3.2, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = .8; g.stroke();   // пуговка
      if (p.pattern === 'stripe') { g.strokeStyle = shade(shirt, -.25); g.lineWidth = 2; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(sx + i * 9, hy); g.lineTo(sx + i * 9, by + 2); g.stroke(); } }
      g.strokeStyle = belt; g.lineWidth = 4; g.beginPath(); g.moveTo(sx - bw * 1.1, by - 8); g.lineTo(sx + bw * 1.1, by - 8); g.stroke();                       // поясок
      g.fillStyle = belt; g.beginPath(); g.moveTo(sx + 8, by - 8); g.lineTo(sx + 5, by + 6); g.lineTo(sx + 11, by + 6); g.closePath(); g.fill();
      if (p.heart) { g.fillStyle = p.heart; const hx_ = sx + 12, hy_ = hy + hry * .75 + 16; g.beginPath(); g.moveTo(hx_, hy_ + 6); g.bezierCurveTo(hx_ - 8, hy_ - 2, hx_ - 4, hy_ - 9, hx_, hy_ - 4); g.bezierCurveTo(hx_ + 4, hy_ - 9, hx_ + 8, hy_ - 2, hx_, hy_ + 6); g.fill(); }
      g.restore();
      // руки
      for (const [s, arm] of [[-1, o.armL || 0], [1, o.armR || 0]]) {
        const ax = sx + s * bw * .95, ay = hy + hry * .75 + 8, ex = ax + s * (arm > .05 ? lerp(12, 4, arm) : 8) - yaw * 3, ey = arm > .05 ? lerp(ay + 24, hy + hry * .3, arm) : ay + 26;
        g.strokeStyle = shirt; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(ax, ay); g.lineTo(ex, ey); g.stroke();
        g.strokeStyle = shade(shirt, -.2); g.lineWidth = 1; g.beginPath(); g.moveTo(ax, ay); g.lineTo(ex, ey); g.stroke();
        fill(skin, () => g.arc(ex, ey + 2, 5.5, 0, Math.PI * 2), soft(skin, ex, ey, 6));
      }
      if (o.chest) {                                                   // сундучок со сказками
        const cx_ = sx + 26 * (yaw < 0 ? -1 : 1), cy_ = -4, cw = 16, ch = 11, wood = p.chestC || '#8a5a2a';
        fill(wood, () => { g.rect(cx_ - cw, cy_ - ch, cw * 2, ch); }, soft(wood, cx_, cy_, cw));
        fill(shade(wood, -.15), () => { g.moveTo(cx_ - cw, cy_ - ch); g.quadraticCurveTo(cx_, cy_ - ch - 12 - (o.chest > 1 ? 6 : 0), cx_ + cw, cy_ - ch); g.closePath(); });
        g.strokeStyle = '#e9c34a'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx_ - cw + 5, cy_ - ch); g.lineTo(cx_ - cw + 5, cy_); g.moveTo(cx_ + cw - 5, cy_ - ch); g.lineTo(cx_ + cw - 5, cy_); g.stroke();
        g.fillStyle = '#e9c34a'; g.beginPath(); g.arc(cx_, cy_ - ch + 1, 2.5, 0, Math.PI * 2); g.fill();
        if (o.chest > 1) { g.fillStyle = 'rgba(255,230,120,.8)'; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * .4 + Math.sin(t * 5 + i) * .1; g.beginPath(); g.arc(cx_ + Math.cos(a) * (14 + i % 2 * 5), cy_ - ch - 2 + Math.sin(a) * 14, 1.8, 0, Math.PI * 2); g.fill(); } }
      }
      if (o.broom) {                                                   // веник
        const bx_ = sx + (yaw < 0 ? -1 : 1) * 30, ang = Math.sin(t * 9) * .35;
        g.save(); g.translate(bx_, -2); g.rotate(ang);
        g.strokeStyle = '#a6743a'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -46); g.lineTo(0, -8); g.stroke();
        g.fillStyle = '#d9b55a'; g.beginPath(); g.moveTo(-3, -12); g.lineTo(-13, 4); g.lineTo(13, 4); g.lineTo(3, -12); g.closePath(); g.fill();
        g.strokeStyle = '#b8903a'; g.lineWidth = 1; for (let i = -4; i <= 4; i++) { g.beginPath(); g.moveTo(i * .6, -10); g.lineTo(i * 2.8, 4); g.stroke(); }
        g.restore();
      }
      // голова: круглое пухлое лицо, сверху — копна соломы, нависающая на глаза
      const H = V(sx + yaw * 4, hy);
      g.save(); g.translate(H.x, H.y); g.rotate(rad(o.headTilt || 0));
      const fx = yaw * 9, hk = (p.hairK || 1);
      fill(skin, () => g.ellipse(fx * .15, 4, hr, hry, 0, 0, Math.PI * 2), soft(skin, fx * .15, 2, hr));
      g.fillStyle = 'rgba(255,120,140,.3)'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 26 + fx, 18, 8, 5, 0, 0, Math.PI * 2); g.fill(); }
      animalEyes(g, Object.assign({}, o, { look: o.look }), fx, 'kuzya', Object.assign({}, p, { eyeK: (p.eyeK || 1) * .95 }), 8);
      const nx = fx * 1.15, ny = 20;
      g.fillStyle = p.nose || '#5a3020'; g.beginPath(); g.ellipse(nx, ny, 4.5, 4, 0, 0, Math.PI * 2); g.fill();          // нос-пуговка
      g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(nx - 1.5, ny - 1.5, 1.3, 0, Math.PI * 2); g.fill();
      const mouth = o.mouth || 0; g.strokeStyle = line; g.lineWidth = 1.5;
      if (mouth > .15) { g.fillStyle = '#5a1f28'; g.beginPath(); g.ellipse(nx, ny + 9 + mouth * 2, 3 + mouth * 4, 2 + mouth * 4, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
      else { const sm = (o.happy || 0) > .3 || p.smile ? 1 : 0; g.beginPath(); g.moveTo(nx - 6, ny + 8 - sm * 1.5); g.quadraticCurveTo(nx, ny + 10 + sm * 4, nx + 6, ny + 8 - sm * 1.5); g.stroke(); }
      if ((o.tongue || 0) > .05) { g.fillStyle = '#ef7f90'; g.beginPath(); g.ellipse(nx, ny + 11, 3, 3 + (o.tongue || 0) * 3, 0, 0, Math.PI * 2); g.fill(); }
      if (p.freckles !== false) { g.fillStyle = 'rgba(150,90,60,.45)'; for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(s * (14 + hash(i * 3) * 10) + fx, 22 + hash(i * 7) * 6, 1, 0, Math.PI * 2); g.fill(); } }
      if (p.beard) { const bd = fluffRing(fx * .15, hry * .7, hr * .9, hry * .6, Math.PI * .05, Math.PI * .95, 14, .3, 55); g.beginPath(); g.moveTo(fx * .15 - hr * .9, hry * .7); spline(g, [V(fx * .15 + hr * .9, hry * .65), ...bd, V(fx * .15 - hr * .9, hry * .65)], false); g.closePath(); g.fillStyle = p.beard; g.fill(); }
      // копна: большой лохматый купол, свисающий прядями на лоб до бровей
      const hx0 = fx * .1, hy0 = -hry * .35, HR = hr * 1.42 * hk, HRY = hry * 1.05 * hk;
      const dome = fluffRing(hx0, hy0, HR, HRY, Math.PI * 1.0, Math.PI * 2.0, 22, .18, 77);
      const fringe = [];                                                     // нижний край — неровные пряди
      for (let i = 0; i <= 18; i++) { const k = i / 18, px = hx0 + HR * (1 - 2 * k), dip = (hash(i * 5 + 3) * 14 + (Math.abs(1 - 2 * k) < .7 ? 8 : 0)) ; fringe.push(V(px, hy0 + HRY * .12 + dip - Math.abs(1 - 2 * k) * 6)); }
      const hairPath = () => spline(g, [...dome, ...fringe]);
      g.beginPath(); hairPath(); g.fillStyle = soft(hair, hx0, hy0 - HRY * .3, HR); g.fill(); g.strokeStyle = outline; g.lineWidth = 1; g.stroke();
      g.save(); g.beginPath(); hairPath(); g.clip();                           // пряди-соломинки
      for (let i = 0; i < 46; i++) { const h1 = hash(i * 7 + 1), h2 = hash(i * 11 + 4); const px = hx0 + (h1 - .5) * HR * 1.9, py0 = hy0 - HRY * (.2 + h2 * .7);
        g.strokeStyle = i % 3 ? shade(hair, -.22) : shade(hair, .3); g.lineWidth = 1 + h2; g.beginPath(); g.moveTo(px, py0); g.quadraticCurveTo(px + (h2 - .5) * 10, py0 + HRY * .5, px + (h1 - .5) * 16, hy0 + HRY * .3 + h1 * 14); g.stroke(); }
      g.restore();
      for (let i = 0; i < 12; i++) { const h1 = hash(i * 9 + 2); const px = hx0 + (h1 - .5) * HR * 1.7, py0 = hy0 + HRY * .1;   // торчащие соломинки по краю
        g.strokeStyle = shade(hair, -.15); g.lineWidth = 1.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(px, py0); g.lineTo(px + (h1 - .5) * 12, py0 + 12 + hash(i) * 10); g.stroke(); }
      if (p.cap) { g.fillStyle = p.cap; g.beginPath(); g.ellipse(hx0, hy0 - HRY * .9, HR * .8, 9, 0, Math.PI, Math.PI * 2); g.fill(); g.fillRect(hx0 - HR * .8, hy0 - HRY * .9 - 1, HR * 1.6, 6); }
      drawHat(g, fx * .15 + 2, -hry * 1.35, (o.hat || p.hat), 1);
      g.restore();
      info.head = { x: H.x, y: H.y, r: hr }; info.top = { x: H.x, y: H.y - hry * 1.45 };
      info.bbox = { l: -hr * 1.2 - 20, t: info.top.y - 6, r: hr * 1.2 + 20, b: 4 };
      g.restore();
      return info;
    }

    // ======================= СКРЕПКА =======================
    if (sp === 'clippy') {
      const metal = p.fur, hi = shade(metal, .5), lo = shade(metal, -.35), H_ = 120;
      const kS = pose === 'crouch' ? .8 : hang ? 1.1 : 1, wob = Math.sin(t * 2.2) * 2;
      const shape = o.shape || '';
      g.save(); g.translate(sx, 0); g.scale(1, kS); g.translate(0, o.headY || 0);
      const wire = (path, w = 7) => {
        g.lineCap = g.lineJoin = 'round';
        g.strokeStyle = lo; g.lineWidth = w + 2.5; g.beginPath(); path(); g.stroke();
        g.strokeStyle = metal; g.lineWidth = w; g.beginPath(); path(); g.stroke();
        g.strokeStyle = hi; g.lineWidth = w * .3; g.beginPath(); path(); g.stroke();
      };
      const lean = rad((o.tilt || 0) * 0 + (o.headTilt || 0) * .5);
      g.rotate(lean);
      const yawK = 1 - Math.abs(yaw) * .25;
      if (shape === 'heart') {
        wire(() => { g.moveTo(0, -20); g.bezierCurveTo(-44 * yawK, -60, -70 * yawK, -95, 0, -128); g.moveTo(0, -20); g.bezierCurveTo(44 * yawK, -60, 70 * yawK, -95, 0, -128); }, 7);
      } else if (shape === 'question') {
        wire(() => { g.moveTo(0, -12); g.lineTo(0, -40); g.bezierCurveTo(0, -60, 34 * yawK, -60, 34 * yawK, -88); g.bezierCurveTo(34 * yawK, -120, -30 * yawK, -122, -30 * yawK, -95); }, 7);
        g.fillStyle = metal; g.beginPath(); g.arc(0, -2, 6, 0, Math.PI * 2); g.fill();
      } else if (shape === 'spiral') {
        wire(() => { for (let a = 0; a < Math.PI * 6; a += .15) { const r = 4 + a * 7; const px = Math.cos(a) * r * yawK, py = -70 + Math.sin(a) * r * .8; a === 0 ? g.moveTo(px, py) : g.lineTo(px, py); } }, 6);
      } else {                                                          // классическая скрепка
        const w = 22 * yawK, r = 18;
        const path = () => {
          g.moveTo(-w * .55, -18); g.lineTo(-w * .55, -H_ + r + 8);
          g.arc(0, -H_ + r + 8, w * .55, Math.PI, 0);                       // верхняя малая дуга
          g.lineTo(w * .55, -40); g.arc(w * .05, -40, w * .5, 0, Math.PI);   // нижняя внутренняя
          g.lineTo(-w * .95, -H_ + r);
          g.arc(0, -H_ + r, w * .95, Math.PI, 0);                            // верхняя внешняя
          g.lineTo(w * .95, -22); g.arc(0, -22, w * .95, 0, Math.PI);        // нижняя внешняя
        };
        wire(path, 7);
      }
      // глаза — большие, на верхней дуге
      const ey = shape === 'heart' ? -90 : shape === 'question' ? -95 : shape === 'spiral' ? -70 : -95, ex0 = shape === 'question' ? 4 : 0;
      const happy = clamp(o.happy || 0, 0, 1), open = clamp((o.eye === undefined ? 1 : o.eye) * (1 - happy), 0, 1);
      const lx = clamp(o.look ? o.look.x : 0, -1, 1) * 4 + yaw * 5, ly = clamp(o.look ? o.look.y : 0, -1, 1) * 4;
      for (const s of [-1, 1]) {
        const ex = ex0 + s * 16 * yawK + yaw * 6, rr = 13 * (p.eyeK || 1);
        g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(ex, ey, rr, rr * 1.15, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#1f1f24'; g.lineWidth = 2.6; g.stroke();
        if (open > .12) { g.save(); g.beginPath(); g.ellipse(ex, ey, rr, rr * 1.15, 0, 0, Math.PI * 2); g.clip();
          if (p.iris) { g.fillStyle = p.iris; g.beginPath(); g.arc(ex + lx, ey + ly, rr * .62, 0, Math.PI * 2); g.fill(); }
          g.fillStyle = '#111'; g.beginPath(); g.arc(ex + lx, ey + ly, rr * .42, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + lx - 3, ey + ly - 4, 2.5, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#fff'; g.fillRect(ex - rr - 2, ey - rr * 1.3, rr * 2 + 4, rr * 2.3 * (1 - open)); g.restore(); }
        else { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ex, ey, rr, rr * 1.15, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#1f1f24'; g.lineWidth = 2.6; g.stroke(); g.beginPath(); if (happy > .5) { g.moveTo(ex - 8, ey + 2); g.quadraticCurveTo(ex, ey - 7, ex + 8, ey + 2); } else { g.moveTo(ex - 8, ey); g.lineTo(ex + 8, ey); } g.stroke(); }
        // бровь: наклон = ear (-1 удивление вверх, +1 сердито)
        const br = (o.ear || 0), by_ = ey - rr * 1.15 - 7 - Math.max(0, -br) * 4, bt = s * (.25 - br * .7);
        g.strokeStyle = '#1f1f24'; g.lineWidth = 4.5 * (p.browK || 1); g.lineCap = 'round'; g.beginPath(); g.moveTo(ex - 10, by_ + Math.sin(bt) * -8); g.lineTo(ex + 10, by_ + Math.sin(bt) * 8); g.stroke();
      }
      if (p.bow) { g.fillStyle = p.bow; for (const s_ of [-1, 1]) { g.beginPath(); g.moveTo(0, -H_ + 8); g.quadraticCurveTo(s_ * 14, -H_ - 6, s_ * 16, -H_ + 8); g.quadraticCurveTo(s_ * 12, -H_ + 16, 0, -H_ + 8); g.fill(); } }
      if (p.glasses) { g.strokeStyle = '#2a2a30'; g.lineWidth = 2.2; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(ex0 + s * 16 * yawK + yaw * 6, ey, 16, 17, 0, 0, Math.PI * 2); g.stroke(); } g.beginPath(); g.moveTo(-2, ey); g.lineTo(2, ey); g.stroke(); }
      if (o.paper) {                                                    // листок бумаги в «руке»
        g.save(); g.translate(30, -50); g.rotate(rad(-10 + Math.sin(t * 3) * 3)); g.fillStyle = '#fffdf5'; g.strokeStyle = '#b8b3a5'; g.lineWidth = 1; g.beginPath(); g.rect(-12, -16, 24, 30); g.fill(); g.stroke();
        g.strokeStyle = '#8a8a90'; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-8, -10 + i * 6); g.lineTo(8 - (i === 3 ? 6 : 0), -10 + i * 6); g.stroke(); } g.restore();
      }
      drawHat(g, 0, -H_ - 2, (o.hat || p.hat), .9);
      g.restore();
      info.head = { x: sx, y: (ey + (o.headY || 0)) * kS, r: 30 }; info.top = { x: sx, y: -128 * kS };
      info.bbox = { l: -60, t: -150, r: 60, b: 4 };
      g.restore();
      return info;
    }

    // ======================= ЗВЕРИ =======================
    // размеры по видам
    const D = CAT ? { hr: 40, hry: 33, hy: -88, bw: 36, bh: 62, earH: p.sphynx ? 38 : 30 }
      : DOG ? { hr: 40, hry: 34, hy: -86, bw: 37, bh: 60, earH: p.bigEars ? 38 : 26 }
      : DRAGON ? { hr: 40, hry: 34, hy: -88, bw: 38, bh: 62, earH: 0 }
      : HAM ? { hr: 36, hry: 31, hy: -66, bw: 42, bh: 48, earH: 0 }
      : { hr: 38, hry: 32, hy: -82, bw: 36, bh: 58, earH: 38 };            // кролик
    if (p.longBody) { D.bw *= 1.3; D.bh *= .9; }
    if (p.bodyK) { D.bw *= p.bodyK; }
    const earK = p.earK || 1, eyeK = p.eyeK || 1, tailK = p.tailK || 1;
    if (RAB) D.earH *= earK;
    if (p.round) { D.hr *= 1.04; D.hry *= 1.06; }
    const noFur = !!p.sphynx;
    const hy = D.hy + (loaf ? 30 : up ? -14 : 0) + (o.headY || 0);
    // ---------- хвост ----------
    const side = yaw > .15 ? -1 : 1, wag = rad(o.tail || 0), wagS = Math.sin(t * (DOG ? 9 : 2.5)) * wag;
    const spike = (x0, y0, dx, dy, n, len, col) => {           // ряд шипов вдоль отрезка
      g.fillStyle = col; const L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      for (let i = 0; i < n; i++) { const k = (i + .5) / n, px = x0 + dx * k, py = y0 + dy * k, w = len * .45; g.beginPath(); g.moveTo(px - dx / L * w, py - dy / L * w); g.lineTo(px + nx * len, py + ny * len); g.lineTo(px + dx / L * w, py + dy / L * w); g.closePath(); g.fill(); }
    };
    if (DRAGON) {                                       // толстый хвост с «пикой» на конце
      const tK = tailK, bx = sx + side * (loaf ? 30 : 24), by = loaf ? -6 : -10;
      const c1 = V(bx + side * 30, by + 6), c2 = V(bx + side * (60 + Math.sin(wagS) * 6) * tK, by - (10 + (o.tailUp || 0) * 30) * tK), tip = V(bx + side * (52 + Math.sin(wagS) * 10) * tK, by - (44 + (o.tailUp || 0) * 20) * tK);
      const tailPath = () => { g.moveTo(bx, by); g.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, tip.x, tip.y); };
      g.strokeStyle = shade(p.tail || fur, -.25); g.lineWidth = 15 * puff; g.beginPath(); tailPath(); g.stroke();
      g.strokeStyle = p.tail || fur; g.lineWidth = 12 * puff; g.beginPath(); tailPath(); g.stroke();
      if (p.spikes) spike(c1.x, c1.y - 5, c2.x - c1.x, c2.y - c1.y - 6, 3, 7, p.spikes);
      const ta = Math.atan2(tip.y - c2.y, tip.x - c2.x);                       // пика
      g.save(); g.translate(tip.x, tip.y); g.rotate(ta); g.fillStyle = p.tailTip || p.spikes || shade(fur, -.4);
      g.beginPath(); g.moveTo(14, 0); g.quadraticCurveTo(2, -4, -6, -11); g.quadraticCurveTo(-1, -3, -3, 0); g.quadraticCurveTo(-1, 3, -6, 11); g.quadraticCurveTo(2, 4, 14, 0); g.fill(); g.restore();
    } else if (CAT) {
      const bx = sx + side * (loaf ? 30 : 26), by = -8;
      const tailPath = () => {
        if (loaf) { g.moveTo(bx, by); g.bezierCurveTo(bx + side * 20, by + 8, bx - side * 10, by + 16, bx - side * 46, by + 4); return; }
        const c2 = V(bx + side * (32 + Math.sin(wagS) * 8) * tailK, by - (28 + (o.tailUp || 0) * 10) * tailK), tip = V(bx + side * (18 + Math.sin(wagS) * 16) * tailK, by - (48 + (o.tailUp || 0) * 14) * tailK);
        g.moveTo(bx, by); g.bezierCurveTo(bx + side * 22, by + 4, c2.x, c2.y, tip.x, tip.y);
      };
      const tw = (p.fluffyTail ? 13 : p.sphynx ? 6 : 10) * puff * (.7 + tailK * .3);
      g.save(); g.filter = 'blur(1.2px)'; g.beginPath(); tailPath(); g.strokeStyle = p.tail || fur; g.lineWidth = tw + 3; g.stroke(); g.restore();
      g.beginPath(); tailPath(); g.strokeStyle = p.tail || fur; g.lineWidth = tw; g.stroke();
      if (p.stripe) { g.save(); g.beginPath(); tailPath(); g.setLineDash([4, 5]); g.strokeStyle = p.stripe; g.lineWidth = tw - 1; g.stroke(); g.restore(); }
      if (p.bands) { g.save(); g.beginPath(); tailPath(); g.setLineDash([9, 9]); g.strokeStyle = p.bands; g.lineWidth = tw; g.stroke(); g.restore(); }
      if (p.tailTip) { g.save(); g.beginPath(); tailPath(); g.setLineDash([0, 44, 14, 100]); g.strokeStyle = p.tailTip; g.lineWidth = tw; g.stroke(); g.restore(); }
    } else if (DOG && p.curlTail) {                      // хвост колечком над спиной
      const bx = sx + side * (p.fluffy ? 38 : 22), by = loaf ? -40 : (p.fluffy ? -46 : -58);
      const tw_ = (p.fluffy ? 13 : 8) * puff * (.8 + tailK * .2), tr_ = (p.fluffy ? 12 : 9) * tailK;
      if (p.fluffy) { g.save(); g.filter = 'blur(2px)'; g.strokeStyle = p.tail || fur; g.lineWidth = tw_ + 6; g.beginPath(); g.arc(bx, by, tr_, Math.PI * .5 + side * .3, Math.PI * .5 + side * .3 + side * Math.PI * 1.6, side < 0); g.stroke(); g.restore(); }
      g.strokeStyle = p.tail || fur; g.lineWidth = tw_; g.lineCap = 'round';
      g.beginPath(); g.arc(bx, by, tr_, Math.PI * .5 + side * .3, Math.PI * .5 + side * .3 + side * Math.PI * 1.6, side < 0); g.stroke();
      g.fillStyle = p.chest || fur; g.beginPath(); g.arc(bx + side * 5, by - 7, 3.5, 0, Math.PI * 2); g.fill();
    } else if (DOG) {
      const bx = sx + side * 24, by = loaf ? -14 : -22;
      g.strokeStyle = p.tail || fur; g.lineWidth = 9 * puff;
      g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + side * (16 + Math.sin(wagS) * 6) * tailK, by - 6 * tailK, bx + side * (14 + Math.sin(wagS) * 14) * tailK, by - (26 - Math.cos(wagS) * 3) * tailK); g.stroke();
      if (p.tailTip) { g.strokeStyle = p.tailTip; g.beginPath(); g.moveTo(bx + side * (15 + Math.sin(wagS) * 11), by - 19); g.lineTo(bx + side * (14 + Math.sin(wagS) * 14), by - 26 + Math.cos(wagS) * 3); g.stroke(); }
    } else if (RAB) {
      const bx = sx + side * 30, by = loaf ? -12 : -14;
      g.save(); g.filter = 'blur(1px)'; g.fillStyle = p.tailC || '#fff'; g.beginPath(); g.arc(bx, by, 10.5 * puff, 0, Math.PI * 2); g.fill(); g.restore();
      g.fillStyle = p.tailC || '#fff'; g.beginPath(); g.arc(bx, by, 9 * puff * tailK, 0, Math.PI * 2); g.fill();
    }
    // ---------- крылья дракона (за телом) ----------
    if (DRAGON && !hang && !p.noWings) {
      const spread = clamp(o.wing || 0, 0, 1), wK = p.wingK || 1, wA = o.wingA || 0;
      for (const s of [-1, 1]) {
        const shx = sx + s * D.bw * .55, shy = loaf ? -D.bh * .5 : -D.bh * .8;
        g.save(); g.translate(shx, shy);
        const base = spread > .5 ? -35 + wA * .6 : 18 - (o.ear || 0) * 8;
        g.rotate(s * rad(base));
        const L = (spread > .5 ? 58 : 34) * wK, H_ = (spread > .5 ? 34 : 22) * wK;
        const f1 = V(s * L, -H_ * .9), f2 = V(s * L * .95, -H_ * .1), f3 = V(s * L * .7, H_ * .6), root = V(0, 0), arm = V(s * L * .45, -H_ * .95);
        g.fillStyle = p.wing || shade(fur, -.3); g.beginPath(); g.moveTo(root.x, root.y); g.lineTo(arm.x, arm.y); g.lineTo(f1.x, f1.y);
        g.quadraticCurveTo(s * L * .8, -H_ * .35, f2.x, f2.y); g.quadraticCurveTo(s * L * .7, H_ * .3, f3.x, f3.y); g.quadraticCurveTo(s * L * .3, H_ * .3, root.x, root.y + 6); g.closePath(); g.fill();
        g.strokeStyle = shade(p.wingBone || fur, -.15); g.lineWidth = 3.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(root.x, root.y); g.lineTo(arm.x, arm.y);
        for (const f of [f1, f2, f3]) { g.moveTo(arm.x, arm.y); g.lineTo(f.x, f.y); } g.stroke();
        g.strokeStyle = outline; g.lineWidth = 1; g.beginPath(); g.moveTo(arm.x, arm.y); g.lineTo(f1.x, f1.y); g.quadraticCurveTo(s * L * .8, -H_ * .35, f2.x, f2.y); g.quadraticCurveTo(s * L * .7, H_ * .3, f3.x, f3.y); g.stroke();
        g.restore();
      }
    }
    // ---------- тело ----------
    let bodyPts;
    if (loaf) {
      const w = D.bw + 16, h = D.bh * .72;
      bodyPts = [V(-w, -6), V(-w * .92, -h * .6), V(-w * .45, -h), V(w * .45, -h), V(w * .92, -h * .6), V(w, -6), V(w * .6, 1), V(-w * .6, 1)].map(q => V(q.x + sx, q.y));
      fill(fur, () => spline(g, bodyPts), soft(fur, sx, -h / 2, w));
      furStrokes(bodyPts.slice(0, 6), shade(fur, -.2), 4, 3);
      if (DRAGON && (o.glow || 0) > .02) { g.save(); g.beginPath(); spline(g, bodyPts); g.clip(); const gr = g.createRadialGradient(sx, -h * .4, 2, sx, -h * .4, w * .9); gr.addColorStop(0, `rgba(255,170,60,${.7 * o.glow})`); gr.addColorStop(1, 'rgba(255,120,30,0)'); g.fillStyle = gr; g.fillRect(sx - w * 1.2, -h * 1.2, w * 2.4, h * 1.4); g.restore(); }
      if (p.bands) { g.save(); g.beginPath(); spline(g, bodyPts); g.clip(); g.fillStyle = p.bands; for (const q of [.75, .35]) g.fillRect(sx - w * 1.3, -h * q - h * .09, w * 2.6, h * .18); g.restore(); }
    } else {
      const w = D.bw * (up ? .82 : 1) * puff, h = D.bh * (up ? 1.25 : 1) * (hang ? 1.08 : 1);
      // задние ноги (бёдра по бокам) и ступни
      if (!up || RAB || HAM) for (const s of [-1, 1]) {
        const lift = hang ? .5 : 0;
        fill(fur, () => g.ellipse(sx + s * (w * .75), -15 - (up ? 4 : 0), 13 * puff, 15, s * .2, 0, Math.PI * 2), soft(fur, sx + s * w * .75, -15, 15));
        const hp = (s < 0 ? p.pawHL : p.pawHR) || paws;
        if (RAB) fill(hp, () => g.ellipse(sx + s * (w * .9), -3.5 + lift * 4, 16, 6.5, s * .12, 0, Math.PI * 2), soft(hp, sx + s * w * .9, -4, 12, .6));
        else fill(hp, () => g.ellipse(sx + s * (w * .92), -3.5 + lift * 4, HAM ? 6 : 8.5, HAM ? 3.6 : 4.6, s * .25, 0, Math.PI * 2));
      }
      bodyPts = [V(-w * .47, -h), V(-w * .8, -h * .72), V(-w, -h * .35), V(-w * .86, -h * .08), V(-w * .4, 1), V(w * .4, 1), V(w * .86, -h * .08), V(w, -h * .35), V(w * .8, -h * .72), V(w * .47, -h)].map(q => V(q.x + sx, q.y));
      halo(() => spline(g, bodyPts), fur, 12);
      fill(fur, () => spline(g, bodyPts), soft(fur, sx, -h / 2, w));
      furStrokes(bodyPts.slice(1, 4).concat(bodyPts.slice(6, 9)), shade(fur, -.18), 4, 7);
      if (p.bands) { g.save(); g.beginPath(); spline(g, bodyPts); g.clip(); g.fillStyle = p.bands; for (const q of [.82, .52, .22]) g.fillRect(sx - w * 1.3, -h * q - h * .07, w * 2.6, h * .14); g.restore(); }
      if (p.patches === 'dutch') { g.save(); g.beginPath(); spline(g, bodyPts); g.clip(); g.fillStyle = p.black; g.beginPath(); g.ellipse(sx, -h * .2, w * 1.2, h * .42, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
      if (p.patches === 'panda') { g.save(); g.beginPath(); spline(g, bodyPts); g.clip(); g.fillStyle = p.black; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(sx + s * w * .8, -h * .45, w * .45, h * .3, 0, 0, Math.PI * 2); g.fill(); } g.restore(); }
      if (p.patches === 'spots') { const n = p.spotN !== undefined ? p.spotN : 9, sk = p.spotK || 1; g.save(); g.beginPath(); spline(g, bodyPts); g.clip(); g.fillStyle = p.black; for (let i = 0; i < n; i++) { g.beginPath(); g.ellipse(sx + (hash(i * 3) - .5) * w * 1.7, -h * (.15 + hash(i * 5) * .8), (2.5 + hash(i) * 3) * sk, (2 + hash(i + 9) * 3) * sk, hash(i * 11) * 3, 0, Math.PI * 2); g.fill(); } g.restore(); }
      if (p.heart) { g.save(); g.beginPath(); spline(g, bodyPts); g.clip(); g.fillStyle = p.heart; const hx_ = sx + w * .55, hy_ = -h * .45; g.beginPath(); g.moveTo(hx_, hy_ + 7); g.bezierCurveTo(hx_ - 10, hy_ - 2, hx_ - 5, hy_ - 10, hx_, hy_ - 4); g.bezierCurveTo(hx_ + 5, hy_ - 10, hx_ + 10, hy_ - 2, hx_, hy_ + 7); g.fill(); g.restore(); }
      if (p.patches === 'rosettes') { g.save(); g.beginPath(); spline(g, bodyPts); g.clip();
        for (let i = 0; i < 9; i++) { const rx_ = sx + (hash(i * 3) - .5) * w * 1.7, ry_ = -h * (.15 + hash(i * 5) * .75), rr = 3 + hash(i) * 2.5;
          g.strokeStyle = p.black; g.lineWidth = 1.8; g.beginPath(); g.ellipse(rx_, ry_, rr, rr * .8, hash(i * 7) * 3, 0, Math.PI * 2); g.stroke();
          g.fillStyle = shade(fur, -.15); g.beginPath(); g.ellipse(rx_, ry_, rr * .55, rr * .45, 0, 0, Math.PI * 2); g.fill(); }
        g.restore(); }
      if (p.patches === 'saddle') { g.save(); g.beginPath(); spline(g, bodyPts); g.clip(); g.fillStyle = p.black; g.beginPath(); g.ellipse(sx, -h * .72, w * .95, h * .34, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
      if (p.patches === 'beagle') { g.save(); g.beginPath(); spline(g, bodyPts); g.clip(); g.fillStyle = p.black; g.beginPath(); g.ellipse(sx, -h * .75, w * .7, h * .28, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
      // передние лапы
      for (const [s, lift, arm] of [[-1, o.pawL || 0, o.armL || 0], [1, o.pawR || 0, o.armR || 0]]) {
        const ax = sx - yaw * 5 + s * (HAM ? 8 : 10) * puff;
        if (arm > .05 || HAM || up) {                          // лапка поднята к морде / держит еду
          const k = HAM || up ? Math.max(arm, .55) : arm;
          const ex = sx - yaw * 4 + s * lerp(10, 8, k), ey = lerp(-4, hy + D.hry * .55 + 4, k);
          g.strokeStyle = fur; g.lineWidth = 11 * puff; g.beginPath(); g.moveTo(ax, -h * .55); g.lineTo(ex, ey); g.stroke();
          fill((s < 0 ? p.pawFL : p.pawFR) || paws, () => g.ellipse(ex, ey, HAM ? 6 : 8, HAM ? 4.5 : 6, 0, 0, Math.PI * 2));
        } else {
          const py = -4 - lift * 8;
          g.fillStyle = fur; g.beginPath(); g.moveTo(ax - 6.5, -h * .6); g.lineTo(ax - 6.5, py); g.lineTo(ax + 6.5, py); g.lineTo(ax + 6.5, -h * .6); g.fill();
          fill((s < 0 ? p.pawFL : p.pawFR) || paws, () => g.ellipse(ax, py, 9 * puff, 6.5, 0, 0, Math.PI * 2));
          g.strokeStyle = shade(paws, -.3); g.lineWidth = .9; g.beginPath(); g.moveTo(ax - 3, py + 2); g.lineTo(ax - 3, py + 5); g.moveTo(ax + 3, py + 2); g.lineTo(ax + 3, py + 5); g.stroke();
        }
      }
      // грудка
      if (p.sphynx) { g.fillStyle = chest; g.beginPath(); g.ellipse(sx - yaw * 4, -h * .45, 18, h * .42, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(90,60,50,.3)'; g.lineWidth = 1.2; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(sx - 12, -h * .88 + i * 5); g.quadraticCurveTo(sx, -h * .84 + i * 5, sx + 12, -h * .88 + i * 5); g.stroke(); } }
      else if (DRAGON) {                                  // пластины на животе и шипы по спине
        const cx0 = sx - yaw * 4, bw_ = w * .5, bh_ = h * .42, cy0 = -h * .4;
        g.save(); g.beginPath(); g.ellipse(cx0, cy0, bw_, bh_, 0, 0, Math.PI * 2); g.clip();
        g.fillStyle = chest; g.fillRect(cx0 - bw_, cy0 - bh_, bw_ * 2, bh_ * 2);
        g.strokeStyle = shade(chest, -.18); g.lineWidth = 1.2; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(cx0 - bw_, cy0 + i * bh_ / 3.5); g.quadraticCurveTo(cx0, cy0 + i * bh_ / 3.5 + 4, cx0 + bw_, cy0 + i * bh_ / 3.5); g.stroke(); }
        if ((o.glow || 0) > .02) { const gr = g.createRadialGradient(cx0, cy0, 2, cx0, cy0, bw_ * 1.1); gr.addColorStop(0, `rgba(255,170,60,${.85 * o.glow})`); gr.addColorStop(1, 'rgba(255,120,30,0)'); g.fillStyle = gr; g.fillRect(cx0 - bw_, cy0 - bh_, bw_ * 2, bh_ * 2); }
        g.restore();
        if (p.spikes) { const sd = yaw > .15 ? -1 : 1; spike(sx + sd * w * .2, -h * .98, sd * w * .55, h * .3, 3, 8, p.spikes); }
      }
      else if (p.chest && !HAM) {
        const cx0 = sx - yaw * 4, top = -h * .93;
        const bw_ = p.fluffy ? 22 : 16;
        const bib = [V(cx0 - bw_, top), ...fluffRing(cx0, top, bw_, 7, Math.PI, Math.PI * 2, 12, .4, 21), V(cx0 + bw_, top), ...fluffRing(cx0, top + 18, bw_ + 3, 22, -Math.PI * .1, Math.PI * 1.1, 14, .1, 61)];
        g.beginPath(); spline(g, bib); g.fillStyle = chest; g.fill();
      }
      if (HAM) { g.fillStyle = chest; g.beginPath(); g.ellipse(sx - yaw * 4, -h * .35, w * .55, h * .38, 0, 0, Math.PI * 2); g.fill(); }
      if (p.stripe && !HAM) { g.strokeStyle = p.stripe; g.lineWidth = 3; for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(sx + s * (w * .6 + i * 2), -h * .8 + i * 11); g.quadraticCurveTo(sx + s * (w * .78 + i * 2), -h * .74 + i * 11, sx + s * (w * .86 + i), -h * .64 + i * 11); g.stroke(); } }
      if (p.patches === 'dorsal') { g.strokeStyle = p.stripe; g.lineWidth = 3.5; g.beginPath(); g.moveTo(sx, -h * .95); g.lineTo(sx, -h * .3); g.stroke(); }
    }
    if (p.collar) {
      const cy = loaf ? -D.bh * .55 : -D.bh * .95, cx = sx - yaw * 4;
      g.strokeStyle = p.collar; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, cy, 15, 4, 0, .1, Math.PI - .1); g.stroke();
      if (p.bow) {                                          // бантик из ленты
        const bx = cx + 11, by = cy + 5; g.fillStyle = p.collar;
        for (const s_ of [-1, 1]) { g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + s_ * 13, by - 12, bx + s_ * 15, by - 1); g.quadraticCurveTo(bx + s_ * 13, by + 9, bx, by); g.fill(); }
        g.fillStyle = shade(p.collar, -.25); g.beginPath(); g.arc(bx, by, 3.2, 0, Math.PI * 2); g.fill();
        g.strokeStyle = p.collar; g.lineWidth = 3.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(bx - 1, by + 3); g.lineTo(bx - 6, by + 18); g.moveTo(bx + 1, by + 3); g.lineTo(bx + 7, by + 17); g.stroke();
      } else {
      g.fillStyle = p.pendant || '#7fd6c8'; const hx = cx, hy2 = cy + 7; g.beginPath();
      g.moveTo(hx, hy2 + 5); g.bezierCurveTo(hx - 7, hy2, hx - 3, hy2 - 5, hx, hy2 - 2); g.bezierCurveTo(hx + 3, hy2 - 5, hx + 7, hy2, hx, hy2 + 5); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = .8; g.stroke();
      }
    }

    // ---------- голова ----------
    const H = V(sx + yaw * 3 + (loaf ? 14 + yaw * 6 : 0), hy);
    const hk = loaf ? .92 : 1;
    g.save(); g.translate(H.x, H.y); g.scale(hk, hk); g.rotate(rad((o.headTilt || 0) + (loaf ? 5 : 0)));
    const fx = yaw * 10, r = D.hr, ry = D.hry;
    const earA = o.ear || 0;
    // уши (за черепом)
    if (CAT && p.fold) {                                  // скоттиш-фолд: маленькие ушки, сложенные вперёд
      for (const s of [-1, 1]) {
        const bx = s * 26 + fx * .3, by = -ry * .78;
        fill(fur, () => { g.moveTo(bx - s * 10, by + 4); g.quadraticCurveTo(bx - s * 2, by - 14, bx + s * 12, by - 6); g.quadraticCurveTo(bx + s * 14, by + 4, bx + s * 4, by + 6); g.closePath(); }, soft(fur, bx, by, 12));
        g.fillStyle = p.earIn || '#e8a5a0'; g.beginPath(); g.ellipse(bx + s * 3, by - 2, 4, 3, s * .6, 0, Math.PI * 2); g.fill();
      }
    } else if (CAT || (DOG && p.prick)) {
      for (const s of [-1, 1]) {
        const near = s * yaw >= 0, k = 1 - Math.abs(yaw) * (near ? -.05 : .25), big = (DOG ? (p.bigEars ? 1.5 : p.smallEars ? .85 : 1.15) : (p.sphynx ? 1.3 : p.bigEars ? 1.3 : p.smallEars ? .8 : 1)) * earK;
        const bx1 = s * 36 + fx * .3, by1 = -18, bx2 = s * 12 + fx * .3, by2 = -31;
        const tip = V(s * (32 + earA * 12) + fx * .3, -D.earH * 1.9 * k * big + 2 + earA * 16);
        const earPath = () => { g.moveTo(bx1, by1); g.quadraticCurveTo(s * 41 + fx * .3, -40 * k, tip.x, tip.y); g.quadraticCurveTo(s * 18 + fx * .3, -46 * k, bx2, by2); g.closePath(); };
        fill(p.ear || fur, earPath, soft(p.ear || fur, s * 28, -36, 22));
        g.beginPath(); g.moveTo(s * 32 + fx * .3, -22); g.quadraticCurveTo(s * 34 + fx * .3, -38 * k, lerp(tip.x, s * 26, .25), lerp(tip.y, -36, .25)); g.quadraticCurveTo(s * 21 + fx * .3, -40 * k, s * 16 + fx * .3, -30); g.closePath();
        g.fillStyle = (s > 0 && p.earIn2) || p.earIn || '#e8a5a0'; g.fill();
        g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = .8;
        for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(s * (30 - i * 3) + fx * .3, -24 - i); g.lineTo(s * (28 - i * 4) + fx * .3, -36 - i * 2); g.stroke(); }
        if (p.tuft) {                                   // кисточки на ушах, как у рыси
          g.strokeStyle = shade(fur, -.35); g.lineWidth = 1.6; g.lineCap = 'round';
          const tl = p.tuft === 'small' ? 4 : 9;
          for (const d of [-2, 0, 2]) { g.beginPath(); g.moveTo(tip.x + d, tip.y + 2); g.lineTo(tip.x + d * 2 + s * 2, tip.y - tl - Math.abs(d) * .5); g.stroke(); }
        }
      }
    } else if (RAB) {
      for (const s of [-1, 1]) {
        const near = s * yaw >= 0, k = near ? 1 : 1 - Math.abs(yaw) * .3;
        g.save(); g.translate(s * 16 + fx * .35, -ry * .75);
        if (p.lop) g.rotate(s * rad(112 + earA * 10)); else g.rotate(s * rad(14 + earA * 55 + (earA < 0 ? earA * 10 : 0)));
        const L = (p.lop ? 36 : D.earH) * k, W = p.lop ? 10 : 9;
        fill(p.ear || fur, () => g.ellipse(0, -L / 2, W, L / 2 + 2, 0, 0, Math.PI * 2), soft(p.ear || fur, 0, -L / 2, L / 2));
        if (!p.lop || near) { g.fillStyle = (s > 0 && p.earIn2) || p.earIn || '#f0b3b8'; g.beginPath(); g.ellipse(0, -L / 2 + 2, W * .55, L / 2 - 5, 0, 0, Math.PI * 2); g.fill(); }
        g.restore();
      }
    } else if (DRAGON) {
      const hK = p.hornK || 1;
      for (const s of [-1, 1]) {
        const near = s * yaw >= 0, k = near ? 1 : 1 - Math.abs(yaw) * .3;
        if (p.fins !== false) {                                 // плавники-ушки
          const ex = s * 36 + fx * .3, ey = -12 + earA * 6;
          g.fillStyle = p.wing || shade(fur, -.3); g.beginPath(); g.moveTo(ex - s * 8, ey - 8); g.quadraticCurveTo(ex + s * 16 * k, ey - 14, ex + s * 20 * k, ey - 2); g.quadraticCurveTo(ex + s * 16 * k, ey + 10, ex - s * 6, ey + 6); g.closePath(); g.fill();
          g.strokeStyle = shade(fur, -.15); g.lineWidth = 1.8; g.beginPath(); for (const a of [-.35, .1, .5]) { g.moveTo(ex - s * 6, ey); g.lineTo(ex + s * 18 * k * Math.cos(a), ey - 6 + 12 * Math.sin(a)); } g.stroke();
        }
        if (p.horns !== false) {                                // рожки
          const hx = s * 18 + fx * .25, hy0 = -ry * .82, L = 22 * hK * k;
          g.strokeStyle = shade(p.horn || '#f1e3c4', -.25); g.lineWidth = 8 * hK; g.lineCap = 'round'; g.beginPath(); g.moveTo(hx, hy0 + 4); g.quadraticCurveTo(hx + s * 6, hy0 - L * .6, hx + s * 12 * k, hy0 - L); g.stroke();
          g.strokeStyle = p.horn || '#f1e3c4'; g.lineWidth = 6 * hK; g.beginPath(); g.moveTo(hx, hy0 + 4); g.quadraticCurveTo(hx + s * 6, hy0 - L * .6, hx + s * 12 * k, hy0 - L); g.stroke();
        }
      }
    } else if (HAM) {
      for (const s of [-1, 1]) {
        const ex = s * 27 + fx * .3, ey = -ry * .82;
        fill(p.patches === 'panda' ? p.black : fur, () => g.ellipse(ex, ey, 8.5 * earK, 8.5 * earK, 0, 0, Math.PI * 2), soft(fur, ex, ey, 8));
        g.fillStyle = (s > 0 && p.earIn2) || p.earIn || '#e8a5a0'; g.beginPath(); g.ellipse(ex + s * .5, ey + 1, 5 * earK, 5.3 * earK, 0, 0, Math.PI * 2); g.fill();
      }
    } else if (DOG) {                                       // висячие уши — после черепа
    }
    // череп с пушистыми щеками
    const headPts = [
      ...fluffRing(fx * .15, 0, r, ry, Math.PI * 1.08, Math.PI * 1.92, 8, HAM ? 0 : .02, 1),
      ...fluffRing(fx * .15, 2, r * (p.fluffy ? 1.12 : 1.05), ry * .97, -Math.PI * .02, Math.PI * .48, p.fluffy ? 11 : 7, HAM ? .04 : p.fluffy ? .1 : .12, 31),
      ...fluffRing(fx * .15, 2, r * (p.fluffy ? 1.12 : 1.05), ry * .97, Math.PI * .52, Math.PI * 1.02, p.fluffy ? 11 : 7, HAM ? .04 : p.fluffy ? .1 : .12, 51),
    ];
    halo(() => spline(g, headPts), p.headC || fur, 14);
    fill(p.headC || fur, () => spline(g, headPts), soft(p.headC || fur, fx * .15, -2, r));
    furStrokes(headPts.slice(9), shade(p.headC || fur, -.15), HAM ? 2.5 : 3.5, 41);
    g.save(); g.beginPath(); spline(g, headPts); g.clip();
    if (p.mask) { g.fillStyle = p.mask; g.beginPath(); g.ellipse(fx, 12, 27, 24, 0, 0, Math.PI * 2); g.fill(); }
    if (p.points) { const gr = g.createRadialGradient(fx, 10, 4, fx, 6, r * .95); gr.addColorStop(0, p.points); gr.addColorStop(.6, p.points + 'cc'); gr.addColorStop(1, p.points + '00'); g.fillStyle = gr; g.fillRect(-r - 5, -ry - 5, r * 2 + 10, ry * 2 + 10); }
    if (p.stripe && (CAT || HAM)) {
      g.fillStyle = p.stripe;
      for (const [dx, w, l] of [[0, 3, 13], [-8, 2.4, 10], [8, 2.4, 10]]) { g.beginPath(); g.moveTo(fx * .6 + dx - w, -ry + 1); g.lineTo(fx * .6 + dx + w, -ry + 1); g.lineTo(fx * .6 + dx * 1.1, -ry + 1 + l); g.closePath(); g.fill(); }
      if (CAT) for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { g.strokeStyle = p.stripe; g.lineWidth = 2.4; g.beginPath(); g.moveTo(s * 40 + fx * .1, -2 + i * 7); g.lineTo(s * 30 + fx * .1, 1 + i * 6); g.stroke(); }
    }
    if (p.patch) { g.fillStyle = p.patch; const sides = p.patchSide === 'r' ? [1] : p.patchSide === 'both' ? [-1, 1] : [-1];
      for (const sd of sides) { g.beginPath(); g.ellipse(sd * 24 + fx * .2, -20, 16, 14, sd * -.4, 0, Math.PI * 2); g.fill(); } }
    if (p.patches === 'spots' && p.spotHead !== false) { const n = Math.min(6, Math.round((p.spotN !== undefined ? p.spotN : 9) / 3)), sk = p.spotK || 1; g.fillStyle = p.black; for (let i = 0; i < n; i++) { g.beginPath(); g.ellipse(fx * .3 + (i % 2 ? -1 : 1) * r * (.45 + hash(i * 7 + 2) * .45), -ry * .75 + hash(i * 13 + 5) * ry * .55, (2 + hash(i + 3) * 2.5) * sk, (1.8 + hash(i + 8) * 2.5) * sk, hash(i * 5) * 3, 0, Math.PI * 2); g.fill(); } }
    if (p.monocle) { g.fillStyle = p.monocle; g.beginPath(); g.ellipse(-16 + fx, 0, 15, 16, 0, 0, Math.PI * 2); g.fill(); }
    if (p.patches === 'panda' || p.patches === 'dutch') { g.fillStyle = p.black; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 17 + fx, -2, 15, 16, 0, 0, Math.PI * 2); g.fill(); } }
    if (p.blaze) { g.fillStyle = p.blaze; g.beginPath(); g.ellipse(fx, -6, 6, ry * .8, 0, 0, Math.PI * 2); g.fill(); }
    if (p.star) { g.fillStyle = p.star; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 2.2 : 5; g.lineTo(fx * .6 + Math.cos(a) * rr, -ry * .62 + Math.sin(a) * rr); } g.closePath(); g.fill(); }
    if (p.greyMuzzle) { g.fillStyle = 'rgba(235,232,228,.75)'; g.beginPath(); g.ellipse(fx, 12, 17, 12, 0, 0, Math.PI * 2); g.fill(); }
    if (p.headC && p.maskC) { g.fillStyle = p.maskC; g.beginPath(); g.ellipse(fx, 8, 24, 20, 0, 0, Math.PI * 2); g.fill(); for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 15 + fx, -20, 6, 4, 0, 0, Math.PI * 2); g.fill(); } }
    g.restore();
    if (DRAGON && p.spikes) spike(fx * .15 - 9, -ry * .99, 18, 0, 3, 7, p.spikes);
    if (DOG && !p.prick) {                                  // висячие уши поверх черепа
      for (const s of [-1, 1]) {
        g.save(); g.translate(s * 33 + fx * .3, -ry * .55); g.rotate(s * rad(8 + earA * 20 + Math.sin(t * 8) * (o.tail || 0) * .08)); g.scale(earK, earK);
        fill(p.earC || shade(fur, -.18), () => { g.moveTo(-8, -4); g.bezierCurveTo(-14, 10, -12, 30, -2, 34); g.bezierCurveTo(8, 36, 12, 16, 8, -6); g.closePath(); }, soft(p.earC || shade(fur, -.18), 0, 14, 20));
        g.restore();
      }
    }
    if (p.hair) {                                         // чёлка-хохолок, как у Матроскина
      g.fillStyle = p.hair; for (const [dx, dy, rr] of [[-9, 1, 4.5], [0, -2, 5], [9, 1, 4.5]]) { g.beginPath(); g.ellipse(fx * .15 + dx, -ry + dy, rr, rr * 1.4, 0, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = p.hair; g.lineWidth = 2; g.lineCap = 'round'; for (const dx of [-8, 0, 8]) { g.beginPath(); g.moveTo(fx * .15 + dx, -ry * .78); g.lineTo(fx * .15 + dx, -ry * .68); g.stroke(); }
    }
    if (p.curly) {                                        // пудель: кудрявая шапочка и щёки
      g.fillStyle = shade(fur, .05);
      for (const [cx_, cy_, rr] of [[-14 + fx * .2, -ry * .85, 11], [0 + fx * .2, -ry * .98, 13], [14 + fx * .2, -ry * .85, 11], [-30 + fx * .2, 6, 12], [30 + fx * .2, 6, 12], [-22 + fx * .2, -20, 10], [22 + fx * .2, -20, 10]]) {
        g.beginPath(); g.arc(cx_, cy_, rr, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1;
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.beginPath(); g.arc(fx * .2 + Math.cos(a) * 30, -ry * .5 + Math.sin(a) * 22, 4, a, a + 4); g.stroke(); }
    }
    if (p.sphynx || p.wrinkles) {                          // складочки на лбу
      g.strokeStyle = 'rgba(90,60,50,.35)'; g.lineWidth = 1.2; g.lineCap = 'round';
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(fx * .6 - 12, -ry * .55 + i * 5); g.quadraticCurveTo(fx * .6, -ry * .62 + i * 5, fx * .6 + 12, -ry * .55 + i * 5); g.stroke(); }
    }
    // мордочка
    const cheekK = Math.min(1, (o.cheek || 0) + (HAM ? (p.cheekK || 0) : 0));
    if (HAM && cheekK > .02) { g.fillStyle = fur; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 24 + fx, 12, 12 + cheekK * 9, 9 + cheekK * 7, 0, 0, Math.PI * 2); g.fill(); } }
    const muzzleC = p.muzzle || chest;
    if (DOG) { fill(muzzleC, () => g.ellipse(fx, p.flat ? 10 : 13, p.flat ? 15 : 18, p.flat ? 9 : 12, 0, 0, Math.PI * 2), soft(muzzleC, fx, 13, 16, .6), true); }
    else if (DRAGON && p.snout) { fill(muzzleC, () => g.ellipse(fx * 1.2, 16, 24, 13, 0, 0, Math.PI * 2), soft(muzzleC, fx, 14, 20, .5), true); g.fillStyle = '#fffaf0'; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(fx * 1.2 + i * 8 - 2, 24); g.lineTo(fx * 1.2 + i * 8, 29); g.lineTo(fx * 1.2 + i * 8 + 2, 24); g.fill(); } }
    else { g.fillStyle = muzzleC; g.beginPath(); g.ellipse(fx, p.flat ? 9 : 13, HAM ? 12 : p.flat ? 11 : 14, HAM ? 8 : p.flat ? 7 : 9.5, 0, 0, Math.PI * 2); g.fill(); }
    // глаза
    animalEyes(g, o, fx, sp, p);
    // нос, рот, язык, зубы
    const nx = fx * 1.15, ny = p.flat ? 4 : 10;
    if (DOG) { g.fillStyle = p.nose || '#222'; g.beginPath(); g.ellipse(nx, ny - 2, 6, 4.5, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(nx - 2, ny - 3.5, 2, 1.2, 0, 0, Math.PI * 2); g.fill(); }
    else if (DRAGON) { g.fillStyle = p.nose || shade(fur, -.45); for (const s of [-1, 1]) { g.beginPath(); g.ellipse(nx + s * 5, ny - 1, 2.2, 1.6, 0, 0, Math.PI * 2); g.fill(); }
      if ((o.smoke || 0) > .02) { g.strokeStyle = `rgba(110,110,125,${.9 * o.smoke})`; g.lineWidth = 2.2;
        for (let i = 0; i < 3; i++) { const q = ((t * .5 + i * .33) % 1), rr = 2 + q * 6; g.globalAlpha = (1 - q) * o.smoke; for (const s of [-1, 1]) { g.beginPath(); g.arc(nx + s * (6 + q * 10), ny - 4 - q * 26, rr, 0, Math.PI * 2); g.stroke(); } } g.globalAlpha = 1; } }
    else { g.fillStyle = p.nose || '#e88c86'; g.beginPath(); g.moveTo(nx - 4, ny - 1.5); g.quadraticCurveTo(nx, ny - 3, nx + 4, ny - 1.5); g.quadraticCurveTo(nx + 1, ny + 3, nx, ny + 3); g.quadraticCurveTo(nx - 1, ny + 3, nx - 4, ny - 1.5); g.fill(); }
    const mouth = o.mouth || 0;
    g.strokeStyle = line; g.lineWidth = 1.4;
    if (mouth > .15) {
      const mw = 3 + mouth * 4, mh = 3 + mouth * 5;
      g.fillStyle = '#5a1f28'; g.beginPath(); g.ellipse(nx, ny + 6 + mh * .5, mw, mh, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#ef8a98'; g.beginPath(); g.ellipse(nx, ny + 8 + mh * .7, mw * .7, mh * .38, 0, 0, Math.PI * 2); g.fill();
    } else {
      const mw = p.smile ? 12 : 7, md = p.smile ? 12 : 9;
      g.beginPath(); g.moveTo(nx, ny + 3); g.lineTo(nx, ny + 5.5);
      g.quadraticCurveTo(nx - 3, ny + md, nx - mw, ny + 6); g.moveTo(nx, ny + 5.5); g.quadraticCurveTo(nx + 3, ny + md, nx + mw, ny + 6); g.stroke();
      if (RAB || HAM) { g.fillStyle = '#fffaf0'; g.fillRect(nx - 3, ny + 5.5, 2.6, 4); g.fillRect(nx + .4, ny + 5.5, 2.6, 4); }
      if ((o.tongue || 0) > .05) { const tl = 5 + (o.tongue || 0) * 5; g.fillStyle = '#ef7f90'; g.beginPath(); g.moveTo(nx - 3.5, ny + 7); g.quadraticCurveTo(nx, ny + 7 + tl * 1.3, nx + 3.5, ny + 7); g.closePath(); g.fill(); g.strokeStyle = 'rgba(150,40,60,.6)'; g.lineWidth = .7; g.stroke(); }
    }
    if (DRAGON) {
      if (mouth <= .15) { g.fillStyle = '#fffaf0'; g.beginPath(); g.moveTo(nx - 7, ny + 6); g.lineTo(nx - 5.5, ny + 10); g.lineTo(nx - 4, ny + 6); g.moveTo(nx + 7, ny + 6); g.lineTo(nx + 5.5, ny + 10); g.lineTo(nx + 4, ny + 6); g.fill(); }
      const fire = clamp(o.fire || 0, 0, 1);
      if (fire > .02) {                                        // струя огня изо рта в сторону взгляда
        const dir = yaw < 0 ? -1 : 1, L = 70 * fire, fl = .85 + .15 * Math.sin(t * 37) + .1 * Math.sin(t * 53);
        g.save(); g.translate(nx + dir * 6, ny + 8); g.rotate(dir * rad(-8 + 5 * Math.sin(t * 9)));
        const cone = (len, wid, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(dir * len * .45, -wid, dir * len, -wid * .35 + 2 * Math.sin(t * 41)); g.quadraticCurveTo(dir * len * .95, 0, dir * len, wid * .3 + 2 * Math.cos(t * 47)); g.quadraticCurveTo(dir * len * .45, wid, 0, 0); g.fill(); };
        g.globalAlpha = .9; cone(L * fl, 14 * fire, '#ff5a1f'); cone(L * fl * .8, 10 * fire, '#ffa21f'); cone(L * fl * .55, 6 * fire, '#fff08a'); g.globalAlpha = 1;
        for (let i = 0; i < 4; i++) { const q = ((t * 1.6 + i * .25) % 1); g.fillStyle = `rgba(255,${150 + Math.round(q * 90)},40,${1 - q})`; g.beginPath(); g.arc(dir * L * fl * (.5 + q * .7), -6 - q * 22 + hash(i * 3) * 8, 2.5 - q * 1.5, 0, Math.PI * 2); g.fill(); }
        g.restore();
      }
    }
    // румянец и усы
    g.fillStyle = p.cheekC || 'rgba(255,120,140,.28)'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 25 + fx, 11, p.cheekC ? 7.5 : 6, p.cheekC ? 6.5 : 3.5, 0, 0, Math.PI * 2); g.fill(); }
    if (!DOG && !DRAGON) {
      g.strokeStyle = p.whisk || 'rgba(70,50,40,.5)'; g.lineWidth = .8;
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(nx + s * 12, ny + 4 + i * 2.2); g.quadraticCurveTo(nx + s * 30, ny + (i - 1) * 4, nx + s * (44 - i * 2), ny - 5 + i * 6); g.stroke(); }
    }
    drawHat(g, fx * .15 + 2, -ry + (RAB && !p.lop ? 4 : HAM ? 2 : 6), (o.hat || p.hat), RAB ? .9 : 1);
    g.restore();
    info.head = { x: H.x, y: H.y, r: r };
    info.top = { x: H.x, y: H.y - ry - (RAB && !p.lop ? D.earH * .9 : CAT || DOG ? D.earH * .8 : 6) };
    info.bbox = { l: -D.bw - 30, t: info.top.y - 6, r: D.bw + 30, b: 4 };
    g.restore();
    return info;
  }

  function animalEyes(g, o, fx, sp, p, eyY) {
    const happy = clamp(o.happy || 0, 0, 1), open = clamp((o.eye === undefined ? 1 : o.eye) * (1 - happy), 0, 1);
    const HAM = sp === 'hamster', RAB = sp === 'rabbit', DOG = sp === 'dog';
    const yaw = clamp(o.yaw || 0, -1, 1);
    for (const s of [-1, 1]) {
      const far = s * yaw < 0, k = far ? 1 - Math.abs(yaw) * .35 : 1;
      const ek = p.eyeK || 1;
      const ex = s * (HAM ? 14 : 16) + fx, ey = eyY !== undefined ? eyY : HAM ? -2 : 0, rx = (HAM ? 8 : 11.5) * k * ek, ry = (HAM ? 8.5 : 13) * ek * (1 + (1 - (o.pup === undefined ? .6 : o.pup)) * .1);
      if (open < .12) {
        g.strokeStyle = p.line || '#3a2519'; g.lineWidth = 2.2; g.beginPath();
        if (happy > .5) { g.moveTo(ex - 8 * k, ey + 2); g.quadraticCurveTo(ex, ey - 7, ex + 8 * k, ey + 2); }
        else { g.moveTo(ex - 8 * k, ey); g.quadraticCurveTo(ex, ey + 6, ex + 8 * k, ey); }
        g.stroke(); continue;
      }
      g.save(); g.beginPath(); g.ellipse(ex, ey, rx, ry * open, 0, 0, Math.PI * 2); g.closePath();
      g.fillStyle = '#1c1411'; g.fill(); g.clip();
      const lx = clamp(o.look ? o.look.x : 0, -1, 1) * 3, ly = clamp(o.look ? o.look.y : 0, -1, 1) * 3;
      if (!HAM) {
        const ir = s > 0 && p.iris2 ? p.iris2 : p.iris;
        const gr = g.createRadialGradient(ex + lx, ey + ly + 4, 1, ex + lx, ey + ly, rx * 1.05);
        gr.addColorStop(0, shade(ir, .35)); gr.addColorStop(.55, ir); gr.addColorStop(1, shade(ir, -.55));
        g.fillStyle = gr; g.beginPath(); g.ellipse(ex + lx, ey + ly, rx * .92, ry * .95, 0, 0, Math.PI * 2); g.fill();
      }
      const pup = o.pup === undefined ? .6 : o.pup, pr = HAM ? rx * .85 : rx * (.3 + pup * .35);
      g.fillStyle = '#0d0909'; g.beginPath(); if (p.slit) g.ellipse(ex + lx, ey + ly + .5, pr * (.35 + pup * .4), pr * 1.35, 0, 0, Math.PI * 2); else g.ellipse(ex + lx, ey + ly + .5, pr, pr * (DOG || HAM || RAB ? 1.05 : 1.2), 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.96)';
      g.beginPath(); g.arc(ex - rx * .33 + lx * .3, ey - ry * .35, rx * .34, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(ex + rx * .35 + lx * .3, ey + ry * .3, rx * .14, 0, Math.PI * 2); g.fill();
      if (!HAM) { g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.ellipse(ex + lx, ey + ry * .62, rx * .55, ry * .22, 0, 0, Math.PI * 2); g.fill(); }
      g.restore();
      g.strokeStyle = p.line || '#2a1d18'; g.lineWidth = 1.8;
      g.beginPath(); g.ellipse(ex, ey, rx, ry * open, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
      if (p.lashes) { g.lineWidth = 1.4; g.beginPath(); g.moveTo(ex + s * rx * .85, ey - ry * .45 * open); g.lineTo(ex + s * (rx + 3), ey - ry * .7 * open); g.stroke(); }
    }
  }
  function birdEyes(g, o, fx, hr, p) {
    p = p || {};
    const happy = clamp(o.happy || 0, 0, 1), open = clamp((o.eye === undefined ? 1 : o.eye) * (1 - happy), 0, 1), yaw = clamp(o.yaw || 0, -1, 1);
    for (const s of [-1, 1]) {
      const far = s * yaw < 0, k = far ? 1 - Math.abs(yaw) * .35 : 1, ex = s * 12 + fx, ey = -4, r = 7.5 * k * (p.eyeK || 1);
      if (open < .12) { g.strokeStyle = '#2a1d18'; g.lineWidth = 2; g.beginPath(); if (happy > .5) { g.moveTo(ex - 6 * k, ey + 1); g.quadraticCurveTo(ex, ey - 5, ex + 6 * k, ey + 1); } else { g.moveTo(ex - 6 * k, ey); g.quadraticCurveTo(ex, ey + 4, ex + 6 * k, ey); } g.stroke(); continue; }
      g.fillStyle = '#f7f3ee'; g.beginPath(); g.ellipse(ex, ey, r + 2.5, (r + 2.5) * open, 0, 0, Math.PI * 2); g.fill();
      const lx = clamp(o.look ? o.look.x : 0, -1, 1) * 2, ly = clamp(o.look ? o.look.y : 0, -1, 1) * 2;
      g.save(); g.beginPath(); g.ellipse(ex, ey, r, r * open, 0, 0, Math.PI * 2); g.clip();
      const ir = s > 0 && p.iris2 ? p.iris2 : p.iris;
      if (ir && ir !== '#1a1410' && ir !== '#1a1210') { g.fillStyle = ir; g.beginPath(); g.ellipse(ex + lx, ey + ly, r, r, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#1a1210'; g.beginPath(); g.ellipse(ex + lx, ey + ly + .5, r * .55, r * .58, 0, 0, Math.PI * 2); g.fill(); }
      else { g.fillStyle = '#1a1210'; g.beginPath(); g.ellipse(ex + lx, ey + ly, r, r, 0, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.arc(ex - r * .35 + lx * .3, ey - r * .35, r * .32, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(ex + r * .3, ey + r * .3, r * .13, 0, Math.PI * 2); g.fill();
      g.restore();
      g.strokeStyle = 'rgba(40,25,20,.5)'; g.lineWidth = 1; g.beginPath(); g.ellipse(ex, ey, r + 2.5, (r + 2.5) * open, 0, 0, Math.PI * 2); g.stroke();
    }
  }
  window.drawChibi = drawChibi;
})();
