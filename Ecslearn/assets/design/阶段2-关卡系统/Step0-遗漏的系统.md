# Step 0 - 遗漏的系统

> 前置：[03-地图与关卡系统](./03-地图与关卡系统.md)
> 后续：[04-敌人死亡与金币系统](./04-敌人死亡与金币系统.md)（本文档 §1、§2 的完整落地版）
>
> 这是**实现 Step 1 之前的必做作业**。03 文档聚焦关卡结构，但落地时会发现**一批基础设施还没到位**，本文档把这些窟窿一次性列齐、补全。

## 为什么有这份文档

Linus 说："**Bad programmers worry about the code. Good programmers worry about data structures.**"
同样道理——**好的文档在开工前列清前置条件，坏的文档一边实现一边发现漏洞**。

03 文档里预设了"有事件总线"、"敌人能按 id 生成"、"摄像机能限制在地图内"……这些都是默认存在但实际没写的。**本文档就负责把这些"默认存在"变成"真的存在"**。

## 遗漏清单总览

| # | 遗漏项 | 严重性 | 影响范围 |
|---|-------|--------|---------|
| 1 | 敌人 `goldDrop` 字段 | 🔴 阻塞 | 金币系统跑不通 |
| 2 | 死亡事件总线化 | 🔴 阻塞 | 金币/统计/UI/音效全挤不进来 |
| 3 | 事件命名规范 | 🟠 重要 | 散落的字符串会变垃圾山 |
| 4 | `CameraController.setBounds` | 🔴 阻塞 | Step 1 必备 |
| 5 | `RunSession` 全局实例与生命周期 | 🔴 阻塞 | 所有系统都要读它 |
| 6 | 暂停机制 | 🔴 阻塞 | 升级/商店/转场无法冻结世界 |
| 7 | `enemyId` 注册与多敌人配置 | 🔴 阻塞 | 现在只有 Warrior 一个配置 |
| 8 | `EnemyFactory.create(id, pos, parent)` | 🔴 阻塞 | Spawner 要调用它 |
| 9 | 敌人出现预警（Spawn Warning） | 🟠 重要 | 幸存者类手感核心 |
| 10 | HUD 最小集 | 🟠 重要 | 没它无法 playtest |

**🔴 阻塞 = Step 1 之前必须完成**
**🟠 重要 = Step 3-5 之前完成即可**

---

## 1. 敌人 `goldDrop` 字段

### 现状

```34:35:assets/script/game/enemy/config/enemyConfig.ts
    /** 击杀奖励经验值 */
    xpReward: number;
```

只有经验，**没有金币**。

### 改造方案

#### 1.1 `EnemyConfigData` 增加字段

```typescript
export interface EnemyConfigData {
    // ... 现有字段
    xpReward: number;
    goldDrop: number;        // ← 新增：基础金币掉落（进入 GoldModifier 链前的 baseAmount）
}
```

#### 1.2 默认值

所有现有敌人配置补一行：
```typescript
export const enemyConfig: EnemyConfigData = {
    // ...
    xpReward: 10,
    goldDrop: 2,   // 新增
};
```

### 与 GoldSystem 的关系

- `goldDrop` 只是 **baseAmount**，不是最终获得金币
- 真正到手金币 = `goldDrop × 所有 Modifier`（连杀、精巧杀戮、贪婪升级等）
- 本字段由**敌人配置表**维护，**本文档只加字段，不负责每种敌人的具体数值**（交给敌人系统文档和策划）

👉 **完整金币系统见 [04-敌人死亡与金币系统](./04-敌人死亡与金币系统.md) §9（敌人数值建议）和 §3-§4（GoldSystem / Modifier 链）**

---

## 2. 死亡事件总线化（**最重要的一条**）

### 现状（反例）

```25:28:assets/script/game/enemy/minion/states/MinionDeadState.ts
        if (!ctx.xpGranted) {
            ctx.xpGranted = true;
            PlayerControl.instance?.grantXp(ctx.cfg.xpReward);
        }
```

敌人死亡时**直接硬调** `PlayerControl.grantXp`。

### 为什么必须改

死亡这**一个行为**，要引发：

