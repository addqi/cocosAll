# 05 - 关卡 MVP：波次、清场、升级、胜利

> 目标：用一个场景、一个节点、一个脚本（`LevelManager`），把"一局游戏"的骨架跑通。
>
> 当前约束：
> - 所有数值走配置或独立策略脚本，**零硬编码**
> - 只做 MVP，不做 Step 0 §4/§8/§9 这类优化项
> - 必须每一小步独立验证，每一步完成后游戏都能跑
>
> 前置文档：
> - [Step0-遗漏的系统.md](./Step0-遗漏的系统.md)
> - [04-敌人死亡与金币系统.md](./04-敌人死亡与金币系统.md)
>
> 参考风格：[重构步骤-1-职业与基础架构.md](../阶段1-角色战斗/历史文档/重构步骤-1-职业与基础架构.md)

---

## 一、这一步到底在解决什么问题

当前项目**战斗单元齐备但没有"局"的概念**：

- 玩家能动、能攻击、能升级（`PlayerControl` + `UpgradeManager`）
- 敌人能刷、能死、能掉金币（死亡事件总线已打通）
- 升级池 `upgrades.json` 已就位，86% 的升级改配置就能加

**但没有任何东西告诉这些元素"这一局打几波、什么时候暂停去升级、胜负怎么算"**。

所以这一步只做一件事：

**把"一局游戏"的骨架建出来 —— 波次、清场、暂停、升级、胜利 —— 全部数据驱动。**

---

## 二、阶段目标

完成本大步骤后，项目应该满足：

1. **单场景、单节点、一个 `LevelManager` 脚本**即可跑通完整一局
2. 玩家自动生成在地图中心，摄像机跟随
3. 波次配置来自 `waves.json`：波数、每波时长、每波怪数量/类型/刷怪规则全部可配
4. 清场判定有两条路径：**全灭** 或 **超时**；超时残怪**静默消失**（不掉金币、不给经验）
5. 波间强制暂停，出升级 UI，**3 选 1**
6. 升级 UI 有刷新按钮，次数来自 `LevelRun.upgradeRerollQuota`，**可被升级动态加**
7. 抽卡按 **tier → 权重** 策略（线性曲线首版），已选永久剔除、进化版在前置齐全后自动入池
8. **5 波全过**出 Victory UI + "再来一局"
9. 所有数值（波次数、每波时长、刷新初值、权重公式）**零硬编码**

---

## 三、总实施顺序

本大步骤拆成 **9 个小步骤**：

1. 先建**波次配置 schema 与 loader**（纯数据，不跑逻辑）
2. 再建 **`LevelRun` 本局状态容器**和 `LevelPhase` 枚举
3. 再建 **`WaveDirector`**，只跑刷怪，不管清场
4. 再接**清场判定**（全灭 + 超时 两条路径）
5. 再接**暂停机制**，让"升级期间敌人不跑 AI"
6. 再建 **Tier → 权重策略脚本**（独立小模块，便于后续调曲线）
7. 再建 **`UpgradeOfferSystem`**（抽卡 + 去重 + 进化版解锁）
8. 再建**升级 UI**（3 选 1 + 刷新按钮 + quota 显示）
9. 最后建 **`LevelManager`** 把前面所有东西粘起来，加 **Victory UI**

原则很简单：

**每一步完成后，项目都必须还能跑。**

**Linus 原则**：
- 前 4 步完成 = "能刷怪能清场"的半成品，可先玩
- 前 7 步完成 + 一行 `console.log` 模拟选升级，能跑完 5 波
- UI 是最后的层，早做就是空中楼阁

---

## 四、Step 2.1 - 波次配置 schema 与 loader

### 目标

先把"一局游戏长什么样"这个**数据**定义出来。

### 需要新增的文件

- `assets/script/game/config/waveConfig/types.ts`
- `assets/script/game/config/waveConfig/WaveConfigLoader.ts`
- `assets/script/game/config/waveConfig/waves.json`
- `assets/script/game/config/waveConfig/index.ts`

### 数据结构（必须先定清楚）

```typescript
export interface WaveConfig {
    /** 波次序号，从 1 开始 */
    index: number;
    /** 本波超时时长（秒）—— 超过即强制清场 */
    duration: number;
    /** 本波所有刷怪规则 */
    spawners: SpawnerRule[];
    /** 本波给所有怪挂的难度 buff；本阶段仅占字段，不消费 */
    enemyBuffs?: EnemyBuffEntry[];
}

export interface SpawnerRule {
    /** 对接 EMinionType（warrior/ranger/bomber）*/
    enemyId: string;
    count: number;
    /** burst: 一帧全出；over-time: 在 duration 内均匀分布 */
    timing: 'burst' | 'over-time';
    /** ring: 以玩家为圆心刷；random: 地图内随机 */
    pattern: 'ring' | 'random';
    /** pattern=ring 必填 */
    ringRadius?: number;
}

export interface EnemyBuffEntry {
    buffId: number;
    stack?: number;
}
```

