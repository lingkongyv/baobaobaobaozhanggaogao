
  // === 游戏状态 ===
  const state = {
    baseX: 0, baseY: 0,        // 茎的根（屏幕底部）
    headX: 0, headY: 0,        // 花头当前位置
    points: [],                // 茎的路径点（从根到头）
    segments: [],              // 茎段（用于渲染和碰撞）
    growthSpeed: 70,           // 每秒生长像素
    growSpeedActive: 0,        // 当前生效的生长速度（供镜头动态跟随用）
    lastT: performance.now(),
    maxHeight: 0,              // 历史最高
    cameraY: 0,                // 镜头向上偏移（随高度上升）
    cameraX: 0,                // 镜头水平偏移（随花头水平移动）
    dragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    lastMouseX: 0,             // 上一次鼠标屏幕位置（用于计算位移）
    lastMouseY: 0,
    dragSensitivity: 0.5,     // 拖拽灵敏度（<1 鼠标移动得更远，花朵才移动 1 像素）
    dragDistance: 0,          // 本次拖拽累计位移（单点拖拽上限 60px）
    velocityX: 0,
    velocityY: 0,
    velocityDamp: 0.85,        // 速度阻尼（每帧乘以该系数，越小越快停止）
    sun: 0,
    petals: 8,                 // 花瓣数 = 生命值（初始 8，被蒜鸟撞到扣 1 瓣，归零游戏结束）
    petalCap: 16,              // 花瓣上限（进化会 +2）
    evolveIndex: -1,           // 当前进化等级：-1雏菊 / 0凤凰 / 1水晶 / 2莲叶
    evolveFlash: 0,            // 进化瞬间的全屏辉光（0~1）
    biomeIndex: -1,            // 当前地形等级（-1绿野先）
    biomePrev: -1,             // 上一地形（用于渐变过渡）
    biomeAnim: 0,              // 地形过渡进度 0~1
    sunOrbs: [],               // 阳光收集物
    petalOrbs: [],             // 花瓣收集物
    particles: [],             // 飘动粒子
    trail: [],                 // 花头运动轨迹的拖尾
    driftClouds: [],           // 近前景漂荡云（遮挡视野用，屏幕坐标）
    meteorites: [],            // 天上坠落的陨石（可伤害花）
    grassTufts: [],            // 草簇
    gardenFlowers: [],         // 花园小花
    mushrooms: [],             // 蘑菇
    stones: [],                // 石头
    butterflies: [],           // 蝴蝶
    fireflies: [],             // 萤火虫（高度升高时出现）
    pollen: [],                // 花粉
    nextFireflyHeight: 600,    // 距离下一次生成萤火虫的高度
    score: 0,
    paused: false,
    started: false,           // 是否已点"开始上升"正式开局
    nightmare: false,          // 噩梦模式：难度上升（敌人更密更快、生长更快）
    // 老虎机
    slot: {
      spinning: [false, false, false],
      results: ['🌸', '🌸', '🌸'],
      interval: null,
      target: null,            // 本轮中奖目标（null = 未中奖；非空 = 后两轮强制跟随）
    },
    growthPause: 0,            // 生长暂停计时器（秒）— 老虎机"下"效果使用
    slotPushVelX: 0,           // 老虎机"←/→"持续水平速度（px/s）[已弃用]
    slotPushTime: 0,           // 老虎机"←/→"持续速度剩余秒数 [已弃用]
    fertScale: 1,              // 老虎机"🧪"化肥：花朵/根茎放大倍数
    fertCount: 0,              // 化肥档位计数：抽到几次狗奶（0/1/2/3），受击后归零
    slotGrowTime: 0,           // 老虎机"🌿"猛冲向上剩余秒数
    slotGrowVy: 0,             // 老虎机"🌿"猛冲时的向上速度（快升慢减）
    reviveSword: 0,            // 老虎机"⚔️"名刀司命：死亡时触发，保住 2 朵花瓣（0/1）
    slotFlash: 0,              // 老虎机中奖全屏闪光强度（0~1）
    // 老虎机"免费转"：米数/时间自动积累，不用阳光也能抽
    freeSpins: 0,              // 当前可免费抽取的次数（上限 FREE_SPIN_CAP）
    freeSpinMeterAcc: 0,       // 距离（米）积累器：满 FREE_SPIN_METERS 加 1 次
    freeSpinTimeAcc: 0,        // 时间（秒）积累器：满 FREE_SPIN_TIME 加 1 次
    freeIdleTime: 0,           // 有免费次数后的闲置秒数（满 FREE_AUTO_SPIN_TIME 自动抽）
    lastSpinMeter: 0,          // 上一帧高度（米），用于差分累计距离
    // 飞鸟
    birds: [],                 // 飞鸟数组
    airShips: [],              // 空中物体：风筝/无人机/大飞机/宇宙飞船
    airTimer: 0.8,               // 空中物体生成计时
    airDodgedBy: {},             // 各空中物体躲避计数（key=类型，用于成就）
    birdTimer: 7,              // 距离下一只鸟生成的倒计时（秒）
    meteorTimer: 5,            // 距离下一颗陨石坠落的倒计时（秒）
    hitCooldown: 0,            // 受击后无敌时间（秒）
    hitFlash: 0,               // 受击红色闪光强度（0~1）
    rainPetalTimer: 0,         // 下雨天距下一次可能掉花瓣的倒计时（秒）
    // 随机天气系统
    weather: {
      kind: 'sunny',       // 'sunny' | 'rain' | 'starry' | 'aurora' | 'storm'
      timer: 12,           // 距离下一次随机事件的倒计时（晴天时走）
      announce: 0,         // 事件预告剩余秒
      active: 0,           // 事件生效剩余秒
      rain: [],            // 雨滴粒子（雨/雷暴时使用）
      stormFlash: 0,       // 雷暴闪电闪白（0~1）
    },
    gameOver: false,           // 游戏结束标志
    sunCollected: 0,           // 累计收集阳光（成就统计）
    petalCollected: 0,         // 累计收集花瓣（成就统计）
    birdsDodged: 0,            // 累计躲过飞鸟（成就统计）
    meteorsDodged: 0,          // 累计躲过陨石（成就统计）
    slotWins: 0,               // 老虎机中奖次数（成就统计）
    playTime: 0,               // 累计游玩秒数（成就统计）
    // 成就统计：新成就埋点
    freeSpinUsed: 0,           // 累计使用免费转次数
    growBoostHits: 0,          // 累计触发"🌿"猛冲生长次数
    milkCount: 0,              // 累计抽中并落地"🧪"野生狗奶次数（强壮如牛成就）
    slotGot: {},               // 已中奖过的老虎机符号（大满贯）
    swordGot: 0,               // 累计抽中并落地"⚔️"名刀司命次数
    swordUse: 0,               // 累计触发名刀司命护体（挡下一次死亡）次数
    rainLoseCount: 0,          // 雨天损失花瓣次数（仍存活）
    criticalHold: 0,           // 花瓣仅剩 1 片时的存活秒数（归 1 即累计，>1 清零）
    stormTime: 0,              // 雷暴天气累计停留秒数
    windGrowHeight: 0,         // 大风天里累计再长高像素
    lastWindH: 0,              // 上一帧高度（大风天差分用）
    achievements: {},          // 已解锁成就：id -> 解锁时间戳
    weatherSeen: {},           // 见识过的天气（成就统计：rain/starry/aurora/storm）
    combo: 0,                  // 当前连击数（连续收集阳光）
    maxCombo: 0,               // 历史最高连击
    comboTimer: 0,             // 连击保持倒计时（超时清零）
    windPulse: 0,              // 大风风纹相位（仅视觉）
    windDir: 1,              // 当前阵风主导方向（+右 / -左）
    windPow: 2,              // 阵风强度
    windPush: 0,             // 距下一次随机强阵风的倒计时
    cloudUnlocked: false,      // 云层是否已解锁（达高度才显示遮挡云）
    meteorUnlocked: false,     // 陨石是否已解锁（更高处才坠落）
    annElevator: false,        // 20 米语音提示是否已播放
    annWelcome: false,         // 80 米语音提示是否已播放
    ann1600: false,            // 1600 米"闯关弟子注意"语音是否已播放
  };