1. 玩家加经验
2. 玩家加金币（通过 GoldSystem）
3. `RunSession.totalKills++`
4. `RunSession.enemiesAlive--`
5. `RunSession.comboKills++`
6. `RunSession.timeSinceLastKill = 0`
7. 场上屏幕飘数字（Damage/Gold Popup）
8. 击杀音效、粒子
9. UI 连杀显示更新
10. 成就 / 任务系统判定
11. WaveDirector 判定是否可以进入 Clearing 结束
12. 某些升级的 onKill 触发（处刑、吸血等已在 upgrades.xlsx 出现）

**硬调 `grantXp` 的写法**：每加一件事就要改 `MinionDeadState`。12 件事 → 改 12 次 → 🔴 垃圾。

**事件总线写法**：死亡只发一个事件，其他系统各自监听。加新事件只加一个监听器，**死亡代码零改动**。🟢 好品味。

### 改造方案

#### 2.1 定义标准死亡事件

```typescript
// 建议位置：assets/script/game/events/GameEvents.ts （新文件）

export interface EnemyDeathEvent {
    enemyId: string;              // 对接 enemyConfig 的 id
    xpReward: number;
    goldDrop: number;             // 进 GoldModifier 链前的 baseAmount
    worldPos: Readonly<Vec3>;     // 死亡时的世界坐标（给金币跳字 / 掉落物用）
    killerId?: string;            // 谁杀的（预留给"击杀归属"逻辑，首版用 'player'）
}
```

#### 2.2 `MinionDeadState.enter` 改写

```typescript
enter(ctx: IMinionCtx): void {
    // ... 原有动画 / dissolve 代码不变

    if (!ctx.xpGranted) {
        ctx.xpGranted = true;
        EventBus.emit(GameEvt.EnemyDeath, {
            enemyId: ctx.cfg.id,
            xpReward: ctx.cfg.xpReward,
            goldDrop: ctx.cfg.goldDrop,
            worldPos: ctx.node.worldPosition,
        });
    }
}
```

#### 2.3 监听者各自注册

```typescript
// PlayerExperience 监听（原 grantXp 的职责）
EventBus.on(GameEvt.EnemyDeath, (e) => {
    PlayerControl.instance?.grantXp(e.xpReward);
});

// GoldSystem 监听（新）
EventBus.on(GameEvt.EnemyDeath, (e) => {
    GoldSystem.inst.gainGold({
        source: GoldSource.Kill,
        baseAmount: e.goldDrop,
        enemyId: e.enemyId,
        session: RunSession.current,
    });
});

// RunSession 监听（新）
EventBus.on(GameEvt.EnemyDeath, (e) => {
    const s = RunSession.current;
    s.totalKills++;
    s.enemiesAlive--;
    s.comboKills++;
    s.timeSinceLastKill = 0;
});

// WaveDirector 监听（新，用于 Clearing 判定）
// 不需要单独监听，读 session.enemiesAlive 即可
```

### Linus 评价

🟢 **这是整个重构的核心**。把"硬调方法"改为"广播事件"，是 Cocos 项目常见的**架构升级时刻**。做完之后所有后续系统（金币、成就、统计、UI、音效）都能**零侵入挂载**。

👉 **事件 Payload 最终签名、具体监听器实现见 [04-敌人死亡与金币系统](./04-敌人死亡与金币系统.md) §2**

---

## 3. 事件命名规范

### 现状

`EventBus.on('enemy:death', ...)` 用**魔法字符串**。拼错一个字符就永远不触发。

### 规范

#### 3.1 集中定义事件名

```typescript
// assets/script/game/events/GameEvents.ts

export const GameEvt = {
    // ─── 敌人 ────────────────────────────
    EnemyDeath:      'enemy:death',
    EnemySpawn:      'enemy:spawn',
    EnemyHit:        'enemy:hit',

    // ─── 玩家 ────────────────────────────
    PlayerHurt:      'player:hurt',
    PlayerDeath:     'player:death',
    PlayerLevelUp:   'player:level_up',

    // ─── 金币 ────────────────────────────
    GoldGained:      'gold:gained',
    GoldSpent:       'gold:spent',

    // ─── 关卡 ────────────────────────────
    WaveStart:       'wave:start',
    WaveSpawnEnd:    'wave:spawn_end',   // 刷怪窗口结束，进 Clearing
    WaveEnd:         'wave:end',
    MapLoad:         'map:load',
    MapUnload:       'map:unload',

    // ─── 会话/阶段 ───────────────────────
    PhaseChange:     'session:phase_change',
    RunStart:        'run:start',
    RunOver:         'run:over',

    // ─── UI ─────────────────────────────
    UpgradeOffer:    'upgrade:offer',    // 弹三选一
    UpgradeChosen:   'upgrade:chosen',
    ShopOpen:        'shop:open',
    ShopClose:       'shop:close',
    WarpGateEnter:   'warp:enter',
} as const;
```

