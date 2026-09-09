  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // === 右侧地面参照物：黄鹤楼 ===
  const towerImg = new Image();
  towerImg.src = 'photo/' + encodeURIComponent('黄鹤楼.png');
  if (towerImg.decode) towerImg.decode().catch(() => {}); // 预解码，避免首次上屏卡顿

  // === 背景音乐 ===
  const bgm = new Audio('music/' + encodeURIComponent('抽象小火车.mp3'));
  bgm.loop = true;
  bgm.volume = 0.5;
  bgm.preload = 'auto';
  bgm.load(); // 预加载，避免首次开播卡顿
  const bgmBtn = document.getElementById('bgm-btn');
  let bgmPlaying = false;
  function setBgmButtons() {
    bgmBtn.textContent = bgmPlaying ? '🎵' : '🔇';
    const sb = document.getElementById('set-bgm');
    if (sb) sb.textContent = bgmPlaying ? '开' : '关';
  }
  function toggleBgm() {
    if (bgmPlaying) {
      bgm.pause();
      bgmPlaying = false;
    } else {
      bgm.play().catch(() => {});
      bgmPlaying = true;
    }
    setBgmButtons();
  }
  bgmBtn.addEventListener('click', toggleBgm);
  // 首次用户交互自动开音乐（满足浏览器自动播放限制）
  const startBgmOnce = () => {
    if (!bgmPlaying) toggleBgm();
    document.removeEventListener('pointerdown', startBgmOnce);
  };
  document.addEventListener('pointerdown', startBgmOnce);

  // 左/右教学面板视频：循环播放（静音自动播放通常放行，兜底：首次交互后再确保播放）
  const phaseVideos = [document.getElementById('phase-video'), document.getElementById('phase-video-r')]
    .filter(Boolean);
  for (const v of phaseVideos) v.muted = true;
  const ensurePhaseVideo = () => {
    for (const v of phaseVideos) {
      const p = v.play();
      if (p) p.catch(() => {});
    }
  };
  ensurePhaseVideo();
  document.addEventListener('pointerdown', ensurePhaseVideo, { once: true });

  // === 右上角设置 ===
  const settingsBtn = document.getElementById('settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // 与成就面板互斥：打开设置时收起成就
    const achPanel = document.getElementById('ach-panel');
    if (achPanel && achPanel.style.display === 'block') achPanel.style.display = 'none';
    settingsPanel.classList.toggle('open');
  });
  // 点击面板外部关闭
  document.addEventListener('pointerdown', (e) => {
    if (settingsPanel.classList.contains('open') &&
        !settingsPanel.contains(e.target) && e.target !== settingsBtn) {
      settingsPanel.classList.remove('open');
    }
  });

  const setPause = document.getElementById('set-pause');
  const pauseMsg = document.getElementById('pause-msg');
  function refreshPause() {
    setPause.textContent = state.paused ? '继续' : '暂停';
    pauseMsg.style.display = state.paused ? 'block' : 'none';
  }
  setPause.addEventListener('click', () => {
    state.paused = !state.paused;
    refreshPause();
  });

  // === 开局弹窗：您即将乘坐黄鹤楼电梯 ===
  // 点击"开始上升"前游戏处于"未开始"状态（started=false，主循环不推进任何逻辑）
  const introModal = document.getElementById('intro-modal');
  function beginGame(nightmare) {
    state.nightmare = !!nightmare;   // 噩梦模式开关
    introModal.style.display = 'none';
    resetGame();                     // 打散冲掉旧局，重新开始
    state.started = true;            // 正式开局
    state.paused = false;
    refreshPause();
    updateSlotPullButton();          // 刷新老虎机拉杆按钮为可用状态
  }
  document.getElementById('intro-start').addEventListener('click', () => beginGame(state.nightmare));

  const setBgm = document.getElementById('set-bgm');
  setBgm.addEventListener('click', toggleBgm);

  const setVol = document.getElementById('set-vol');
  setVol.addEventListener('input', () => {
    bgm.volume = setVol.value / 100;
  });

  document.getElementById('set-restart').addEventListener('click', () => {
    if (state.paused) { state.paused = false; }
    resetGame();
    refreshPause();
  });
  // 噩梦模式开关：点击切换（噩梦↔正常），每次切换后整局重开使难度生效
  const nightmareBtn = document.getElementById('nightmare-btn');
  function refreshNightmareBtn() {
    nightmareBtn.classList.toggle('on', !!state.nightmare);
    nightmareBtn.textContent = state.nightmare ? '🔥 噩梦中' : '🔥 噩梦';
  }
  nightmareBtn.addEventListener('click', () => {
    state.nightmare = !state.nightmare;   // 切换难度
    if (state.paused) { state.paused = false; }
    settingsPanel.classList.remove('open');
    resetGame();                           // 切换后重新开局（难度立即生效）
    refreshPause();
    refreshNightmareBtn();
  });
  // 查看道具效果：点击展开 / 再点击收缩
  const propToggle = document.getElementById('prop-toggle');
  const propPanel = document.getElementById('prop-panel');
  propToggle.addEventListener('click', () => {
    propPanel.classList.toggle('open');
  });

  // === 教学提示面板（屏幕左、右各一块）===
  // 显示窗口：开局后到达 20~80 米（plantHidden 区间）两面板同时出现，超过 80 米自动隐藏；
  // 各自“我知道了”只关闭自己的那块（另一块不受影响），本局内不再自动弹回，重开一局后再次生效。
  const phaseSide = (elId, okId, vidId, flag) => {
    const el = document.getElementById(elId);
    if (!el) return null;
    const ok = document.getElementById(okId);
    if (ok) ok.addEventListener('click', () => {
      state[flag] = true;                       // 该侧本局内不再自动弹出
      el.classList.remove('show');
      const v = document.getElementById(vidId);
      if (v && !v.paused) v.pause();
    });
    return {
      el,
      vid: document.getElementById(vidId),
      flag,
      prevShown: false,                         // 上次是否显示（窗口刚进入时从头播放）
    };
  };
  const phaseSides = [
    phaseSide('phase-tip', 'phase-ok', 'phase-video', 'tipClosedL'),
    phaseSide('phase-tip-r', 'phase-ok-r', 'phase-video-r', 'tipClosedR'),
  ].filter(Boolean);

  function updatePhaseTip() {
    const inWindow = !!(state && state.started && !state.paused && !state.gameOver && plantHidden());
    for (const s of phaseSides) {
      const shouldShow = inWindow && !state[s.flag];
      if (shouldShow && !s.prevShown && s.vid) s.vid.currentTime = 0;  // 进入窗口重头播
      s.el.classList.toggle('show', !!shouldShow);
      if (s.vid) {
        if (shouldShow) { const p = s.vid.play(); if (p) p.catch(() => {}); }
        else if (!s.vid.paused) s.vid.pause();
      }
      s.prevShown = shouldShow;
    }
  }
  document.getElementById('set-quit').addEventListener('click', () => {
    try { window.close(); } catch (e) {}
    // 浏览器通常禁止脚本关闭非脚本打开的标签页，兜底提示
    alert('请直接关闭此浏览器标签页以退出游戏。');
  });

  // === 自适应画布 ===
  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();
