
  // === 收集物 ===
  // 收集物在世界坐标中生成，以花头所在的世界列为中心（跟随花的水平位置）
  function spawnSunOrb() {
    const side = Math.random() < 0.5 ? -1 : 1;
    state.sunOrbs.push({
      x: state.headX + side * rand(80, Math.max(120, W / 2 - 60)),
      y: state.headY - rand(180, 360), // 在花头前方（上方）生成
      r: 14,
      pulse: 0,
      alive: true,
    });
  }
  function spawnPetalOrb() {
    const side = Math.random() < 0.5 ? -1 : 1;
    state.petalOrbs.push({
      x: state.headX + side * rand(60, Math.max(100, W / 2 - 80)),
      y: state.headY - rand(120, 260),
      r: 10,
      rot: rand(0, Math.PI * 2),
      rotSpeed: rand(-2, 2),
      alive: true,
    });
  }

  let spawnTimer = 0;
  function maybeSpawn(dt) {
    spawnTimer += dt;
    if (spawnTimer > 1.4) {
      spawnTimer = 0;
      if (Math.random() < 0.7) spawnSunOrb();
      if (Math.random() < 0.55) spawnPetalOrb();
    }
  }

  // === 粒子效果 ===
  function emitParticles(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(40, 140);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 20,
        life: rand(0.6, 1.2),
        age: 0,
        color,
        size: rand(2, 5),
      });
    }
  }

  // === 输入 ===
  function getPoint(e) {
    if (e.touches && e.touches[0]) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }
  function inHead(screenX, screenY) {
    // 用屏幕坐标判定（鼠标给的是屏幕坐标，必须和花头的屏幕位置比较）
    const sx = state.headX - state.cameraX;
    const sy = state.headY - state.cameraY;
    const dx = screenX - sx;
    const dy = screenY - sy;
    return dx * dx + dy * dy <= 64 * 64;
  }

  function onDown(e) {
    e.preventDefault();
    if (!state.started) return;  // 未开局不可拖动
    if (plantHidden()) return;   // 隐藏期不可拖动
    const p = getPoint(e);
    if (inHead(p.x, p.y)) {
      state.dragging = true;
      state.dragDistance = 0;
      state.lastMouseX = p.x;
      state.lastMouseY = p.y;
      // 屏幕空间偏移：点击点到花头屏幕中心的距离（保持拖拽手感）
      state.dragOffsetX = p.x - (state.headX - state.cameraX);
      state.dragOffsetY = p.y - (state.headY - state.cameraY);
      canvas.classList.add('dragging');
    }
  }
  function onMove(e) {
    if (!state.dragging) return;
    if (plantHidden()) {         // 进入隐藏期后立刻打断拖拽
      state.dragging = false;
      canvas.classList.remove('dragging');
      return;
    }
    e.preventDefault();
    const p = getPoint(e);
    // 用增量更新 + 灵敏度系数：花朵移动比鼠标慢，控制更稳
    let dx = (p.x - state.lastMouseX) * state.dragSensitivity;
    let dy = (p.y - state.lastMouseY) * state.dragSensitivity;
    state.lastMouseX = p.x;
    state.lastMouseY = p.y;

    // 单点拖拽：一次按住累计位移最多 60px，超出后不再跟随（不支持长按连续拖拽）
    state.dragDistance += Math.hypot(dx, dy);
    if (state.dragDistance > 120) {
      state.dragging = false;
      canvas.classList.remove('dragging');
      return;
    }

    // 拖拽时如果玩家把花头拉到下方更靠近根，限制向下拖（避免压垮茎）
    // 但仍允许一定程度的下降（用 headY > baseY 来限制）
    const newY = state.headY + dy;
    if (newY > state.baseY) dy = state.baseY - state.headY;

    // 估算速度（松手后用）— 调小避免飞太远
    state.velocityX = dx * 4;
    state.velocityY = dy * 4;
    state.headX += dx;
    state.headY += dy;
    // 拖拽同样受左右边界墙限制（边界 = 墙内沿）
    state.headX = clampX(state.headX);
  }
  function onUp() {
    state.dragging = false;
    canvas.classList.remove('dragging');
  }

  // 单独的鼠标位置跟踪（用于让花头眼睛看向鼠标，不限于拖拽时）
  function trackMouse(e) {
    const p = getPoint(e);
    state.lastMouseX = p.x;
    state.lastMouseY = p.y;
  }

  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mousemove', trackMouse);
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('touchstart', onDown, { passive: false });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchmove', trackMouse);
  window.addEventListener('touchend', onUp);

  // === 镜头 ===
  // 延迟跟随：使用一阶低通滤波，时间常数越大延迟越明显
  // 同时根据花头瞬时速度做一点"前瞻"，让镜头有跟随感
  // 硬约束：保证花头始终位于"安全区"内（不超出屏幕四边）
  const CAMERA_TAU = 0.55; // 秒 — 时间常数（越大越延迟）
  const LOOK_AHEAD_Y = 0.08; // 垂直前瞻系数
  const LOOK_AHEAD_X = 0.12; // 水平前瞻系数
  // 安全区：花头在屏幕上的位置必须落在该范围内
  // 左右边界墙：花头可活动的水平边距（屏幕像素）。取消横向镜头跟随后，
  // 花在屏幕内自由横移，拖到墙即停，边界清晰。围墙视觉由 drawWalls() 绘制。
  const WALL_MARGIN = 32;
  // 墙半宽（竖杆 18px，半宽 9）：花最多贴到墙内表面即认为"碰到墙"，
  // 不会整朵压进墙里；撞墙判定与移动边界都用墙内沿。
  const WALL_HALF = 9;
  const LEFT_BOUND = WALL_MARGIN - WALL_HALF;        // 左墙内沿
  const RIGHT_BOUND = W - WALL_MARGIN + WALL_HALF;   // 右墙内沿
  // 撞墙判定边界（花心真到墙内沿才算碰到，而非墙内/墙外偏移一点）
  function atWallX(hx) { return hx <= LEFT_BOUND || hx >= RIGHT_BOUND; }
  function clampX(v) { return Math.min(Math.max(v, LEFT_BOUND), RIGHT_BOUND); }
  const SAFE = { top: 90, bottom: 140, left: 80, right: 80 };
  // 花头聚焦线：镜头激活后花头保持在该屏幕高度比例处（居中）
  const FOCUS_Y_RATIO = 0.5;
  function updateCamera(dt) {
    // 垂直镜头（正确方向）：screen = world - cameraY，花头要停在聚焦线上
    // → cameraY = headY - focusY。镜头只会向上走（cameraY ≤ 0），
    //   保证根部/地面固定在世界坐标，随镜头自然滚出屏幕下方。
    const aheadY = -state.velocityY * LOOK_AHEAD_Y; // velocityY 向上为负
    const targetY = Math.min(0, state.headY - (H * FOCUS_Y_RATIO) - aheadY);

    // 帧率无关的指数平滑（垂直保持延迟跟随）。
    // 生长越快滞后越大，会把花头挤向屏幕顶部；这里按当前生长速度动态
    // 减小时间常数，把滞后基本压到固定量，让花头稳定停在屏幕中央。
    const v = Math.max(Math.abs(state.velocityY), state.growSpeedActive || 0);
    const tau = v > 60 ? Math.max(0.04, 44 / v) : CAMERA_TAU;
    const aY = 1 - Math.exp(-dt / tau);
    state.cameraY += (targetY - state.cameraY) * aY;

    // 水平镜头固定为 0：花朵在屏幕内左右移动，撞到左右边界墙即止，
    // 因此左右边界始终清晰可见、不会飘出屏幕。
    state.cameraX = 0;

    // === 硬约束：保证花头始终在垂直安全区内（顶部 / 底部） ===
    const headScreenY = state.headY - state.cameraY;
    if (headScreenY < SAFE.top) {
      state.cameraY = state.headY - SAFE.top;
    }
    if (headScreenY > H - SAFE.bottom) {
      state.cameraY = Math.min(0, state.headY - (H - SAFE.bottom));
    }
  }

  // === 茎的更新 ===
  function updateStem(dt) {
    // 如果没有拖拽，花头继续向上生长，并受上次的"速度"影响
    if (!state.dragging) {
      state.velocityX *= state.velocityDamp;
      state.velocityY *= state.velocityDamp;
      // 不强制水平回正 — 玩家需要控制
      state.headX += state.velocityX * dt;
      // 老虎机的"↓"效果：暂停向上生长
      if (state.growthPause > 0) {
        state.growthPause -= dt;
        // 暂停时不向上长，但 headY 可以因为 velocity 向下走
      } else {
        // 强制向上生长（雨天加速；"🌿"触发猛地向上窜）
        const wE = weatherEffects();
        // 生长速度分段递增：500起2倍 → 1000起3倍 → 1500起4倍 → 2000起5倍（之后维持5倍）
        const speedMul = state.maxHeight >= 20000 ? 5
                       : state.maxHeight >= 15000 ? 4
                       : state.maxHeight >= 10000 ? 3
                       : state.maxHeight >= 5000 ? 2
                       : 1;
        // 噩梦模式：整体生长再加速（更早触及异形节奏，更难应对）
        const nmMul = state.nightmare ? 1.5 : 1;
        state.growSpeedActive = state.growthSpeed * speedMul * nmMul * (1 + wE.multGrowth) + (state.slotGrowVy || 0);
        state.headY -= state.growthSpeed * speedMul * nmMul * (1 + wE.multGrowth) * dt;
        if (state.slotGrowTime > 0) {
          state.slotGrowTime -= dt;
          if (state.slotGrowVy > 0) state.headY -= state.slotGrowVy * dt;
          state.slotGrowVy = Math.max(0, state.slotGrowVy - dt * 900); // 快速衰减
        }
      }
      // 边界限制（水平）：撞到左右边界墙即停（边界 = 墙内沿）
      state.headX = clampX(state.headX);
    } else {
      // 拖拽时限制上下
      // 拖拽向上也会导致生长
      // 玩家拖到下方时，依然能拉下去，但会减慢生长
      const dy = state.headY - state.points[state.points.length - 1].y;
      if (dy > -4) {
        // 当玩家主动把花头压低超过当前生长点时，暂停向上生长
        // 但 headY 仍可以增加（向下）
      } else {
        // 玩家把花头向上拉，加速生长
        state.headY -= state.growthSpeed * 0.6 * dt;
      }
    }

    // 防止 head 跑到屏幕底部之下
    if (state.headY > state.baseY) {
      state.headY = state.baseY;
      state.velocityX *= 0.5;
    }

    // 计算从根到头的新"点"采样（保持固定间距）
    const STEP = 6;
    const last = state.points[state.points.length - 1];
    const dx = state.headX - last.x;
    const dy = state.headY - last.y;
    const dist = Math.hypot(dx, dy);
    if (dist >= STEP) {
      const n = Math.floor(dist / STEP);
      for (let i = 1; i <= n; i++) {
        const t = (i * STEP) / dist;
        state.points.push({
          x: last.x + dx * t,
          y: last.y + dy * t,
        });
      }
    }

    // 限制点数防止无限增长
    const MAX_POINTS = 900;
    if (state.points.length > MAX_POINTS) {
      state.points.splice(0, state.points.length - MAX_POINTS);
    }

    // 高度统计
    const heightPx = state.baseY - state.headY;
    if (heightPx > state.maxHeight) state.maxHeight = heightPx;

    // 到达 3500 米：触发胜利评级结束（S / SSS / SSS）
    if (state.maxHeight >= 35000 && !state.gameOver) triggerWin();

    // 到达 20 米 / 80 米：各播放一次黄鹤楼语音
    if (!state.annElevator && state.maxHeight >= 200) {
      state.annElevator = true;
      playSound('欢迎乘坐黄鹤楼电梯.mp3');
    }
    if (!state.annWelcome && state.maxHeight >= 800) {
      state.annWelcome = true;
      playSound('欢迎登上黄鹤楼.mp3');
    }
    // 到达 1600 米（陨石区入口）：播放一次闯关提示语音
    if (!state.ann1600 && state.maxHeight >= 16000) {
      state.ann1600 = true;
      playSound('闯关弟子注意.mp3');
    }

    // 关卡解锁：达成高度分批解锁云层与陨石、最终接棒宇宙飞船
    if (!state.cloudUnlocked && state.maxHeight >= CLOUD_UNLOCK_AT) {
      state.cloudUnlocked = true;
      showRegionBanner('☁️ 云层解锁');
    }
    if (!state.meteorUnlocked && state.maxHeight >= METEOR_UNLOCK_AT && state.maxHeight < METEOR_CLOSE_AT) {
      state.meteorUnlocked = true;
      showRegionBanner('☄️ 陨石来袭');
    } else if (state.meteorUnlocked && state.maxHeight >= METEOR_CLOSE_AT) {
      state.meteorUnlocked = false;
      showRegionBanner('🛸 宇宙飞船现身');
    }

    // 进化升级检测：达到阈值高度即晋级（花瓣上限 +2、换外观、触发特效）
    let desired = -1;
    for (let i = 0; i < EVOLUTIONS.length; i++) {
      if (state.maxHeight >= EVOLUTIONS[i].at) desired = i - 1;
    }
    if (desired > state.evolveIndex) {
      state.evolveIndex = desired;
      const ev = EVOLUTIONS[desired + 1];
      if (ev) {
        state.petalCap += ev.capBonus;
        state.evolveFlash = 1;
        emitParticles(state.headX, state.headY, ev.petal[1], 34);
        showEvolveBanner(ev.name);
      }
    }

    // 地形切换检测：达到阈值即换环境，并推进淡入过渡
    let bDesired = -1;
    for (let j = 0; j < BIOMES.length; j++) {
      if (state.maxHeight >= BIOMES[j].at) bDesired = j;
    }
    if (bDesired > state.biomeIndex) {
      state.biomePrev = state.biomeIndex;
      state.biomeIndex = bDesired;
      state.biomeAnim = 0;
      showRegionBanner(BIOMES[bDesired].name);
    } else if (state.biomeAnim < 1) {
      state.biomeAnim = Math.min(1, state.biomeAnim + dt * 0.4);
    }
  }