#### 3.2 所有 `EventBus.on/emit` 一律使用 `GameEvt.xxx`

**禁止**写 `EventBus.emit('enemy:death', ...)`。
**允许**写 `EventBus.emit(GameEvt.EnemyDeath, ...)`。

#### 3.3 事件 Payload 类型（建议）

每个事件对应一个 `interface XxxEvent`，emit/on 时用这个类型，**消灭 `any`**：

```typescript
export interface EnemyDeathEvent { /* 见 §2.1 */ }
export interface GoldGainedEvent {
    final: number;
    source: GoldSource;
    worldPos?: Readonly<Vec3>;
}
// ...
```

后续可包装 typed EventBus：
```typescript
export function emitTyped<T>(evt: string, payload: T): void {
    EventBus.emit(evt, payload);
}
```

但**首版不必急着包装**，统一命名已经解决 80% 问题。

### Linus 评价

🟡 **必做但不紧急**。字符串写得乱不会直接崩，但项目长大后会变成**找不到出处的地雷**。现在规范一次，后面省一年调试时间。

---

## 4. `CameraController.setBounds`

### 现状

```5:37:assets/script/game/core/CameraController.ts
export class CameraController {
    ...
    setFollowTarget(target: Node | null, smooth = 5): void {
        ...
    }
}
```

有 `setFollowTarget`，但**没有 `setBounds`**。03 文档 §3.3 假设了它存在。

### 改造方案

#### 4.1 新增接口

```typescript
interface CameraBounds {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
}

export class CameraController {
    private _bounds: CameraBounds | null = null;
    private _halfViewSize: Vec2 = new Vec2();  // 视口半尺寸（用于 clamp）

    setBounds(bounds: CameraBounds | null): void {
        this._bounds = bounds;
        this._updateHalfViewSize();
    }

    clearBounds(): void {
        this._bounds = null;
    }

    private _updateHalfViewSize(): void {
        const cam = this.camera;
        if (!cam) return;
        const h = cam.orthoHeight;
        const w = h * cam.cameraSize.width / cam.cameraSize.height;  // 宽高比
        this._halfViewSize.set(w, h);
    }
}
```

#### 4.2 在 `_tickFollow` 末尾 clamp

```typescript
private _tickFollow(cam: Camera, dt: number): void {
    // ... 原有插值代码
    // clamp 到边界
    if (this._bounds) {
        const b = this._bounds;
        const hv = this._halfViewSize;
        _tmpV3.x = Math.max(b.xMin + hv.x, Math.min(b.xMax - hv.x, _tmpV3.x));
        _tmpV3.y = Math.max(b.yMin + hv.y, Math.min(b.yMax - hv.y, _tmpV3.y));
    }
    cam.node.setWorldPosition(_tmpV3);
}
```

#### 4.3 地图大小 < 视口大小的 edge case

如果某张地图小于视口（极端情况），clamp 会反向（`xMin+hv.x > xMax-hv.x`）。
**处理**：此时摄像机直接居中于地图中心，不跟随玩家。

```typescript
if (b.xMax - b.xMin < 2 * hv.x) _tmpV3.x = (b.xMin + b.xMax) * 0.5;
if (b.yMax - b.yMin < 2 * hv.y) _tmpV3.y = (b.yMin + b.yMax) * 0.5;
```

**Linus 品味点**：不特判"小地图"，数据（bounds）自然导出结果。

---

## 5. `RunSession` 全局实例与生命周期

### 现状

03 文档 §2.1 定义了 `RunSession` 接口，但**没说它是单例还是多实例、谁创建、何时重置**。

### 规范

#### 5.1 单例 + 生命周期方法

