  // === 主循环 ===
  function loop(now) {
    const dt = Math.min(0.05, (now - state.lastT) / 1000);
    state.lastT = now;

    if (state.started && !state.paused && !state.gameOver) {
      updateWeather(dt);   // 天气事件推进
      updateStem(dt);
      updateCamera(dt);
      maybeSpawn(dt);
      checkCollect();
      updateButterflies(dt);
      updateFireflies(dt);
      updateTrail(dt);
      updateBirds(dt);
      updateAirShips(dt);
      updateMeteors(dt);
      // 成就：累计游玩时间并检查解锁
      state.playTime += dt;
      // 老虎机免费转：按米数/时间积累
      accrueFreeSpins(dt);
      // 连击清零检测
      if (state.comboTimer > 0) {
        state.comboTimer -= dt;
        if (state.comboTimer <= 0) state.combo = 0;
      }
      // 成就埋点：命悬一线（花瓣剩 1 片并存活计时）
      if (state.petals === 1) state.criticalHold += dt;
      else state.criticalHold = 0;
      // 成就埋点：雷暴累计停留
      if (state.weather.kind === 'storm') state.stormTime += dt;
      // 成就埋点：大风天再长高
      if (state.weather.kind === 'wind') {
        if (state.maxHeight > state.lastWindH) state.windGrowHeight += state.maxHeight - state.lastWindH;
      }
      state.lastWindH = state.maxHeight;
      checkAchievements();
      // 撞到左右边界墙掉花瓣
      wallCheck();
      // 受击无敌倒计时
      if (state.hitCooldown > 0) state.hitCooldown -= dt;
    }

    // 渲染
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = skyGradient();
    ctx.fillRect(0, 0, W, H);

    // 老虎机中奖闪光（覆盖整个画布的彩色高光）
    if (state.slotFlash > 0) {
      const a = state.slotFlash * 0.35;
      const last = state.slot.results[0];
      const flashColor = last === '←' ? '120, 180, 255' :
                         last === '→' ? '255, 120, 160' :
                         last === '🌿' ? '120, 230, 150' :
                         '255, 160, 200'; // 🌸 花瓣粉
      ctx.fillStyle = `rgba(${flashColor}, ${a})`;
      ctx.fillRect(0, 0, W, H);
      state.slotFlash = Math.max(0, state.slotFlash - dt * 2.5);
    }

    // 受击红色闪光
    if (state.hitFlash > 0) {
      ctx.fillStyle = `rgba(255, 60, 60, ${state.hitFlash * 0.3})`;
      ctx.fillRect(0, 0, W, H);
      state.hitFlash = Math.max(0, state.hitFlash - dt * 2.5);
    }

    // 进化辉光（整屏渐变，颜色随当前进化）
    if (state.evolveFlash > 0) {
      const evC = curEvolution();
      ctx.fillStyle = `rgba(${evC.ring}, ${state.evolveFlash * 0.4})`;
      ctx.fillRect(0, 0, W, H);
      state.evolveFlash = Math.max(0, state.evolveFlash - dt * 1.8);
    }

    drawWeatherSky(); // 星星/极光/闪电（天空之上）
    drawSun();
    drawSkyFlowClouds(now / 1000); // 远景流动云：随上升相对下移，提供参照
    drawBiomeBackdrop(); // 地形远景剪影（天空与地面之间）
    drawFireflies();
    drawGround();
    drawWalls();
    drawTower(); // 右侧地面黄鹤楼参照物
    drawGrass(now / 1000);
    drawGardenFlowers(now / 1000);
    drawMushrooms();
    drawStones();
    drawTrail();

    drawBase();
    drawStem();
    drawCollectibles();
    drawButterflies();
    drawBirds();
    drawAirShips();
    drawMeteors();
    drawFlowerHead();
    drawParticles(dt);
    drawDriftClouds(); // 近前景云，遮挡视野
    drawRain();     // 前景雨（最前遮挡层）
    drawSnow();     // 下雪天飘雪
    drawWindStreaks(); // 大风风纹

    // 更新 HUD
    const heightVal = Math.max(0, Math.floor(state.maxHeight / 10));
    document.getElementById('hud-height').textContent = heightVal;
    document.getElementById('hud-petals').textContent = state.petals;
    document.getElementById('hud-sun').textContent = state.sun;

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // 防止右键菜单
  canvas.addEventListener('contextmenu', e => e.preventDefault());
