// Случайная внешность: естественные оттенки, светлые отметины, изредка разные глаза и «монокль».
// Общий модуль для окна настроек (кнопка «случайный») и для питомца при рождении («разноцветный помёт»).
(() => {
  const pick = a => a[Math.floor(Math.random() * a.length)];
  function shade(hex, k) { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)); return '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); }
  // лёгкая вариация оттенка: ±k яркости и чуть теплее/холоднее
  function vary(hex, k = .12) { const n = parseInt(hex.slice(1), 16); let [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255]; const d = 1 + (Math.random() * 2 - 1) * k, w = (Math.random() * 2 - 1) * 10; r = r * d + w; g = g * d; b = b * d - w; return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
  const FURS = { cat: ['#e0923e', '#4a4a55', '#caa066', '#25232a', '#fbfaf8', '#8a7360', '#9aa0a8', '#d9a35c', '#b8754a', '#efe6d8'], dog: ['#e0b56c', '#c58b4a', '#7a4a2a', '#2a2826', '#f4f2ee', '#d8863a', '#7d858f', '#d9b27a'],
    hamster: ['#e0aa62', '#a5a4a2', '#f4f0e8', '#ecd2a6', '#6a4a3a'], rabbit: ['#f5f2ec', '#a29383', '#dc9a5c', '#5b4033', '#e3c9a0', '#2b2826'], bird: ['#7cc242', '#6bb7e8', '#f2c230', '#d8342c', '#8e9096', '#f07a3a'], dragon: ['#4fb06a', '#e05a3a', '#6fb4e8', '#5a3f8a', '#e6b03a', '#2d2f3a', '#d86ab0', '#5fbfb0'], kuzya: ['#d9382e', '#3a6fb0', '#4f9a4a', '#e88ab0', '#e6b03a', '#7a4a9a'], round: ['#6fb7ea', '#f2a6c8', '#c56ad9', '#f7d63a', '#d9863a', '#6fbf73', '#e0392b'], clippy: ['#b9bcc4', '#e6b03a', '#3a3a42', '#d9382e', '#3a7bd5', '#4fb06a'], custom: ['#8a8f95'] };
  const EYES = ['#5fb85a', '#6fa8e6', '#e0962a', '#8fb04a', '#c9952c', '#3b2414', '#a8cfb0', '#5aa5e6'];
  // полный случайный вид (кнопка «случайный»): меняет и цвет шерсти p.fur
  function randomLook(p) {
    const fur = pick(FURS[p.sp] || FURS.cat), look = {};
    p.fur = vary(fur);
    Object.assign(look, details(p.sp, p.fur, 1));
    return look;
  }
  // «разноцветный помёт»: породу оставляем, вариации мягче — оттенок, пятно, носочки, глаза
  function litterLook(sp, baseFur) {
    const look = details(sp, vary(baseFur, .1), .55);
    look.furVar = vary(baseFur, .1);
    return look;
  }
  function details(sp, fur, k) {
    const look = {};
    const rr = (a, b) => Math.round((a + Math.random() * (b - a)) * 100) / 100;
    const BIRD = sp === 'bird', HAM = sp === 'hamster', RAB = sp === 'rabbit', DOG = sp === 'dog', CAT = sp === 'cat', DRAGON = sp === 'dragon';
    if (Math.random() < .8 * k) look.iris = pick(BIRD ? ['#1a1410', '#1a1410', '#f2c230', '#e8d27a', '#f2e7c8', '#d96a2a'] : EYES);
    if (Math.random() < .05) look.iris2 = pick(EYES);                              // гетерохромия
    look.eyeK = rr(1 - .12 * k, 1 + .15 * k); look.fluffK = rr(.2, .9); look.bodyK = rr(.94, 1.1);
    if (sp === 'kuzya') {                                                          // домовёнок: волосы, кожа, рубаха в горошек
      if (Math.random() < .7 * k) look.hair = pick(['#dcb96a', '#e8b84a', '#7a4a2a', '#a8a29a', '#c9302a', '#2a2220']);
      if (Math.random() < .4 * k) look.skin = pick(['#efc9a4', '#f6d3b0', '#d9a878', '#f8dcc0']);
      if (Math.random() < .6 * k) look.pants = pick(['#4a3a5a', '#6a4a3a', '#3a3a2a', '#7a3a5a', '#2a3a5a']);
      look.dots = Math.random() < .6 ? pick(['#ffffff', '#f6e9a0', '#2a2220']) : 'none';
      if (Math.random() < .5 * k) look.belt = pick(['#e9c34a', '#d9382e', '#f6e9a0', '#2a2220']);
      if (Math.random() < .12 * k) look.beard = look.hair || '#a8a29a'; if (Math.random() < .12 * k) look.cap = pick(['#3a3a4a', '#7a3a2a']);
      if (Math.random() < .3 * k) look.freckles = false;
      look.hairK = rr(1 - .2 * k, 1 + .3 * k);
      return look;
    }
    if (sp === 'custom') { look.eyeK = 1; return look; }
    if (sp === 'round') {                                                          // круглыш: уши, зубки, конечности, шляпа
      look.ears2 = pick(['long', 'round', 'pig', 'none', 'none']); if (Math.random() < .3) look.teeth = true; if (Math.random() < .25) look.lashes = true;
      look.limb = shade(fur, -.25); look.shoe = pick([shade(fur, -.4), '#d9382e', '#2a2a2e']); if (Math.random() < .3) look.pants = pick(['#3a6fb0', '#8a5a2a', '#2a2a2e']);
      if (Math.random() < .2) look.glasses = true; if (Math.random() < .15) look.hatP = pick(['party', 'musketeer']); if (Math.random() < .3) look.cheekC = '#ff7a8a';
      look.eyeK = rr(.9, 1.2); look.bodyK = rr(.92, 1.1);
      return look;
    }
    if (sp === 'clippy') {                                                         // скрепка: металл, глаза, брови
      if (Math.random() < .5) look.iris = pick(['#3a7bd5', '#5fb85a', '#e0962a', '#8ef0c0']);
      if (Math.random() < .2 * k) look.glasses = true; if (Math.random() < .2 * k) look.bow = pick(['#ffffff', '#d9382e', '#f3a9b8']);
      look.browK = rr(.7, 1.6);
      return look;
    }
    if (DRAGON) {                                                                  // дракончик: чешуя, перепонки, рожки, шипы
      if (Math.random() < .7 * k) look.chest = pick([shade(fur, .6), '#f9d99a', '#e8f4fb', '#c9b6e8']);
      if (Math.random() < .6 * k) look.wing = Math.random() < .6 ? shade(fur, -.35) : pick(['#9a2e2a', '#3a72b8', '#2f2050', '#b8761c', '#2f7a48']);
      if (Math.random() < .5 * k) look.horn = pick(['#f1e3c4', '#f6e8c8', '#9a9cab', '#e6dcf4', '#2d2f3a']);
      if (Math.random() < .5 * k) look.spikes = shade(fur, -.4);
      if (Math.random() < .15 * k) look.horns = false; if (Math.random() < .15 * k) look.spikes = 'none'; if (Math.random() < .1 * k) look.fins = false;
      if (Math.random() < .25 * k) look.tailTip = pick(['#c93a2a', '#f2c230', '#f4f8fc']);
      if (Math.random() < .3 * k) look.patchSide = pick(['l', 'r', 'both']); if (look.patchSide) look.patch = shade(fur, -.35);
      if (Math.random() < .2 * k) look.star = shade(fur, .7); if (Math.random() < .1 * k) look.heart = shade(fur, -.4);
      if (!look.iris) look.iris = pick(['#f2c230', '#ffd54a', '#b7f0ff', '#8ef0c0', '#ff7a2a', '#8fd63a']);
      look.hornK = rr(1 - .3 * k, 1 + .35 * k); look.wingK = rr(1 - .25 * k, 1 + .3 * k); look.tailK = rr(1 - .25 * k, 1 + .3 * k);
      return look;
    }
    if (BIRD) {                                                                    // попугай: перо, хохолок, маска, полоски на крыльях
      if (Math.random() < .6 * k) look.head = Math.random() < .5 ? shade(fur, .3) : pick(['#f2e14a', '#f4f4f0', '#f07a3a', '#e03a9c', '#6bb7e8']);
      if (Math.random() < .5 * k) look.wing = Math.random() < .5 ? shade(fur, -.2) : pick(['#f2c230', '#3a9a3c', '#2f68c9', '#8a8f95']);
      if (Math.random() < .5 * k) look.prim = pick(['#2a4fbf', '#3f7a2c', '#5d6066', '#d8342c', '#2d5f8a']);
      if (Math.random() < .5 * k) look.belly = shade(fur, .35);
      if (Math.random() < .4 * k) look.cheek = pick(['#f08a3c', '#3a5fcf', '#f7a6c8', '#e84a3a']);
      if (Math.random() < .3 * k) { look.crest = true; look.crestC = pick(['#f2dc5a', '#2f9a3a', '#f07a3a', shade(fur, .3)]); look.crestK = rr(.8, 1.5); }
      if (Math.random() < .25 * k) look.face = true;
      if (Math.random() < .3 * k) look.bars = true;
      if (Math.random() < .2 * k) look.throat = true;
      if (Math.random() < .15 * k) look.ring = pick(['#2a2220', '#f5b3d0', '#f2c230']);
      if (Math.random() < .5 * k) look.beak = pick(['#e0cd8f', '#9a9a9a', '#1f1d1d', '#f2b02a', '#d93a30']);
      if (Math.random() < .3 * k) look.feet = pick(['#8d8680', '#f2c230', '#5a5a60']);
      look.beakK = rr(1 - .2 * k, 1 + .35 * k); look.tailK = rr(1 - .25 * k, 1 + .35 * k);
      return look;
    }
    if (Math.random() < .7 * k + .3) look.chest = Math.random() < .75 ? shade(fur, .55) : 'none'; else look.chest = 'on';
    if (Math.random() < .5 * k) { look.paws = shade(fur, .6); look.socks = true; }
    if (Math.random() < .5 * k) look.nose = pick(['#e88c86', '#2a2220', '#d4847a', '#f0a3a8']);
    if (Math.random() < .4 * k) look.earIn = pick(['#e8a5a0', '#f6c3c8', '#d9a99a']);
    if (Math.random() < .3 * k) look.muzzle = shade(fur, .5);
    const r = Math.random();
    if (r < .22 * k) { look.patchSide = pick(['l', 'r', 'both']); look.patch = shade(fur, -.5); } else if (r < .32 * k) look.blaze = true;
    else if ((CAT || DOG || RAB) && r < .42 * k) look.mask = pick(CAT || RAB ? ['light', 'dark', 'points'] : ['light', 'dark']); else if ((CAT || DOG) && r < .48 * k) look.monocle = shade(fur, -.5);
    if (Math.random() < .5 * k) { const pr = Math.random();
      look.spotN = Math.round(rr(4, 24)); look.spotK = rr(.7, 1.6);
      look.pattern = CAT ? (pr < .45 ? 'stripe' : pr < .6 ? 'spots' : pr < .75 ? 'rosettes' : pr < .85 ? 'bands' : '')
        : DOG ? (pr < .35 ? 'spots' : pr < .55 ? 'saddle' : pr < .7 ? 'beagle' : '')
        : HAM ? (pr < .4 ? 'dorsal' : pr < .6 ? 'panda' : pr < .75 ? 'spots' : '')
        : (pr < .4 ? 'dutch' : pr < .6 ? 'spots' : ''); }
    if (Math.random() < .2 * k) look.fluffy = true;
    if (CAT) { if (Math.random() < .15 * k) look.tuft = true; if (Math.random() < .1 * k) look.flat = true; if (Math.random() < .12 * k) look.lashes = true; if (Math.random() < .15 * k) look.fluffyTail = true; if (Math.random() < .04 * k) look.sphynx = true; if (Math.random() < .08 * k) look.fold = true; if (Math.random() < .06 * k) look.hair = true; }
    if (DOG) { if (Math.random() < .25 * k) look.curlTail = true; if (Math.random() < .4 * k) look.prick = Math.random() < .5; if (Math.random() < .1 * k) look.flat = true; if (Math.random() < .08 * k) look.wrinkles = true; if (Math.random() < .08 * k) look.curly = true; if (Math.random() < .08 * k) look.longBody = true; if (Math.random() < .15 * k) look.smile = true; if (Math.random() < .2 * k) look.ears = pick(['big', 'small']); }
    if (RAB) { if (Math.random() < .3 * k) look.lop = Math.random() < .6; if (Math.random() < .12 * k) look.lashes = true; if (Math.random() < .3 * k) look.tailC = pick(['#ffffff', '#f7f3ec', shade(fur, .5)]); }
    if (HAM) { look.cheekK = Math.random() < .4 * k ? rr(.3, .9) : 0; }
    if ((CAT || DOG) && Math.random() < .15) look.tailTip = true;
    if ((CAT || DOG || RAB) && Math.random() < .12 * k) { look.collar = pick(['#e05a6a', '#3a7bd5', '#f3a9b8', '#2a2220', '#f2c230']); look.bow = Math.random() < .4; }
    // форма: у каждого чуть свои уши, хвост
    look.earK = rr(1 - .25 * k, 1 + .3 * k); look.tailK = rr(1 - .3 * k, 1 + .35 * k);
    // редкости
    const rare = Math.random();
    if (rare < .04) look.star = shade(fur, .7); else if (rare < .07) look.heart = shade(fur, -.45); else if (rare < .09 && (CAT || DOG)) look.greyMuzzle = true;
    else if (rare < .13) { look.pawFR = shade(fur, .65); }                         // один носочек не в цвет
    else if (rare < .15) { look.earIn2 = pick(['#c9a0e0', '#a0c9e0', '#f0c0a0']); }  // разные уши
    return look;
  }
  function lerpHex(a, b, t) { const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16); const c = [16, 8, 0].map(sh => Math.round(((A >> sh) & 255) * (1 - t) + ((B >> sh) & 255) * t)); return '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); }
  const isHex = v => /^#[0-9a-f]{6}$/i.test(v || '');
  // Потомство: родители {sp, color, fur, look, base} → {sp, color, fur, look}. Половина черт от каждого, цвета смешиваются,
  // плюс мутация. Вид — как у одного из родителей (если разные — случайный из двух).
  function childLook(A, B) {
    if (A.sp !== B.sp) return null;                                                 // потомство только внутри вида
    const sx = p => p.sex || (p.base && p.base.sex) || 'm';
    if (sx(A) === sx(B)) return null;                                               // и только от мальчика с девочкой
    const pa = Math.random() < .5 ? A : B, pb = pa === A ? B : A;
    const sp = pa.sp, base = pa.base;
    const la = A.look || {}, lb = B.look || {};
    const furA = A.fur || A.base.fur, furB = B.fur || B.base.fur;
    const fur = vary(lerpHex(furA, furB, .3 + Math.random() * .4), .06);
    const look = {};
    const eff = (par, l, k, def) => (isHex(l[k]) ? l[k] : (par.base[k] && isHex(par.base[k]) ? par.base[k] : def));
    const mixc = (k, def) => { const a = eff(A, la, k, def), b = eff(B, lb, k, def); return Math.random() < .5 ? (Math.random() < .5 ? a : b) : lerpHex(a, b, .5); };
    look.chest = (la.chest === 'none' && lb.chest === 'none') || (!A.base.chest && !B.base.chest && Math.random() < .6) ? 'none' : mixc('chest', shade(fur, .55));
    look.iris = Math.random() < .5 ? eff(A, la, 'iris', '#5fb85a') : eff(B, lb, 'iris', '#5fb85a');
    if ((la.iris2 || lb.iris2) && Math.random() < .5) look.iris2 = la.iris2 || lb.iris2; else if (Math.random() < .03) look.iris2 = '#6fa8e6';
    look.nose = Math.random() < .5 ? eff(A, la, 'nose', '#e88c86') : eff(B, lb, 'nose', '#e88c86');
    look.earIn = mixc('earIn', '#e8a5a0');
    for (const k of ['pawFL', 'pawFR', 'pawHL', 'pawHR']) { const c = Math.random() < .5 ? la[k] : lb[k]; if (isHex(c)) look[k] = c; }
    if ((la.socks || lb.socks) && Math.random() < .6) { look.socks = true; look.paws = shade(fur, .6); }
    for (const k of ['patchSide', 'blaze', 'mask', 'pattern', 'fluffy', 'tuft', 'curlTail', 'fold', 'tailTip', 'star', 'heart', 'greyMuzzle', 'flat', 'sphynx', 'lashes', 'fluffyTail', 'wrinkles', 'curly', 'longBody', 'smile', 'hair', 'prick', 'lop', 'ears', 'socks', 'muzzle', 'tailC', 'collar', 'bow', 'cheekK',
      'head', 'wing', 'prim', 'belly', 'cheek', 'crest', 'crestC', 'crestK', 'face', 'bars', 'throat', 'ring', 'beak', 'feet', 'beakK', 'horn', 'horns', 'spikes', 'fins', 'hornK', 'wingK', 'hair', 'skin', 'pants', 'belt', 'lapti', 'dots', 'beard', 'cap', 'freckles', 'hairK', 'glasses', 'browK', 'ears2', 'teeth', 'limb', 'shoe', 'cheekC', 'hatP', 'holes', 'noWings']) {
      const src = Math.random() < .5 ? la : lb; if (src[k] !== undefined) look[k] = src[k];
    }
    if (look.patchSide) look.patch = shade(fur, -.5); if (look.star === true || isHex(look.star)) look.star = shade(fur, .7); if (look.heart) look.heart = shade(fur, -.45);
    if (!look.pattern) { const pp = Math.random() < .5 ? (la.pattern !== undefined ? la.pattern : (A.base.stripe ? 'stripe' : A.base.patches)) : (lb.pattern !== undefined ? lb.pattern : (B.base.stripe ? 'stripe' : B.base.patches)); if (pp) look.pattern = pp; }
    const num = (k, d) => { const a = la[k] !== undefined ? la[k] : d, b = lb[k] !== undefined ? lb[k] : d; return Math.round(((a + b) / 2 + (Math.random() - .5) * .16) * 100) / 100; };
    look.earK = num('earK', 1); look.eyeK = num('eyeK', 1); look.tailK = num('tailK', 1); look.fluffK = num('fluffK', .5); look.bodyK = num('bodyK', 1);
    if (look.pattern === 'spots') { look.spotN = Math.round(num('spotN', 9) + (Math.random() - .5) * 6); look.spotK = num('spotK', 1); }
    if (sp === 'bird') look.beakK = num('beakK', 1);
    if (Math.random() < .08) Object.assign(look, details(sp, fur, .3));                // мутация
    return { sp, color: pa.color, fur, look };
  }
  window.LOOKS = { shade, vary, randomLook, litterLook, childLook };
})();