```typescript
// assets/script/game/session/RunSession.ts （新文件）

export class RunSessionState {
    static current: RunSessionState = new RunSessionState();

    // ─── 所有字段，见 03 文档 §2.1 ───
    mapIndex = 0;
    waveIndex = 0;
    // ...

    /** 新一局开始：重置到初始值 */
    static startNewRun(): void {
        RunSessionState.current = new RunSessionState();
        EventBus.emit(GameEvt.RunStart, {});
    }

    /** 一局结束：保留引用但标记 phase=GameOver/Victory */
    endRun(victory: boolean): void {
        this.phase = victory ? RunPhase.Victory : RunPhase.GameOver;
        EventBus.emit(GameEvt.RunOver, { victory, session: this });
    }

    /** 每帧 tick（由 RunOrchestrator 调用）*/
    tick(dt: number): void {
        if (this.phase !== RunPhase.Spawning && this.phase !== RunPhase.Clearing) return;
        this.elapsedTotal += dt;
        this.elapsedInWave += dt;
        this.timeSinceLastKill += dt;
        if (this.timeSinceLastKill >= 5) this.comboKills = 0;
    }
}
```

#### 5.2 访问规范

- 读取：`RunSessionState.current.xxx`（只读方式访问）
- 修改：原则上**通过事件**驱动（§2 的监听器模式），不允许散点直接写字段
- **例外**：`RunSession.tick(dt)` 内部自己管理时间类字段

#### 5.3 "死亡清零" 的执行位置

```typescript
// 玩家死亡事件监听
EventBus.on(GameEvt.PlayerDeath, () => {
    RunSessionState.current.endRun(false);
    // 金币清零（本局归零，Meta 进度另存，由 Meta 文档处理）
});

// UI 点击"再来一局"
function onRestart() {
    RunSessionState.startNewRun();
    // 加载 map 1, wave 1
}
```

### Linus 评价

🟢 **数据结构先行**。把"局"这个概念实例化为一个类，所有系统都只需要 `RunSessionState.current`，不需要层层传参。干净。

---

## 6. 暂停机制

### 现状

- `cc.game.pause()` 会暂停整个引擎（物理、动画、UI、输入都停）—— **太粗暴，UI 也动不了**
- `GameLoop.update` 无条件跑 system —— **不能选择性跳过**

升级/商店/转场期间需要：
- ❌ 不 tick 敌人 AI
- ❌ 不 tick 敌人刷新
- ❌ 不 tick 玩家移动/攻击
- ❌ 不 tick 计时器 / 波次
- ✅ UI 动画、tween、粒子继续
- ✅ 输入读取继续（鼠标移动）

### 改造方案

#### 6.1 用 `RunPhase` 驱动，不用 `cc.game.pause()`

```typescript
// GameLoop.update
update(dt: number) {
    if (!this._ready) return;

    // 输入管线永远跑
    this._systems.rawInput.update(entities);
    this._systems.actionMap.update(entities);

    // 其他系统按 phase 决定
    const phase = RunSessionState.current.phase;
    const isActive = phase === RunPhase.Spawning || phase === RunPhase.Clearing;

    if (isActive) {
        this._systems.playerControl.update(entities);
        this._systems.moveSync.update(entities, dt);
        RunOrchestrator.inst?.tick(dt);  // WaveDirector / EnemySpawner / ...
    }
}
```

#### 6.2 敌人/玩家 的 tick 自检

`EnemyBase.update` 和 `PlayerControl.lateUpdate` 里也加一道防线：
```typescript
if (RunSessionState.current.phase !== RunPhase.Spawning &&
    RunSessionState.current.phase !== RunPhase.Clearing) return;
```

**好品味点**：`isActive` 判定**只有一个地方**（GameLoop），各个子系统默认被冻结。不需要每个系统自己维护 `_paused` 布尔。

#### 6.3 动画/tween 怎么办？

Cocos 的 `tween(node).start()` **不受 `GameLoop.update` 控制**，它跟着 director 跑。

- 如果要冻结敌人攻击前摇的 tween → 敌人暂停时调用 `tween.stop()` 或 `tween.pause()`
- 如果允许 UI 继续动 → 默认行为就是对的（UI 的 tween 继续，敌人的 tween 也继续跑完，但 hit 判定不生效，因为 hit 在 system 里）

**首版决策**：**动画/tween 不做主动暂停**，只停 system。视觉上敌人可能会把当前动作播完，但不会造成新的战斗行为（因为 AI 不 tick、攻击判定不 tick）。

这是一个**可接受的视觉小瑕疵**，不值得为它做一整套 tween 暂停系统。

### Linus 评价

🟢 **用数据（phase）代替状态（paused flag）**。冻结条件集中在一个地方，不是散落一地 if。

