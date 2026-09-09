
  // === 随机天气系统 ===
  const WEATHER_LABEL = {
    sunny: '☀️ 晴天',
    rain: '🌧️ 小雨',
    starry: '✨ 星空夜',
    aurora: '🌌 极光',
    storm: '⚡ 雷暴',
    snow: '🌨️ 下雪',
    wind: '🌬️ 大风',
  };
  // 每种天气对核心变量的影响
  function weatherEffects() {
    const k = state.weather.kind;
    return {
      multGrowth: k === 'rain' ? 0.6 : 0,   // 小雨生长加速
      multSun: k === 'starry' ? 1 : 0,      // 星空夜阳光翻倍
      birdFast: k === 'storm',              // 雷暴飞鸟更密
      meteorFast: k === 'storm',            // 雷暴陨石更密
    };
  }
  function updateWeatherBanner() {
    const b = document.getElementById('weather-banner');
    const k = state.weather.kind;
    if (k === 'sunny' && state.weather.active <= 0 && state.weather.announce <= 0) {
      b.classList.remove('show');
      setTimeout(() => { if (!b.classList.contains('show')) b.style.display = 'none'; }, 400);
      return;
    }
    b.style.display = 'block';
    b.textContent = state.weather.announce > 0
      ? '预告：' + WEATHER_LABEL[k] + ' …'
      : WEATHER_LABEL[k];
    b.classList.add('show');
  }
  function spawnRain() {
    const w = state.weather;
    w.rain = [];
    const n = Math.min(150, 55 + Math.floor(W * H / 15000));
    for (let i = 0; i < n; i++) {
      w.rain.push({
        x: rand(0, W),
        y: rand(-60, H),
        len: rand(10, 18),
        speed: rand(650, 950),
      });
    }
  }
  function updateWeather(dt) {
    const w = state.weather;
    // 正在经历的天气即时记录为成就见识（下雨/星空等一旦生效立即解锁对应成就）
    if (w.kind !== 'sunny') state.weatherSeen[w.kind] = 1;
    // 降雨粒子推进
    if (w.kind === 'rain' || w.kind === 'storm') {
      for (const d of w.rain) {
        d.y += d.speed * dt;
        d.x += d.speed * 0.28 * dt;
        if (d.y > H + 10) { d.y = -8; d.x = rand(0, W); }
      }
      // 下雨有概率掉花瓣：雨真正下起来时（w.active>0），每隔 3.5~8 秒判定一次，约四成概率掉 1 瓣
      if (w.active > 0) {
        state.rainPetalTimer -= dt;
        if (state.rainPetalTimer <= 0) {
          state.rainPetalTimer = rand(3.5, 8);
          if (Math.random() < 0.45) {
            state.petals = Math.max(0, state.petals - 1);
            state.rainLoseCount++; // 成就统计：雨天损失花瓣（存活时计）
            state.hitFlash = Math.max(state.hitFlash, 0.6);
            emitParticles(state.headX, state.headY, '#7ec8ff', 12); // 雨点水花
            if (state.petals <= 0) {
              state.petals = 0;
              triggerGameOver();
            }
          }
        }
      }
    }
    // 雷暴随机闪电
    if (w.kind === 'storm') {
      if (Math.random() < dt * 1.4) w.stormFlash = 1;
      if (w.stormFlash > 0) w.stormFlash = Math.max(0, w.stormFlash - dt * 6);
    }
    // 大风：随机方向、节奏的强力阵风，把花推向左右（附带细碎抖动）[力度已调为原来的 2/3]
    if (w.kind === 'wind') {
      // 随机间隔决定下一次强风：方向随机、强度随机、持续时间随机
      state.windPush -= dt;
      if (state.windPush <= 0) {
        state.windDir = Math.random() < 0.5 ? 1 : -1;
        state.windPow = rand(2.2, 5) * (2 / 3);
        state.windPush = rand(0.5, 2.6);
      }
      // 阵风主导力 + 细碎抖动（非均匀、随机游走的组合）
      const jitter = (Math.random() * 2 - 1) * 47;
      const force = state.windDir * state.windPow * 160 + jitter;
      state.headX += force * dt * 0.5;
      state.headX = clampX(state.headX);
      state.windPulse += dt * 3;
    }

    // 事件进行中
    if (w.active > 0) {
      w.active -= dt;
      if (w.active <= 0) {
        w.kind = 'sunny';
        w.timer = rand(14, 22);
        w.rain = [];
        w.stormFlash = 0;
        initDriftClouds(); // 云恢复默认密度
        updateWeatherBanner();
      }
      return;
    }
    // 预告阶段
    if (w.announce > 0) {
      w.announce -= dt;
      if (w.announce <= 0) {
        w.active = rand(8, 12);
        if (w.kind === 'rain' || w.kind === 'storm') spawnRain();
        if (w.kind === 'aurora') initDriftClouds(2.0); // 极光：云更密、更易挡视野
        updateWeatherBanner();
        // 小雨真正开始：随机播放一句雨声音效
        if (w.kind === 'rain') {
          const rainVoices = [
            '听雨的声音，一滴滴清晰.mp3',
            '真希望雨能下不停.mp3',
          ];
          playSound(rainVoices[Math.floor(Math.random() * rainVoices.length)]);
        }
      }
      return;
    }
    // 晴天倒计时 → 触发随机事件
    w.timer -= dt;
    if (w.timer <= 0) {
      // 加权随机：星空夜出现权重略高（2/8），避免与极光混淆难碰到
      const kinds = ['rain', 'starry', 'starry', 'aurora', 'storm', 'snow', 'wind'];
      w.kind = kinds[Math.floor(Math.random() * kinds.length)];
      w.announce = 2.2;
      state.weatherSeen[w.kind] = 1; // 成就统计：见识过该天气
      updateWeatherBanner();
    }
  }
  // 天幕特效：星星 / 极光 / 闪电（画在天空渐变之后、太阳之前）
  function drawWeatherSky() {
    const k = state.weather.kind;
    const t = performance.now() / 1000;
    if (k === 'starry' || k === 'aurora') {
      // 星星（缓慢向下流动 + 闪烁，% 循环补位）
      for (let i = 0; i < 45; i++) {
        const px = (i * 97 + 13) % W;
        const py = (((i * 59 + 7) + t * 20) % (H * 0.72));
        const tw = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.7);
        ctx.globalAlpha = 0.25 + 0.6 * tw;
        ctx.fillStyle = '#fff';
        ctx.fillRect(px, py, 2, 2);
      }
      ctx.globalAlpha = 1;
    }
    if (k === 'aurora') {
      const gx = H * 0.42;
      const g = ctx.createLinearGradient(0, 0, 0, gx);
      g.addColorStop(0, 'rgba(70,255,160,0.42)');
      g.addColorStop(0.5, 'rgba(120,220,255,0.22)');
      g.addColorStop(1, 'rgba(70,255,160,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let x = 0; x <= W; x += 20) {
        ctx.lineTo(x, Math.sin(x * 0.02 + t * 0.8) * 24 + H * 0.16);
      }
      ctx.lineTo(W, 0);
      ctx.closePath();
      ctx.fill();
    }
    if (k === 'storm' && state.weather.stormFlash > 0) {
      ctx.fillStyle = `rgba(225, 238, 255, ${state.weather.stormFlash * 0.55})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
  // 前景雨（画在云之上，作为最前遮挡层）
  function drawRain() {
    const k = state.weather.kind;
    if (k !== 'rain' && k !== 'storm') return;
    ctx.strokeStyle = 'rgba(180, 210, 255, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const d of state.weather.rain) {
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - d.len * 0.28, d.y + d.len);
    }
    ctx.stroke();
  }
  // 前景雪（下雪天，缓缓飘落、左右轻摆）
  function drawSnow() {
    const k = state.weather.kind;
    if (k !== 'snow') return;
    const t = performance.now() / 1000;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (let i = 0; i < 65; i++) {
      const x = (i * 137 + 40 + Math.sin(t * 0.8 + i * 1.3) * 26) % W;
      const y = (t * (24 + (i % 5) * 10) + i * 43) % (H + 40) - 20;
      const s = 1.5 + (i % 4);
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // 大风风纹（斜向短线掠过，方向随阵风左右翻转，表现狂风横扫）
  function drawWindStreaks() {
    const k = state.weather.kind;
    if (k !== 'wind') return;
    const t = performance.now() / 1000;
    const dir = state.windDir; // +1 吹向右，-1 吹向左
    const span = W + 200;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 18; i++) {
      const sp = 340 + (i % 4) * 90;
      let bx = (t * sp * dir + i * 137) % span;
      if (bx < 0) bx += span;
      bx -= 100;
      const by = 30 + (i * 97) % (H * 0.7) + Math.sin(t * 2 + i) * 14;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      // 尾部朝来风方向延长（吹右则尾在左，吹左则尾在右）
      ctx.lineTo(bx - 34 * dir, by + 14);
      ctx.stroke();
    }
  }

  // 稳定的伪随机：基于整数种子，确保每朵远景云的位置/大小固定
  const hash = n => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  // 远景流动云：锚定世界高度，随相机上升向下流动，作为"在升高"的参照
  function drawSkyFlowClouds(t) {
    if (state.maxHeight >= PLANE_AT) return; // 出现大飞机（1100米）后不再显示
    const band = 460; // 每朵云的纵向间距带
    const alpha = 0.5; // 远景半透明，不遮挡视野
    const startRow = Math.floor((state.cameraY - 120) / band);
    const rows = Math.ceil((H + 240) / band) + 1;
    for (let k = 0; k < rows; k++) {
      const rowY = (startRow + k) * band;
      for (let c = 0; c < 3; c++) {
        const seed = k * 13 + c * 7; // 稳定的行内种子
        const hx = 0.08 + hash(seed) * 0.84;          // 横向基准 0.08~0.92
        const size = 0.5 + hash(seed + 1) * 0.55;     // 大小比例
        const drift = (hash(seed + 2) - 0.5) * 24;    // 缓慢水平漂移速度
        const phase = hash(seed + 3) * 6.28;
        // 屏幕坐标：世界行在屏幕上的位置（相对相机），并叠加极缓的水平漂移和上下浮动
        const sx = hx * W + drift * t + Math.sin(t * 0.12 + phase) * 8;
        const sy = rowY - state.cameraY + Math.sin(t * 0.2 + phase) * 6;
        if (sy < -120 || sy > H + 120) continue;
        drawCloudShape(sx, sy, 44, size, `rgba(255,255,255,${alpha * 0.8})`);
      }
    }
  }
  function drawDriftClouds() {
    const t = performance.now() / 1000;
    // 云层只在 400 米~1000 米之间显示：到 400 米淡入、过 1000 米淡出
    const enter = Math.min(1, Math.max(0, (state.maxHeight - CLOUD_UNLOCK_AT) / 400));
    const exit = Math.min(1, Math.max(0, (CLOUD_CLOSE_AT - state.maxHeight) / 400));
    const fade = Math.min(enter, exit);
    for (const c of state.driftClouds) {
      // 随机漂浮：加速横移 + 上下正弦浮动
      c.x += c.v * 0.016;
      const cy = c.y + Math.sin(t * c.ySpeed + c.phase) * c.yAmp;
      if (c.v > 0 && c.x - c.r * c.s > W + 80) c.x = -c.r * c.s - 40;
      if (c.v < 0 && c.x + c.r * c.s < -80) c.x = W + c.r * c.s + 40;
      drawCloudShape(c.x, cy, c.r, c.s, `rgba(255,255,255,${c.a * fade})`);
    }
  }
  function drawCloudShape(x, y, r, sx, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, 1);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.arc(r * 0.7, 4, r * 0.85, 0, Math.PI * 2);
    ctx.arc(-r * 0.7, 4, r * 0.85, 0, Math.PI * 2);
    ctx.arc(r * 0.2, -r * 0.4, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  function initGrass() {
    state.grassTufts = [];
    // 世界坐标：覆盖镜头水平移动的整个范围（cameraX ∈ [-W/2, W/2]）
    for (let i = 0; i < 140; i++) {
      state.grassTufts.push({
        x: rand(-W * 0.6, W * 1.6),
        h: rand(8, 22),
        sway: rand(0, Math.PI * 2),
        swaySpeed: rand(0.6, 1.4),
      });
    }
  }
  // 花园里的小花、蘑菇、石头（让场景更具体 — 世界坐标，固定在土地上）
  function initGarden() {
    state.gardenFlowers = [];
    state.mushrooms = [];
    state.stones = [];
    for (let i = 0; i < 26; i++) {
      const colors = ['#ff7eb6', '#ffd54a', '#b388ff', '#fff176', '#ff8a65', '#80deea'];
      state.gardenFlowers.push({
        x: rand(-W * 0.6, W * 1.6),
        h: rand(14, 28),
        color: colors[Math.floor(Math.random() * colors.length)],
        sway: rand(0, Math.PI * 2),
        swaySpeed: rand(0.5, 1.2),
        swayAmp: rand(2, 5),
      });
    }
    for (let i = 0; i < 14; i++) {
      state.mushrooms.push({
        x: rand(-W * 0.6, W * 1.6),
        h: rand(10, 18),
        capW: rand(14, 22),
        capH: rand(8, 14),
        capColor: Math.random() < 0.6 ? '#e74c3c' : '#a0522d',
      });
    }
    for (let i = 0; i < 20; i++) {
      state.stones.push({
        x: rand(-W * 0.6, W * 1.6),
        r: rand(3, 8),
        shade: rand(0.6, 0.9),
      });
    }
  }
  // 蝴蝶 — 在花头附近飞舞
  function initButterflies() {
    state.butterflies = [];
    for (let i = 0; i < 4; i++) {
      state.butterflies.push({
        x: W / 2 + rand(-60, 60),
        y: H - 40 - rand(40, 180),
        vx: rand(-30, 30),
        vy: rand(-20, -5),
        wing: 0,
        wingSpeed: rand(12, 18),
        color: ['#ff9eb5', '#ffe066', '#a0d8ef', '#ce93d8'][Math.floor(Math.random() * 4)],
        size: rand(6, 10),
        target: null,
        retarget: 0,
      });
    }
  }
  initGrass();
  initDriftClouds();
  initGarden();
  initButterflies();

  // === 老虎机 ===
  const SLOT_SYMBOLS = ['🌸', '🌿', '🧪', '⚔️'];
  const SLOT_COLORS = { '🌸': '#ff6fa3', '🌿': '#4caf50', '🧪': '#8d6e63', '⚔️': '#d3a4ff' };
  const SLOT_COST = 3;
  const FERT_IMG_SRC = 'photo/' + encodeURIComponent('野生狗奶.png'); // 化肥图标图片
  const KLK_IMG_SRC = 'photo/' + encodeURIComponent('金坷垃.png');  // 金坷垃图片
  const FLOWER_IMG_SRC = 'photo/' + encodeURIComponent('花朵.png'); // 花朵图片
  const MINGDAO_IMG_SRC = 'photo/' + encodeURIComponent('名刀司命.png'); // 名刀司命图片
  const SWORD_SYM = '⚔️';                                // 名刀司命符号
  const SLOT_IMG_SRC = {                                  // 用图片显示的符号
    '🌸': FLOWER_IMG_SRC,
    '🌿': KLK_IMG_SRC,
    '🧪': FERT_IMG_SRC,
    '⚔️': MINGDAO_IMG_SRC
  };
  // 把符号转成可显示的内容：所有符号都用图片显示
  function symbolHtml(sym, cls) {
    const src = SLOT_IMG_SRC[sym];
    if (src) {
      return '<img class="slot-img' + (cls ? ' ' + cls : '') + '" src="' + src + '">';
    }
    return sym;
  }
  function renderSymbol(el, sym) {
    el.innerHTML = symbolHtml(sym, 'slot-img-fill');
  }
  const slotReels = Array.from(document.querySelectorAll('.reel'));
  const slotPullBtn = document.getElementById('slot-pull');
  const slotStatusEl = document.getElementById('slot-status');

  // 免费转上限与积累速率：每 100 米 / 每 30 秒各得 1 次免费
  const FREE_SPIN_CAP = 3;
  const FREE_SPIN_METERS = 100;
  const FREE_SPIN_TIME = 30;
  const FREE_AUTO_SPIN_TIME = 8; // 有免费次数却闲置超过 8 秒：自动抽一次

  // 状态行常驻提示（无动态消息时显示关键规则）
  const SLOT_HINT = '☀️3抽1次 · 每100米/30秒送🎁';
  let slotMsgTimer = null; // 中奖/未中奖提示后的恢复定时器

  function updateSlotFreeDisplay(pop) {
    if (state.freeSpins > 0) {
      slotStatusEl.innerHTML = '🎁 ×' + state.freeSpins + ' 免费抽';
      slotStatusEl.classList.remove('win');
      slotStatusEl.classList.add('has');
    } else {
      slotStatusEl.textContent = SLOT_HINT;
      slotStatusEl.classList.remove('win', 'has');
    }
    if (pop) {
      slotStatusEl.classList.remove('pop');
      void slotStatusEl.offsetWidth; // 重触发动画
      slotStatusEl.classList.add('pop');
    }
  }

  // 每帧由游戏主循环调用：按米数/时间积累免费次数
  function accrueFreeSpins(dt) {
    let gained = false;
    // 未满上限时才积累免费次数
    if (state.freeSpins < FREE_SPIN_CAP) {
      const meters = state.maxHeight / 10;
      state.freeSpinMeterAcc += meters - state.lastSpinMeter;
      state.lastSpinMeter = meters;
      while (state.freeSpinMeterAcc >= FREE_SPIN_METERS && state.freeSpins < FREE_SPIN_CAP) {
        state.freeSpinMeterAcc -= FREE_SPIN_METERS;
        state.freeSpins++;
        gained = true;
      }
      state.freeSpinTimeAcc += dt;
      while (state.freeSpinTimeAcc >= FREE_SPIN_TIME && state.freeSpins < FREE_SPIN_CAP) {
        state.freeSpinTimeAcc -= FREE_SPIN_TIME;
        state.freeSpins++;
        gained = true;
      }
      if (state.freeSpins >= FREE_SPIN_CAP) {
        state.freeSpinMeterAcc = 0;
        state.freeSpinTimeAcc = 0;
      }
    }
    if (gained) {
      state.freeIdleTime = 0; // 刚获得免费次数，重新计时
      updateSlotFreeDisplay(true);
      updateSlotPullButton(); // 按钮切换到"免费抽取"，无需阳光
      // 刚攒满上限时，花头旁弹窗提醒按空格抽奖
      if (state.freeSpins >= FREE_SPIN_CAP) {
        showStrongBubble('🎁 免费抽奖已满，按空格键抽奖！');
      }
    }
    // 有免费次数却闲置太久：自动抽一次（不在转轮旋转期间触发）
    if (state.freeSpins > 0 && !state.slot.spinning.some(s => s)) {
      state.freeIdleTime += dt;
      if (state.freeIdleTime >= FREE_AUTO_SPIN_TIME) {
        state.freeIdleTime = 0;
        pullSlot();
        showStrongBubble('🎰 已自动抽奖');
      }
    }
  }

  function updateSlotPullButton() {
    if (!state.started) {        // 未开局：按钮禁用，仅作提示
      slotPullBtn.disabled = true;
      slotPullBtn.textContent = '⌨️ 空格抽奖';
      return;
    }
    const anySpinning = state.slot.spinning.some(s => s);
    if (anySpinning) {
      slotPullBtn.disabled = true;
      slotPullBtn.textContent = '抽奖中';
    } else if (state.freeSpins > 0) {
      slotPullBtn.disabled = false;
      slotPullBtn.textContent = '🎁 免费抽取';
    } else if (state.sun < SLOT_COST) {
      slotPullBtn.disabled = true;
      slotPullBtn.textContent = '阳光不足';
    } else {
      slotPullBtn.disabled = false;
      slotPullBtn.textContent = '⌨️ 空格抽奖';
    }
  }

  function pullSlot() {
    if (!state.started || state.paused || state.gameOver) return; // 未开始/暂停/结算时不抽奖
    if (state.slot.spinning.some(s => s)) return;
    state.freeIdleTime = 0;   // 玩家动手抽奖：重置自动抽的闲置计时
    const useFree = state.freeSpins > 0;
    if (!useFree && state.sun < SLOT_COST) return;
    if (useFree) {
      state.freeSpins--;
      state.freeSpinUsed++; // 成就统计：使用免费转次数
    } else {
      state.sun -= SLOT_COST;
    }
    updateSlotFreeDisplay(false);
    clearTimeout(slotMsgTimer); // 清除可能残留的恢复定时器
    state.slot.spinning = [true, true, true];
    state.slot.results = [null, null, null];
    slotReels.forEach(el => { el.classList.remove('win'); el.classList.add('spinning'); el.style.color = SLOT_COLORS[SLOT_SYMBOLS[0]]; });
    slotStatusEl.classList.remove('win', 'has');
    slotStatusEl.textContent = '旋转中…';

    // 持续更新每个旋转中的转轮
    state.slot.interval = setInterval(() => {
      for (let i = 0; i < 3; i++) {
        if (state.slot.spinning[i]) {
          const sym = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
          renderSymbol(slotReels[i], sym);
          slotReels[i].style.color = SLOT_COLORS[sym];
        }
      }
    }, 80);

    // 三个转轮依次停（最后一个随机）
    const baseDelays = [600, 1100, 1600];
    baseDelays.forEach((d, i) => {
      setTimeout(() => stopReel(i), d + Math.random() * 350);
    });

    updateSlotPullButton();
  }

  // 中奖概率（每轮）：名刀司命 5%、野生狗奶 15%、金坷垃 15%、花朵 15%，合计 50% 中奖
  function stopReel(idx) {
    if (!state.slot.spinning[idx]) return;
    state.slot.spinning[idx] = false;
    // 最终结果：
    // - 第 1 个转轮按权重抽"目标"：50% 中奖（名刀5/狗奶15/金坷垃15/花15），50% 未中奖
    // - 中奖时后两轮强制跟随首轮 → 3 连击精确等于 50% 中奖率
    // - 未中奖时后两轮避开首轮符号 → 三连不成立
    let sym;
    if (idx === 0) {
      const r = Math.random();
      state.slot.target = null;
      const WEIGHTS = [
        { sym: SWORD_SYM, w: 0.05 },
        { sym: '🧪', w: 0.15 },
        { sym: '🌿', w: 0.15 },
        { sym: '🌸', w: 0.15 },
      ];
      let acc = 0;
      for (const it of WEIGHTS) {
        acc += it.w;
        if (r < acc) { state.slot.target = it.sym; break; }
      }
      if (state.slot.target !== null) {
        sym = state.slot.target;           // 中奖：首轮直接显示目标符号
      } else {
        // 未中奖：首轮随机普通符号（名刀不会单独出现）
        const normal = ['🌸', '🌿', '🧪'];
        sym = normal[Math.floor(Math.random() * normal.length)];
      }
    } else {
      if (state.slot.target !== null) {
        sym = state.slot.target;           // 中奖轮：后两轮强制跟随，确保 3 连击
      } else {
        // 未中奖轮：后两轮避开首轮符号，保证三连不成立
        const others = SLOT_SYMBOLS.filter(s => s !== state.slot.results[0]);
        sym = others[Math.floor(Math.random() * others.length)];
      }
    }
    state.slot.results[idx] = sym;
    const reel = slotReels[idx];
    renderSymbol(reel, sym);
    reel.style.color = SLOT_COLORS[sym];
    reel.classList.remove('spinning');
    reel.classList.add('win');
    setTimeout(() => reel.classList.remove('win'), 350);

    // 三个都停下来了
    if (!state.slot.spinning.some(s => s)) {
      clearInterval(state.slot.interval);
      state.slot.interval = null;
      checkSlotResult();
      updateSlotPullButton();
    }
  }
  function checkSlotResult() {
    const [a, b, c] = state.slot.results;
    clearTimeout(slotMsgTimer);
    if (a === b && b === c) {
      // 3 连击！
      slotStatusEl.innerHTML = '🎉 ' + [a, b, c].map(symbolHtml).join('');
      slotStatusEl.classList.add('win');
      applySlotEffect(a);
      // 停留片刻后恢复常驻提示
      slotMsgTimer = setTimeout(() => { slotStatusEl.classList.remove('win'); updateSlotFreeDisplay(false); }, 2800);
    } else {
      slotStatusEl.textContent = '未中奖';
      slotMsgTimer = setTimeout(() => updateSlotFreeDisplay(false), 1500);
    }
  }

  function applySlotEffect(symbol) {
    state.slotWins++; // 成就统计：老虎机中奖次数
    state.slotGot[symbol] = 1; // 大满贯：记录本轮符号已中奖
    if (symbol === '🧪') {
      // 野生狗奶：从左侧飞向花朵；落地后花变大 2 倍并弹出对话框
      emitParticles(state.headX, state.headY, '#8d6e63', 28);
      flySlotImage(FERT_IMG_SRC, false, () => {
        // 野生狗奶：花瓣 +1 + 分三档变大（×2/×3/×4），抽满 3 次封顶；受击后归零可重新累加
        state.petals = Math.min(state.petalCap, state.petals + 1);
        state.milkCount++;                 // 成就统计：累计抽中狗奶次数（不受受击清零影响）
        if (state.fertCount < 3) state.fertCount++;
        state.fertScale = 1 + state.fertCount;
        playStrongSound();     // 播放音效
        showStrongBubble('俺变得更强壮了');
      });
    } else if (symbol === '🌿') {
      // 金坷垃：从右侧飞入；落地后猛地向上窜一下（短时强向上冲）
      // 并随机播放一句广告文案＋对应音效
      const variants = [
        { text: '肥料掺了金坷垃，不流失，不蒸发，零浪费', sound: '不流失不蒸发.mp3' },
        { text: '肥料掺了金坷垃，能吸收两米下的氮磷钾', sound: '吸收氮磷钾.mp3' }
      ];
      const pick = variants[Math.floor(Math.random() * variants.length)];
      flySlotImage(KLK_IMG_SRC, true, () => {
        // 金坷垃：花瓣 +1 + 猛地向上窜一下（力度随当前高度区间递增，越高窜得越高）
        state.petals = Math.min(state.petalCap, state.petals + 1);
        const m = (state.maxHeight || 0) / 10;      // 换算成"米"
        let zone = 1;                                // 高度区间系数
        if (m < 500) zone = 1;
        else if (m < 1000) zone = 1.5;
        else if (m < 1500) zone = 2.2;
        else if (m < 2000) zone = 3;
        else if (m < 2500) zone = 4;
        else zone = 5;
        state.slotGrowTime = Math.min(0.85, 0.55 + zone * 0.05); // 猛冲持续（略随区间加长）
        state.slotGrowVy = 820 * zone;               // 初始向上猛冲速度（越高越猛）
        state.growBoostHits++;      // 成就统计：猛冲生长次数
        emitParticles(state.headX, state.headY, '#4caf50', 28);
        playSound(pick.sound);                // 播放对应音效
        showStrongBubble(pick.text);          // 弹出对应文案
      });
    } else if (symbol === '🌸') {
      // 花朵(🌸)：花瓣 ×2（上限 petalCap）＋满天花雨＋音效
      state.petals = Math.min(state.petalCap, state.petals * 2);
      emitParticles(state.headX, state.headY, '#ff6fa3', 28);
      flowerRain();                                        // 满天花雨
      showStrongBubble('花开又花谢花满天');                // 弹出文案
      playSound('花开又花谢花满天.mp3');                   // 音效
    } else if (symbol === SWORD_SYM) {
      // 名刀司命(⚔️)：名刀从正上方旋转飞落到花朵，落地后获得一次
      // "死亡复活"护体——濒死时保住 2 朵花瓣（不可叠加）
      flySlotImage(MINGDAO_IMG_SRC, false, () => {
        emitParticles(state.headX, state.headY, '#d3a4ff', 30);
        state.swordGot = (state.swordGot || 0) + 1; // 成就统计：抽中并持有名刀司命
        if (state.reviveSword < 1) {
          state.reviveSword = 1;
          showStrongBubble('🗡 获得名刀司命：死亡时保住两朵花瓣');
        } else {
          showStrongBubble('🗡 名刀司命护体已就绪（效果不叠加）');
        }
      }, true);
    }
    // 屏幕震动感
    state.slotFlash = 1.0;
  }

  // 缓存飞行用原图（按 src 分开缓存，避免重复加载）
  const flyImgCache = {};
  function ensureFlyImg(src, cb) {
    if (flyImgCache[src] && flyImgCache[src].naturalWidth) return cb();
    const im = new Image();
    im.onload = () => { flyImgCache[src] = im; cb(); };
    im.src = src;
  }

  // 图片从屏幕外飞入：左右侧(fromRight)或正上方(fromTop)入场，
  // 边旋转边变小到达花朵后消失，落地后回调 onDone
  function flySlotImage(src, fromRight, onDone, fromTop) {
    ensureFlyImg(src, () => {
      const im = flyImgCache[src];
      const w = (im.naturalWidth || 128) / 2;   // 原图一半大小
      const h = (im.naturalHeight || 128) / 2;
      // 复制一份用于叠加飞行
      const el = im.cloneNode(false);
      el.src = im.src;
      el.style.cssText = [
        'position:fixed', 'left:0', 'top:0', 'margin:0',
        'transform-origin:center center', 'will-change:transform,left,top',
        'pointer-events:none', 'z-index:9999'
      ].join(';');
      document.body.appendChild(el);

      // 起点在屏幕外：左侧 / 右侧 / 正上方（终点为花头实时位置）
      const W = window.innerWidth;
      let startCenterX, startCenterY;
      if (fromTop) {
        startCenterX = ((state.headX || 0) - (state.cameraX || 0)) + (Math.random() * 300 - 150);
        startCenterY = -h - 40;                       // 屏幕顶部外落下
      } else {
        startCenterX = fromRight ? W + w + 30 : -w - 30;
        startCenterY = (state.headY || 0) - (state.cameraY || 0) + (Math.random() * 120 - 60);
      }

      const dur = 5000;                             // 5 秒飞到花那里
      const targetPx = 28;                          // 到达时：和抽奖机里图片差不多大
      const landScale = targetPx / w;               // 到达时的缩放倍数
      const startScale = 1.15;                      // 出发时略放大
      const rotDir = fromRight ? -1 : 1;            // 右侧入场时反向旋转
      const t0 = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3); // easeOutCubic：先快后慢，落到花朵
        // 追踪花头：每帧取花朵实时屏幕坐标作为目标中心
        const trackX = (state.headX || 0) - (state.cameraX || 0);
        const trackY = (state.headY || 0) - (state.cameraY || 0);
        // 图片按当前尺寸居中对准目标中心，绘制位置用 left/top，transform 只负责旋转
        const cx = startCenterX + (trackX - startCenterX) * e;
        const cy = startCenterY + (trackY - startCenterY) * e;
        const rot = rotDir * p * 5400;               // 快速旋转（约 3 圈/秒）
        // 快速缩小到"抽奖机大小"，约 3/4 行程就到目标尺寸
        const shrinkP = Math.min(1, p / 0.75);
        const scale = startScale + (landScale - startScale) * (1 - Math.pow(1 - shrinkP, 3));
        const curW = w * scale;
        const curH = h * scale;
        el.style.left = (cx - curW / 2) + 'px';      // 中心对准
        el.style.top = (cy - curH / 2) + 'px';
        el.style.width = curW + 'px';
        el.style.height = curH + 'px';
        el.style.opacity = p < 0.92 ? 1 : Math.max(0, 1 - (p - 0.92) / 0.08);
        el.style.transform = 'rotate(' + rot + 'deg)';
        if (p < 1) {
          requestAnimationFrame(step);
        } else {
          el.remove();
          if (typeof onDone === 'function') onDone(); // 落地消失后回调
        }
      };
      requestAnimationFrame(step);
    });
  }

  // 满天花雨：全屏飘落花朵图片，飘落旋转并淡出，结束后移除
  const flowerRainActive = { v: false };
  function flowerRain() {
    if (flowerRainActive.v) return;          // 已有花雨时不叠加
    flowerRainActive.v = true;
    ensureFlyImg(FLOWER_IMG_SRC, () => {
      const im = flyImgCache[FLOWER_IMG_SRC];
      const W = window.innerWidth;
      const H = window.innerHeight;
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;overflow:hidden;pointer-events:none;z-index:9998';
      document.body.appendChild(wrap);
      const N = 120;                         // 花朵数量（竖向加多）
      const petals = [];
      for (let i = 0; i < N; i++) {
        const size = 18 + Math.random() * 36;
        const el = im.cloneNode(false);
        el.src = im.src;
        el.style.cssText = 'position:absolute;left:0;top:0;margin:0;transform-origin:center center;will-change:transform,left,top';
        wrap.appendChild(el);
        petals.push({
          el: el, w: size, h: size,
          x: Math.random() * W,              // 横向随机
          y: -size - Math.random() * 60,     // 顶部外起始
          delay: Math.random() * 1400,       // 错峰入场：让竖向更连续，避免扎堆一行
          speed: 150 + Math.random() * 190,  // 下落速度（更快）
          amp: 15 + Math.random() * 45,      // 左右摇摆幅度
          freq: 0.8 + Math.random() * 1.4,   // 摇摆频率
          rot: Math.random() * 360,
          rotV: -240 + Math.random() * 480,  // 旋转速度
          phase: Math.random() * 6.28
        });
      }
      const t0 = performance.now();
      const dur = 4200;                      // 花雨持续 4.2 秒
      const step = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        const dt = 1 / 60;
        for (const pt of petals) {
          if (now - t0 >= pt.delay) {        // 到入场时间才开始下落
            pt.y += pt.speed * dt;
            pt.rot += pt.rotV * dt;
            const cx = pt.x + Math.sin(now / 1000 * pt.freq + pt.phase) * pt.amp;
            pt.el.style.width = pt.w + 'px';
            pt.el.style.height = pt.h + 'px';
            pt.el.style.left = (cx - pt.w / 2) + 'px';
            pt.el.style.top = (pt.y - pt.h / 2) + 'px';
            pt.el.style.opacity = Math.max(0, Math.min(1, 1 - (pt.y - (H - 80)) / 120));
            pt.el.style.transform = 'rotate(' + pt.rot + 'deg)';
          } else {
            pt.el.style.opacity = '0';       // 未入场前隐藏
          }
        }
        if (p < 1) requestAnimationFrame(step);
        else { wrap.remove(); flowerRainActive.v = false; }
      };
      requestAnimationFrame(step);
    });
  }
  // 花头旁弹出的对话框（跟随花头实时位置，短暂停留后淡出）
  // 多个对话框绕花头一圈、各占一个方向，避免相互遮挡
  const BUBBLE_SLOTS = 8;                       // 环绕一周共 8 个方向位
  const BUBBLE_RAD = 175;                       // 环绕半径
  const activeBubbles = new Array(BUBBLE_SLOTS).fill(false);
  function showStrongBubble(text) {
    const el = document.createElement('div');
    el.className = 'fert-bubble';
    el.style.transformOrigin = 'center center';
    // 箭头指向花头
    const tail = document.createElement('div');
    tail.className = 'fert-bubble-tail';
    tail.style.margin = '0';       // 取消 CSS 里的 -5px 偏移，精确定位箭头尖端
    el.appendChild(tail);
    const label = document.createElement('span');
    label.className = 'fert-bubble-text';
    label.textContent = text;
    el.appendChild(label);
    document.body.appendChild(el);

    // 分配一个空闲方向；全满则挤掉 0 号位
    let slot = activeBubbles.indexOf(false);
    if (slot < 0) slot = 0;
    activeBubbles[slot] = true;
    // 该方向的角度（从正上方开始顺时针分布）
    const ang = -Math.PI / 2 + slot * (2 * Math.PI / BUBBLE_SLOTS);
    const dirX = Math.cos(ang);
    const dirY = Math.sin(ang);

    const dur = 5000;                              // 弹 5 秒
    const t0 = performance.now();
    const step = (now) => {
      const p = (now - t0) / dur;
      // 跟随花头实时屏幕坐标，气泡中心落在花头四周的圆环上
      const tx = (state.headX || 0) - (state.cameraX || 0);
      const ty = (state.headY || 0) - (state.cameraY || 0);
      const bw = el.offsetWidth || 150;
      const bh = el.offsetHeight || 46;
      let L = tx + dirX * BUBBLE_RAD - bw / 2;
      let T = ty + dirY * BUBBLE_RAD - bh / 2;
      // 不跑出屏幕（贴近边缘也能看全）
      L = Math.max(6, Math.min(innerWidth - bw - 6, L));
      T = Math.max(6, Math.min(innerHeight - bh - 6, T));
      el.style.left = L + 'px';
      el.style.top = T + 'px';
      // 箭头尖端贴在气泡朝向花的那条边上，并指向花头
      const ccx = L + bw / 2;
      const ccy = T + bh / 2;
      const fAng = Math.atan2(ty - ccy, tx - ccx);  // 气泡中心 → 花头 的方向
      const hw = bw / 2, hh = bh / 2;
      const sx = Math.abs(hw / (Math.cos(fAng) || 1e-6)); // 射线与矩形相交的参数
      const sy = Math.abs(hh / (Math.sin(fAng) || 1e-6));
      const k = 1 / Math.max(sx, sy);              // 归一化到边界
      const bx = ccx + Math.cos(fAng) * hw * k * 0.999;
      const by = ccy + Math.sin(fAng) * hh * k * 0.999;
      tail.style.left = (bx - L) + 'px';
      tail.style.top = (by - T) + 'px';
      tail.style.transform = 'rotate(' + (fAng * 180 / Math.PI) + 'deg)';
      el.style.opacity = p < 0.75 ? 1 : Math.max(0, 1 - (p - 0.75) / 0.25);
      el.style.transform = 'scale(' + (p < 0.2 ? 0.6 + p * 2 : 1) + ')'; // 弹跳出现
      if (p < 1) requestAnimationFrame(step);
      else {
        el.remove();
        activeBubbles[slot] = false; // 释放该方向
      }
    };
    requestAnimationFrame(step);
  }

  // 通用音效播放：每种 mp3 只缓存一个实例，重播从开头开始
  const soundCache = {};
  function playSound(file) {
    const src = 'music/' + encodeURIComponent(file);
    if (!soundCache[src]) soundCache[src] = new Audio(src);
    const a = soundCache[src];
    a.currentTime = 0; // 重播时从头开始
    a.volume = 0.8;
    a.play().catch(() => {});
  }
  function playStrongSound() { playSound('俺变得更强壮了.mp3'); }

  // === 资源预加载：页面加载时预解码老虎机图片、预加载全部音效，消除游玩中首次播放/显示的偶发卡顿 ===
  function preloadSlotImages() {
    const imgs = [FLOWER_IMG_SRC, FERT_IMG_SRC, KLK_IMG_SRC, MINGDAO_IMG_SRC];
    for (const src of imgs) {
      if (flyImgCache[src]) continue;
      const im = new Image();
      im.src = src;
      if (im.decode) im.decode().catch(() => {}); // 显式触发解码
      flyImgCache[src] = im;
    }
  }
  // 游戏内所有会播放的 mp3（蒜鸟/袋鼠/背景音乐已有独立实例，不重复）
  const PRELOAD_SOUNDS = [
    '欢迎乘坐黄鹤楼电梯.mp3', '欢迎登上黄鹤楼.mp3', '闯关弟子注意.mp3',
    '听雨的声音，一滴滴清晰.mp3', '真希望雨能下不停.mp3',
    '不流失不蒸发.mp3', '吸收氮磷钾.mp3', '花开又花谢花满天.mp3',
    '俺变得更强壮了.mp3', '名刀司命.mp3',
    '你过关.mp3',
  ];
  function preloadSounds() {
    for (const f of PRELOAD_SOUNDS) {
      const src = 'music/' + encodeURIComponent(f);
      if (soundCache[src]) continue;
      const a = new Audio(src);
      a.volume = 0.8;
      a.preload = 'auto';
      a.load(); // 触发解码缓存，首次 play 不再卡顿
      soundCache[src] = a;
    }
  }
  preloadSlotImages();
  preloadSounds();

  // 空格抽奖：按空格键即拉杆（替代右键抽奖）
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' && e.key !== ' ') return;
    // 焦点在输入框等其他控件上时不抢按键，避免误触（抽奖按钮本身允许）
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    if (t && t.tagName === 'BUTTON' && t !== slotPullBtn) {
      e.preventDefault(); // 阻止空格激活设置/成就等按钮：空格永远只用于抽奖
    }
    e.preventDefault(); // 阻止空格滚动页面
    pullSlot();
  });
  // 鼠标点击抽奖按钮：与空格等效，均可触发抽奖
  slotPullBtn.addEventListener('click', () => pullSlot());
  // 阻止老虎机区域的鼠标事件冒泡到画布，避免与拖拽冲突
  document.getElementById('slot-machine').addEventListener('mousedown', e => e.stopPropagation());
  document.getElementById('slot-machine').addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
  updateSlotPullButton();
  updateSlotFreeDisplay(false);
