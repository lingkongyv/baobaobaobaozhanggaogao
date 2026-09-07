
  // === 飞鸟：蒜鸟四帧动画（蒜鸟0001~0004 循环播放） ===
const BIRD_FRAME_FILES = ['蒜鸟0001.png', '蒜鸟0002.png', '蒜鸟0003.png', '蒜鸟0004.png'];
const birdFrames = BIRD_FRAME_FILES.map((f) => {
  const im = new Image();
  im.src = 'photo/' + encodeURIComponent(f);
  if (im.decode) im.decode().catch(() => {}); // 预解码，避免首次上屏卡顿
  return im;
});
const BIRD_FPS = 10; // 动画播放帧率
function birdFramesReady() {
  return birdFrames.every(f => f.complete && f.naturalWidth > 0);
}

function drawBirds() {
  const now = performance.now();
  const ready = birdFramesReady();
  // 当前应显示的帧：随时间循环 0001→0002→0003→0004→0001…
  const cur = birdFrames[Math.floor(now / 1000 * BIRD_FPS) % birdFrames.length];
  for (const b of state.birds) {
    const x = b.x - state.cameraX;
    const y = b.y - state.cameraY;
    if (x < -90 || x > W + 90) continue;
    const s = b.size;
    const dir = b.vx > 0 ? -1 : 1; // 蒜鸟图默认头朝左：从左往右飞时镜像翻转，从右往左飞保持原图
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    if (ready) {
      // 蒜鸟动画帧：按比例缩放（宽度约为旧鸟身尺寸的 6.8 倍）
      const bw = s * 6.8;
      const bh = bw * cur.naturalHeight / cur.naturalWidth;
      ctx.drawImage(cur, -bw / 2, -bh / 2, bw, bh);
    } else {
      // 图片尚未加载完时的简易占位（蓝灰鸟身）
      ctx.fillStyle = '#5d7a99';
      ctx.beginPath();
      ctx.ellipse(0, 0, s, s * 0.68, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 靠近花头时显示警告
      const dx = state.headX - b.x;
      const dy = state.headY - b.y;
      if (dx * dx + dy * dy < 220 * 220) {
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.6 + Math.sin(performance.now() / 120) * 0.4;
        ctx.fillText('!', x, y - s - 8);
        ctx.globalAlpha = 1;
      }
    }
  }

  // 左右边界墙（栅栏）：固定在屏幕上（不随镜头滚动），花被限制在两墙之间。
  // 用固定屏幕坐标，因此无论花朵长多高，左右边界都稳稳贴在原处不移动。
  function drawWalls() {
    const topY = 0;
    const botY = H;
    ctx.save();
    for (let i = 0; i < 2; i++) {
      const wx = i === 0 ? WALL_MARGIN : W - WALL_MARGIN;
      // 栅栏竖杆（从屏幕顶排到屏幕底，位置固定）
      ctx.fillStyle = '#7a4e2d';
      ctx.strokeStyle = '#52331a';
      ctx.lineWidth = 1;
      for (let y = 0; y < H; y += 24) {
        ctx.fillRect(wx - 9, y, 18, 20);
        ctx.strokeRect(wx - 9, y, 18, 20);
      }
      // 上下横梁，强化"边界"存在感
      ctx.fillStyle = '#6b4423';
      ctx.fillRect(wx - 13, 4, 26, 9);
      ctx.fillRect(wx - 13, H - 13, 26, 9);
      // 底部与泥土交接处的阴影
      ctx.fillStyle = 'rgba(40, 70, 46, 0.55)';
      ctx.fillRect(wx - 12, H - 30, 24, 18);
    }
    ctx.restore();
  }

  function drawGround() {
    // 地面 = 世界坐标中固定的一条线（state.baseY），随镜头自然滚动
    const gy = state.baseY - state.cameraY;
    if (gy > H + 4) return; // 镜头升太高，地面已滚出屏幕下方
    // 泥土从地面线填到屏幕底部
    ctx.fillStyle = '#5fb866';
    ctx.fillRect(0, gy, W, H - gy);
    // 地面线高光
    ctx.fillStyle = '#4aa056';
    ctx.fillRect(0, gy, W, 4);
  }

  // 右侧地面的黄鹤楼参照物（站在世界地面线上，随镜头滚动）
  function drawTower() {
    if (!towerImg.complete || towerImg.naturalWidth === 0) return;
    const gy = state.baseY - state.cameraY;   // 地面世界线（屏幕坐标）
    const x = W * 0.5;                         // 放在居中
    const h =  H * 1.5;        // 楼的世界高度（随窗口缩放放大）
    if (state.maxHeight >= 1600) return;  // 花头高度超过 160 米后黄鹤楼才消失
    const ar = towerImg.naturalWidth / Math.max(1, towerImg.naturalHeight);
    ctx.drawImage(towerImg, x - (h * ar) / 2, gy - h, h * ar, h);
  }

  // 茎的渲染（用 quadratic curves 平滑 + 软光晕层叠 + 锥度）
  // 平滑路径构建器：用 midpoint 法做 Catmull-Rom-like 平滑
  function buildSmoothPath(pts, applyCamera) {
    const path = [];
    if (pts.length < 2) return path;
    // 降采样：茎点过多时每隔几格取一点，降低每帧路径复杂度与 GC 压力
    // （点数 >300 时约每 2~3 点取一，配合中点平滑视觉几乎不变）
    if (pts.length > 300) {
      const step = Math.max(2, Math.ceil(pts.length / 300));
      const reduced = [];
      for (let i = 0; i < pts.length; i += step) reduced.push(pts[i]);
      if (reduced[reduced.length - 1] !== pts[pts.length - 1]) reduced.push(pts[pts.length - 1]);
      pts = reduced;
    }
    if (pts.length === 2) {
      path.push({ type: 'M', x: pts[0].x - (applyCamera ? state.cameraX : 0), y: pts[0].y - (applyCamera ? state.cameraY : 0) });
      path.push({ type: 'L', x: pts[1].x - (applyCamera ? state.cameraX : 0), y: pts[1].y - (applyCamera ? state.cameraY : 0) });
      return path;
    }
    // 用 control points + midpoint 作为端点的方式做平滑
    path.push({ type: 'M', x: pts[0].x, y: pts[0].y });
    for (let i = 1; i < pts.length - 1; i++) {
      // 中点作为下一段端点
      const midX = (pts[i].x + pts[i + 1].x) / 2;
      const midY = (pts[i].y + pts[i + 1].y) / 2;
      path.push({ type: 'Q', cx: pts[i].x, cy: pts[i].y, x: midX, y: midY });
    }
    // 最后一段
    const last = pts[pts.length - 1];
    path.push({ type: 'L', x: last.x, y: last.y });
    if (applyCamera) {
      for (const seg of path) {
        seg.x = (seg.x || 0) - state.cameraX;
        seg.y = (seg.y || 0) - state.cameraY;
        if (seg.cx !== undefined) { seg.cx -= state.cameraX; seg.cy -= state.cameraY; }
      }
    }
    return path;
  }
  function tracePath(path) {
    ctx.beginPath();
    for (const seg of path) {
      if (seg.type === 'M') ctx.moveTo(seg.x, seg.y);
      else if (seg.type === 'L') ctx.lineTo(seg.x, seg.y);
      else if (seg.type === 'Q') ctx.quadraticCurveTo(seg.cx, seg.cy, seg.x, seg.y);
    }
  }

  // 隐藏期：上升 20~80 米时花朵与根茎暂时不可见，到达 80 米后重现
  // （1米 = 10px，即 maxHeight 200 ~ 800）
  function plantHidden() {
    const m = state.maxHeight / 10;
    return m >= 20 && m < 80;
  }
  function drawStem() {
    if (plantHidden()) return;
    const pts = state.points;
    if (pts.length < 2) return;

    // 渐变：根部深绿 → 中段翠绿 → 头部嫩绿
    const yMin = Math.min(state.baseY, state.headY);
    const yMax = Math.max(state.baseY, state.headY);
    const grad = ctx.createLinearGradient(0, yMin, 0, yMax);
    grad.addColorStop(0, '#2f7a3a');
    grad.addColorStop(0.5, '#4ea15a');
    grad.addColorStop(1, '#8fdc8c');

    // 高光渐变（白）
    const hi = ctx.createLinearGradient(0, yMin, 0, yMax);
    hi.addColorStop(0, 'rgba(255,255,255,0.10)');
    hi.addColorStop(1, 'rgba(255,255,255,0.30)');

    // 平滑路径
    const path = buildSmoothPath(pts, true);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const fert = state.fertScale || 1;       // 化肥：根茎随放大倍数变粗
    const stemW = 8 * (0.7 + 0.3 * fert);    // 主茎线宽
    const glowW = 10 * (0.7 + 0.3 * fert);   // 外发光线宽

    // === 1. 柔和外发光（单层大线宽低透明度描边模拟光晕，避免昂贵的 shadowBlur） ===
    const glowStroke = (w, alpha) => {
      ctx.strokeStyle = `rgba(140, 220, 160, ${alpha})`;
      ctx.lineWidth = w;
      tracePath(path);
      ctx.stroke();
    };
    glowStroke(glowW, 0.2);

    // === 2. 主茎：底层较深（增厚感） ===
    ctx.strokeStyle = grad;
    ctx.lineWidth = stemW;
    tracePath(path);
    ctx.stroke();

    // === 3. 锥度：茎的粗细沿长度变化（用单次 stroke 配合渐变模拟） ===
    // 已经通过渐变颜色营造层次；如果想加物理锥度可改为分段 stroke

    // === 4. 高光（沿茎中心偏左一线） ===
    ctx.strokeStyle = hi;
    ctx.lineWidth = 2.2;
    tracePath(path);
    ctx.stroke();

    // === 5. 顶部尖端柔光（小光点收尾） ===
    const last = pts[pts.length - 1];
    const lx = last.x - state.cameraX;
    const ly = last.y - state.cameraY;
    const tipGrad = ctx.createRadialGradient(lx, ly, 0, lx, ly, 6);
    tipGrad.addColorStop(0, 'rgba(255, 255, 200, 0.6)');
    tipGrad.addColorStop(1, 'rgba(255, 255, 200, 0)');
    ctx.fillStyle = tipGrad;
    ctx.beginPath();
    ctx.arc(lx, ly, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 叶子：以花头为基准向下排布
    const leafEvery = 90;
    const stemLen = state.baseY - state.headY;
    const leafCount = Math.min(8, Math.floor(stemLen / leafEvery));
    for (let i = 0; i < leafCount; i++) {
      const target = state.headY + (i + 1) * leafEvery;
      drawLeafAt(target, i);
    }
  }

  function drawLeafAt(yTarget, idx) {
    // 在茎的路径上找到最接近 yTarget 的点
    const pts = state.points;
    if (pts.length < 2) return;
    // 叶子总是靠近花头（数组尾部），从尾部反向搜索、命中即停，避免每帧全量遍历
    let best = pts.length - 1;
    let bestD = Infinity;
    const start = Math.max(0, pts.length - 400);
    for (let i = pts.length - 1; i >= start; i--) {
      const d = Math.abs(pts[i].y - yTarget);
      if (d < bestD) { bestD = d; best = i; if (bestD < 4) break; }
    }
    if (bestD > 10) return; // 容忍度
    const p = pts[best];
    const side = idx % 2 === 0 ? 1 : -1;
    const len = 22 + (idx % 3) * 4;
    const x = p.x - state.cameraX;
    const y = p.y - state.cameraY;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(side * 0.3 + Math.sin(performance.now() / 800 + idx) * 0.04);
    ctx.fillStyle = '#5fc26b';
    ctx.beginPath();
    ctx.ellipse(side * len * 0.5, 0, len * 0.5, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a9a4d';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // 叶脉
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(side * len, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawFlowerHead() {
    if (plantHidden()) return;
    const x = state.headX - state.cameraX;
    const y = state.headY - state.cameraY;
    const t = performance.now() / 1000;
    const breathe = 1 + Math.sin(t * 2) * 0.04;
    // 花瓣数 = 生命值（初始 8，被蒜鸟撞扣 1 瓣，收集花瓣 +1 上限 16）
    const petalCount = Math.max(0, state.petals);
    const ev = curEvolution();
    const fert = state.fertScale || 1; // 化肥放大倍数
    const petalSize = (11 + petalCount * 0.45) * ev.scale * fert;
    const innerR = (11 + petalCount * 0.35) * ev.scale * fert;

    // 受击无敌期：花朵闪烁半透明
    const invulnerable = state.hitCooldown > 0;
    ctx.save();
    if (invulnerable) {
      ctx.globalAlpha = 0.45 + Math.abs(Math.sin(t * 16)) * 0.45;
    }

    // 阴影
    ctx.save();
    ctx.translate(x, y + 6);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(0, 0, innerR * 0.9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 鼠标按下时花头高亮
    const highlight = state.dragging;

    // === 进化光环 + 专属特效 ===
    const haloR = (innerR + 12 + petalSize * 0.25) * breathe;
    const hg = ctx.createRadialGradient(x, y, 0, x, y, haloR);
    hg.addColorStop(0, `rgba(${ev.ring}, 0.45)`);
    hg.addColorStop(1, `rgba(${ev.ring}, 0)`);
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(x, y, haloR, 0, Math.PI * 2);
    ctx.fill();
    if (ev.fire) {
      // 凤凰花：向上蹿升的火焰
      ctx.fillStyle = 'rgba(255, 160, 60, 0.85)';
      for (let i = 0; i < 10; i++) {
        const ph = (t * 1.4 + i * 0.63) % 1;
        const fs = (1 - ph) * 5 + 2;
        ctx.beginPath();
        ctx.arc(x + Math.sin(t * 6 + i) * (haloR * 0.35), y - haloR * ph, fs, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (ev.crystal) {
      // 水晶花：环绕的折射星点
      ctx.strokeStyle = 'rgba(220, 245, 255, 0.85)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 8; i++) {
        const a = t * 1.1 + (i / 8) * Math.PI * 2;
        const cx2 = x + Math.cos(a) * (innerR + 11);
        const cy2 = y + Math.sin(a) * (innerR + 11);
        ctx.beginPath();
        ctx.moveTo(cx2 - 2, cy2);
        ctx.lineTo(cx2 + 2, cy2);
        ctx.moveTo(cx2, cy2 - 2);
        ctx.lineTo(cx2, cy2 + 2);
        ctx.stroke();
      }
    }
    if (ev.wide) {
      // 莲叶花：大瓣 + 外圈呼吸涟漪
      ctx.strokeStyle = `rgba(${ev.ring}, 0.4)`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y + 3, innerR + 6 + Math.sin(t * 3) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 花瓣
    for (let i = 0; i < petalCount; i++) {
      const a = (i / petalCount) * Math.PI * 2 + t * 0.5;
      const px = x + Math.cos(a) * (innerR + 4);
      const py = y + Math.sin(a) * (innerR + 4);
      const grad = ctx.createRadialGradient(px, py, 1, px, py, petalSize);
      if (highlight) {
        grad.addColorStop(0, '#fff5fb');
        grad.addColorStop(1, ev.petal[1]);
      } else {
        grad.addColorStop(0, ev.petal[0]);
        grad.addColorStop(1, ev.petal[1]);
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(px, py, petalSize * 0.7 * breathe, petalSize * 0.5 * breathe, a, 0, Math.PI * 2);
      ctx.fill();
    }

    // 花心
    const fgrad = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, innerR);
    fgrad.addColorStop(0, ev.core[0]);
    fgrad.addColorStop(1, ev.core[1]);
    ctx.fillStyle = fgrad;
    ctx.beginPath();
    ctx.arc(x, y, innerR * breathe, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛（萌）+ 看向鼠标 + 偶尔眨眼
    const blinkPhase = t % 4; // 每 4 秒眨一次
    const isBlinking = blinkPhase < 0.15;
    // 鼠标屏幕位置（用于视线追踪）
    const mouseX = state.lastMouseX || W / 2;
    const mouseY = state.lastMouseY || H / 2;
    const lookDx = mouseX - x;
    const lookDy = mouseY - y;
    const lookLen = Math.hypot(lookDx, lookDy) || 1;
    const lookMax = 1.6; // 视线偏移上限
    const lookX = (lookDx / lookLen) * Math.min(lookMax, lookLen * 0.05);
    const lookY = (lookDy / lookLen) * Math.min(lookMax, lookLen * 0.05);

    ctx.fillStyle = '#3a2a14';
    if (isBlinking) {
      // 眨眼 — 用短线代替圆点
      ctx.strokeStyle = '#3a2a14';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 5.5, y - 2);
      ctx.lineTo(x - 2.5, y - 2);
      ctx.moveTo(x + 2.5, y - 2);
      ctx.lineTo(x + 5.5, y - 2);
      ctx.stroke();
    } else {
      // 眼白（更明显）
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(x - 4, y - 2, 2.6, 2.4, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 4, y - 2, 2.6, 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
      // 眼珠（看向鼠标）
      ctx.fillStyle = '#3a2a14';
      ctx.beginPath();
      ctx.arc(x - 4 + lookX, y - 2 + lookY, 1.4, 0, Math.PI * 2);
      ctx.arc(x + 4 + lookX, y - 2 + lookY, 1.4, 0, Math.PI * 2);
      ctx.fill();
      // 高光
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x - 4 + lookX - 0.4, y - 2 + lookY - 0.4, 0.5, 0, Math.PI * 2);
      ctx.arc(x + 4 + lookX - 0.4, y - 2 + lookY - 0.4, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 腮红
    ctx.fillStyle = 'rgba(255, 130, 160, 0.45)';
    ctx.beginPath();
    ctx.ellipse(x - 8, y + 3, 2.5, 1.5, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 8, y + 3, 2.5, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 表情：坏天气（大雨 / 雷暴 / 大雪 / 大风）→ 沮丧苦瓜脸
    const sadW = state.weather.kind === 'rain' || state.weather.kind === 'storm' || state.weather.kind === 'snow' || state.weather.kind === 'wind';
    // 苦瓜眉（倒八字愁眉：眉尾高抬、眉头低垂）+ 眉间皱眉纹 + 半垂困倦睑
    if (sadW) {
      ctx.strokeStyle = '#3a2a14';
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      // 左眉（倒八字）
      ctx.moveTo(x - 8, y - 4.5);
      ctx.lineTo(x - 4.5, y - 9);
      ctx.lineTo(x - 1, y - 5.5);
      // 右眉（倒八字）
      ctx.moveTo(x + 8, y - 4.5);
      ctx.lineTo(x + 4.5, y - 9);
      ctx.lineTo(x + 1, y - 5.5);
      ctx.stroke();
      // 眉间愁纹（两条细短竖线）
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(58,42,20,0.7)';
      ctx.beginPath();
      ctx.moveTo(x - 1.2, y - 4.5); ctx.lineTo(x - 1.2, y - 2.2);
      ctx.moveTo(x + 1.2, y - 4.5); ctx.lineTo(x + 1.2, y - 2.2);
      ctx.stroke();
      // 半垂上睑（困倦哭相，盖住眼睛上半）
      ctx.strokeStyle = 'rgba(58,42,20,0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x - 4.5, y - 4, 5, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + 4.5, y - 4, 5, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
    }
    // 沮丧泪滴 + 泪痕（从眼角斜滑落）
    if (sadW && !isBlinking) {
      // 泪痕
      ctx.strokeStyle = 'rgba(150,200,255,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 6, y - 0.5); ctx.quadraticCurveTo(x - 7.2, y + 3, x - 6.8, y + 5.5);
      ctx.moveTo(x + 6, y - 0.5); ctx.quadraticCurveTo(x + 7.2, y + 3, x + 6.8, y + 5.5);
      ctx.stroke();
      // 泪珠（竖长泪滴，悬在眼下方）
      ctx.fillStyle = 'rgba(160,205,255,0.9)';
      ctx.beginPath(); ctx.ellipse(x - 4.5, y + 4.5, 1.3, 1.9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + 4.5, y + 4.5, 1.3, 1.9, 0, 0, Math.PI * 2); ctx.fill();
    }
    // 嘴（正常微笑 / 拖拽惊讶 / 坏天气沮丧）
    ctx.strokeStyle = '#3a2a14';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    if (state.dragging) {
      // O 嘴 — 惊讶
      ctx.arc(x, y + 3, 1.8, 0, Math.PI * 2);
    } else if (sadW) {
      // 沮丧哭嘴 — 更大、嘴角大幅下拉（向下弯）
      ctx.arc(x, y + 7.5, 3.8, Math.PI * 1.12, Math.PI * 1.88);
    } else {
      // 微笑
      ctx.arc(x, y + 2, 3, 0.1 * Math.PI, 0.9 * Math.PI);
    }
    ctx.stroke();

    // 拖拽时光晕
    if (highlight) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, innerR + 14 + Math.sin(t * 8) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 受击无敌期结束 — 恢复透明度
    ctx.restore();
  }

  function drawCollectibles() {
    for (const s of state.sunOrbs) {
      const x = s.x - state.cameraX;
      const y = s.y - state.cameraY;
      if (y < -50 || y > H + 50) continue;
      s.pulse = (s.pulse + 0.05) % (Math.PI * 2);
      const r = (s.r + Math.sin(s.pulse) * 2) * 2; // 视觉放大一倍
      // 外圈光晕
      const halo = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 2.1);
      halo.addColorStop(0, 'rgba(255,238,160,0.6)');
      halo.addColorStop(0.6, 'rgba(255,220,90,0.25)');
      halo.addColorStop(1, 'rgba(255,210,80,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.1, 0, Math.PI * 2);
      ctx.fill();
      // 本体
      const g = ctx.createRadialGradient(x, y, 1, x, y, r);
      g.addColorStop(0, '#fff8c4');
      g.addColorStop(0.5, '#ffd54a');
      g.addColorStop(1, 'rgba(255,200,80,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      // 光线
      ctx.strokeStyle = 'rgba(255, 230, 120, 0.7)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + s.pulse * 0.5;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4));
        ctx.lineTo(x + Math.cos(a) * (r + 16), y + Math.sin(a) * (r + 16));
        ctx.stroke();
      }
    }

    for (const p of state.petalOrbs) {
      const x = p.x - state.cameraX;
      const y = p.y - state.cameraY;
      if (y < -50 || y > H + 50) continue;
      p.rot += p.rotSpeed * 0.016;
      const pr = p.r * 2; // 视觉放大一倍
      // 外圈光晕
      const halo = ctx.createRadialGradient(x, y, pr * 0.5, x, y, pr * 2);
      halo.addColorStop(0, 'rgba(255,170,205,0.55)');
      halo.addColorStop(0.6, 'rgba(255,140,180,0.25)');
      halo.addColorStop(1, 'rgba(255,120,170,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, pr * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.rot);
      ctx.fillStyle = '#ff6fa3';
      ctx.beginPath();
      ctx.ellipse(0, 0, pr, pr * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff8fbe';
      ctx.beginPath();
      ctx.ellipse(0, 0, pr * 0.5, pr * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawParticles(dt) {
    for (const p of state.particles) {
      p.age += dt;
      if (p.age >= p.life) continue;
      const t = p.age / p.life;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 80 * dt; // 重力
      const alpha = 1 - t;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x - state.cameraX, p.y - state.cameraY, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    state.particles = state.particles.filter(p => p.age < p.life);
  }

  function drawBase() {
    // 花盆 / 泥土（柔和 + 渐变 + 多层小草）
    if (plantHidden()) return;
    const x = state.baseX - state.cameraX;
    const y = state.baseY - state.cameraY;
    const t = performance.now() / 1000;
    ctx.save();

    // 1. 软光晕（让"根"自然融入地面）
    const glow = ctx.createRadialGradient(x, y - 4, 0, x, y - 4, 36);
    glow.addColorStop(0, 'rgba(120, 90, 60, 0.35)');
    glow.addColorStop(1, 'rgba(120, 90, 60, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(x, y - 4, 36, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. 土堆（径向渐变 — 中心深、边缘浅，更有体积感）
    const soil = ctx.createRadialGradient(x - 6, y - 3, 1, x, y, 34);
    soil.addColorStop(0, '#7a4a2a');
    soil.addColorStop(1, '#4d2a14');
    ctx.fillStyle = soil;
    ctx.beginPath();
    ctx.ellipse(x, y, 32, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. 土堆高光
    ctx.fillStyle = 'rgba(180, 130, 80, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x - 8, y - 3, 16, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 4. 几丛小草（每丛 3 根 + 摇摆）
    ctx.strokeStyle = '#3aa260';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    for (let i = -3; i <= 3; i++) {
      const cx = x + i * 7;
      for (let j = 0; j < 3; j++) {
        const sway = Math.sin(t * (1 + j * 0.3) + i + j) * 1.5;
        ctx.beginPath();
        ctx.moveTo(cx + j - 1, y);
        ctx.quadraticCurveTo(cx + j - 1 + sway, y - 6, cx + j - 1 + sway * 1.5, y - 12);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