---

## 7. `enemyId` 注册与多敌人配置

### 现状

```38:59:assets/script/game/enemy/config/enemyConfig.ts
export const enemyConfig: EnemyConfigData = {
    frameSize: 192,
    // ...
    xpReward: 10,
};
```

只有**一个** `enemyConfig`（Warrior），没有 id。03 文档的 spawner 引用了 `pawn / ranger / warrior / bomber / boss_dark_knight` 这些 id，**全部不存在**。

已有的敌人 behavior：
- `assets/script/game/enemy/minion/warrior/WarriorBehavior.ts`
- `assets/script/game/enemy/minion/ranger/RangerBehavior.ts`
- `assets/script/game/enemy/minion/bomber/BomberBehavior.ts`

有行为但没有**按 id 查询的配置表**。

### 改造方案

#### 7.1 配置表化

```typescript
// assets/script/game/enemy/config/enemyConfig.ts 改造

export interface EnemyConfigData {
    id: string;               // ← 新增
    kind: 'minion' | 'elite' | 'boss';   // ← 新增：影响掉落倍率 / UI 标记
    behaviorId: string;       // ← 新增：对接 WarriorBehavior 等的 typeId
    // ... 其他现有字段
    goldDrop: number;
}

const CONFIGS: Record<string, EnemyConfigData> = {
    pawn: {
        id: 'pawn',
        kind: 'minion',
        behaviorId: 'warrior',  // 或者加个 pawn behavior
        // ... 数值，偏弱
    },
    warrior: {
        id: 'warrior',
        kind: 'minion',
        behaviorId: 'warrior',
        // ... 标准数值
    },
    ranger: {
        id: 'ranger',
        kind: 'minion',
        behaviorId: 'ranger',
        // ...
    },
    // ...
};

export function getEnemyConfig(id: string): EnemyConfigData | null {
    return CONFIGS[id] ?? null;
}
```

#### 7.2 配置来源

**首版代码写死**（TypeScript 字面量），够用。
**后续**可以改 JSON / Excel → TypeScript 生成器（和 `upgrades.xlsx` 同样方式）。

#### 7.3 波次表引用的 id 必须在此注册

建立约定：`WaveDef.spawners[].enemyId` 必须能通过 `getEnemyConfig(id)` 查到，否则 WaveDirector 启动时报错并跳过。

---

## 8. `EnemyFactory.create(id, pos, parent)`

### 现状

敌人的实例化分散在不同地方（看了下 `minion/MinionControl.ts` 等），**没有统一的 factory**。

### 改造方案

#### 8.1 统一工厂

```typescript
// assets/script/game/enemy/EnemyFactory.ts （新文件）

export class EnemyFactory {
    /** 在 worldPos 创建一只敌人，挂到 parent 下 */
    static create(enemyId: string, worldPos: Vec2 | Vec3, parent: Node): Node | null {
        const cfg = getEnemyConfig(enemyId);
        if (!cfg) {
            console.warn(`[EnemyFactory] unknown enemyId: ${enemyId}`);
            return null;
        }

        // 1. 从池取节点（或 new Node）
        const node = EnemyPool.acquire(cfg.kind);

        // 2. 挂 EnemyBase + behavior
        const base = node.getComponent(EnemyBase) ?? node.addComponent(EnemyBase);
        base.applyConfig(cfg);
        base.setBehavior(cfg.behaviorId);

        // 3. 应用波次缩放
        const scaling = getWaveScaling(RunSessionState.current.waveIndex);
        base.applyScaling(scaling);

        // 4. 放到 parent 下 + 设置位置
        parent.addChild(node);
        node.setWorldPosition(worldPos.x, worldPos.y, 0);

        // 5. 广播 spawn 事件
        EventBus.emit(GameEvt.EnemySpawn, {
            enemyId: cfg.id,
            worldPos: node.worldPosition,
        });

        return node;
    }

    /** 敌人死亡后回池 */
    static recycle(node: Node): void {
        EnemyPool.release(node);
    }
}
```

#### 8.2 与现有 `EnemyBase / MinionControl` 的关系

**Linus 警告**：不要把现有的 `MinionControl` 拆得稀碎。`EnemyFactory` 只负责"组装"，真正的实体类（`EnemyBase`）保持完整。

