
  // === 进化系统 ===
  const EVOLUTIONS = [
    { name: '雏菊',   at: 0,    capBonus: 0,  scale: 1,
      petal: ['#ffd1e6', '#ff6fa3'], core: ['#fff59d', '#fbc02d'],
      ring: '255, 200, 90', fire: false, crystal: false, wide: false },
    { name: '凤凰花', at: 5000, capBonus: 2,  scale: 1.05,
      petal: ['#ffe799', '#ff6a3a'], core: ['#fff3c0', '#ff9d2d'],
      ring: '255, 120, 50', fire: true, crystal: false, wide: false },
    { name: '水晶花', at: 12000, capBonus: 2,  scale: 1.0,
      petal: ['#e3f6ff', '#4fc3ff'], core: ['#f0fbff', '#66d9ff'],
      ring: '90, 210, 255', fire: false, crystal: true, wide: false },
    { name: '莲叶花', at: 25000, capBonus: 2,  scale: 1.28,
      petal: ['#ffe7f2', '#ff8fce'], core: ['#ffffff', '#ffc7e6'],
      ring: '255, 150, 220', fire: false, crystal: false, wide: true },
  ];
  // 当前生效的进化（evolveIndex -1 → 0 号"雏菊"）
  function curEvolution() {
    return EVOLUTIONS[Math.max(0, Math.min(EVOLUTIONS.length - 1, state.evolveIndex + 1))];
  }
  const evolveBanner = document.getElementById('evolve-banner');
  function showEvolveBanner(name) {
    clearTimeout(showEvolveBanner._t);
    evolveBanner.textContent = '🌟 进化：' + name + '！';
    evolveBanner.style.display = 'block';
    requestAnimationFrame(() => evolveBanner.classList.add('show'));
    showEvolveBanner._t = setTimeout(() => {
      evolveBanner.classList.remove('show');
      setTimeout(() => { evolveBanner.style.display = 'none'; }, 450);
    }, 2400);
  }
  // 显示"进入地形"提示（复用顶部横幅）
  function showRegionBanner(name) {
    clearTimeout(showRegionBanner._t);
    evolveBanner.textContent = '🗺️ 进入 · ' + name;
    evolveBanner.style.display = 'block';
    requestAnimationFrame(() => evolveBanner.classList.add('show'));
    showRegionBanner._t = setTimeout(() => {
      evolveBanner.classList.remove('show');
      setTimeout(() => { evolveBanner.style.display = 'none'; }, 450);
    }, 2200);
  }

  // === 地形里程碑 ===
  const BIOMES = [
    { at: 0,    name: '绿野',     skyTop: [135, 206, 235] },
    { at: 2000, name: '风车山丘', skyTop: [116, 198, 228] },
    { at: 7000, name: '海岸云湾', skyTop: [90, 186, 222] },
    { at: 15000, name: '星空云海', skyTop: [26, 28, 62] },
  ];
  // 当前生效地形（biomeIndex 直接对应当前所在的地形），供渐变过渡取用
  function curBiome() {
    return BIOMES[Math.max(0, Math.min(BIOMES.length - 1, state.biomeIndex))];
  }

  // === 成就系统 ===
  const ACH_KEY = 'flower_ach_v2';
  const ACHIEVEMENTS = [
    // ── 里程 · 登顶 ──
    { id: 'dist100',   icon: '🌱', name: '破土微芽', desc: '乘电梯升至 100 米',   ok: s => s.maxHeight >= 1000 },
    { id: 'dist300',   icon: '🎈', name: '告别风筝', desc: '升至 300 米，风筝区渐远', ok: s => s.maxHeight >= 3000 },
    { id: 'dist600',   icon: '🐦', name: '清风送鸟', desc: '升至 600 米，蒜鸟不再追', ok: s => s.maxHeight >= 6000 },
    { id: 'dist1100',  icon: '🚁', name: '无人机之顶', desc: '升至 1100 米，无人机退场', ok: s => s.maxHeight >= 11000 },
    { id: 'dist1600',  icon: '☄️', name: '流星区入口', desc: '升至 1600 米，陨石雨将至', ok: s => s.maxHeight >= 16000 },
    { id: 'dist2000',  icon: '🦘', name: '袋鼠出没', desc: '升至 2000 米，袋鼠宇航员现身', ok: s => s.maxHeight >= 20000 },
    { id: 'dist3000',  icon: '🛸', name: '飞碟追击', desc: '升至 3000 米，宇宙飞船登场', ok: s => s.maxHeight >= 30000 },
    { id: 'dist4000',  icon: '🏔️', name: '登顶天梯', desc: '升至 4000 米通关',       ok: s => s.maxHeight >= 40000 },

    // ── 进化 · 花朵形态 ──
    { id: 'evolve1',   icon: '🔥', name: '凤凰初绽', desc: '进化成凤凰花（500 米）', ok: s => s.evolveIndex >= 0 },
    { id: 'evolveAll', icon: '💎', name: '莲叶终极态', desc: '进化成莲叶花（2500 米）', ok: s => s.evolveIndex >= 2 },

    // ── 阳光 · 收集 · 连击 ──
    { id: 'sunFirst',  icon: '🟡', name: '初沐阳光', desc: '累计收集 1 缕阳光',      ok: s => s.sunCollected >= 1 },
    { id: 'sun50',     icon: '☀️', name: '阳光学徒', desc: '累计收集 50 缕阳光',     ok: s => s.sunCollected >= 50 },
    { id: 'sun200',    icon: '✨', name: '光合大师', desc: '累计收集 200 缕阳光',    ok: s => s.sunCollected >= 200 },
    { id: 'petal1',    icon: '🌷', name: '第一片花瓣', desc: '收集 1 片花瓣',        ok: s => s.petalCollected >= 1 },
    { id: 'petal50',   icon: '🌸', name: '花瓣收藏家', desc: '累计收集 50 片花瓣',   ok: s => s.petalCollected >= 50 },
    { id: 'petal200',  icon: '🌺', name: '花瓣狂人', desc: '累计收集 200 片花瓣',    ok: s => s.petalCollected >= 200 },
    { id: 'full16',    icon: '💐', name: '花团锦簇', desc: '花瓣同时攒满 16 片',      ok: s => s.petals >= 16 },
    { id: 'combo15',   icon: '⚡', name: '连珠成串', desc: '连击达 15',              ok: s => s.maxCombo >= 15 },
    { id: 'combo40',   icon: '🌀', name: '阳光收割机', desc: '连击达 40',            ok: s => s.maxCombo >= 40 },

    // ── 闪避 · 各路段障碍 ──
    { id: 'bird1',     icon: '🐤', name: '初见蒜鸟', desc: '躲过 1 只蒜鸟',         ok: s => s.birdsDodged >= 1 },
    { id: 'bird15',    icon: '🕊️', name: '蒜鸟之友', desc: '累计躲过 15 只蒜鸟',    ok: s => s.birdsDodged >= 15 },
    { id: 'kite1',     icon: '🪁', name: '躲风筝', desc: '躲过 1 只风筝',           ok: s => (s.airDodgedBy || {}).kite >= 1 },
    { id: 'kite10',    icon: '🎐', name: '风筝老手', desc: '累计躲过 10 只风筝',    ok: s => (s.airDodgedBy || {}).kite >= 10 },
    { id: 'drone1',    icon: '🚁', name: '机敏避让', desc: '躲过 1 架无人机',        ok: s => (s.airDodgedBy || {}).drone >= 1 },
    { id: 'drone10',   icon: '🛡️', name: '无人机克星', desc: '累计躲过 10 架无人机', ok: s => (s.airDodgedBy || {}).drone >= 10 },
    { id: 'plane1',    icon: '✈️', name: '鹰翔规避', desc: '躲过 1 架大飞机',        ok: s => (s.airDodgedBy || {}).plane >= 1 },
    { id: 'plane5',    icon: '🛩️', name: '云端王牌', desc: '累计躲过 5 架大飞机',   ok: s => (s.airDodgedBy || {}).plane >= 5 },
    { id: 'meteor1',   icon: '🪨', name: '首次躲陨', desc: '躲过 1 颗陨石',          ok: s => s.meteorsDodged >= 1 },
    { id: 'meteor20',  icon: '☄️', name: '流星舞者', desc: '累计躲过 20 颗陨石',    ok: s => s.meteorsDodged >= 20 },
    { id: 'kang1',     icon: '🦘', name: '袋鼠退散', desc: '躲过 1 只袋鼠宇航员',   ok: s => (s.airDodgedBy || {}).kang >= 1 },
    { id: 'kang5',     icon: '🥊', name: '太空拳击手', desc: '累计躲过 5 只袋鼠宇航员', ok: s => (s.airDodgedBy || {}).kang >= 5 },
    { id: 'ship1',     icon: '👽', name: '逃出生天', desc: '躲过 1 艘宇宙飞船',      ok: s => (s.airDodgedBy || {}).ship >= 1 },
    { id: 'ship5',     icon: '🌠', name: '星际舞者', desc: '累计躲过 5 艘宇宙飞船', ok: s => (s.airDodgedBy || {}).ship >= 5 },
    { id: 'airAll',    icon: '💠', name: '全能闪避', desc: '躲过全部五种空中物',    ok: s => (s.airDodgedBy || {}).kite && (s.airDodgedBy || {}).drone && (s.airDodgedBy || {}).plane && (s.airDodgedBy || {}).kang && (s.airDodgedBy || {}).ship },
    { id: 'evader50',  icon: '🎯', name: '闪避大师', desc: '累计躲过 50 次天上来客', ok: s => s.birdsDodged + s.meteorsDodged + Object.values(s.airDodgedBy || {}).reduce((a, b) => a + b, 0) >= 50 },

    // ── 老虎机 · 道具 ──
    { id: 'slot1',     icon: '🎰', name: '手气来了', desc: '老虎机中奖 1 次',        ok: s => s.slotWins >= 1 },
    { id: 'slot20',    icon: '🍀', name: '欧皇附体', desc: '老虎机累计中奖 20 次',   ok: s => s.slotWins >= 20 },
    { id: 'free1',     icon: '🎁', name: '免费初体验', desc: '使用 1 次免费抽取',    ok: s => s.freeSpinUsed >= 1 },
    { id: 'free15',    icon: '🎡', name: '白嫖大师', desc: '累计使用 15 次免费抽取', ok: s => s.freeSpinUsed >= 15 },
    { id: 'klk1',      icon: '🌿', name: '金坷垃上头', desc: '触发 1 次金坷垃猛冲',  ok: s => s.growBoostHits >= 1 },
    { id: 'growMax',   icon: '🧪', name: '强壮如牛', desc: '累计抽中 3 次野生狗奶',  ok: s => (s.milkCount || 0) >= 3 },
    { id: 'swordHold', icon: '🗡️', name: '身怀名刀', desc: '抽中并持有名刀司命',    ok: s => (s.swordGot || 0) >= 1 },
    { id: 'swordSave', icon: '⚔️', name: '刀下留人', desc: '名刀司命护体挡下一次死亡', ok: s => (s.swordUse || 0) >= 1 },
    { id: 'grandAll',  icon: '💫', name: '道具大满贯', desc: '四种老虎机道具全部中奖过', ok: s => s.slotGot && s.slotGot['🌸'] && s.slotGot['🌿'] && s.slotGot['🧪'] && s.slotGot['⚔️'] },

    // ── 天气 · 见闻 ──
    { id: 'wxRain',    icon: '🌧️', name: '雨中漫步', desc: '见证过小雨',            ok: s => s.weatherSeen && s.weatherSeen.rain },
    { id: 'wxStarry',  icon: '✨', name: '星夜憧憬', desc: '见证过星空夜',          ok: s => s.weatherSeen && s.weatherSeen.starry },
    { id: 'wxAurora',  icon: '🌌', name: '极光初见', desc: '见证过极光',            ok: s => s.weatherSeen && s.weatherSeen.aurora },
    { id: 'wxStorm',   icon: '⛈️', name: '雷暴行者', desc: '见证过雷暴',            ok: s => s.weatherSeen && s.weatherSeen.storm },
    { id: 'wxSnow',    icon: '🌨️', name: '雪中漫步', desc: '见证过下雪',            ok: s => s.weatherSeen && s.weatherSeen.snow },
    { id: 'wxWind',    icon: '🌬️', name: '驭风者', desc: '见证过大风',              ok: s => s.weatherSeen && s.weatherSeen.wind },
    { id: 'wxAll',     icon: '🌈', name: '气象学家', desc: '见证全部 6 种天气',      ok: s => s.weatherSeen && s.weatherSeen.rain && s.weatherSeen.starry && s.weatherSeen.aurora && s.weatherSeen.storm && s.weatherSeen.snow && s.weatherSeen.wind },

    // ── 逆境 · 生存 ──
    { id: 'rainRes',   icon: '💧', name: '雨中顽强者', desc: '被雨打掉花瓣后仍存活', ok: s => s.rainLoseCount >= 1 },
    { id: 'closeCall', icon: '🍂', name: '命悬一线', desc: '只剩 1 片花瓣并撑过 15 秒', ok: s => s.criticalHold >= 15 },
    { id: 'stormRes',  icon: '⚡', name: '雷暴生存者', desc: '雷暴天气累计停留 20 秒', ok: s => s.stormTime >= 20 },
    { id: 'headwind',  icon: '🌪️', name: '逆风而上', desc: '大风天里再长高 200 米',  ok: s => s.windGrowHeight >= 2000 },
    { id: 'hunter',    icon: '🏆', name: '成就猎人', desc: '解锁 15 项成就',          ok: s => Object.keys(s.achievements || {}).length >= 15 },
  ];
  try { state.achievements = JSON.parse(localStorage.getItem(ACH_KEY) || '{}'); } catch (e) { state.achievements = {}; }

  // 成就列表面板
  const achPanel = document.getElementById('ach-panel');
  const achListEl = document.getElementById('ach-list');
  function renderAchievements() {
    achListEl.innerHTML = '';
    for (const a of ACHIEVEMENTS) {
      const done = !!state.achievements[a.id];
      const row = document.createElement('div');
      row.className = 'ach-row' + (done ? ' done' : '');
      const stamp = done ? ' <span class="ach-date">· ' + new Date(state.achievements[a.id]).toLocaleDateString() + '</span>' : '';
      row.innerHTML =
        '<div class="ach-icon">' + a.icon + '</div>' +
        '<div class="ach-info"><div class="ach-name">' + a.name + stamp + '</div>' +
        '<div class="ach-desc">' + a.desc + '</div></div>' +
        '<div class="ach-check">' + (done ? '✓' : '✕') + '</div>';
      achListEl.appendChild(row);
    }
  }
  const achBtn = document.getElementById('ach-btn');
  const achClose = document.getElementById('ach-close');
  achBtn.addEventListener('click', () => {
    const show = achPanel.style.display === 'block';
    // 与设置面板互斥：打开成就时收起设置
    const settingsPanel = document.getElementById('settings-panel');
    if (!show && settingsPanel) settingsPanel.classList.remove('open');
    achPanel.style.display = show ? 'none' : 'block';
    if (!show) {
      checkAchievements(); // 打开时重新评估：六种天气都见过即解锁"气象学家"
      renderAchievements();
    }
  });
  achClose.addEventListener('click', () => { achPanel.style.display = 'none'; });
  // 清空成就：删除本地存档并重开一局（累计统计归零，避免条件满足瞬间自动重解锁）
  const achClear = document.getElementById('ach-clear');
  achClear.addEventListener('click', () => {
    localStorage.removeItem(ACH_KEY);
    state.achievements = {};
    state.weatherSeen = {};  // 天气见识统计也必须清零，否则天气成就会立即自动重解锁
    resetGame();
    renderAchievements();
  });
  achPanel.addEventListener('click', e => e.stopPropagation());

  // 成就解锁横幅提示
  const achBanner = document.getElementById('ach-banner');
  function showAchBanner(icon, name) {
    clearTimeout(showAchBanner._t);
    achBanner.textContent = '🏆 成就达成 · ' + icon + ' ' + name;
    achBanner.style.display = 'block';
    requestAnimationFrame(() => achBanner.classList.add('show'));
    showAchBanner._t = setTimeout(() => {
      achBanner.classList.remove('show');
      setTimeout(() => { achBanner.style.display = 'none'; }, 450);
    }, 2600);
  }
  function checkAchievements() {
    for (const a of ACHIEVEMENTS) {
      if (!state.achievements[a.id] && a.ok(state)) {
        state.achievements[a.id] = Date.now();
        try { localStorage.setItem(ACH_KEY, JSON.stringify(state.achievements)); } catch (e) {}
        showAchBanner(a.icon, a.name);
        if (achPanel.style.display === 'block') renderAchievements();
      }
    }
  }

  // 初始化根（根部固定在土地上：地面线 = baseY，世界坐标永不改变）
  function resetBase() {
    state.baseX = W / 2;
    state.baseY = H - 160; // 地面线离屏幕底 160px，土层有足够厚度
    state.headX = state.baseX;
    state.headY = state.baseY;
    state.points = [{ x: state.baseX, y: state.baseY }];
    state.segments = [];
  }
  resetBase();

  // === 装饰生成 ===
  function rand(a, b) { return a + Math.random() * (b - a); }
  // 近前景漂荡云：屏幕坐标、缓慢横移并循环，用来遮挡视野增加难度
  // 关卡解锁高度：云层 600 米浮现、1600 米散尽后由流星（陨石）接替
  // 注：HUD 以米显示 = maxHeight(px)/10，故 600 米=6000px、1600 米=16000px
  const CLOUD_UNLOCK_AT = 6000;   // 云层（遮挡视野）解锁高度（600 米云层浮现）
  const CLOUD_CLOSE_AT = 16000;  // 云层结束高度（1600 米云层散尽）
  const BIRD_UNLOCK_AT = 2000;   // 飞鸟开始高度（200 米出现）
  const BIRD_CLOSE_AT = 6000;   // 飞鸟结束高度（600 米后不再有鸟）
  const METEOR_UNLOCK_AT = 16000; // 陨石解锁高度（1600 米云散后流星接替）
  const METEOR_CLOSE_AT = 30000;  // 陨石结束高度（3000 米后由宇宙飞船接替）
  // 空中物体序列（从下往上逐级演绎：风筝→鸟→无人机→大飞机→陨石→宇宙飞船）
  const KITE_CLOSE_AT = 3000;    // 风筝结束高度（0~300 米，鸟之后）
  const DRONE_AT = 6000;         // 无人机开始高度（600 米，接替鸟）
  const DRONE_CLOSE_AT = 11000;  // 无人机结束高度（1100 米）
  const PLANE_AT = 11000;        // 大飞机开始高度（1100 米）
  const PLANE_CLOSE_AT = 16000;  // 大飞机结束高度（1600 米，接替流星/陨石）
  const KANG_AT = 20000;         // 袋鼠宇航员开始高度（2000 米，与陨石一同出现）
  const KANG_CLOSE_AT = 28000;   // 袋鼠宇航员结束高度（2800 米）
  const SHIP_AT = 30000;         // 宇宙飞船开始高度（3000 米，最终敌人）

  function initDriftClouds(dense = 1) {
    state.driftClouds = [];
    const n = Math.floor(7 * dense);
    const aMin = dense > 1 ? 0.8 : 0.6;
    for (let i = 0; i < n; i++) {
      state.driftClouds.push({
        x: rand(0, W),
        y: rand(20, H * 0.75),   // 基准 y（上下漂浮在中浮动）
        r: rand(45, 85),
        v: rand(22, 46) * (Math.random() < 0.5 ? -1 : 1), // 横移更快、方向随机
        a: rand(aMin, 0.95),
        s: rand(0.6, 1.3),   // 水平拉伸
        phase: rand(0, Math.PI * 2), // 漂浮相位
        yAmp: rand(8, 24),   // 上下浮动幅度
        ySpeed: rand(0.4, 1.1), // 漂浮频率
      });
    }
  }