### 设计要求

- schema 写在 `types.ts`，**消灭 `any`**
- `WaveConfigLoader` 参考已有 `EnemyConfigLoader` / `RoomConfigLoader` 风格
- 启动时校验：
  - `enemyId` 能通过 `EMinionType` 反查
  - 必填字段齐全
  - `pattern === 'ring'` 时必须有 `ringRadius`
- 校验失败必须**明确报错 + 波次号**，不能拖到运行时

### 完成定义

- 调用 `WaveConfigLoader.loadAll()` 返回 5 条波次，按 `index` 升序
- 故意写错一个 `enemyId`，启动时立即报错，不静默

### 验证手段

- 写 `test/testWaveConfig.ts`，打印每波的 `总怪数 / 最长刷怪时间 / 类型分布`
- 故意改错一个字段，看启动报错是否精确到波次号

### 测试用例

#### 用例 1：配置可读取
- 操作：`WaveConfigLoader.loadAll()`
- 预期：返回 5 条波次，按 index 升序

#### 用例 2：非法 enemyId 被拦截
- 操作：在 `waves.json` 写 `"enemyId": "dragon"`
- 预期：启动时报 `[WaveConfigLoader] wave[2].spawners[0].enemyId "dragon" 未在 EMinionType 注册`

#### 用例 3：缺字段被拦截
- 操作：删掉某条 spawner 的 `count`
- 预期：启动时报 `[WaveConfigLoader] wave[1] missing required field: count`

---

## 五、Step 2.2 - `LevelRun` 本局状态容器

### 目标

建一个最小的"本局数据中心"，后续所有模块都从这里读写。

### 需要新增的文件

- `assets/script/game/level/LevelRun.ts`
- `assets/script/game/level/LevelPhase.ts`

### 数据结构

```typescript
export enum LevelPhase {
    Idle,
    Spawning,      // 刷怪窗口内
    Clearing,      // 刷怪结束，等场上清空
    Collecting,    // 敌人已清，等金币飞完
    Upgrading,     // 升级 UI 开启
    Victory,
    GameOver,
}

export class LevelRun {
    static current: LevelRun | null = null;
    static startNew(): LevelRun;

    readonly phase: LevelPhase;
    readonly waveIndex: number;
    readonly waveElapsed: number;
    readonly upgradeRerollQuota: number;
    readonly appliedUpgradeIds: ReadonlySet<string>;

    setPhase(next: LevelPhase): void;
    setWaveIndex(i: number): void;
    tick(dt: number): void;
    resetRerollQuota(n: number): void;
    addRerollQuota(delta: number): void;  // 给"+quota"升级用
    consumeReroll(): boolean;
    markUpgradeApplied(id: string): void;
}
```

### 设计要求

- **单例但不用 `window.x`**，通过 `LevelRun.current` 访问
- 字段对外 `readonly`，修改只能通过 setter 方法
- **"谁改谁的字段"写死清楚**：
  - `phase` / `waveIndex` 只能被 `LevelManager` 改
  - `appliedUpgradeIds` 只能由 `UpgradeOfferSystem.applyChoice` 写
  - `upgradeRerollQuota` 可被 UI 消耗、可被 "+quota" 类升级增加
- 这里**只是数据袋**，不塞事件总线逻辑

### 完成定义

- `LevelRun.startNew()` 后所有字段回到初值
- 连续开两次局不串数据

### 验证手段

- 单测：`startNew` → `waveIndex === 0 && phase === Idle`
- 单测：`tick(0.5)` 后 `waveElapsed === 0.5`

### 测试用例

#### 用例 1：新局初始化
- 操作：`LevelRun.startNew()`
- 预期：所有字段初值，`appliedUpgradeIds` 空 Set

#### 用例 2：连续开局不串数据
- 操作：`startNew()` → 改 `waveIndex=3` → 再 `startNew()`
- 预期：第二次开局后 `waveIndex === 0`

#### 用例 3：reroll quota 可增可减
- 操作：初值 1 → `addRerollQuota(2)` → `consumeReroll() × 2`
- 预期：quota 依次为 1、3、2、1

---

## 六、Step 2.3 - `WaveDirector` 刷怪调度

### 目标

只做一件事：**按 `WaveConfig` 把怪造出来放到场上**。不管清场、不管暂停、不管事件总线。

### 重点涉及文件