具体来说：`EnemyBase.applyConfig(cfg)` 这个方法可能还要加（现在可能没有）。这属于对现有敌人系统的**微改造**，是本 Step 的子任务。

---

## 9. 敌人出现预警（Spawn Warning）

### 现状

03 文档 §5 的 EnemySpawner **立即生成敌人**。没有警告标记，玩家会被"天降敌人"打个措手不及。

### 为什么必须做

1. **公平感**：Edge 模式怪从屏幕外生成，无警告 = 背后突袭 = 玩家怒
2. **张力感**：屏幕四周亮起红点 = 幸存者核心视觉语言
3. **节奏感**：给玩家 0.5-1s 反应时间走位

### 设计方案

#### 9.1 数据结构：`SpawnerRule` 新增 `warnTime`

```typescript
export interface SpawnerRule {
    // ... 现有字段
    warnTime: number;   // 预警提前时间（秒），默认 0.8；设为 0 即立即生成
}
```

#### 9.2 两种警告样式（按 pattern 选）

| Pattern | 警告样式 | 实现 |
|---------|---------|------|
| `Edge` | **屏幕边缘红色图标**（UI 层）| 贴在摄像机内侧边缘，指向即将出怪的方向 |
| `Ring` | **世界坐标红圈**（世界层）| 玩家周围一圈闪烁标记 |
| `Cluster` | **世界坐标红光**（世界层）| 远处区域一片红光预告 |
| `Fixed (Boss)` | **大型仪式 + 世界红光 + 震屏** | 配合 BGM、摄像机推近 |

#### 9.3 `SpawnWarningManager`

```typescript
// assets/script/game/map/SpawnWarningManager.ts

interface PendingSpawn {
    rule: SpawnerRule;
    worldPos: Vec2;      // 预定生成位置（已经由 pattern 算好）
    warningNode: Node;   // 警告的可视节点
    eta: number;         // 剩余秒数
}

export class SpawnWarningManager {
    private _pending: PendingSpawn[] = [];

    /** WaveDirector 调用：调度一次生成 */
    schedule(rule: SpawnerRule, worldPos: Vec2): void {
        if (rule.warnTime <= 0) {
            // 无预警，立即生成
            EnemyFactory.create(rule.enemyId, worldPos, MapManager.inst.enemyRoot);
            return;
        }

        const warningNode = this._createWarning(rule.pattern, worldPos);
        this._pending.push({ rule, worldPos, warningNode, eta: rule.warnTime });
    }

    tick(dt: number): void {
        for (let i = this._pending.length - 1; i >= 0; i--) {
            const p = this._pending[i];
            p.eta -= dt;
            if (p.eta <= 0) {
                EnemyFactory.create(p.rule.enemyId, p.worldPos, MapManager.inst.enemyRoot);
                p.warningNode.destroy();
                this._pending.splice(i, 1);
            }
        }
    }

    /** 地图切换时清理所有未完成的预警 */
    clearAll(): void { /* ... */ }

    private _createWarning(pattern: SpawnPattern, worldPos: Vec2): Node {
        switch (pattern) {
            case SpawnPattern.Edge:    return this._createEdgeWarning(worldPos);
            case SpawnPattern.Ring:    return this._createWorldWarning(worldPos);
            case SpawnPattern.Cluster: return this._createClusterWarning(worldPos);
            case SpawnPattern.Fixed:   return this._createBossWarning(worldPos);
        }
    }
}
```

#### 9.4 WaveDirector 改造（替换"立即生成"）

```typescript
// 原来：
//   spawner.spawn(rule)  →  EnemyFactory.create(...)
// 改为：
//   SpawnWarningManager.inst.schedule(rule, worldPos);
```

**好品味点**：
- `warnTime = 0` 退化为立即生成，**无特殊分支**
- Pattern → 警告样式是一个 switch（4 个 case），数据驱动
- 警告完成的**唯一出路**是调用 `EnemyFactory.create`，没有第二条路径

### 建议的 `warnTime` 曲线（占位）

| 波次 | warnTime | 理由 |
|------|---------|------|
| Wave 1-3（入门）| 1.2s | 给新手足够反应时间 |
| Wave 4-8（成长）| 0.8s | 标准 |
| Wave 9-14（压迫）| 0.5s | 压迫感拉满 |
| Boss | 2.0s | 仪式感 |

---

## 10. HUD 最小集

### 现状

