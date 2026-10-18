/* 中文 for FlaTTy Birds: the words on the page, the toasts and the ? panel (Kit.lang, from kit/lang.js).
   The kids' names and the game's name and logo stay in English on purpose. The station roundels show names too,
   except the METRO one, which js/scene.js draws through Kit.lang.t and redraws when the language changes. */
(function () {
  const L = Kit.lang;
  L.keep(['FlaTTy Birds', 'Fla', 'TT', 'Birds', 'TEDDY', 'TOMMY', 'Teddy', 'Tommy', 'ZOOM', 'LUNA', 'BOLT', 'BRUNO', 'Claude Code', 'Esc']);

  L.add({
    // title screen
    'Jetpack through the train towers with Teddy & Tommy!': '和 Teddy、Tommy 一起，背上喷气背包飞过火车塔！',
    'PICK YOUR FLYER': '选一个飞行员', 'Pick your flyer': '选一个飞行员', 'ZOMBIE': '僵尸',
    'Easy mode (E): wider gaps, slower, bouncy floor': '简单模式 (E)：空隙更宽，飞得更慢，地面会把你弹起来',
    'EASY OFF': '简单：关', 'EASY ON': '简单：开', '(EASY)': '（简单）',
    'or click: hop': '或点击：往上飞', 'pick a flyer': '选飞行员', 'call': '叫', 'easy mode': '简单模式', 'sound': '声音',
    'Tap anywhere to hop!': '点屏幕任意地方就能往上飞！', "'S BEST": ' 的最高分',
    // buttons and their tooltips
    'Pause (P)': '暂停 (P)', 'Pause': '暂停', 'Sound (M)': '声音 (M)', 'Sound on or off': '声音 开 / 关',
    'Call your buddy (T)': '叫兄弟来帮忙 (T)', 'Your buddy is guarding you': '兄弟在保护你',
    // playing
    'TAP TO FLY!': '点一下就飞！', 'GO!': '出发！', 'NEW BEST!': '新纪录！', 'SWISH!': '唰！进球！',
    // pause and game over
    'P · Esc · Space · Tap': 'P · Esc · 空格 · 点一下',
    'BONK!': '咚！', 'YAY!': '耶！', 'COINS': '金币', '★ NEW BEST! ★': '★ 新纪录！★', '↻ RUN AGAIN': '↻ 再飞一次',
    'Pick another flyer': '换一个飞行员', 'CHANGE': '换人',
    'LOADING…': '加载中…',
    'This browser can’t run WebGL, so FlaTTy Birds can’t start.': '这个浏览器跑不了 WebGL，FlaTTy Birds 开不了。',
    // the station roundel drawn on the scenery (js/scene.js)
    METRO: '地铁',
    // the ? panel (js/keys.js)
    'hop': '往上飞', 'pick a flyer (title)': '选飞行员（标题页）',
    "Tap anywhere to hop. Tap your brother's face (bottom right) to call him.": '点屏幕任意地方就能往上飞。点右下角兄弟的头像，叫他来帮忙。',
  });

  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  L.rule(/^(.+)'S BEST$/, '$1 的最高分');
  L.rule(/^(.+)'S BEST \(EASY\)$/, '$1 的最高分（简单）');
  L.rule(/^BEST (\d+)$/, '最高分 $1');
  L.rule(/^Call (\S+) \(T\)$/, '叫 $1 来帮忙 (T)');
  L.rule(/^(\S+) is guarding you$/, '$1 在保护你');
  L.rule(/^(.+)'S HERE!$/, '$1 来啦！');
  L.rule(/^(.+) SAVED YOU!$/, '$1 救了你！');
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE BOX|COOKIE|WATERMELON|BANANA) FROM (.+)!$/, (m, emoji, item, who) => `${emoji} ${who} 送来的${TREAT[item]}！`);
})();
