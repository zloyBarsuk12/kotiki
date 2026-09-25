// Окрасы питомцев (чиби-стиль) — общие для зверей (pet.js) и окна настроек (settings.html).
// fur — основа, chest/paws/muzzle — светлые грудка/лапки/мордочка, iris — глаза, line — контур глаз и рта.
(() => {
  const CATS = [
    { name: 'Дымок', fur: '#4a4a55', chest: '#ece7e1', paws: '#f4f1ec', muzzle: '#ece7e1', earIn: '#e3a07a', patch: '#b8754a', iris: '#e0962a', nose: '#e88c86', tail: '#44444f', line: '#221e22', whisk: 'rgba(255,255,255,.7)' },
    { name: 'Полосатик', fur: '#caa066', chest: '#f7efe0', paws: '#f7f2ea', muzzle: '#f7efe0', earIn: '#f0b2a5', stripe: '#6e4b2a', iris: '#e0a02a', nose: '#e8908a', line: '#4a3322', tailTip: '#6e4b2a' },
    { name: 'Рыжик', fur: '#f0983a', chest: '#fcd9a8', paws: '#fcd9a8', muzzle: '#fcd9a8', earIn: '#f7b98f', stripe: '#c86a1c', iris: '#5b3a1e', nose: '#e8807a', line: '#5a2e12' },
    { name: 'Уголёк', fur: '#25232a', chest: null, paws: '#25232a', earIn: '#5a4450', iris: '#e8c23a', nose: '#5a4450', line: '#000000', whisk: 'rgba(255,255,255,.75)' },
    { name: 'Снежка', sex: 'f', fur: '#fbfaf8', chest: '#ffffff', paws: '#ffffff', muzzle: '#ffffff', earIn: '#f6c3c8', patch: '#c9ccd3', tail: '#b9bdc6', iris: '#6fc9c0', nose: '#f0a3a8', line: '#6d6a72', collar: '#f3a9b8', pendant: '#8ee3d6', lashes: true, whisk: 'rgba(90,90,100,.5)', fluffyTail: true },
    { name: 'Сиамка', sex: 'f', fur: '#efe3cf', chest: '#f9f2e6', paws: '#5e4133', muzzle: '#efe3cf', ear: '#5e4133', earIn: '#8a6352', points: '#5e4133', tail: '#5e4133', iris: '#5aa5e6', nose: '#4a3228', line: '#3d2a22' },
    { name: 'Огонёк', breed: 'Пушистый рыжий', fluffy: true, tuft: 'small', fluffyTail: true, fur: '#e0923e', chest: '#f6dfbf', paws: '#f8e8d2', muzzle: '#f6dfbf', earIn: '#f0b39a', stripe: '#c8722a', iris: '#a8cfb0', nose: '#e0958a', line: '#5a2e12', collar: '#c8102e', bow: true, whisk: 'rgba(255,255,255,.85)' },
    { name: 'Сфинкс', breed: 'Сфинкс', sphynx: true, fur: '#dcb9a4', chest: '#ead0c0', paws: '#e6c4b2', muzzle: '#ead0c0', earIn: '#e8a89a', iris: '#7fb6c9', nose: '#c98a80', line: '#5a3e34', whisk: 'rgba(0,0,0,0)' },
    { name: 'Мейн-кун', breed: 'Мейн-кун', tuft: true, fluffyTail: true, fur: '#8a7360', chest: '#e9dcc9', paws: '#e9dcc9', muzzle: '#e9dcc9', earIn: '#d9a99a', stripe: '#4d3d30', iris: '#c9a03a', nose: '#8a5a50', line: '#3a2a20', tailTip: '#4d3d30' },
    { name: 'Фолд', breed: 'Скоттиш-фолд', sex: 'f', fold: true, fur: '#9aa0a8', chest: '#d8dbe0', paws: '#d8dbe0', muzzle: '#d8dbe0', earIn: '#c9a5a5', iris: '#e0902a', nose: '#8a7a7a', line: '#3a3f47' },
    { name: 'Перс', breed: 'Перс', flat: true, fluffyTail: true, fur: '#efe6d8', chest: '#faf6ef', paws: '#faf6ef', muzzle: '#faf6ef', earIn: '#f0c4c4', iris: '#e08a2a', nose: '#d99a9a', line: '#6d6a72', whisk: 'rgba(120,110,100,.5)' },
    { name: 'Бенгал', breed: 'Бенгал', patches: 'rosettes', fur: '#d9a35c', chest: '#f4e4c6', paws: '#f4e4c6', muzzle: '#f4e4c6', earIn: '#e8b0a0', black: '#4a3220', iris: '#7cb36a', nose: '#c9807a', line: '#4a3220' },
    { name: 'Британец', breed: 'Британская', fur: '#7d8794', chest: '#7d8794', paws: '#8f98a4', muzzle: '#9aa3ae', earIn: '#b89a9a', iris: '#e08a2a', nose: '#8a7a80', line: '#3a3f47', round: true },
  ];
  const DOGS = [
    { name: 'Бублик', fur: '#e0b56c', chest: '#f6e3bd', paws: '#f6e3bd', muzzle: '#f2dcb0', earC: '#c48f45', iris: '#3b2414', nose: '#2a2220', line: '#3a2a1a' },
    { name: 'Бигль', fur: '#f3eee6', chest: '#ffffff', paws: '#ffffff', headC: '#b9773a', muzzle: '#f6efe4', earC: '#9c5e28', blaze: '#f6efe4', patches: 'beagle', black: '#2a2522', iris: '#3b2414', nose: '#2a2220', line: '#3a2a1a', tailTip: '#f3eee6' },
    { name: 'Пятныш', fur: '#f4f2ee', chest: '#ffffff', paws: '#ffffff', muzzle: '#f8f6f2', earC: '#2c2a28', patches: 'spots', black: '#2a2826', iris: '#2e1d12', nose: '#1d1b1a', line: '#3a3230' },
    { name: 'Корж', fur: '#d9843a', chest: '#f7f1e7', paws: '#f7f1e7', muzzle: '#f7f1e7', earIn: '#e7b3a3', prick: true, iris: '#3b2414', nose: '#1e1a18', line: '#4a2c14', blaze: '#f7f1e7' },
    { name: 'Черныш', fur: '#2a2826', chest: '#2a2826', paws: '#2a2826', muzzle: '#3a3634', earC: '#222020', iris: '#5a3a1a', nose: '#111', line: '#000' },
    { name: 'Хаська', sex: 'f', fur: '#7d858f', chest: '#f5f5f3', paws: '#f5f5f3', muzzle: '#f5f5f3', headC: '#7d858f', maskC: '#f5f5f3', prick: true, earIn: '#d9b3b3', iris: '#69b0f0', nose: '#1e1c1c', line: '#3a3f47' },
    { name: 'Рекс', breed: 'Немецкая овчарка', prick: true, fur: '#c58b4a', chest: '#d9a86a', paws: '#c58b4a', muzzle: '#2a2320', headC: '#c58b4a', patches: 'saddle', black: '#2a2522', earIn: '#8a6a5a', iris: '#3b2414', nose: '#111', line: '#2a1a10' },
    { name: 'Такса', breed: 'Такса', sex: 'f', longBody: true, fur: '#7a4a2a', chest: '#7a4a2a', paws: '#9a6a4a', muzzle: '#8a5a3a', earC: '#5a3018', iris: '#3b2414', nose: '#111', line: '#2a1a10' },
    { name: 'Мопс', breed: 'Мопс', flat: true, curlTail: true, wrinkles: true, fur: '#d8b98a', chest: '#e9d5b0', paws: '#e9d5b0', muzzle: '#2a2320', earC: '#2a2320', iris: '#3b2414', nose: '#111', line: '#2a1a10' },
    { name: 'Пудель', breed: 'Пудель', sex: 'f', curly: true, fur: '#f1e6d6', chest: '#f9f3ea', paws: '#f9f3ea', muzzle: '#f1e6d6', earC: '#e8d8c2', iris: '#3b2414', nose: '#222', line: '#6d6a72' },
    { name: 'Шиба', breed: 'Шиба-ину', prick: true, curlTail: true, fur: '#d8863a', chest: '#f7efe4', paws: '#f7efe4', muzzle: '#f7efe4', headC: '#d8863a', maskC: '#f7efe4', earIn: '#e8b0a0', iris: '#3b2414', nose: '#1e1a18', line: '#4a2c14' },
    { name: 'Самоед', breed: 'Самоед', prick: true, smile: true, fluffy: true, fur: '#f8f6f1', chest: '#ffffff', paws: '#ffffff', muzzle: '#ffffff', earIn: '#e8c0c0', iris: '#2e1d12', nose: '#1e1a18', line: '#7a7a80' },
    { name: 'Шпиц', breed: 'Померанский шпиц', prick: true, curlTail: true, fluffy: true, smallEars: true, fur: '#e9a15a', chest: '#f8ead4', paws: '#f8ead4', muzzle: '#f5dcb8', tail: '#f0b06a', earIn: '#e8b0a0', iris: '#3b2414', nose: '#1e1a18', line: '#5a2e12' },
    { name: 'Далматин', breed: 'Далматинец', fur: '#f8f7f4', chest: '#ffffff', paws: '#ffffff', muzzle: '#fbfaf8', earC: '#1e1c1c', patches: 'spots', spotN: 16, spotK: 1.15, black: '#1e1c1c', iris: '#3b2414', nose: '#111', line: '#2a2826', patch: '#1e1c1c', patchSide: 'r' },
    { name: 'Чипа', breed: 'Чихуахуа', sex: 'f', prick: true, bigEars: true, fur: '#d9b27a', chest: '#f3e4c8', paws: '#f3e4c8', muzzle: '#f3e4c8', earIn: '#e8b0a0', iris: '#3b2414', nose: '#222', line: '#4a3320' },
  ];
  const HAMSTERS = [
    { name: 'Персик', fur: '#e0aa62', chest: '#fbf1e2', paws: '#f6d9c4', muzzle: '#fbf1e2', earIn: '#e8a5a0', iris: '#120d0d', nose: '#e58a8f', line: '#4a3320', whisk: 'rgba(255,255,255,.8)' },
    { name: 'Джунгарик', fur: '#a5a4a2', chest: '#f7f5f1', paws: '#f0dcd0', muzzle: '#f7f5f1', stripe: '#4a4745', patches: 'dorsal', earIn: '#d9a5a5', iris: '#120d0d', nose: '#d98a90', line: '#3a3634', whisk: 'rgba(255,255,255,.8)' },
    { name: 'Пломбир', fur: '#f4f0e8', chest: '#ffffff', paws: '#f6dcd6', muzzle: '#ffffff', earIn: '#f2b3b3', iris: '#3a0d14', nose: '#ee9aa3', line: '#6d6a72', whisk: 'rgba(140,130,120,.6)' },
    { name: 'Панда', sex: 'f', fur: '#f4f0e8', chest: '#ffffff', paws: '#f6dcd6', muzzle: '#ffffff', patches: 'panda', black: '#2c2a29', earIn: '#caa0a0', iris: '#120d0d', nose: '#e0949a', line: '#2c2a29', whisk: 'rgba(140,130,120,.6)' },
    { name: 'Сливка', sex: 'f', fur: '#ecd2a6', chest: '#fcf5e8', paws: '#f6dcd6', muzzle: '#fcf5e8', earIn: '#eab3a8', iris: '#3a0d14', nose: '#e59aa0', line: '#5a4630', whisk: 'rgba(255,255,255,.8)' },
    { name: 'Шоколад', fur: '#6a4a3a', chest: '#e9dccb', paws: '#d9b8a8', muzzle: '#e9dccb', earIn: '#b98a80', iris: '#0d0909', nose: '#c98a8a', line: '#2a1a12', whisk: 'rgba(255,255,255,.75)' },
  ];
  const BIRDS = [
    { name: 'Чижик', kind: 'budgie', fur: '#7cc242', belly: '#a6dc6a', head: '#f2e14a', wing: '#9bd45e', bars: '#2a2a22', prim: '#3f7a2c', tail: '#2d5f8a', cheek: '#3a5fcf', beak: '#e0cd8f', beakLo: '#c9b67a', cere: '#5a7fd6', iris: '#1a1410' },
    { name: 'Голубь', kind: 'budgie', fur: '#6bb7e8', belly: '#a9d6f4', head: '#f4f4f0', wing: '#b8def5', bars: '#26283a', prim: '#3a6fa8', tail: '#2a4e8f', cheek: '#3a52b8', beak: '#e0cd8f', beakLo: '#c9b67a', cere: '#7a5a3a', iris: '#1a1410' },
    { name: 'Корелла', sex: 'f', kind: 'cockatiel', fur: '#9ea3a8', belly: '#c9ccd0', head: '#f2dc5a', crest: '#f2dc5a', wing: '#8a8f95', patch: '#f4f4f0', prim: '#6f7479', tail: '#7a7f84', cheek: '#f08a3c', beak: '#9a9a9a', beakLo: '#8a8a8a', iris: '#1a1410' },
    { name: 'Ара', kind: 'macaw', fur: '#d8342c', belly: '#e6564c', head: '#d8342c', face: '#f7f3ee', wing: '#f2c230', prim: '#2f68c9', tail: '#d8342c', tail2: '#2f68c9', beak: '#ece4d4', beakLo: '#2a2626', beakK: 1.3, iris: '#e8d27a' },
    { name: 'Жако', kind: 'grey', fur: '#8e9096', belly: '#b3b5ba', head: '#a3a5aa', face: '#e8e8ea', wing: '#7d8086', prim: '#5d6066', tail: '#c8302c', beak: '#1f1d1d', beakLo: '#1f1d1d', beakK: 1.15, iris: '#f2e7c8' },
    { name: 'Неразлучник', kind: 'lovebird', fur: '#6cc24a', belly: '#9ad878', head: '#f07a3a', face: '#e84a3a', wing: '#5aad3c', prim: '#2f6e2a', tail: '#4aa0d8', beak: '#d93a30', beakLo: '#c9322a', iris: '#1a1410' },
    { name: 'Каркуша', sex: 'f', breed: 'Ворона с бантиком, с фото', sprite: 'crow.png', spriteK: 1.1, parts: { neck: .34, legs: .18 }, eyeY: .95, eyeDX: .06, eyeX: -6, fur: '#1a1a1a', iris: '#1a1a1a', line: '#1a1a1a', beak: '#7a5a4a' },
  ];
  const RABBITS = [
    { name: 'Пушок', fur: '#f5f2ec', chest: '#ffffff', paws: '#ffffff', muzzle: '#ffffff', tailC: '#ffffff', earIn: '#f0b3b8', iris: '#2a1a1a', nose: '#e89aa4', line: '#6d6a72', whisk: 'rgba(140,130,120,.6)' },
    { name: 'Серыш', fur: '#a29383', chest: '#efe8dd', paws: '#efe8dd', muzzle: '#efe8dd', tailC: '#f7f3ec', earIn: '#d9b0a8', iris: '#1a1210', nose: '#c98f8f', line: '#3a2f26', whisk: 'rgba(255,255,255,.8)' },
    { name: 'Рыжик', fur: '#dc9a5c', chest: '#f6e6d2', paws: '#f6e6d2', muzzle: '#f6e6d2', tailC: '#fbf4ea', earIn: '#eab0a0', iris: '#1a1210', nose: '#d98a8a', line: '#5a2e12', whisk: 'rgba(255,255,255,.8)' },
    { name: 'Голландец', fur: '#f4f2ee', chest: '#ffffff', paws: '#ffffff', muzzle: '#ffffff', patches: 'dutch', black: '#2b2826', ear: '#2b2826', tailC: '#f4f2ee', earIn: '#8a6a6a', iris: '#1a1210', nose: '#e0a0a8', line: '#2b2826', whisk: 'rgba(140,130,120,.6)' },
    { name: 'Вислоух', fur: '#e3c9a0', chest: '#f5ebdc', paws: '#f5ebdc', muzzle: '#f5ebdc', lop: true, ear: '#cfae82', tailC: '#fbf6ee', earIn: '#e6b8a6', iris: '#1a1210', nose: '#d9959a', line: '#5a4630', whisk: 'rgba(255,255,255,.8)' },
    { name: 'Шоколадка', sex: 'f', fur: '#5b4033', chest: '#b89a86', paws: '#b89a86', muzzle: '#b89a86', tailC: '#e8ddd0', earIn: '#a07a70', iris: '#0d0909', nose: '#b98080', line: '#2a1a12', whisk: 'rgba(255,255,255,.75)' },
  ];
  // дракончики: fur — чешуя, chest — пластины на животе, wing — перепонка, horn — рожки, spikes — шипы, slit — вертикальный зрачок
  const DRAGONS = [
    { name: 'Изумруд', fur: '#4fb06a', chest: '#e9e2a8', muzzle: '#4fb06a', wing: '#2f7a48', horn: '#f1e3c4', spikes: '#2f7a48', tail: '#4fb06a', iris: '#f2c230', slit: true, nose: '#2a5a38', line: '#1f3d2a', noFur: true },
    { name: 'Искорка', sex: 'f', fur: '#e05a3a', chest: '#f9d99a', muzzle: '#e05a3a', wing: '#9a2e2a', horn: '#f6e8c8', spikes: '#9a2e2a', tail: '#e05a3a', iris: '#ffd54a', slit: true, nose: '#7a2a1a', line: '#4a1a12', noFur: true },
    { name: 'Ледышка', fur: '#6fb4e8', chest: '#e8f4fb', muzzle: '#6fb4e8', wing: '#3a72b8', horn: '#f4f8fc', spikes: '#3a72b8', tail: '#6fb4e8', iris: '#b7f0ff', slit: true, nose: '#2a4a7a', line: '#213a5a', noFur: true },
    { name: 'Ночка', sex: 'f', fur: '#5a3f8a', chest: '#c9b6e8', muzzle: '#5a3f8a', wing: '#2f2050', horn: '#e6dcf4', spikes: '#2f2050', tail: '#5a3f8a', iris: '#8ef0c0', slit: true, nose: '#2a1a40', line: '#1e1430', noFur: true, star: '#f5e7a0' },
    { name: 'Золотко', fur: '#e6b03a', chest: '#fff0c0', muzzle: '#e6b03a', wing: '#b8761c', horn: '#fff6e0', spikes: '#b8761c', tail: '#e6b03a', iris: '#6fd0c8', slit: true, nose: '#8a5a10', line: '#5a3a0a', noFur: true },
    { name: 'Тень', fur: '#2d2f3a', chest: '#6a6d7c', muzzle: '#2d2f3a', wing: '#16171f', horn: '#9a9cab', spikes: '#16171f', tail: '#2d2f3a', iris: '#ff7a2a', slit: true, nose: '#111', line: '#000', noFur: true },
  ];
  // домовёнок: fur — рубаха, hair — волосы, skin — кожа, pants — штаны, belt — поясок, lapti — лапти
  const KUZYA = [
    { name: 'Кузя', breed: 'Тот самый, с картинки', parts: { neck: .52, legs: .12 }, sprite: 'kuzya.png', spriteK: 1.05, eyeY: .63, eyeDX: .066, eyeX: -2, mouthY: .45, fur: '#d9382e', hair: '#dcb96a', iris: '#5fb85a', line: '#2a1d18', sex: 'm' },
    { name: 'Нафаня', breed: 'Старший домовой', fur: '#3a6fb0', hair: '#a8a29a', skin: '#f2cfae', pants: '#5a4a3a', belt: '#c9a15a', lapti: '#b8904a', iris: '#5a3a1e', nose: '#d9a080', line: '#3a2519', beard: '#a8a29a', sex: 'm' },
    { name: 'Лешик', breed: 'Лесной', fur: '#4f9a4a', hair: '#7a4a2a', skin: '#f6d3b0', pants: '#3a3a2a', belt: '#e9c34a', lapti: '#c9a15a', iris: '#5fb85a', nose: '#d9a080', line: '#3a2519', sex: 'm' },
    { name: 'Маруся', sex: 'f', breed: 'Домовушка', fur: '#e88ab0', dots: true, hair: '#f0c860', skin: '#f8dcc0', pants: '#7a3a5a', belt: '#f6e9a0', lapti: '#c9a15a', iris: '#6fa8e6', nose: '#d9a080', line: '#3a2519', lashes: true, smile: true, bow: '#ffffff' },
  ];
  // скрепка: fur — металл, iris — радужка (у классической нет), browK — толщина бровей
  const CLIPPY = [
    { name: 'Скрепыш', breed: 'Тот самый помощник', fur: '#b9bcc4', line: '#1f1f24', sex: 'm' },
    { name: 'Голди', sex: 'f', fur: '#e6b03a', line: '#1f1f24', iris: '#3a7bd5' },
    { name: 'Уголёк', fur: '#3a3a42', line: '#1f1f24', iris: '#e0962a' },
    { name: 'Рубин', sex: 'f', fur: '#d9382e', line: '#1f1f24', iris: '#5fb85a', bow: '#ffffff' },
    { name: 'Синька', fur: '#3a7bd5', line: '#1f1f24', glasses: true },
  ];
  // свой персонаж: картинка приходит из look.spriteData (окно «Питомцы» → «Свой персонаж»)
  const CUSTOM = [{ name: 'Мой', breed: 'Свой персонаж из картинки', fur: '#8a8f95', iris: '#3b2414', line: '#2a1d18', sex: 'm' }];
  window.PALETTES = { custom: CUSTOM, cat: CATS, dog: DOGS, hamster: HAMSTERS, bird: BIRDS, rabbit: RABBITS, dragon: DRAGONS, kuzya: KUZYA, clippy: CLIPPY };
})();