没 HUD。玩家看不到：
- 当前 HP（`PlayerControl` 有 `_hpLabel`，但只显示数字，无血条 UI）
- 当前金币
- 当前波次 / 倒计时
- 当前连杀数
- 当前经验 / 等级

**没有 HUD 就没法 playtest**，连测试都做不了。

### 最小集清单

本文档只负责**列出要显示什么**，具体 UI 实现交给 06 文档。

#### 左上角
- HP 条（当前/上限）
- XP 条（当前等级 / 升级进度）

#### 右上角
- 💰 金币数字（`session.gold`）

#### 顶部居中
- `Wave 3 / 15` + 剩余刷怪时间倒计时
- 波次阶段标签（Spawning / Clearing）

#### 右下角（可选，后期加）
- 连杀数（`session.comboKills >= 3` 才显示）
- 精巧杀戮 "Ready!" 提示（`timeSinceLastKill >= 5` 时闪烁）

### 与现有的对接

- `session.phase` / `session.waveIndex` / `session.gold` / `session.comboKills` 全部就绪（§5）
- HUD 只需监听 EventBus 事件（§3）+ 每帧读 session 数据
- 不需要单独的"数据推送"系统

---

## 完成判定

本 Step 完成的标志：

- [ ] 敌人配置表支持 `id` 查询，至少有 `pawn / warrior / ranger / bomber` 4 种
- [ ] `EnemyConfigData` 新增 `goldDrop` 字段，所有敌人配置填充默认值
- [ ] `GameEvents.ts` 建立，所有事件名集中定义
- [ ] `MinionDeadState` 改为事件广播，不再硬调 `grantXp`
- [ ] `PlayerExperience / GoldSystem / RunSession` 三个监听器挂好
- [ ] `CameraController.setBounds / clearBounds` 实现
- [ ] `RunSessionState` 单例可用，`startNewRun / endRun / tick` 完备
- [ ] `GameLoop.update` 按 `phase` 跳过战斗 system
- [ ] `EnemyFactory.create` 统一入口可用
- [ ] `SpawnWarningManager` 实现 + Edge 模式的警告图标
- [ ] HUD 最小集显示：HP / 金币 / 波次 / 倒计时

### 顺序建议

**严格按以下顺序做，每一步都可独立验证：**

1. §3 事件命名规范（立一个 `GameEvents.ts` 空文件）
2. §5 RunSessionState 单例（先建类，字段填 0）
3. §1 + §7 敌人配置加字段 + id 化（4 种基础敌人）
4. §2 死亡事件总线化（监听器先放空壳也没关系，只要广播能通）
5. §8 EnemyFactory（能创建任一 id 的敌人）
6. §4 CameraController.setBounds（做 Step 1 就需要）
7. §6 暂停机制（做 Step 4 升级弹窗时需要）
8. §9 SpawnWarningManager（做 Step 2 WaveDirector 时需要）
9. §10 HUD（做 Step 4 前必须，否则玩家看不到状态）

---

## 关键设计决策表

| 决策 | 选择 | 理由 |
|------|------|------|
| 敌人死亡通知方式 | **事件总线广播** | 解耦 11+ 个监听方，零侵入扩展 |
| 事件名管理 | **集中常量 `GameEvt`** | 消灭魔法字符串，拼写错误 IDE 报错 |
| 暂停机制 | **`RunPhase` 驱动，不用 `cc.game.pause`** | UI 继续跑，只冻结战斗逻辑 |
| RunSession 访问 | **`RunSessionState.current` 单例 + 事件修改** | 避免层层传参 + 避免散点写字段 |
| 敌人生成时机 | **预警调度，不立即生成** | 公平性 + 幸存者手感核心 |
| 小地图 edge case | **数据兜底（直接居中）** | 不特判，用 bounds 导出结果 |
| tween 暂停 | **不做** | 视觉小瑕疵可接受，不值得做 |
| 敌人配置来源 | **首版 TS 字面量** | 够用，后续再转 JSON/Excel |

---

> 完成本 Step 后，回到 [03-地图与关卡系统](./03-地图与关卡系统.md) 的 Step 1 开始正式实现关卡。
>
> §1 `goldDrop` / §2 死亡事件总线化的**完整实现细节**见 [04-敌人死亡与金币系统](./04-敌人死亡与金币系统.md)。
>
> 返回 [项目总览](../项目概述/00-项目总览.md)