- `assets/script/game/level/WaveDirector.ts`
- 参考已有：`enemy/minion/MinionControl.ts`、`enemy/minion/behaviors.ts`

### 改动内容

- 新建 `WaveDirector`，持有 minion prefab 引用
- 实现 `startWave(cfg: WaveConfig)`
- 实现 `tick(dt: number)` —— 处理 `timing: 'over-time'` 的分摊刷怪
- `pattern: 'ring' | 'random'` 两种位置计算

### 设计要求

- **用 prefab + `MinionControl.behaviorId`** 实例化敌人，不要裸 `new Node` 拼组件
- `WaveDirector` **不订阅事件**，不自己判定清场
- 两种 pattern 用**策略函数表**，不用 switch：

```typescript
const patternFns: Record<SpawnPattern, (cfg, i, total) => Vec3> = {
    ring:   (cfg, i, total) => { /* 均分角度 */ },
    random: (cfg, i, total) => { /* 地图内随机 */ },
};
```

### 完成定义

- 调用 `startWave(cfg)` 后，场上真的多了配置数量的怪
- `timing='burst'`：一帧全出
- `timing='over-time'`：在 `cfg.duration` 内均匀分布
- Ring 位置正确（半径误差 ≤ 5px）

### 验证手段

- 写 `test/testWaveDirector.ts`，mock `{count:10, timing:'burst', pattern:'ring'}`
- 打印 `EnemyBase.allEnemies.length === 10`
- 10 只怪到玩家距离应都 ≈ ringRadius

### 测试用例

#### 用例 1：burst 一帧全出
- 输入：`count=5, timing='burst'`
- 预期：`startWave` 返回后场上 5 只

#### 用例 2：over-time 平摊
- 输入：`count=6, timing='over-time', duration=3`
- 预期：0s 时 1 只 / 1.5s 时 3 只 / 3s 时 6 只

#### 用例 3：ring 位置正确
- 输入：`pattern='ring', ringRadius=300`
- 预期：所有怪到原点距离 ≈ 300（±5px 容差）

---

## 七、Step 2.4 - 清场判定（全灭 + 超时）

### 目标

把 `Spawning → Clearing → Collecting` 这条链路接上。

### 重点涉及文件

- `assets/script/game/level/LevelManager.ts`（骨架，Step 2.9 补全）
- `assets/script/game/events/GameEvents.ts`（加 `WaveClear` 事件）

### 改动内容

- 新增事件：`GameEvt.WaveClear`，payload: `{ waveIndex, reason: 'killall'|'timeout' }`
- `LevelManager` 订阅 `EnemyDeath`，维护 `_aliveCount`
- 每帧判定：
  - `_aliveCount === 0` → 进 `Clearing`
  - `LevelRun.waveElapsed >= cfg.duration` → 进 `Clearing`（**静默销毁所有残怪**）
- 进 `Clearing` 后判定：
  - `CoinPool.active.length === 0` → 进 `Collecting` → 进 `Upgrading`

### 设计要求

- 判定是**数据驱动**：`shouldClear()` 是一个纯函数，输入 `aliveCount / elapsed / duration`，输出 bool
- 静默销毁残怪：直接 `EnemyBase.allEnemies.forEach(e => e.node.destroy())`，**不 emit `EnemyDeath`**
- Clearing 和 Collecting 分两个 phase，**不合并**：金币吸附期间仍然要 tick `CoinPickupSystem`，不能误切 Upgrading

### 完成定义

- 全灭路径：最后一只怪死 → 金币收完 → 进 Upgrading
- 超时路径：duration 到点 → 残怪立即消失 → 进 Upgrading
- 超时残怪**不掉金币、不给经验**

### 验证手段

- 把 `waves.json` 里某波 `duration` 改成 3s，进游戏不动，看 3s 后是否进 Upgrading
- 开 verbose log 看 phase 切换序列

### 测试用例

#### 用例 1：全灭触发
- 操作：打完所有怪
- 预期：phase 从 `Spawning → Clearing → Collecting → Upgrading`

#### 用例 2：超时触发
- 操作：躲着不打，等 duration
- 预期：残怪消失，phase 从 `Spawning → Clearing → Collecting → Upgrading`（快速切完）

#### 用例 3：金币未收完时不进 Upgrading
- 操作：最后一只怪死掉，此刻金币还没飞完
- 预期：phase 停在 `Collecting`，等金币入账后才进 `Upgrading`

#### 用例 4：超时残怪不掉金币
- 操作：躲着不打，看金币总数
- 预期：超时前金币数与超时后相等（残怪静默消失）

---

## 八、Step 2.5 - 暂停机制

### 目标

升级 UI 打开期间，**敌人 AI、玩家输入冻结**；但 UI / 金币吸附 / 摄像机继续跑。

