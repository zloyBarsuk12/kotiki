// Каталог подарков: один список для окна «Питомцы» (что послать), окна подарка (как показать)
// и питомцев (как реагировать). food: кто ест — 'all' | 'cat' | 'dog' | 'herb' (хомяк, кролик);
// pop — шарики, лопают по одному; prop — старые подарки, которые появляются своей игрушкой;
// text — открытка с подписью; dur — сколько лежит, мс.
window.GIFTS = {
  flowers:  { ico: '💐', name: 'букет', dur: 300000 },
  candy:    { ico: '🍬', name: 'конфеты', food: 'all', dur: 240000 },
  balloons: { ico: '🎈', name: 'шарики', pop: true, dur: 300000 },
  cake:     { ico: '🎂', name: 'торт', food: 'all', dur: 240000 },
  teddy:    { ico: '🧸', name: 'мишка', dur: 360000 },
  postcard: { ico: '💌', name: 'открытка', text: true, dur: 360000 },
  bone:     { ico: '🦴', name: 'косточка', food: 'dog', dur: 240000 },
  fish:     { ico: '🐟', name: 'рыбка', food: 'cat', dur: 240000 },
  carrot:   { ico: '🥕', name: 'морковка', food: 'herb', dur: 240000 },
  pie:      { ico: '🥧', name: 'пирожок', food: 'all', dur: 240000 },
  ball:     { ico: '🎾', name: 'мячик', prop: 'ball' },
  yarn:     { ico: '🧶', name: 'клубок', prop: 'yarn' },
  bubbles:  { ico: '🫧', name: 'пузыри', prop: 'bubbles' },
};
