
  // 袋鼠宇航员贴图（飞行 / 打坐两帧，每次生成随机其一）
  const kangFrames = ['袋鼠宇航员(飞行).png', '袋鼠宇航员(打坐).png'].map(f => {
    const im = new Image();
    im.src = 'photo/' + encodeURIComponent(f);
    if (im.decode) im.decode().catch(() => {}); // 预解码，避免首次上屏卡顿
    return im;
  });
  // 撞到袋鼠的音效
  const kangHitAudio = new Audio('music/' + encodeURIComponent('你的胆子真是肥嘟嘟的.mp3'));
  kangHitAudio.volume = 0.8;
  function playKangHitSound() {
    kangHitAudio.currentTime = 0; // 重播时从头开始
    kangHitAudio.play().catch(() => {});
  }
  function kangReady() {
    return kangFrames.every(f => f.complete && f.naturalWidth > 0);
  }

  // === 飞鸟（蒜鸟·敌人）：撞到花头 → 扣 1 瓣（轻伤害）；花瓣归零 → 游戏结束 ===
  // 撞到花时的蒜鸟音效
  const birdHitAudio = new Audio('music/' + encodeURIComponent('蒜鸟.mp3'));
  birdHitAudio.volume = 0.8;
  function playBirdHitSound() {
    birdHitAudio.currentTime = 0; // 重播时从头开始
    birdHitAudio.play().catch(() => {});
  }

  function spawnBird() {
    const fromLeft = Math.random() < 0.5;
    // 在花头上方更高的区域横穿屏幕（世界坐标）
    let y = state.headY + rand(-380, -120);
    y = Math.max(state.cameraY + 40, Math.min(state.baseY - 30, y));
    state.birds.push({
      x: state.cameraX + (fromLeft ? -70 : W + 70),
      baseY: y,
      y,
      vx: (fromLeft ? 1 : -1) * (state.nightmare ? rand(170, 270) : rand(120, 200)),
      // 纵向速度分量：斜着飞。水平速度越大倾角越陡，随机上斜/下斜
      vy: (Math.random() < 0.5 ? -1 : 1) * (state.nightmare ? rand(80, 150) : rand(60, 120)),
      flap: rand(0, Math.PI * 2),
      flapSpeed: rand(9, 13),
      size: rand(9, 13),
      phase: rand(0, Math.PI * 2),
      remove: false,
    });
  }

  function updateBirds(dt) {
    // 生成节奏随高度加快，间隔更短；同屏上限 8；只在 200~600 米之间出现
    if (state.maxHeight >= BIRD_UNLOCK_AT && state.maxHeight < BIRD_CLOSE_AT) {
      state.birdTimer -= dt;
      if (state.birdTimer <= 0) {
        const h = state.maxHeight;
        // 同屏鸟较少时概率一次生成 2 只，快速堆叠密度
        const extra = (state.birds.length < 5 && Math.random() < 0.5) ? 1 : 0;
        spawnBird();
        if (extra) spawnBird();
        // 雷暴时飞鸟更密
        const storm = state.weather.kind === 'storm';
        // 噩梦模式：生成间隔更短、飞鸟更密
        state.birdTimer = state.nightmare
          ? Math.max(storm ? 0.5 : 0.9, (storm ? rand(0.8, 1.4) : rand(1.5, 2.6)) - h / 500)
          : Math.max(storm ? 0.9 : 1.8, (storm ? rand(1.8, 3) : rand(3.5, 6)) - h / 500);
      }
    }
    if (state.birds.length > 8) state.birds.length = 8;

    const headR = 19 * (state.fertScale || 1) + 11; // 花头碰撞半径（化肥放大）
    for (const b of state.birds) {
      b.x += b.vx * dt;
      b.flap += dt * b.flapSpeed;
      b.phase += dt * 3;
      // 斜向飞行：纵向速度让轨迹倾斜
      b.baseY += b.vy * dt;
      // 垂直边界：防止斜飞时落到地面以下或滚出屏幕
      b.baseY = Math.max(state.cameraY, Math.min(state.baseY - 30, b.baseY));
      // 略微追踪花头：纵向柔和向花头靠拢（系数小，保持斜穿为主）
      b.baseY += (state.headY - b.baseY) * Math.min(1, dt * 0.4);
      b.y = b.baseY + Math.sin(b.phase) * 14;

      // 与花头碰撞
      const dx = b.x - state.headX;
      const dy = b.y - state.headY;
      const rr = b.size + headR;
      if (state.hitCooldown <= 0 && !plantHidden() && dx * dx + dy * dy <= rr * rr) {
        b.remove = true;
        playBirdHitSound(); // 撞到花：播放蒜鸟音效
        showStrongBubble('蒜鸟蒜鸟都不容易'); // 花头旁弹出对话框
        losePetal(1, b);    // 蒜鸟为轻伤害：只扣 1 瓣（不再减半）
      }
    }
    // 清理：飞出屏幕的鸟视为"躲过"（成就统计），撞击的（remove）不算
    let dodged = 0;
    state.birds = state.birds.filter(b => {
      const inRange = b.x > state.cameraX - 140 && b.x < state.cameraX + W + 140;
      const alive = !b.remove && inRange;
      if (!alive && !b.remove) dodged++; // 自然飞出屏外 = 成功躲过
      return alive;
    });
    state.birdsDodged += dodged;
  }

  // === 陨石（天上随机坠落，可伤害花） ===
  function spawnMeteor() {
    // 在屏幕上方的世界坐标随机位置生成（跟随镜头）
    const slowM = state.maxHeight >= 15000 && state.maxHeight < 30000;
    state.meteorites.push({
      x: state.cameraX + rand(40, Math.max(120, W - 40)),
      y: state.cameraY - rand(60, 180),
      vx: rand(-40, 40),
      vy: rand(150, 220) * (slowM ? 0.7 : 1) * (state.nightmare ? 1.4 : 1),
      rot: rand(0, Math.PI * 2),
      rotSpeed: rand(-4, 4),
      r: rand(9, 14),
      remove: false,
    });
  }

  function updateMeteors(dt) {
    // 陨石只在解锁区间内生成；已解禁后场上的照常坠落完
    if (state.meteorUnlocked) {
      // 生成节奏随高度加快，间隔更短；同屏上限 14
      state.meteorTimer -= dt;
      if (state.meteorTimer <= 0) {
        const h = state.maxHeight;
        // 同屏陨石较少时一次坠落 2~3 颗，堆叠密度
        spawnMeteor();
        if (state.meteorites.length < 8 && Math.random() < 0.9) spawnMeteor();   // 高概率第 2 颗
        if (state.meteorites.length < 8 && Math.random() < 0.5) spawnMeteor();   // 中概率第 3 颗
        // 雷暴时陨石更密
        const storm = state.weather.kind === 'storm';
        // 噩梦模式：陨石更密
        state.meteorTimer = state.nightmare
          ? Math.max(storm ? 0.2 : 0.35, (storm ? rand(0.3, 0.6) : rand(0.5, 1.1)) - h / 1100)
          : Math.max(storm ? 0.35 : 0.6, (storm ? rand(0.6, 1.2) : rand(1.0, 2.2)) - h / 900);
      }
      if (state.meteorites.length > 14) state.meteorites.length = 14;
    }

    const headR = 19 * (state.fertScale || 1) + 11; // 花头碰撞半径（化肥放大）
    // 1500~3000米：陨石下坠减速（重力减小）
    const G = (state.maxHeight >= 15000 && state.maxHeight < 30000) ? 120 : 200;    // 重力加速度（px/s²）
    for (const m of state.meteorites) {
      m.vy += G * dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.rot += m.rotSpeed * dt;

      // 与花头碰撞
      const dx = m.x - state.headX;
      const dy = m.y - state.headY;
      const rr = m.r + headR;
      if (state.hitCooldown <= 0 && !plantHidden() && dx * dx + dy * dy <= rr * rr) {
        m.remove = true;
        // 陨石撞击：更大的冲击 + 爆炸火
        state.velocityX = (Math.sign(dx) || 1) * 600;
        emitParticles(m.x, m.y, '#ff6a3a', 30);
        emitParticles(m.x, m.y, '#ffd54a', 20);
        hitFlower(m);
      }
    }
    // 清理：坠出屏幕下方的陨石视为"躲过"（成就统计），撞击的（remove）不算
    let dodged = 0;
    state.meteorites = state.meteorites.filter(m => {
      const inR = m.y < state.cameraY + H + 80;
      const alive = !m.remove && inR;
      if (!alive && !m.remove) dodged++;
      return alive;
    });
    state.meteorsDodged += dodged;
  }

  function drawMeteors() {
    // 顶部落点预警：尚未落入屏幕的陨石，在屏幕顶标示下坠的水平位置（带呼吸闪动）
    ctx.save();
    for (const m of state.meteorites) {
      const x = m.x - state.cameraX;
      const sy = m.y - state.cameraY;
      if (x < -40 || x > W + 40) continue;
      if (sy < -600 || sy > 30) continue; // 仅预警仍在屏幕顶上方、尚未落地的陨石
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 130 + m.phase);
      const tip = 26; // 预警三角顶端（自屏幕顶向下）
      ctx.globalAlpha = 0.28 * pulse;
      ctx.fillStyle = '#ff8a50';
      ctx.fillRect(x - 2, 0, 4, tip); // 垂直预警光柱
      ctx.globalAlpha = 0.95 * pulse;
      ctx.fillStyle = '#ff5a20';
      ctx.beginPath();
      ctx.moveTo(x, tip);
      ctx.lineTo(x - 9, 0);
      ctx.lineTo(x + 9, 0);
      ctx.closePath();
      ctx.fill(); // 向下三角提示落点
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    for (const m of state.meteorites) {
      const x = m.x - state.cameraX;
      const y = m.y - state.cameraY;
      if (x < -50 || x > W + 50 || y < -80 || y > H + 80) continue;
      // 流星向下流动：拖尾长度随坠落速度拉长，越坠越流
      const len = Math.min(150, m.vy * 0.14 + 34);

      ctx.save();
      // 1) 拖尾：单色光带（原线性渐变 → 纯色填充，视觉相近但省去每帧建渐变）
      ctx.fillStyle = 'rgba(255,190,110,0.72)';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x - m.r * 0.4, y - len * 0.85, x - m.r * 0.25, y - len);
      ctx.lineTo(x + m.r * 0.25, y - len);
      ctx.quadraticCurveTo(x + m.r * 0.4, y - len * 0.85, x, y);
      ctx.closePath();
      ctx.fill();

      // 2) 外层雾化光晕（加宽拖尾，增强流动感）
      ctx.fillStyle = 'rgba(255,160,90,0.18)';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x, y - len * 0.9, x - m.r * 1.6, y - len * 0.6);
      ctx.quadraticCurveTo(x - m.r * 0.2, y - len * 1.05, x + m.r * 1.6, y - len * 0.6);
      ctx.quadraticCurveTo(x, y - len * 0.9, x, y);
      ctx.closePath();
      ctx.fill();

      // 3) 炽白核心：两层纯色圆代替径向渐变（外淡橙 → 内亮白）
      ctx.fillStyle = 'rgba(255,210,130,0.5)';
      ctx.beginPath();
      ctx.arc(x, y, m.r * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,240,0.92)';
      ctx.beginPath();
      ctx.arc(x, y, m.r * 1.0, 0, Math.PI * 2);
      ctx.fill();

      // 4) 陨石本体（岩石核，带旋转）
      ctx.translate(x, y);
      ctx.rotate(m.rot);
      ctx.fillStyle = '#5a3a28';
      ctx.beginPath();
      ctx.arc(0, 0, m.r, 0, Math.PI * 2);
      ctx.fill();
      // 表面高光
      ctx.fillStyle = 'rgba(255,200,120,0.55)';
      ctx.beginPath();
      ctx.arc(-m.r * 0.3, -m.r * 0.3, m.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      // 燃烧边缘光晕
      ctx.strokeStyle = 'rgba(255,150,60,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, m.r + 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function shrinkFlower() {
    // 受击后花朵缩小回正常大小，化肥档位清空，可重新抽狗奶累加变大
    state.fertCount = 0;
    state.fertScale = 1;
  }

  function losePetal(n, obj) {
    // 轻伤害：仅扣 n 瓣，带短无敌与击退，不会像 hitFlower 那样减半
    state.petals = Math.max(0, state.petals - n);
    state.hitCooldown = 1.2;
    state.hitFlash = 1.0;
    shrinkFlower();            // 受击后缩小化肥档位
    const dir = Math.sign(state.headX - (obj ? obj.x : state.headX)) || 1;
    state.velocityX = dir * 320;
    emitParticles(state.headX, state.headY, '#ff8f5e', 18);
    if (state.petals <= 0) {
      state.petals = 0;
      triggerGameOver();
    }
  }

  // === 空中物体序列（风筝→无人机→大飞机→宇宙飞船；鸟/陨石已单独实现）===
  function pickAirType() {
    const h = state.maxHeight;
    if (h < KITE_CLOSE_AT) return 'kite';          // 0~200 风筝
    if (h >= DRONE_AT && h < DRONE_CLOSE_AT) return 'drone'; // 600~1100 无人机
    if (h >= PLANE_AT && h < PLANE_CLOSE_AT) return 'plane'; // 1100~1600 大飞机
    if (h >= KANG_AT && h < KANG_CLOSE_AT) return 'kang'; // 2000~2800 袋鼠宇航员（与陨石一同出现）
    if (h >= SHIP_AT) return 'ship';               // 3000+ 宇宙飞船
    return null;                                   // 200~600 鸟、1600~3000 陨石阶段不产
  }

  function spawnAir() {
    const type = pickAirType();
    if (!type) return false;
    const fromLeft = Math.random() < 0.5;
    const dir = fromLeft ? 1 : -1;
    const y = state.headY + rand(-200, 60);
    let a = { type, x: state.cameraX + (fromLeft ? -90 : W + 90), y, dir, remove: false, phase: rand(0, 6.28) };
    if (type === 'kite') {          // 风筝：生成区域与鸟一致（花头上方更高处）
      let ky = state.headY + rand(-380, -120);
      ky = Math.max(state.cameraY + 40, Math.min(state.baseY - 30, ky));
      a.y = ky; a.baseY = ky;
      a.vx = dir * (state.nightmare ? rand(280, 400) : rand(200, 300));  // 风筝：横向更快
      a.size = 32; a.ampl = 30; a.speed = 1.6;
    } else if (type === 'drone') {  // 无人机：悬停徘徊，机动慢，生成在屏幕上方区域
      let ay = state.headY + rand(-380, -120);
      ay = Math.max(state.cameraY + 40, Math.min(state.baseY - 30, ay));
      a.y = ay; a.baseY = ay;
      a.vx = dir * (state.nightmare ? rand(400, 560) : rand(320, 450));  // 无人机：更快
      a.vy = rand(20, 45) * (Math.random() < 0.5 ? -1 : 1);
      a.size = 52; a.ampl = 18; a.speed = 1.8;
    } else if (type === 'plane') {  // 大飞机：慢速大块头，生成在屏幕上方区域
      let ay = state.headY + rand(-380, -120);
      ay = Math.max(state.cameraY + 40, Math.min(state.baseY - 30, ay));
      a.y = ay; a.baseY = ay;
      a.vx = dir * (state.nightmare ? rand(480, 660) : rand(400, 560));  // 大飞机：更快
      a.size = 80; a.ampl = 12; a.speed = 1.0;
      // 贴合绘制外观的椭圆碰撞轴（机头≈41px、尾翼≈36px、主翼上≈26px、滑橇下≈23px）
      a.hx = 46;   // 横向碰撞半轴
      a.hy = 30;   // 纵向碰撞半轴
    } else if (type === 'kang') {   // 袋鼠宇航员：缓慢横穿 + 上下漂浮，随机一帧贴图
      let ky = state.headY + rand(-340, -90);
      ky = Math.max(state.cameraY + 40, Math.min(state.baseY - 30, ky));
      a.y = ky; a.baseY = ky;
      a.vx = dir * (state.nightmare ? rand(200, 300) : rand(140, 220));  // 袋鼠：中速缓缓飘过
      a.size = 55; a.ampl = 30; a.speed = 1.5;
      a.fIdx = Math.random() < 0.5 ? 0 : 1;  // 飞行 / 打坐 随机其一
      a.w = 165;                     // 贴图显示宽度（高度按图片比例）
    } else {                        // 宇宙飞船：高速掠过，生成在屏幕上方区域
      let ay = state.headY + rand(-380, -120);
      ay = Math.max(state.cameraY + 40, Math.min(state.baseY - 30, ay));
      a.y = ay; a.baseY = ay;
      a.vx = dir * (state.nightmare ? rand(480, 680) : rand(380, 560));  // 宇宙飞船：更快
      a.size = 40; a.ampl = 22; a.speed = 2.2;
      a.track = true;                // 所有飞船都带追踪，追到花头上方 250px 处
    }
    state.airShips.push(a);
    return true;
  }

  function updateAirShips(dt) {
    const airType = pickAirType();
    if (airType) {
      state.airTimer -= dt;
      if (state.airTimer <= 0) {
        if (airType === 'kang') {
          // 袋鼠阶段：多刷一些，但同屏最多保持 3 只
          const kangs = state.airShips.filter(x => x.type === 'kang').length;
          if (kangs < 3) {
            if (kangs === 0) {
              // 场上空无一鼠时立刻补 1~2 只，避免断档
              spawnAir();
              if (Math.random() < 0.5) spawnAir();
            } else if (Math.random() < 0.8) {
              spawnAir();
            }
          }
          // 噩梦模式：袋鼠刷得更快，同屏密度上限提到 4
          state.airTimer = state.nightmare ? rand(0.5, 0.9) : rand(0.9, 1.6);
        } else {
          // 飞船阶段：生成更频繁、更容易成对出现
          const extra = (state.airShips.length < 9 && Math.random() < (airType === 'ship' ? 0.6 : 0.7)) ? 1 : 0;
          spawnAir();
          if (extra) spawnAir();
          // 噩梦模式：各类空中物生成间隔更短
          state.airTimer = airType === 'ship'
            ? (state.nightmare ? rand(0.6, 1.2) : rand(1.0, 2.0))
            : Math.max(state.nightmare ? 0.5 : 1.0, rand(2.2, 3.6) * (state.nightmare ? 0.7 : 1) - state.maxHeight / 2500);
        }
      }
    }
    if (state.airShips.length > 14) state.airShips.length = 14;

    const headR = 19 * (state.fertScale || 1) + 11;
    for (const a of state.airShips) {
      a.x += a.vx * dt;
      if (a.type === 'drone') a.baseY += a.vy * dt;
      // 飞船：全部追踪花头，保持在花头上方约 250px 处
      if (a.type === 'ship') {
        const targetY = state.headY - 250;
        a.baseY += (targetY - a.baseY) * Math.min(1, dt * 1.5);
      }
      // 上下起伏
      a.y = a.baseY + Math.sin(a.phase + performance.now() / 1000 * a.speed) * a.ampl;
      // 垂直边界
      a.y = Math.max(state.cameraY, Math.min(state.baseY - 30, a.y));

      // 碰撞：椭圆判定（默认圆形=两半轴取 size；大飞机已改为贴合外观的 hx/hy）
      const dx = a.x - state.headX;
      const dy = a.y - state.headY;
      const hx = (a.hx || a.size) + headR;   // 外扩花半径
      const hy = (a.hy || a.size) + headR;
      if (state.hitCooldown <= 0 && !plantHidden() && (dx * dx) / (hx * hx) + (dy * dy) / (hy * hy) <= 1) {
        a.remove = true;
        if (a.type === 'kang') {
          // 袋鼠：扣 1 瓣 + 花头旁弹话 + 播放音效
          playKangHitSound();
          showStrongBubble('你的胆子真是肥嘟嘟的');
          losePetal(1, a);
        } else if (a.type === 'kite' || a.type === 'drone') losePetal(1, a);
        else hitFlower(a);
      }
    }
    state.airShips = state.airShips.filter(a => {
      const alive = !a.remove && a.x > -140 && a.x < W + 140;
      // 出屏且未撞击 = 躲避成功（按类型累计，供成就使用）
      if (!alive && !a.remove) state.airDodgedBy[a.type] = (state.airDodgedBy[a.type] || 0) + 1;
      return alive;
    });
  }

  function drawAirShips() {
    const t = performance.now() / 1000;
    for (const a of state.airShips) {
      const sx = a.x - state.cameraX;
      const sy = a.y - state.cameraY;
      if (sx < -140 || sx > W + 140 || sy < -120 || sy > H + 120) continue;
      ctx.save();
      ctx.translate(sx, sy);

      if (a.type === 'kite') {
        // 风筝：大菱形 + 白描边 + 十字骨架 + 加长彩尾，更醒目
        const k = a.size;
        ctx.rotate(a.dir > 0 ? 0.6 : -0.6);
        // 彩色菱形主体
        ctx.fillStyle = '#ff4d6d';
        ctx.beginPath();
        ctx.moveTo(0, -k); ctx.lineTo(k, 0); ctx.lineTo(0, 2.2 * k); ctx.lineTo(-k, 0);
        ctx.closePath(); ctx.fill();
        // 白色描边，突出轮廓
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 3;
        ctx.stroke();
        // 十字骨架（横/竖各一条）
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -k); ctx.lineTo(0, 2.2 * k); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-k, 0); ctx.lineTo(k, 0); ctx.stroke();
        // 中央亮黄圆点
        ctx.fillStyle = '#ffe27a';
        ctx.beginPath(); ctx.arc(0, k * 0.5, k * 0.28, 0, Math.PI * 2); ctx.fill();
        // 加长彩色尾巴（红黄相间丝带，随风摆动）
        ctx.lineWidth = 3.5;
        for (let i = 0; i < 7; i++) {
          const tx = -k * 0.15 + i * k * 0.18;
          const ty = k * 1.7 + i * k * 0.32 + Math.sin(a.phase + t * 6 + i) * (4 + i * 1.2);
          ctx.strokeStyle = i % 2 === 0 ? '#ff6b81' : '#ffd54a';
          ctx.beginPath();
          ctx.moveTo(tx - k * 0.1, ty - k * 0.28);
          ctx.lineTo(tx + k * 0.1, ty);
          ctx.stroke();
        }
      } else if (a.type === 'drone') {
        // 无人机：侧视图 — 胶囊机身 + 机头大旋翼 + 尾梁垂尾 + 起落滑橇
        const d = a.size * 0.32;
        const fwd = a.dir > 0 ? 1 : -1;
        ctx.rotate(a.dir > 0 ? -0.05 : 0.05);
        // 机头旋翼（前伸旋臂 + 侧视旋转桨叶）
        const rotx = fwd * d * 1.15;
        ctx.strokeStyle = '#5f6b78'; ctx.lineWidth = Math.max(1, d * 0.16);
        ctx.beginPath(); ctx.moveTo(fwd * d * 0.05, 0); ctx.lineTo(rotx, 0); ctx.stroke();
        ctx.save();
        ctx.translate(rotx, 0);
        ctx.rotate(t * 24);   // 快速旋转
        ctx.lineWidth = d * 0.15; ctx.strokeStyle = 'rgba(170,195,215,0.9)';
        ctx.beginPath(); ctx.moveTo(0, -d * 1.2); ctx.lineTo(0, d * 1.2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-d * 1.2, 0); ctx.lineTo(d * 1.2, 0); ctx.stroke();
        ctx.restore();
        // 机头玻璃舱
        ctx.fillStyle = 'rgba(130,210,255,0.92)';
        ctx.beginPath(); ctx.ellipse(fwd * d * 1.02, -d * 0.05, d * 0.3, d * 0.24, 0, 0, Math.PI * 2); ctx.fill();
        // 机身（侧视胶囊）
        const body = ctx.createLinearGradient(0, -d * 0.35, 0, d * 0.35);
        body.addColorStop(0, '#f1f5f8'); body.addColorStop(0.5, '#d7e0e9'); body.addColorStop(1, '#9fb0be');
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.ellipse(0, 0, d * 1.05, d * 0.34, 0, 0, Math.PI * 2); ctx.fill();
        // 尾梁 + 垂尾
        ctx.strokeStyle = '#6b7686'; ctx.lineWidth = d * 0.16;
        ctx.beginPath(); ctx.moveTo(-fwd * d * 0.25, 0); ctx.lineTo(-fwd * d * 1.2, 0); ctx.stroke();
        ctx.fillStyle = '#9aa7b5';
        ctx.beginPath(); ctx.moveTo(-fwd * d * 1.3, -d * 0.55); ctx.lineTo(-fwd * d * 1.05, -d * 0.05); ctx.lineTo(-fwd * d * 1.4, -d * 0.05); ctx.closePath(); ctx.fill();
        // 起落滑橇（两根）
        ctx.strokeStyle = '#5f6b78'; ctx.lineWidth = d * 0.11;
        ctx.beginPath();
        ctx.moveTo(fwd * d * 0.3, d * 0.3); ctx.lineTo(fwd * d * 0.12, d * 0.9);
        ctx.moveTo(-fwd * d * 0.35, d * 0.3); ctx.lineTo(-fwd * d * 0.52, d * 0.9);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(fwd * d * 0.12 - 0, d * 0.9); ctx.lineTo(-fwd * d * 0.52, d * 0.9);
        ctx.stroke();
        // 信号灯
        ctx.fillStyle = 'rgba(255,80,80,0.9)';
        ctx.beginPath(); ctx.arc(-fwd * d * 0.4, d * 0.05, d * 0.12, 0, Math.PI * 2); ctx.fill();
      } else if (a.type === 'plane') {
        // 大飞机：侧视图 — 流线机身 + 机头锥 + 单片主翼 + 尾部平尾垂尾 + 侧喷焰 + 舱窗
        const d = a.size * 0.32;
        const fwd = a.dir > 0 ? 1 : -1;
        ctx.rotate(a.dir > 0 ? -0.04 : 0.04);
        // 引擎喷焰（机尾后方，侧视斜拉渐变）
        const ex = -fwd * d * 0.5;
        const flame = ctx.createLinearGradient(ex - fwd * d * 0.7, 0, ex, 0);
        flame.addColorStop(0, 'rgba(255,130,50,0)');
        flame.addColorStop(0.55, 'rgba(255,190,90,0.7)');
        flame.addColorStop(1, 'rgba(255,250,180,0.95)');
        ctx.fillStyle = flame;
        ctx.beginPath();
        ctx.moveTo(ex, -d * 0.22);
        ctx.lineTo(ex, d * 0.22);
        ctx.lineTo(ex + fwd * d * 0.85, 0);
        ctx.closePath(); ctx.fill();
        // 主翼（侧视单片大机翼，后掠朝上）
        ctx.fillStyle = '#c3cbd6';
        ctx.beginPath();
        ctx.moveTo(-fwd * d * 0.2, -d * 0.08);
        ctx.lineTo(fwd * d * 0.5, -d * 1.0);
        ctx.lineTo(fwd * d * 0.6, -d * 0.5);
        ctx.quadraticCurveTo(fwd * d * 0.1, -d * 0.1, -fwd * d * 0.2, -d * 0.08);
        ctx.closePath(); ctx.fill();
        // 平尾（机尾小翼）
        ctx.fillStyle = '#d4dce6';
        ctx.beginPath();
        ctx.moveTo(-fwd * d * 0.75, -d * 0.02);
        ctx.lineTo(-fwd * d * 1.25, -d * 0.42);
        ctx.lineTo(-fwd * d * 1.0, -d * 0.02);
        ctx.closePath(); ctx.fill();
        // 垂尾（朝上）
        ctx.fillStyle = '#d4dce6';
        ctx.beginPath();
        ctx.moveTo(-fwd * d * 0.6, 0);
        ctx.lineTo(-fwd * d * 1.05, -d * 0.18);
        ctx.lineTo(-fwd * d * 0.7, -d * 0.62);
        ctx.closePath(); ctx.fill();
        // 流线机身（侧视胶囊）
        const body = ctx.createLinearGradient(0, -d * 0.32, 0, d * 0.32);
        body.addColorStop(0, '#f6fafc'); body.addColorStop(0.5, '#e3eaf2'); body.addColorStop(1, '#b6c4d5');
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.ellipse(0, 0, d * 1.35, d * 0.3, 0, 0, Math.PI * 2); ctx.fill();
        // 机头锥
        ctx.fillStyle = '#dde7f1';
        ctx.beginPath();
        ctx.moveTo(fwd * d * 1.15, -d * 0.22);
        ctx.lineTo(fwd * d * 1.62, 0);
        ctx.lineTo(fwd * d * 1.15, d * 0.22);
        ctx.closePath(); ctx.fill();
        // 驾驶舱玻璃
        ctx.fillStyle = 'rgba(120,205,255,0.92)';
        ctx.beginPath(); ctx.ellipse(fwd * d * 0.7, -d * 0.12, d * 0.3, d * 0.13, 0, 0, Math.PI * 2); ctx.fill();
        // 一排机身舱窗
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        for (let i = 0; i < 4; i++) {
          ctx.beginPath(); ctx.arc(-fwd * d * 0.25 + fwd * i * d * 0.3, d * 0.0, d * 0.06, 0, Math.PI * 2); ctx.fill();
        }
      } else if (a.type === 'kang') {
        // 袋鼠宇航员：整图贴片横穿（飞行 / 打坐随机帧），按移动方向镜像
        const im = kangFrames[a.fIdx || 0];
        const bob = Math.sin(t * 2 + a.phase) * 6;      // 轻微呼吸式漂浮
        ctx.translate(0, bob);
        ctx.rotate(Math.sin(t * 1.6 + a.phase) * 0.05);  // 微微晃荡
        ctx.scale(a.dir > 0 ? -1 : 1, 1);                // 原图默认朝左：向右飞时镜像
        if (im && im.complete && im.naturalWidth > 0) {
          const bw = a.w;
          const bh = bw * im.naturalHeight / im.naturalWidth;
          ctx.drawImage(im, -bw / 2, -bh / 2, bw, bh);
        } else {
          // 图片未加载完成时的简易占位（宇航服椭圆 + 头盔）
          ctx.fillStyle = '#7b5b8e';
          ctx.beginPath(); ctx.ellipse(0, 0, 30, 34, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#d8c8f0';
          ctx.beginPath(); ctx.arc(0, 14, 13, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        // 宇宙飞船：飞碟 + 顶部舱 + 底部光束
        const s = a.size;
        const hover = Math.sin(t * 3 + a.phase) * 3;
        ctx.translate(0, hover);
        // 底部探照光束
        const beam = ctx.createLinearGradient(0, s * 0.25, 0, s * 3.2);
        beam.addColorStop(0, 'rgba(120,220,255,0.45)');
        beam.addColorStop(1, 'rgba(120,220,255,0)');
        ctx.fillStyle = beam;
        ctx.beginPath(); ctx.moveTo(-s * 0.35, s * 0.25); ctx.lineTo(s * 0.35, s * 0.25);
        ctx.lineTo(s * 0.9, s * 3.2); ctx.lineTo(-s * 0.9, s * 3.2); ctx.closePath(); ctx.fill();
        // 发光圆盘
        const dg = ctx.createRadialGradient(0, 0, 0, 0, 0, s);
        dg.addColorStop(0, 'rgba(160,225,255,0.95)');
        dg.addColorStop(1, 'rgba(60,130,190,0.9)');
        ctx.fillStyle = dg;
        ctx.beginPath(); ctx.ellipse(0, 0, s * 1.3, s * 0.55, 0, 0, Math.PI * 2); ctx.fill();
        // 顶部圆形舱
        ctx.fillStyle = '#aee4ff';
        ctx.beginPath(); ctx.arc(0, -s * 0.35, s * 0.42, 0, Math.PI * 2); ctx.fill();
        // 舷窗光圈
        ctx.strokeStyle = 'rgba(180,240,255,0.8)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.ellipse(0, 0, s * 1.34, s * 0.58, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
  }

  function hitFlower(bird) {
    // 花瓣减半（floor 让 1 → 0 可以触发游戏结束）
    state.petals = Math.floor(state.petals / 2);
    state.hitCooldown = 1.5;   // 1.5 秒无敌，防止连续扣血
    state.hitFlash = 1.0;
    shrinkFlower();            // 受击后缩小化肥档位
    // 被撞飞的击退（远离鸟的方向）
    const dir = Math.sign(state.headX - bird.x) || 1;
    state.velocityX = dir * 520;
    emitParticles(state.headX, state.headY, '#ff5252', 22);
    // 掉落的花瓣粒子
    for (let i = 0; i < 6; i++) {
      state.particles.push({
        x: state.headX + rand(-14, 14),
        y: state.headY + rand(-10, 10),
        vx: rand(-40, 40),
        vy: rand(20, 70),
        life: rand(1.0, 1.6),
        age: 0,
        color: '#ff6fa3',
        size: rand(2.5, 4.5),
      });
    }
    if (state.petals <= 0) {
      state.petals = 0;
      triggerGameOver();
    }
  }

  function triggerGameOver() {
    // 名刀司命：濒死时自动发动——保住 2 朵花瓣，不进入结算
    if (state.reviveSword > 0) {
      state.reviveSword = 0;                 // 一次性消耗
      state.swordUse = (state.swordUse || 0) + 1; // 成就统计：名刀护体挡下一次死亡
      state.petals = 2;                      // 变成两朵花瓣
      state.hitCooldown = Math.max(state.hitCooldown, 2); // 再给一段无敌缓冲
      state.hitFlash = 0.8;
      emitParticles(state.headX, state.headY, '#d3a4ff', 40);
      showStrongBubble('🗡 他出了一个名刀司命！');
      playSound('名刀司命.mp3');             // 名刀发动音效
      return;
    }
    state.gameOver = true;
    emitParticles(state.headX, state.headY, '#ff6fa3', 40);
    document.getElementById('go-title').textContent = '花瓣全部掉光了';
    document.getElementById('go-grade').style.display = 'none'; // 死亡不显示评级
    document.getElementById('go-stat-sub').style.display = 'none'; // 死亡不显示评分
    document.getElementById('go-stat-petals').style.display = 'none'; // 死亡不显示花瓣
    document.getElementById('go-stat-time').style.display = 'none'; // 死亡不显示用时
    document.getElementById('final-height').textContent = Math.max(0, Math.floor(state.maxHeight / 10));
    document.getElementById('gameover').style.display = 'flex';
  }

  // 通关评级与综合评分：花瓣余量权重最高 + 用时效率分
  function calcGrade() {
    // 用时效率分：5 分钟内通关拿满分，之后每秒递减
    const timeScore = Math.max(0, Math.round((300 - state.playTime) * 3));
    const score = state.petals * 30 + timeScore;
    let grade;
    if (state.petals >= 12 && state.playTime <= 300) grade = 'SSS';
    else if (state.petals >= 8 || state.playTime <= 360) grade = 'SS';
    else grade = 'S';
    return { grade, score };
  }
  function triggerWin() {
    state.gameOver = true;
    const { grade, score } = calcGrade();
    playSound('你过关.mp3');               // 通关音效
    document.getElementById('go-title').textContent = '你过关';
    document.getElementById('go-grade').textContent = grade;
    document.getElementById('go-score').textContent = score;
    document.getElementById('go-grade').style.display = 'block';
    document.getElementById('go-stat-sub').style.display = 'block';
    // 展示评级依据：剩余花瓣 + 通关用时
    const t = Math.max(0, Math.floor(state.playTime));
    const mt = Math.floor(t / 60), st = t % 60;
    document.getElementById('go-petals').textContent = state.petals;
    document.getElementById('go-time').textContent = mt + '分' + String(st).padStart(2, '0') + '秒';
    document.getElementById('go-stat-petals').style.display = 'block';
    document.getElementById('go-stat-time').style.display = 'block';
    document.getElementById('final-height').textContent = Math.max(0, Math.floor(state.maxHeight / 10));
    document.getElementById('gameover').style.display = 'flex';
    emitParticles(state.headX, state.headY, '#ffd76e', 50);
  }

  // 撞到左右边界墙掉花瓣（轻伤害：扣 1 瓣 + 向场内反弹，非减半）
  // 边界 = 墙内沿（atWallX）：花心真碰到墙内表面才算撞墙
  function wallCheck() {
    if (plantHidden()) return;   // 隐藏期无敌：不受撞墙伤害
    if (!atWallX(state.headX)) return;
    if (state.hitCooldown > 0) return; // 冷却期不重复扣
    state.hitCooldown = 2.5;           // 撞墙冷却，防止贴墙连续掉
    state.petals = Math.max(0, state.petals - 1);
    state.hitFlash = 0.8;
    shrinkFlower();            // 受击后缩小化肥档位
    // 向场内反弹，帮花离开墙面
    const dir = state.headX <= LEFT_BOUND ? 1 : -1;
    state.velocityX = dir * 260;
    emitParticles(state.headX, state.headY, '#ffb0c8', 10);
    if (state.petals <= 0) {
      state.petals = 0;
      triggerGameOver();
    }
  }

  function resetGame() {
    state.petals = 8;
    state.petalCap = 16;
    state.evolveIndex = -1;
    state.evolveFlash = 0;
    state.biomeIndex = -1;
    state.biomePrev = -1;
    state.biomeAnim = 0;
    const eb = document.getElementById('evolve-banner');
    eb.classList.remove('show');
    eb.style.display = 'none';
    state.sun = 0;
    state.sunCollected = 0;
    state.petalCollected = 0;
    state.birdsDodged = 0;
    state.meteorsDodged = 0;
    state.slotWins = 0;
    state.playTime = 0;
    state.freeSpins = 0;
    state.freeSpinMeterAcc = 0;
    state.freeSpinTimeAcc = 0;
    state.freeIdleTime = 0;
    state.lastSpinMeter = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.comboTimer = 0;
    // 新成就统计重置
    state.freeSpinUsed = 0;
    state.growBoostHits = 0;
    state.milkCount = 0;
    state.slotGot = {};
    state.rainLoseCount = 0;
    state.criticalHold = 0;
    state.stormTime = 0;
    state.windGrowHeight = 0;
    state.lastWindH = 0;
    state.maxHeight = 0;
    state.tipClosedL = false;    // 教学面板：新开一局后 20~80 米可再次弹出（左侧）
    state.tipClosedR = false;    // 教学面板：新开一局后 20~80 米可再次弹出（右侧）
    state.cameraX = 0;
    state.cameraY = 0;
    state.velocityX = 0;
    state.velocityY = 0;
    state.birds = [];
    state.airShips = [];
    state.airDodgedBy = {};
    state.airTimer = 0.8;
    state.birdTimer = 7;
    state.meteorites = [];
    state.meteorTimer = 5;
    state.cloudUnlocked = false;
    state.meteorUnlocked = false;
    state.annElevator = false;
    state.annWelcome = false;
    state.ann1600 = false;
    state.hitCooldown = 0;
    state.hitFlash = 0;
    state.slotFlash = 0;
    // 天气重置为晴天
    state.weather.kind = 'sunny';
    state.weather.timer = 12;
    state.weather.announce = 0;
    state.weather.active = 0;
    state.weather.rain = [];
    state.weather.stormFlash = 0;
    state.rainPetalTimer = 0;
    initDriftClouds();
    const wb = document.getElementById('weather-banner');
    wb.classList.remove('show');
    wb.style.display = 'none';
    state.growthPause = 0;
    state.slotPushVelX = 0;
    state.slotPushTime = 0;
    state.fertScale = 1;       // 化肥放大重置
    state.fertCount = 0;       // 化肥档位计数重置
    state.slotGrowTime = 0;
    state.slotGrowVy = 0;
    state.reviveSword = 0;
    state.swordGot = 0;
    state.swordUse = 0;
    state.windDir = 1;
    state.windPow = 2;
    state.windPush = 0;
    state.windPulse = 0;
    state.sunOrbs = [];
    state.petalOrbs = [];
    state.particles = [];
    state.trail = [];
    state.fireflies = [];
    state.nextFireflyHeight = 600;
    state.dragging = false;
    state.gameOver = false;
    resetBase();
    document.getElementById('gameover').style.display = 'none';
    updateSlotPullButton();
    updateSlotFreeDisplay(false);
  }
  document.getElementById('go-restart').addEventListener('click', resetGame);
