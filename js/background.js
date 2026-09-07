
  // === 碰撞 / 收集 ===
  function checkCollect() {
    const hr = 36; // 花头碰撞半径
    let sunChanged = false;
    for (const s of state.sunOrbs) {
      if (!s.alive) continue;
      const dx = s.x - state.headX;
      const dy = s.y - state.headY;
      if (dx * dx + dy * dy <= (s.r + hr) * (s.r + hr)) {
        s.alive = false;
        state.sun += 1 + weatherEffects().multSun; // 星空夜阳光翻倍
        state.sunCollected += 1 + weatherEffects().multSun; // 成就统计
        // 连击：连续收集阳光，刷新保持时间
        state.combo++;
        if (state.combo > state.maxCombo) state.maxCombo = state.combo;
        state.comboTimer = 4;
        sunChanged = true;
        emitParticles(s.x, s.y, '#ffd54a', 16);
      }
    }
    for (const p of state.petalOrbs) {
      if (!p.alive) continue;
      const dx = p.x - state.headX;
      const dy = p.y - state.headY;
      if (dx * dx + dy * dy <= (p.r + hr) * (p.r + hr)) {
        p.alive = false;
        // 花瓣上限随进化提升
        state.petals = Math.min(state.petalCap, state.petals + 1);
        state.petalCollected += 1; // 成就统计
        emitParticles(p.x, p.y, '#ff6fa3', 14);
      }
    }
    // 清理
    state.sunOrbs = state.sunOrbs.filter(s => s.alive && s.y - state.cameraY < H + 200);
    state.petalOrbs = state.petalOrbs.filter(p => p.alive && p.y - state.cameraY < H + 200);
    // 阳光变化时刷新拉杆按钮状态
    if (sunChanged && typeof updateSlotPullButton === 'function') updateSlotPullButton();
  }

  // === 渲染 ===
  function skyGradient() {
    // 顶部基色随地形里程碑渐变过渡（prev → cur 的 biomeAnim 混合）
    const prev = BIOMES[state.biomePrev + 1];
    const cur = curBiome();
    const m = state.biomeAnim;
    const PREV = prev ? prev.skyTop : cur.skyTop;
    let r1 = PREV[0] + (cur.skyTop[0] - PREV[0]) * m;
    let g1 = PREV[1] + (cur.skyTop[1] - PREV[1]) * m;
    let b1 = PREV[2] + (cur.skyTop[2] - PREV[2]) * m;
    // 天气影响整体色调
    const k = state.weather.kind;
    if (k === 'rain') { r1 *= 0.55; g1 *= 0.62; b1 *= 0.75; }
    else if (k === 'storm') { r1 *= 0.38; g1 *= 0.42; b1 *= 0.55; }
    else if (k === 'snow') { r1 *= 0.88; g1 *= 0.94; b1 *= 1.06; }   // 下雪：冷调微亮
    else if (k === 'wind') { r1 *= 0.8; g1 *= 0.85; b1 *= 0.72; }    // 大风：偏昏黄的刮天
    else if (k === 'starry' || k === 'aurora') { r1 = 20; g1 = 22; b1 = 52; }
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgb(${Math.floor(r1)},${Math.floor(g1)},${Math.floor(b1)})`);
    g.addColorStop(1, '#fcd5ce');
    return g;
  }

  // 地形远景剪影：随地形切换淡入，装饰地平线（画在天空与地面之间）
  function drawBiomeBackdrop() {
    const bIdx = state.biomeIndex;   // 0绿野 / 1风车 / 2海岸 / 3云海
    const m = state.biomeAnim;
    const base = H - 210;
    ctx.save();
    ctx.globalAlpha = 0.45 + 0.55 * m;
    if (bIdx <= 0) {
      // 绿野：青绿远山
      ctx.fillStyle = 'rgba(96, 158, 118, 0.42)';
      ctx.beginPath();
      ctx.moveTo(0, base + 40);
      ctx.quadraticCurveTo(W * 0.25, base - 90, W * 0.5, base + 10);
      ctx.quadraticCurveTo(W * 0.75, base - 40, W, base + 60);
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    } else if (bIdx === 1) {
      // 风车山丘：棕灰丘 + 两座转动的风车
      ctx.fillStyle = 'rgba(150, 130, 96, 0.5)';
      ctx.beginPath();
      ctx.moveTo(0, base + 60);
      ctx.quadraticCurveTo(W * 0.3, base - 70, W * 0.62, base + 5);
      ctx.quadraticCurveTo(W * 0.85, base - 50, W, base + 55);
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(230, 226, 214, 0.8)';
      const rotY = base - 40, ang = performance.now() / 900;
      for (const wx of [W * 0.22, W * 0.74]) {
        ctx.fillRect(wx, rotY, 8, 56);
        ctx.save();
        ctx.translate(wx + 4, rotY);
        ctx.rotate(ang);
        ctx.fillRect(-16, -2, 32, 4); ctx.fillRect(-2, -16, 4, 32);
        ctx.restore();
      }
    } else if (bIdx === 2) {
      // 海岸云湾：云端海面 + 海上仙岛剪影（梦幻神秘）
      const nowT = performance.now() / 1000;
      // 1) 上层海面色，下接亮白光晕过渡
      const seaGrad = ctx.createLinearGradient(0, base - 10, 0, H);
      seaGrad.addColorStop(0, 'rgba(120, 190, 225, 0.5)');
      seaGrad.addColorStop(0.55, 'rgba(70, 150, 200, 0.6)');
      seaGrad.addColorStop(1, 'rgba(35, 90, 140, 0.68)');
      ctx.fillStyle = seaGrad;
      ctx.fillRect(0, base - 10, W, H - (base - 10));
      // 2) 座漂浮仙岛剪影（近大远小，沿海面由近到远布列）
      const seeds = [
        { f: 0.12, s: 1.15, h: 42, peak: 1.0 },
        { f: 0.30, s: 0.8,  h: 26, peak: 1.2 },
        { f: 0.52, s: 1.0,  h: 34, peak: 0.9 },
        { f: 0.74, s: 0.65, h: 20, peak: 1.3 },
        { f: 0.90, s: 0.5,  h: 15, peak: 1.1 },
      ];
      for (let i = 0; i < seeds.length; i++) {
        const sd = seeds[i];
        const ix = sd.f * W;
        const iy = base + 8 + (i % 2) * 10 + Math.sin(nowT * 0.25 + i * 1.8) * 3; // 岛屿轻微上下漂浮
        const ih = sd.h * sd.s;          // 岛体高
        const iw = ih * 1.5;             // 岛宽
        ctx.fillStyle = i % 2 ? 'rgba(30, 60, 90, 0.55)' : 'rgba(40, 78, 115, 0.55)';
        // 山形：底部矩形 + 顶部三角峰
        ctx.beginPath();
        ctx.moveTo(ix - iw / 2, iy + ih * 0.3);
        ctx.quadraticCurveTo(ix - iw * 0.35, iy - ih * (0.5 * sd.peak), ix, iy - ih * sd.peak); // 左坡
        ctx.quadraticCurveTo(ix + iw * 0.35, iy - ih * (0.5 * sd.peak), ix + iw / 2, iy + ih * 0.3); // 右坡
        ctx.closePath();
        ctx.fill();
        // 岛根部的青苔带（海面交界处）
        ctx.fillStyle = 'rgba(150, 220, 190, 0.25)';
        ctx.beginPath();
        ctx.ellipse(ix, iy + ih * 0.28, iw * 0.5, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // 3) 飞过的海鸥剪影
      ctx.strokeStyle = 'rgba(50, 70, 100, 0.6)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const gx = ((nowT * 18 + i * 190) % (W + 90)) - 45;
        const gy = base - 10 - (i * 24) - Math.sin(nowT * 2 + i) * 6;
        ctx.beginPath();
        ctx.moveTo(gx - 7, gy);
        ctx.quadraticCurveTo(gx - 3, gy - 5, gx, gy);
        ctx.quadraticCurveTo(gx + 3, gy - 5, gx + 7, gy);
        ctx.stroke();
      }
      // 4) 波光涟漪
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const y = base + 40 + i * 30 + Math.sin(nowT * 1.2 + i) * 3;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.quadraticCurveTo(W * 0.25, y - 6, W * 0.5, y);
        ctx.quadraticCurveTo(W * 0.75, y + 6, W, y);
        ctx.stroke();
      }
    } else {
      // === 星空云海：落星雨 + 垂直流光下坠 ===
      const tN = performance.now() / 1000;
      const top = 0;      // 从屏幕顶部铺满整个背景
      const bh = H;
      // 1) 落星雨：大量小星密布、快速向下坠落（带短拖尾），循环补位
      for (let i = 0; i < 90; i++) {
        const sx = ((i * 0.011 + hash(i)) * W) % W;         // 横向散布
        const fall = (60 + (i % 5) * 34) * tN;               // 各星不同下落速度
        const sy = top + (((hash(i + 2) * bh) + fall) % bh); // 顶部落到底部循环
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(tN * 2 + i * 1.9));
        const len = 6 + (i % 4) * 4;                          // 拖尾长度
        // 拖尾（由亮到透明）
        const st = ctx.createLinearGradient(0, sy, 0, sy + len);
        st.addColorStop(0, 'rgba(255,255,255,0.9)');
        st.addColorStop(1, 'rgba(150,180,255,0)');
        ctx.strokeStyle = st; ctx.lineWidth = 1.1;
        ctx.globalAlpha = tw;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + len); ctx.stroke();
        // 头部光点
        ctx.fillStyle = i % 4 === 0 ? '#fff7cf' : '#ffffff';
        ctx.beginPath(); ctx.arc(sx, sy, 1.2 + (i % 3) * 0.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 2) 垂直流光下坠：柔性竖向光带，缓慢向下流动（发光渐变 + 亮核）
      for (let i = 0; i < 14; i++) {
        const lx = ((i * 0.07 + hash(i + 50)) * W) % W;
        const speed = 22 + (i % 4) * 12;
        const ly = top + (((hash(i + 12) * bh) + tN * speed) % bh); // 向下流动循环
        const ll = 90 + (i % 5) * 40;                                 // 光带长度
        const col = i % 3 === 0 ? '120,190,255' : (i % 3 === 1 ? '200,150,255' : '255,180,220');
        // 光带由亮到透明 + 边缘柔光
        const lg = ctx.createLinearGradient(0, ly, 0, ly + ll);
        lg.addColorStop(0, `rgba(${col},0)`);
        lg.addColorStop(0.5, `rgba(${col},0.30)`);
        lg.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = lg;
        ctx.fillRect(lx - 1.2, ly, 2.4, ll);
        // 中心亮核
        ctx.fillStyle = `rgba(${col},0.55)`;
        ctx.fillRect(lx - 0.5, ly, 1, ll);
      }
    }
    ctx.restore();
  }

  function drawSun() {
    // 星空夜 / 极光时是夜晚，不画出太阳
    const sk = state.weather.kind;
    if (sk === 'starry' || sk === 'aurora') return;
    const sx = W - 200; // 太阳靠左移：距右边 200px
    const sy = 80 + Math.sin(performance.now() / 1500) * 4;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 80);
    grad.addColorStop(0, 'rgba(255, 235, 130, 0.9)');
    grad.addColorStop(0.5, 'rgba(255, 200, 80, 0.4)');
    grad.addColorStop(1, 'rgba(255, 200, 80, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, 80, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3a8';
    ctx.beginPath();
    ctx.arc(sx, sy, 30, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGrass(t) {
    const baseY = state.baseY - state.cameraY; // 地面世界线（屏幕坐标）
    if (baseY > H + 40) return; // 镜头升太高时地面已滚出屏幕
    const camX = state.cameraX;
    for (const g of state.grassTufts) {
      const x = g.x - camX;
      if (x < -10 || x > W + 10) continue;
      const sway = Math.sin(t * g.swaySpeed + g.sway) * 4;
      ctx.strokeStyle = '#3aa260';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.quadraticCurveTo(x + sway * 0.5, baseY - g.h * 0.6, x + sway, baseY - g.h);
      ctx.stroke();
    }
  }

  // 花园里的小花（更具体 — 五瓣小花，固定在土地上）
  function drawGardenFlowers(t) {
    const baseY = state.baseY - state.cameraY; // 地面世界线
    if (baseY > H + 60) return;
    const camX = state.cameraX;
    for (const f of state.gardenFlowers) {
      const fx = f.x - camX;
      if (fx < -30 || fx > W + 30) continue;
      const sway = Math.sin(t * f.swaySpeed + f.sway) * f.swayAmp;
      const x = fx + sway;
      const y = baseY;
      // 茎
      ctx.strokeStyle = '#3a8b4a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(fx, y);
      ctx.quadraticCurveTo((fx + x) / 2, y - f.h * 0.6, x, y - f.h);
      ctx.stroke();
      // 头（5 瓣）
      const hx = x;
      const hy = y - f.h;
      const r = 4.5;
      ctx.fillStyle = f.color;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(hx + Math.cos(a) * r, hy + Math.sin(a) * r, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // 花心
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath();
      ctx.arc(hx, hy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 蘑菇（固定在土地上）
  function drawMushrooms() {
    const baseY = state.baseY - state.cameraY; // 地面世界线
    if (baseY > H + 40) return;
    const camX = state.cameraX;
    for (const m of state.mushrooms) {
      const x = m.x - camX;
      if (x < -30 || x > W + 30) continue;
      // 茎
      ctx.fillStyle = '#f5e6c8';
      ctx.fillRect(x - 2, baseY - m.h, 4, m.h);
      // 帽
      ctx.fillStyle = m.capColor;
      ctx.beginPath();
      ctx.ellipse(x, baseY - m.h, m.capW / 2, m.capH, 0, Math.PI, 0);
      ctx.fill();
      // 斑点
      if (m.capColor === '#e74c3c') {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x - 3, baseY - m.h - 1, 1.5, 0, Math.PI * 2);
        ctx.arc(x + 4, baseY - m.h - 3, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 石头（固定在土地上）
  function drawStones() {
    const baseY = state.baseY - state.cameraY; // 地面世界线
    if (baseY > H + 40) return;
    const camX = state.cameraX;
    for (const s of state.stones) {
      const x = s.x - camX;
      if (x < -20 || x > W + 20) continue;
      ctx.fillStyle = `rgba(120, 120, 130, ${s.shade})`;
      ctx.beginPath();
      ctx.ellipse(x, baseY - s.r * 0.3, s.r, s.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 255, 255, ${s.shade * 0.3})`;
      ctx.beginPath();
      ctx.ellipse(x - s.r * 0.3, baseY - s.r * 0.5, s.r * 0.3, s.r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 蝴蝶 — 在花头附近飞舞
  function updateButterflies(dt) {
    if (state.maxHeight >= BIRD_UNLOCK_AT) return; // 200 米后蝴蝶消失
    const headScreenX = state.headX - state.cameraX;
    const headScreenY = state.headY - state.cameraY;
    for (const b of state.butterflies) {
      // 定期重新选目标点（在花头附近随机偏移）
      b.retarget -= dt;
      if (b.retarget <= 0 || !b.target) {
        b.target = {
          x: headScreenX + rand(-80, 80),
          y: headScreenY + rand(-60, 20),
        };
        b.retarget = rand(1.5, 3);
      }
      // 朝目标点移动（用 lerp 让动作柔和）
      const dx = b.target.x - b.x;
      const dy = b.target.y - b.y;
      b.vx += dx * 1.2 * dt;
      b.vy += dy * 1.2 * dt;
      // 速度阻尼
      b.vx *= 0.95;
      b.vy *= 0.95;
      b.x += b.vx;
      b.y += b.vy;
      b.wing += dt;
    }
  }
  function drawButterflies() {
    if (state.maxHeight >= BIRD_UNLOCK_AT) return; // 200 米后蝴蝶消失
    for (const b of state.butterflies) {
      const flap = Math.abs(Math.sin(b.wing * b.wingSpeed));
      const s = b.size;
      // 翅膀
      ctx.save();
      ctx.translate(b.x, b.y);
      // 身体
      ctx.fillStyle = '#333';
      ctx.fillRect(-0.5, -2, 1, 4);
      // 左翅
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.ellipse(-s * 0.5, 0, s * (0.5 + flap * 0.4), s * (0.7 - flap * 0.3), 0, 0, Math.PI * 2);
      ctx.fill();
      // 右翅
      ctx.beginPath();
      ctx.ellipse(s * 0.5, 0, s * (0.5 + flap * 0.4), s * (0.7 - flap * 0.3), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // 萤火虫 — 高度达到一定时出现
  function updateFireflies(dt) {
    const curH = state.maxHeight;
    while (state.nextFireflyHeight < curH) {
      state.fireflies.push({
        x: rand(0, W),
        y: rand(0, H),
        vx: rand(-15, 15),
        vy: rand(-10, 10),
        phase: rand(0, Math.PI * 2),
        twinkleSpeed: rand(2, 4),
      });
      state.nextFireflyHeight += rand(400, 700);
    }
    for (const f of state.fireflies) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vx += rand(-3, 3) * dt;
      f.vy += rand(-3, 3) * dt;
      f.vx *= 0.98;
      f.vy *= 0.98;
      if (f.x < 0) f.x = W;
      if (f.x > W) f.x = 0;
      if (f.y < 0) f.y = H;
      if (f.y > H) f.y = 0;
      f.phase += dt * f.twinkleSpeed;
    }
  }
  function drawFireflies() {
    for (const f of state.fireflies) {
      const a = (Math.sin(f.phase) + 1) * 0.5; // 0..1
      const glow = 4 + a * 4;
      const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, glow * 2);
      grad.addColorStop(0, `rgba(255, 245, 160, ${0.4 + a * 0.5})`);
      grad.addColorStop(1, 'rgba(255, 245, 160, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(f.x, f.y, glow * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 250, 200, ${0.7 + a * 0.3})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 拖尾：花头移动时在身后留下淡淡光点
  function updateTrail(dt) {
    const headSpeed = Math.hypot(state.velocityX, state.velocityY);
    if (headSpeed > 30 || state.dragging) {
      // 根据移动速度撒一些光点
      const n = Math.min(3, Math.floor(headSpeed / 80));
      for (let i = 0; i < n; i++) {
        state.trail.push({
          x: state.headX - state.cameraX + rand(-6, 6),
          y: state.headY - state.cameraY + rand(-6, 6),
          life: 1.0,
          maxLife: rand(0.6, 1.2),
          r: rand(2, 4),
          color: Math.random() < 0.5 ? '#ffd1e6' : '#fff59d',
        });
      }
    }
    for (const p of state.trail) {
      p.life -= dt;
    }
    state.trail = state.trail.filter(p => p.life > 0);
    // 限制数量
    if (state.trail.length > 80) state.trail.splice(0, state.trail.length - 80);
  }
  function drawTrail() {
    for (const p of state.trail) {
      const t = p.life / p.maxLife;
      const a = t * 0.6;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * t, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