### 重点涉及文件

- `assets/script/game/core/GameLoop.ts`
- 敌人 `update` 开头加一道防线（选配）

### 改动内容

```typescript
// GameLoop.update
const phase = LevelRun.current?.phase ?? LevelPhase.Idle;
const combatActive =
    phase === LevelPhase.Spawning ||
    phase === LevelPhase.Clearing;

// 永远跑
this._systems.rawInput.update(entities);
this._systems.coinPickup.update(entities, dt);   // 升级期间金币继续飞
GoldSystem.inst.tick(dt);

if (combatActive) {
    this._systems.actionMap.update(entities);
    this._systems.playerControl.update(entities);
    this._systems.moveSync.update(entities, dt);
}
```

### 设计要求

- **禁止使用 `cc.game.pause()`**（那会冻死 UI）
- **暂停条件集中在 `GameLoop` 一处**；敌人/玩家内部最多加一道补丁防线
- 用 `LevelPhase` 数据判定，**不要**加一个 `_paused: bool`

### 完成定义

- Upgrading 期间敌人不动、玩家不动
- UI 的 tween / hover 正常
- 从 Upgrading 回 Spawning，敌人立即恢复 AI，无"冲刺"（没累积 dt）

### 验证手段

- 手动把 `LevelRun.current.phase` 切到 Upgrading，观察敌人是否全定格
- 暂停期点击 UI 按钮是否正常响应

### 测试用例

#### 用例 1：暂停期敌人不动
- 操作：phase → Upgrading
- 预期：敌人节点 `worldPosition` 连续 3 帧完全一致

#### 用例 2：UI 仍响应
- 操作：暂停期悬停按钮
- 预期：hover tween 正常

#### 用例 3：恢复后无副作用
- 操作：Upgrading → Spawning
- 预期：敌人立即追玩家，不会"冲刺一下"

#### 用例 4：金币继续飞
- 操作：最后一只怪死在 Upgrading 切换边界
- 预期：Upgrading 期间剩余金币仍能被玩家吸附入账

---

## 九、Step 2.6 - Tier → 权重策略脚本

### 目标

把"价值分数 → 概率"这个**策划调参点**抽成单独模块，以后只改这一个文件即可切换曲线。

### 需要新增的文件

- `assets/script/game/level/upgrade/TierWeightPolicy.ts`

### 改动内容

```typescript
export interface IWeightPolicy {
    tierToWeight(tier: number): number;
}

/** 线性反比：weight = 1/tier（tier 0 时返回 0） */
export class LinearWeightPolicy implements IWeightPolicy {
    tierToWeight(tier: number): number {
        return tier > 0 ? 1 / tier : 0;
    }
}

/** 二次反比：weight = 1/tier²（高 tier 极稀有） */
export class QuadraticWeightPolicy implements IWeightPolicy {
    tierToWeight(tier: number): number {
        return tier > 0 ? 1 / (tier * tier) : 0;
    }
}

/** 当前使用的策略 —— 切换曲线只改这一行 */
export const CurrentWeightPolicy: IWeightPolicy = new LinearWeightPolicy();

/** 便捷函数，等价于 CurrentWeightPolicy.tierToWeight(tier) */
export function tierToWeight(tier: number): number {
    return CurrentWeightPolicy.tierToWeight(tier);
}
```

### 设计要求

- 模块**只做数学**，不碰 `UpgradeConfig`
- 外部消费方只引用 `tierToWeight`，不直接 import `LinearWeightPolicy`
- 切换曲线只改 `CurrentWeightPolicy` 一行

### 完成定义

- 调用方通过 `tierToWeight(cfg.tier)` 拿到权重
- 单测：tier=1→1.0、tier=2→0.5、tier=4→0.25
- `tier=0` 返回 0，不除零崩溃

### 验证手段

- 写 `test/testTierWeight.ts`，覆盖 tier 0/1/2/3/4 的输出
- 手动切到 `QuadraticWeightPolicy`，验证分布改变但无报错

### 测试用例

#### 用例 1：线性公式正确
- 输入：tier=2
- 预期：权重=0.5

#### 用例 2：tier=0 安全
- 输入：tier=0
- 预期：权重=0

#### 用例 3：策略可替换
- 操作：把 `CurrentWeightPolicy` 换成 Quadratic
- 预期：所有调用方无需改代码

---

## 十、Step 2.7 - `UpgradeOfferSystem` 抽卡器

### 目标

**从 `ALL_UPGRADES` 抽 3 张**，考虑去重、进化版解锁、tier 权重。

### 重点涉及文件

- `assets/script/game/level/upgrade/UpgradeOfferSystem.ts`
- 已有：`upgrade/upgradeConfigs.ts`、`upgrade/UpgradeManager.ts`

