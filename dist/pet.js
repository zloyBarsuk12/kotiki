// Питомец на рабочем столе: кот, щенок, хомяк, попугай или кролик. Одно окно — один зверь.
// Рисовка — chibi.js (вид спереди, большая голова, огромные глаза). Здесь: поведение (действия,
// походка, реакции на курсор и друг на друга), звуки WebAudio и связь с Rust: окно (220×180)
// само ездит по экрану — позицию задаёт команда frame, кадр её ответа не ждёт.
(() => {
  'use strict';
  const T = window.__TAURI__;
  const invoke = T ? T.core.invoke : null;
  const hash = new URLSearchParams(location.hash.slice(1));
  const DEMO = !T || hash.has('demo');
  const PET = DEMO ? { sp: hash.get('sp') || 'cat', color: +(hash.get('c') || 0), build: hash.get('build') || 'normal', fur: hash.get('fur') || '', look: hash.get('look') || (hash.get('lookKey') ? (sessionStorage.getItem(hash.get('lookKey')) || '') : ''), label: 'demo' }
                   : Object.assign({ sp: 'cat', color: 0, build: 'normal', fur: '', label: 'pet1' }, window.PET || {});
  const SP = ['cat', 'dog', 'hamster', 'bird', 'rabbit', 'dragon', 'kuzya', 'clippy', 'round', 'custom'].includes(PET.sp) ? PET.sp : 'cat';
  const DOG = SP === 'dog', HAM = SP === 'hamster', BIRD = SP === 'bird', CAT = SP === 'cat', RAB = SP === 'rabbit', DRAGON = SP === 'dragon', KUZYA = SP === 'kuzya', CLIP = SP === 'clippy', ROUND = SP === 'round', CUSTOM = SP === 'custom';
  const FLY = BIRD || DRAGON;                     // умеет летать
  const GUEST = !!PET.guest;                      // чужой питомец в гостях (окно guest)

  const W = 220, H = 180, CX = 110, GY = 172;
  const canvas = document.getElementById('c'), ctx = canvas.getContext('2d');
  const bubble = document.getElementById('bubble'), stage = document.getElementById('stage');
  let DPR = 1;
  function resize() { DPR = Math.max(1, window.devicePixelRatio || 1); canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR); }
  resize();

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const now = () => performance.now();
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  }

  // ---------- внешность ----------
  let pal, CHUBBY = false, SPD = 1, SCALE = 1, NAME = '', SEX = 'm', CHAR = 'playful', AGE = 30;
  // формы рода в репликах: «Я провери{л|ла}» — первая для «он», вторая для «она»
  const gd = t => t.replace(/\{([^|}]*)\|([^}]*)\}/g, (m, a, b) => (SEX === 'f' ? b : a));
  function configure() {
    const list = window.PALETTES[SP] || window.PALETTES.cat, base = list[PET.color % list.length];
    pal = Object.assign({}, base);
    if (/^#[0-9a-f]{6}$/i.test(PET.fur || '')) {
      pal.fur = PET.fur;
      if (base.stripe) pal.stripe = shade(PET.fur, -.4);
      if (base.bands) pal.bands = shade(PET.fur, .45); if (base.hair) pal.hair = shade(PET.fur, -.45);
      if (!base.points) pal.tail = base.tail && base.tail !== base.fur ? shade(PET.fur, .12) : PET.fur;   // хвост — в цвет шерсти (у шпица он чуть светлее)
      if (BIRD) { pal.wing = shade(PET.fur, .18); pal.prim = shade(PET.fur, -.35); pal.belly = shade(PET.fur, .3); if (base.head === base.fur) pal.head = PET.fur; }
      if (DOG && base.earC && !base.patches) pal.earC = shade(PET.fur, -.18);
      if (DRAGON) { pal.wing = shade(PET.fur, -.35); pal.spikes = base.spikes ? shade(PET.fur, -.4) : null; pal.muzzle = PET.fur; pal.nose = shade(PET.fur, -.45); if (!base.chest || base.chest === base.fur) pal.chest = shade(PET.fur, .55); }
      if (RAB && !base.patches) pal.ear = base.lop ? shade(PET.fur, -.16) : PET.fur;
      if (base.headC === base.fur) pal.headC = PET.fur;
    }
    // конструктор внешности: цвета и метки поверх окраса/породы
    let look = null; try { look = PET.look ? JSON.parse(PET.look) : null; } catch (_) { look = null; }
    if (look) {
      const hex = v => /^#[0-9a-f]{6}$/i.test(v || '') ? v : null;
      for (const k of ['chest', 'paws', 'pawFL', 'pawFR', 'pawHL', 'pawHR', 'iris', 'iris2', 'nose', 'earIn', 'earIn2', 'tail', 'patch', 'monocle', 'star', 'heart',
        'muzzle', 'earC', 'ear', 'tailC', 'collar', 'pendant', 'belly', 'head', 'wing', 'prim', 'cheek', 'face', 'beak', 'feet', 'throat', 'ring', 'crestC', 'horn', 'spikes', 'tailTip', 'skin', 'pants', 'belt', 'lapti', 'dots', 'beard', 'cap', 'bow', 'limb', 'shoe', 'hand', 'snout', 'curl', 'tie', 'earIn', 'cheekC']) if (hex(look[k])) pal[k] = look[k];
      for (const k of ['holes', 'lashes', 'teeth', 'noWings', 'snoutOn']) if (typeof look[k] === 'boolean') pal[k === 'snoutOn' ? 'snout' : k] = look[k];
      if (look.ears2) pal.ears = look.ears2 === 'none' ? null : look.ears2;
      if (look.goggles !== undefined) pal.goggles = look.goggles;
      if (look.hatP !== undefined) pal.hat = look.hatP || null;
      for (const k of ['dots', 'beard', 'cap', 'bow']) if (look[k] === 'none') pal[k] = null;
      for (const k of ['freckles', 'glasses']) if (typeof look[k] === 'boolean') pal[k] = look[k];
      for (const k of ['hairK', 'browK']) if (typeof look[k] === 'number') pal[k] = clamp(look[k], .5, 2);
      if (typeof look.spriteData === 'string' && look.spriteData.startsWith('data:image/')) { pal.sprite = look.spriteData; pal.parts = { neck: typeof look.neck === 'number' ? look.neck : .45, legs: typeof look.legs === 'number' ? look.legs : .15 }; pal.spriteK = typeof look.spriteK === 'number' ? clamp(look.spriteK, .5, 1.6) : 1; if (typeof look.eyeY === 'number') { pal.eyeY = look.eyeY; pal.eyeDX = typeof look.eyeDX === 'number' ? look.eyeDX : .08; pal.eyeX = typeof look.eyeX === 'number' ? look.eyeX : 0; } else pal.eyeY = -1; }
      if (look.spikes === 'none') pal.spikes = null; for (const k of ['horns', 'fins']) if (typeof look[k] === 'boolean') pal[k] = look[k];
      if (hex(look.crestC)) pal.crest = look.crestC;
      for (const k of ['spotN']) if (typeof look[k] === 'number') pal[k] = clamp(Math.round(look[k]), 0, 40);
      for (const k of ['spotK']) if (typeof look[k] === 'number') pal[k] = clamp(look[k], .4, 2.5);
      if (typeof look.spotHead === 'boolean') pal.spotHead = look.spotHead;
      if (typeof look.sizeK === 'number') pal.sizeK = clamp(look.sizeK, .5, GUEST ? 1.2 : 1.8);   // гость на чужом экране — не выше 1,2: чужие настройки не ломают пропорции (решение владельца 25.09)
      for (const k of ['earK', 'eyeK', 'tailK', 'fluffK', 'bodyK', 'beakK', 'crestK', 'hornK', 'wingK']) if (typeof look[k] === 'number') pal[k] = clamp(look[k], .5, 1.6);
      if (typeof look.cheekK === 'number') pal.cheekK = clamp(look.cheekK, 0, 1);
      // видовые черты: true/false включают и выключают, цвет берётся из окраса
      for (const k of ['flat', 'sphynx', 'lashes', 'fluffyTail', 'wrinkles', 'curly', 'longBody', 'smile', 'round']) if (typeof look[k] === 'boolean') pal[k] = look[k];
      if (look.hair === true && !hex(pal.hair)) pal.hair = shade(pal.fur, -.45); else if (look.hair === false) pal.hair = null; else if (hex(look.hair)) pal.hair = look.hair;
      if (look.crest === true && !hex(pal.crest)) pal.crest = pal.head || pal.fur; else if (look.crest === false) pal.crest = null;
      if (look.face === true && !hex(look.face)) pal.face = '#f4f1ea'; else if (look.face === false) pal.face = null;
      if (look.bars === true) pal.bars = shade(pal.fur, -.6); else if (look.bars === false) pal.bars = null;
      if (look.throat === false) pal.throat = null; else if (look.throat === true) pal.throat = true;
      if (look.ring === true && !hex(look.ring)) pal.ring = '#2a2220'; else if (look.ring === false) pal.ring = null;
      if (look.collar === true && !hex(look.collar)) pal.collar = '#e05a6a'; else if (look.collar === false) { pal.collar = null; pal.bow = false; }
      if (typeof look.bow === 'boolean') { pal.bow = look.bow; if (look.bow && !pal.collar) pal.collar = '#e05a6a'; }
      if (look.collar === 'none') pal.collar = null;
      if (look.greyMuzzle) pal.greyMuzzle = true; else if (look.greyMuzzle === false) pal.greyMuzzle = false;
      if (look.star === true) pal.star = shade(pal.fur, .7); else if (look.star === false) pal.star = null;
      if (look.heart === true) pal.heart = shade(pal.fur, -.45); else if (look.heart === false) pal.heart = null;
      if (look.monocle === true) pal.monocle = shade(pal.fur, -.5); else if (look.monocle === false) pal.monocle = null;
      if (look.chest === 'none') pal.chest = null; else if (look.chest === 'on' && !pal.chest) pal.chest = shade(pal.fur, .55);
      if (look.socks === false) pal.paws = pal.fur; else if (look.socks === true && !hex(look.paws)) pal.paws = pal.chest || '#f6f2ec';
      if (look.patchSide) pal.patchSide = look.patchSide; if (look.patch === 'none') pal.patch = null;
      if (look.blaze === true) pal.blaze = pal.chest || '#f6f2ec'; if (look.blaze === false) pal.blaze = null;
      if (look.mask === 'light') { pal.mask = null; pal.muzzle = pal.chest || '#f6f2ec'; } else if (look.mask === 'dark') { pal.muzzle = '#2a2320'; pal.mask = null; } else if (look.mask === 'points') { pal.points = shade(pal.fur, -.55); }
      if (look.pattern !== undefined) { pal.stripe = null; pal.patches = null; pal.bands = null; if (look.pattern === 'stripe') pal.stripe = shade(pal.fur, -.4); else if (look.pattern === 'bands') pal.bands = hex(look.bands) || shade(pal.fur, .45);
        else if (look.pattern === 'dorsal') { pal.patches = 'dorsal'; pal.stripe = shade(pal.fur, -.5); }
        else if (['rosettes', 'spots', 'saddle', 'beagle', 'panda', 'dutch'].includes(look.pattern)) { pal.patches = look.pattern; pal.black = hex(look.black) || (pal.black && base.patches ? pal.black : shade(pal.fur, -.6)); if (look.pattern === 'dutch' && !hex(look.ear)) pal.ear = pal.black; } }
      for (const k of ['tuft', 'fluffy', 'curlTail', 'fold', 'prick', 'lop']) if (look[k] !== undefined) pal[k] = look[k];
      if (look.ears === 'big') { pal.bigEars = true; pal.smallEars = false; } else if (look.ears === 'small') { pal.smallEars = true; pal.bigEars = false; } else if (look.ears === 'normal') { pal.smallEars = pal.bigEars = false; }
      if (look.tailTip === true) pal.tailTip = pal.chest || '#f6f2ec'; else if (look.tailTip === false) pal.tailTip = null;
      pal.muzzle = pal.muzzle || pal.chest;
    }
    CHAR = PET.character || 'playful';
    AGE = PET.born ? Math.max(0, (Date.now() - Date.parse(PET.born)) / 86400e3) : 30;
    CHUBBY = PET.build === 'chubby';
    SPD = (CHUBBY ? .72 : 1) * (HAM ? .8 : RAB ? .9 : 1);
    if (DRAGON) pal.chest = pal.chest || shade(pal.fur, .55);
    SCALE = (HAM ? .82 : BIRD ? .95 : RAB ? .95 : KUZYA ? .92 : 1) * (CHUBBY ? 1.06 : 1) * (.55 + .45 * Math.pow(clamp(AGE / 30, 0, 1), .7)) * weightK() * (pal.sizeK || 1);   // малыш: 55 % при рождении, взрослый к 30 дням
    pal.eyeK = (pal.eyeK || 1) * (1 + .25 * (1 - clamp(AGE / 30, 0, 1)));                    // у малыша глаза больше
    NAME = (PET.name || '').trim() || pal.name;
    SEX = PET.sex === 'f' || PET.sex === 'm' ? PET.sex : (pal.sex || 'm');
    TXT.bird.voice[1] = NAME + ' хорош{ий|ая}!';
    TXT.bird.petSay[0] = NAME + ' хорош{ий|ая}!';
    TXT.dog.phrases[0] = 'Кто хорош{ий мальчик|ая девочка}? ' + NAME + '!';
    TXT.cat.phrases[1] = NAME + ' слушает. Заявка принята.';
    TXT.hamster.phrases[5] = NAME + ' на связи. Пи.';
    TXT.rabbit.phrases[2] = NAME + ' скачет, заявка в работе';
  }

  // ---------- позы: наборы параметров чиби ----------
  const BASE = { yaw: 0, bob: 0, tilt: 0, squash: 1, pawL: 0, pawR: 0, armL: 0, armR: 0, headY: 0, headTilt: 0, eye: 1, pup: .6, happy: 0, mouth: 0,
    tongue: DOG ? .4 : 0, ear: 0, tail: DOG ? 18 : 8, tailUp: 0, cheek: 0, crest: .3, wing: 0, wingA: 0, puff: 1, fire: 0, smoke: 0, glow: 0, chest: 0, broom: 0, paper: 0, shape: '' };
  const mk = (o, pose = 'sit') => Object.assign({ pose }, BASE, o);
  const P = {
    sit: mk({}),
    stand: mk({}),
    walk: mk({}),
    loaf: mk({ eye: .75, tail: 3 }, 'loaf'),
    sleep: mk({ eye: 0, ear: .4, tail: 2, tongue: 0, crest: 0 }, 'loaf'),
    up: mk({ ear: -.5, armL: .5, armR: .5 }, 'up'),
    hang: mk({ squash: 1.08, armL: .55, armR: .55, pawL: -.5, pawR: -.5, ear: .5, pup: .9, mouth: .25, tail: 4, tongue: 0 }, 'hang'),
    fly: mk({ wing: 1, ear: .3, tail: 2, crest: .05 }, 'fly'),
    crouch: mk({ squash: .86, ear: -1, pup: 1, headY: 3 }),
    leap: mk({ squash: 1.12, pawL: 1, pawR: 1, ear: .3, pup: .9 }),
    fall: mk({ squash: 1.1, pawL: 1, pawR: 1, ear: 1, pup: 1, mouth: .5 }),
    stretch: mk({ squash: 1.12, headY: -3, eye: 0, mouth: 1, ear: .3, tongue: 0 }),
    arch: mk({ squash: 1.04, puff: 1.15, ear: 1, mouth: 1, pup: 1, tailUp: 1, tail: 25, tongue: 0, crest: 1 }),
    eat: mk({ headY: 5, headTilt: 5, armL: .7, armR: .7, eye: .8, tongue: 0 }),
    sniff: mk({ headY: 4, headTilt: 12, ear: -.4 }),
    bow: mk({ squash: .9, headY: 6, tail: 40, tongue: .6, pup: .8 }),
    dig: mk({ headY: 6, ear: .2 }),
  };
  const KEYS = Object.keys(BASE);

  // ---------- состояние ----------
  const C = Object.assign({}, P.sit), R = {};
  let poseName = 'sit', A = null;
  let x = 0, y = 0, inited = false;              // позиция окна (физические пиксели)
  let face = 1, faceT = 1, yawS = 0;              // куда смотрит
  let vel = 0, gw = 0, phase = 0, gait = 'walk', lift = 0, swingAng = 0, swingV = 0, tilt = 0;
  let blinkT = now() + 2000, blinkK = 0, slowBlink = 0, earTw = 0, earTwT = now() + 3000;
  let look = { x: 0, y: 0 };
  let info = null;                                // геометрия последнего кадра (голова, макушка, рамка)
  let offX = 0, offY = 0;                         // дробная часть позиции окна — рисуем сдвигом
  let bowlOn = false, wheelOn = false, wheelRot = 0, cheekUntil = 0;

  // ---------- рисовка ----------
  const GAITS = RAB ? { walk: { stride: 26, hop: 8 }, run: { stride: 42, hop: 11 } }
    : BIRD ? { walk: { stride: 12, hop: 4 }, run: { stride: 12, hop: 5 } }
    : HAM ? { walk: { stride: 12, hop: 0 }, run: { stride: 18, hop: 2 } }
    : DRAGON ? { walk: { stride: 20, hop: 2 }, run: { stride: 32, hop: 6 } }
    : KUZYA ? { walk: { stride: 18, hop: 3 }, run: { stride: 28, hop: 6 } }
    : CLIP ? { walk: { stride: 10, hop: 9 }, run: { stride: 14, hop: 14 } }
    : ROUND ? { walk: { stride: 14, hop: 6 }, run: { stride: 22, hop: 10 } }
    : CUSTOM ? { walk: { stride: 18, hop: 3 }, run: { stride: 28, hop: 6 } }
    : { walk: { stride: 22, hop: 0 }, run: { stride: 34, hop: 4 } };

  function localMatrix() {
    let M = new DOMMatrix().scale(DPR, DPR).translate(CX + offX, GY - lift + offY);
    if (swingAng && info) M = M.translate(info.top.x * SCALE, info.top.y * SCALE).rotate(swingAng).translate(-info.top.x * SCALE, -info.top.y * SCALE);
    if (tilt) M = M.translate(0, -50 * SCALE).rotate(tilt).translate(0, 50 * SCALE);
    return M.scale(SCALE, SCALE);
  }
  const toCanvas = (lx, ly) => { const p = localMatrix().transformPoint(new DOMPoint(lx, ly)); return { x: p.x / DPR, y: p.y / DPR }; };

  function drawWheel(front) {
    if (!wheelOn) return;
    const R0 = 46, cy = -R0 - 1;
    ctx.lineCap = 'round';
    if (!front) {
      ctx.strokeStyle = '#8e99a3'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(0, cy); ctx.lineTo(22, 0); ctx.stroke();
      ctx.strokeStyle = 'rgba(120,135,150,.5)'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 8; i++) { const a = wheelRot + i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(Math.cos(a) * R0, cy + Math.sin(a) * R0); ctx.stroke(); }
      ctx.strokeStyle = '#b5c0ca'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, cy, R0, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(181,192,202,.7)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, cy, R0 + 2, Math.PI * .12, Math.PI * .88); ctx.stroke();
      ctx.fillStyle = '#6d7880'; ctx.beginPath(); ctx.arc(0, cy, 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  function drawFood() {
    if (!bowlOn) return;
    ctx.lineCap = 'round';
    if (RAB) {                                    // морковка в лапках
      ctx.save(); ctx.translate(0, -36 - (R.headY || 0)); ctx.rotate(-.35);
      ctx.fillStyle = '#ee8a2a'; ctx.beginPath(); ctx.moveTo(-16, -4); ctx.quadraticCurveTo(-18, -9, -12, -8); ctx.lineTo(16, -1); ctx.lineTo(-12, 4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(160,80,20,.6)'; ctx.lineWidth = .8; for (const q of [-8, -2, 4]) { ctx.beginPath(); ctx.moveTo(q, -6); ctx.lineTo(q + 1, 1); ctx.stroke(); }
      ctx.fillStyle = '#5aa83a'; for (const a of [-2.5, -2, -1.5]) { ctx.beginPath(); ctx.ellipse(-17 + Math.cos(a) * 6, -6 + Math.sin(a) * 6, 6, 2, a, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore(); return;
    }
    if (HAM) {                                    // семечка
      ctx.save(); ctx.translate(0, -34 - (R.headY || 0)); ctx.rotate(.4);
      ctx.fillStyle = '#4a3a2a'; ctx.beginPath(); ctx.ellipse(0, 0, 4, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e8e0d0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-1.5, -6); ctx.lineTo(-1.5, 6); ctx.moveTo(1.5, -6); ctx.lineTo(1.5, 6); ctx.stroke(); ctx.restore(); return;
    }
    if (BIRD) {                                   // зёрнышки на полу
      ctx.fillStyle = '#c9a85c'; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.ellipse(-18 + i * 6 + (i % 2) * 2, -1 - (i % 3), 2.2, 1.4, i, 0, Math.PI * 2); ctx.fill(); } return;
    }
    // миска перед котом/щенком
    const bx = 0, by = 2;
    ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(bx, by + 2, 24, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3f7fc9'; ctx.beginPath(); ctx.moveTo(bx - 22, by - 12); ctx.quadraticCurveTo(bx - 20, by + 2, bx, by + 2); ctx.quadraticCurveTo(bx + 20, by + 2, bx + 22, by - 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8b5a2b'; ctx.beginPath(); ctx.ellipse(bx, by - 12, 21, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b07a44'; for (const d of [-9, 0, 8]) { ctx.beginPath(); ctx.ellipse(bx + d, by - 13.5, 3.4, 2, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = '#2c5f99'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(bx, by - 12, 22, 5, 0, 0, Math.PI * 2); ctx.stroke();
  }
  function render(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    const M = localMatrix();
    if (lift < 90 && !hanging()) {               // тень на земле
      const k = 1 - lift / 90, rx = (BIRD ? 34 : HAM ? 40 : CLIP ? 28 : KUZYA ? 44 : ROUND ? 46 : CUSTOM ? 44 : 52) * SCALE * (R.pose === 'loaf' ? 1.25 : 1);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const cx = CX + offX, gr = ctx.createRadialGradient(cx, GY, 1, cx, GY, rx);
      gr.addColorStop(0, `rgba(0,0,0,${.2 * k})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.save(); ctx.translate(cx, GY); ctx.scale(1, .13); ctx.translate(-cx, -GY); ctx.beginPath(); ctx.arc(cx, GY, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.setTransform(M);
    drawWheel(false);
    info = window.drawChibi(ctx, Object.assign({ sp: SP, pal, t, look }, R));
    drawWheel(true);
    drawFood();
    drawSnow(); drawSeason(); drawSign();
    if (night() && gw > .3 && !DEMO && !FLY) {      // ночью гуляет с фонариком в лапе: корпус у лапы, луч вперёд-вниз
      const dir = face || 1, px = CX + offX + dir * 20, py = GY - 40 + offY;
      ctx.save(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const gr = ctx.createLinearGradient(px, py, px + dir * 80, py); gr.addColorStop(0, 'rgba(255,240,170,.3)'); gr.addColorStop(1, 'rgba(255,240,170,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(px + dir * 9, py - 3); ctx.lineTo(px + dir * 85, py - 14); ctx.lineTo(px + dir * 85, py + 22); ctx.lineTo(px + dir * 9, py + 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4a4a52'; ctx.beginPath(); ctx.roundRect(px - dir * 8 - (dir < 0 ? 0 : 0) - 8, py - 3.5, 16, 7, 2); ctx.fill();   // корпус
      ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.rect(px + dir * 6 - 1.5, py - 3.5, 3, 7); ctx.fill();   // стекло
      ctx.restore();
    }
  }

  // ---------- кадр параметров ----------
  function frameParams(dt, t) {
    const T0 = P[poseName] || P.sit, Tg = Object.assign({}, T0);
    if (A && A.mod) A.mod(Tg, (now() - A.t0) / 1000, t);
    const k = 1 - Math.exp(-(A && A.rate || 7) * dt);
    for (const key of KEYS) C[key] += (Tg[key] - C[key]) * k;
    C.pose = Tg.pose;
    Object.assign(R, C);
    // взгляд: в движении — по ходу, на месте — за курсором
    const moving = gw > .3 || (A && (A.name === 'soar' || A.name === 'chase'));
    const yawT = moving ? face * .55 : (A && A.watch ? clamp(look.x * .6, -.5, .5) : face * .12);
    yawS += (yawT - yawS) * Math.min(1, dt * 6);
    R.yaw = clamp(yawS + (Tg.yaw || 0), -1, 1);
    // походка: подпрыгивание, шаги лапами, покачивание
    const gs = GAITS[gait];
    if (gw > .01) {
      const ph = 2 * Math.PI * phase, hop = gs.hop;
      if (hop) { R.bob -= Math.abs(Math.sin(ph / 2)) * hop * gw; R.pawL += Math.max(0, Math.sin(ph / 2)) * gw; R.pawR += Math.max(0, Math.sin(ph / 2)) * gw; R.ear += .25 * gw; }
      else { R.bob -= Math.abs(Math.sin(ph)) * 2.5 * gw; R.pawL += Math.max(0, Math.sin(ph)) * gw; R.pawR += Math.max(0, -Math.sin(ph)) * gw; }
      R.tilt += Math.sin(ph) * (CHUBBY ? 5 : 3) * gw * face;
      R.headTilt += Math.sin(ph) * 2 * gw;
    }
    if (HAM && now() < cheekUntil) R.cheek = Math.max(R.cheek, .85);
    if (DRAGON && poseName === 'sleep') R.smoke = 1;
    const br = Math.sin(2 * Math.PI * t / (poseName === 'sleep' ? 3.6 : 2.2));
    R.squash *= 1 + br * (poseName === 'sleep' ? .012 : .006);
    if (A && A.watch && gw < .3) R.headTilt += clamp(look.x * 8, -8, 8) * (BIRD ? 2 : 1);
    R.ear += earTw * .4 * Math.sin(t * 40);
    R.eye *= (1 - blinkK) * (1 - slowBlink * .85);
    R.hat = poseName === 'hang' ? null : (HOL && HOL.hat) || (now() < bdayHat ? 'party' : null) || (weekCrown ? 'crown' : null);
    if (!contentMood() && (poseName === 'sit' || poseName === 'loaf') && !(A && A.mod)) { R.ear += .25; R.happy = 0; }   // грустноват, когда голоден или заброшен
  }

  // ---------- речь и эффекты ----------
  let bubbleTimer = 0;
  function say(text, ms = 1800) {
    if (inCall) return;                          // в звонке молчим
    if (quiet()) return;                         // тихий режим
    text = gd(text);
    bubble.classList.toggle('whisper', night());
    bubble.textContent = text; bubble.classList.toggle('long', text.length > 16); bubble.classList.add('on');
    clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => bubble.classList.remove('on'), ms);
  }
  function headCanvas() { return info ? toCanvas(info.head.x, info.head.y - info.head.r) : { x: CX, y: 60 }; }
  function fx(cls, text, dx, dy, ms) {
    const h = headCanvas(), el = document.createElement('div');
    el.className = 'fx ' + cls; el.textContent = text;
    el.style.left = clamp(h.x + dx, 4, W - 20) + 'px'; el.style.top = clamp(h.y + dy, 0, H - 20) + 'px';
    stage.appendChild(el); setTimeout(() => el.remove(), ms);
  }
  const hearts = (n = 3) => { for (let i = 0; i < n; i++) setTimeout(() => fx('heart', '❤', rnd(-24, 16), rnd(-10, 6), 1300), i * 220); };
  const mark = (s = '!') => fx('mark', s, 22, -18, 800);
  function placeBubble() { const h = headCanvas(); bubble.style.left = clamp(h.x, 70, W - 70) + 'px'; bubble.style.top = clamp(h.y - 40, 0, H - 40) + 'px'; }

  // ---------- звуки (синтез) ----------
  let AC = null, master = null, sound = true;
  const bufs = {};
  function ac() {
    if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = .4; master.connect(AC.destination); }   // .4: владельца пугало шипение
    if (AC.state === 'suspended' && AC.resume) AC.resume();
    return AC;
  }
  function voiced(f0s, dur, formants, vol = 1, type = 'sawtooth', vib = 7) {
    const pk = isBaby() ? 1.4 : 1; f0s = f0s.map(([tt, f]) => [tt, f * pk]); formants = formants.map(([q, pts, g]) => [q, pts.map(([tt, f]) => [tt, f * (pk > 1 ? 1.15 : 1)]), g]); dur = dur / (pk > 1 ? 1.15 : 1);
    const c = ac(), t = c.currentTime + .02, o = c.createOscillator(); o.type = type;
    f0s.forEach(([tt, f], i) => i ? o.frequency.linearRampToValueAtTime(f, t + tt * dur) : o.frequency.setValueAtTime(f, t));
    const lfo = c.createOscillator(); lfo.frequency.value = vib; const lg = c.createGain(); lg.gain.value = f0s[0][1] * .025; lfo.connect(lg).connect(o.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(.06, dur * .2)); g.gain.setValueAtTime(vol, t + dur * .6); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    for (const [q, pts, gain] of formants) {
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
      pts.forEach(([tt, fr], i) => i ? f.frequency.linearRampToValueAtTime(fr, t + tt * dur) : f.frequency.setValueAtTime(fr, t));
      const fg = c.createGain(); fg.gain.value = gain; o.connect(f).connect(fg).connect(g);
    }
    g.connect(master); o.start(t); lfo.start(t); o.stop(t + dur + .05); lfo.stop(t + dur + .05);
  }
  function tone(pts, dur, vol = .3, type = 'sine', vib = 0, delay = 0) {
    if (isBaby()) pts = pts.map(([tt, f]) => [tt, f * 1.3]);
    const c = ac(), t = c.currentTime + .02 + delay, o = c.createOscillator(), g = c.createGain(); o.type = type;
    pts.forEach(([tt, f], i) => i ? o.frequency.linearRampToValueAtTime(f, t + tt * dur) : o.frequency.setValueAtTime(f, t));
    if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = vib; lg.gain.value = pts[0][1] * .02; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + .05); }
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(.02, dur * .2)); g.gain.setValueAtTime(vol, t + dur * .7); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + .05);
  }
  function noise(name, sec, fn, vol) {
    const c = ac();
    if (!bufs[name]) {
      const n = Math.floor(c.sampleRate * sec), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
      let lp = 0; for (let i = 0; i < n; i++) { const tt = i / c.sampleRate, r = Math.random() * 2 - 1; lp += (r - lp) * .04; d[i] = fn(tt, r, lp, sec); }
      bufs[name] = b;
    }
    const s = c.createBufferSource(), g = c.createGain(); g.gain.value = vol; s.buffer = bufs[name]; s.connect(g).connect(master); s.start();
  }
  // записанные звуки (CC0, OpenGameArt: «Cat Purr & Meow», «80 CC0 creature SFX») — dist/sounds/*.ogg;
  // если файл не загрузился, остаётся синтез
  const samples = {};
  function sample(names, vol = .9, fallback) {
    const c = ac(), name = pick(names);
    const go = buf => { const s = c.createBufferSource(), g = c.createGain(); g.gain.value = vol; s.buffer = buf; s.playbackRate.value = isBaby() ? 1.35 : 1; s.connect(g).connect(master); s.start(); };
    if (samples[name]) return go(samples[name]);
    fetch('sounds/' + name + '.ogg').then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))).then(ab => c.decodeAudioData(ab)).then(buf => { samples[name] = buf; go(buf); })
      .catch(() => { samples[name] = null; if (fallback) fallback(); });
  }
  const SYN = {
    meow() { const f0 = rnd(480, 600), d = rnd(.5, .75); voiced([[0, f0 * .8], [.3, f0 * 1.3], [1, f0 * .85]], d, [[4, [[0, 350], [.35, 950], [1, 420]], 1], [5, [[0, 2400], [.4, 1500], [1, 850]], .55]]); },
    purr() { noise('purr', 2.6, (t, r, lp, T) => lp * 3.2 * Math.pow(.5 + .5 * Math.sin(2 * Math.PI * 25 * t), 3) * (.6 + .4 * Math.sin(2 * Math.PI * t / 1.3)) * Math.min(1, t / .3, (T - t) / .5), .8); },
    hiss() { noise('hiss', .8, (t, r, lp, T) => (r - lp) * .35 * Math.min(1, t / .05, (T - t) / .3), .35); },
    bark(n = 2) { for (let i = 0; i < n; i++) setTimeout(() => { const f0 = rnd(520, 640);
      voiced([[0, f0], [.25, f0 * 1.15], [1, f0 * .7]], .13, [[3, [[0, 1100], [1, 800]], 1.2], [4, [[0, 2300], [1, 1700]], .6]], 1, 'sawtooth', 3);
      noise('barkn' + i, .1, (t, r) => r * .25 * Math.exp(-t * 30), .6); }, i * 190); },
    whine() { voiced([[0, 900], [.4, 1250], [1, 850]], .9, [[2, [[0, 1200], [1, 1000]], 1]], .5, 'triangle', 9); },
    pant() { noise('pant', 1.6, (t, r, lp, T) => (r - lp) * .28 * Math.pow(Math.max(0, Math.sin(2 * Math.PI * 3.2 * t)), 2) * Math.min(1, (T - t) / .3), .6); },
    squeak(n = 2) { for (let i = 0; i < n; i++) { const f = rnd(2600, 3300); tone([[0, f], [.5, f * 1.25], [1, f * 1.05]], rnd(.06, .1), .22, 'sine', 0, i * .13); } },
    chirp(n = 3) { for (let i = 0; i < n; i++) { const f = rnd(2800, 3600); tone([[0, f], [1, f * 1.35]], .07, .2, 'sine', 0, i * .1); } },
    talk(n = 0) { n = n || Math.floor(rnd(3, 6));
      for (let i = 0; i < n; i++) setTimeout(() => { const f0 = rnd(650, 950), d = rnd(.08, .15), a = rnd(300, 900), b = rnd(900, 2600);
        voiced([[0, f0], [1, f0 * rnd(.85, 1.2)]], d, [[4, [[0, a], [1, a * rnd(.7, 1.4)]], 1], [6, [[0, b], [1, b * rnd(.7, 1.3)]], .7]], .8, 'sawtooth', 5); }, i * rnd(110, 160)); },
    whistle() { const notes = pick([[659, 784, 880, 784, 659, 523, 587, 659], [523, 659, 784, 1047, 784, 1047], [880, 784, 698, 659, 587, 523]]);
      notes.forEach((f, i) => tone([[0, f * 2], [1, f * 2 * 1.01]], .17, .2, 'sine', 6, i * .19)); },
    honk(n = 2) { for (let i = 0; i < n; i++) tone([[0, 170], [1, 140]], .09, .25, 'sawtooth', 40, i * .14); },
    thump() { tone([[0, 90], [1, 45]], .12, .6, 'sine'); },
    giggle(n = 3) { for (let i = 0; i < n; i++) tone([[0, 900 + i * 60], [.5, 1250], [1, 950]], .09, .2, 'sine', 6, i * .12); },
    boing(n = 1) { for (let i = 0; i < n; i++) tone([[0, 180], [.2, 420], [1, 220]], .22, .3, 'triangle', 12, i * .25); },
    knock(n = 2) { for (let i = 0; i < n; i++) { tone([[0, 220], [1, 120]], .06, .5, 'sine', 0, i * .18); noise('knock' + i, .05, (t, r) => r * .3 * Math.exp(-t * 60), .7, i * .18); } },
    roar(n = 1) { const f0 = rnd(95, 130); voiced([[0, f0 * .8], [.3, f0 * 1.25], [1, f0 * .7]], rnd(.7, 1), [[3, [[0, 300], [.4, 700], [1, 350]], 1.2], [4, [[0, 1600], [1, 900]], .5]], 1, 'sawtooth', 7);
      noise('roarn', .9, (t, r, lp, T) => lp * 2.2 * Math.min(1, t / .1, (T - t) / .4) * (.7 + .3 * Math.sin(2 * Math.PI * 28 * t)), .7); },
    fire() { noise('fire', 1.4, (t, r, lp, T) => (r * .35 + lp * 1.6) * Math.min(1, t / .08, (T - t) / .5) * (.8 + .2 * Math.sin(2 * Math.PI * 9 * t)), .8); },
    sneeze() { noise('sneeze', .35, (t, r) => (r * .5) * Math.min(1, t / .02, (.35 - t) / .2), .9); tone([[0, 700], [1, 300]], .18, .25, 'triangle', 8, .05); },
    crunch() { noise('crunch', .9, (t, r) => r * .3 * Math.pow(Math.max(0, Math.sin(2 * Math.PI * 7 * t)), 8), .7); },
  };
  const SND = Object.assign({}, SYN, {
    meow() { sample(['meow1', 'meow2', 'meow3', 'meow4'], .9, () => SYN.meow()); },
    purr() { sample(['purr', 'purr2'], .7, () => SYN.purr()); },
    bark(n) { sample(['bark1', 'bark2'], .8, () => SYN.bark(n)); },
    roar(n) { sample(['roar1', 'roar2', 'roar3'], .8, () => SYN.roar(n)); },
    crunch() { sample(['eat1', 'eat2'], .7, () => SYN.crunch()); },
    giggle(n) { sample(['cute1', 'cute2', 'cute3'], .7, () => SYN.giggle(n)); },
    snore() { sample(['snore'], .5); },
    howl() { sample(['howl'], .7); },
  });
  let lastAuto = 0;
  function play(name, user, ...a) {
    if (!sound || inCall) return;
    if (!user && now() - lastAuto < 150000) return;               // сам по себе — не чаще раза в 2,5 минуты
    if (!user) lastAuto = now();
    try { SND[name](...a); } catch (e) { console.error(e); }
  }

  // ---------- что говорит ----------
  const TXT = {
    cat: { voice: ['Мяу!', 'Мяяяу~', 'Мя!', 'Мрряу?'], snd: 'meow', eat: 'Ням-ням!', thanks: 'Спасибо! Мрр', petSay: ['Мррр…', 'Мур-мур', 'Ещё!', 'Мрррр ♥'], petSnd: 'purr',
      pick: ['Ой!', 'Мяу?!', 'Пусти!', 'Лечу!'], thrown: 'Мяяя!', drop: 'Ой!', landHard: 'Мяу! Я цел{|а}.', wake: ['А? Что?', 'Я не сплю!', 'Мрр?'], come: 'Иду…', play: 'Мышка!', tired: 'Уф, уста{л|ла}…',
      phrases: ['Вы пробовали выключить и включить?', 'Мяу. Заявка принята.', 'Сервер тёплый, я посижу', 'Клавиатура — лучшая лежанка', 'Это не баг, это фича', 'Где мой корм?', 'Погладь меня', 'Работаю. Не мешай.', 'Мрр…'] },
    dog: { voice: ['Гав!', 'Гав-гав!', 'Тяф!', 'Ав!'], snd: 'bark', eat: 'Ням-ням-ням!', thanks: 'Спасибо! Гав!', petSay: ['Ещё! Ещё!', 'Ура, гладят!', 'Я хорош{ий|ая}!', 'Лизь!'], petSnd: 'pant',
      pick: ['Ой!', 'Мы летим?', 'Вуф!'], thrown: 'Уииии!', drop: 'Ой-ой!', landHard: 'Бум! Ещё!', wake: ['А? Гулять?', 'Я не сплю!'], come: 'Бегу-бегу!', play: 'Догоню!', tired: 'Уф! Ещё поиграем?',
      phrases: ['Кто хороший мальчик? Я!', 'Гулять?!', 'Где мячик?', 'Я охраняю сервер', 'Можно я тут полежу?', 'Хвост сам виляет', 'Поиграем?', 'Гав. Заявка принята.'] },
    hamster: { voice: ['Пи!', 'Пи-пи!', 'Пииии?'], snd: 'squeak', eat: 'Хрум-хрум!', thanks: 'Запасы пополнены!', petSay: ['Пи ♥', 'Мягко!', 'Ещё почеши!'], petSnd: 'squeak',
      pick: ['Пи!!', 'Я маленьк{ий|ая}!', 'Ой-ой!'], thrown: 'Пиииии!', drop: 'Пи!', landHard: 'Я цел{|а}! Пи.', wake: ['Пи? Утро?', 'Я не сплю!'], come: 'Бегу-бегу!', play: 'Догоню!', tired: 'Пых… пых…',
      phrases: ['Где мои семечки?', 'Щёки полные — жизнь удалась', 'Я не толст{ый|ая}, это запасы', 'Колесо — моя жизнь', 'Спрята{л|ла} орешек. Где — не скажу', 'Пи. Заявка принята.', 'Я тут всё погрызу'] },
    rabbit: { voice: ['Фыр!', 'Хрум!', 'Прыг!'], snd: 'honk', eat: 'Морковка!', thanks: 'Хрум-хрум, спасибо!', petSay: ['Мягко…', 'Ещё за ушком!', 'Скрип-скрип (это от счастья)'], petSnd: 'crunch',
      pick: ['Ой! Уши!', 'Поставь!', 'Фыр!'], thrown: 'Уиии!', drop: 'Прыг!', landHard: 'Я в порядке!', wake: ['А? Морковка?', 'Я не сплю!'], come: 'Прыг-скок!', play: 'Догоню!', tired: 'Фух…',
      phrases: ['Морковку не видели?', 'Уши на макушке', 'Прыг-скок, заявка в работе', 'Я пушист{ый|ая} и делов{ой|ая}', 'Всё погрызу. Кроме проводов. Наверное.', 'Капуста — это жизнь', 'Бинки!'] },
    custom: { voice: ['Привет!', 'Я тут!', 'Эй!', 'Ку-ку!'], snd: 'boing', eat: 'Вкусно!', thanks: 'Спасибо!', petSay: ['Приятно!', 'Ещё!', 'Мр-р', 'Хорошо-то как'], petSnd: 'giggle',
      pick: ['Ой!', 'Куда меня?', 'Эй-эй!'], thrown: 'Лечу-у!', drop: 'Оп!', landHard: 'Приземлил{ся|ась}', wake: ['А? Что?', 'Я не спал{|а}'], come: 'Иду!', play: 'Поймаю!', tired: 'Уф…',
      phrases: ['Я с твоей картинки. Живой!', 'Как дела?', 'Отличный день', 'Заявка принята', 'Пойду прогуляюсь по экрану', 'Ты молодец', 'Скучаешь? Я рядом', 'Погладь меня'] },
    round: { voice: ['Ура!', 'Эге-гей!', 'Привет-привет!', 'Хи-хи!'], snd: 'boing', eat: 'Вкусняшка!', thanks: 'Спасибо! Объеденье', petSay: ['Хи-хи!', 'Ещё-ещё!', 'Как приятно', 'Я круглый и довольный'], petSnd: 'giggle',
      pick: ['Ой! Я качусь!', 'Ай!', 'Поставь на место!'], thrown: 'Кааатимся!', drop: 'Плюх!', landHard: 'Бум! Я же круглый', wake: ['А? Уже утро?', 'Я не спал, я думал'], come: 'Качусь!', play: 'Догоню!', tired: 'Укатался…',
      phrases: ['Хочу приключений!', 'Кто со мной на речку?', 'Морковка — это сила', 'Где мои друзья?', 'Сегодня отличный день', 'Бум! Заявка принята', 'Круглое — не тонет. Проверено', 'Прыгать — полезно', 'Ой, что-то придумал!', 'Пойду покачусь'] },
    kuzya: { voice: ['Ой!', 'Нафаня!', 'Хи-хи!', 'Ай-яй-яй!'], snd: 'giggle', eat: 'Пирожки!', thanks: 'Спасибо! С капустой?', petSay: ['Хи-хи, щекотно!', 'Ну хватит, хватит', 'Ой, приятно', 'Я не игрушка! …ладно, ещё'], petSnd: 'giggle',
      pick: ['Ой! Пусти!', 'Ай! Кто это?', 'Караул, домовых крадут!'], thrown: 'Ой-ой-о-ой!', drop: 'Уф!', landHard: 'Ой, беда-беда, огорчение!', wake: ['А? Кто?', 'Я не сплю, я думаю', 'Уже утро?'], come: 'Бегу-бегу!', play: 'Поймаю!', tired: 'Уф, устал…',
      phrases: ['Ой, беда-беда, огорчение!', 'Счастье — это когда у тебя всё дома', 'Я не жадный, я домовитый', 'Сказки — в сундучке, пирожки — в животе', 'Нафаня! Пойдём домой!', 'Кто в доме хозяин? Домовой!', 'Порядок в доме — порядок в голове', 'Не ешь много, лопнешь', 'Хочу пирожков. Не хочу работать. Хочу пирожков', 'Сервер — тоже дом. Приберу'] },
    clippy: { voice: ['Похоже, вы что-то делаете!', 'Помочь?', 'Я тут!', 'Тук-тук'], snd: 'boing', eat: 'Скрепки не едят. Но спасибо', thanks: 'Записал в подсказки', petSay: ['Хе-хе', 'Щекотно, я железный', 'Ещё! Ой, погнулся', 'Полировка!'], petSnd: 'boing',
      pick: ['Эй! Я не для этого!', 'Осторожно, погнёте', 'Ой!'], thrown: 'Полете-е-ел!', drop: 'Дзынь!', landHard: 'Дзынь. Всё цело', wake: ['Похоже, вы вернулись!', 'Я не спал, я думал'], come: 'Уже иду!', play: 'Догоню!', tired: 'Пружина села…',
      phrases: ['Похоже, вы пишете письмо. Помочь?', 'Похоже, вы пишете код. Сочувствую', 'Сохранить документ? Шучу, сохранил', 'Совет дня: перезагрузка лечит всё', 'Похоже, вы устали. Помочь?', 'Я видел вещи… В Word 97', 'Формат? Какой формат?', 'Хотите, скреплю?', 'Дзынь. Заявка принята', 'Помощник на месте. Куда идём?'] },
    dragon: { voice: ['Рррр!', 'Гррр-ау!', 'Рраф!', 'Фух-х!'], snd: 'roar', eat: 'Хрум! Горячее!', thanks: 'Спасибо! Ррр ♥', petSay: ['Урррр…', 'Чешуйка довольна', 'Ещё за рожками!', 'Тепло-о'], petSnd: 'purr',
      pick: ['Эй!', 'Я сам{|а} умею летать!', 'Ррр?'], thrown: 'Полете-ел{|а}!', drop: 'Крылья!', landHard: 'Приземлил{ся|ась}. Ррр.', wake: ['Кто тут?', 'Я не сплю, я грею'], come: 'Лечу!', play: 'Поймаю!', tired: 'Фух, огонь кончился…',
      phrases: ['Сервер горячий? Это не я', 'Золота нет — сойдут скрепки', 'Дыхну на кофе — будет горячий', 'Рыцари не приходили?', 'Заявка сожжена. Шучу. Принята', 'Пещеру бы. Или хотя бы коробку', 'Я маленьк{ий|ая}, но огнедышащ{ий|ая}', 'Чешуя блестит — день удался'] },
    bird: { voice: ['Привет!', 'Кеша хорош{ий|ая}!', 'Попка дурак!', 'Пиастры!', 'Алло!'], snd: 'talk', eat: 'Семечки!', thanks: 'Спасибо! Сыт{|а}!', petSay: ['Хорош{ий|ая}!', 'Чеши ещё!', 'Урррр'], petSnd: 'chirp',
      pick: ['Караул!', 'Отпусти!', 'Кррр!'], thrown: 'Лечууу!', drop: 'Свобода!', landHard: 'Се{л|ла}!', wake: ['Кто тут?', 'Доброе утро!'], come: 'Лечу!', play: 'Поймаю!', tired: 'Уста{л|ла}…',
      phrases: ['Сервер упал!', 'Перезагрузи!', 'Кто там?', 'Алло! Алло!', 'Дай орешек!', 'Ку-ку!', 'Попка дурак!', 'Пиастры! Пиастры!', 'Где заявка?', 'Работать!'] },
  };
  const TX = () => TXT[SP];
  // «разноцветный помёт»: новый питомец рождается со своими вариациями окраса и сохраняет их
  if (PET.look === 'litter' && !DEMO && !PET.guest && window.LOOKS) {
    setTimeout(() => portalEvent('newpet', { pet: NAME }), 8000);
    const base = (window.PALETTES[SP] || window.PALETTES.cat)[PET.color % (window.PALETTES[SP] || window.PALETTES.cat).length];
    const lk = window.LOOKS.litterLook(SP, base.fur); PET.fur = lk.furVar; delete lk.furVar; PET.look = JSON.stringify(lk);
    configure();
    if (invoke && !PET.guest) invoke('pet_update', { label: PET.label, color: PET.color, build: PET.build || 'normal', fur: PET.fur, name: PET.name || '', sex: PET.sex || '', look: PET.look }).catch(e => console.error(e));
  }
  // ---------- уход: голод, ласка, игра; режим дня ----------
  const careKey = 'care:' + PET.label;
  let care = { fed: Date.now(), pet: Date.now(), play: Date.now() };
  try { const c = JSON.parse(localStorage.getItem(careKey) || 'null'); if (c && typeof c.fed === 'number') care = c; } catch (_) { /* нет сохранения — начинаем сытыми */ }
  const careNow = () => Date.now();
  function careMark(k) { care[k] = careNow(); try { localStorage.setItem(careKey, JSON.stringify(care)); } catch (_) { /* приватный режим */ } }
  if (!care.pet) care.pet = careNow(); if (!care.play) care.play = careNow();
  const hungry = () => careNow() - care.fed > (isBaby() ? 1.2 : 2.5) * 3600e3, lonely = () => careNow() - care.pet > 4 * 3600e3, bored = () => careNow() - care.play > 5 * 3600e3;
  const contentMood = () => !hungry() && !lonely() && !bored();
  const night = () => { const h = new Date().getHours(); return h >= 22 || h < 7; };
  let lastNag = -1e9;
  function nag() {                               // попросить о чём-то — не чаще раза в 8 минут, без нытья
    lastNag = now();
    if (hungry()) { start('hungry', { pose: 'sit', dur: 4500, watch: true, mod: (T_, q) => { T_.happy = 0; T_.ear = .45; T_.headTilt += Math.sin(q * 1.5) * 8; T_.tail = 3; } });
      return say(pick(['Кушать хочется…', 'Миска пустая. Просто говорю', 'Я бы поел{|а}', 'Помнишь про еду? Я помню']), 3200); }
    if (lonely()) { start('lonely', { pose: 'sit', dur: 4500, watch: true, mod: (T_, q) => { T_.headTilt += Math.sin(q * 1.2) * 10; T_.ear = .3; } });
      return say(pick(['Погладь меня?', 'Я тут. Один{|одна}. Пушист{ый|ая}', 'Можно немножко внимания?']), 3200); }
    if (bored()) { if (DOG) return acts.bow(); start('bored', { pose: 'sit', dur: 4000, watch: true, mod: (T_, q) => { T_.headTilt += Math.sin(q * 2) * 6; } });
      return say(pick(['Поиграем?', 'Скучно…', 'Мячик? Лазер? Хоть что-нибудь']), 3200); }
  }
  // ---------- достижения и здоровье ----------
  // Счётчики живут в localStorage (общий для окон приложения — окно «Питомцы» их читает).
  // Бейдж выдаётся один раз, с фанфарами; здоровье падает от долгого голода и скуки, лечится
  // из трея («Лечить»), вес растёт от перекорма и уходит от игр.
  const achKey = 'ach:' + PET.label;
  let ach = { n: {}, got: [] };
  try { const a = JSON.parse(localStorage.getItem(achKey) || 'null'); if (a && a.n) ach = a; } catch (_) { /* без сохранения — без бейджей */ }
  const BADGES = [
    ['fed', 1, '🍽', 'Первая миска'], ['fed', 50, '🍲', 'Полсотни обедов'], ['fed', 300, '🥘', 'Гурман'],
    ['pet', 1, '🤚', 'Первая ласка'], ['pet', 100, '💖', 'Залюбленный'], ['pet', 1000, '💞', 'Обожаемый'],
    ['play', 10, '🎾', 'Игрун'], ['play', 100, '🏆', 'Чемпион игр'],
    ['butterfly', 1, '🦋', 'Первая бабочка'], ['butterfly', 50, '🦋', 'Гроза бабочек'], ['mouse', 1, '🐭', 'Первая мышь'], ['mouse', 20, '🧀', 'Мышелов (почти)'],
    ['shell', 10, '🥚', 'Угадайка'], ['pomo', 10, '🍅', 'Десять помидоров'], ['pomo', 100, '🍅', 'Сто помидоров'],
    ['hide', 5, '🙈', 'Мастер пряток'], ['visit', 1, '🚪', 'Первый визит'], ['visit', 10, '🧳', 'Путешественник'],
    ['guest', 1, '🛎', 'Первый гость'], ['guest', 10, '🏠', 'Гостеприимный'], ['gift', 5, '🎁', 'Щедрый'], ['giftGet', 1, '🎀', 'Первый подарок'], ['giftGet', 10, '💝', 'Любимчик'], ['learn', 1, '🎓', 'Ученик'], ['learn', 5, '🎓', 'Отличник'], ['quest', 7, '🎯', 'Неделя заданий'], ['quest', 30, '🏆', 'Месяц заданий'],
    ['photo', 1, '📷', 'Фотомодель'], ['relay', 3, '🧶', 'Эстафетная команда'], ['duet', 3, '🎪', 'Цирк'], ['netball', 5, '🏓', 'Пинг-понг'], ['race', 3, '🏁', 'Бегун'], ['days', 7, '📅', 'Неделя вместе'], ['days', 30, '🗓', 'Месяц вместе'], ['days', 100, '💯', 'Сто дней вместе'], ['days', 365, '🎂', 'Год вместе'],
    ['perch', 1, '🪟', 'На подоконнике'], ['cure', 1, '💊', 'Выздоровел'], ['nest', 10, '🪺', 'Строитель'], ['grown', 1, '🌱', 'Вырос'],
  ];
  const careSave = () => { try { localStorage.setItem(careKey, JSON.stringify(care)); } catch (_) { /* приватный режим */ } };   // сохранить care без правки отметок времени
  function achSave() { try { localStorage.setItem(achKey, JSON.stringify(ach)); } catch (_) { /* приватный режим */ } }
  function achCount(k, d = 1) {
    if (GUEST || DEMO) return;
    ach.n[k] = (ach.n[k] || 0) + d;
    for (const [key, need, ico, title] of BADGES) {
      const id = key + need;
      if (key === k && ach.n[k] >= need && !ach.got.includes(id)) { ach.got.push(id); achSave(); setTimeout(() => badgeShow(ico, title), 1200); return; }
    }
    achSave();
  }
  async function portalEvent(kind, data) { if (DEMO || GUEST || !invoke) return; try { if (!me) me = await invoke('whoami'); await portal('POST', '/event', Object.assign({ client: me.client, kind, pet: NAME }, data || {})); } catch (_) { /* портал недоступен */ } }
  function badgeShow(ico, title) {
    portalEvent('badge', { title });
    hearts(3); for (let i = 0; i < 6; i++) setTimeout(() => fx('zzz', pick(['✦', '★', '✧']), rnd(-40, 40), rnd(-20, 10), 1500), i * 150);
    say(`${ico} Достижение: «${title}»!`, 3600); play(TX().petSnd, false);
  }
  setInterval(() => { if (!GUEST && !DEMO) { const d = Math.floor(AGE); if ((ach.n.days || 0) < d) { ach.n.days = d; achCount('days', 0); } } }, 60000);
  // здоровье 0–100 и вес −3…3 — в care
  if (typeof care.health !== 'number') care.health = 100;
  if (typeof care.weight !== 'number') care.weight = 0;
  let lastSick = -1e9, cured = false;
  const sick = () => care.health < 40;
  function sickTick() {
    if (GUEST || DEMO) return;
    const h0 = care.health, hrs = (careNow() - care.fed) / 3600e3;
    if (hrs > 30) care.health = Math.max(0, care.health - 2); else if (care.health < 100 && !hungry() && !bored()) care.health = Math.min(100, care.health + 1);
    if ((careNow() - care.play) / 3600e3 > 48) care.health = Math.max(0, care.health - 1);
    if (care.health !== h0) careSave();
    if (sick() && now() - lastSick > 15 * 60000 && !busy()) { lastSick = now(); sickShow(); }
  }
  // Болеет каждый по-своему (раз в 15 минут): кот чихает и лежит, пёс скулит носом в лапы, птица нахохлилась,
  // хомяк спит, кролик с висячими ушами, дракон кашляет дымом без огня, Кузя простыл, Скрепыш «обнаружил ошибку».
  function sickShow() {
    fx('mark', '🤒', 0, -30, 2600);
    const lie = (ms, mod) => start('sick', { pose: 'loaf', dur: ms, watch: false, mod: (T_, q) => { T_.eye = .35; T_.ear = .6; T_.happy = 0; if (mod) mod(T_, q); } });
    if (CAT) { acts.sneeze(); setTimeout(() => { say(pick(['Носик тёплый. Полечи меня?', 'Кажется, я заболел{|а}', 'Ффф… ничего не хочу']), 3200); lie(8000); }, 1800); return; }
    if (DOG) { play('whine', true); say(pick(['Скулю… Мне плохо', 'Хвост не поднимается', 'Полечи меня, а?']), 3200); return lie(8000, (T_) => { T_.headY = 8; T_.tail = -10; }); }
    if (BIRD) { say(pick(['Нахохлил{ся|ась}… нездоровится', 'Пёрышки дыбом. Полечи', 'Чирикать не хочется']), 3200); return start('sick', { pose: 'sit', dur: 8000, watch: false, mod: (T_) => { T_.puff = 1.35; T_.eye = .3; T_.crest = 0; T_.happy = 0; } }); }
    if (HAM) { say(pick(['Пи… спать хочу', 'Щёчки пустые, сил нет', 'Полечи, пи']), 3000); return lie(9000); }
    if (RAB) { say(pick(['Ушки висят…', 'Морковка не лезет. Болею', 'Полечи меня']), 3000); return lie(8000, (T_) => { T_.ear = 1; }); }
    if (DRAGON) { say(pick(['Кхе… огонь пропал', 'Дымлю, а не горю', 'Простыл{|а}, полечи']), 3200); fx('zzz', '💨', 20, -30, 1400); setTimeout(() => fx('zzz', '💨', 24, -34, 1400), 900); return start('sick', { pose: 'sit', dur: 7000, watch: false, mod: (T_, q) => { T_.smoke = .6; T_.glow = 0; T_.eye = .4; T_.happy = 0; T_.bob += (q % 2 < .3 ? Math.sin(q * 20) * 2 : 0); } }); }
    if (KUZYA) { say(pick(['Простыл, кхе. Малины бы с мёдом', 'Хвораю, хозяин', 'Лежать буду. Не тревожь']), 3200); return lie(8000); }
    if (CLIP) { say(pick(['Обнаружена ошибка: здоровье ниже нормы', 'Похоже, я приболел. Нажать «Полечить»?', 'Требуется обслуживание']), 3200); return start('sick', { pose: 'sit', dur: 6000, watch: false, mod: (T_, q) => { T_.tilt = Math.sin(q * 3) * 6; T_.eye = .5; } }); }
    say(pick(['Апчхи… что-то мне нехорошо', 'Кажется, я заболел{|а}', 'Носик тёплый. Полечи меня?']), 3200); lie(7000);
  }
  setInterval(sickTick, 5 * 60000);
  setInterval(() => { if (sick() && !GUEST && !DEMO && Math.random() < .3) fx('mark', pick(['🤧', '🌡']), 4, -28, 2000); }, 60000);   // больной виден и между приступами
  function cure() {                             // ветеринар: градусник (2 с), таблетка, глотает, здоров
    if (GUEST) return;
    const was = sick(); focus(9000);
    say(pick(['Ой, доктор…', 'Только не укол!', 'Ну ладно, лечите']), 1800); fx('mark', '🌡', 18, -26, 2200);
    start('vet', { pose: 'sit', dur: 2200, watch: false, mod: (T_, q) => { T_.eye = .6; T_.ear = .3; T_.headTilt = 8; T_.mouth = 0; T_.happy = 0; T_.bob += Math.sin(q * 25) * .6; },
      after: () => {
        fx('zzz', '💊', 6, -20, 1200);
        start('gulp', { pose: 'eat', dur: 1300, rate: 10, mod: (T_, q) => { T_.mouth = q < .5 ? .7 : .1; T_.headY = q < .5 ? 6 : 0; T_.armL = q < .5 ? .9 : 0; T_.armR = 0; },
          after: () => {
            care.health = 100; careSave(); cured = true;
            say(was ? pick(['Фу, горькая! Но полегчало', 'Спасибо, доктор', 'Ам. Здоров{|а}!']) : pick(['Я и не болел{|а}. Но спасибо', 'Витаминка? Мрр', 'Для профилактики, ага']), 2600); hearts(3); if (was) achCount('cure');
            start('well', { pose: 'sit', dur: 2500, watch: true, mod: (T_, q) => { T_.happy = 1; T_.tail = 25; T_.headTilt = Math.sin(q * 3) * 6; } });
          } });
      } });
  }
  function weightTick(d) {
    care.weight = clamp((care.weight || 0) + d, -3, 3); careSave();
    if (care.weight >= 3 && d > 0) say(pick(['Кажется, я растолстел{|ла}…', 'Диета с понедельника', 'Это не живот, это запасы']), 2600);
    if (care.weight <= -3 && d < 0) say(pick(['Похудел{|а}! Покорми', 'Одни кости', 'Где обед?']), 2600);
  }
  function weightK() { try { return 1 + (care.weight || 0) * .03; } catch (_) { return 1; } }   // объявление, не const: configure() зовётся из блока «помёт» раньше этого места
  if (!DEMO && !GUEST && invoke && T && T.event) T.event.listen('cure', () => { if (PET.label === leaderLabel() || sick()) cure(); });
  // ---------- тихий режим, голос, трюки, ночь ----------
  let quietUntil = 0, ttsOn = false, lastSpoke = -1e9;
  // Тихие часы по расписанию: localStorage quiet:from / quiet:to (ЧЧ:ММ, ежедневно, через полночь можно)
  let qsched = null, qschedAt = -1e9;
  function quietSched() {
    if (now() - qschedAt > 30000) { qschedAt = now(); try { const f = localStorage.getItem('quiet:from') || '', t = localStorage.getItem('quiet:to') || ''; qsched = /^\d\d:\d\d$/.test(f) && /^\d\d:\d\d$/.test(t) && f !== t ? [f, t] : null; } catch (_) { qsched = null; } }
    if (!qsched) return false;
    const d = new Date(), hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), [f, t] = qsched;
    return f < t ? (hm >= f && hm < t) : (hm >= f || hm < t);
  }
  function quiet() { try { return now() < quietUntil || quietSched(); } catch (_) { return false; } }
  // Озвучка: только длинные «человеческие» реплики (подбадривания, фразы, напоминания), только старший
  // питомец, не чаще раза в 20 с, чтобы не тараторить.
  function speak(text) {
    if (!ttsOn || DEMO || GUEST || !invoke || quiet() || inCall || PET.label !== leaderLabel() || now() - lastSpoke < 20000) return;
    lastSpoke = now(); invoke('speak', { text: gd(text).replace(/[«»]/g, '') }).catch(() => {});
  }
  // трюки: команда из трея → показ; после пяти показов трюк «выучен» и питомец делает его сам
  const TRICKS = {
    sit: { title: 'Сидеть', say: ['Сижу!', 'Вот так?', 'Сел{|а}, сел{|а}'], act: () => start('trick', { pose: 'up', dur: 3000, rate: 8, mod: (T_, q) => { T_.armL = T_.armR = .3; T_.headTilt = Math.sin(q * 2) * 4; T_.happy = q > 1.5 ? .6 : 0; } }) },
    paw: { title: 'Дай лапу', say: ['Лапу!', 'Держи', 'Вот лапа'], act: () => start('trick', { pose: 'sit', dur: 2800, rate: 10, mod: (T_, q) => { T_.armR = q < 2.2 ? .95 : 0; T_.headTilt = 8; T_.happy = .4; } }) },
    roll: { title: 'Кувырок', say: ['Оп-па!', 'Кувырок!', 'Вжух'], act: () => start('trick', { pose: 'stand', dur: 1800, rate: 14, mod: (T_, q) => { T_.tilt = q < 1.2 ? -face * (q / 1.2) * 360 : 0; T_.squash = .92; T_.bob += Math.sin(q * 5) * 6; }, after: () => { hearts(1); acts.sit(2000); } }) },
    voice: { title: 'Голос', say: null, act: () => acts.voice(true) },
    dance: { title: 'Танцуй', say: ['♪ Ла-ла ♪', 'Диско!', 'Танцуем!'], act: () => start('trick', { pose: 'sit', dur: rnd(4000, 6000), mod: (T_, q) => { T_.bob += Math.sin(q * 13) * 2; T_.headY += Math.sin(q * 13 + 1) * 3.5; T_.headTilt = Math.sin(q * 6.5) * 16; T_.ear = Math.sin(q * 6.5); T_.yaw = Math.sin(q * 3.2) * .4; T_.armL = Math.max(0, Math.sin(q * 6.5)); T_.armR = Math.max(0, -Math.sin(q * 6.5)); },
      tick: (dt, q) => { if (Math.floor(q * 2) !== A.nq) { A.nq = Math.floor(q * 2); fx('zzz', '♪', rnd(-20, 14), -12, 1800); } } }) },
  };
  const trickLearned = k => (ach.n['trick_' + k] || 0) >= 5;
  function trick(k, byUser, byGuest) {
    const tr = TRICKS[k]; if (!tr || (GUEST && !byGuest)) return;
    if (busy() && !byUser) return;
    tr.act(); if (tr.say) say(pick(tr.say), 1600);
    if (!GUEST && !byGuest) { const s = S(); for (const f of friends.values()) if (now() - f.t < 3000 && f.baby && f.label !== 'guest' && Math.hypot(f.x - x, f.y - y) / s < 700 && T && T.event) T.event.emit('pet-play', { kind: 'trick', to: f.label, from: PET.label, name: k, guestName: NAME, parent: true }).catch(() => {}); }   // малыши учатся у родителей
    if (byUser) { ach.n['trick_' + k] = (ach.n['trick_' + k] || 0) + 1; ach.n.trickAny = (ach.n.trickAny || 0) + 1; achSave(); if (ach.n['trick_' + k] === 5) { setTimeout(() => { say(`Выучил{|а} «${tr.title}»! Теперь буду сам{|а}`, 3200); hearts(3); }, 2200); if (Object.keys(TRICKS).filter(trickLearned).length === 3) setTimeout(() => badgeShow('🎓', 'Дрессированный'), 6000); } }
  }
  // дуэт: показывая выученный трюк, питомец зовёт друга, который тоже его знает (ach:<метка> лежит в общем
  // localStorage); друг повторяет через секунду, оба радуются; три дуэта — бейдж «Цирк».
  function knowsTrick(label, k) { try { const a = JSON.parse(localStorage.getItem('ach:' + label) || 'null'); return !!(a && a.n && (a.n['trick_' + k] || 0) >= 5); } catch (_) { return false; } }
  function trickShow() {
    const ks = Object.keys(TRICKS).filter(trickLearned); if (!ks.length) return acts.sit();
    const s = S(); let k = pick(ks), mate = null;
    if (!GUEST) for (const f of friends.values()) {          // друг рядом, который знает один из моих трюков — дуэт именно с этим трюком
      if (now() - f.t > 3000 || f.label === 'guest' || !isFriend(f.label) || Math.hypot(f.x - x, f.y - y) / s > 500 || ['sleep', 'eat', 'hang', 'ride', 'fly', 'chat', 'tagRun', 'tagChase', 'hide'].includes(f.act || '')) continue;
      const common = ks.filter(t => knowsTrick(f.label, t)); if (common.length) { k = pick(common); mate = f; break; }
    }
    say(mate ? pick([`${mate.name || 'Друг'}, давай вместе!`, 'Дуэт!', 'Повторяй за мной!']) : pick(['Смотри, что умею!', 'Гляди!', 'Трюк!']), 1400);
    if (mate) { focus(7000); faceT = mate.x > x ? 1 : -1; if (T && T.event) T.event.emit('pet-play', { kind: 'duet', to: mate.label, from: PET.label, name: k, byName: NAME }).catch(() => {}); }   // на время дуэта болтовню и игры не принимаем
    setTimeout(() => { trick(k, false); if (mate) setTimeout(() => { say(pick(['Дуэт!', 'Браво нам!', 'Цирк!']), 1600); hearts(2); achCount('duet'); }, 3200); }, 1500);
  }
  if (!DEMO && invoke && T && T.event) {
    T.event.listen('quiet', e => { const ms = +e.payload || 0; quietUntil = ms > 0 ? now() + ms : 0; if (ms > 0) { say('Тс-с… посплю', 1500); acts.sleep(ms); } else { say('Проснул{ся|ась}!', 1200); acts.stretch(); } });
    T.event.listen('tts', e => { ttsOn = !!e.payload; });
    T.event.listen('trick', e => { if (PET.label === leaderLabel() || Math.random() < .5) trick(String(e.payload || ''), true); });
    invoke('tts_get').then(v => { ttsOn = !!v; }).catch(() => {});
  }
  // ---------- гнездо, футбол, дежурный, конец дня ----------
  let nest = null, lastGather = -1e9, carryEl = null, score = { L: 0, R: 0 }, lastGoal = 0, dutyDay = '', eodDay = '';
  function nestAlive() { try { return !!nest && now() - nest.t < 1500; } catch (_) { return false; } }
  function gather() {                            // найти «находку» и отнести в гнездо
    if (!nestAlive()) return acts.sit();
    lastGather = now();
    const s = S(), c = myCenter(), m = monAt(c.x, c.y) || mons[0];
    const [fx0, fy0] = clampPos(x + face * rnd(120, 320) * s, floorY(m), m);
    const item = pick(['🧦', '🍂', '🧶', '🪶', '🔩', '📎', '🍬', '🧢', '🥄', '🎀']);
    moveTo(fx0, fy0, 80 * SPD, { name: 'walk', after: () => {
      start('sniff', { pose: 'sniff', dur: 1600, rate: 6, mod: (T_, q) => { T_.headY += Math.sin(q * 9) * 1.5; }, after: () => {
        mark('!'); say(pick(['О, находка!', 'Это моё', 'В гнездо!']), 1400);
        if (!carryEl) { carryEl = document.createElement('div'); carryEl.className = 'fx'; carryEl.style.fontSize = '18px'; stage.appendChild(carryEl); }
        carryEl.textContent = item; carryEl.style.display = '';
        const nx = nest.x - CX * s + (nest.x > x ? -50 : 50) * s, ny = floorY(monAt(nest.x, nest.y) || m);
        const o = { name: 'carry', dur: 12000, mod: (T_) => { T_.armL = .6; T_.mouth = .2; }, tick: () => { const h = headCanvas(); if (carryEl) { carryEl.style.left = (h.x + face * 26) + 'px'; carryEl.style.top = (h.y + 30) + 'px'; } },
          after: () => { if (carryEl) carryEl.style.display = 'none'; if (T && T.event) T.event.emit('prop-kick', { kind: 'nest', add: 1 }).catch(() => {}); achCount('nest'); say(pick(['Положил{|а}', 'Ещё одна вещь', 'Гнездо растёт']), 1600); hearts(1); acts.sit(2500); },
          exit: () => { if (carryEl) carryEl.style.display = 'none'; } };
        if (FLY) soarTo(nx, ny, o.after, o); else moveTo(nx, ny, 120 * SPD, o);
      } });
    } });
  }
  function onGoal(g) {                           // футбол: мяч влетел в край экрана на скорости
    if (!g || g.t <= lastGoal) return; lastGoal = g.t;
    score[g.side === 'left' ? 'L' : 'R']++;
    const mine = (g.side === 'left') === (PET.label.charCodeAt(PET.label.length - 1) % 2 === 0);
    say(mine ? pick([`ГОЛ! ${score.L}:${score.R}`, `Есть! ${score.L}:${score.R}`]) : pick([`Ай… ${score.L}:${score.R}`, `Не удержал{|а}. ${score.L}:${score.R}`]), 2600);
    if (mine) { hearts(2); start('cheerGoal', { pose: 'sit', dur: 2000, rate: 12, mod: (T_, q) => { T_.bob -= Math.abs(Math.sin(q * 8)) * 16; T_.happy = 1; T_.armL = T_.armR = 1; } }); }
    if (score.L >= 5 || score.R >= 5) { setTimeout(() => { say(`Матч окончен ${score.L}:${score.R}!`, 3000); score = { L: 0, R: 0 }; }, 3000); }
    if (Math.random() < .5) netBallSend(g);
  }
  // дежурный и конец дня — только старший, раз в день
  async function dailyTick() {
    if (DEMO || GUEST || !invoke || PET.label !== leaderLabel()) return;
    const d = new Date(), day = d.toISOString().slice(0, 10), h = d.getHours();
    try { dutyDay = localStorage.getItem('dutyDay') || ''; eodDay = localStorage.getItem('eodDay') || ''; } catch (_) { /* без памяти */ }
    if (h >= 9 && h < 12 && dutyDay !== day && !busy()) {
      try { localStorage.setItem('dutyDay', day); } catch (_) {}
      try {
        const r = await portal('GET', '/duty');
        if (r && r.shift) {
          const names = (r.people || []).map(p => p.name.split(' ')[0]).join(', ');
          const mine = me && me.name && (r.people || []).some(p => p.name && me.name.split(' ').some(w => w.length > 3 && p.name.includes(w)));
          const t = mine ? `Сегодня дежуришь ты! Смена ${r.shift.name}` : `Сегодня дежурит смена ${r.shift.name}${names ? ': ' + names : ''}`;
          cheer(t); speak(t);
        }
      } catch (_) { /* портал недоступен — без дежурного */ }
    }
    let umbDay = ''; try { umbDay = localStorage.getItem('umbDay') || ''; } catch (_) { /* без памяти */ }
    if (h >= 8 && h < 11 && umbDay !== day && !busy() && weatherDay) {   // «возьми зонт» — раз в день по прогнозу
      try { localStorage.setItem('umbDay', day); } catch (_) { /* без памяти */ }
      const t = umbrellaPhrase(); if (t) { cheer(t); speak(t); }
    }
    let rollDay = ''; try { rollDay = localStorage.getItem('rollDay') || ''; } catch (_) { /* без памяти */ }
    if (h === 10 && d.getMinutes() < 30 && rollDay !== day && !busy()) {   // перекличка: кто из коллег на связи
      try { localStorage.setItem('rollDay', day); } catch (_) { /* без памяти */ }
      try {
        if (!me) me = await invoke('whoami');
        const on = (await portal('GET', '/online') || []).filter(c => c.online && c.client !== me.client);
        const t = on.length ? 'На связи: ' + on.slice(0, 5).map(c => ((c.pets || []).map(q => q.name).filter(Boolean).slice(0, 2).join(' и ') || 'питомцы') + ' (' + (c.name || '').split(' ')[0] + ')').join(', ') + (on.length > 5 ? ' и ещё ' + (on.length - 5) : '') : 'Перекличка: кроме нас пока никого';
        cheer(t);
      } catch (_) { /* портал недоступен */ }
    }
    // день рождения питомца: торт «от коллег», поздравления, запись в ленту (раз в день)
    let bdayDay = ''; try { bdayDay = localStorage.getItem('bdayDay:' + PET.label) || ''; } catch (_) { /* без памяти */ }
    if (HOL && HOL.text && /день рождения/.test(HOL.text) && bdayDay !== day && !busy()) {
      try { localStorage.setItem('bdayDay:' + PET.label, day); } catch (_) { /* без памяти */ }
      const years = Math.max(1, d.getFullYear() - Number((PET.born || '2026').slice(0, 4)));
      portalEvent('bday', { years });
      const s = S(), mm = monAt(x + CX * s, y + GY * s) || mons[0];
      setTimeout(() => invoke('prop_show', { kind: 'gift', x: Math.round(mm ? mm.x + mm.w / 2 : x), y: Math.round(mm ? mm.y + mm.h - 10 * s : y), data: JSON.stringify({ what: 'cake', from: 'все коллеги', msg: `С днём рождения, ${NAME}!` }) }).catch(() => {}), 2500);
      if (T && T.event) T.event.emit('bday-pet', { name: NAME, label: PET.label }).catch(() => {});
    }
    // день рождения хозяина (дд.мм в окне «Питомцы»): все поздравляют, коллеги узнают через ленту и /hello
    let obday = '', obdayDay = ''; try { obday = localStorage.getItem('owner:bday') || ''; obdayDay = localStorage.getItem('obdayDay') || ''; } catch (_) { /* без памяти */ }
    if (obday && obday === String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') && obdayDay !== day && h >= 8 && !busy()) {
      try { localStorage.setItem('obdayDay', day); } catch (_) { /* без памяти */ }
      portalEvent('obday', {});
      if (T && T.event) T.event.emit('bday-owner', {}).catch(() => {});
    }
    if (h === 19 && d.getMinutes() < 20 && eodDay !== day && !busy()) {
      try { localStorage.setItem('eodDay', day); } catch (_) {}
      const t = pick(['Рабочий день окончен. Домой!', 'Семь часов. Выключай — я подожду', 'Всё, хватит на сегодня']);
      cheer(t); speak(t);
    }
  }
  if (!DEMO && invoke) setInterval(dailyTick, 5 * 60000);
  // ---------- Ctrl+S / Ctrl+Z, активность и танцы под музыку ----------
  // input_info раз в 1,5 с: счётчики двух комбинаций (если включено в трее), системный простой и
  // пиковый уровень звука. Музыка = уровень держится больше 5 с с переменной громкостью.
  let idleAway = false;
  function dozeOff() {
    const bt = bedTarget();
    if (bt) return moveTo(bt[0], bt[1], 90 * SPD, { name: 'walk', after: () => acts.sleep(1e9) });
    acts.sleep(1e9);
  }
  function welcomeBack() {
    setTimeout(() => { wake(); focus(12000); say(pick(['С возвращением!', 'Скучали!', 'Ты вернул{ся|ась}!', 'Ура, ты тут!']), 2600); hearts(2); if (PET.label === leaderLabel()) come(); else { const s = S(), [tx, ty] = nearPoint(cur.x, cur.y, rnd(90, 160)); moveTo(tx, ty, 220 * SPD, { after: () => acts.sit(3000) }); } }, rnd(200, 1500));
  }
  let inp = null, inpPrev = null, lastSaveSaid = -1e9, lastUndoSaid = -1e9, lastNoSave = -1e9, lastCtrlS = now(), keysOn = false;
  let musicSince = 0, musicPeaks = [], dancing = false, lastMusicEnd = -1e9;
  async function inputPoll() {
    if (DEMO || GUEST || !invoke) return;
    let d = null; try { d = await invoke('input_info'); } catch (_) { return; }
    if (!d) return;
    inpPrev = inp; inp = d; keysOn = !!d.keys;
    // ушёл — пришёл: 10 минут без мыши и клавиатуры — спать (в домик, если есть); вернулся — навстречу
    if (d.idle_ms > 600000 && !idleAway && !GUEST && !away) { idleAway = true; if (!busy() || (A && A.name === 'sleep')) dozeOff(); }
    else if (d.idle_ms < 3000 && idleAway) { idleAway = false; welcomeBack(); }
    if (inpPrev && keysOn && PET.label === leaderLabel()) {
      const ds = d.ctrl_s - inpPrev.ctrl_s, dz = d.ctrl_z - inpPrev.ctrl_z, t = now();
      if (ds > 0) { lastCtrlS = t; if (t - lastSaveSaid > 5 * 60000 && Math.random() < .3 && !busy()) { lastSaveSaid = t; mark('✓'); say(pick(['Сохранил! Молодец', 'Ctrl+S — уважаю', 'Вот это по-нашему']), 1800); } }
      if (dz >= 4 && t - lastUndoSaid > 3 * 60000 && !busy()) { lastUndoSaid = t; say(pick(['Может, не надо?', 'Отмена отмены отмены…', 'Всё не так? Бывает']), 2200); }
      const editing = desk && desk.title && /Word|Excel|PowerPoint|\.docx?|\.xlsx?|\.pptx?|Photoshop|Illustrator|Figma|Code|Studio|Конфигуратор/i.test(desk.title);
      if (editing && d.idle_ms < 5000 && t - lastCtrlS > 10 * 60000 && t - lastNoSave > 10 * 60000 && !busy()) { lastNoSave = t; lastCtrlS = t; say(CLIP ? 'Похоже, вы давно не сохранялись. Помочь?' : pick(['Десять минут без сохранения…', 'Ctrl+S не жмётся само', 'Сохранись, а?']), 2800); }
    }
    // музыка: собираем пики за 6 с; играет, если средний уровень заметный и есть колебания (не ровный шум)
    const t = now(); musicPeaks.push([t, d.peak || 0]); musicPeaks = musicPeaks.filter(p => t - p[0] < 6000);
    const vals = musicPeaks.map(p => p[1]), avg = vals.reduce((a, b) => a + b, 0) / (vals.length || 1), mx = Math.max(...vals, 0), mn = Math.min(...vals, 1);
    const music = vals.length >= 3 && avg > .04 && mx - mn > .03 && vals[vals.length - 1] > .02;   // и сейчас не тишина
    if (music && !musicSince) musicSince = t; if (!music) { if (musicSince) lastMusicEnd = t; musicSince = 0; }
    if (musicSince && t - musicSince > 5000 && !dancing && !busy() && !quiet() && !inCall && Math.random() < .5) dance();
  }
  // Дискотека: по кнопке из трея — у всех, кто онлайн (портал раскладывает сообщение disco каждому),
  // и у себя; минута танца у каждого питомца, игры и реакции на это время глушатся.
  function disco(from) {
    if (GUEST && !from) return;
    focus(62000); dancing = true;
    if (PET.label === leaderLabel()) say(from ? `${from} объявил(а) дискотеку!` : 'Дискотека! Танцуют все!', 2600);
    start('music', { pose: 'sit', dur: 60000, rate: 9,
      mod: (T_, q) => { const k = .6 + .4 * Math.sin(q * 1.3); T_.bob += Math.sin(q * 12) * (2 + k * 5); T_.headY += Math.sin(q * 12 + 1) * 3; T_.headTilt = Math.sin(q * 6) * (10 + k * 10); T_.ear = Math.sin(q * 6); T_.yaw = Math.sin(q * 3) * .4; T_.armL = Math.max(0, Math.sin(q * 6)); T_.armR = Math.max(0, -Math.sin(q * 6)); T_.happy = .6; if (BIRD) T_.crest = 1; },
      tick: (dt, q) => { if (Math.floor(q * 1.5) !== A.nq) { A.nq = Math.floor(q * 1.5); fx('zzz', pick(['♪', '♫', '✦']), rnd(-30, 20), -12, 1600); } },
      exit: () => { dancing = false; }, after: () => { say(pick(['Уф, натанцевал{ся|ась}!', 'Ещё дискотеку!', 'Вот это вечеринка']), 2000); acts.sit(3000); } });
  }
  async function discoAll() {
    if (DEMO || GUEST || !invoke) return;
    try { if (!me) me = await invoke('whoami'); await portal('POST', '/party', { from: me.client }); } catch (_) { /* портал недоступен — танцуем одни */ }
  }
  function dance() {
    dancing = true;
    if (PET.label === leaderLabel() && Math.random() < .5) say(pick(['Музыка!', '♪ Танцуем ♪', 'О, моя песня!']), 1600);
    start('music', { pose: 'sit', dur: 1e9, rate: 9,
      mod: (T_, q) => { const k = inp ? Math.min(1, (inp.peak || 0) * 3) : .5; T_.bob += Math.sin(q * 12) * (2 + k * 5); T_.headY += Math.sin(q * 12 + 1) * 3; T_.headTilt = Math.sin(q * 6) * (10 + k * 10); T_.ear = Math.sin(q * 6); T_.yaw = Math.sin(q * 3) * .4; T_.armL = Math.max(0, Math.sin(q * 6)); T_.armR = Math.max(0, -Math.sin(q * 6)); T_.happy = .5; if (BIRD) T_.crest = 1; },
      tick: (dt, q) => { if (Math.floor(q * 1.5) !== A.nq) { A.nq = Math.floor(q * 1.5); fx('zzz', pick(['♪', '♫']), rnd(-24, 16), -12, 1600); } if (!musicSince && now() - lastMusicEnd > 4000) A.dur = 0; },
      exit: () => { dancing = false; }, after: () => { if (Math.random() < .5) say(pick(['Уф, натанцевал{ся|ась}', 'Ещё?', 'Классная была']), 1600); acts.sit(3000); } });
  }
  if (!DEMO && invoke) { setInterval(inputPoll, 1500); if (T && T.event) T.event.listen('keys', e => { keysOn = !!e.payload; }); }
  // ---------- малыш: растёт месяц, пока маленький — ведёт себя как котёнок ----------
  // AGE — дней с рождения (Pet.born). Рост: 55 % размера при рождении → 100 % к 30 дням, глаза чуть больше.
  // BABY (< 14 дней): тонкий голос, больше беготни и игр, спотыкается на бегу, ходит за родителем,
  // просит есть чаще, свои реплики. В 30 дней — «Я вырос!» и бейдж.
  const growth = () => clamp(AGE / 30, 0, 1);
  function isBaby() { return AGE < 14; }
  const BABY_TXT = ['Мама!', 'Хочу играть!', 'А что это?', 'Кушать! Ещё кушать!', 'Я маленьк{ий|ая}, но храбр{ый|ая}', 'Поймал{|а} хвост! Ой, это мой', 'Куда все идут?', 'А можно на ручки?', 'Я вырасту большим-большим', 'Мне страшно… нет, не страшно!', 'Смотри, как я умею!', 'Спать не хочу. Хочу играть'];
  let parentsOf = [];
  try { const lk = PET.look && PET.look !== 'litter' ? JSON.parse(PET.look) : null; if (lk && Array.isArray(lk.parents)) parentsOf = lk.parents.filter(l => typeof l === 'string'); } catch (_) { /* look не JSON */ }
  function parentNear() { for (const f of friends.values()) if (parentsOf.includes(f.label) && now() - f.t < 3000) return f; return null; }
  function followParent() {                     // подойти к родителю и потереться
    const f = parentNear(); if (!f) return acts.sit();
    const s = S(), side = f.x > x ? -1 : 1, [tx, ty] = clampPos(f.x + side * 70 * s, f.y);
    moveTo(tx, ty, 120 * SPD, { name: 'walk', after: () => { faceT = -side; say(pick(['Мама!', 'Папа!', 'Я с тобой', 'Поиграй со мной']), 1600); hearts(1);
      start('cuddle', { pose: 'sit', dur: rnd(3000, 6000), watch: false, mod: (T_, q) => { T_.headTilt = Math.sin(q * 2) * 10; T_.happy = .7; T_.bob += Math.sin(q * 3) * 1.5; } }); } });
  }
  function stumble() {                          // споткнулся на бегу
    say(pick(['Ой!', 'Уп-с', 'Лапы запутались']), 1000);
    start('stumble', { pose: 'crouch', dur: 900, rate: 16, mod: (T_, q) => { T_.tilt = face * (q < .45 ? -25 * (q / .45) : -25 * (1 - (q - .45) / .55)); T_.squash = .9; T_.pup = 1; }, after: () => acts.sit(1500) });
  }
  let grownSaid = false;
  setInterval(() => {
    if (DEMO || GUEST || grownSaid) return;
    AGE = PET.born ? Math.max(0, (Date.now() - Date.parse(PET.born)) / 86400e3) : 30;
    if (AGE >= 30 && AGE < 31 && !(ach.got || []).includes('grown1')) { grownSaid = true; configure(); say('Я вырос{|ла}! Смотри, какой{|ая} большой{|ая}', 3200); hearts(4); achCount('grown'); }
  }, 60000);
  // ---------- праздники ----------
  function holiday() {
    const d = new Date(), m = d.getMonth() + 1, day = d.getDate();
    let born = null; try { born = localStorage.getItem('born:' + PET.label); if (!born) { born = d.toISOString().slice(0, 10); localStorage.setItem('born:' + PET.label, born); } } catch (_) { /* без сохранения — без дня рождения */ }
    const bd = born && born.slice(5) === d.toISOString().slice(5, 10) && born.slice(0, 4) !== String(d.getFullYear());
    if (bd) return { hat: 'party', text: 'У меня сегодня день рождения! Целый год с тобой', fxc: 'heart' };
    if ((m === 12 && day >= 20) || (m === 1 && day <= 10)) return { hat: 'santa', snow: true, text: m === 12 && day === 31 ? 'С наступающим! Загадай желание' : m === 1 && day === 1 ? 'С Новым годом!' : 'Скоро праздник! Чувствуешь?' };
    if (m === 2 && day === 14) return { hat: 'hearts', text: 'С днём всех влюблённых! Я тебя люблю', fxc: 'heart' };
    if (m === 2 && day === 23) return { text: 'С 23 февраля! Ты наш защитник' };
    if (m === 3 && day === 8) return { hat: 'hearts', text: 'С 8 марта! Ты прекрасна', fxc: 'heart' };
    if (m === 10 && day >= 25) return { text: day === 31 ? 'Бу! Испугал{|а}?' : 'Скоро Хэллоуин. Тыкву мне!', hat: 'pumpkin' };
    if (m === 1 && day === 1) return { hat: 'party', snow: true, text: 'С Новым годом!' };
    return null;
  }
  // Сезон на столе: листья с середины сентября до середины ноября, снег с декабря по февраль (праздничный
  // снег — отдельно), дождь — по погоде (коды open-meteo 51–67, 80–82). Погода в pet.js уже есть.
  function season() {
    const d = new Date(), m = d.getMonth() + 1, day = d.getDate();
    const leaves = (m === 9 && day >= 15) || m === 10 || (m === 11 && day <= 15), snow = m === 12 || m === 1 || m === 2;
    const c = weather && weather.weather_code, rain = c != null && ((c >= 51 && c <= 67) || (c >= 80 && c <= 82));
    return { leaves, snow, rain };
  }
  let SEA = { leaves: false, snow: false, rain: false };   // считать при загрузке нельзя: weather объявлен ниже (TDZ)
  setTimeout(() => { SEA = season(); }, 0); setInterval(() => { SEA = season(); }, 300000);
  const leaves = [], drops = []; let wetSaid = -1e9, lastFlake = -1e9;
  function drawSeason() {                        // поверх зверя: листья, снег, дождь — в кадре окна
    if (!SEA.leaves && !SEA.snow && !SEA.rain) return;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (SEA.leaves) {
      if (!leaves.length) for (let i = 0; i < 5; i++) leaves.push({ x: Math.random() * W, y: Math.random() * H, r: 3 + Math.random() * 2.5, v: 8 + Math.random() * 10, ph: Math.random() * 6, c: pick(['#d9822b', '#c4452c', '#e0b23a', '#8f5a2a']) });
      for (const f of leaves) { f.y += f.v / 60; f.x += Math.sin(f.y / 22 + f.ph) * .6; if (f.y > GY) { f.y = -6; f.x = Math.random() * W; } ctx.fillStyle = f.c; ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.y / 15 + f.ph); ctx.beginPath(); ctx.ellipse(0, 0, f.r, f.r * .55, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    }
    if (SEA.snow && !(HOL && HOL.snow)) {
      if (!snow.length) for (let i = 0; i < 12; i++) snow.push({ x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 1.6, v: 10 + Math.random() * 14, ph: Math.random() * 6 });
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      for (const f of snow) { f.y += f.v / 60; f.x += Math.sin(f.y / 18 + f.ph) * .3; if (f.y > GY) { f.y = -4; f.x = Math.random() * W; } ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill(); }
    }
    if (SEA.rain) {
      if (!drops.length) for (let i = 0; i < 14; i++) drops.push({ x: Math.random() * W, y: Math.random() * H, v: 160 + Math.random() * 80 });
      ctx.strokeStyle = 'rgba(150,180,220,.55)'; ctx.lineWidth = 1;
      for (const f of drops) { f.y += f.v / 60; if (f.y > GY) { f.y = -8; f.x = Math.random() * W; } ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - 1, f.y + 7); ctx.stroke(); }
    }
  }
  function seasonTick() {                        // изредка: ловит снежинку или листик; после прогулки под дождём отряхивается
    if (busy() || GUEST) return;
    if ((SEA.leaves || SEA.snow || (HOL && HOL.snow)) && (CAT || DOG) && now() - lastFlake > 240000 && Math.random() < .25) {
      lastFlake = now(); const s = S(), m = monAt(x + CX * s, y + GY * s); if (!m) return;
      say(SEA.leaves ? pick(['Листик!', 'Лови листик!']) : pick(['Снежинка!', 'Поймаю снежинку']), 1200);
      return leap(...clampPos(x + (Math.random() < .5 ? -1 : 1) * 60 * s, floorY(m), m), () => { say(SEA.leaves ? pick(['Поймал{|а} листик!', 'Хрусть']) : pick(['Поймал{|а}! Растаяла…', 'Холодная!']), 1600); acts.sit(2000); });
    }
    if (SEA.rain && gw > .3 && now() - wetSaid > 600000) { wetSaid = now(); say(pick(['Брр, мокро!', 'Дождь… отряхнусь', 'Сыро на дворе']), 1600); start('shake', { pose: 'stand', dur: 900, rate: 16, mod: (T_, q) => { T_.tilt = Math.sin(q * 40) * 6; T_.headTilt = Math.sin(q * 50) * 10; }, after: () => acts.sit(2000) }); }
  }
  setInterval(seasonTick, 20000);
  let HOL = holiday(), holSaid = false;
  setInterval(() => { HOL = holiday(); }, 600000);
  const snow = [];
  function drawSnow() {
    if (!HOL || !HOL.snow) return;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!snow.length) for (let i = 0; i < 18; i++) snow.push({ x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 1.8, v: 12 + Math.random() * 18, ph: Math.random() * 6 });
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (const f of snow) { f.y += f.v / 60; f.x += Math.sin(f.y / 18 + f.ph) * .3; if (f.y > GY) { f.y = -4; f.x = Math.random() * W; } ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill(); }
  }
  // ---------- погода (Москва, open-meteo) ----------
  let weather = null, weatherSaid = 0, weatherDay = null;
  // «Возьми зонт»: утром по прогнозу на день — дождь, мороз, жара
  function umbrellaPhrase() {
    const d = weatherDay; if (!d || !d.weather_code) return '';
    const c = d.weather_code[0], pr = (d.precipitation_probability_max || [])[0], tmin = (d.temperature_2m_min || [])[0], tmax = (d.temperature_2m_max || [])[0];
    const rain = (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || pr >= 50, snow = (c >= 71 && c <= 77) || (c >= 85 && c <= 86);
    if (snow) return `Сегодня снег${tmin != null ? ', до ' + Math.round(tmin) + '°' : ''}. Одевайся теплее`;
    if (rain) return `Возьми зонт: сегодня дождь${pr != null ? ', вероятность ' + Math.round(pr) + ' %' : ''}`;
    if (tmin != null && tmin <= -10) return `Мороз до ${Math.round(tmin)}°. Шарф, перчатки, всё такое`;
    if (tmax != null && tmax >= 28) return `Жара до ${Math.round(tmax)}°. Возьми воду`;
    return '';
  }
  async function fetchWeather() {
    try {
      const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=55.75&longitude=37.62&current=temperature_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=1&timezone=Europe%2FMoscow', { cache: 'no-store' });
      if (!r.ok) return; const j = await r.json(); weather = j.current || null; weatherDay = j.daily || null;
    } catch (_) { weather = null; /* нет интернета — молчим */ }
  }
  function weatherPhrase() {
    if (!weather) return null;
    const c = weather.weather_code, t = Math.round(weather.temperature_2m), w = weather.wind_speed_10m || 0;
    const T_ = `${t > 0 ? '+' : ''}${t}°`;
    if (c >= 95) return pick(['Гроза за окном! Я под столом', 'Гром… Ты ведь рядом?']);
    if (c >= 71 && c <= 77 || c >= 85) return DOG ? pick(['Снег! Хочу гулять!', 'За окном снег, ' + T_ + '. Пойдём?']) : pick(['Снег идёт. Смотрю в окно', 'Снежно, ' + T_ + '. Я лучше тут']);
    if (c >= 51 && c <= 67 || c >= 80) return DOG ? pick(['Дождь… Гулять всё равно хочу', 'Мокро. ' + T_ + '. Буду дома охранять']) : pick(['Дождь. Никуда не пойду', 'За окном льёт. Идеальная погода для сна']);
    if (c >= 45 && c <= 48) return 'Туман. Ничего не вижу. Мяу?';
    if (t <= -10) return pick(['Мороз ' + T_ + '. Я на батарее', 'Холодища! Грей меня']);
    if (t >= 27) return pick(['Жара ' + T_ + '. Лежу и не двигаюсь', 'Пить хочу. И ты попей']);
    if (w >= 30) return 'Ветрище! Уши сдувает';
    if (c <= 1) return pick(['Солнце! ' + T_ + '. Хороший день', 'На улице ' + T_ + ' и ясно. Проветри голову']);
    if (c <= 3) return pick(['Облачно, ' + T_ + '. Нормально', 'За окном ' + T_ + '. Работаем']);
    return null;
  }
  if (!DEMO) { setTimeout(fetchWeather, 15000); setInterval(fetchWeather, 3 * 3600e3); }
  // поддержка: тёплые фразы для человека, без сюсюканья; иногда — с сердечками
  const CHEER = [
    'Ты справляешься лучше, чем думаешь', 'Сложная задача — значит, ты растёшь', 'Сделай глоток воды. Я подожду',
    'Ошибка — это просто следующий шаг', 'Ты сегодня уже сделал(а) больше, чем кажется', 'Дыши. Всё решаемо',
    'Я в тебя верю. Без вариантов', 'Отдых — тоже часть работы', 'Один шаг за раз — и вот уже гора позади',
    'Ты — тот человек, к которому идут за помощью. Это дорогого стоит', 'Не сравнивай себя ни с кем. Только с собой вчерашним',
    'Если устал(а) — это не слабость, это сигнал', 'Ты умница. Я провери{л|ла}', 'Всё, что ты чинишь, кому-то очень помогает',
    'Даже если день так себе — ты не так себе', 'Плечи вниз, спину прямо. Вот так лучше', 'Ты не обязан(а) успеть всё. Только главное',
    'Мир становится чуть лучше, когда ты рядом', 'Хвалю. Просто так, без повода', 'Можно и не идеально. Можно просто сделать',
    'Ты хорошо держишься. Я вижу', 'Улыбнись. Я вот улыбаюсь', 'Сегодня можно быть довольным(ой) собой', 'Ты нужен(на) не за результат, а сам(а) по себе',
    'Что бы ни случилось — я тут, рядом', 'Перерыв на пять минут окупится', 'Ты уже победил(а): встал(а) и пришёл(шла)', 'Помни: даже сервера иногда перезагружают. Тебе тоже можно',
    'Ты — молодец. Точка', 'Всё получится. Может, не сразу, но получится', 'Спасибо, что ты есть', 'Ты классный(ая). И это не обсуждается',
  ];
  const CHEER_SP = {
    cat: ['Мрр. Ты мой любимый человек', 'Погладь — и станет легче обоим', 'Иногда надо просто полежать. Я покажу как'],
    dog: ['Ты лучший! Гав!', 'Я горжусь тобой. Хвост не врёт', 'Пойдём гулять? Ну хоть до окна'],
    hamster: ['Маленькие шаги — тоже путь. Пи!', 'Запасай силы, как я семечки', 'Ты больше, чем твои задачи. Я вот маленьк{ий|ая}, а тоже справляюсь'],
    rabbit: ['Прыгай через трудности. Или обойди', 'Уши выше! Всё хорошо', 'Морковку съешь — и мир добрее'],
    bird: ['Ты хороший! Повторяю: хороший!', 'Летим дальше! Не сдаваться!', 'Кто молодец? Ты молодец!'],
    custom: ['Ты меня нарисовал — значит, ты творец. Творцы справляются', 'Я верю в тебя. Я же с твоей картинки', 'Всё получится, я проверял'],
    round: ['Всё будет хорошо — это же очевидно!', 'Катись вперёд, а не назад', 'Ты молодец. Круглая правда'],
    kuzya: ['Счастье — это когда у тебя всё дома. И ты дома', 'Ой, беда? Не беда. Пирожок съешь', 'Домовые зря не хвалят. Ты молодец'],
    clippy: ['Похоже, вы стараетесь. Это видно', 'Скреплю ваши дела в порядок. Всё получится', 'Похоже, вам нужен перерыв. Настаиваю'],
    dragon: ['Ты сильнее любого дракона. Проверено', 'Огонь внутри есть у каждого. У тебя — точно', 'Расправь крылья. Хотя бы плечи', 'Я дыхну на все проблемы. Ррр!'],
  };
  let lastCheer = 0, lastBreak = now(), greeted = false, lastShoo = -1e9;
  let curStillSince = now(), curLast = { x: 0, y: 0 }, idleSleep = false;
  function idleCheck() {                         // человека нет — все спят; вернулся — просыпаются и здороваются
    if (cur.x !== curLast.x || cur.y !== curLast.y) {
      curLast = { x: cur.x, y: cur.y };
      if (idleSleep) { idleSleep = false; lastBreak = now(); wake(); setTimeout(() => say(pick(['С возвращением!', 'Соскучил{ся|ась}!', 'Ты вернул{ся|ась}? Ура!', 'Я тут ждал{|а}']), 2200), 1600); }
      curStillSince = now();
    } else if (!idleSleep && now() - curStillSince > 10 * 60000 && !dragging && A && !['hang', 'fly', 'ride', 'carry'].includes(A.name)) {
      idleSleep = true; acts.sleep(1e9);
    }
  }
  // ---------- разговоры между питомцами ----------
  // Сценарий — реплики по очереди: нечётные говорит зачинщик (A), чётные — собеседник (B).
  // {A}/{B} — имена, формы рода в {..|..} раскрывает тот, кто произносит.
  const DIALOGS = [
    // гость и хозяин: про хозяина гостя ({O} — его имя); в обычных беседах не участвуют
    { for: ['any'], guest: true, lines: ['А у нас дома {O} всё время в таблицах', 'У нас тоже. Что за люди', 'Зато кормят'] },
    { for: ['any'], guest: true, lines: ['{O} говорит, у вас тут уютно', 'Передай: пусть заходит сам{|а}', 'Передам!'] },
    { for: ['any'], guest: true, lines: ['{O} обедает ровно в час. А у вас?', 'Когда покормят', 'Понимаю…'] },
    { for: ['any'], guest: true, lines: ['{B}, а мышь у вас водится?', 'Хитрая. Не поймать', 'У нас такая же! Одна на всех, что ли'] },
    { for: ['any'], guest: true, lines: ['А есть где посидеть? Окошко тёплое?', 'На активном. Только не на важном', 'Спасибо, {B}'] },
    { for: ['any'], guest: true, lines: ['{O} передаёт привет', 'И ты передай. И пирожок', 'Пирожок не донесу'] },
    { for: ['any'], lines: ['Привет, {B}!', 'Привет, {A}! Как дела?', 'Заявки текут рекой…', 'А мы всё равно справимся'] },
    { for: ['any'], lines: ['Ты видел{|а}, человек опять без обеда?', 'Вижу. Надо намекнуть', 'Скажу «покорми меня» — глядишь, и сам{|а} поест'] },
    { for: ['any'], lines: ['Слушай, где тут тёплое место?', 'На блоке питания. Но там занято. Мной', 'Подвинься!', 'Ладно, но только чуть-чуть'] },
    { for: ['any'], lines: ['Сервер шумит', 'Это он мурлычет', 'Ааа. Тогда ладно'] },
    { for: ['any'], lines: ['{B}, а ты чего тут сидишь?', 'Слежу за курсором. Вдруг убежит', 'Разумно'] },
    { for: ['any'], lines: ['Пятница?', 'Нет', 'Эх', 'Зато скоро обед'] },
    { for: ['any'], lines: ['Давай подбодрим человека', 'Давай! Ты первый', 'Ты молодец! Мы рядом!', '…и мы тебя любим'] },
    { for: ['cat-dog', 'dog-cat'], lines: ['Гав?', 'Мяу.', 'Дружим?', 'Подумаю. Но лежанку не отдам'] },
    { for: ['cat-dog'], lines: ['Не подходи, {B}', 'Я только понюхать!', 'Нюхай отсюда'] },
    { for: ['dog-cat'], lines: ['{B}! Пойдём гулять!', 'Я кот. Я не гуляю', 'А что ты делаешь?', 'Царствую'] },
    { for: ['bird-any', 'any-bird'], lines: ['Пиастры! Пиастры!', 'Какие пиастры?', 'Не знаю. Красивое слово'] },
    { for: ['bird-any'], lines: ['Перезагрузи!', 'Кого?', 'Всех!'] },
    { for: ['hamster-any', 'any-hamster'], lines: ['У меня щёки полные', 'Чем?', 'Секрет. На зиму'] },
    { for: ['rabbit-any', 'any-rabbit'], lines: ['Морковку не видел{|а}?', 'Нет. А что?', 'Так, ничего. Просто мечтаю'] },
    { for: ['cat-cat'], lines: ['Мрр', 'Мрр-мрр', 'Ну, поговорили'] },
    { for: ['dog-dog'], lines: ['Гав-гав-гав!', 'ГАВ!', 'Ты тоже это слышал{|а}?', 'Нет. Но лаять же надо'] },
    { for: ['any'], lines: ['{B}, ты чем занят{|а}?', 'Работаю. Не мешай', 'Ты спишь!', 'Это тоже работа'] },
  ];
  let chat = null, lastChat = -1e9, lastPlay = -1e9, focusUntil = -1e9;
  // Пока идёт focus, догонялки, мяч, болтовня и реакции на друзей не перебивают текущее дело:
  // иначе команда из трея проигрывала уже начатой игре (окна переговариваются событиями).
  function focus(ms) { focusUntil = now() + ms; relay = null; if (A && (A.name === 'tagRun' || A.name === 'tagChase')) { if (T && T.event && A.other) T.event.emit('pet-play', { kind: 'tag', role: 'end', from: PET.label, to: A.other }).catch(() => {}); A = null; } chat = null; }
  // ---------- мячик ----------
  // Мяч — отдельное окно (prop.js); мы знаем его положение из prop-pos и пинаем событием prop-kick.
  let ball = null, lastBall = -1e9, ballRounds = 0;
  const ballAlive = () => ball && now() - ball.t < 1500;
  function ballKick(f) {                          // пнуть: к другу, если он есть, иначе куда-нибудь вдоль пола
    const s = S(), c = myCenter();
    let dir = f ? Math.sign(f.x - ball.x) || 1 : (Math.random() < .5 ? -1 : 1);
    const m = monAt(ball.x, ball.y);
    if (m && !f) { if (ball.x < m.x + 300 * s) dir = 1; if (ball.x > m.x + m.w - 300 * s) dir = -1; }
    const dist = f ? Math.abs(f.x - ball.x) / s : rnd(250, 500);
    const shot = !f && m && Math.random() < .35;                                   // удар по воротам — в ближний край на скорости
    if (shot) dir = ball.x < m.x + m.w / 2 ? -1 : 1;
    const vx = dir * (shot ? rnd(760, 980) : clamp(dist * 1.6, 260, 800)) * s, vy = -(shot ? rnd(120, 220) : rnd(220, 420)) * s;
    if (shot) say(pick(['По воротам!', 'Бью!', 'Удар!']), 1000);
    faceT = dir;
    say(pick(f ? ['Лови!', 'Тебе!', 'Хоп!'] : ['Хоп!', 'Мячик!', 'Гол!']), 1000);
    if (T && T.event) T.event.emit('prop-kick', { kind: ball && ball.kind || 'ball', vx, vy }).catch(() => {});
    start('kick', { pose: 'sit', dur: 700, rate: 16, mod: (T_, q) => { T_.pawR = q < .35 ? 1 : 0; T_.tilt = -dir * 8; T_.happy = 1; },
      after: () => (ballRounds > 0 ? ballWait(f) : acts.sit(3000)) });
  }
  function ballWait(f) {                          // смотрим, как катится; когда почти остановился — снова к нему
    start('ballWatch', { pose: 'sit', dur: 6000, watch: false, mod: (T_) => { T_.yaw = ball ? Math.sign(ball.x - myCenter().x) * .5 : 0; T_.ear = -.4; },
      tick: () => { if (!ballAlive()) { A = null; return acts.sit(2000); }
        const slow = Math.abs(ball.vx) + Math.abs(ball.vy) < 90 * S();
        if (slow && now() - A.t0 > 800) { A = null; ballPlay(f); } } });
  }
  function ballPlay(f) {                          // подойти к мячу и пнуть
    if (!ballAlive() || ballRounds <= 0) return acts.sit(3000);
    ballRounds--;
    const s = S(), side = myCenter().x < ball.x ? -1 : 1;
    const target = () => clampPos(ball.x - CX * s + side * 42 * s, ball.y - (GY - 20) * s);
    const [tx, ty] = target();
    const o = { name: 'ballGo', ballOf: true, dur: 9000, after: () => ballKick(f && friends.get(f.label)) };
    if (FLY) soarTo(tx, ty, o.after, o); else moveTo(tx, ty, 190 * SPD, o);
  }
  let lastUserKick = 0;
  // ---------- тишина в звонке ----------
  let inCall = false, callBack = null;
  function callMode(on) {
    if (on === inCall) return; inCall = on;
    if (on) {
      const s = S(), c = myCenter(), m = monAt(c.x, c.y); if (!m) return;
      callBack = [x, y]; bubble.classList.remove('on');
      const tx = c.x < m.x + m.w / 2 ? m.x - 30 * s : m.x + m.w - (W - 30) * s;   // к ближнему краю и тихо сидеть
      moveTo(tx, floorY(m), 240 * SPD, { after: () => start('quiet', { pose: 'loaf', dur: 1e9, mod: (T_) => { T_.eye = .8; T_.ear = .3; } }) });
    } else {
      const b = callBack; callBack = null; A = null;
      say(pick(['Звонок кончился? Фух', 'Можно шуметь?', 'Я молчал{|а}, как рыба']), 1800);
      if (b) moveTo(...clampPos(b[0], b[1]), 180 * SPD, { after: () => acts.sit() });
    }
  }
  // ---------- кот толкает курсор ----------
  let lastNudge = -1e9;
  function nudgeCursor() {
    if (!CAT || inCall || now() - lastNudge < 30 * 60000 || !invoke) return false;
    lastNudge = now();
    const s = S(), [tx, ty] = nearPoint(cur.x, cur.y, 40);
    say(pick(['*крадётся к мышке*', 'Тихо…', 'Что за штука?']), 1200);
    moveTo(tx, ty, 90, { name: 'sniff', pose: 'crouch', after: () => {
      const dir = cur.x > myCenter().x ? 1 : -1; let n = 0;
      start('nudge', { pose: 'sit', dur: 1900, rate: 12, mod: (T_, q) => { T_.pawR = Math.max(0, Math.sin(q * 12)) * .9; T_.headTilt = 8; T_.pup = 1; },
        tick: (dt, q) => { if (Math.floor(q * 4) !== n && n < 3) { n = Math.floor(q * 4); invoke('nudge_cursor', { dx: dir * 22, dy: 0 }).catch(() => {}); } },
        after: () => { say(pick(['Хе-хе', 'Ой, оно двигается!', 'Я не трогал{|а}!']), 1300); const [ax, ay] = clampPos(x - dir * 350 * s, y); moveTo(ax, ay, 300, { after: () => acts.sit(3000) }); } });
    } });
    return true;
  }
  // ---------- фото ----------
  async function photo() {
    start('pose', { pose: 'sit', dur: 2600, mod: (T_) => { T_.happy = 1; T_.tail = 25; T_.headTilt = 6; T_.ear = -.2; T_.yaw = 0; } });
    if (BIRD) { A.mod = (T_) => { T_.crest = 1; T_.happy = 1; T_.yaw = 0; }; }
    await new Promise(r => setTimeout(r, 900));
    try {
      const off = document.createElement('canvas'); off.width = canvas.width; off.height = canvas.height;
      const g = off.getContext('2d'); g.drawImage(canvas, 0, 0);
      const b64 = off.toDataURL('image/png').split(',')[1];
      const path = await invoke('save_photo', { name: NAME, png: b64 }); achCount('photo'); albumUpload('data:image/png;base64,' + b64, `${NAME} — фото из трея`);
      if (PET.label === leaderLabel()) say('Снято! Папка «Изображения/Котик»', 3200); else say('Чи-и-из!', 1200);
      console.log('фото:', path);
    } catch (e) { console.error(e); say('Не получилось сфотографироваться', 1800); }
  }
  // ---------- календарь (.ics) ----------
  let calUrl = '', calEvents = [], calSaid = new Set();
  let calDav = false;
  async function calendarFetch() {
    let txt = '';
    if (calUrl && /^(https?|webcal):\/\//i.test(calUrl)) try {
      const r = await fetch(calUrl.replace(/^webcal:/i, 'https:'), { cache: 'no-store' }); if (r.ok) txt += await r.text() + '\n';
    } catch (e) { console.error('календарь', e); }
    if (calDav && invoke) try { txt += (await invoke('caldav_fetch', { days: 2 })) || ''; } catch (e) { console.error('caldav', e); }
    if (txt || (!calUrl && !calDav)) calEvents = parseIcs(txt);
  }
  // минимальный разбор VEVENT: DTSTART (UTC, локальное или с TZID) и SUMMARY; повторяющиеся события не раскрываются
  function parseIcs(txt) {
    const lines = txt.replace(/\r\n[ \t]/g, '').split(/\r?\n/), out = []; let ev = null;
    for (const l of lines) {
      if (l === 'BEGIN:VEVENT') ev = {}; else if (l === 'END:VEVENT') { if (ev && ev.start && ev.summary) out.push(ev); ev = null; }
      else if (ev) {
        const i = l.indexOf(':'); if (i < 0) continue; const key = l.slice(0, i), val = l.slice(i + 1);
        if (key.startsWith('SUMMARY')) ev.summary = val.replace(/\\,/g, ',').replace(/\\n/g, ' ');
        if (key.startsWith('DTSTART')) {
          const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(val); if (!m) continue;
          if (!m[4]) { ev.allDay = true; continue; }
          const [y, mo, d, h, mi, se] = [m[1], m[2], m[3], m[4], m[5], m[6] || '0'].map(Number);
          ev.start = m[7] ? Date.UTC(y, mo - 1, d, h, mi, se) : new Date(y, mo - 1, d, h, mi, se).getTime();   // TZID считаем местным временем
        }
      }
    }
    return out.filter(e => !e.allDay);
  }
  function calendarTick() {
    if (!calEvents.length || PET.label !== leaderLabel()) return;
    const t = Date.now();
    for (const e of calEvents) {
      const dm = (e.start - t) / 60000, key = e.summary + e.start;
      if (dm > 4 && dm <= 5.5 && !calSaid.has(key)) { calSaid.add(key); play(TX().snd, true, 1); return cheer('Через 5 минут: «' + e.summary.slice(0, 40) + '». ' + pick(['Причешись', 'Воды налей', 'Микрофон проверь', 'Улыбнись']), true); }
      if (dm > -0.5 && dm <= 0.5 && !calSaid.has(key + 'go')) { calSaid.add(key + 'go'); return say('Началось: «' + e.summary.slice(0, 40) + '»', 4000); }
    }
  }
  if (!DEMO && invoke) { invoke('calendar_get').then(u => { calUrl = u || ''; return invoke('caldav_get'); }).then(c => { calDav = !!(c && c.user && c.has_pass); calendarFetch(); }).catch(() => {}); setInterval(calendarFetch, 10 * 60000); setInterval(calendarTick, 20000); setInterval(deskPoll, 1500); }
  // ---------- пузыри, клубок, когтеточка ----------
  let bubblesP = null, lastPop = -1e9, post = null, lastPost = -1e9;
  function onBubbles(b) {
    bubblesP = b;
    if (busy() || (A && A.name === 'bubble') || !b.bubbles || !b.bubbles.length || now() - lastPop < 1200) return;
    const s = S(), c = myCenter();
    const reach = b.bubbles.filter(q => Math.abs(q.x - c.x) / s < 90 && (c.y - q.y) / s < 110 && (c.y - q.y) / s > -20);
    if (!reach.length) { const near = b.bubbles.find(q => Math.abs(q.x - c.x) / s < 300); if (near && (!A || ['sit', 'look', 'walk', 'loaf', 'pant'].includes(A.name)) && Math.random() < .3) { const [tx, ty] = nearPoint(near.x, floorY(monAt(near.x, near.y)) + (GY - 20) * s, 20); moveTo(tx, ty, 220 * SPD); } return; }
    const q = reach[0]; lastPop = now();
    if (T && T.event) T.event.emit('prop-kick', { kind: 'bubbles', pop: q.id }).catch(() => {});
    say(pick(['Хлоп!', 'Ап!', 'Лопнул{|а}!', BIRD ? 'Клюк!' : 'Пуф!']), 700);
    start('bubble', { pose: 'leap', dur: 500, rate: 14, tick: (dt, qq) => { lift = Math.sin(Math.min(1, qq / .5) * Math.PI) * clamp((c.y - q.y) / s, 10, 70); }, exit: () => { lift = 0; }, after: () => land(() => acts.sit(1200)) });
  }
  function scratchPost() {
    if (!post || now() - post.t > 3000) return acts.sit();
    lastPost = now();
    const s = S(), side = myCenter().x < post.x ? -1 : 1, [tx, ty] = clampPos(post.x - CX * s + side * 34 * s, post.y - (GY - 2) * s);
    moveTo(tx, ty, 120 * SPD, { after: () => { faceT = -side;
      start('scratchPost', { pose: 'up', dur: rnd(4000, 7000), rate: 10, mod: (T_, q) => { T_.armL = .8 + Math.sin(q * 9) * .2; T_.armR = .8 - Math.sin(q * 9) * .2; T_.yaw = -side * .5; T_.happy = q > 1 ? .6 : 0; T_.tail = 20; },
        tick: (dt, q) => { if (Math.floor(q * 2) !== A.nt) { A.nt = Math.floor(q * 2); if (T && T.event) T.event.emit('prop-kick', { kind: 'post' }).catch(() => {}); } },
        enter: () => say(pick(['Дерррр!', 'Когти точу', 'Вжик-вжик']), 1500), after: () => { say(pick(['Хорошо-о', 'Острые!', 'Довол{ен|ьна}']), 1400); acts.stretch(); } }); } });
  }
  // ---------- угадай лапу: семечка под одной из лап, лапы меняются, надо щёлкнуть по нужной ----------
  let shell = null, shellScore = { win: 0, lose: 0 };
  try { shellScore = JSON.parse(localStorage.getItem('shell:' + PET.label) || 'null') || shellScore; } catch (_) { /* без счёта */ }
  function shellGame() {
    if (BIRD) return acts.sit();
    const [tx, ty] = nearPoint(cur.x, cur.y, 120);
    say('Смотри внимательно…', 1500);
    moveTo(tx, ty, 200 * SPD, { after: () => {
      shell = { side: Math.random() < .5 ? -1 : 1, phase: 'show', t0: now(), swaps: 0 };
      start('shell', { pose: 'sit', dur: 60000, mod: (T_, q) => {
        if (shell.phase === 'show') { T_.pawL = shell.side < 0 ? .8 : 0; T_.pawR = shell.side > 0 ? .8 : 0; if (q > 1.6) { shell.phase = 'swap'; shell.t0 = now(); say('Меняю!', 900); } }
        else if (shell.phase === 'swap') {
          const k = (now() - shell.t0) / 1000, n = Math.floor(k / .45);
          T_.tilt = Math.sin(k * 14) * 6; T_.pawL = Math.max(0, Math.sin(k * 14)) * .5; T_.pawR = Math.max(0, -Math.sin(k * 14)) * .5;
          if (n > shell.swaps) { shell.swaps = n; if (Math.random() < .6) shell.side = -shell.side; }
          if (k > 3.2) { shell.phase = 'ask'; say('Где семечка? Щёлкни по лапе', 5000); }
        } else if (shell.phase === 'ask') { T_.pup = .9; T_.headTilt = Math.sin(q * 2) * 6; }
      }, exit: () => { shell = null; } });
    } });
  }
  function shellPick() {                          // щелчок: левая или правая половина зверя
    if (!shell || shell.phase !== 'ask') return;
    const s = S(), lx = (cur.x - sentX) / s, side = lx < CX + offX ? -1 : 1, win = side === shell.side, sd = shell.side;
    shell = null;
    if (win) { shellScore.win++; achCount('shell'); } else shellScore.lose++;
    try { localStorage.setItem('shell:' + PET.label, JSON.stringify(shellScore)); } catch (_) { /* без счёта */ }
    start('shellEnd', { pose: 'sit', dur: 3500, mod: (T_) => { T_.pawL = sd < 0 ? .9 : 0; T_.pawR = sd > 0 ? .9 : 0; T_.happy = win ? 0 : 1; T_.tilt = win ? 0 : sd * 6; } });
    say((win ? pick(['Угадал{|а}! ', 'Точно! ', 'Есть! ']) : pick(['Мимо! Она тут. ', 'Не-а. ', 'Обманул{|а}! '])) + `Счёт ${shellScore.win}:${shellScore.lose}`, 3200);
    if (win) hearts(2);
  }
  // ---------- помидор: 25 минут работы, 5 отдыха ----------
  let pomo = null;
  function pomodoro(on) {
    if (!on) { if (pomo) say('Помидор выключен', 1400); pomo = null; return; }
    pomo = { phase: 'work', until: now() + 25 * 60000, leader: PET.label };
    say(pick(['Работаем 25 минут. Я рядом', 'Помидор пошёл! Не отвлекайся', '25 минут — и перерыв']), 2600);
    const [tx, ty] = nearPoint(cur.x, cur.y, 110);
    moveTo(tx, ty, 200 * SPD, { after: () => start('work', { pose: 'sit', dur: 1e9, watch: true, mod: (T_) => { T_.headTilt = 0; T_.pup = .7; T_.ear = -.3; } }) });
  }
  function pomoTick() {
    if (!pomo || now() < pomo.until) return;
    if (pomo.phase === 'work') {
      pomo.phase = 'rest'; pomo.until = now() + 5 * 60000;
      play(TX().snd, true, 2); hearts(3);
      say(pick(['Динь! Перерыв 5 минут', 'Стоп. Встань, потянись, попей', '25 минут прошло — отдыхаем!']), 4000); achCount('pomo');
      BIRD ? acts.wingStretch() : acts.stretch();
      setTimeout(() => { if (pomo) cheer(pick(['Хорошо поработал(а)', 'Полдела сделано', 'Молодец. Ещё один помидор потом'])); }, 3500);
    } else {
      pomo.phase = 'work'; pomo.until = now() + 25 * 60000;
      say(pick(['Перерыв окончен. Работаем!', 'Ещё 25 минут. Я слежу', 'Поехали дальше']), 2600);
      const [tx, ty] = nearPoint(cur.x, cur.y, 110);
      moveTo(tx, ty, 200 * SPD, { after: () => start('work', { pose: 'sit', dur: 1e9, watch: true }) });
    }
  }
  // ---------- прятки ----------
  // Из трея играют все. Роли в каждом окне считаются одинаково — по общему списку меток и «зерну»
  // из времени команды, координатор не нужен: один водит (считает до трёх, потом ищет), остальные
  // прячутся, каждый в своём краю экрана (края всех мониторов по порядку). Малыши не водят.
  // Спрятавшегося находит человек щелчком или водящий, подойдя вплотную. Один питомец — прячется сам.
  // События: hide-seek (водящий → спрятавшемуся), hide-found (спрятавшийся → всем), hide-over и
  // hide-out (конец игры / вышел сам).
  let hiding = null, seeking = null;
  function hideSpots() { const out = []; for (const m of [...mons].sort((a, b) => a.x - b.x || a.y - b.y)) { out.push({ m, side: -1 }); out.push({ m, side: 1 }); } return out; }
  function hideParty() {
    if (GUEST || away || hiding || seeking || DEMO) return;
    const labels = [PET.label, ...[...friends.values()].filter(f => now() - f.t < 3000 && f.label !== 'guest').map(f => f.label)].sort();
    if (labels.length < 2) return hideAndSeek();
    const seed = Math.floor(Date.now() / 30000);
    const grown = labels.filter(l => l === PET.label ? !isBaby() : !(friends.get(l) || {}).baby);
    const pool = grown.length ? grown : labels, seeker = pool[seed % pool.length];
    if (seeker === PET.label) return seekStart(labels.filter(l => l !== seeker));
    const hiders = labels.filter(l => l !== seeker), spots = hideSpots();
    hideAndSeek(spots[hiders.indexOf(PET.label) % spots.length], true);
  }
  function hideAndSeek(spot, party) {
    const s = S(), c = myCenter(), m = (spot && spot.m) || monAt(c.x, c.y); if (!m) return acts.sit();
    const side = spot ? spot.side : (Math.random() < .5 ? -1 : 1);
    // за край экрана так, чтобы торчали уши (или хвост): окно почти целиком снаружи
    const tx = side < 0 ? m.x - (W - 62) * s : m.x + m.w - 62 * s;
    say(pick(party ? ['Прячусь!', 'Тсс…', 'Меня тут нет'] : ['Спорим, не найдёшь?', 'Прячусь!', 'Ку-ку…']), 1200);
    moveTo(tx, floorY(m), 260 * SPD, { after: () => {
      hiding = { t0: now(), side, peeked: 0, party: !!party };
      faceT = -side;
      start('hide', { pose: 'sit', dur: 120000, mod: (T_) => { T_.ear = -.6; T_.pup = .9; },
        tick: () => {                            // долго не ищут — выглянуть и спрятаться обратно
          const q = now() - hiding.t0;
          if (q > 25000 && !hiding.peeked) { hiding.peeked = 1; x += -side * 30 * s; say(pick(['Ку-ку!', 'Я тут… ой', 'Ищи лучше']), 1200); setTimeout(() => { if (hiding) x -= -side * 30 * s; }, 1600); }
          if (q > (hiding.party ? 100000 : 60000)) { hiding = null; A = null; say(pick(['Ладно, я сам{|а} выйду', 'Не нашёл? Я тут!']), 1500); if (T && T.event) T.event.emit('hide-out', { label: PET.label }).catch(() => {}); acts.walk(); }
        }, exit: () => { hiding = null; } });
    } });
  }
  function found(by) {                           // нашли — выскочить с радостью
    const s = S(), side = hiding.side; hiding = null;
    say(by ? pick(['Ай! Нашёл{|а} меня!', 'Попал{ся|ась}…', 'Как ты меня учуял{|а}?!']) : pick(['Нашёл{|а}!', 'Ай! Нашёл{|а}!', 'Как ты догадал{ся|ась}?!']), 1600); hearts(2); play(TX().snd, true, 1); achCount('hide');
    if (T && T.event) T.event.emit('hide-found', { label: PET.label, by: by || 'user' }).catch(() => {});
    start('found', { pose: 'leap', dur: 500, rate: 14, tick: (dt, q) => { x += -side * 180 * s * dt; lift = Math.sin(Math.min(1, q / .5) * Math.PI) * 30; }, exit: () => { lift = 0; }, after: () => land(() => start('pet', { pose: 'sit', dur: 2500, watch: true, mod: (T_) => { T_.happy = 1; T_.tail = 30; } })) });
  }
  function seekStart(hiders) {                   // водящий: считает, потом ищет — то наугад, то к ближайшему спрятавшемуся
    seeking = { hiders: new Set(hiders), t0: now(), found: [] };
    say('Раз… два… три…', 3800);
    const over = (text) => { A = null; seeking = null; say(text, 2200); if (T && T.event) T.event.emit('hide-over', { by: PET.label }).catch(() => {}); acts.sit(3000); };
    start('count', { pose: 'sit', dur: 4200, watch: false, mod: (T_) => { T_.pawL = 1; T_.pawR = 1; T_.headY = 4; T_.headTilt = -8; }, after: () => {
      say('Иду искать!', 1500); mark('!');
      let target = null, lastSay = now();
      start('seek', { pose: 'walk', dur: 1e9, tick: (dt) => {
        const s = S(), c = myCenter();
        const left = [...seeking.hiders].map(l => friends.get(l)).filter(f => f && now() - f.t < 3000);
        if (!seeking.hiders.size) return over(seeking.found.length ? pick(['Всех нашёл{|а}!', 'Победа!']) : 'Все вышли сами');
        if (now() - seeking.t0 > 95000) return over('Сдаюсь! Выходите!');
        if (!target || now() > target.until) {
          const m = monAt(c.x, c.y) || mons[0];
          if (Math.random() < .45 || !left.length) { const [rx, ry] = clampPos(x + rnd(-500, 500) * s, floorY(m), m); target = { x: rx, y: ry, until: now() + rnd(2500, 5000), who: null }; if (now() - lastSay > 6000) { lastSay = now(); say(pick(['Где же вы?', 'Тут нет…', 'Я иду!', 'Ага, слышу шорох']), 1500); } }
          else { const f = left.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0]; const [hx, hy] = nearPoint(f.x + CX * s, f.y + GY * s, 60); target = { x: hx, y: hy, until: now() + 12000, who: f.label }; }
        }
        const dx = target.x - x, dy = target.y - y, d = Math.hypot(dx, dy), v = Math.min(d, 150 * SPD * s * dt);
        if (d > 2 * s) { x += dx / d * v; y += dy / d * v; if (Math.abs(dx) > 4 * s) faceT = dx > 0 ? 1 : -1; moveGait(v / s, dt, 'walk'); }
        else { gw = Math.max(0, gw - dt * 5); if (!target.who) target.until = 0; }
        if (target.who) {
          const f = friends.get(target.who);
          if (!f || now() - f.t > 3000 || !seeking.hiders.has(target.who)) { target = null; return; }
          if (Math.hypot(f.x + CX * s - c.x, f.y + GY * s - (y + GY * s)) / s < 140) { seeking.hiders.delete(target.who); seeking.found.push(target.who); say(pick(['Попал{ся|ась}!', 'Вот ты где!', 'Нашёл{|а}!']), 1500); mark('!'); if (T && T.event) T.event.emit('hide-seek', { label: target.who, by: PET.label }).catch(() => {}); target = null; }
        }
      } });
    } });
  }
  // ---------- лазер, бабочка, лежанка ----------
  let laser = null, butterfly = null, bed = null, lastLaserPounce = -1e9, lastBfly = -1e9;
  const busy = () => A && ['hang', 'fly', 'sleep', 'eat', 'ride', 'chat', 'carry', 'kick', 'tagChase', 'tagRun', 'stuff', 'wheel', 'bowlCarry', 'beg', 'relayGo', 'relayCarry', 'comfortGo', 'meetGo', 'noteGo', 'noteHold'].includes(A.name);   // миска, просьба поесть, эстафета, утешение, встреча — тоже дело, листик подождёт
  function onLaser(l) {                          // красная точка: коты, щенки и птицы гонятся, хомяк с кроликом смотрят
    laser = l; careMark('play');
    if (A && A.name === 'laser') return;
    if (busy() || (HAM || RAB) || Math.hypot(l.x - myCenter().x, l.y - myCenter().y) / S() > 900) return;
    say(pick(['Точка!', 'Поймаю!', 'Что это?!']), 900);
    start('laser', { pose: FLY ? 'fly' : 'crouch', dur: 60000, mod: FLY ? flapMod : (T_) => { T_.pup = 1; T_.ear = -1; }, tick: (dt) => {
      if (!laser || now() - laser.t > 1500) { A = null; say(pick(['Куда делась?', 'Исчезла…', 'Хм.']), 1200); return acts.sit(2500); }
      const s = S(), [tx, ty] = nearPoint(laser.x, laser.y, 12), dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy);
      const v = Math.min(d, (FLY ? 360 : DOG ? 330 : 310) * s * dt);
      if (d > 1) { x += dx / d * v; y += dy / d * v; }
      if (Math.abs(dx) > 4 * s) faceT = dx > 0 ? 1 : -1;
      if (FLY) { gw = 0; return; }
      moveGait(v / s, dt, 'run');
      if (d < 30 * s && now() - lastLaserPounce > 1500) { lastLaserPounce = now(); say(pick(['Ап!', 'Хвать!', 'Поймал{|а}?']), 700); lift = 0; fx('mark', '!', 20, -18, 600); }
    } });
  }
  function onButterfly(b) {                      // бабочка: кот подкрадывается и прыгает, птица ловит на лету, щенок лает
    butterfly = b;
    if (b.caught) { butterfly = null; return; }
    if (busy() || (A && A.name === 'bfly') || now() - lastBfly < 20000) return;
    const s = S(), d = Math.hypot(b.x - myCenter().x, b.y - myCenter().y) / s;
    if (d > 500 || Math.random() < .6) return;
    lastBfly = now();
    if (FLY) {
      say(pick(['Бабочка!', 'Моя!']), 900);
      return start('bfly', { pose: 'fly', dur: 12000, mod: flapMod, tick: (dt) => {
        if (!butterfly || now() - butterfly.t > 1500) { A = null; return acts.sit(2000); }
        const [tx, ty] = [butterfly.x - CX * s, butterfly.y - (GY - 60) * s], dx = tx - x, dy = ty - y, dd = Math.hypot(dx, dy), v = Math.min(dd, 330 * s * dt);
        if (dd > 1) { x += dx / dd * v; y += dy / dd * v; } if (Math.abs(dx) > 4 * s) faceT = dx > 0 ? 1 : -1; gw = 0;
        if (dd < 25 * s) { T.event.emit('prop-kick', { kind: 'butterfly', caught: true }).catch(() => {}); butterfly = null; A = null; achCount('butterfly'); say(pick(['Клюк! Поймал{|а}!', 'Ам!']), 1400); return soarTo(...clampPos(x, floorY(monAt(x, y)) ), () => acts.sit(3000)); }
      } });
    }
    if (DOG) { say(pick(['Гав! Бабочка!', 'Что это летает?!']), 1200); play('bark', false, 2);
      return start('bfly', { pose: 'sit', dur: 3000, watch: false, mod: (T_, q) => { T_.headTilt = Math.sin(q * 3) * 18; T_.headY = -4; T_.pawL = Math.max(0, Math.sin(q * 8)); T_.tail = 40; } }); }
    if (CAT) {
      const low = b.y > (monAt(b.x, b.y) || { y: 0, h: 0 }).y + (monAt(b.x, b.y) || { h: 0 }).h - 160 * s;
      if (!low) { return start('bfly', { pose: 'sit', dur: 3000, mod: (T_, q) => { T_.headY = -6; T_.pup = 1; T_.headTilt = Math.sin(q * 2) * 12; T_.ear = -1; } }); }   // высоко — только смотрит
      say(pick(['…', '*крадётся*', 'Тихо…']), 900);
      return start('crouch', { pose: 'crouch', dur: 1400, rate: 6, mod: (T_, q) => { if (q > .5) T_.tilt += Math.sin(q * 26) * 2.5; },
        after: () => { if (!butterfly || now() - butterfly.t > 1500) return acts.sit(2000);
          leap(...clampPos(butterfly.x - CX * s, floorY(monAt(butterfly.x, butterfly.y))), () => {
            if (butterfly && Math.random() < .35) { T.event.emit('prop-kick', { kind: 'butterfly', caught: true }).catch(() => {}); say('Поймал{|а}!', 1400); hearts(2); achCount('butterfly'); }
            else { T.event.emit('prop-kick', { kind: 'butterfly' }).catch(() => {}); say(pick(['Улетела!', 'Эх…', 'Ещё раз!']), 1200); }
            acts.sit(2500); }); } });
    }
  }
  // ---------- хитрая мышь ----------
  // Окно мыши (prop.js) шлёт prop-pos { x, y, hidden, gone, slip }. Коты гонятся все разом — каждое окно
  // само, — но мышь быстрее и ныряет в норки, поэтому поймать нельзя: в этом и игра. Остальные виды
  // реагируют одной репликой на появление. Замечают не все сразу, чтобы не стартовали строем.
  let mouse = null, mouseSeen = 0, mouseTired = -1e9, mouseSaid = -1e9, mouseEscapeDone = false;
  // Мышь по сети: своя, не пойманная, «сбегает» к случайному коллеге (старший кот шлёт /send mouse);
  // чужая приходит с именем хозяина — старший объявляет, откуда она.
  async function mouseEscape() {
    if (mouseEscapeDone || GUEST || DEMO || !invoke || !visitsOn || PET.label !== leaderLabel()) return; mouseEscapeDone = true;
    try { if (!me) me = await invoke('whoami'); if (!peers.length) peers = await portal('GET', '/peers?client=' + encodeURIComponent(me.client)); } catch (_) { return; }
    if (!peers.length) return;
    const to = pick(peers);
    try { await portal('POST', '/send', { from: me.client, to: to.client, kind: 'mouse', payload: {} }); say(`Мышь удрала к ${to.name}!`, 2600); } catch (_) { /* портал недоступен — просто ушла */ }
  }
  function onMouse(m) {
    const fresh = !mouse || now() - mouse.t > 5000; mouse = m;
    if (fresh) { mouseSeen = now() + rnd(0, 2200); mouseEscapeDone = false; if (m.from && CAT && PET.label === leaderLabel() && !GUEST) say(`Мышь от ${m.from} прибежала!`, 2600); }
    if (m.gone && m.escape) mouseEscape();
    if (m.gone) { if (A && A.name === 'mouse') { A = null; say(pick(['Ушла… Но я её найду', 'Хитрая…', 'В следующий раз!']), 2000); acts.sit(3000); } return; }
    if (GUEST || away) return;
    if (A && A.name === 'mouse') return;         // уже гонимся — дальше смотрит tick
    if (now() < mouseSeen || busy() || m.hidden) return;
    const s = S(), c = myCenter(), d = Math.hypot(m.x - c.x, m.y - c.y) / s;
    if (!CAT) {                                  // не кот — одна реплика на мышь
      if (now() - mouseSaid < 60000 || d > 900) return; mouseSaid = now();
      if (Math.abs(m.x - c.x) > 4 * s) faceT = m.x > c.x ? 1 : -1;
      if (DOG) { play('bark', false, 2); say(pick(['Гав! Мышь!', 'Кто это шуршит?!', 'Ррр… мелочь']), 1400); return start('bfly', { pose: 'sit', dur: 3000, watch: false, mod: (T_, q) => { T_.headTilt = Math.sin(q * 3) * 18; T_.tail = 40; } }); }
      if (HAM) return say(pick(['Родня!', 'Привет, сестрёнка!', 'Пи-пи! Сюда!']), 1600);
      if (RAB) { say(pick(['Ой, мышь', 'Фыр! Кто тут?']), 1400); return start('look', { pose: 'sit', dur: 2500, mod: (T_) => { T_.ear = 1; T_.pup = 1; } }); }
      if (BIRD) return say(pick(['Кто шуршит?', 'Мышь! Всем тревога!', 'Крр… мелкая']), 1600);
      if (DRAGON) return say(pick(['Мышь? Пф-ф', 'Не мой размер', 'Пусть бегает']), 1600);
      if (KUZYA) { mark('!'); say(pick(['Мышь! Кыш, кыш!', 'Ох, нечисть хвостатая', 'Где мой валенок?!']), 1800); return start('shoo', { pose: 'up', dur: 2200, mod: (T_, q) => { T_.armL = T_.armR = 1; T_.mouth = q < 1 ? .8 : 0; } }); }
      if (CLIP) return say('Похоже, у вас мышь. Хотите, помогу её поймать?', 3000);
      return say(pick(['Ой!', 'Мышка!']), 1400);
    }
    if (now() - mouseTired < 12000 || d > 3200) return;
    mouseChase();
  }
  function mouseChase() {
    const giveUp = now() + rnd(40000, 60000); let lastPounce = -1e9, pounceT = -1e9, holeSaid = 0, slipSaid = -1e9;
    focus(60000);
    careMark('play'); achCount('mouse');
    say(pick(['Мышь!', 'Мыыышь!', 'Поймаю!', 'Моя!']), 1000); if (Math.random() < .5) play(TX().snd, false, 1);
    start('mouse', { pose: 'crouch', dur: 1e9, mod: (T_) => { T_.pup = 1; T_.ear = -1; }, tick: (dt) => {
      const s = S();
      if (!mouse || now() - mouse.t > 1500 || mouse.gone) { A = null; say(pick(['Ушла…', 'Где она?!', 'Хитрая…']), 1500); return acts.sit(2500); }
      if (now() > giveUp) { A = null; mouseTired = now(); say(pick(['Уф… хитрая', 'Отдохну. Потом поймаю', 'Не догнать…']), 2000); return start('pant', { pose: 'sit', dur: 6000, mod: (T_, q) => { T_.mouth = .4; T_.bob += Math.sin(q * 10) * 1.2; }, after: () => acts.sit(2000) }); }
      if (mouse.slip && now() - slipSaid > 3000) { slipSaid = now(); say(pick(['Куда?!', 'Эй!', 'Под лапами!']), 900); fx('mark', '?', 20, -18, 600); }
      const c = myCenter();
      if (mouse.hidden) {                        // в норке — подойти и караулить у входа
        const [hx, hy] = nearPoint(mouse.x, mouse.y, 80), dx = hx - x, dy = hy - y, d = Math.hypot(dx, dy), v = Math.min(d, 220 * SPD * s * dt);
        if (d > 2 * s) { x += dx / d * v; y += dy / d * v; moveGait(v / s, dt, 'walk'); if (Math.abs(dx) > 4 * s) faceT = dx > 0 ? 1 : -1; }
        else { gw = Math.max(0, gw - dt * 5); faceT = mouse.x > c.x ? 1 : -1; if (!holeSaid) { holeSaid = 1; say(pick(['Караулю…', 'Тут её норка', 'Выходи!']), 1600); } }
        lift = 0; return;
      }
      holeSaid = 0;
      const [tx, ty] = nearPoint(mouse.x, mouse.y, 12), dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy);
      const v = Math.min(d, (isBaby() ? 250 : 320) * SPD * s * dt);
      if (d > 1) { x += dx / d * v; y += dy / d * v; }
      if (Math.abs(dx) > 4 * s) faceT = dx > 0 ? 1 : -1;
      moveGait(v / s, dt, 'run');
      const dm = Math.hypot(mouse.x - c.x, mouse.y - c.y) / s;
      if (dm < 80 && now() - lastPounce > 2500) {  // прыжок — всегда мимо: мышь уже рванула
        lastPounce = pounceT = now(); say(pick(['Хвать!', 'Ап!', 'Попалась?!', 'Мимо…']), 800); fx('mark', '!', 20, -18, 600);
        if (T && T.event) T.event.emit('prop-kick', { kind: 'mouse', pounce: true, x: c.x, y: c.y }).catch(() => {});
      }
      const pq = (now() - pounceT) / 380; lift = pq < 1 ? Math.sin(pq * Math.PI) * 24 : 0;
    }, exit: () => { lift = 0; } });
  }
  // ---------- мышь по расписанию ----------
  // Старший кот выпускает мышь раз в 20–40 минут (первую — через 8–15 минут после запуска); срок лежит
  // в localStorage, перезапуск его не сбрасывает. Не ночью, не в тихом режиме, не во время звонка и не
  // пока предыдущая ещё бегает. Плюс «Мышь!» в трее — в любой момент.
  function leaderCat() { let best = CAT ? PET.label : null; for (const f of friends.values()) if (now() - f.t < 3000 && f.sp === 'cat' && f.label !== 'guest' && (!best || f.label < best)) best = f.label; return best; }
  function mouseSchedule() {
    if (DEMO || GUEST || !invoke || !CAT || PET.label !== leaderCat()) return;
    let at = 0; try { at = +localStorage.getItem('mouse:next') || 0; } catch (_) { /* без памяти — по таймеру процесса */ }
    if (!at || at > Date.now() + 45 * 60000) { at = Date.now() + rnd(8, 15) * 60000; try { localStorage.setItem('mouse:next', String(at)); } catch (_) { /* без памяти */ } }
    if (Date.now() < at || night() || quiet() || inCall || (mouse && now() - mouse.t < 5000)) return;
    const s = S(), m = monAt(x + CX * s, y + GY * s); if (!m) return;
    invoke('prop_show', { kind: 'mouse', x: Math.round(m.x + m.w / 2), y: Math.round(m.y + m.h - 10 * s) }).catch(() => {});
    try { localStorage.setItem('mouse:next', String(Date.now() + rnd(20, 40) * 60000)); } catch (_) { /* без памяти */ }
  }
  if (!DEMO && invoke) setInterval(mouseSchedule, 30000);
  // ---------- подарок от коллеги ----------
  // Окно подарка (prop.js) шлёт prop-pos { what, from, msg, food, pop, balloons, eaten, gone }. Все
  // питомцы бегут смотреть с разбросом, нюхают и комментируют по виду подарка и по себе: еду съедает
  // тот, кому она по вкусу и кто добежал первым, шарики лопают по одному, открытку читает старший.
  let gift = null, giftSeen = 0, giftDone = 0;
  const giftEdible = kind => kind === 'all' || (kind === 'cat' && CAT) || (kind === 'dog' && DOG) || (kind === 'herb' && (HAM || RAB));
  function giftLines(what, from) {
    const L = {
      flowers: CAT ? ['Апчхи! Но красиво', 'Цветочки… можно пожевать?', `${from} с цветами. Мур`] : DOG ? ['Пахнет! Гав!', 'Цветы! А есть их можно?'] : (HAM || RAB) ? ['Можно погрызть?', 'Букет! Хрум?'] : BIRD ? ['Цветы! Как в саду', 'Кррасота!'] : ['Какая красота!', `${from} — молодец`],
      candy: ['Конфеты! Это мне?', 'Сладко пахнет…', `${from} знает толк`],
      balloons: ['Ой, летят!', 'Шарики! Лопну!', 'Что это такое воздушное?'],
      cake: ['Торт! Мне кусочек?', 'У кого-то праздник?', `${from} испёк(ла)? Ого`],
      teddy: ['Новый друг!', 'Мягкий… обниму', 'Он живой?'],
      postcard: ['Письмо! Читаем?', 'Открытка!', 'Что там написано?'],
      bone: DOG ? ['Косточка! Моя!', 'Гав! Спасибо!'] : ['Это для собак', 'Кость. Ну ладно'],
      fish: CAT ? ['Рыбка! Мяу!', 'Вот это подарок'] : ['Рыбой пахнет', 'Это для котов'],
      carrot: (HAM || RAB) ? ['Морковка! Хрум!', 'Моя любимая!'] : ['Морковка. Для кроликов', 'Оранжевая штука'],
      pie: ['Пирожок!', 'Тёплый ещё?', `${from} печёт лучше всех`],
    };
    return L[what] || [`Подарок от ${from}!`, 'Что это?', 'Ух ты!'];
  }
  function onGift(g) {
    const fresh = !gift || now() - gift.t > 5000; gift = g;
    if (fresh) { giftSeen = now() + rnd(300, 2200); giftDone = 0; focus(20000); if (PET.label === leaderLabel() && !GUEST) { achCount('giftGet'); say(`${g.from} прислал(а) подарок!`, 2400); } }
    if (g.gone || GUEST || away || giftDone || now() < giftSeen) return;
    if ((A && (A.name === 'giftGo' || A.name === 'giftLook')) || busy()) return;
    giftDone = 1; giftGo();
  }
  function giftGo() {
    const s = S(), m = monAt(gift.x, gift.y) || mons[0], side = myCenter().x < gift.x ? -1 : 1;
    const [tx, ty] = clampPos(gift.x + side * rnd(75, 115) * s - CX * s, floorY(m), m);
    moveTo(tx, ty, 220 * SPD, { name: 'giftGo', after: () => {
      if (!gift || now() - gift.t > 2000 || gift.gone) return acts.sit();
      faceT = -side; mark('!');
      start('giftLook', { pose: 'sniff', dur: 2000, rate: 6, mod: (T_, q) => { T_.headY += Math.sin(q * 9) * 1.5; }, after: giftReact });
    } });
  }
  function giftReact() {
    if (!gift || gift.gone) return acts.sit();
    const G = (window.GIFTS || {})[gift.what] || {}, from = gift.from;
    say(pick(giftLines(gift.what, from)), 2400); hearts(2); careMark('play');
    if (G.food && !gift.eaten && giftEdible(G.food)) {   // еда — съесть, если первым добежал и никто ещё не съел
      return setTimeout(() => {
        if (gift && !gift.eaten && !gift.gone) { if (T && T.event) T.event.emit('prop-kick', { kind: 'gift', eaten: true, label: PET.label }).catch(() => {}); say(pick(['Ням!', 'Вкусно!', `Спасибо, ${from}!`]), 1800); feed(); }
        else acts.sit(2000);
      }, 1500);
    }
    if (G.pop) return giftBat(0);
    if (gift.what === 'postcard' && gift.msg && PET.label === leaderLabel()) return setTimeout(() => { say(`«${gift.msg}»`, 4200); start('read', { pose: 'sit', dur: 4200, watch: false, mod: (T_) => { T_.headY = 4; T_.headTilt = -6; } }); }, 2200);
    start('admire', { pose: 'sit', dur: rnd(3000, 6000), watch: false, mod: (T_, q) => { T_.happy = .6; T_.headTilt = Math.sin(q * 2) * 8; T_.tail = 25; } });
  }
  function giftBat(n) {                          // шарики: подпрыгнуть и лопнуть, до трёх раз
    if (!gift || gift.gone || gift.balloons <= 0 || n >= 3) return acts.sit(2000);
    const s = S(), m = monAt(gift.x, gift.y) || mons[0];
    leap(...clampPos(gift.x - CX * s + (Math.random() < .5 ? -34 : 34) * s, floorY(m), m), () => {
      if (T && T.event) T.event.emit('prop-kick', { kind: 'gift', hit: true }).catch(() => {});
      say(pick(['Хлоп!', 'Бах!', 'Ещё один!']), 900);
      setTimeout(() => giftBat(n + 1), 1300);
    });
  }
  // ---------- напоминания ----------
  // Окно «Питомцы» пишет localStorage reminders = [{ id, at: 'ЧЧ:ММ', text, day }]; старший питомец раз
  // в 15 с смотрит: пора — подходит к курсору, говорит текст вслух и снимает напоминание.
  function remindersTick() {
    if (DEMO || GUEST || !invoke || PET.label !== leaderLabel()) return;
    let list = []; try { list = JSON.parse(localStorage.getItem('reminders') || '[]'); } catch (_) { return; }
    if (!list.length) return;
    const d = new Date(), hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), day = d.toISOString().slice(0, 10);
    const due = list.find(r => r.at <= hm && (!r.day || r.day <= day));
    if (!due) return;
    try { localStorage.setItem('reminders', JSON.stringify(list.filter(r => r.id !== due.id))); } catch (_) { /* без памяти */ }
    focus(15000); come();
    setTimeout(() => { mark('!'); say(`⏰ ${due.text}`, 9000); speak(due.text); play(TX().snd, true, 1); hearts(1); }, 2500);
  }
  if (!DEMO && invoke) setInterval(remindersTick, 15000);
  // ---------- просьба поесть: раз в час ----------
  // Через час после последней еды (и не чаще раза в час) питомец просит: кот и пёс приносят миску к курсору
  // (кот толкает носом, пёс несёт в зубах) и сидят рядом; птица кружит у курсора и стучит в стекло;
  // остальные — по-своему. Щелчок по миске или «Покормить» в трее — насыпать, питомец идёт есть.
  let bowl = null, lastAsk = -1e9, begging = false, lastBowlEat = -1e9;
  try { lastAsk = +localStorage.getItem('ask:' + PET.label) || -1e9; } catch (_) { /* без памяти */ }
  function bowlAlive() { return !!bowl && now() - bowl.t < 1500; }
  function askTick() {
    if (DEMO || GUEST || away || busy() || begging || night() || quiet() || inCall) return;
    if (careNow() - care.fed < 3600e3 || Date.now() - lastAsk < 3600e3 || Math.random() < .35) return;   // раз в час, не строем
    lastAsk = Date.now(); try { localStorage.setItem('ask:' + PET.label, String(lastAsk)); } catch (_) { /* без памяти */ }
    askFood();
  }
  if (!DEMO && invoke) setInterval(askTick, 60000);
  function askFood() {
    focus(20000);
    if (CAT || DOG) return bowlBring();
    if (BIRD) return birdAsk();
    const line = HAM ? 'Пи! Семечку!' : RAB ? 'Морковку бы…' : DRAGON ? 'Кушать. А то дыхну' : KUZYA ? 'Оладушков бы, хозяин' : CLIP ? 'Похоже, вы забыли покормить питомцев. Помочь?' : 'Есть хочу!';
    come();
    setTimeout(() => { say(line, 3200); if (RAB) play('thump', true); if (DRAGON) fx('zzz', '💨', 20, -30, 1200); start('hungry', { pose: HAM ? 'up' : 'sit', dur: 5000, watch: true, mod: (T_, q) => { T_.ear = .45; T_.headTilt += Math.sin(q * 1.5) * 8; } }); }, 2500);
  }
  function bowlBring(quiet) {
    const s = S(), c = myCenter(), m = monAt(c.x, c.y) || mons[0]; if (!m) return acts.sit();
    if (!quiet) say(pick(['Так. Миска', 'Сейчас принесу миску', 'Где моя миска?']), 1600);
    if (!bowlAlive()) invoke('prop_show', { kind: 'bowl', x: Math.round(c.x + face * 90 * s), y: Math.round(m.y + m.h - 2 * s) }).catch(() => {});
    let tries = 0;
    const go = () => {
      if (!bowlAlive()) { if (++tries < 20) return setTimeout(go, 300); return acts.sit(); }
      const [tx, ty] = nearPoint(bowl.x, bowl.y, DOG ? 26 : 34);
      moveTo(tx, ty, 150 * SPD, { name: 'walk', after: bowlCarry });
    };
    setTimeout(go, 400);
  }
  function bowlCarry() {
    const s = S(); say(DOG ? pick(['Ам. Несу!', 'Взял миску']) : pick(['Толкаю…', 'Ну-ка, поехали']), 1200);
    start('bowlCarry', { pose: DOG ? 'walk' : 'crouch', tx: x, ty: y, speed: 120 * SPD, dur: 30000, mod: (T_) => { if (DOG) { T_.mouth = .35; T_.headY = 6; } else { T_.headY = 12; T_.pup = 1; } },
      tick: () => {
        const [tx, ty] = nearPoint(cur.x, cur.y, 80); A.tx = tx; A.ty = ty;
        if (T && T.event) { let bx, by; if (DOG && info) { const mth = toCanvas(info.head.x + (R.yaw || 0) * 10, info.head.y + 14); bx = x + mth.x * s; by = y + mth.y * s + 10 * s; } else { bx = myCenter().x + face * 46 * s; by = y + GY * s; } T.event.emit('bowl-carry', { by: PET.label, x: bx, y: by }).catch(() => {}); }
      },
      after: () => { if (T && T.event) T.event.emit('prop-kick', { kind: 'bowl', drop: true }).catch(() => {}); beg(); } });
  }
  function beg() {
    begging = true; let lastSaid = now(), lastBang = now();
    say(pick(['Кушать!', 'Миска пустая!', 'Насыпь, а?']), 3000); mark('!');
    faceT = cur.x > myCenter().x ? 1 : -1;
    start('beg', { pose: 'sit', dur: 600000, watch: true, mod: (T_, q) => { T_.ear = .45; T_.headTilt += Math.sin(q * 1.5) * 8; T_.tail = 3; T_.happy = 0; if (A && now() - (A.bang || -1e9) < 450) { T_.pawR = 1; T_.headY = 4; } },
      tick: () => {
        if (!bowlAlive()) { A.dur = 0; return; }
        if (bowl.full) { A = null; return bowlEat(); }
        // пока ждём: кот стучит лапой по миске (она вздрагивает), пёс пинает её и бежит возвращать
        if (now() - lastBang > (DOG ? 15000 : 12000) && bowl && Math.abs(bowl.x - myCenter().x) / S() < 130) {   // по горизонтали: питомец у курсора стоит выше пола, миска на полу
          lastBang = now();
          if (DOG) { A = null; return bowlKick(); }
          A.bang = now(); faceT = bowl.x > myCenter().x ? 1 : -1;
          if (T && T.event) T.event.emit('prop-kick', { kind: 'bowl', bang: true }).catch(() => {});
          say(pick(['Дзынь!', 'Тук-тук по миске', 'Стучу. Миска. Пустая']), 1200);
        }
        if (now() - lastSaid > 45000) { lastSaid = now(); say(pick(['Ну кушать же…', 'Я жду', 'Щёлкни по миске', 'Голодн{ый|ая}. Очень']), 2600); }
      }, exit: () => { begging = false; } });
  }
  function bowlKick() {                          // пёс: пнул пустую миску, она отлетела — и побежал возвращать
    const s = S(); faceT = bowl.x > myCenter().x ? 1 : -1;
    say(pick(['Ну где еда?!', 'Пустая! Гав!', 'Миска, ты пустая']), 1400); play('bark', true, 1);
    start('kick', { pose: 'sit', dur: 700, rate: 16, mod: (T_, q) => { T_.pawR = q < .35 ? 1 : 0; T_.tilt = -face * 8; },
      after: () => { if (T && T.event) T.event.emit('prop-kick', { kind: 'bowl', vx: face * 260 * s, vy: -170 * s }).catch(() => {}); setTimeout(() => bowlBring(true), 900); } });
  }
  function bowlFeedShow() {                      // «Покормить» без миски на экране: сначала миска у лап, потом еда в неё
    const s = S(), c = myCenter(), m = monAt(c.x, c.y) || mons[0]; if (!m) return feedPlain();
    invoke('prop_show', { kind: 'bowl', x: Math.round(c.x + face * 70 * s), y: Math.round(m.y + m.h - 2 * s) }).catch(() => {});
    let tries = 0; const go = () => { if (!bowlAlive()) { if (++tries < 12) return setTimeout(go, 250); return feedPlain(); } if (T && T.event) T.event.emit('prop-kick', { kind: 'bowl', fill: true, food: foodKind }).catch(() => {}); bowlEat(); };
    setTimeout(go, 300);
  }
  function bowlEat() {
    begging = false; if (!bowlAlive()) return feed();
    lastBowlEat = now();
    const [tx, ty] = nearPoint(bowl.x, bowl.y, DOG ? 26 : 34);
    moveTo(tx, ty, 200 * SPD, { name: 'walk', after: () => {
      if (bowl.food === 'water') return drink();
      faceT = bowl.x > myCenter().x ? 1 : -1; feedCore(); say(bowl.food && foodTaste(bowl.food) === 'fav' ? `${FOOD[bowl.food].ico} Любимое!` : TX().eat, 2500); if (bowl.food && foodTaste(bowl.food) === 'fav') hearts(3);
      let last = now();
      start('eat', { pose: 'eat', dur: 6000, mod: (T_, q) => { chew(T_, q); T_.headY = 14; T_.armL = T_.armR = 0; },
        tick: () => { if (now() - last > 700) { last = now(); if (T && T.event) T.event.emit('prop-kick', { kind: 'bowl', eat: true, k: .13 }).catch(() => {}); } },
        exit: () => { hearts(4); say(TX().thanks, 2000); play(DOG ? 'bark' : CAT ? 'purr' : TX().snd, true, 1); bowlPeace(); },
        after: () => (DOG ? acts.zoomies(2) : Math.random() < .5 ? acts.sleep(40000) : acts.groom()) });
    } });
  }
  function birdAsk() {                           // птица: кружит у курсора, садится рядом и стучит в стекло
    const s = S(); say(pick(['Семечек!', 'Чирик! Есть хочу']), 1600);
    start('askFly', { pose: 'fly', dur: 4000, rate: 9, mod: flapMod, tick: (dt, q) => { const a = q * 3, tx = cur.x - CX * s + Math.cos(a) * 70 * s, ty = cur.y - (GY - 60) * s + Math.sin(a) * 40 * s; x += (tx - x) * Math.min(1, dt * 5); y += (ty - y) * Math.min(1, dt * 5); faceT = Math.cos(a + Math.PI / 2) > 0 ? 1 : -1; gw = 0; },
      after: () => { const [tx, ty] = nearPoint(cur.x, cur.y, 40); soarTo(tx, ty, () => { faceT = cur.x > myCenter().x ? 1 : -1; say('Тук-тук! Семечек!', 2600);
        let last = -1e9; start('knock', { pose: 'sit', dur: 4000, rate: 12, mod: (T_, q) => { T_.headY = 8 + Math.max(0, Math.sin(q * 12)) * 6; T_.headTilt = 6; }, tick: () => { if (now() - last > 600) { last = now(); mark('•'); } }, after: () => { play('chirp', true); acts.sit(3000); } }); }); } });
  }
  // ---------- задания дня ----------
  // Три задания на день (выбор по дате, одинаков у всех окон), прогресс — сумма счётчиков ach:<метка>
  // всех своих питомцев минус база на начало дня. Считает старший; запись quests:<день> читает окно «Питомцы».
  const QUESTS = [
    { id: 'pet3', title: 'Погладить питомца 3 раза', key: 'pet', need: 3 }, { id: 'fed', title: 'Покормить', key: 'fed', need: 1 },
    { id: 'visit', net: true, title: 'Сходить в гости', key: 'visit', need: 1 }, { id: 'gift', net: true, title: 'Подарить что-нибудь коллеге', key: 'gift', need: 1 },
    { id: 'mouse', title: 'Погоняться за мышью', key: 'mouse', need: 1 }, { id: 'play', title: 'Поиграть (лазер, мяч)', key: 'play', need: 1 },
    { id: 'guest', net: true, title: 'Принять гостя', key: 'guest', need: 1 }, { id: 'hide', title: 'Сыграть в прятки', key: 'hide', need: 1 },
    { id: 'photo', title: 'Сделать фото питомца', key: 'photo', need: 1 }, { id: 'trick', title: 'Показать трюк (в трее)', key: 'trickAny', need: 1 },
    { id: 'visitFriend', net: true, title: 'Сходить в гости к другу по сети', key: 'visitFriend', need: 1, pair: true }, { id: 'raceGuest', net: true, title: 'Сыграть гонку с гостем', key: 'race', need: 1, pair: true },
  ].filter(q => !q.net || (window.KOTIK_EDITION || {}).api);   // без сети питомцев — только домашние задания
  function questsTick() {
    if (DEMO || GUEST || !invoke || PET.label !== leaderLabel()) return;
    const day = new Date().toISOString().slice(0, 10); let q = null; try { q = JSON.parse(localStorage.getItem('quests:' + day) || 'null'); } catch (_) { /* без памяти */ }
    const labels = [PET.label, ...[...friends.values()].filter(f => now() - f.t < 3000 && f.label !== 'guest').map(f => f.label)];
    const sum = key => labels.reduce((n, l) => { try { const a = l === PET.label ? ach : JSON.parse(localStorage.getItem('ach:' + l) || 'null'); return n + ((a && a.n && a.n[key]) || 0); } catch (_) { return n; } }, 0);
    const store = v => { try { localStorage.setItem('quests:' + day, JSON.stringify(v)); } catch (_) { /* без памяти */ } };
    if (!q) {
      let h = 0; for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      const pool = QUESTS.slice(), pick3 = []; while (pick3.length < 3 && pool.length) { const i = h % pool.length; h = (Math.imul(h, 1103515245) + 12345) >>> 0; pick3.push(pool.splice(i, 1)[0]); }
      q = { day, items: pick3.map(p => ({ id: p.id, title: p.title, key: p.key, need: p.need, base: sum(p.key), done: false, pair: !!p.pair })), allDone: false }; store(q); return;
    }
    let changed = false;
    for (const it of q.items) if (!it.done && sum(it.key) - it.base >= it.need) {
      it.done = true; changed = true; if (!busy()) say(`Задание выполнено: ${it.title.toLowerCase()}!`, 3000); hearts(2);
      if (it.pair) {                             // парное задание: серия дней и запись в ленту
        let ps = { day: '', n: 0 }; try { ps = JSON.parse(localStorage.getItem('pairq:streak') || '{"day":"","n":0}'); } catch (_) { /* без памяти */ }
        if (ps.day !== day) { const y = new Date(Date.now() - 86400e3).toISOString().slice(0, 10); ps = { day, n: ps.day === y ? ps.n + 1 : 1 }; try { localStorage.setItem('pairq:streak', JSON.stringify(ps)); } catch (_) { /* без памяти */ } }
        portalEvent('pairquest', { title: it.title, with: lastPairWith || '', streak: ps.n });
      }
    }
    if (!q.allDone && q.items.every(i => i.done)) {
      q.allDone = true; changed = true; achCount('quest');
      let st = { day: '', n: 0 }; try { st = JSON.parse(localStorage.getItem('quest:streak') || '{"day":"","n":0}'); } catch (_) { /* без памяти */ }
      const y = new Date(Date.now() - 86400e3).toISOString().slice(0, 10); st = { day, n: st.day === y ? st.n + 1 : 1 }; try { localStorage.setItem('quest:streak', JSON.stringify(st)); } catch (_) { /* без памяти */ }
      setTimeout(() => { say(`Все задания дня выполнены! Серия: ${st.n} дн.`, 3600); hearts(4); }, 3500);
    }
    if (changed) store(q);
  }
  if (!DEMO && invoke) { setTimeout(questsTick, 8000); setInterval(questsTick, 60000); }
  // ---------- микроопросы ----------
  // Вопрос коллеги приходит сообщением poll → окно-опрос у питомца (prop.js), старший подходит и читает
  // вопрос вслух. Свой опрос (из окна «Питомцы») старший опрашивает раз в минуту и объявляет итог.
  let pollSeen = 0, myPolls = [];
  function onPoll(pp) {
    if (pp.id === pollSeen || GUEST || away || busy() || PET.label !== leaderLabel()) return; pollSeen = pp.id;
    focus(15000);
    const [tx, ty] = nearPoint(pp.x, pp.y + 60 * S(), 60);
    moveTo(tx, ty, 220 * SPD, { name: 'walk', after: () => { faceT = pp.x > myCenter().x ? 1 : -1; say(`${pp.owner} спрашивает: «${pp.text}»`, 5000); speak(`${pp.owner} спрашивает: ${pp.text}`); mark('?'); start('ask', { pose: 'sit', dur: 6000, watch: false, mod: (T_, q) => { T_.headTilt = Math.sin(q * 1.5) * 10; } }); } });
  }
  async function myPollsTick() {
    if (!myPolls.length || GUEST || PET.label !== leaderLabel()) return;
    for (const p of myPolls.slice()) {
      try { const st = await portal('GET', '/poll/' + p.id); if (!st) { myPolls = myPolls.filter(q => q !== p); continue; }
        if (st.total !== p.total && st.total) { p.total = st.total; if (!busy()) say(`Ответили ${st.total}: ` + st.options.map((o, i) => `${o} ${st.counts[i]}`).join(', '), 3200); }
        if (st.closed || now() - p.at > 31 * 60000) { myPolls = myPolls.filter(q => q !== p); say(`Итог опроса «${st.text}»: ` + st.options.map((o, i) => `${o} — ${st.counts[i]}`).join(', '), 5000); speak('Итог опроса: ' + st.options.map((o, i) => `${o} ${st.counts[i]}`).join(', ')); }
      } catch (_) { /* портал недоступен — спросим позже */ }
    }
  }
  if (!DEMO && invoke) setInterval(myPollsTick, 60000);
  // ---------- фотоальбом ----------
  // Селфи с гостем: хозяин просит у гостя его кадр (photo-req/photo-res), склеивает два кадра с подписью и
  // шлёт на портал; фото из трея тоже уходит в альбом, если не снята галочка «делиться» в окне «Питомцы».
  const albumOn = () => { try { return localStorage.getItem('album:off') !== '1'; } catch (_) { return true; } };
  function snapshotPng() { const off = document.createElement('canvas'); off.width = canvas.width; off.height = canvas.height; off.getContext('2d').drawImage(canvas, 0, 0); return off.toDataURL('image/png'); }
  async function albumUpload(dataUrl, caption, group) {
    if (DEMO || GUEST || !invoke || !albumOn()) return;
    try { if (!me) me = await invoke('whoami'); await portal('POST', '/photo', { client: me.client, png: dataUrl.split(',')[1], caption: String(caption || '').slice(0, 160), group: group || '' }); } catch (e) { console.error('альбом', e); }
  }
  function composeSelfie(guestPng, guestName, owner) {
    return new Promise(res => {
      const off = document.createElement('canvas'); off.width = 460; off.height = 220; const g = off.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 220); gr.addColorStop(0, '#f7efe3'); gr.addColorStop(1, '#e9d9c3'); g.fillStyle = gr; g.fillRect(0, 0, 460, 220);
      g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, 186, 460, 34);
      const mine = new Image(); mine.onload = () => {
        g.drawImage(mine, 10, 6, 220, 180);
        const other = new Image(); other.onload = () => { g.drawImage(other, 230, 6, 220, 180); fin(); }; other.onerror = fin; other.src = guestPng;
      }; mine.src = snapshotPng();
      function fin() { g.fillStyle = '#3a2a1a'; g.font = '600 14px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`📸 ${NAME} и ${guestName} (гость от ${owner})`, 230, 203, 440); res(off.toDataURL('image/png')); }
    });
  }
  // ---------- карточка «год с питомцем» ----------
  function yearCard() {
    const off = document.createElement('canvas'); off.width = 800; off.height = 450; const g = off.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 800, 450); gr.addColorStop(0, '#fbe6d6'); gr.addColorStop(1, '#f6f2ec'); g.fillStyle = gr; g.fillRect(0, 0, 800, 450);
    g.fillStyle = 'rgba(217,114,47,.12)'; g.beginPath(); g.arc(640, 120, 170, 0, Math.PI * 2); g.fill();
    const img = new Image(); img.onload = () => {
      g.drawImage(img, 40, 70, 352, 288);
      const n = ach.n || {}, days = Math.max(0, Math.floor(AGE)), born = PET.born ? new Date(PET.born).toLocaleDateString('ru-RU') : '';
      g.fillStyle = '#2b2520'; g.font = '700 34px system-ui, sans-serif'; g.textAlign = 'left'; g.fillText(NAME, 420, 80);
      g.fillStyle = '#857a6e'; g.font = '16px system-ui, sans-serif'; g.fillText(`${days} дней вместе${born ? ' · с ' + born : ''}`, 420, 108);
      const rows = [['🏅 бейджей', (ach.got || []).length], ['🍽 обедов', n.fed || 0], ['🤚 ласк', n.pet || 0], ['🚪 визитов', n.visit || 0], ['🛎 гостей', n.guest || 0], ['🎁 подарков получено', n.giftGet || 0], ['🐭 погонь за мышью', n.mouse || 0], ['🎓 трюков выучено', Object.keys(TRICKS).filter(trickLearned).length], ['🎯 дней с заданиями', n.quest || 0]];
      g.font = '18px system-ui, sans-serif'; rows.forEach(([t, v], i) => { const yy = 150 + i * 30; g.fillStyle = '#857a6e'; g.fillText(t, 420, yy); g.fillStyle = '#2b2520'; g.font = '700 18px system-ui, sans-serif'; g.textAlign = 'right'; g.fillText(String(v), 760, yy); g.textAlign = 'left'; g.font = '18px system-ui, sans-serif'; });
      g.fillStyle = '#857a6e'; g.font = '13px system-ui, sans-serif'; g.fillText(`Котик · ${new Date().toLocaleDateString('ru-RU')}`, 40, 420);
      const b64 = off.toDataURL('image/png').split(',')[1];
      invoke('save_photo', { name: NAME + ' — карточка', png: b64 }).then(p => { say('Карточка сохранена в «Изображения/Котик»', 3200); hearts(2); if (T && T.event) T.event.emit('card-done', { label: PET.label, path: p }).catch(() => {}); }).catch(e => { console.error('карточка', e); if (T && T.event) T.event.emit('card-done', { label: PET.label, error: String(e) }).catch(() => {}); });
    }; img.src = snapshotPng();
  }
  // лежанка: спать идём туда (если она есть и не дальше половины экрана), рядом умещаются двое
  function bedTarget() {
    if (!bed || now() - bed.t > 3000) return null;
    const s = S(), slot = (parseInt(PET.label.replace(/\D/g, ''), 10) || 1) % 2 ? -18 : 18;
    return clampPos(bed.x - CX * s + slot * s, bed.y - (GY - 6) * s);
  }
  // щенок приносит мяч: подбегает, «берёт в зубы» (мяч едет за мордой), несёт к курсору, кладёт
  function fetch_() {
    if (!ballAlive()) return acts.sit(2000);
    const s = S(), side = myCenter().x < ball.x ? -1 : 1;
    const [tx, ty] = clampPos(ball.x - CX * s + side * 30 * s, ball.y - (GY - 20) * s);
    moveTo(tx, ty, 330, { name: 'ballGo', ballOf: true, dur: 9000, after: () => {
      say(pick(['Ам!', 'Взял!', 'Моё!']), 900);
      start('carry', { pose: 'walk', follow: 70, tx: x, ty: y, speed: 260, dur: 12000, mod: (T_) => { T_.tail = 35; T_.mouth = .35; T_.tongue = 0; },
        tick: () => { if (T && T.event && info) { const m = toCanvas(info.head.x + (R.yaw || 0) * 10, info.head.y + 14); T.event.emit('prop-carry', { by: PET.label, x: x + m.x * s, y: y + m.y * s }).catch(() => {}); } },
        after: () => {
          const dir = cur.x > myCenter().x ? 1 : -1;
          if (T && T.event) T.event.emit('prop-kick', { kind: ball && ball.kind || 'ball', vx: dir * 90 * s, vy: -160 * s }).catch(() => {});
          say(pick(['Принёс! Ещё!', 'Вот! Кидай!', 'Ещё! Ещё!']), 1800); play('bark', true, 1);
          start('sit', { pose: 'sit', dur: 6000, watch: true, mod: (T_) => { T_.tail = 35; T_.tongue = 1; T_.mouth = .3; T_.ear = -.3; } });
        } });
    } });
  }
  function onUserKick() {                        // человек пнул мяч — кто рядом и свободен, бежит
    careMark('play');
    if (A && ['hang', 'fly', 'sleep', 'eat', 'ride', 'chat', 'carry', 'ballGo', 'kick', 'tagChase', 'tagRun', 'stuff', 'wheel'].includes(A.name)) return;
    if (Math.hypot(ball.x - myCenter().x, ball.y - myCenter().y) / S() > 900) return;
    lastBall = now();
    if (DOG) { say(pick(['Мяч! Мяч!', 'Принесу!', 'Гав! Мой!']), 1000); return fetch_(); }
    ballRounds = 2; say(pick(['Ой, мячик!', 'Лови!', 'Мой!']), 1000); ballPlay(null);
  }
  async function ballStart(f) {                   // попросить Rust показать мяч рядом и начать игру
    lastBall = now(); ballRounds = f ? 6 : 3;
    const s = S(), c = myCenter(), m = monAt(c.x, c.y);
    if (!m || !invoke) return acts.sit();
    say(pick(['Где мой мячик?', 'Мячик!', f ? 'Поиграем в мяч?' : 'Сам с собой поиграю']), 1500);
    try { await invoke('prop_show', { kind: 'ball', x: Math.round(c.x + face * 90 * s), y: Math.round(m.y + m.h - 30 * s) }); } catch (e) { return acts.sit(); }
    if (f && T && T.event) T.event.emit('pet-play', { to: f.label, from: PET.label, kind: 'ball' }).catch(() => {});
    start('sit', { pose: 'sit', dur: 1200, watch: true, after: () => ballPlay(f) });
  }
  // ---------- догонялки ----------
  // Зачинщик зовёт и убегает, второй гонится; осалил — меняются ролями; после 4 кругов оба отдыхают.
  function tagRun(other, round) {
    lastPlay = now();
    const s = S(), f = friends.get(other), m = monAt(x + CX * s, y + GY * s);
    const away = f && f.x > x ? -1 : 1;
    const [tx, ty] = clampPos(x + away * rnd(350, 650) * s, m ? floorY(m) : y);
    const o = { name: 'tagRun', other, round, dur: 14000, after: () => tagRun(other, round) };
    if (FLY) soarTo(tx, ty, o.after, o); else moveTo(tx, ty, 250 * SPD, o);
  }
  function tagChase(other, round) {
    lastPlay = now();
    const o = { name: 'tagChase', other, round, chaseOf: other, dur: 14000, tx: x, ty: y, speed: 275 * SPD, pose: FLY ? 'fly' : 'walk', mod: FLY ? flapMod : null, rate: 9 };
    start(FLY ? 'tagChase' : 'tagChase', o);
    if (FLY) { A.d0 = 1; }
  }
  function tagInvite(f) {
    say(pick(['Догоняй!', 'Кто последний — тот сонный!', 'Лови меня!']), 1500);
    if (T && T.event) T.event.emit('pet-play', { to: f.label, from: PET.label, kind: 'tag', role: 'chase', round: 1 }).catch(() => {});
    tagRun(f.label, 1);
  }
  function tagged(other, round) {                 // догнал
    say(pick(['Осалил{|а}!', 'Попался!', 'Есть!']), 1400);
    if (round >= 4) { if (T && T.event) T.event.emit('pet-play', { to: other, from: PET.label, kind: 'tag', role: 'end' }).catch(() => {}); relAdd(other, 1); return tagEnd(); }
    if (T && T.event) T.event.emit('pet-play', { to: other, from: PET.label, kind: 'tag', role: 'chase', round: round + 1 }).catch(() => {});
    tagRun(other, round + 1);
  }
  function tagEnd() { say(pick(['Уф! Весело!', 'Ещё разок? Потом', 'Фух, набегал{ся|ась}']), 2000); lift = 0; DOG ? acts.pant() : acts.sit(5000); }
  // ---------- утешение ----------
  // Друг или родня болеет, голоден или одинок (по act в pet-pos) — подойти, посидеть рядом и позвать хозяина.
  let lastComfort = -1e9;
  const needy = f => ['sick', 'hungry', 'lonely', 'beg'].includes(f.act || '');
  function comfortTarget() {
    if (GUEST || away) return null; const s = S();
    for (const f of friends.values()) if (now() - f.t < 3000 && f.label !== 'guest' && needy(f) && (isFriend(f.label) || parentsOf.includes(f.label) || f.baby) && Math.hypot(f.x - x, f.y - y) / s < 900) return f;
    return null;
  }
  function comfort(f) {
    lastComfort = now(); focus(12000);
    const s = S(), side = f.x > x ? -1 : 1, [tx, ty] = clampPos(f.x + side * 62 * s, f.y), what = f.act === 'sick' ? 'болеет' : f.act === 'lonely' ? 'скучает' : 'хочет есть';
    const o = { name: 'comfortGo', dur: 12000, after: () => {
      faceT = -side; say(pick(['Ты как?', 'Держись, я рядом', 'Я с тобой']), 1800); hearts(1);
      start('comfort', { pose: 'sit', dur: 6000, watch: false, mod: (T_, q) => { T_.headTilt = -side * 8 + Math.sin(q * 2) * 3; T_.ear = .3; },
        tick: () => { if (!A.called && now() - A.t0 > 2200) { A.called = 1; const t = `Хозяин! ${f.name || 'Друг'} ${what}!`; say(t, 3000); speak(t); mark('!'); } },
        after: () => acts.sit(3000) });
    } };
    if (FLY) soarTo(tx, ty, o.after, o); else moveTo(tx, ty, 150 * SPD, o);
  }
  // ---------- эстафета с клубком ----------
  // Трое и больше на одном мониторе: зачинщик показывает клубок и расставляет всех по станциям вдоль пола
  // (pet-play relay/line), первый несёт клубок ко второму (prop-carry), передаёт (relay/take), последний
  // относит в гнездо, если оно есть, иначе выбивает за край; все радуются (relay/done). Раз в 15 минут.
  let lastRelay = -1e9, relay = null;
  function relayMates() {
    const s = S(), m = monAt(x + CX * s, y + GY * s); if (!m) return [];
    return [...friends.values()].filter(f => now() - f.t < 3000 && f.label !== 'guest' && !['sleep', 'eat', 'hang', 'ride', 'fly', 'soar', 'hide', 'chat', 'tagRun', 'tagChase'].includes(f.act || '') && monAt(f.x + CX * s, f.y + GY * s) === m);
  }
  function relayStation(i, n, m) { const s = S(); return [m.x + m.w * (i + 1) / (n + 1) - CX * s, floorY(m)]; }
  function relayStart() {
    const mates = relayMates(); if (mates.length < 2 || !invoke || GUEST || away) return acts.sit();
    lastRelay = now();
    const s = S(), m = monAt(x + CX * s, y + GY * s), parts = [{ label: PET.label, x }, ...mates.map(f => ({ label: f.label, x: f.x }))].sort((a, b) => a.x - b.x);
    const order = parts.map(p => p.label), n = order.length, mm = { x: m.x, y: m.y, w: m.w, h: m.h };
    say(pick(['Эстафета! Становись!', 'Клубок по цепочке! Все по местам', 'Кто в эстафету?']), 2200); mark('!');
    const [sx] = relayStation(0, n, m);
    invoke('prop_show', { kind: 'yarn', x: Math.round(sx + CX * s - 40 * s), y: Math.round(m.y + m.h - 30 * s) }).catch(e => console.error('эстафета', e));
    if (T && T.event) order.forEach((l, i) => T.event.emit('pet-play', { to: l, from: PET.label, kind: 'relay', role: 'line', order, idx: i, n, m: mm }).catch(() => {}));
  }
  function relayLine(mn) {                        // занять свою станцию; первый ждёт клубок и берёт его
    focus(45000); relay = mn; lastRelay = now();   // focus() выводит из эстафеты — поэтому сначала он, потом своё место в цепочке
    const [tx, ty] = relayStation(mn.idx, mn.n, mn.m);
    const o = { name: 'relayGo', dur: 12000, after: () => { faceT = mn.idx < mn.n - 1 ? 1 : -1; if (mn.idx === 0) relayPick(0, 20); else start('relayWait', { pose: 'sit', dur: 40000, watch: false, mod: (T_, q) => { T_.ear = -.3; T_.headTilt = Math.sin(q * 2) * 6; }, after: () => { relay = null; acts.sit(); } }); } };
    if (FLY) soarTo(tx, ty, o.after, o); else moveTo(tx, ty, 220 * SPD, o);
  }
  function relayPick(idx, tries) {                // подойти к клубку и понести дальше
    if (!relay) return acts.sit();
    if (!ballAlive() || ball.kind !== 'yarn') { if (tries > 0) return start('relayWait', { pose: 'sit', dur: 400, watch: false, after: () => relayPick(idx, tries - 1) }); relay = null; say('А где клубок?', 1600); return acts.sit(); }
    const s = S(), [tx, ty] = nearPoint(ball.x, ball.y, 24);
    moveTo(tx, ty, 200 * SPD, { name: 'relayGo', dur: 8000, after: () => { say(pick(['Взял{|а}!', 'Мой ход!', 'Несу!']), 1000); relayCarry(idx); } });
  }
  function relayCarry(idx) {
    const mn = relay; if (!mn) return acts.sit();
    const s = S(), last = idx >= mn.n - 1, m = mn.m;
    let tx, ty;
    if (!last) { const [nx, ny] = relayStation(idx + 1, mn.n, m); tx = nx - 46 * s; ty = ny; }
    else if (nestAlive()) { tx = nest.x - CX * s + (nest.x > x ? -50 : 50) * s; ty = floorY(monAt(nest.x, nest.y) || m); }
    else { tx = m.x + m.w - 150 * s - CX * s; ty = floorY(m); }
    const o = { name: 'relayCarry', dur: 16000, mod: (T_) => { T_.mouth = .3; T_.headY = 4; T_.tail = 30; },
      tick: () => { if (T && T.event) { const h = headCanvas(); T.event.emit('prop-carry', { by: PET.label, x: x + (h.x + face * 24) * s, y: y + (h.y + 30) * s }).catch(() => {}); } },
      after: () => {
        if (!last) {
          if (T && T.event) { T.event.emit('prop-kick', { kind: 'yarn', x: x + CX * s + face * 40 * s, y: y + GY * s - 14 * s, vx: 0, vy: 0 }).catch(() => {}); T.event.emit('pet-play', { to: mn.order[idx + 1], from: PET.label, kind: 'relay', role: 'take', idx: idx + 1 }).catch(() => {}); }
          say(pick(['Держи!', 'Тебе!', 'Дальше!']), 1200); relAdd(mn.order[idx + 1], 1); relay = null;
          return start('relayCheer', { pose: 'sit', dur: 3000, watch: false, mod: (T_, q) => { T_.happy = 1; T_.headTilt = Math.sin(q * 3) * 8; }, after: () => acts.sit(3000) });
        }
        if (nestAlive()) { if (T && T.event) T.event.emit('prop-kick', { kind: 'nest', add: 1 }).catch(() => {}); say(pick(['В гнездо! Финиш!', 'Донёс! В гнездо', 'Финиш!']), 2000); }
        else { if (T && T.event) T.event.emit('prop-kick', { kind: 'yarn', vx: face * 640 * s, vy: -300 * s }).catch(() => {}); say(pick(['Финиш! Хоп!', 'Добежал{|а}!', 'Всё, финиш!']), 2000); }
        if (T && T.event) mn.order.forEach(l => T.event.emit('pet-play', { to: l, from: PET.label, kind: 'relay', role: 'done', by: NAME }).catch(() => {}));
        relay = null;
      } };
    if (FLY) soarTo(tx, ty, o.after, o); else moveTo(tx, ty, 230 * SPD, o);
  }
  function relayDone(by) {
    if (by !== NAME) hearts(2);
    if (PET.label === leaderLabel()) achCount('relay');
    start('relayCheer', { pose: 'sit', dur: 2600, rate: 12, mod: (T_, q) => { T_.bob -= Math.abs(Math.sin(q * 8)) * 14; T_.happy = 1; T_.armL = T_.armR = 1; }, after: () => acts.sit(3000) });
    say(pick(['Ура! Команда!', 'Мы это сделали!', 'Ещё разок потом!']), 2000);
  }
  function playReceive(m) {
    if (!m || m.to !== PET.label || dragging) return;
    if (now() < focusUntil && !(m.kind === 'tag' && m.role === 'end') && m.kind !== 'race' && m.kind !== 'note' && m.kind !== 'selfie' && m.kind !== 'trick' && m.kind !== 'peace' && !(m.kind === 'relay' && m.role !== 'line')) return;   // заняты делом поважнее
    if (m.kind === 'steal') {                    // у кота стащили еду
      if (!CAT) return;
      bowlOn = false; lastReact = now(); relAdd(m.from, -1);
      const f = friends.get(m.from);
      say(pick(['Эй! Моё!', 'Отдай!', 'Ффф! Ворюга!']), 1400); play('hiss', false);
      return start('arch', { pose: 'arch', dur: 900, rate: 12, after: () => { if (f) tagChase(f.label, 4); else acts.sit(); } });
    }
    if (m.kind === 'ball') {
      if (A && ['hang', 'fly', 'sleep', 'eat', 'ride', 'chat', 'tagChase', 'stuff', 'wheel', 'ballGo', 'kick', 'ballWatch'].includes(A.name)) return;
      lastBall = now(); ballRounds = 6; say(pick(['Давай!', 'Мяч! Мяч!', 'Я в игре!']), 1200);
      const f = friends.get(m.from); return setTimeout(() => { if (ballAlive()) ballWait(f); }, 800);
    }
    if (m.kind === 'race') { if (m.role === 'go') { if (busy() && !(A && A.name === 'chat')) return; chat = null; say(pick(['Давай!', 'Ну держись!', 'До края? Легко']), 1400); raceRun({ t0: m.t0, x0: m.x0, x1: m.x1, y0: m.y0, other: m.from }); } else if (m.role === 'win' && race && m.t0 === race.t0) race.lost = true; return; }
    if (m.kind === 'trick') {                   // гость показал трюк: смотрим, на третий раз — выучили
      const tr = TRICKS[m.name]; if (!tr || busy() || GUEST) return; const f = friends.get(m.from); if (f) faceT = f.x > x ? 1 : -1;
      if (m.parent && !(isBaby() && parentsOf.includes(m.from))) return;   // показ родителя — только своему малышу
      if (trickLearned(m.name)) { say(pick(['Я так тоже умею!', 'Подумаешь', 'Легко']), 1400); if (Math.random() < .5) setTimeout(() => trick(m.name, false), 1600); return; }
      const n = (ach.n['learn_' + m.name] || 0) + 1; ach.n['learn_' + m.name] = n; achSave();
      start('watch', { pose: 'sit', dur: 2600, watch: false, mod: (T_, q) => { T_.headTilt = Math.sin(q * 2) * 12; T_.pup = 1; } });
      if (n >= 3) { ach.n['trick_' + m.name] = 5; achSave(); setTimeout(() => { say(`Научил{ся|ась} у ${m.guestName || 'гостя'}: «${tr.title}»!`, 3000); hearts(3); achCount('learn'); }, 2800); }
      else say(m.parent ? pick(['Ещё покажи!', 'Я тоже так хочу', 'Смотрю-смотрю']) : pick(['Ого, как это?', 'Покажи ещё', 'Запоминаю…']), 1600);
      return;
    }
    if (m.kind === 'duet') {                    // друг зовёт повторить трюк вместе
      if (!trickLearned(m.name) || busy() || GUEST) return; const f = friends.get(m.from); if (f) faceT = f.x > x ? 1 : -1;
      focus(6500); say(pick(['И я!', 'Вместе!', 'Смотри, синхронно']), 1200);
      setTimeout(() => { trick(m.name, false); setTimeout(() => { hearts(2); achCount('duet'); }, 3000); }, 2300);
      return;
    }
    if (m.kind === 'note') { say(pick(['Передай привет!', 'Ой, спасибо!', 'Скажи, что мы тут скучаем', 'Записка! Как мило']), 2400); hearts(2); return; }
    if (m.kind === 'selfie') { start('pose', { pose: 'sit', dur: 2600, mod: (T_) => { T_.happy = 1; T_.tail = 25; T_.headTilt = 6; T_.ear = -.2; T_.yaw = 0; } }); fx('zzz', '📸', 0, -40, 1500); if (!GUEST) { portalEvent('selfie', { guest: m.guestName || 'гость', owner: m.owner || '' }); setTimeout(() => { if (T && T.event) T.event.emit('photo-req', { to: m.from, from: PET.label }).catch(() => {}); }, 1200); } return; }
    if (m.kind === 'peace') {                   // соперник пришёл мириться
      const f = friends.get(m.from); if (f) faceT = f.x > x ? 1 : -1;
      relSet(m.from, 0); say(pick(['Мир.', 'Ну ладно. Мир', 'Мир, так мир']), 2000); hearts(3);
      return start('nose', { pose: 'sit', dur: 2800, watch: false, mod: (T_, q) => { T_.headY = 4; T_.happy = 1; T_.headTilt = Math.sin(q * 3) * 4; }, after: () => acts.sit(3000) });
    }
    if (m.kind === 'relay') {
      if (m.role === 'line') { if (GUEST || dragging || (A && ['hang', 'fly', 'sleep', 'eat', 'ride', 'stuff', 'wheel', 'hide'].includes(A.name))) return; if (m.from !== PET.label) say(pick(['Я в игре!', 'Бегу на место', 'Эстафета!']), 1200); return relayLine({ order: m.order, idx: m.idx, n: m.n, m: m.m }); }
      if (now() < focusUntil && !(A && /^relay/.test(A.name))) return;   // заняты делом поважнее (миска, команда) — эстафета подождёт
      if (m.role === 'take') { if (!relay || relay.idx !== m.idx) return; A = null; return relayPick(m.idx, 12); }
      if (m.role === 'done') return relayDone(m.by);
      return;
    }
    if (m.kind !== 'tag') return;
    if (m.role === 'end') { if (A && (A.name === 'tagRun' || A.name === 'tagChase')) { tagEnd(); relAdd(m.from, 1); maybeInfect(friends.get(m.from)); } return; }
    if (m.role === 'chase') {
      if (A && ['hang', 'fly', 'sleep', 'eat', 'ride', 'chat', 'tagChase', 'stuff', 'wheel'].includes(A.name)) return;
      lastPlay = now(); if (m.round === 1) say(pick(['Ловлю!', 'Ага, сейчас!', 'Бегу!']), 1200);
      tagChase(m.from, m.round);
    }
  }
  const fits = (d, a, b) => d.for.some(f => f === 'any' || f === a + '-' + b || f === a + '-any' && true || f === 'any-' + b);
  function chatLine(d, i, A_, B_) { const own = GUEST ? (PET.owner || 'хозяин') : (((chat && friends.get(chat.other)) || {}).owner || 'хозяин'); return d.lines[i].replace(/\{A\}/g, A_).replace(/\{B\}/g, B_).replace(/\{O\}/g, own); }
  function chatStart(f) {                        // зачинщик
    const list = DIALOGS.filter(d => fits(d, SP, f.sp) && !!d.guest === (GUEST || f.label === 'guest'));
    const di = DIALOGS.indexOf(pick(list));
    if (di < 0) return acts.sit();
    lastChat = now();
    chat = { id: di, other: f.label, me: 'A', names: [NAME, f.name || f.sp], idx: 0 }; relAdd(f.label, 1);
    faceT = f.x > x ? 1 : -1;
    start('chat', { pose: 'sit', dur: 9000, mod: (T) => { T.tail = 20; } });
    setTimeout(() => chatSpeak(), 300);
  }
  function chatSpeak() {
    if (!chat) return;
    const d = DIALOGS[chat.id], i = chat.idx;
    if (i >= d.lines.length) { chat = null; return; }
    const line = chatLine(d, i, chat.names[0], chat.names[1]);
    say(line, 2600);
    if (A && A.name === 'chat') { A.dur = now() - A.t0 + 4500; A.talk = now(); }
    if (T && T.event && i + 1 < d.lines.length) T.event.emit('pet-chat', { to: chat.other, from: PET.label, id: chat.id, idx: i + 1, names: chat.names }).catch(() => {});
    if (i + 1 >= d.lines.length) setTimeout(() => { chat = null; }, 2500);
  }
  function chatReceive(m) {                      // собеседник получил свою очередь
    if (!m || m.to !== PET.label || dragging || now() < focusUntil) return;
    if (!chat && (!A || ['sit', 'look', 'loaf', 'walk', 'pant', 'sniff', 'chat', 'sitUp'].includes(A.name))) {
      const f = friends.get(m.from);
      chat = { id: m.id, other: m.from, me: 'B', names: m.names, idx: m.idx }; relAdd(m.from, 1); maybeInfect(friends.get(m.from));
      if (f) faceT = f.x > x ? 1 : -1;
      start('chat', { pose: 'sit', dur: 9000, mod: (T) => { T.tail = 20; } });
    } else if (chat && chat.other === m.from) chat.idx = m.idx; else return;
    setTimeout(() => chatSpeak(), 1400);
  }
  function cheer(text) {
    lastCheer = now();
    start('cheer', { pose: 'sit', dur: 4500, watch: true, mod: (T, q) => { T.happy = q < 3.5 ? 1 : 0; T.headTilt += Math.sin(q * 2) * 6; T.tail = 28; if (BIRD) T.crest = 1; } });
    const ct = text || (Math.random() < .3 ? pick(CHEER_SP[SP]) : pick(CHEER));
    say(ct, 4200); speak(ct);
    if (Math.random() < .5) hearts(2);
  }
  // приветствие по времени суток — один раз после запуска
  function greeting() {
    const d = new Date(), h = d.getHours(), fri = d.getDay() === 5, mon = d.getDay() === 1;
    if (fri && h >= 15) return 'Пятница, вечер близко. Ты дотянул(а) — красавчик!';
    if (mon && h < 12) return 'Понедельник. Мы вдвоём справимся, правда?';
    if (h < 6) return 'Так поздно… Береги себя. Я посижу рядом';
    if (h < 11) return 'Доброе утро! Сегодня будет хороший день. Я договори{лся|лась}';
    if (h < 17) return 'Привет! Как ты? Если что — я тут';
    if (h < 22) return 'Добрый вечер. Много ещё? Не забудь про отдых';
    return 'Ночь на дворе. Может, доделаем завтра?';
  }
  configure();

  // ---------- окно и экраны ----------
  const S = () => window.devicePixelRatio || 1;
  let mons = [];
  let cur = { x: 0, y: 0 }, curPrev = { x: 0, y: 0 }, curV = { x: 0, y: 0 }, curSpeed = 0, btn = false;
  // На Windows состояние кнопки мыши даёт Rust (GetAsyncKeyState), на macOS его нет —
  // берём из событий указателя самого окна (курсор при перетаскивании остаётся над ним).
  const MAC = /Mac/i.test(navigator.platform || navigator.userAgent);
  let btnJS = false;
  function monAt(px, py) { return mons.find(m => px >= m.x && px < m.x + m.w && py >= m.y && py < m.y + m.h) || mons[0]; }
  function clampPos(px, py, m) {
    const s = S(); m = m || monAt(px + W * s / 2, py + GY * s);
    if (!m) return [px, py];
    return [clamp(px, m.x - 45 * s, m.x + m.w - (W - 45) * s), clamp(py, m.y - 40 * s, m.y + m.h - GY * s - 2 * s)];
  }
  const floorY = m => m.y + m.h - GY * S() - 2 * S();
  const myCenter = () => ({ x: x + CX * S(), y: y + (GY - 50) * S() });
  function randomTarget(maxd = 650) {
    const s = S(), c = myCenter(), m = monAt(c.x, c.y);
    if (!m) return [x, y];
    const ty = Math.random() < .7 ? floorY(m) : y + rnd(-200, 200) * s;
    return clampPos(x + rnd(-maxd, maxd) * s, ty, m);
  }
  function nearPoint(px, py, gap = 80) {           // окно, в котором зверь стоит рядом с точкой
    const s = S(), side = myCenter().x < px ? -1 : 1;
    return clampPos(px - CX * s + side * gap * s, py - (GY - 20) * s, monAt(px, py));
  }
  const hanging = () => A && A.name === 'hang';

  // ---------- действия ----------
  function start(name, o = {}) {
    if (A && A.exit) { const e = A.exit; A.exit = null; e(); }
    A = Object.assign({ name, t0: now(), dur: 3000 }, o);
    poseName = A.pose || poseName;
    if (A.enter) A.enter();
    return A;
  }
  function moveTo(tx, ty, speed, o = {}) {
    if (FLY && speed > 120 && !o.pose) return soarTo(tx, ty, o.after, o);
    return start(o.name || (speed > 150 ? 'run' : 'walk'), Object.assign({ pose: 'walk', tx, ty, speed, dur: 30000 }, o));
  }
  const flapMod = (T, q, t) => { T.wingA = 45 * Math.sin(t * 2 * Math.PI * 6.5) + 5; T.tilt = -face * 12; };
  function soarTo(tx, ty, after, o = {}) {
    const d0 = Math.hypot(tx - x, ty - y) || 1;
    return start('soar', Object.assign({ pose: 'fly', tx, ty, speed: 300, d0, dur: 30000, rate: 9, mod: flapMod, after }, o, { pose: 'fly' }));
  }
  const chew = (T, q) => { T.mouth = Math.sin(q * 14) > 0 ? .35 : 0; T.headY += Math.abs(Math.sin(q * 7)) * 2; };
  const acts = {
    walk() { const [tx, ty] = randomTarget(); moveTo(tx, ty, (DOG ? 80 : 70) * SPD); },
    run() { const [tx, ty] = randomTarget(); moveTo(tx, ty, (DOG ? 280 : 260) * SPD, { after: () => { if (isBaby() && Math.random() < .3) return stumble(); if (CHUBBY) say(pick(['Уф…', 'Пых-пых', 'Хватит бегать']), 1500); acts.sit(); } }); },
    sit(ms = rnd(4000, 9000)) { start('sit', { pose: 'sit', dur: ms, watch: true }); },
    look() { start('look', { pose: 'sit', dur: 3500, watch: true, mod: (T, s) => { T.headTilt += 14 * Math.sin(s * 1.8); T.yaw = .5 * Math.sin(s * 1.1); } }); },
    groom() { start('groom', { pose: 'sit', dur: rnd(3500, 6000), mod: (T, s) => { T.armL = 1; T.headTilt = 12 + 3 * Math.sin(s * 7); T.eye = .1; T.tongue = Math.sin(s * 7) > .3 ? .8 : 0; T.headY = 2; } }); },
    scratch() { start('scratch', { pose: 'sit', dur: 2600, rate: 12, mod: (T, s) => { T.headTilt = -22 + Math.sin(s * 30) * 3; T.pawR = .6 + Math.sin(s * 30) * .3; T.eye = .25; T.ear = .5; } }); },
    knead() { start('knead', { pose: 'sit', dur: 5000, mod: (T, s) => { T.pawL = Math.max(0, Math.sin(s * 6)) * .7; T.pawR = Math.max(0, Math.sin(s * 6 + Math.PI)) * .7; T.happy = .8; }, enter: () => { say('Мну-мну…', 1600); play('purr', false); } }); },
    loaf() { start('loaf', { pose: 'loaf', dur: rnd(6000, 12000), watch: true, after: () => (Math.random() < .5 ? acts.sleep() : acts.stretch()) }); },
    sleep(ms = rnd(25000, 60000), here) {
      // друг уже спит неподалёку — лечь к нему в обнимку (и в лежанке, и на полу)
      const sf = !here && !GUEST ? [...friends.values()].find(f => now() - f.t < 3000 && f.act === 'sleep' && f.label !== 'guest' && isFriend(f.label) && Math.hypot(f.x - x, f.y - y) / S() < 900 && Math.hypot(f.x - x, f.y - y) > 40 * S()) : null;
      if (sf) {
        const s = S(), side = sf.x > x ? -1 : 1, [tx, ty] = clampPos(sf.x + side * 36 * s, sf.y);
        const o = { name: 'cuddleGo', after: () => { faceT = -side; say(pick(['Подвинься…', 'Я к тебе', 'Тепло']), 1400); hearts(1); start('sleep', { pose: 'sleep', dur: ms, rate: 3, zzz: 0, cuddle: sf.label, mod: (T_) => { T_.tilt = -side * 4; } }); } };
        if (FLY) return soarTo(tx, ty, o.after, o); return moveTo(tx, ty, 70 * SPD, o);
      }
      const bt = !here && !BIRD && bedTarget();
      if (bt && Math.hypot(bt[0] - x, bt[1] - y) / S() < 900 && Math.hypot(bt[0] - x, bt[1] - y) > 6 * S()) {
        return moveTo(bt[0], bt[1], 70 * SPD, { after: () => start('sleep', { pose: 'sleep', dur: ms, rate: 3, zzz: 0 }) });
      }
      start('sleep', { pose: 'sleep', dur: ms, rate: 3, zzz: 0 });
    },
    stretch() { start('stretch', { pose: 'stretch', dur: 2400, rate: 4, mod: (T, s) => { T.armL = T.armR = Math.sin(Math.min(1, s / 2.4) * Math.PI) * .5; } }); },
    voice(user) {
      start('voice', { pose: 'sit', dur: 1100, mod: (T, s) => { if (s < .7) { T.mouth = BIRD ? (Math.sin(s * 30) > 0 ? .8 : .1) : 1; T.headTilt -= 8; T.headY -= 2; T.eye = .7; if (DRAGON) { T.fire = .3; T.puff = 1.1; } } } });
      say(pick(TX().voice)); play(TX().snd, !!user, pick([1, 2, 2, 3]));
    },
    phrase() {
      start('sit', { pose: 'sit', dur: 4000, watch: true, mod: BIRD ? (T, s) => { if (s < 1.5) T.mouth = Math.sin(s * 28) > 0 ? .7 : .1; } : null });
      if (BIRD) play('talk', false);
      if (CHUBBY && Math.random() < .5) return say(pick(['Я не толст{ый|ая}, я пушист{ый|ая}', 'Диета? Не слышал', 'Когда обед?', 'Я на бегу. Медленном.', 'Это всё шерсть!']), 3400);
      const ph = isBaby() && Math.random() < .6 ? pick(BABY_TXT) : pick(TX().phrases); say(ph, 3400); speak(ph);
    },
    sniff() {
      const s = S(), [tx, ty] = clampPos(x + face * rnd(20, 60) * s, y);
      moveTo(tx, ty, 22, { name: 'sniff', pose: 'sniff', rate: 5, mod: (T, q) => { T.headY += Math.sin(q * 9) * 1.2; T.headTilt += Math.sin(q * 5) * 5; }, after: () => { if (Math.random() < .4) mark('?'); acts.sit(3000); } });
    },
    hunt() {
      const s = S(), [tx, ty] = clampPos(x + face * rnd(110, 220) * s, y);
      mark('!');
      start('crouch', { pose: 'crouch', dur: 1500, rate: 6, mod: (T, q) => { if (q > .6) T.tilt += Math.sin(q * 26) * 2.5; },
        after: () => leap(tx, ty, () => { say(pick(['Пойма{л|ла}!', 'Хм, пусто…', 'Ап!']), 1200); acts.sit(3000); }) });
    },
    // щенок
    bow() { start('bow', { pose: 'bow', dur: 2200, rate: 8, enter: () => { say('Поиграем?!', 1500); play('bark', false, 2); }, after: () => acts.zoomies() }); },
    zoomies(n = 3) {
      const s = S(), c = myCenter(), m = monAt(c.x, c.y);
      if (!m || n <= 0) return acts.sit(3000);
      const side = n % 2 ? 1 : -1, tx = clampPos(x + side * rnd(250, 450) * s, floorY(m))[0];
      moveTo(tx, floorY(m), 360, { name: 'run', after: () => acts.zoomies(n - 1) });
    },
    spin() { start('spin', { pose: 'sit', dur: 2600, enter: () => say('Хвост!', 1200), mod: (T, q) => { T.yaw = Math.sin(q * 9) * .8; T.tilt = Math.cos(q * 9) * 6; T.tail = 40; T.headTilt = 15; }, tick: (dt) => { gw = 1; gait = 'run'; phase += dt * 3; } }); },
    dig() { start('dig', { pose: 'dig', dur: 3000, rate: 10, mod: (T, q) => { T.pawL = Math.max(0, Math.sin(q * 22)) * .9; T.pawR = Math.max(0, Math.sin(q * 22 + Math.PI)) * .9; T.headTilt = Math.sin(q * 22) * 4; },
      after: () => { say(pick(['Тут что-то есть!', 'Копаю!', 'Наш{ёл|ла} косточку?']), 1500); acts.sit(3000); } }); },
    lie() { start('lie', { pose: 'loaf', dur: rnd(6000, 12000), watch: true, mod: (T) => { T.eye = 1; }, after: () => (Math.random() < .5 ? acts.sleep() : acts.stretch()) }); },
    pant() { start('sit', { pose: 'sit', dur: rnd(4000, 7000), watch: true, mod: (T, q) => { T.tongue = 1; T.mouth = .3; T.bob += Math.sin(q * 20) * .6; T.tail = 30; } }); play('pant', false); },
    // хомяк и кролик
    sitUp() { start('sitUp', { pose: 'up', dur: rnd(2500, 4500), watch: true, mod: (T, q) => { T.headTilt += Math.sin(q * 1.6) * 10; } }); },
    wash() { start('wash', { pose: HAM ? 'up' : 'sit', dur: rnd(3000, 4500), rate: 10, mod: (T, q) => { const k = Math.sin(q * 11); T.armL = .9 + k * .1; T.armR = .9 - k * .1; T.headTilt = k * 6; T.eye = .1; T.headY = 3; } }); },
    stuff() { start('stuff', { pose: 'up', dur: 3500, enter: () => { say(pick(['Запасы!', 'Хрум!', 'Это на зиму']), 1500); play('crunch', false); bowlOn = true; },
      mod: (T, q) => { T.armL = T.armR = .95; chew(T, q); T.cheek = Math.min(1, q / 2.5); }, exit: () => { cheekUntil = now() + 25000; bowlOn = false; } }); },
    wheel() { start('wheel', { pose: 'walk', dur: rnd(5000, 9000), enter: () => { wheelOn = true; say(pick(['Бегу!', 'Колесо!', 'Ещё кружок!']), 1400); },
      tick: (dt) => { gait = 'run'; gw = 1; phase += dt * 3.2; wheelRot += dt * 7; faceT = 1; }, exit: () => { wheelOn = false; } }); },
    flop() { start('flop', { pose: 'loaf', dur: rnd(6000, 12000), rate: 4, enter: () => say(pick(['Плюх!', '*флоп*', 'Хорошо-о…']), 1400), mod: (T) => { T.happy = .6; T.ear = .8; T.tilt = 6; }, after: () => (Math.random() < .5 ? acts.sleep() : acts.stretch()) }); },
    binky() {
      const sx = x, s = S(), dir = face, tx = clampPos(x + dir * rnd(30, 70) * s, y)[0];
      say(pick(['Бинки!', 'Уиии!', 'Прыг!']), 1000);
      start('binky', { pose: 'leap', dur: 700, rate: 12, tick: (dt, q) => { const k = clamp(q / .7, 0, 1); x = lerp(sx, tx, k); lift = 4 * 40 * k * (1 - k); tilt = Math.sin(k * Math.PI * 2) * 30 * dir; },
        exit: () => { lift = 0; tilt = 0; }, after: () => (Math.random() < .5 ? acts.binky() : land(() => acts.sit(3000))) });
    },
    thump() { mark('!'); play('thump', true);
      start('thump', { pose: 'sit', dur: 1500, rate: 14, mod: (T, q) => { T.ear = -1; T.pup = 1; T.pawR = Math.max(0, Math.sin(q * 20)) * .8; },
        tick: (dt, q) => { if (Math.floor(q * 3.2) !== A.nt) { A.nt = Math.floor(q * 3.2); if (A.nt) play('thump', true); } } }); },
    nibble() { start('eat', { pose: 'eat', dur: rnd(2500, 4000), enter: () => { bowlOn = true; }, mod: chew, exit: () => { bowlOn = false; } }); },
    // домовёнок
    tale() { start('tale', { pose: 'loaf', dur: rnd(6000, 9000), watch: true, enter: () => say(pick(['Жили-были…', 'Сказку хочешь? Слушай', 'В некотором царстве…', 'А в сундучке у меня — сказки!']), 2600),
      mod: (T, q) => { T.chest = q < 1 ? 1 : 2; T.armL = .4; T.headTilt = Math.sin(q * 1.4) * 6; T.happy = q > 1.5 ? .4 : 0; },
      tick: (dt, q) => { if (Math.floor(q) !== A.nq) { A.nq = Math.floor(q); if (A.nq > 1) fx('zzz', pick(['✦', '★', '✧']), rnd(20, 44) * face, rnd(-6, 10), 1400); } },
      after: () => { say(pick(['…и стали они жить-поживать', 'Тут и сказке конец', 'А дальше — завтра']), 2200); acts.sit(2500); } }); },
    sweep() { const s = S(), [tx, ty] = clampPos(x + face * rnd(90, 220) * s, y);
      moveTo(tx, ty, 40, { name: 'sweep', pose: 'walk', rate: 8, enter: () => say(pick(['Порядок навожу!', 'Ну и пыль тут', 'Метём-метём']), 1600), mod: (T, q) => { T.broom = 1; T.armR = .3; T.headTilt = Math.sin(q * 9) * 4; },
        tick: (dt, q) => { if (Math.floor(q * 3) !== A.nq) { A.nq = Math.floor(q * 3); fx('zzz', pick(['·', '∘', '·']), rnd(30, 50) * face, rnd(60, 80), 900); } }, after: () => { say(pick(['Чисто!', 'Вот так-то', 'Теперь дом']), 1400); acts.sit(2500); } }); },
    pie() { start('eat', { pose: 'eat', dur: rnd(3500, 5000), enter: () => { say(pick(['Пирожки!', 'С капустой!', 'Ням, с картошечкой']), 1600); play('crunch', false); }, mod: (T, q) => { chew(T, q); T.armL = T.armR = .9; T.happy = q > 2 ? .6 : 0; },
      after: () => { say(pick(['Уф, наелся', 'Ещё бы штучку…', 'Теперь поспать']), 1500); Math.random() < .5 ? acts.sleep() : acts.sit(3000); } }); },
    nafanya() { mark('!'); start('shout', { pose: 'up', dur: 2400, rate: 8, enter: () => { say('НАФАНЯ-А-А!', 1800); play('giggle', false, 1); }, mod: (T, q) => { T.mouth = q < 1.4 ? 1 : 0; T.armL = T.armR = q < 1.4 ? 1 : .2; T.headTilt = -6; T.eye = .8; },
      after: () => { say(pick(['Не слышит…', 'Опять в печке сидит', 'Ну и ладно']), 1600); acts.sit(3000); } }); },
    grumble() { start('grumble', { pose: 'sit', dur: 3000, rate: 8, enter: () => say(pick(['Ой, беда-беда, огорчение!', 'Ай-яй-яй!', 'Ну что за напасть']), 2400), mod: (T, q) => { T.headTilt = Math.sin(q * 7) * 10; T.armL = T.armR = .6; T.eye = .6; T.ear = .5; } }); },
    squat() { start('squat', { pose: 'stand', dur: rnd(3500, 5500), rate: 12, enter: () => say(pick(['Эх, вприсядку!', 'Ух-ты, ах-ты!', 'Пляшем!']), 1600), mod: (T, q) => { const k = Math.max(0, Math.sin(q * 8)); T.squash = 1 - k * .18; T.bob += k * 10; T.armL = k; T.armR = 1 - k; T.pawL = Math.max(0, Math.sin(q * 8)); T.pawR = Math.max(0, -Math.sin(q * 8)); T.happy = .5; },
      tick: (dt, q) => { if (Math.floor(q * 2) !== A.nq) { A.nq = Math.floor(q * 2); fx('zzz', '♪', rnd(-20, 14), -12, 1400); } } }); },
    valenok() { start('valenok', { pose: 'crouch', dur: rnd(5000, 8000), enter: () => say(pick(['Тсс… я в валенке', 'Меня тут нет', 'Спрятался']), 1800), mod: (T) => { T.eye = .5; T.headY = 6; T.armL = T.armR = .3; }, after: () => { say('Ку-ку!', 900); acts.sit(2000); } }); },
    // круглыши
    roll() { const s = S(), [tx, ty] = clampPos(x + face * rnd(150, 400) * s, y); const sx0 = x;
      moveTo(tx, ty, 220 * SPD, { name: 'roll', pose: 'stand', rate: 10, enter: () => { if (Math.random() < .5) say(pick(['Качусь!', 'Уиии!', 'Покатились!']), 1200); }, mod: (T, q) => { T.tilt = ((x - sx0) / S()) * 2 % 360; T.happy = .5; T.pawL = T.pawR = 1; T.armL = T.armR = .9; }, after: () => acts.sit(2500) }); },
    jump() { start('jump', { pose: 'stand', dur: rnd(2000, 3500), rate: 14, enter: () => { if (Math.random() < .4) say(pick(['Прыг!', 'Скок!', 'Выше!']), 1000); play('boing', false, 2); }, mod: (T, q) => { const k = Math.abs(Math.sin(q * 5)); T.bob -= k * 26; T.squash = 1 + (k - .5) * .18; T.armL = T.armR = k; T.happy = .4; } }); },
    wobble() { start('wobble', { pose: 'sit', dur: rnd(2500, 4000), rate: 8, watch: true, mod: (T, q) => { T.tilt = Math.sin(q * 4) * 12; T.headTilt = Math.sin(q * 4) * 4; } }); },
    // скрепка
    tip() { start('tip', { pose: 'sit', dur: 4500, watch: true, enter: () => say(pick(TX().phrases), 3800), mod: (T, q) => { T.paper = 1; T.ear = -.6; T.headTilt = Math.sin(q * 2) * 5; T.bob += Math.sin(q * 3) * 1.5; } }); },
    morph(shape) { const sh = shape || pick(['heart', 'question', 'spiral']);
      start('morph', { pose: 'sit', dur: rnd(4000, 6000), rate: 10, enter: () => { say(sh === 'heart' ? pick(['Вот так ♥', 'Люблю вас!']) : sh === 'question' ? pick(['Вопросик?', 'А?']) : pick(['Ой, закрутился', 'Пружинка!']), 1800); play('boing', false, 1); },
        mod: (T, q) => { T.shape = q > .3 ? sh : ''; T.squash = q < .3 ? 1 - q : 1 + Math.sin(q * 6) * .03; T.happy = sh === 'heart' ? .8 : 0; T.ear = sh === 'question' ? -.8 : 0; }, after: () => acts.sit(2500) }); },
    knock() { start('knock', { pose: 'sit', dur: 2200, rate: 12, enter: () => { say('Тук-тук! Вы там?', 1800); play('knock', false, 2); }, mod: (T, q) => { T.tilt = q < 1 ? Math.sin(q * 25) * 6 : 0; T.headTilt = Math.sin(q * 25) * 4; T.ear = -.5; } }); },
    bounce() { start('bounce', { pose: 'stand', dur: rnd(2000, 3500), rate: 14, mod: (T, q) => { const k = Math.abs(Math.sin(q * 6)); T.bob -= k * 22; T.squash = 1 + (k - .5) * .16; T.happy = .3; }, enter: () => { if (Math.random() < .4) play('boing', false, 2); } }); },
    brows() { start('brows', { pose: 'sit', dur: 2600, rate: 10, watch: true, mod: (T, q) => { T.ear = Math.sin(q * 5) > 0 ? -1 : .6; T.headTilt = Math.sin(q * 2.5) * 6; } }); },
    spinClip() { start('spin', { pose: 'sit', dur: 1800, rate: 14, mod: (T, q) => { T.yaw = Math.sin(q * 10); T.squash = 1 + Math.sin(q * 10) * .05; }, enter: () => say(pick(['Вжух!', 'Крутимся!']), 1000) }); },
    // дракончик
    fire(user) {
      if (A && A.name === 'fire') return;
      start('fire', { pose: 'sit', dur: 3200, rate: 14, enter: () => { say(pick(['Ффух!', 'Огонь!', 'Ррр-фшш!', 'Горячо!']), 1500); setTimeout(() => play('fire', !!user), 700); },
        mod: (T, q) => { if (q < .7) { T.puff = 1 + q * .25; T.headTilt = -10; T.headY = -3; T.glow = q / .7; T.eye = .6; } else if (q < 2.4) { T.mouth = 1; T.fire = Math.min(1, (q - .7) / .25) * (q > 2 ? (2.4 - q) / .4 : 1); T.glow = 1 - (q - .7) / 1.7; T.pup = 1; T.squash = 1.03; } else { T.mouth = .2; T.eye = .5; T.smoke = 1; } },
        after: () => { if (Math.random() < .3) say(pick(['Вот так!', 'Никто не пострадал', 'Чуть-чуть перегрел{ся|ась}']), 1500); acts.sit(3000); } });
    },
    hoard() {
      start('dig', { pose: 'dig', dur: 2600, rate: 10, enter: () => say(pick(['Где-то тут…', 'Копаю клад', 'Сокровища!']), 1400),
        mod: (T, q) => { T.pawL = Math.max(0, Math.sin(q * 22)) * .9; T.pawR = Math.max(0, Math.sin(q * 22 + Math.PI)) * .9; T.headTilt = Math.sin(q * 22) * 4; },
        after: () => { for (let i = 0; i < 5; i++) setTimeout(() => fx('heart', pick(['🪙', '💎', '🪙']), rnd(-30, 20), rnd(0, 20), 1600), i * 180); mark('!');
          start('guard', { pose: 'loaf', dur: rnd(6000, 10000), watch: true, enter: () => say(pick(['Моё!', 'Это моя куча', 'Не трогать. Ррр', 'Сокровище найдено']), 2200), mod: (T) => { T.pup = .9; T.tail = 20; T.happy = .3; } }); } });
    },
    sneeze() {
      start('sneeze', { pose: 'sit', dur: 1600, rate: 14, mod: (T, q) => { if (q < .9) { T.headTilt = -12 * q; T.eye = 1 - q * .8; T.mouth = q * .6; T.puff = 1 + q * .2; } else { T.headTilt = 18; T.eye = .1; T.mouth = 1; T.fire = q < 1.2 ? .45 : 0; T.squash = .95; } },
        tick: (dt, q) => { if (q > .9 && !A.done) { A.done = 1; play('sneeze', false); say(pick(['Апчхи!', 'Ап-ЧХИ!', 'Чхи! Ой, искры']), 1200); for (let i = 0; i < 4; i++) fx('mark', '✦', rnd(10, 40) * face, rnd(-6, 12), 700); } }, after: () => acts.sit(2500) });
    },
    warm() {
      start('warm', { pose: 'loaf', dur: rnd(7000, 12000), watch: true, enter: () => say(pick(['Греюсь…', 'Тёпленько', 'Внутри печка']), 1800),
        mod: (T, q) => { T.glow = .5 + .3 * Math.sin(q * 1.7); T.eye = .55; T.smoke = .5; T.happy = .3; }, after: () => (Math.random() < .5 ? acts.sleep() : acts.stretch()) });
    },
    flap() { start('flap', { pose: 'fly', dur: 1800, rate: 6, mod: (T, q, tt) => { T.wingA = 40 * Math.sin(tt * 2 * Math.PI * 5); T.tilt = 0; T.bob -= 6 * Math.abs(Math.sin(tt * 2 * Math.PI * 5)); }, enter: () => { if (Math.random() < .3) say(pick(['Разминаю крылья', 'Ветер!']), 1300); } }); },
    // попугай
    soar() { const s = S(), c = myCenter(), m = monAt(c.x, c.y); if (!m) return acts.sit();
      const ty = Math.random() < .5 ? floorY(m) : rnd(m.y + 80 * s, floorY(m)); const [tx, ty2] = clampPos(x + rnd(-700, 700) * s, ty, m); soarTo(tx, ty2); },
    hop() { const [tx, ty] = clampPos(x + face * rnd(30, 90) * S(), y); moveTo(tx, ty, 45, { pose: 'walk' }); },
    whistle() { start('whistle', { pose: 'sit', dur: 1900, mod: (T, q) => { T.mouth = .15 + .1 * Math.sin(q * 20); T.headTilt = -8; T.crest = 1; } }); say('♪ Фьюить ♪', 1800); play('whistle', false); },
    dance() { start('dance', { pose: 'sit', dur: rnd(4000, 6000), enter: () => say(pick([NAME + ' танцует!', '♪ Ла-ла ♪', 'Диско!']), 1800),
      mod: (T, q) => { T.bob += Math.sin(q * 13) * 2; T.headY += Math.sin(q * 13 + 1) * 3.5; T.headTilt = Math.sin(q * 6.5) * 16; T.crest = 1; T.ear = Math.sin(q * 6.5); T.yaw = Math.sin(q * 3.2) * .4; },
      tick: (dt, q) => { if (Math.floor(q * 2) !== A.nq) { A.nq = Math.floor(q * 2); fx('zzz', '♪', rnd(-20, 14), -12, 1800); } } }); },
    preen() { start('preen', { pose: 'sit', dur: rnd(2500, 4500), rate: 6, mod: (T, q) => { T.yaw = .7; T.headTilt = 38 + Math.sin(q * 12) * 4; T.headY = 8; T.mouth = Math.sin(q * 12) > .5 ? .3 : 0; } }); },
    wingStretch() { start('stretch', { pose: 'fly', dur: 1800, rate: 6, mod: (T) => { T.wingA = -50; T.tilt = 0; T.eye = .4; } }); },
    peck() { start('peck', { pose: 'sit', dur: rnd(2000, 3500), rate: 12, enter: () => { bowlOn = true; }, mod: (T, q) => { T.headY = 10 + Math.max(0, Math.sin(q * 14)) * 6; T.headTilt = 8; }, exit: () => { bowlOn = false; } }); },
    ride() { const f = [...friends.values()].find(f => (f.sp === 'cat' || f.sp === 'dog' || f.sp === 'rabbit') && f.top && now() - f.t < 2000);
      if (!f) return acts.soar();
      soarTo(...rideTarget(f), () => start('ride', { pose: 'sit', dur: rnd(8000, 16000), friend: f.label, watch: true, enter: () => say(pick(['Прокатимся!', 'Вперёд!', 'Я сверху!']), 1500), after: () => acts.soar() }), { follow: null, rideOf: f.label }); },
  };
  function leap(tx, ty, after) {
    const sx = x, sy = y, dist = Math.hypot(tx - sx, ty - sy) / S();
    const h = clamp(dist * .3, 25, 70), dur = clamp(dist / 450, .35, .7) * 1000;
    faceT = tx > sx ? 1 : -1;
    start('leap', { pose: 'leap', dur, rate: 14, tick: (dt, q) => { const k = clamp(q * 1000 / dur, 0, 1); x = lerp(sx, tx, k); y = lerp(sy, ty, k); lift = 4 * h * k * (1 - k); },
      after: () => { lift = 0; land(after); } });
  }
  function land(after) { start('land', { pose: 'crouch', dur: 380, rate: 18, after: after || (() => acts.sit(2500)) }); }
  // ---------- рабочий стол: активное окно и приложения ----------
  // desk_info раз в 1,5 с: заголовок и рамка активного окна (Windows). На macOS команда отдаёт
  // пустоту — ветки ниже молчат. Заголовок читается локально и никуда не уходит.
  let desk = null, deskPrev = null, lastPerch = -1e9, lastAppSaid = new Map();
  const APP_LINES = [
    [/Excel|\.xlsx?\b/i, 'excel', ['Excel! Формулы — моя стихия', 'Только не сводные таблицы…', 'Сумма сходится? Проверь ещё раз']],
    [/Word|\.docx?\b/i, 'word', ['Похоже, вы пишете документ. Помочь?', 'Абзацы, отступы, красота', 'Не забудь сохранить']],
    [/PowerPoint|\.pptx?\b/i, 'ppt', ['Презентация! Меньше текста, больше картинок', 'Слайд 47 из 120… держись']],
    [/Outlook|Thunderbird|Почта|Mail\b/i, 'mail', ['Письмо? Начни с «Добрый день»', 'Похоже, вы пишете письмо. Помочь?', 'Не отвечай сгоряча']],
    [/1С|1C:Предприятие|Конфигуратор/i, 'onec', ['1С… держись, я рядом', 'Проведём документ?', 'Если зависло — это не ты, это 1С']],
    [/Visual Studio Code|VS Code|IntelliJ|PyCharm|WebStorm|Sublime/i, 'code', ['Похоже, вы пишете код. Сочувствую', 'Точка с запятой на месте?', 'Коммить чаще']],
    [/Photoshop|Illustrator|Figma|InDesign/i, 'design', ['Творишь! Не мешаю', 'Слои, слои, слои…', 'Сохраняйся почаще']],
    [/YouTube/i, 'yt', ['Опять котики?', 'Пять минут — и за работу', 'Я тоже хочу посмотреть']],
    [/Telegram|WhatsApp|VK|ВКонтакте/i, 'chat', ['Кому пишем?', 'Рабочий чат или не очень?']],
    [/Terminal|PowerShell|cmd\.exe|Командная строка|bash/i, 'term', ['Чёрный экран! Хакер!', 'rm -rf не надо', 'Скрипт сработает со второго раза']],
    [/GLPI|ServiceDesk|Заявк/i, 'glpi', ['Заявки! Закроем парочку?', 'Кто-то снова забыл пароль']],
  ];
  async function deskPoll() {
    if (DEMO || !invoke) return;
    let d = null; try { d = await invoke('desk_info'); } catch (_) { return; }
    if (!d) return;
    deskPrev = desk; desk = d;
    // приложение по заголовку — раз в 10 минут на приложение, только старший питомец
    if (d.title && PET.label === leaderLabel() && !busy() && (!deskPrev || deskPrev.title !== d.title)) {
      for (const [re, key, lines] of APP_LINES) {
        if (!re.test(d.title)) continue;
        const t = now(); if (t - (lastAppSaid.get(key) || -1e9) < 10 * 60000) break;
        lastAppSaid.set(key, t); mark('!'); say(pick(lines), 2800); break;
      }
    }
  }
  // сидит на верхней кромке активного окна: подходит под окно, запрыгивает, сидит/спит, при смене окна спрыгивает
  function perchOk() {
    if (!desk || !desk.title || desk.maximized || desk.w < 320 * S() || desk.h < 160 * S()) return false;
    const m = monAt(desk.x + desk.w / 2, desk.y + 10); if (!m) return false;
    return desk.y > m.y + 40 * S() && desk.y < m.y + m.h - 200 * S();
  }
  function perch() {
    if (!perchOk()) return acts.sit();
    lastPerch = now();
    const s = S(), d = desk, px = clamp(d.x + d.w * rnd(.2, .8), d.x + 80 * s, d.x + d.w - 80 * s), sillY = d.y - GY * s - 2 * s, key = d.title;
    const m = monAt(px, d.y + 10), [bx, by] = clampPos(px - CX * s, floorY(m), m);
    const go = () => {
      if (!desk || desk.title !== key || !perchOk()) return acts.sit(2000);
      const [tx, ty] = clampPos(px - CX * s, sillY, m);
      achCount('perch');
      const sit = () => start('perch', { pose: pick(['sit', 'loaf', 'sit']), dur: rnd(25000, 70000), watch: true, key, enter: () => { if (Math.random() < .5) say(pick(['Отсюда видно всё', 'Тут теплее', 'Не мешаю?', 'Сижу, наблюдаю']), 1800); },
        tick: () => { if (!desk || desk.title !== key || Math.abs(desk.y - GY * s - 2 * s - y) > 12 * s) { A.dur = 0; } else if (Math.abs(desk.x + desk.w * .5 - (x + CX * s)) > desk.w * .6) { A.dur = 0; } },
        after: () => { const mm = monAt(x + CX * s, y + GY * s) || m; if (Math.random() < .3) say(pick(['Спрыгиваю!', 'Ой, поехали', 'Ладно, вниз']), 1000); leap(...clampPos(x + face * rnd(30, 90) * s, floorY(mm), mm), () => acts.sit(2500)); } });
      if (FLY) soarTo(tx, ty, sit); else leap(tx, ty, sit);
    };
    if (FLY) soarTo(bx, by, go); else moveTo(bx, by, 90 * SPD, { after: go });
  }
  // ---------- гости: регистрация на портале, визиты к коллегам, подарки ----------
  // Старший питомец раз в минуту шлёт /hello и раз в 10 с забирает /inbox. Любой питомец раз в
  // 20–40 минут может уйти в гости: уходит за край экрана, окно прячется, на экране коллеги его
  // внешность рисует окно «guest». Через 2–3 минуты возвращается. Гости — ко всем, кто онлайн.
  const EDITION = window.KOTIK_EDITION || {}, PORTAL = EDITION.api || '';   // пустой — общий выпуск без сети питомцев
  // Статус хозяина через питомца: табличка на груди, текст в /hello; «не беспокоить» — без гостей и дискотек
  let mood = ''; try { mood = localStorage.getItem('mood') || ''; } catch (_) { /* без памяти */ }
  const dnd = () => /не беспокоить/i.test(mood);
  const MOOD_ICO = { 'на обеде': '🍽', 'не беспокоить': '🔕', 'на встрече': '📅', 'в отпуске': '🌴' };
  // Табличка статуса: только у старшего (одна на всех), висит на шнурке под подбородком, чуть качается;
  // цвет и значок — по статусу, свой текст — на «бумажной» карточке. У гостя и спрятанного не рисуем.
  const MOOD_COL = { 'не беспокоить': ['#ffe3de', '#c8473a', '#5a1d16'], 'на обеде': ['#fff0d6', '#d9862a', '#5a3610'], 'на встрече': ['#e3edff', '#3f6fd6', '#1a2f66'], 'в отпуске': ['#e2f6e4', '#3a9a4a', '#164a1f'], custom: ['#fff8ea', '#b08a5a', '#3a2a1a'] };
  function drawSign() {
    if (!mood || hiding || GUEST || PET.label !== leaderLabel()) return;
    const h = info && info.head ? toCanvas(info.head.x, info.head.y + info.head.r * .95) : { x: CX + offX, y: GY - 80 };   // точка под подбородком
    const ico = MOOD_ICO[mood] || '💬', col = MOOD_COL[mood] || MOOD_COL.custom;
    const sc = Math.max(.7, Math.min(1, SCALE)), sway = Math.sin(now() / 900) * .06 - (R.tilt || 0) * Math.PI / 180 * .3;
    ctx.save(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.translate(h.x, h.y); ctx.rotate(sway); ctx.scale(sc, sc);
    ctx.font = '600 11px system-ui, sans-serif';
    const tw = Math.min(112, ctx.measureText(mood).width), w = tw + 34, hh = 22, top = 14;
    ctx.strokeStyle = col[1]; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-12, -6); ctx.lineTo(0, top); ctx.moveTo(12, -6); ctx.lineTo(0, top); ctx.stroke();   // шнурок
    ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
    ctx.fillStyle = col[0]; ctx.beginPath(); ctx.roundRect(-w / 2, top, w, hh, 7); ctx.fill();                                  // карточка
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = col[1]; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = col[1]; ctx.beginPath(); ctx.arc(0, top, 2.6, 0, Math.PI * 2); ctx.fill();                                   // колечко
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(-w / 2 + 12, top + hh / 2, 8, 0, Math.PI * 2); ctx.fill();   // кружок под значок
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '11px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif'; ctx.fillText(ico, -w / 2 + 12, top + hh / 2 + .5);
    ctx.fillStyle = col[2]; ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(mood, -w / 2 + 24, top + hh / 2 + .5, tw);
    ctx.restore();
  }
  let weekCrown = false, bdayHat = -1e9, bdaysSaid = '';   // «кот недели» — портал отдаёт crown в ответе /hello; колпак в день рождения хозяина
  let me = null, peers = [], visitsOn = true, lastVisitAt = now(), away = null, lastGuestAt = -1e9, guestFrom = '', visiting = false, backTimer = 0;   // первый визит — не раньше чем через 20 минут после запуска
  async function portal(method, path, body) {
    if (!PORTAL) throw new Error('сеть питомцев выключена');
    const r = await fetch(PORTAL + path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    if (!r.ok) { let m = ''; try { m = (await r.json()).message; } catch (_) {} throw new Error(m || ('портал ' + r.status)); }
    return r.json();
  }
  let lastUpdateTry = -1e9;
  // Тихое обновление не удалось (на macOS чаще всего — нет прав перезаписать /Applications/Kotik.app после .pkg):
  // раз в день говорим, где взять новую версию; в консоль — причина.
  function updateFailed(ver, e) {
    console.error('обновление', ver, e);
    const day = new Date().toISOString().slice(0, 10); let said = ''; try { said = localStorage.getItem('upd:failsaid') || ''; } catch (_) { /* без памяти */ }
    if (said === day || PET.label !== leaderLabel()) return;
    try { localStorage.setItem('upd:failsaid', day); } catch (_) { /* без памяти */ }
    const t = `Вышла версия ${ver}, а сам обновиться не смог. Скачай ${EDITION.download || 'вручную'}`;
    setTimeout(() => { say(t, 7000); speak(t); }, 1500);
  }
  const newer = (a, b) => { const A = String(a).split('.').map(Number), B = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((A[i] || 0) !== (B[i] || 0)) return (A[i] || 0) > (B[i] || 0); } return false; };
  async function hello() {
    if (DEMO || GUEST || !invoke || PET.label !== leaderLabel()) return;
    try {
      if (!me) me = await invoke('whoami');
      visitsOn = me.visits !== false;
      // счётчики всех своих питомцев — из общего localStorage (ключи ach:/care:/born: по метке окна)
      const stat = (label, sp, name) => { let a = null, c = null, born = null; try { a = JSON.parse(localStorage.getItem('ach:' + label) || 'null'); c = JSON.parse(localStorage.getItem('care:' + label) || 'null'); born = localStorage.getItem('born:' + label); } catch (_) { /* без данных */ }
        const n = (a && a.n) || {}; return { sp, name, days: born ? Math.max(0, Math.floor((Date.now() - Date.parse(born)) / 86400e3)) : Math.floor(AGE), badges: (a && a.got || []).length, ach: (a && a.got) || [], fed: n.fed || 0, pet: n.pet || 0, play: n.play || 0, visit: n.visit || 0, guest: n.guest || 0 }; };
      const petsNow = [Object.assign(stat(PET.label, SP, NAME), { label: PET.label, color: PET.color, act: coarseAct(A && A.name, PET.label) }), ...[...friends.values()].filter(f => now() - f.t < 3000 && f.label !== 'guest').map(f => Object.assign(stat(f.label, f.sp, f.name), { label: f.label, color: f.color, act: coarseAct(f.act, f.label) }))];
      const status = { away: [], guest: null, text: mood };
      for (const q of petsNow) { try { const a = JSON.parse(localStorage.getItem('away:' + (q.label || '')) || 'null'); if (a && a.until > Date.now()) status.away.push({ pet: a.name || q.name, to: a.to, until: a.until }); } catch (_) { /* без данных */ } }
      const g = [...friends.values()].find(f => f.label === 'guest' && now() - f.t < 3000); if (g) status.guest = { pet: g.name, owner: g.owner || '' };
      const r = await portal('POST', '/hello', { client: me.client, user: me.user, host: me.host, version: (me && me.version) || window.APP_VERSION || '', pets: petsNow, visits: visitsOn && !dnd(), status });
      if (r && r.name) me.name = r.name;
      if (r && Array.isArray(r.bdays) && r.bdays.length && bdaysSaid !== r.bdays.join('|')) { bdaysSaid = r.bdays.join('|'); setTimeout(() => { if (!busy()) cheer(`У ${r.bdays[0]} сегодня день рождения! Пошлём подарок?`); }, rnd(2000, 8000)); }
      if (r && typeof r.crown === 'boolean' && r.crown !== weekCrown) { weekCrown = r.crown; if (weekCrown && PET.label === leaderLabel()) { say('Мы — кот недели! Корону мне!', 3000); hearts(4); } }
      if (r && r.name) myName = r.name;
      if (r && r.group && r.group !== groupDay && PET.label === leaderLabel() && !busy()) groupPhoto(r.group);
      if (r && r.latest && me.version && newer(r.latest, me.version) && now() - lastUpdateTry > 3600e3) { lastUpdateTry = now(); invoke('update_now').then(ok => { lastUpdateTry = now() - 3600e3 + (ok === false ? 300e3 : 600e3); }).catch(e => updateFailed(r.latest, e)); }   // true без перезапуска = для нашей платформы записи ещё нет (Mac-сборка отстаёт от Windows на минуты) — повторить через 10 минут, а не через час   // тихо: скачает, поставит и перезапустится; отложено — повтор через 5 мин
      peers = await portal('GET', '/peers?client=' + encodeURIComponent(me.client));
    } catch (e) { /* портал недоступен — без гостей */ }
  }
  // Гости по одному: пока гость на экране (или прошло меньше минуты с прошлого), новые визиты ждут в очереди;
  // при показе из очереди срок визита — остаток до until (не меньше 40 с, иначе гость дома раньше, чем появится).
  const guestQueue = [];
  const guestBusy = () => now() - lastGuestAt < 60000 || (friends.get('guest') && now() - friends.get('guest').t < 3000);
  function guestShow(v) {
    const p = v.p, dur = Math.max(0, v.until - now()); if (dur < 40000) return;
    lastGuestAt = now(); guestFrom = v.from;
    invoke('guest_show', { pet: Object.assign({}, p.pet, { msg: String(p.msg || '').slice(0, 120) }), owner: p.owner || 'кто-то', dur: Math.round(dur) }).then(() => { achCount('guest'); if (T && T.event) T.event.emit('guest-coming', { owner: p.owner || 'кто-то', name: p.pet.name || '' }).catch(() => {}); }).catch(e => console.error('guest_show', e));
  }
  async function inboxPoll() {
    if (DEMO || GUEST || !invoke || !me || PET.label !== leaderLabel()) return;
    while (guestQueue.length && guestQueue[0].until - now() < 40000) guestQueue.shift();   // просроченные — вон
    if (guestQueue.length && !guestBusy()) guestShow(guestQueue.shift());
    let msgs = []; try { msgs = await portal('GET', '/inbox?client=' + encodeURIComponent(me.client)); } catch (_) { return; }
    for (const m of msgs) {
      const p = m.payload || {};
      if (m.kind === 'visit' && p.pet && visitsOn) {
        if (p.msg) noteStore({ at: Date.now(), from: p.owner || 'кто-то', pet: (p.pet && p.pet.name) || '', text: String(p.msg).slice(0, 120) });
        const v = { p, from: m.from || p.ownerClient || '', until: now() + Math.round(p.dur || 150000) };
        if (guestBusy()) guestQueue.push(v); else guestShow(v);   // второй гость за минуту раньше молча терялся — теперь ждёт очереди
      } else if (m.kind === 'gift') {
        scheduleGiftBack(m.from || p.ownerClient || '', p.owner || '');
        giftStore({ at: Date.now(), dir: 'in', who: p.owner || 'кто-то', what: p.what || 'flowers', msg: String(p.msg || '').slice(0, 80) });
        const who = p.owner || 'кто-то', G = (window.GIFTS || {})[p.what], s = S(), mm = monAt(x + CX * s, y + GY * s) || mons[0];
        if (G && G.prop) { say(`${G.ico} ${G.name} от ${who}!`, 2500); invoke('prop_show', { kind: G.prop, x: Math.round(x + CX * s + 120 * s), y: Math.round(G.prop === 'bubbles' ? y : y + GY * s - 40 * s) }).catch(e => console.error('gift', e)); }
        else {
          invoke('prop_show', { kind: 'gift', x: Math.round(mm ? mm.x + mm.w / 2 : x), y: Math.round(mm ? mm.y + mm.h - 10 * s : y), data: JSON.stringify({ what: p.what || 'flowers', from: who, msg: String(p.msg || '').slice(0, 80) }) }).catch(e => console.error('gift', e));   // окно подарка — питомцы сбегутся сами
        }
      } else if (m.kind === 'mouse') {
        if (!quiet() && !night() && !(mouse && now() - mouse.t < 5000)) { const s = S(), mm = monAt(x + CX * s, y + GY * s) || mons[0]; invoke('prop_show', { kind: 'mouse', x: Math.round(mm ? mm.x + mm.w / 2 : x), y: Math.round(mm ? mm.y + mm.h - 10 * s : y), data: JSON.stringify({ from: p.owner || 'коллега' }) }).catch(e => console.error('mouse', e)); }
      } else if (m.kind === 'friend' && p.pet) {   // у коллеги наш питомец подружился с его питомцем
        if (T && T.event) T.event.emit('net-friend-back', { pet: p.pet, owner: p.owner || 'коллега', with: p.with || '' }).catch(() => {});
      } else if (m.kind === 'ball') {
        netBallReceive(p, m.from || p.ownerClient || '');
      } else if (m.kind === 'stay' && p.pet) {     // наш питомец остался ночевать у коллеги
        if (T && T.event) T.event.emit('stay', { pet: p.pet, until: +p.until || 0 }).catch(() => {});
      } else if (m.kind === 'poll' && p.id) {
        const s = S(), mm = monAt(x + CX * s, y + GY * s) || mons[0];
        invoke('prop_show', { kind: 'poll', x: Math.round(mm ? mm.x + mm.w / 2 : x), y: Math.round(mm ? mm.y + mm.h - 190 * s : y), data: JSON.stringify({ id: p.id, text: p.text, options: p.options, owner: p.owner || 'кто-то', client: me.client }) }).catch(e => console.error('poll', e));
      } else if (m.kind === 'disco') { if (T && T.event) T.event.emit('disco-in', { from: p.owner || 'кто-то' }).catch(() => {});
      } else if (m.kind === 'wave') { mark('!'); say(`${p.owner || 'Кто-то'} машет тебе!`, 3000); }
      else if (m.kind === 'like') { const who = p.owner || 'Кто-то', pn = p.pet && p.pet.name; hearts(4); say(pn ? `❤ ${who} лайкнул(а) ${pn === NAME ? 'меня' : pn}!` : `❤ ${who} лайкнул(а) нас!`, 3000); if (T && T.event) T.event.emit('sound', undefined).catch(() => {}); }
    }
  }
  // уйти в гости: к краю экрана, спрятаться, отправить себя коллеге, вернуться по таймеру
  async function goVisit(target, force, msg) {
    if (DEMO || GUEST || !invoke || away || (!visitsOn && !force)) return acts.sit();
    if (!force) try { if (+localStorage.getItem('awayUntil') > Date.now()) return acts.sit(); } catch (_) { /* без памяти */ }   // в гостях не больше одного питомца сразу
    try { if (!me) me = await invoke('whoami'); if (!target) peers = await portal('GET', '/peers?client=' + encodeURIComponent(me.client)); } catch (_) { return acts.sit(); }
    if (!target && !peers.length) return acts.sit();
    const to = target || pickPeer(peers), s = S(), c = myCenter(), m = monAt(c.x, c.y); if (!m || !to) return acts.sit();
    lastVisitAt = now(); visiting = true;
    const nf = netFriends().some(f => f.owner === to.name);   // к другу по сети — дольше
    if (nf) { achCount('visitFriend'); lastPairWith = to.name; }
    const side = c.x < m.x + m.w / 2 ? -1 : 1, ex = side < 0 ? m.x - 200 * s : m.x + m.w - 20 * s, dur = Math.round(nf ? rnd(200000, 300000) : rnd(120000, 180000));   // целое: guest_show у получателя ждёт u64, дробное Tauri отвергал
    say(pick([`Пойду к ${to.name} в гости!`, `Схожу к ${to.name}`, `${to.name} онлайн — загляну`]), 2600);
    const leave = async () => {
      away = { to, at: now(), dur, side, m }; visiting = false;
      try {
        await portal('POST', '/send', { from: me.client, to: to.client, kind: 'visit', payload: { pet: { sp: SP, color: PET.color, fur: PET.fur || '', look: lookWithSick(), name: NAME, sex: SEX, build: PET.build || 'normal' }, dur, msg: msg ? String(msg).slice(0, 120) : '' } });
        await invoke('pet_visible', { label: PET.label, on: false }); achCount('visit');
        try { localStorage.setItem('awayUntil', String(Date.now() + dur + 10000)); localStorage.setItem('away:' + PET.label, JSON.stringify({ to: to.name, until: Date.now() + dur + 8000, name: NAME })); } catch (_) { /* без памяти */ }
        start('away', { pose: 'sit', dur: 1e9 });
        // спрятанное окно не крутит кадры (requestAnimationFrame стоит) — возвращаемся по системному таймеру, а не по циклу действий
        clearTimeout(backTimer); backTimer = setTimeout(comeBack, dur + 8000);
      } catch (e) { away = null; visiting = false; say(pick(['Дверь закрыта…', 'Не достучался', 'Никого дома']), 1800); acts.sit(3000); }
    };
    moveTo(...clampPos(ex, floorY(m), m), 120 * SPD, { name: 'walk', after: leave, exit: () => { setTimeout(() => { if (visiting && !away) visiting = false; }, 500); } });
  }
  // После перезапуска (например, тихого обновления) питомец, ушедший в гости, не должен появляться дома
  // раньше срока: читаем away:<метка> из localStorage и досиживаем визит спрятанным. Просроченное — чистим.
  function awayRestore() {
    let a = null; try { a = JSON.parse(localStorage.getItem('away:' + PET.label) || 'null'); } catch (_) { /* без памяти */ }
    if (!a || !(a.until > Date.now() + 3000)) { try { localStorage.removeItem('away:' + PET.label); if (!(+localStorage.getItem('awayUntil') > Date.now())) localStorage.removeItem('awayUntil'); } catch (_) { /* без памяти */ } return false; }
    const s = S(), m = monAt(x + CX * s, y + GY * s) || mons[0]; if (!m) return false;
    away = { to: { name: a.to || 'коллега' }, at: now(), dur: a.until - Date.now(), side: -1, m };
    invoke('pet_visible', { label: PET.label, on: false }).catch(() => {});
    start('away', { pose: 'sit', dur: 1e9 });
    clearTimeout(backTimer); backTimer = setTimeout(comeBack, a.until - Date.now());
    return true;
  }
  function comeBack() {
    if (!away) return;
    const { to, side, m } = away, s = S(); away = null; clearTimeout(backTimer);
    try { localStorage.removeItem('awayUntil'); localStorage.removeItem('away:' + PET.label); } catch (_) { /* без памяти */ }
    x = side < 0 ? m.x - 200 * s : m.x + m.w - 20 * s; y = floorY(m); faceT = side < 0 ? 1 : -1;
    invoke('pet_visible', { label: PET.label, on: true }).catch(() => {});
    const tx = clampPos(x + (side < 0 ? 1 : -1) * rnd(150, 300) * s, floorY(m), m)[0];
    portalEvent('return', { from: to.name });
    moveTo(tx, floorY(m), 90 * SPD, { after: () => { say(pick([`Вернул{ся|ась}! Был{|а} у ${to.name}`, `У ${to.name} хорошо, а дома лучше`, `${to.name} передаёт привет`]), 3000); hearts(2); acts.sit(3000); } });
  }
  // гость: пришёл из-за края, поздоровался, погулял, попрощался и ушёл
  // Гость: вошёл, поздоровался, передал записку (если есть), а дальше не просто гуляет — зовёт хозяев
  // наперегонки, болтает про своего хозяина, играет в догонялки и мяч; перед уходом — селфи на память.
  let guestLeaving = false, guestRaced = false, guestTrickPick = '';
  // ---------- записка с гостем ----------
  // Гость с запиской идёт к курсору и поднимает карточку с текстом: держится 40 с или до ✕ (карточка ловит
  // курсор, см. over в цикле). Старший у хозяина озвучивает записку и кладёт в журнал notes (localStorage,
  // 50 последних) — прочитать можно потом в окне «Питомцы» → «Сеть».
  let noteOn = false, noteEl = null, noteTimer = 0;
  function noteShow(from, text) {
    if (!noteEl) { noteEl = document.getElementById('note'); if (!noteEl) return; noteEl.addEventListener('click', e => { if (e.target.classList.contains('x')) noteHide(); }); }
    noteEl.textContent = ''; const sm = document.createElement('small'); sm.textContent = '✉ ' + from + ' передаёт:'; noteEl.appendChild(sm); noteEl.appendChild(document.createTextNode(text));
    const x = document.createElement('b'); x.className = 'x'; x.title = 'закрыть'; x.textContent = '✕'; noteEl.appendChild(x);
    noteEl.classList.add('on'); noteOn = true; clearTimeout(noteTimer); noteTimer = setTimeout(noteHide, 40000);
  }
  function noteHide() { if (noteEl) noteEl.classList.remove('on'); noteOn = false; }
  function noteDeliver() {
    if (!PET.msg) return;
    focus(25000);                              // записка важнее догонялок и мяча хозяев
    const [tx, ty] = nearPoint(cur.x, cur.y, 100);
    say('Мне велели передать…', 1600);
    const o = { name: 'noteGo', dur: 12000, after: () => {
      faceT = cur.x > myCenter().x ? 1 : -1; noteShow(PET.owner || 'коллега', PET.msg);
      if (T && T.event) { T.event.emit('note-read', { from: PET.owner || 'коллега', pet: NAME, text: PET.msg }).catch(() => {}); const f = friendNear(900); if (f) T.event.emit('pet-play', { kind: 'note', to: f.label, from: PET.label, text: PET.msg }).catch(() => {}); }
      start('noteHold', { pose: 'sit', dur: 8000, watch: true, mod: (T_) => { T_.armL = .7; T_.happy = .6; } });
    } };
    if (FLY) soarTo(tx, ty, o.after, o); else moveTo(tx, ty, 200 * SPD, o);
  }
  function giftStore(g) {                        // журнал подарков (gifts в localStorage, 50 последних) — блок «Подарки» во вкладке «Сеть»
    try { const list = JSON.parse(localStorage.getItem('gifts') || '[]'); list.unshift(g); localStorage.setItem('gifts', JSON.stringify(list.slice(0, 50))); } catch (_) { /* без памяти */ }
    if (T && T.event) T.event.emit('gifts-changed', {}).catch(() => {});
  }
  // Заразность: больной питомец уходит в гости с пометкой sick внутри look (Rust лишние поля не пропускает),
  // гость чихает раз в пару минут, а хозяин, поиграв или поболтав с больным, с шансом 15 % заболевает сам.
  function lookWithSick() {
    const base = PET.look === 'litter' ? '' : (PET.look || ''); if (!sick()) return base;
    let o = {}; try { o = base ? JSON.parse(base) : {}; } catch (_) { o = {}; } if (!o || typeof o !== 'object') o = {};
    o.sick = true; return JSON.stringify(o);
  }
  let guestSick = false; try { const lk = GUEST && PET.look ? JSON.parse(PET.look) : null; guestSick = !!(lk && lk.sick); } catch (_) { /* look не JSON */ }
  let lastInfect = -1e9;
  function maybeInfect(f) {
    if (!f || !f.sick || GUEST || DEMO || sick() || now() - lastInfect < 600000 || Math.random() > .15) return;
    lastInfect = now(); care.health = Math.min(care.health, 35); careSave();
    setTimeout(() => { say(`Апчхи… кажется, я заразил{ся|ась} от ${f.name || 'гостя'}`, 3200); fx('mark', '🤧', 0, -30, 2200); }, 1500);
  }
  if (GUEST) setInterval(() => { if (guestSick && !busy() && Math.random() < .5) { acts.sneeze ? acts.sneeze() : say('Апчхи!', 1200); } }, 120000);
  function noteStore(n) {
    try { const list = JSON.parse(localStorage.getItem('notes') || '[]'); list.unshift(n); localStorage.setItem('notes', JSON.stringify(list.slice(0, 50))); } catch (_) { /* без памяти */ }
    if (T && T.event) T.event.emit('notes-changed', {}).catch(() => {});
  }
  // Подарок отправлен: старший несёт его к краю экрана «курьеру» — видно, что ушло
  function giftCarryOut(ico, name, to) {
    const s = S(), c = myCenter(), m = monAt(c.x, c.y) || mons[0]; if (!m) return;
    focus(14000); say(`Отнесу ${name} — ${to}!`, 2200); hearts(1);
    if (!carryEl) { carryEl = document.createElement('div'); carryEl.className = 'fx'; carryEl.style.fontSize = '18px'; stage.appendChild(carryEl); }
    carryEl.textContent = ico; carryEl.style.fontSize = '22px'; carryEl.style.display = '';
    const side = c.x < m.x + m.w / 2 ? -1 : 1, ex = side < 0 ? m.x + 40 * s - CX * s : m.x + m.w - 40 * s - CX * s;
    const o = { name: 'carry', dur: 14000, mod: (T_) => { T_.armL = .6; T_.mouth = .2; T_.happy = .5; }, tick: () => { const h = headCanvas(); if (carryEl) { carryEl.style.left = (h.x + face * 26) + 'px'; carryEl.style.top = (h.y + 30) + 'px'; } },
      after: () => { if (carryEl) carryEl.style.display = 'none'; fx('zzz', '📦', 0, -30, 1500); say(pick(['Отдал{|а} курьеру!', 'Улетело!', 'Доставят!']), 1800); const [bx, by] = clampPos(x - side * 160 * s, floorY(m), m); moveTo(bx, by, 120 * SPD, { after: () => acts.sit(2000) }); },
      exit: () => { if (carryEl) carryEl.style.display = 'none'; } };
    moveTo(ex, floorY(m), 200 * SPD, o);
  }
  function guestArrive() {
    const s = S(), m = monAt(x + CX * s, y + GY * s) || mons[0]; if (!m) return;
    x = m.x - 200 * s; y = floorY(m); faceT = 1; focus(PET.msg ? 14000 : 7000);   // вход и записку не перебивают болтовня и игры хозяев
    if (PET.msg) setTimeout(noteDeliver, 7000);   // по своему таймеру: after прогулки может не случиться, если её перебили
    const tx = clampPos(m.x + rnd(200, 500) * s, floorY(m), m)[0];
    moveTo(tx, floorY(m), 90 * SPD, { after: () => { say(pick([`Привет! Я ${NAME}, от ${PET.owner}`, `Меня отпустили погулять — я от ${PET.owner}`, `Здравствуйте! Я в гостях от ${PET.owner}`]), 3200); mark('!'); acts.sit(3000);
      } });
    setTimeout(guestLeave, PET.dur || 150000);
    setTimeout(guestPlan, PET.msg ? 12000 : 7000);
  }
  function guestPlan() {
    if (!GUEST || guestLeaving) return;
    const f = friendNear(700);
    if (f && !busy() && !chat && !race) {
      const r = Math.random();
      if (r < .25 && !guestRaced) { guestRaced = true; raceStart(f); }
      else if (r < .45) chatStart(f);
      else if (r < .6 && (CAT || DOG || RAB)) tagInvite(f);
      else if (r < .75 && (CAT || DOG || RAB)) ballStart(f);
      else guestTrick();
    }
    setTimeout(guestPlan, rnd(9000, 15000));
  }
  function guestTrick() {                        // гость показывает трюк; хозяева, увидев три раза, перенимают
    const k = guestTrickPick || (guestTrickPick = pick(Object.keys(TRICKS)));   // один трюк за визит — чтобы хозяева успели выучить
    say(pick(['Смотри, что умею!', 'А так можешь?']), 1400);
    setTimeout(() => { trick(k, false, true); const s = S(); for (const f of friends.values()) if (now() - f.t < 3000 && f.label !== 'guest' && Math.hypot(f.x - x, f.y - y) / s < 700 && T && T.event) T.event.emit('pet-play', { kind: 'trick', to: f.label, from: PET.label, name: k, guestName: NAME }).catch(() => {}); }, 1200);
  }
  function guestLeave() {
    if (!guestLeaving && !overnight && (night() || quiet()) && guestFriendHere()) return overnightStay();
    const s = S(), m = monAt(x + CX * s, y + GY * s) || mons[0]; if (!m) return invoke('guest_hide');
    guestLeaving = true; chat = null;
    const f = friendNear(600), wait = f ? 3200 : 0;
    if (f) { say('Селфи на память!', 2400); if (T && T.event) T.event.emit('pet-play', { kind: 'selfie', to: f.label, from: PET.label, guestName: NAME, owner: PET.owner }).catch(() => {}); faceT = f.x > x ? 1 : -1; start('pose', { pose: 'sit', dur: 2600, mod: (T_) => { T_.happy = 1; T_.tail = 25; T_.headTilt = 6; T_.yaw = 0; } }); fx('zzz', '📸', 0, -40, 1500); }
    setTimeout(() => say(pick(['Мне пора домой', `${PET.owner} заждал{ся|ась}`, 'Спасибо, что приняли!']), 2600), wait);
    setTimeout(() => moveTo(m.x - 200 * s, floorY(m), 120 * SPD, { name: 'walk', after: () => invoke('guest_hide').catch(() => {}) }), wait + 2200);
    setTimeout(() => invoke('guest_hide').catch(() => {}), 40000);   // страховка
  }
  // ---------- гонка до края экрана ----------
  // Зовущий шлёт pet-play race/go со временем старта и линией; оба идут на старт, по времени бегут к правому
  // краю; первый у финиша шлёт race/win, второй, получив его до финиша, знает, что проиграл. Итог — в ленту (хозяин).
  let race = null;
  function raceStart(f) {
    const s = S(), m = monAt(x + CX * s, y + GY * s) || mons[0]; if (!m) return acts.sit();
    const r = { t0: now() + 4000, x0: m.x + 40 * s, x1: m.x + m.w - (W - 30) * s, y0: floorY(m), other: f.label };
    say(pick(['Наперегонки до края?', 'Кто быстрее до края экрана?']), 2000);
    if (T && T.event) T.event.emit('pet-play', Object.assign({ kind: 'race', role: 'go', to: f.label, from: PET.label }, r)).catch(() => {});
    raceRun(r);
  }
  function raceRun(r) {
    const s = S(); race = { t0: r.t0, other: r.other, lost: false }; focus(25000);
    moveTo(r.x0, r.y0, 260 * SPD, { name: 'walk', after: () => {
      faceT = 1;
      start('raceWait', { pose: 'crouch', dur: 1e9, mod: (T_) => { T_.pup = 1; }, tick: () => {
        if (now() < r.t0) return; A = null; say(pick(['Марш!', 'Побежали!', 'Вжух!']), 900);
        start('race', { pose: 'walk', dur: 25000, tx: r.x1, ty: r.y0, speed: rnd(300, 390) * SPD, after: () => raceFinish(r), exit: () => { if (race && now() - race.t0 > 24000) race = null; } });
      } });
    } });
  }
  function raceFinish(r) {
    const won = !(race && race.lost); const rr = race; race = null;
    if (!GUEST) { achCount('race'); const fg = friends.get(r.other); if (fg && fg.label === 'guest') lastPairWith = fg.name || ''; }
    if (won) { say(pick(['Ура! Я первый!', 'Финиш! Я быстрее!']), 2400); hearts(3); if (T && T.event) T.event.emit('pet-play', { kind: 'race', role: 'win', to: r.other, from: PET.label, t0: r.t0 }).catch(() => {}); }
    else say(pick(['Ух, быстрый!', 'Ладно, ты выиграл{|а}', 'В следующий раз я!']), 2400);
    const f = friends.get(r.other);
    if (!GUEST && (rr || won)) portalEvent('race', { winner: won ? NAME : ((f && f.name) || 'гость'), loser: won ? ((f && f.name) || 'гость') : NAME });
    start('pant', { pose: 'sit', dur: 4000, mod: (T_, q) => { T_.mouth = .4; T_.bob += Math.sin(q * 10) * 1.2; }, after: () => acts.sit(2000) });
  }
  if (!DEMO && invoke) {
    if (GUEST) setTimeout(guestArrive, 800);
    else { setTimeout(hello, 3000); setInterval(hello, 60000); setInterval(inboxPoll, 10000); }
  }
  function next() {
    const f = friendNear(500);
    const table = CUSTOM
      ? [['walk', 24], ['run', 4], ['sit', 14], ['look', 8], ['jump', 5], ['wobble', 4], ['loaf', 4], ['sleep', 4], ['stretch', 3], ['voice', 4], ['phrase', 6], ['visit', f ? 5 : 0]]
      : ROUND
      ? [['walk', 20], ['roll', 8], ['run', 4], ['sit', 12], ['look', 7], ['jump', 7], ['wobble', 5], ['loaf', 4], ['sleep', 4], ['stretch', 3], ['voice', 4], ['phrase', 6], ['visit', f ? 5 : 0]]
      : KUZYA
      ? [['walk', 22], ['run', 4], ['sit', 12], ['look', 6], ['tale', 7], ['sweep', 8], ['pie', 6], ['nafanya', 3], ['grumble', 3], ['squat', 4], ['valenok', 3], ['loaf', 5], ['sleep', 4], ['stretch', 3], ['voice', 3], ['phrase', 5], ['visit', f ? 4 : 0]]
      : CLIP
      ? [['walk', 20], ['run', 4], ['sit', 14], ['look', 8], ['tip', 9], ['morph', 6], ['knock', 4], ['bounce', 6], ['brows', 5], ['spinClip', 3], ['loaf', 3], ['sleep', 4], ['phrase', 5], ['visit', f ? 4 : 0]]
      : DRAGON
      ? [['walk', 22], ['run', 4], ['sit', 13], ['look', 6], ['soar', 10], ['fire', 6], ['hoard', 4], ['sneeze', 2], ['warm', 5], ['flap', 4], ['loaf', 5], ['sleep', 4], ['stretch', 3], ['voice', 3], ['hunt', 4], ['phrase', 4], ['visit', f ? 4 : 0]]
      : RAB
      ? [['walk', 22], ['zoomies', 4], ['sit', 13], ['sitUp', 9], ['loaf', 8], ['sleep', 4], ['flop', 4], ['wash', 7], ['nibble', 5], ['binky', 4], ['dig', 3], ['sniff', 8], ['phrase', 3], ['stretch', 3], ['visit', f ? 4 : 0]]
      : BIRD
      ? [['hop', 12], ['soar', 16], ['sit', 14], ['look', 8], ['phrase', 7], ['whistle', 4], ['dance', 4], ['preen', 6], ['wingStretch', 3], ['peck', 6], ['sleep', 3], ['loaf', 3], ['ride', f ? 7 : 0]]
      : HAM
      ? [['walk', 20], ['run', 8], ['sit', 12], ['sitUp', 10], ['wash', 8], ['stuff', 5], ['wheel', 6], ['loaf', 5], ['sleep', 5], ['sniff', 8], ['dig', 4], ['phrase', 3], ['stretch', 2], ['voice', 2], ['visit', f ? 4 : 0]]
      : DOG
      ? [['walk', 24], ['run', 5], ['sit', 12], ['pant', 6], ['lie', 7], ['sleep', 4], ['sniff', 9], ['scratch', 4], ['bow', 4], ['spin', 3], ['dig', 3], ['voice', 3], ['stretch', 3], ['phrase', 3], ['look', 4], ['visit', f ? 8 : 0]]
      : [['walk', 26], ['run', 5], ['sit', 14], ['look', 7], ['groom', 8], ['scratch', 3], ['knead', 3], ['loaf', 6], ['sleep', 4], ['stretch', 4], ['voice', 3], ['hunt', 5], ['sniff', 4], ['phrase', 3], ['visit', f ? 3 : 0]];
    table.push(['cheer', 5]);
    if ((CAT || DOG || RAB) && Math.random() < .012 && !DEMO) return hideAndSeek();
    if (!DEMO && !GUEST && !away && now() - lastRelay > 15 * 60000 && Math.random() < .08 && !busy() && relayMates().length >= 2) return relayStart();
    if (!GUEST && now() - lastComfort > 10 * 60000 && !busy()) { const cf = comfortTarget(); if (cf) return comfort(cf); }
    if (CAT && post && now() - post.t < 3000 && now() - lastPost > 240000 && Math.random() < .25) return scratchPost();
    if (CAT && now() - curStillSince > 90000 && now() - curStillSince < 8 * 60000 && Math.random() < .15 && nudgeCursor()) return;
    if (KUZYA && f && f.sp === 'cat' && Math.hypot(f.x - x, f.y - y) / S() < 260 && now() - lastShoo > 120000 && Math.random() < .5) { lastShoo = now(); mark('!'); start('shoo', { pose: 'up', dur: 2200, mod: (T, q) => { T.armL = T.armR = 1; T.mouth = q < 1 ? .8 : 0; T.ear = .8; } }); return say(pick(['Кыш, кошка!', 'Брысь! Домовой тут', 'Опять эта кошка…']), 2000); }
    if (!DEMO && !GUEST && !away && visitsOn && now() - lastVisitAt > rnd(20, 40) * 60000 && Math.random() < .2 && !busy()) return goVisit();
    if (!DEMO && now() - lastPerch > 9 * 60000 && perchOk() && Math.random() < .15) return perch();
    if (nestAlive() && now() - lastGather > 60000 && Math.random() < .5 && !busy()) return gather();
    if (quiet()) return acts.sleep(Math.min(quietUntil - now() + 1000, 600000), true);
    if (isBaby() && !GUEST && parentNear() && Math.random() < .18 && !busy()) return followParent();
    if (sick() && Math.random() < .25) return acts.loaf();
    if (!GUEST && Math.random() < .03 && Object.keys(TRICKS).some(trickLearned) && !busy()) return trickShow();
    if (inCall) return start('quiet', { pose: 'loaf', dur: 1e9 });
    if (HOL && !holSaid) { holSaid = true; if (HOL.fxc) hearts(4); return cheer(HOL.text); }
    if (weather && now() - weatherSaid > 3 * 3600e3 && Math.random() < .5) { weatherSaid = now(); const w = weatherPhrase(); if (w) { start('sit', { pose: 'sit', dur: 4000, watch: true }); return say(w, 3600); } }
    if (now() - lastNag > 8 * 60000 && (hungry() || lonely() || bored()) && Math.random() < .4) return nag();
    if (night()) for (const r of table) { if (['sleep', 'loaf', 'lie'].includes(r[0])) r[1] *= 3; if (['run', 'zoomies', 'hunt', 'binky', 'soar', 'wheel', 'fire'].includes(r[0])) r[1] *= .3; if (r[0] === 'warm') r[1] *= 2; }
    if (invoke && Math.random() < .004 && !DEMO) { const s = S(), m = monAt(x + CX * s, y + GY * s); if (m) invoke('prop_show', { kind: 'butterfly', x: Math.round(m.x + rnd(100, m.w - 100)), y: Math.round(m.y + m.h - 300 * s) }).catch(() => {}); }
    if (now() < focusUntil) return acts.sit(2000);
    if (f && now() - lastChat > 90000 && Math.hypot(f.x - x, f.y - y) / S() < 300 && Math.random() < .35) return chatStart(f);
    if (now() - lastBall > 180000 && (CAT || DOG || RAB) && Math.random() < (f ? .25 : .05) && !((HAM || RAB) && f && f.sp === 'cat')) return ballStart(f && Math.hypot(f.x - x, f.y - y) / S() < 500 ? f : null);
    if (f && now() - lastPlay > 150000 && Math.hypot(f.x - x, f.y - y) / S() < 450 && Math.random() < .3
        && !((HAM || RAB) && f.sp === 'cat') && !['soar', 'ride', 'hang', 'sleep'].includes(f.act || '')) return tagInvite(f);
    // раз в 25–40 минут — обязательно подбодрить; раз в ~55 минут — напомнить размяться
    if (now() - lastCheer > rnd(25, 40) * 60000) return cheer();
    if (now() - lastBreak > 55 * 60000) { lastBreak = now(); cheer(pick(['Ты почти час без перерыва. Встань, потянись — я тоже', 'Пора размяться: плечи, шея, глаза в окно. Я подожду', 'Перерыв! Чай, вода, два шага по комнате'])); return; }
    for (const r of table) {                     // характер: игривый носится, ленивый спит, робкий сидит, смелый охотится
      if (CHAR === 'playful' && ['run', 'zoomies', 'hunt', 'binky', 'bow', 'spin', 'wheel', 'soar'].includes(r[0])) r[1] *= 1.6;
      if (CHAR === 'lazy' && ['sleep', 'loaf', 'lie', 'sit'].includes(r[0])) r[1] *= 1.7;
      if (CHAR === 'lazy' && ['run', 'zoomies', 'hunt', 'binky'].includes(r[0])) r[1] *= .5;
      if (CHAR === 'shy' && ['sit', 'look', 'loaf', 'wash', 'groom'].includes(r[0])) r[1] *= 1.5;
      if (CHAR === 'shy' && ['voice', 'phrase', 'bow', 'visit'].includes(r[0])) r[1] *= .5;
      if (CHAR === 'brave' && ['hunt', 'visit', 'voice', 'dig', 'sniff'].includes(r[0])) r[1] *= 1.6;
      if (isBaby() && ['run', 'zoomies', 'binky', 'hunt', 'spin', 'jump', 'roll', 'bounce'].includes(r[0])) r[1] *= 2.2;      // малыш неугомонный
      if (isBaby() && ['sleep', 'phrase'].includes(r[0])) r[1] *= 1.5;
    }
    if (CHUBBY) for (const r of table) {
      if (['sleep', 'loaf', 'lie', 'sit'].includes(r[0])) r[1] *= 1.8;
      if (['run', 'hunt', 'bow', 'spin', 'dig', 'binky', 'zoomies'].includes(r[0])) r[1] *= .4;
      if (r[0] === 'phrase') r[1] *= 1.5;
    }
    let sum = table.reduce((a, b) => a + b[1], 0), v = Math.random() * sum;
    for (const [n, w] of table) if ((v -= w) < 0) return n === 'cheer' ? cheer() : n === 'visit' ? visit(f) : n === 'loaf' && BIRD ? start('loaf', { pose: 'loaf', dur: rnd(5000, 9000), watch: true, mod: T => { T.puff = 1.2; } }) : acts[n]();
    acts.sit();
  }

  // ---------- взаимодействие ----------
  let pressed = null, dragging = false, petClicks = [], throwV = { x: 0, y: 0 }, tug = null;
  function pet() {
    if (hiding) return found();
    if (shell) return shellPick();
    if (A && (A.name === 'sleep' || A.name === 'loaf' || A.name === 'lie')) return wake();
    const t = now();
    petClicks = petClicks.filter(c => t - c < 4000); petClicks.push(t);
    if (petClicks.length >= 7) { petClicks = []; return DOG ? overjoyed() : CAT ? hiss() : RAB ? acts.binky() : DRAGON ? acts.fire(true) : KUZYA ? acts.grumble() : CLIP ? acts.morph('spiral') : ROUND ? acts.roll() : CUSTOM ? acts.jump() : bite(); }
    if (A && A.name === 'pet') { A.dur += 900; hearts(1); return; }
    start('pet', { pose: 'sit', dur: 3000, watch: true, mod: (T, q) => {
      T.headTilt += 10 * Math.sin(q * 3); T.happy = 1; T.ear = .25; T.tail = 30;
      if (DOG) { T.tongue = 1; T.mouth = .3; }
      if (BIRD) { T.puff = 1.15; T.headY = 6; T.crest = .8; }
      if (DRAGON) { T.glow = .6; T.smoke = .4; }
      if (CLIP) { T.ear = -.8; T.bob += Math.sin(q * 8) * 2; }
      if (KUZYA) { T.armL = .5; T.eye = .5; }
      if (ROUND || CUSTOM) { T.tilt = Math.sin(q * 6) * 5; T.armL = T.armR = .6; }
    } });
    say(Math.random() < .25 ? pick(CHEER) : pick(TX().petSay), 2600); hearts(3); play(TX().petSnd, true); careMark('pet'); achCount('pet');
  }
  function bite() {
    say('Кусь!', 1200); play(TX().snd, true, 3);
    const s = S(), away = cur.x > myCenter().x ? -1 : 1;
    if (BIRD) return acts.soar(); if (DRAGON) return acts.fire(true);
    const [tx, ty] = clampPos(x + away * 400 * s, y); moveTo(tx, ty, 260, { after: () => acts.sit(3000) });
  }
  function flee(from) {
    const s = S(), away = from.x > myCenter().x ? -1 : 1;
    say(BIRD ? 'Караул!' : RAB ? 'Тревога!' : 'Пи-пи-пи!', 1400); play(RAB ? 'thump' : TX().snd, true, 3);
    if (BIRD) { const m = monAt(x, y); return soarTo(...clampPos(x + away * 500 * s, m ? m.y + rnd(60, 250) * s : y - 300 * s)); }
    const [tx, ty] = clampPos(x + away * 500 * s, y); moveTo(tx, ty, 330, { after: () => acts.sit(3000) });
  }
  function rideTarget(f) { const s = S(); return [f.top.x - CX * s, f.top.y - GY * s + 3 * s]; }
  function hiss(from) {
    const c = myCenter(), fx_ = from ? from.x : cur.x;
    faceT = fx_ > c.x ? 1 : -1;
    start('arch', { pose: 'arch', dur: 1300, rate: 10, enter: () => { say('Ффф!'); play('hiss', !from); },   // сам по себе (на щенка) — не чаще раза в 2,5 мин
      after: () => { const s = S(), away = fx_ > c.x ? -1 : 1, [tx, ty] = clampPos(x + away * 600 * s, y); moveTo(tx, ty, 320, { after: () => acts.sit(4000) }); } });
  }
  function overjoyed() { say('УРААА!', 1500); play('bark', true, 3); acts.zoomies(4); }
  function wake() { mark('!'); say(pick(TX().wake), 1400); BIRD ? acts.wingStretch() : DRAGON ? acts.flap() : CLIP || ROUND || CUSTOM ? acts.bounce() : acts.stretch(); }
  function come() {
    say(TX().come, 1200);
    const [tx, ty] = nearPoint(cur.x, cur.y);
    if (FLY) return soarTo(tx, ty, () => { faceT = cur.x > myCenter().x ? 1 : -1; acts.voice(true); }, { follow: 60, dur: 12000 });
    moveTo(tx, ty, DOG ? 360 : HAM ? 260 : 300, { follow: 80, dur: 12000, after: () => { faceT = cur.x > myCenter().x ? 1 : -1; acts.voice(true); } });
  }
  function feedCore() { careMark('fed'); achCount('fed'); weightTick(careNow() - (care.lastMeal || 0) < 3 * 3600e3 ? .6 : .1); care.lastMeal = careNow(); careSave(); }
  // Еда по видам: из трея «Покормить…» приходит feed_<что>. Любимое — сердечки и «Любимое!», подходящее — просто
  // ест, чужое — нюхает и отказывается (голод не сбрасывается), вода — пьют все. В миске видно, что насыпали.
  const FOOD = {
    fish: { ico: '🐟', name: 'рыбу', likes: ['cat'], ok: ['dog', 'dragon', 'kuzya', 'custom', 'round'] },
    bone: { ico: '🦴', name: 'косточку', likes: ['dog'], ok: ['dragon', 'kuzya', 'custom', 'round'] },
    seeds: { ico: '🌻', name: 'семечки', likes: ['bird', 'hamster'], ok: ['rabbit', 'kuzya', 'custom', 'round'] },
    carrot: { ico: '🥕', name: 'морковку', likes: ['rabbit', 'hamster'], ok: ['bird', 'kuzya', 'custom', 'round', 'dragon'] },
    apple: { ico: '🍎', name: 'яблоко', likes: ['hamster', 'rabbit', 'kuzya'], ok: ['cat', 'dog', 'bird', 'dragon', 'clippy', 'round', 'custom'] },
    water: { ico: '💧', name: 'воду', likes: [], ok: ['cat', 'dog', 'hamster', 'bird', 'rabbit', 'dragon', 'kuzya', 'clippy', 'round', 'custom'] },
  };
  const foodTaste = kind => { const f = FOOD[kind]; if (!f) return 'fav'; if (f.likes.includes(SP)) return 'fav'; if (f.ok.includes(SP)) return 'ok'; return 'no'; };
  let foodKind = '';
  function feed(kind) {
    foodKind = FOOD[kind] ? kind : '';
    if (foodKind === 'water') return drink();
    if (foodKind && foodTaste(foodKind) === 'no') {   // не моё: понюхать и отказаться; миску всё равно наполним — может, съест сосед
      if ((CAT || DOG) && bowlAlive() && T && T.event && !bowl.full) T.event.emit('prop-kick', { kind: 'bowl', fill: true, food: foodKind }).catch(() => {});
      say(pick([`${FOOD[foodKind].ico} Это не моё`, 'Фу. Я такое не ем', `${FOOD[foodKind].name.charAt(0).toUpperCase() + FOOD[foodKind].name.slice(1)}? Я ${CAT ? 'кот' : DOG ? 'пёс' : BIRD ? 'птица' : 'не это ем'}`]), 2600);
      return start('sniff', { pose: 'sniff', dur: 1800, rate: 6, mod: (T_, q) => { T_.headY += Math.sin(q * 9) * 1.5; T_.ear = -.6; }, after: () => acts.sit(2000) });
    }
    if ((CAT || DOG) && !bowlAlive() && invoke && !DEMO && !GUEST) return bowlFeedShow();
    if ((CAT || DOG) && bowlAlive() && Math.hypot(bowl.x - myCenter().x, bowl.y - myCenter().y) / S() < 900) {   // миска на экране — насыпать в неё и есть там
      if (!bowl.full && T && T.event) T.event.emit('prop-kick', { kind: 'bowl', fill: true, food: foodKind }).catch(() => {});
      return bowlEat();
    }
    feedPlain();
  }
  function drink() {                             // вода: миска синяя, лакают все, голод не трогаем
    if ((CAT || DOG) && bowlAlive() && T && T.event) { if (!bowl.full) T.event.emit('prop-kick', { kind: 'bowl', fill: true, food: 'water' }).catch(() => {}); }
    say(pick(['💧 Пить!', 'Водичка…', 'Лак-лак-лак']), 2000);
    start('drink', { pose: BIRD ? 'sit' : 'eat', dur: 3500, mod: (T_, q) => { T_.headY = 12 + Math.max(0, Math.sin(q * 10)) * 3; T_.mouth = Math.sin(q * 10) > 0 ? .4 : .1; T_.armL = T_.armR = 0; }, after: () => { hearts(1); care.health = Math.min(100, (care.health || 0) + 2); careSave(); acts.sit(2000); } });
  }
  function feedPlain() {                         // еда «из воздуха»: птица, хомяк и все, у кого нет миски
    if (foodKind && foodTaste(foodKind) === 'fav') { say(`${FOOD[foodKind].ico} Любимое!`, 1800); hearts(5); }
    feedCore();
    start('eat', { pose: BIRD ? 'sit' : 'eat', dur: 6000, enter: () => { bowlOn = true; say(TX().eat, 2500); if (HAM || BIRD) play('crunch', true); },
      mod: (T, q) => { chew(T, q); if (HAM) T.cheek = Math.min(1, q / 3); if (BIRD) { T.headY = 10 + Math.max(0, Math.sin(q * 14)) * 5; T.armL = T.armR = 0; } if (CAT || DOG) { T.headY = 14; T.armL = T.armR = 0; } },
      exit: () => { bowlOn = false; hearts(4); say(TX().thanks, 2000); play(DOG ? 'bark' : CAT ? 'purr' : TX().snd, true, 1); if (HAM) cheekUntil = now() + 30000; },
      after: () => (DOG ? acts.zoomies(2) : HAM || RAB ? acts.wash() : BIRD ? acts.dance() : KUZYA ? acts.squat() : CLIP ? acts.morph('heart') : ROUND || CUSTOM ? acts.jump() : (Math.random() < .5 ? acts.sleep(40000) : acts.groom())) });
  }
  let chaseUntil = 0, lastPounce = -1e9;
  const chasePose = () => (FLY ? 'fly' : DOG || HAM ? 'walk' : 'crouch');
  function playMode(ms = 15000) { careMark('play'); achCount('play'); weightTick(-.4); chaseUntil = now() + ms; say(TX().play, 1300); start('chase', { pose: chasePose(), dur: ms + 500, mod: FLY ? flapMod : null }); }
  function pounceAt(px, py) { lastPounce = now(); const [tx, ty] = nearPoint(px, py, 20); say('Ап!', 700); leap(tx, ty, () => (chaseUntil > now() ? start('chase', { pose: chasePose(), dur: chaseUntil - now() + 500, mod: BIRD ? flapMod : null }) : acts.sit(3000))); }

  // ---------- друзья ----------
  const friends = new Map();
  // «ведущий» — питомец с наименьшим номером: одиночные команды из трея выполняет только он
  function leaderLabel() { let best = PET.label; for (const f of friends.values()) if (now() - f.t < 3000 && f.label !== 'guest' && f.label < best) best = f.label; return best; }   // гость старшим не бывает
  // ---------- отношения между своими питомцами ----------
  // Очки пары в localStorage rel:<a>|<b> (метки по алфавиту): догонялки и болтовня +1, шипение и кража −1.
  // ≥6 — друзья (первыми зовут в игры, здороваются), ≤−3 — соперники (кот шипит, пёс ворчит, в игры не зовут).
  const relKey = (a, b) => 'rel:' + [a, b].sort().join('|');
  function relGet(other) { try { return +localStorage.getItem(relKey(PET.label, other)) || 0; } catch (_) { return 0; } }
  const isFriend = l => relGet(l) >= 6, isRival = l => relGet(l) <= -3;
  function relAdd(other, d) {
    if (!other || GUEST || DEMO) return;
    if (other === 'guest') return nrelAdd(friends.get('guest'), d);
    const before = relGet(other), after = Math.max(-10, Math.min(20, before + d));
    try { localStorage.setItem(relKey(PET.label, other), String(after)); } catch (_) { return; }
    const f = friends.get(other), name = (f && f.name) || other;
    if (before < 6 && after >= 6) { setTimeout(() => { say(`${name} — мой друг!`, 2600); hearts(3); }, 800); if (PET.label < other) portalEvent('friends', { other: name }); }
    if (before > -3 && after <= -3) setTimeout(() => say(pick([`${name}… опять ты`, `Не люблю ${name}`]), 2200), 800);
    if (before <= -3 && after > -3) setTimeout(() => { say(pick([`${name}, мир!`, `Ладно, ${name}, забыли`]), 2200); hearts(2); }, 800);
  }
  // ---------- примирение ----------
  // Ссора не навсегда: раз в день отрицательный счёт пары подрастает на 1 (старший), еда из одной миски
  // рядом с соперником даёт +2, кнопка «помирить» в окне «Питомцы» (rel-peace) — ритуал носами.
  function relSet(other, v) { try { localStorage.setItem(relKey(PET.label, other), String(v)); } catch (_) { /* без памяти */ } }
  function relDecay() {
    if (GUEST || DEMO || PET.label !== leaderLabel()) return;
    const day = new Date().toISOString().slice(0, 10);
    try {
      if (localStorage.getItem('rel:decay') === day) return;
      localStorage.setItem('rel:decay', day);
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!k || !k.startsWith('rel:') || k === 'rel:decay') continue; const v = +localStorage.getItem(k) || 0; if (v < 0) localStorage.setItem(k, String(v + 1)); }
    } catch (_) { /* без памяти */ }
  }
  if (!DEMO) setInterval(relDecay, 60000);
  function bowlPeace() {                          // поели рядом с соперником — оттаяли
    if (GUEST) return;
    for (const f of friends.values()) {
      if (now() - f.t > 3000 || !isRival(f.label) || f.label === 'guest' || Math.hypot(f.x - x, f.y - y) / S() > 240) continue;
      relAdd(f.label, 2); say(pick(['Ладно, мир. Но миска моя', 'Из одной миски… ну, бывает', 'Ешь, так и быть']), 2400); return;
    }
  }
  function peaceGo(other) {                       // зачинщик: подойти к сопернику носом к носу
    const f = friends.get(other); if (!f || now() - f.t > 3000) return say('А где он?', 1400);
    focus(15000); relSet(other, 0);           // счёт обнуляется сразу: кнопка работает, даже если ритуал перебьют
    const s = S(), side = f.x > x ? -1 : 1, [tx, ty] = clampPos(f.x + side * 58 * s, f.y);
    say(pick(['Ладно… мир?', 'Хватит дуться. Мир?', 'Давай мириться']), 2000);
    moveTo(tx, ty, 120 * SPD, { name: 'walk', after: () => {
      faceT = -side; relSet(other, 0);
      if (T && T.event) T.event.emit('pet-play', { to: other, from: PET.label, kind: 'peace' }).catch(() => {});
      hearts(3); start('nose', { pose: 'sit', dur: 2800, watch: false, mod: (T_, q) => { T_.headY = 4; T_.happy = 1; T_.headTilt = -side * 6 + Math.sin(q * 3) * 3; }, after: () => acts.sit(3000) });
    } });
  }
  // Грубое состояние питомца для списка онлайн у коллег (уходит в /hello раз в минуту)
  function coarseAct(name, label) {
    try { if (localStorage.getItem('away:' + label)) return 'в гостях'; } catch (_) { /* без памяти */ }
    const n = name || '';
    if (/^(sleep|loaf|lie|cuddleGo)$/.test(n)) return 'спит';
    if (/^(eat|bowlEat|drink|bowlCarry|beg)$/.test(n)) return 'ест';
    if (/^(tag|ball|kick|mouse|relay|hide|race|chase|disco|dance|pounce|found)/.test(n)) return 'играет';
    if (n === 'sick' || n === 'sneeze') return 'болеет';
    if (/^(walk|run|soar|hop|zoomies|fly)$/.test(n)) return 'гуляет';
    if (n === 'chat') return 'болтает';
    return 'сидит';
  }
  // ---------- групповое фото ----------
  // Портал раз в день в /hello отдаёт group:<день> в окне из нескольких минут; старший у каждого, кто онлайн,
  // просит всех позировать (pose-all), собирает кадры своих окон (photo-req/photo-res с group) в одну полосу
  // и шлёт в альбом с group — на странице сети такие кадры одного дня лежат в один ряд.
  let groupDay = '', groupParts = null, myName = '';
  try { groupDay = localStorage.getItem('group:day') || ''; } catch (_) { /* без памяти */ }
  function groupPhoto(day) {
    if (GUEST || away || !albumOn()) return;
    groupDay = day; try { localStorage.setItem('group:day', day); } catch (_) { /* без памяти */ }
    say(pick(['Общее фото! Все сюда!', 'Групповое фото — улыбаемся!', 'Фото на память со всеми!']), 2600); focus(8000);
    if (T && T.event) T.event.emit('pose-all', { ms: 4500 }).catch(() => {});
    start('pose', { pose: 'sit', dur: 4500, watch: false, mod: (T_) => { T_.happy = 1; T_.tail = 25; T_.headTilt = 6; T_.yaw = 0; } });
    setTimeout(() => {
      groupParts = new Map();
      const labels = [...friends.values()].filter(f => now() - f.t < 3000).map(f => f.label);
      for (const l of labels) if (T && T.event) T.event.emit('photo-req', { to: l, from: PET.label, group: 1 }).catch(() => {});
      setTimeout(() => {
        fx('zzz', '📸', 0, -40, 1500);
        const parts = [{ label: PET.label, png: snapshotPng(), name: NAME }, ...[...groupParts.values()].map(q => ({ label: q.from, png: q.png, name: q.name || '' }))].sort((a, b) => a.label.localeCompare(b.label));
        groupParts = null;
        const n = parts.length, off = document.createElement('canvas'); off.width = 200 * n + 20; off.height = 230; const g = off.getContext('2d');
        const gr = g.createLinearGradient(0, 0, 0, 230); gr.addColorStop(0, '#f7efe3'); gr.addColorStop(1, '#e9d9c3'); g.fillStyle = gr; g.fillRect(0, 0, off.width, 230);
        g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, 196, off.width, 34);
        let left = n;
        const fin = () => { g.fillStyle = '#3a2a1a'; g.font = '600 14px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`${parts.map(p => p.name).filter(Boolean).join(', ')}${myName ? ' (' + myName + ')' : ''}`, off.width / 2, 213, off.width - 20); albumUpload(off.toDataURL('image/png'), `Групповое фото ${day.slice(8, 10)}.${day.slice(5, 7)}: ${parts.map(p => p.name).filter(Boolean).join(', ')}`, day); };
        parts.forEach((p, i) => { const im = new Image(); im.onload = () => { g.drawImage(im, 10 + i * 200, 14, 200, 164); if (--left === 0) fin(); }; im.onerror = () => { if (--left === 0) fin(); }; im.src = p.png; });
      }, 1600);
    }, 1400);
  }
  // ---------- ночёвка гостя ----------
  // Гостю пора домой, а у хозяина ночь или тихие часы, и с кем-то из хозяев он дружит по сети — остаётся
  // спать до утра (или до конца тихих часов), хозяину гостя уходит /send stay, чтобы его питомец не
  // «вернулся» раньше времени.
  let overnight = false;
  function guestFriendHere() { try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('nrel:') && k.endsWith('|' + PET.owner + '|' + NAME) && (+localStorage.getItem(k) || 0) >= 4) return true; } } catch (_) { /* без памяти */ } return false; }
  function quietEnd() {                            // когда кончаются ночь или тихие часы
    const d = new Date(); let to = ''; try { to = localStorage.getItem('quiet:to') || ''; } catch (_) { /* без памяти */ }
    const at = (h, m) => { const t = new Date(d); t.setHours(h, m, 0, 0); if (t <= d) t.setDate(t.getDate() + 1); return t.getTime(); };
    const ends = [];
    if (night()) ends.push(at(7, 0));
    if (to && /^\d{1,2}:\d{2}$/.test(to) && quietSched()) { const [h, m] = to.split(':').map(Number); ends.push(at(h, m)); }
    const e = ends.length ? Math.max(...ends) : Date.now() + 3600e3;
    return Math.min(e, Date.now() + 10 * 3600e3);
  }
  function overnightStay() {
    overnight = true; const until = quietEnd();
    say(pick(['Поздно уже… Можно я у вас переночую?', 'Темно на улице. Останусь до утра?', 'Тс-с… я тут посплю, ладно?']), 3200);
    if (T && T.event) T.event.emit('guest-stay', { name: NAME, owner: PET.owner, until }).catch(() => {});
    setTimeout(() => acts.sleep(Math.max(60000, until - Date.now() - 20000)), 3400);
    setTimeout(() => { guestLeaving = false; guestLeave(); }, Math.max(90000, until - Date.now()));   // overnight остаётся true: второй ночёвки не будет, гость уходит
  }
  // ---------- ответный подарок ----------
  // Подарок от хозяина друга по сети — через час-три питомец сам отнесёт что-нибудь в ответ (старший).
  function friendOwner(owner) { try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('nrel:') && k.split('|')[1] === owner && (+localStorage.getItem(k) || 0) >= 4) return true; } } catch (_) { /* без памяти */ } return false; }
  function scheduleGiftBack(client, owner) {
    if (!client || !owner || !friendOwner(owner)) return;
    try { if (localStorage.getItem('giftback:' + client)) return; localStorage.setItem('giftback:' + client, JSON.stringify({ at: Date.now() + rnd(60, 180) * 60000, owner, born: Date.now() })); } catch (_) { /* без памяти */ }
  }
  async function giftBackTick() {
    if (DEMO || GUEST || !invoke || PET.label !== leaderLabel() || away || busy()) return;
    let keys = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('giftback:')) keys.push(k); } } catch (_) { return; }
    for (const k of keys) {
      let g = null; try { g = JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { /* битая запись */ }
      if (!g || Date.now() < g.at) continue;
      if (Date.now() - (g.born || 0) > 86400e3) { try { localStorage.removeItem(k); } catch (_) { /* без памяти */ } continue; }
      const what = pick(['flowers', 'candy', 'balloons', 'cake', 'teddy', 'pie', 'ball', 'yarn', 'bubbles']);
      try {
        if (!me) me = await invoke('whoami');
        await portal('POST', '/send', { from: me.client, to: k.slice(9), kind: 'gift', payload: { what, msg: `В ответ от ${NAME}` } });
        try { localStorage.removeItem(k); } catch (_) { /* без памяти */ }
        say(`Отнёс{|ла} ответный подарок для ${g.owner}`, 3000); hearts(2); achCount('gift');
      } catch (e) { g.at = Date.now() + 30 * 60000; try { localStorage.setItem(k, JSON.stringify(g)); } catch (_) { /* без памяти */ } }   // адресат не в сети — через полчаса
      return;
    }
  }
  if (!DEMO && invoke) setInterval(giftBackTick, 60000);
  // ---------- дружба по сети ----------
  // Счёт с чужим питомцем: nrel:<метка>|<хозяин>|<имя гостя>, хранится у принимающей стороны; игры с гостем
  // дают те же очки, что и свои (relAdd('guest') сюда). С 4 — друг по сети: старший шлёт /send friend хозяину
  // гостя, и там питомец с этим именем тоже записывает дружбу. Друг по сети: в гости к нему чаще и дольше,
  // а когда он приходит — встречают у края экрана.
  const nrelKey = (owner, name) => 'nrel:' + PET.label + '|' + owner + '|' + name;
  function nrelGet(owner, name) { try { return +localStorage.getItem(nrelKey(owner, name)) || 0; } catch (_) { return 0; } }
  function nrelSet(owner, name, v) { try { localStorage.setItem(nrelKey(owner, name), String(v)); } catch (_) { /* без памяти */ } }
  const isNetFriend = (owner, name) => nrelGet(owner, name) >= 4;
  function netFriends() {                          // [{owner, name, v}] этого питомца, сильнее — первыми
    const out = [];
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!k || !k.startsWith('nrel:' + PET.label + '|')) continue; const parts = k.slice(5).split('|'); const v = +localStorage.getItem(k) || 0; if (v >= 4 && parts.length >= 3) out.push({ owner: parts[1], name: parts.slice(2).join('|'), v }); } } catch (_) { /* без памяти */ }
    return out.sort((a, b) => b.v - a.v);
  }
  function nrelAdd(g, d) {
    if (!g || !g.owner || !g.name || GUEST || DEMO) return;
    const before = nrelGet(g.owner, g.name), after = Math.max(-10, Math.min(20, before + d)); nrelSet(g.owner, g.name, after);
    if (before < 4 && after >= 4) { setTimeout(() => { say(`${g.name} — мой друг по сети!`, 2800); hearts(3); }, 800); if (T && T.event) T.event.emit('net-friend', { label: PET.label, pet: NAME, guest: g.name, owner: g.owner }).catch(() => {}); }
  }
  function meetGuest(q) {                          // друг по сети идёт в гости — встретить у края, откуда он выходит
    const s = S(), m = monAt(cur.x, cur.y) || mons[0]; if (!m) return;
    focus(20000); say(pick([`${q.name} идёт! Встречу`, `Это же ${q.name}!`, 'Друг пришёл!']), 2000);
    const [tx, ty] = clampPos(m.x + 30 * s, floorY(m), m);
    const o = { name: 'meetGo', dur: 12000, after: () => {
      faceT = -1;
      start('meetWait', { pose: 'sit', dur: 20000, watch: false, mod: (T_, q2) => { T_.ear = -.3; T_.tail = 30; T_.headTilt = Math.sin(q2 * 4) * 6; },
        tick: () => { const g = friends.get('guest'); if (g && now() - g.t < 2000 && Math.abs(g.x - x) / s < 170) { A = null; faceT = g.x > x ? 1 : -1; say(pick([`${q.name}! Привет!`, 'Дружище!', 'Наконец-то!']), 2400); hearts(3); nrelAdd(g, 1); acts.sit(3000); } },
        after: () => acts.sit(2000) });
    } };
    if (FLY) soarTo(tx, ty, o.after, o); else moveTo(tx, ty, 260 * SPD, o);
  }
  // ---------- мяч между экранами ----------
  // Мяч, влетевший в край на скорости (goal), в половине случаев улетает к коллеге: старший шлёт /send ball
  // и прячет мяч; у получателя он выкатывается из противоположного края, питомцы отбивают. Не больше трёх
  // перелётов и не чаще раза в полторы минуты; возвращается к тому, кто послал.
  let netBall = null, lastNetBall = -1e9, lastPairWith = '';
  function pickPeer(list) {                        // хозяева друзей по сети — втрое вероятнее
    if (!list || !list.length) return null;
    const nf = netFriends(), w = list.map(p => nf.some(f => f.owner === p.name) ? 3 : 1);
    let v = Math.random() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < list.length; i++) if ((v -= w[i]) < 0) return list[i];
    return list[list.length - 1];
  }
  async function netBallSend(g) {
    if (DEMO || GUEST || !invoke || away || !visitsOn || dnd() || PET.label !== leaderLabel()) return false;
    const hops = netBall ? (netBall.hops || 0) + 1 : 1; if (hops > 3 || now() - lastNetBall < 90000) return false;
    try {
      if (!me) me = await invoke('whoami');
      let to = null;
      if (netBall && netBall.fromClient) to = { client: netBall.fromClient, name: netBall.owner || 'коллега' };
      else { const list = await portal('GET', '/peers?client=' + encodeURIComponent(me.client)); to = pickPeer(list); }
      if (!to) return false;
      lastNetBall = now();
      await portal('POST', '/send', { from: me.client, to: to.client, kind: 'ball', payload: { pet: NAME, side: g.side, hops } });
      await invoke('prop_hide', { kind: 'ball' }); netBall = null;
      say(pick([`Улетел к ${to.name}!`, `Мяч у ${to.name}!`, 'Ого, за экран!']), 2600); achCount('netball');
      return true;
    } catch (e) { console.error('мяч по сети', e); return false; }
  }
  function netBallReceive(p, fromClient) {
    const s = S(), m = monAt(x + CX * s, y + GY * s) || mons[0]; if (!m || !invoke) return;
    netBall = { hops: +p.hops || 1, fromClient, owner: p.owner || 'коллега', pet: p.pet || 'питомец' };
    const fromLeft = p.side !== 'left';           // ушёл вправо у отправителя — выкатывается слева у нас
    const bx = fromLeft ? m.x + 24 * s : m.x + m.w - 24 * s, by = m.y + m.h - 30 * s;
    say(`⚽ Мяч от ${netBall.pet} (${netBall.owner})! Отбиваем!`, 3000); mark('!'); focus(8000);
    invoke('prop_show', { kind: 'ball', x: Math.round(bx), y: Math.round(by) }).then(() => {
      setTimeout(() => { if (T && T.event) T.event.emit('prop-kick', { kind: 'ball', vx: (fromLeft ? 1 : -1) * 720 * s, vy: -260 * s }).catch(() => {}); lastBall = now(); ballRounds = 6; if (!busy()) ballWait(null); }, 700);
    }).catch(e => console.error('мяч по сети', e));
  }
  let lastGreet = new Map();
  function friendNear(maxd) {
    const s = S(); let best = null, bd = 1e9;
    for (const f of friends.values()) { if (now() - f.t > 3000) continue; const d = Math.hypot(f.x - x, f.y - y) / s * (isRival(f.label) ? 2.5 : isFriend(f.label) ? .5 : 1); if (d < bd && d < maxd * 3) { bd = d; best = f; } }
    return best;
  }
  function visit(f) {
    if (!f) return acts.walk();
    if (BIRD) return acts.ride();
    if ((HAM || RAB) && f.sp === 'cat') return acts.sit();      // добыча к коту сама не ходит
    const s = S(), side = f.x > x ? -1 : 1, [tx, ty] = clampPos(f.x + side * 110 * s, f.y);
    moveTo(tx, ty, DOG ? 140 : 70, { name: 'walk', after: () => { faceT = f.x > x ? 1 : -1; chatStart(f); } });
  }
  let lastReact = -1e9, lastFlee = -1e9, lastJealous = -1e9, lastSteal = -1e9, lastSickReact = -1e9;
  function reactToFriends() {
    if (now() < focusUntil) return;
    const s = S();
    // ревность: друга гладят рядом — подойти и вклиниться
    if (now() - lastJealous > 60000 && A && ['sit', 'look', 'walk', 'loaf', 'lie', 'pant', 'sniff', 'sitUp'].includes(A.name)) {
      for (const f of friends.values()) {
        if (now() - f.t > 1500 || f.act !== 'pet' || Math.hypot(f.x - x, f.y - y) / s > 450) continue;
        lastJealous = now();
        const side = f.x > x ? -1 : 1, [tx, ty] = clampPos(f.x + side * 70 * s, f.y);
        say(pick(['А меня?', 'Эй! А я?', 'Меня тоже!', 'Подвинься']), 1500);
        return moveTo(tx, ty, 220 * SPD, { after: () => { faceT = -side; start('sit', { pose: 'sit', dur: 6000, watch: true, mod: (T_, q) => { T_.headTilt = side * 10; T_.tilt = -side * 6 * Math.min(1, q); T_.happy = q > 1 ? 1 : 0; } }); if (Math.random() < .5) setTimeout(() => say(pick(['Погладь и меня', 'Я тоже пушист{ый|ая}', 'Ну-у…']), 1600), 1500); } });
      }
    }
    // кража еды: щенок видит, что кот ест — крадётся к миске
    if (DOG && now() - lastSteal > 180000 && A && ['sit', 'look', 'walk', 'lie', 'pant', 'sniff'].includes(A.name)) {
      for (const f of friends.values()) {
        if (now() - f.t > 1500 || f.sp !== 'cat' || f.act !== 'eat' || Math.hypot(f.x - x, f.y - y) / s > 600) continue;
        lastSteal = now();
        const side = f.x > x ? -1 : 1, [tx, ty] = clampPos(f.x + side * 60 * s, f.y);
        say(pick(['Что это там вкусное?', '*крадётся к миске*', 'Ням?']), 1400);
        return moveTo(tx, ty, 110, { name: 'sniff', pose: 'sniff', after: () => {
          if (T && T.event) T.event.emit('pet-play', { to: f.label, from: PET.label, kind: 'steal' }).catch(() => {});
          say(pick(['Ам! Моё!', 'Хрум-хрум!', 'Спасибо, кот!']), 1200); play('bark', false, 1);
          start('eat', { pose: 'eat', dur: 1500, mod: chew, after: () => { const away = side, [tx2, ty2] = clampPos(x + away * 500 * s, y); moveTo(tx2, ty2, 340, { name: 'tagRun', dur: 6000, after: () => acts.pant() }); } });
        } });
      }
    }
    if ((HAM || BIRD || RAB) && now() - lastFlee > 4000 && A && !['soar', 'ride', 'hang', 'fly'].includes(A.name)) {
      for (const f of friends.values()) {
        if (now() - f.t > 1500 || f.sp !== 'cat' || !['crouch', 'leap'].includes(f.act)) continue;
        if (Math.hypot(f.x - x, f.y - y) / s < 240) { lastFlee = now(); return flee({ x: f.x + CX * s }); }
      }
    }
    if (A && A.name === 'sit' && !BIRD) for (const f of friends.values()) if (f.on === PET.label && now() - f.t < 1000 && !A.noticed) { A.noticed = 1; say(pick(['…', 'Эй, там наверху!', 'Мне тяжело']), 1600); }
    if (now() - lastReact < 15000 || !A || !['sit', 'look', 'walk', 'loaf', 'pant', 'sniff', 'lie', 'sitUp', 'groom', 'wash', 'scratch', 'stretch', 'preen'].includes(A.name)) return;   // реагируем из любой праздной позы
    for (const f of friends.values()) {
      if (now() - f.t > 2000) continue;
      const d = Math.hypot(f.x - x, f.y - y) / s;
      if (CAT && ['hamster', 'bird', 'rabbit'].includes(f.sp) && d < 300 && d > 60 && !['soar', 'ride'].includes(f.act) && Math.random() < .5) {
        lastReact = now(); faceT = f.x > x ? 1 : -1; const tx = f.x, ty = f.y;
        say(pick(['Добыча!', 'Ох, кто это тут…', '*охотится*']), 1400);
        return start('crouch', { pose: 'crouch', dur: 1600, rate: 6, mod: (T, q) => { if (q > .7) T.tilt += Math.sin(q * 26) * 2.5; },
          after: () => leap(...clampPos(tx - (f.x > x ? 20 : -20) * s, ty), () => { say(pick(['Упусти{л|ла}!', 'Хм, быстрый…', 'Эх!']), 1400); acts.sit(3000); }) });
      }
      if (f.act === 'sick' && d < 220 && !isFriend(f.label) && !parentsOf.includes(f.label) && now() - lastSickReact > 600000) {   // чужой чихает — отойти
        lastSickReact = now(); lastReact = now(); faceT = f.x > x ? 1 : -1; say(pick(['Не чихай на меня!', 'Болеешь? Я подальше', 'Выздоравливай… там']), 1800);
        const aw = f.x > x ? -1 : 1, [tx2, ty2] = clampPos(x + aw * 220 * s, y); return moveTo(tx2, ty2, 160 * SPD, { after: () => acts.sit(3000) });
      }
      if (isRival(f.label) && d < 150 && f.label !== 'guest') { lastReact = now(); faceT = f.x > x ? 1 : -1; if (CAT && Math.random() < .55) { relAdd(f.label, -1); return hiss({ x: f.x + CX * s }); } if (DOG) play('bark', false, 1); say(pick(['Опять ты…', 'Отойди', 'Моё место']), 1600); return acts.sit(4000); }
      if (isFriend(f.label) && d < 220 && now() - (lastGreet.get(f.label) || -1e9) > 600000) { lastGreet.set(f.label, now()); faceT = f.x > x ? 1 : -1; say(pick([`Привет, ${f.name || 'дружище'}!`, 'Дружище!', 'О, ты тут!']), 1600); hearts(1); return acts.sit(2500); }
      if (CAT && f.sp === 'dog' && d < 130) { lastReact = now(); if (Math.random() < .55) return hiss({ x: f.x + CX * s }); faceT = f.x > x ? 1 : -1; say(pick(['…', 'Не подходи.', 'Мрр?']), 1500); return acts.sit(4000); }
      if (DOG && f.sp === 'cat' && f.act === 'arch' && d < 200) { lastReact = now(); say('Ой! Ухожу!', 1400); play('whine', true); const away = f.x > x ? -1 : 1, [tx, ty] = clampPos(x + away * 500 * s, y); return moveTo(tx, ty, 330, { after: () => acts.sit(3000) }); }
    }
  }

  // ---------- кадр поведения ----------
  function step(dt, t) {
    const s = S(), c = myCenter();
    look.x = clamp((cur.x - c.x) / s / 200, -1, 1); look.y = clamp((cur.y - (y + (GY - 90) * s)) / s / 200, -1, 1);
    if (pressed && !dragging && Math.hypot(cur.x - pressed.x, cur.y - pressed.y) > 6 * s) {
      dragging = true; canvas.classList.add('grab');
      tug = !BIRD && !HAM && Math.random() < .3 ? { dir: cur.x > pressed.x ? -1 : 1 } : null;
      if (tug) { setTimeout(() => say(pick(['Не отдам!', 'Пусти-и!', 'Рррр… моё место!', 'Не пойду!']), 1400), 300); }
      start('hang', { pose: 'hang', dur: 1e9, rate: 10, mod: FLY ? (T, q, tt) => { T.wing = 1; T.wingA = 50 * Math.sin(tt * 2 * Math.PI * 9); } : null }); lift = 0;
      say(pick(TX().pick), 1000);
    }
    if (dragging) {
      if (!btn && now() - pressed.t > 150) return release();
      const g = info ? toCanvas(info.top.x, info.top.y) : { x: CX, y: 40 };
      if (tug) {                                 // упирается: отстаёт от курсора и тянет назад
        const wantX = cur.x - g.x * s, wantY = cur.y - g.y * s;
        x += (wantX - tug.dir * 55 * s - x) * Math.min(1, dt * 4); y += (wantY - y) * Math.min(1, dt * 6);
        swingAng = clamp(tug.dir * 18 + Math.sin(now() / 90) * 4, -35, 35);
        return;
      }
      swingV += (-40 * swingAng - 4 * swingV - curV.x / s * .12) * dt; swingAng = clamp(swingAng + swingV * dt * 10, -35, 35);
      x = cur.x - g.x * s; y = cur.y - g.y * s; return;
    }
    swingAng *= .85;
    if (A && A.name === 'fly') {                 // брошен — летит по параболе до пола
      const m = monAt(x + CX * s, y + GY * s), fl = m ? floorY(m) : y;
      A.vy += 2600 * s * dt; x += A.vx * dt; y += A.vy * dt; tilt = clamp(A.vx / s * .02, -25, 25);
      if (m && (x < m.x - 45 * s || x > m.x + m.w - (W - 45) * s)) { A.vx *= -.5; x = clampPos(x, y, m)[0]; }
      if (y >= fl) { y = fl; tilt = 0; const hard = A.vy / s > 900; say(hard ? TX().landHard : pick(['Хоп!', 'Приземли{лся|лась}!']), 1200); land(() => (CAT ? acts.groom() : HAM || RAB ? acts.wash() : acts.sit(2500))); }
      return;
    }
    if (!A) next();
    if (!A) start('sit', { pose: 'sit', dur: 1500, watch: true });   // next() мог только запланировать дело (эстафета, трюк через setTimeout) — кадр без действия ронял step()
    const a = A;
    if (a.tick) a.tick(dt, (now() - a.t0) / 1000);
    if ((CAT || DOG) && ['sit', 'look', 'walk', 'sniff'].includes(a.name) && now() - lastPounce > 9000) {
      const d = Math.hypot(cur.x - c.x, cur.y - c.y) / s;
      if (d < 260 && d > 50 && curSpeed / s > 1400 && Math.random() < .5) { lastPounce = now(); return pounceAt(cur.x, cur.y); }
    }
    if (a.name === 'chase') {
      if (now() > chaseUntil) { A = null; lift = 0; say(TX().tired, 1800); return DOG ? acts.pant() : acts.sit(4000); }
      const [tx, ty] = nearPoint(cur.x, cur.y, BIRD ? 45 : 30), dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy);
      if (BIRD) { if (d < 30 * s && now() - lastPounce > 2500) { lastPounce = now(); say(pick(['Клюк!', 'Пойма{л|ла}!', 'Кррр!']), 800); } }
      else if (d < 40 * s && now() - lastPounce > 1300) return pounceAt(cur.x, cur.y);
      const v = Math.min(d, (DOG ? 320 : FLY ? 340 : HAM ? 260 : 300) * s * dt);
      if (d > 1) { x += dx / d * v; y += dy / d * v; }
      if (Math.abs(dx) > 4 * s) faceT = dx > 0 ? 1 : -1;
      if (FLY) { poseName = 'fly'; gw = 0; return; }
      moveGait(v / s, dt, 'run');
      poseName = d > 10 * s ? 'walk' : (DOG ? 'bow' : HAM ? 'up' : 'crouch');
      return;
    }
    if (a.follow) [a.tx, a.ty] = nearPoint(cur.x, cur.y, a.follow);
    if (a.rideOf) { const f = friends.get(a.rideOf); if (f && f.top) [a.tx, a.ty] = rideTarget(f); }
    if (a.ballOf) {                              // к мячу: цель — где он сейчас
      if (!ballAlive()) { A = null; return acts.sit(2000); }
      const side = myCenter().x < ball.x ? -1 : 1;
      [a.tx, a.ty] = clampPos(ball.x - CX * s + side * 42 * s, ball.y - (GY - 20) * s);
      if (a.name === 'soar') a.d0 = Math.max(a.d0 || 1, Math.hypot(a.tx - x, a.ty - y));
    }
    if (a.chaseOf) {                             // догонялки: цель — где сейчас убегающий
      const f = friends.get(a.chaseOf);
      if (!f || now() - f.t > 2500) { A = null; return acts.sit(3000); }
      a.tx = f.x; a.ty = f.y; a.d0 = Math.max(a.d0 || 1, Math.hypot(f.x - x, f.y - y));
      if (now() - a.t0 > 1200 && Math.hypot(f.x - x, f.y - y) / s < 75) { const o = a.other, r = a.round; A = null; return tagged(o, r); }   // секунда форы убегающему
    }
    if (a.name === 'ride') {
      const f = friends.get(a.friend);
      if (!f || !f.top || now() - f.t > 2500) { A = null; return acts.soar(); }
      const [tx, ty] = rideTarget(f), k = 1 - Math.exp(-14 * dt);
      x += (tx - x) * k; y += (ty - y) * k; lift = 0;
    }
    if (a.tx !== undefined && a.name !== 'leap') {
      const dx = a.tx - x, dy = a.ty - y, d = Math.hypot(dx, dy);
      const vt = Math.min(a.speed * s, Math.sqrt(2 * 700 * s * d));
      vel += clamp(vt - vel, -1200 * s * dt, 900 * s * dt);
      const st = Math.min(d, vel * dt);
      if (Math.abs(dx) > 4 * s) faceT = dx > 0 ? 1 : -1;
      if (d < 1.5 * s) { x = a.tx; y = a.ty; vel = 0; lift = 0; const f = a.after; A = null; return f ? f() : (Math.random() < .6 ? acts.sit() : next()); }
      x += dx / d * st; y += dy / d * st;
      if (a.name === 'soar') { const pr = clamp(1 - d / a.d0, 0, 1); lift = Math.sin(Math.PI * pr) * Math.min(55, a.d0 / s * .15); gw = 0; }
      else moveGait(st / s, dt, a.speed > 150 ? 'run' : 'walk');
    } else if (a.name !== 'spin' && a.name !== 'wheel') { vel = 0; gw = Math.max(0, gw - dt * 5); }
    if (a.name === 'sleep' && now() - (a.zzz || 0) > 1000) { a.zzz = now(); fx('zzz', pick(['z', 'Z', 'z']), 26, -14, 2400); if ((CAT || DOG || KUZYA) && Math.random() < .06) play('snore', false); }
    if (now() - a.t0 > a.dur) {
      const f = a.after; A = null;
      if (a.exit) a.exit();
      if (f) return f();
      if (a.name === 'sleep') return wake();
      if (a.name !== 'sit' && Math.random() < .45) return acts.sit(rnd(2000, 5000));
      next();
    }
  }
  function moveGait(distCss, dt, type) { gait = type; phase = (phase + distCss / GAITS[gait].stride) % 1; gw = Math.min(1, gw + dt * 6); }
  function release() {
    dragging = false; pressed = null; canvas.classList.remove('grab');
    if (tug) { tug = null; swingAng = 0; say(pick(['Ха! Отпустил{|а}!', 'Победа за мной', 'Так и знал{|а}']), 1400); return land(() => acts.sit(2500)); }
    const sp = Math.hypot(throwV.x, throwV.y) / S(), m = monAt(x + CX * S(), y + GY * S());
    swingAng = 0;
    if (FLY) { say(sp > 700 ? TX().thrown : TX().drop, 900); const [tx, ty] = clampPos(x + clamp(throwV.x, -1500, 1500) * .45, m ? floorY(m) : y); return soarTo(tx, ty, () => acts.sit(3000)); }
    if (sp > 700 || (m && y < floorY(m) - 5)) {
      start('fly', { pose: 'fall', dur: 1e9, vx: clamp(throwV.x, -2500 * S(), 2500 * S()), vy: clamp(throwV.y, -2000 * S(), 1500 * S()), rate: 10 });
      say(sp > 700 ? TX().thrown : TX().drop, 900);
    } else land(() => (CAT ? acts.groom() : HAM || RAB ? acts.wash() : acts.sit(2500)));
  }
  canvas.addEventListener('pointerdown', e => { if (e.button !== 0) return; canvas.setPointerCapture(e.pointerId); btnJS = true; pressed = { x: cur.x, y: cur.y, t: now() }; });
  canvas.addEventListener('pointerup', e => { if (e.button !== 0) return; btnJS = false; if (dragging) return release(); if (pressed) { pressed = null; pet(); } });
  canvas.addEventListener('pointercancel', () => { btnJS = false; if (dragging) release(); });
  canvas.addEventListener('lostpointercapture', () => { btnJS = false; });
  canvas.addEventListener('dblclick', () => { if (!dragging) acts.voice(true); });
  canvas.addEventListener('contextmenu', e => { e.preventDefault(); if (invoke && !DEMO) invoke('open_settings', { label: PET.label }).catch(() => acts.voice(true)); });

  function hitRect() {
    if (!info) return { l: 0, t: 0, r: 0, b: 0 };
    const a = toCanvas(info.bbox.l, info.bbox.t), b = toCanvas(info.bbox.r, info.bbox.b);
    return { l: Math.min(a.x, b.x), r: Math.max(a.x, b.x), t: Math.min(a.y, b.y), b: Math.max(a.y, b.y) };
  }
  function tickFace(dt) {
    const n = now();
    if (n > blinkT) { blinkK = 1; blinkT = n + rnd(2200, 6000); }
    blinkK = Math.max(0, blinkK - dt * 9);
    slowBlink = Math.max(0, slowBlink - dt * .7);
    if (n > earTwT) { earTw = 1; earTwT = n + rnd(2500, 9000); }
    earTw = Math.max(0, earTw - dt * 5);
    face += (faceT - face) * Math.min(1, dt * 9);
  }

  // ---------- превью (браузер, окно настроек) ----------
  if (DEMO) {
    poseName = hash.get('pose') || 'sit';
    if (!P[poseName]) poseName = 'sit';
    if (hash.get('set')) { P[poseName] = Object.assign({}, P[poseName]); for (const kv of hash.get('set').split(',')) { const [k, v] = kv.split(':'); P[poseName][k] = isNaN(+v) ? v : +v; } }
    Object.assign(C, P[poseName]);
    const mv = hash.get('move');
    face = faceT = hash.get('dir') === '-1' ? -1 : 1;
    if (hash.get('say')) say(hash.get('say'), 1e9);
    if (hash.get('bowl')) bowlOn = true;
    if (hash.get('hat')) HOL = { hat: hash.get('hat'), snow: hash.get('hat') === 'santa' };
    let t = 0;
    window.__act = (n) => { if (acts[n]) { acts[n](); if (A) { A.dur = 1e9; A.tx = undefined; A.after = null; } } };
    window.__step = (n = 1, dt = 1 / 60) => {
      for (let i = 0; i < n; i++) { t += dt; tickFace(dt); if (mv) { gait = mv; moveGait((mv === 'run' ? 260 : 70) * dt, dt, mv); } if (A && A.tick) A.tick(dt, t); frameParams(dt, t); }
      render(t); placeBubble();
    };
    blinkT = 1e15; earTwT = 1e15;
    window.addEventListener('sprite-load', () => window.__step(1, 0));
    if (hash.get('act')) window.__act(hash.get('act'));
    window.__step(+(hash.get('n') || 90));
    if (hash.has('anim')) { blinkT = 0; earTwT = 0; let lt = now(); const tick = () => { const n = now(); window.__step(1, Math.min(.05, (n - lt) / 1000)); lt = n; requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
    return;
  }

  // ---------- главный цикл ----------
  async function refreshScreens() { try { const r = await invoke('screens'); mons = r.monitors; sound = r.sound; } catch (e) { console.error(e); } }
  let last = now(), sentX = null, sentY = null, ignoreSent = null, tt = 0, lastEmit = 0;
  let inflight = false, pending = {}, lastResp = now();
  function sendFrame(args) {
    Object.assign(pending, args);
    if (inflight) return;
    inflight = true; const a = pending; pending = {};
    invoke('frame', a).then(r => {
      const n = now(), dt = Math.max(.008, (n - lastResp) / 1000); lastResp = n;
      curPrev = cur; cur = { x: r.cx, y: r.cy }; btn = MAC ? btnJS : r.btn;
      const vx = (cur.x - curPrev.x) / dt, vy = (cur.y - curPrev.y) / dt;
      curV = { x: curV.x * .6 + vx * .4, y: curV.y * .6 + vy * .4 };
      throwV = { x: throwV.x * .5 + vx * .5, y: throwV.y * .5 + vy * .5 };
      curSpeed = curSpeed * .8 + Math.hypot(vx, vy) * .2;
      if (!inited) { x = r.wx; y = r.wy; sentX = r.wx; sentY = r.wy; inited = true; if (!DEMO && !GUEST && awayRestore()) return; if (!DEMO && !GUEST) invoke('pet_visible', { label: PET.label, on: true }).catch(() => {}); acts.sit(1500); say(TX().voice[0], 1200); setTimeout(() => { if (!greeted && A && A.name === 'sit' && !PET.guest) { greeted = true; cheer(greeting()); } }, 4000); }
    }).catch(e => console.error(e)).finally(() => { inflight = false; if (Object.keys(pending).length) sendFrame({}); });
  }
  function loop() {
    const n = now(), dt = Math.min(.05, (n - last) / 1000); last = n; tt += dt;
    const args = {};
    if (inited && mons.length) {
      try { idleCheck(); pomoTick(); step(dt, tt); reactToFriends(); } catch (e) { console.error(e); A = null; }
      tickFace(dt);
      frameParams(dt, tt);
      const s = S(), rx = Math.round(x), ry = Math.round(y);
      if (rx !== sentX || ry !== sentY) { args.x = sentX = rx; args.y = sentY = ry; }
      offX = (x - rx) / s; offY = (y - ry) / s;
      render(tt); placeBubble();
      const lx = (cur.x - sentX) / s, ly = (cur.y - sentY) / s, r = hitRect();
      const over = lx >= r.l && lx <= r.r && ly >= r.t && ly <= r.b;
      const overNote = noteOn && noteEl && (() => { const r = noteEl.getBoundingClientRect(); return lx >= r.left && lx <= r.right && ly >= r.top && ly <= r.bottom; })();   // карточка записки ловит курсор (кнопка ✕)
      const ignore = !(over || overNote || dragging || pressed);
      if (ignore !== ignoreSent) args.ignore = ignoreSent = ignore;
      if (n - lastEmit > 150 && T.event) {
        lastEmit = n; const h = info ? toCanvas(info.top.x, info.top.y) : { x: CX, y: 40 };
        T.event.emit('pet-pos', { label: PET.label, sp: SP, name: NAME, owner: PET.owner || '', color: PET.color, sick: GUEST ? !!guestSick : sick(), x, y, act: A && A.name, on: A && A.name === 'ride' ? A.friend : null, top: { x: x + h.x * s, y: y + h.y * s }, foot: { x: x + CX * s, y: y + GY * s }, baby: isBaby() }).catch(() => {});
      }
    }
    sendFrame(args);
    requestAnimationFrame(loop);
  }
  if (T.event) {
    T.event.listen('pet', e => {
      if (dragging) return;
      const c = e.payload;
      if (c === 'photo') return photo();
      if (c === 'pomodoro') { if (PET.label === leaderLabel()) pomodoro(!pomo); return; }
      if (c === 'hide') { hideParty(); return; }
      if (c === 'disco') { if (PET.label === leaderLabel()) discoAll(); disco(''); return; }
      if (c === 'shell') { if (PET.label === leaderLabel()) shellGame(); return; }
      if (c === 'come') come(); else if (c === 'feed') feed(); else if (typeof c === 'string' && c.startsWith('feed_')) feed(c.slice(5)); else if (c === 'play') playMode(); else if (c === 'sleep') acts.sleep(90000); else if (c === 'voice') acts.voice(true); else if (c === 'cheer') cheer();
    });
    T.event.listen('sound', e => { sound = !!e.payload; });
    T.event.listen('call', e => callMode(!!e.payload));
    T.event.listen('calendar', e => { calUrl = e.payload || ''; calEvents = []; calendarFetch(); });
    T.event.listen('visits', e => { visitsOn = !!e.payload; });
    T.event.listen('recall', () => { if (away) comeBack(); else invoke('pet_visible', { label: PET.label, on: true }).catch(() => {}); });
    T.event.listen('visit-to', e => { const q = e.payload || {}; if (q.label !== PET.label || GUEST) return; if (away) return say('Я и так в гостях', 1600); goVisit({ client: q.to, name: q.name || 'коллега' }, true, q.msg || ''); });
    T.event.listen('caldav', () => { invoke('caldav_get').then(c => { calDav = !!(c && c.user && c.has_pass); calEvents = []; calendarFetch(); }).catch(() => {}); });
    T.event.listen('pet-look', e => {
      // событие слышат все окна — берём только своё, иначе смена окраса одного красит всех
      if (!e.payload || e.payload.label !== PET.label) return;
      try { const lk = e.payload && e.payload.look ? JSON.parse(e.payload.look) : null; const oldLk = PET.look && PET.look !== 'litter' ? JSON.parse(PET.look) : {}; if (lk && typeof lk.mon === 'number' && lk.mon !== oldLk.mon && mons[lk.mon]) { const m = mons[lk.mon], s = S(); x = m.x + m.w / 2 - CX * s; y = floorY(m); A = null; say('Переехал{|а}!', 1400); } } catch (_) { /* look не JSON */ }
      const renamed = e.payload && e.payload.name !== undefined && e.payload.name !== (PET.name || '');
      Object.assign(PET, e.payload || {}); configure();
      say(renamed && PET.name ? pick(['Я — ' + NAME + '!', NAME + '? Мне нравится!', 'Теперь я ' + NAME]) : CHUBBY ? pick(['Я просто пушист{ый|ая}!', TX().voice[0]]) : TX().voice[0], 1600);
    });
    T.event.listen('pet-pos', e => { const p = e.payload; if (p && p.label !== PET.label) friends.set(p.label, Object.assign(p, { t: now() })); });
    T.event.listen('pet-chat', e => chatReceive(e.payload));
    T.event.listen('pet-play', e => playReceive(e.payload));
    T.event.listen('hide-seek', e => { const q = e.payload || {}; if (hiding && q.label === PET.label) found(q.by || 'seeker'); });
    T.event.listen('hide-found', e => { const q = e.payload || {}; if (!seeking || !q.label || !seeking.hiders.has(q.label)) return; seeking.hiders.delete(q.label); seeking.found.push(q.label); if (q.by === 'user') say(pick(['Опередил{|а} меня!', 'Эй, я же ищу!']), 1500); });
    T.event.listen('hide-out', e => { const q = e.payload || {}; if (seeking && q.label) seeking.hiders.delete(q.label); });
    T.event.listen('gift-sent', e => { const q = e.payload || {}; if (PET.label !== leaderLabel() || GUEST) return; achCount('gift'); giftStore({ at: Date.now(), dir: 'out', who: q.to || 'коллега', what: q.what || '', msg: q.msg || '' }); giftCarryOut(q.ico || '🎁', q.name || 'подарок', q.to || 'коллеге'); });
    T.event.listen('disco-in', e => { if (!dnd() && !quiet()) disco((e.payload || {}).from || 'кто-то'); });
    T.event.listen('mood', e => { mood = String((e.payload || '')).slice(0, 24); if (mood && PET.label === leaderLabel()) say(dnd() ? 'Тихо. Не беспокоим' : `Понял{|а}: ${mood}`, 2000); hello(); });
    T.event.listen('bday-pet', e => { const q = e.payload || {}; if (q.label === PET.label || GUEST) return; setTimeout(() => { say(`С днём рождения, ${q.name}!`, 3200); hearts(3); if (!busy()) cheer(`${q.name}, с днём рождения!`); }, rnd(1500, 6000)); });
    T.event.listen('bday-owner', () => { if (GUEST) return; setTimeout(() => { bdayHat = now() + 12 * 3600e3; hearts(5); cheer(pick(['С днём рождения, хозяин! Мы тебя любим', 'Ура! У тебя день рождения! Торт будет?', 'С днём рождения! Ты у нас лучш{ий|ая}'])); for (let i = 0; i < 12; i++) setTimeout(() => fx('zzz', pick(['🎉', '🎊', '✦', '★']), rnd(-60, 60), rnd(-30, 10), 1800), i * 200); }, rnd(300, 3000)); });
    T.event.listen('note-read', e => { const q = e.payload || {}; if (GUEST || PET.label !== leaderLabel() || !q.text) return; speak(`${q.from} передаёт: ${q.text}`); });
    T.event.listen('guest-stay', e => { const q = e.payload || {}; if (GUEST || PET.label !== leaderLabel() || !guestFrom || !me) return; portal('POST', '/send', { from: me.client, to: guestFrom, kind: 'stay', payload: { pet: q.name, until: q.until } }).catch(err => console.error('stay', err)); });
    T.event.listen('stay', e => { const q = e.payload || {}; if (!away || q.pet !== NAME || !q.until) return; const ms = Math.min(10 * 3600e3, Math.max(0, q.until - Date.now())); clearTimeout(backTimer); backTimer = setTimeout(comeBack, ms + 8000); try { localStorage.setItem('awayUntil', String(Date.now() + ms + 10000)); localStorage.setItem('away:' + PET.label, JSON.stringify({ to: away.to.name, until: Date.now() + ms + 8000, name: NAME })); } catch (_) { /* без памяти */ } });
    T.event.listen('guest-coming', e => { const q = e.payload || {}; if (GUEST || away || !q.name || !isNetFriend(q.owner, q.name) || busy()) return; meetGuest(q); });
    T.event.listen('net-friend', e => { const q = e.payload || {}; if (GUEST || PET.label !== leaderLabel() || !guestFrom || !me) return; portal('POST', '/send', { from: me.client, to: guestFrom, kind: 'friend', payload: { pet: q.guest, with: q.pet } }).catch(err => console.error('friend', err)); });
    T.event.listen('net-friend-back', e => { const q = e.payload || {}; if (GUEST || q.pet !== NAME || !q.with) return; if (nrelGet(q.owner, q.with) < 4) nrelSet(q.owner, q.with, 4); say(`${q.with} (${q.owner}) — мой друг по сети!`, 3000); hearts(3); });
    T.event.listen('rel-peace', e => { const q = e.payload || {}; if (q.a === PET.label && q.b && !GUEST) peaceGo(q.b); });
    T.event.listen('poll-created', e => { const q = e.payload || {}; if (!q.id || PET.label !== leaderLabel() || GUEST) return; myPolls.push({ id: q.id, at: now(), total: 0 }); say(`Спросил{|а} всех: «${q.text}». Жду ответов`, 3200); });
    T.event.listen('card-req', e => { const q = e.payload || {}; if (q.label === PET.label && !GUEST) yearCard(); });
    T.event.listen('photo-req', e => { const q = e.payload || {}; if (q.to !== PET.label) return; if (T && T.event) T.event.emit('photo-res', { to: q.from, from: PET.label, png: snapshotPng(), name: NAME, owner: PET.owner || '', group: q.group || 0 }).catch(() => {}); });
    T.event.listen('pose-all', e => { const ms = +((e.payload || {}).ms) || 4000; if (away || dragging) return; fx('zzz', '📸', 0, -40, 1500); start('pose', { pose: 'sit', dur: ms, watch: false, mod: (T_) => { T_.happy = 1; T_.tail = 25; T_.headTilt = 6; T_.yaw = 0; } }); });
    T.event.listen('photo-res', e => { const q = e.payload || {}; if (q.to !== PET.label || !q.png) return; if (q.group) { if (groupParts) groupParts.set(q.from, q); return; } composeSelfie(q.png, q.name || 'гость', q.owner || 'коллега').then(png => albumUpload(png, `${NAME} и ${q.name || 'гость'} (гость от ${q.owner || 'коллеги'})`)); });
    T.event.listen('hide-over', () => { if (hiding && hiding.party) { hiding = null; A = null; say(pick(['Я тут!', 'А меня не нашли!', 'Ха, не нашёл!']), 1600); acts.walk(); } });
    T.event.listen('prop-pos', e => {
      const pp = e.payload || {};
      if (pp.kind === 'laser') return onLaser(Object.assign(pp, { t: now() }));
      if (pp.kind === 'butterfly') return onButterfly(Object.assign(pp, { t: now() }));
      if (pp.kind === 'mouse') return onMouse(Object.assign(pp, { t: now() }));
      if (pp.kind === 'gift') return onGift(Object.assign(pp, { t: now() }));
      if (pp.kind === 'poll') return onPoll(pp);
      if (pp.kind === 'bowl') { bowl = Object.assign(pp, { t: now() }); if (pp.full && (CAT || DOG) && !begging && !GUEST && !busy() && now() - lastBowlEat > 60000 && (pp.food === 'water' || careNow() - care.fed > 1800e3) && foodTaste(pp.food || '') !== 'no' && Math.hypot(pp.x - myCenter().x, pp.y - myCenter().y) / S() < 900) bowlEat(); return; }   // насыпали — голодный идёт есть
      if (pp.kind === 'bed') { bed = Object.assign(pp, { t: now() }); return; }
      if (pp.kind === 'bubbles') return onBubbles(Object.assign(pp, { t: now() }));
      if (pp.kind === 'nest') { const fresh = !nest || now() - nest.t > 5000; nest = Object.assign(pp, { t: now() }); if (fresh && !GUEST && !busy()) setTimeout(() => { if (nestAlive() && !busy()) { say(pick(['Гнездо! Надо натаскать вещей', 'Ого, кучка', 'Пойду искать находки']), 1400); setTimeout(gather, 1200); } }, rnd(300, 3000)); return; }
      if (pp.kind === 'ball') { if (pp.goal) onGoal(pp.goal); if ((!ball || now() - ball.t > 5000) && PET.label === leaderLabel() && !GUEST) setTimeout(() => say('Футбол! Ворота — края экрана', 2600), 600); }
      if (pp.kind === 'post') { post = Object.assign(pp, { t: now() }); return; }
      if (pp.kind !== 'ball' && pp.kind !== 'yarn') return;
      ball = Object.assign(pp, { t: now() });
      if (ball.userKick && ball.userKick !== lastUserKick) { lastUserKick = ball.userKick; onUserKick(); return; }
      if (ball.carried && ball.carried !== PET.label && A && A.name === 'ballGo') { A = null; acts.sit(2000); }   // мяч уже у другого
      // мяч прикатился прямо к ногам, а мы скучаем — пнём
      if (A && ['sit', 'look', 'loaf'].includes(A.name) && now() - A.t0 > 1500 && Math.abs(ball.x - myCenter().x) / S() < 90 && Math.abs(ball.vx) < 60 * S() && now() - lastBall > 8000) {
        lastBall = now(); ballRounds = 2; ballPlay(null);
      }
    });
  }
  if (window.__PET_TEST) window.__pt = { acts, feed, come, playMode, pet, hiss, play, perch, perchOk, deskPoll, achCount, cure, trick, trickShow, gather, onGoal, dailyTick, inputPoll, dance, set nest(v) { nest = v; }, get score() { return score; }, set quietUntil(v) { quietUntil = v; }, get quietUntil() { return quietUntil; }, get ach() { return ach; }, get care() { return care; }, goVisit, comeBack, hello, inboxPoll, guestArrive, guestLeave, visit, leap, flee, friends, cheer, chatStart, chatReceive, tagInvite, playReceive, ballStart, fetch_, onUserKick, onLaser, onButterfly, onMouse, mouseEscape, disco, discoAll, onGift, seasonTick, remindersTick, dozeOff, welcomeBack, quietSched, questsTick, relAdd, relGet, relSet, relDecay, peaceGo, resetGuestGate: () => { lastGuestAt = -1e9; }, get SCALE() { return SCALE; }, get focusLeft() { return focusUntil - now(); }, get lastReact() { return now() - lastReact; }, sickTick, sickShow, bowlKick, bowlFeedShow, giftCarryOut, feed2: feed, drink, foodTaste, maybeInfect, infect: () => { lastInfect = -1e9; const f = { sick: true, name: 'тест' }; const r = Math.random; Math.random = () => 0; try { maybeInfect(f); } finally { Math.random = r; } }, coarseAct, giftStore, get guestSick() { return guestSick; }, noteDeliver, noteStore, guestQueue, guestBusy, nrelGet, nrelSet, nrelAdd, netFriends, meetGuest, netBallSend, netBallReceive, pickPeer, groupPhoto, overnightStay, guestFriendHere, quietEnd, scheduleGiftBack, giftBackTick, friendOwner, relayStart, relayMates, knowsTrick, comfort, comfortTarget, start, isBaby, guestTrick, onPoll, myPollsTick, yearCard, composeSelfie, albumUpload, umbrellaPhrase, set weatherDay(v) { weatherDay = v; }, set mood(v) { mood = v; }, get mood() { return mood; }, askFood, bowlBring, beg, bowlEat, birdAsk, get bowl() { return bowl; }, set begging(v) { begging = v; }, get SEA() { return SEA; }, set SEA(v) { SEA = v; }, set weekCrown(v) { weekCrown = v; }, get gift() { return gift; }, raceStart, get race() { return race; }, guestPlan, get mouse() { return mouse; }, hideParty, seekStart, get seeking() { return seeking; }, nag, hideAndSeek, shellGame, shellPick, pomodoro, pomoTick, callMode, nudgeCursor, photo, parseIcs, onBubbles, scratchPost, set calEvents(v) { calEvents = v; }, calendarTick, get inCall() { return inCall; }, get shell() { return shell; }, get hiding() { return hiding; }, get pomo() { return pomo; }, set pomo(v) { pomo = v; }, weatherPhrase, set weather(v) { weather = v; }, set HOL(v) { HOL = v; }, get ball() { return ball; }, get bed() { return bed; }, get pal() { return pal; }, get chat() { return chat; }, get A() { return A; }, get pos() { return [x, y]; } };
  window.addEventListener('resize', resize);
  refreshScreens().then(() => requestAnimationFrame(loop));
  setInterval(refreshScreens, 10000);
})();