### 数据结构

```typescript
export class UpgradeOfferSystem {
    constructor(
        private _manager: UpgradeManager,
        private _pool: readonly UpgradeConfig[] = ALL_UPGRADES,
    ) {}

    rollOffer(count = 3): UpgradeConfig[];
    applyChoice(id: string): boolean;
    isEligible(cfg: UpgradeConfig): boolean;
}
```

### 候选池过滤规则（"数据决定行为"）

一个 `UpgradeConfig` 进入候选池的条件，写成**一串 `.filter`**：

```typescript
pool
    .filter(cfg => !run.appliedUpgradeIds.has(cfg.id))   // 1. 未选过
    .filter(cfg => !cfg.evolvesFrom?.length              // 2. 非进化版
        || cfg.evolvesFrom.every(id =>                    //    或进化前置已齐全
            run.appliedUpgradeIds.has(id)));
```

### 权重抽样算法

首版用最清晰的"累积权重 + 线性扫描"，不做 alias method：

```typescript
pickWeighted(pool: UpgradeConfig[], count: number): UpgradeConfig[] {
    const result: UpgradeConfig[] = [];
    const remaining = [...pool];
    for (let i = 0; i < count && remaining.length > 0; i++) {
        const weights = remaining.map(c => tierToWeight(c.tier));
        const total = weights.reduce((a, b) => a + b, 0);
        if (total <= 0) break;
        let r = Math.random() * total;
        let pickIdx = 0;
        for (let j = 0; j < weights.length; j++) {
            r -= weights[j];
            if (r <= 0) { pickIdx = j; break; }
        }
        result.push(remaining[pickIdx]);
        remaining.splice(pickIdx, 1);
    }
    return result;
}
```

### 设计要求

- `rollOffer` 返回的数组**数量 ≤ count**（候选不足不补位）
- `applyChoice(id)` 三件事：
  1. `UpgradeManager.apply(cfg)`
  2. `LevelRun.markUpgradeApplied(id)`
  3. emit `GameEvt.UpgradeChosen`
- 禁止持有"上一次 roll 的结果"做重抽（重抽由 `LevelManager` 显式再 `rollOffer`）

### 完成定义

- 连续 100 次 `rollOffer(3)`，不含已选过的 id
- 选了前置后，进化版可能出现在 roll 结果中
- 候选池 < 3 时返回实际长度

### 验证手段

- 单测：mock `appliedUpgradeIds` 包含 `rapid-fire`，roll 100 次都不应含它
- 单测：mock 3 条 tier=1 / 3 条 tier=2，抽 1000 次统计分布

### 测试用例

#### 用例 1：抽满 3 张
- 操作：`rollOffer(3)`
- 预期：返回 3 条，无重复

#### 用例 2：已选永久剔除
- 操作：选了 `rapid-fire` 后 roll 100 次
- 预期：100 次都不含 `rapid-fire`

#### 用例 3：进化版在前置齐全后入池
- 操作：选了 `multi-shot`（箭+1），roll 时
- 预期：`barrage-shot`（箭+2 进化版）**可能**出现

#### 用例 4：权重分布验证
- 操作：mock tier 1/2/3 池，抽 1000 次
- 预期：tier=1 出现率 ≈ 6/11 ≈ 54%（线性曲线下）

#### 用例 5：候选池不足不补位
- 操作：池里只有 2 条可抽，`rollOffer(3)`
- 预期：返回 2 条

---

## 十一、Step 2.8 - 升级 UI（3 选 1 + 刷新）

### 目标

让玩家**真的能看见和点**升级卡。

### 重点涉及文件

- `assets/script/game/ui/UpgradeOfferPanel.ts`（新）
- `assets/script/game/ui/UpgradeCard.ts`（新）
- `assets/script/game/events/GameEvents.ts`（加 3 个事件）

### 节点结构（Panel 预制体约定）

```
UpgradeOfferPanel  (Widget 全屏)
├── Dim            (全屏半透明黑遮罩)
├── Title          (Label: "选择升级")
├── CardRow        (Layout: 横向 3 格)
│   ├── UpgradeCard × 3
│       ├── Frame  (边框，颜色按 rarity)
│       ├── NameLabel
│       ├── DescLabel
│       └── RarityIcon（可选）
├── RerollBtn      (Button)
└── RerollCountLabel  (Label: "刷新 (N 次剩余)")
```

### 新增事件

```typescript
GameEvt.UpgradeOfferShow:   'upgrade:offer_show',
GameEvt.UpgradeChosen:      'upgrade:chosen',
GameEvt.UpgradeReroll:      'upgrade:reroll',
```

Payload：

```typescript
UpgradeOfferShowEvent { offers: UpgradeConfig[]; rerollQuota: number }
UpgradeChosenEvent    { id: string }
UpgradeRerollEvent    { remainingQuota: number }
```

### 设计要求

- **`UpgradeOfferPanel` 是纯视图**：`show(offers, rerollQuota)` 从外部传入
- 卡片点击 → emit `UpgradeChosen` + 关闭面板
- 刷新按钮：
  - 点击 → `LevelRun.current.consumeReroll()` → emit `UpgradeReroll`
  - `quota === 0` → 按钮置灰 + 禁用点击
- Rarity → 颜色**查表**，不 switch：

```typescript
const rarityColor: Record<Rarity, Color> = {
    common:    new Color(180,180,180),
    rare:      new Color( 80,160,255),
    epic:      new Color(170, 80,255),
    legendary: new Color(255,200, 80),
};
```

### 完成定义

- `panel.show(offers, quota)` 能看到 3 张卡
- 点卡 → emit 事件 + 面板关闭
- 点刷新 → emit 事件（外部 `UpgradeOfferSystem` 重新 roll + 再 show）
- `quota === 0` 时刷新按钮灰色不可点

### 验证手段

- 场景手动调 `panel.show([mockCfg1, mockCfg2, mockCfg3], 1)`
- 点卡 / 点刷新，控制台打印事件 payload

### 测试用例

#### 用例 1：3 卡正常渲染
- 输入：3 条 UpgradeConfig
- 预期：3 张卡，文字/rarity 颜色正确

#### 用例 2：少于 3 张也能显示
- 输入：2 条
- 预期：2 张卡，无第 3 张空位错

#### 用例 3：quota=0 按钮禁用
- 操作：`quota = 0` 调 show
- 预期：刷新按钮灰色，点击无反应

#### 用例 4：连续点刷新
- 操作：quota=2，点一次刷新
- 预期：emit 一次事件，再点一次后 quota=0 按钮置灰

---

## 十二、Step 2.9 - `LevelManager` 粘合 + Victory UI

### 目标

把前面所有东西**组装成一局完整游戏**，**严格单节点启动**：场景只需 `Canvas + Camera + LevelRoot` 三个节点，`LevelRoot` 上仅挂一个 `LevelManager` 脚本，**不拖任何 prefab**。

### 前置约束：资源获取方式

本阶段开始前（本文档落地前已完成）：

- `arrowPrefab` / `coinPrefab` 等资源 prefab **全部走 `resources.load`**，不再用 `@property(Prefab)`
- Prefab 路径统一登记在 `ResourcePreloader.PREFAB_PATHS`
- 启动顺序：`GameLoop.onLoad` → `preloadAllResources()` → `bootstrap(node, arrow, coin)` → `ResourceState.markReady()`
- 业务方（含 `PlayerControl` / `LevelManager`）**一律通过 `ResourceState.onReady` 回调**启动自身逻辑，不依赖 Component onLoad 顺序

### 需要新增的文件

- `assets/script/game/level/LevelManager.ts`（场景唯一挂载脚本）
- `assets/script/game/ui/VictoryPanel.ts`
- `assets/script/game/ui/GameOverPanel.ts`（选做）

### `LevelManager` 职责：启动器 + 状态机 + 胶水

```typescript
@ccclass('LevelManager')
export class LevelManager extends Component {
    // ❌ 禁止 @property(Prefab)：所有 prefab 走 ResourceMgr
    // ❌ 禁止 @property(Node) upgradePanel：UI 节点也由代码动态造或 resources.load

    private _run!: LevelRun;
    private _director!: WaveDirector;
    private _offer!: UpgradeOfferSystem;
    private _waves!: WaveConfig[];
    private _aliveCount = 0;
    private _gameLoopNode!: Node;
    private _playerNode!: Node;
    private _enemiesParent!: Node;

    onLoad() {
        // 1. 造 GameLoop 子节点 —— 挂 GameLoop Component，自举启动预加载链
        this._gameLoopNode = new Node('GameLoop');
        this.node.addChild(this._gameLoopNode);
        this._gameLoopNode.addComponent(GameLoop);

        // 2. 造敌人父节点（空壳，WaveDirector 往里塞 Minion）
        this._enemiesParent = new Node('Enemies');
        this.node.addChild(this._enemiesParent);

        // 3. 等资源就绪后再造玩家 + 起 Wave
        ResourceState.onReady(() => this._initLevel());
    }

    private _initLevel(): void {
        this._waves = loadAllWaves();

        // 造玩家节点，挂 PlayerControl 组件（它会自己建 Body/GroundFX/UIAnchor 子节点）
        this._playerNode = new Node('Player');
        this.node.addChild(this._playerNode);
        this._playerNode.addComponent(PlayerControl);

        this._run = LevelRun.startNew();
        this._director = new WaveDirector(this._enemiesParent);  // prefab 由 director 内部 load
        this._offer = new UpgradeOfferSystem(PlayerControl.instance!.runtime.upgradeMgr);

        on(GameEvt.EnemyDeath,    this._onEnemyDeath);
        on(GameEvt.UpgradeChosen, this._onUpgradeChosen);
        on(GameEvt.UpgradeReroll, this._onReroll);
        on(GameEvt.PlayerDeath,   this._onPlayerDeath);

        this._enterWave(0);
    }

    update(dt: number) {
        if (!this._run) return;  // 资源未就绪前啥也不做
        this._run.tick(dt);
        this._director.tick(dt);
        this._tickPhaseTransitions();
    }

    private _tickPhaseTransitions() {
        const cfg = this._waves[this._run.waveIndex];
        switch (this._run.phase) {
            case LevelPhase.Spawning:
                if (this._aliveCount === 0 && this._director.isDone()) {
                    this._onWaveCleared('killall');
                } else if (this._run.waveElapsed >= cfg.duration) {
                    this._despawnStragglers();
                    this._onWaveCleared('timeout');
                }
                break;
            case LevelPhase.Clearing:
                if (this._aliveCount === 0) {
                    this._run.setPhase(LevelPhase.Collecting);
                }
                break;
            case LevelPhase.Collecting:
                if (CoinPool.active.length === 0) {
                    this._enterUpgrading();
                }
                break;
        }
    }
    // ... _enterWave / _enterUpgrading / _onUpgradeChosen / _onWaveCleared
}
```

### 胜利/失败判定

- **胜利**：选完最后一波的升级 → 或最后一波清完**不弹升级直接**进 Victory（两种都可以，推荐后者更简洁）
- **失败**：玩家死亡事件 → `phase = GameOver` → 弹 GameOverPanel（或 console 一句过渡）

### 设计要求

- **场景只有 3 个节点**：Canvas（UI 必需）+ Camera（渲染必需）+ LevelRoot（挂 LevelManager）
- **代码生成所有业务节点**：`GameLoop` / `Player` / `Enemies` 父节点都是 LevelRoot 的子节点
- **零 @property(Prefab) / @property(Node)**：所有资源走 `ResourceMgr.inst.get`，所有 UI 节点由 LevelManager 动态造
- 跨模块通信走 EventBus，LevelManager 不直接调用升级/金币系统内部
- `_tickPhaseTransitions` 是 switch-case，**一个 phase 只一条转换规则**
- **不允许**写 `if (waveIndex === 4) { victory }`，用 `waveIndex >= waves.length` 判定

### 完成定义

- 新建空场景 → 挂一个节点 `LevelRoot` → 添加 `LevelManager` 组件 → 点运行 → 完整 5 波流程跑通
- 场景文件里**不序列化任何业务 prefab / 业务节点引用**

### 验证手段

- 真机回归：不动，看 5 波能否全靠超时走完
- 真机回归：主动打，选升级能看到下波敌人变强（如果接了 enemyBuffs）
- 控制台看 phase 切换日志

### 测试用例

#### 用例 1：5 波按顺序推进
- 操作：正常玩
- 预期：日志依次打印 `[Level] wave 1 start` … `[Level] wave 5 start` … `[Level] victory`

#### 用例 2：Game Over 打断循环
- 操作：第 2 波故意死
- 预期：phase 切到 GameOver，不再进 Upgrading，不进 wave 3

#### 用例 3：选升级影响下一波
- 操作：第 1 波后选"攻击+30%"
- 预期：玩家 Attack 属性面板数值确实增加

#### 用例 4：刷新次数正确消耗
- 操作：波间点刷新 1 次
- 预期：按钮 "刷新 1" → 灰；下波 UI 弹出时 quota 重置

#### 用例 5：Victory UI
- 操作：打完 5 波
- 预期：VictoryPanel 可见，"再来一局"点击后场景重新开始

---

## 十三、这一阶段不要做什么

不要在这一步里顺手做：

- ❌ 敌人 Buff 难度缩放的**真实实现**（只占字段 `enemyBuffs`，不消费）
- ❌ `SpawnWarningManager` 预警图标（Step 0 §9，下阶段）
- ❌ `CameraController.setBounds` 边界（单地图不需要）
- ❌ `EnemyFactory.create(id)` 动态工厂（`WaveDirector` 直接 `instantiate` prefab 够用）
- ❌ 商店系统 / Meta 进度 / 多地图切换 / 传送门
- ❌ 把 `GameSession` 扩成完整 `RunSession`（本阶段 `LevelRun` 够用，下阶段再合并）
- ❌ Excel → JSON 工具链（首版手写 JSON）

这些都是真的重要，但都不是这一阶段的主任务。

这一步只做一件事：

**把"一局游戏"的骨架建出来 —— 波次、清场、暂停、升级、胜利 —— 全部数据驱动。**

---

## 十四、本大步骤完成后的统一验收

完成本阶段后，应该达到下面这些标准：

| 验收项 | 预期结果 |
|------|---------|
| 场景业务节点数是否 = 1（LevelRoot，除 Canvas + Camera 必需外）| 是 |
| 场景里是否还有任何 `@property(Prefab)` / `@property(Node)` 拖拽 | 否 |
| 5 波配置改 json 能否立即生效（波数/时长/敌人类型） | 是 |
| 刷新次数初值是否来自配置或代码常量，而非魔法数字 | 是 |
| 权重曲线改一个文件能否切换（linear ↔ quadratic） | 是 |
| 抽卡是否有可能抽到已选过的 | 否 |
| 超时残怪是否会意外掉金币 | 否 |
| 升级期间敌人是否冻结 | 是 |
| 5 波全过是否出 Victory UI | 是 |
| 玩家死亡是否能切到 GameOver 终止循环 | 是 |
| 整体代码里有没有 `if (waveIndex === 4)` 之类的特判 | 否 |

---

## 十五、建议的手工回归清单

每次完成一个小步骤，都建议至少做这 10 个手工回归：

1. 进入场景，玩家正常出生在中央
2. 摄像机跟随玩家
3. 第 1 波怪按配置数量生成
4. 打死怪掉金币、金币能被吸、控制台打印 total
5. 经验/升级相关入口（玩家已有系统）不报错
6. 清完 1 波后升级 UI 弹出
7. 选任一张卡后 UI 关闭 + 下一波开始
8. 刷新按钮次数递减，`quota=0` 时灰色不可点
9. 故意躲着，`duration` 到点超时进下一波（残怪消失）
10. 5 波通关看到 Victory UI

---

## 十六、关键设计决策表

| 决策 | 选择 | 理由 |
|------|------|------|
| 资源 prefab 获取 | **全部 `resources.load`，禁止 `@property(Prefab)`** | 消灭拖拽，场景单节点启动 |
| 场景节点 | **LevelRoot + Canvas + Camera，共 3 个** | 业务节点全部代码生成 |
| 启动时序 | **`preload → bootstrap → markReady`**；业务方走 `ResourceState.onReady` | 消灭 onLoad 顺序依赖 |
| 超时残怪处理 | **静默消失** | 玩家打不完不给奖励，鼓励进攻 |
| 波间过渡 | **等敌人清 + 金币收完** 才暂停 | 避免金币卡在半空不入账 |
| reroll 初值 | **1 次** | 保底不至于全锁死 |
| reroll 作用域 | **每波独立** | 每波开始重置为初值 |
| 权重曲线 | **线性反比**（可切换策略类）| 首版简单，预留扩展口 |
| 难度缩放形态 | **`enemyBuffs` 字段占位**，本阶段不消费 | 复用 Buff 系统，不自建机制 |
| 抽卡去重 | **已选永久剔除** + 进化版解锁 | 增强多样性 + 保留 build 深度 |
| 暂停实现 | **`LevelPhase` 数据驱动 `GameLoop.update`** | 单点决策，消灭散布的 `_paused` |
| 胜利判定 | **`waveIndex >= waves.length`** | 数据决定行为，零特判 |

---

## 十七、相关文档

- 前置：[Step0-遗漏的系统.md](./Step0-遗漏的系统.md) — 这里列的 #5 `RunSession` 在本阶段以简化版 `LevelRun` 落地
- 参考：[03-地图与关卡系统.md](./03-地图与关卡系统.md) — 本阶段是 03 的 MVP 版，暂不做地图切换/传送门
- 参考：[04-敌人死亡与金币系统.md](./04-敌人死亡与金币系统.md) — 本阶段依赖 04 的 `EnemyDeath` 事件链
- 风格参考：[重构步骤-1-职业与基础架构.md](../阶段1-角色战斗/历史文档/重构步骤-1-职业与基础架构.md)

---

> 完成本阶段后，下一阶段候选：
> 1. 敌人 `enemyBuffs` 真实消费 + 难度曲线调整
> 2. Step 0 §5 `GameSession` 合并到 `LevelRun`，升级为完整 `RunSession`
> 3. Step 0 §9 `SpawnWarningManager` 预警机制
> 4. 多地图 / 传送门（对应 03 文档的完整版）
