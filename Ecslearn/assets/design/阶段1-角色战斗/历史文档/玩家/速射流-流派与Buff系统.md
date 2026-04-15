# 速射流 —— 流派 × Buff池 × 技能联动 完整设计

> 前置阅读：[05-Buff与技能系统](../05-Buff与技能系统.md)、[04-肉鸽核心机制](../../阶段3-游戏整体/04-肉鸽核心机制.md)、[普通攻击升级路线](./普通攻击升级路线.md)

---

## 零、全局架构：流派 → 进阶 → Buff池

```
                          ┌────────────────────┐
                          │   开局选择：速射流   │
                          │ （所有玩家初始流派） │
                          └─────────┬──────────┘
                                    │
                    ┌───── 第3层选择进阶方向 ─────┐
                    │               │               │
             ┌──────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐
             │  弹幕流      │ │  爆发流     │ │  持续流     │
             │ (Barrage)   │ │ (Burst)    │ │ (Sustain)  │
             │ 多重+急速   │ │ 蓄力+暴击  │ │ 穿透+弹射  │
             │ +散弹       │ │ +重箭      │ │ +毒+追踪   │
             └──────┬──────┘ └─────┬──────┘ └─────┬──────┘
                    │              │               │
              ┌─────▼─────┐ ┌─────▼─────┐  ┌─────▼─────┐
              │暴风雪(进化)│ │陨星箭(进化)│  │雷神之怒    │
              └───────────┘ └───────────┘  └───────────┘
```

### 流派选择规则

| 规则 | 说明 |
|------|------|
| **初始** | 所有玩家以"速射流"开局，拥有基础主动/被动技能 |
| **进阶触发** | 第 3 层通关后，弹出进阶选择面板（三选一，对应三个进阶方向） |
| **Buff池切换** | 选择进阶后，该进阶的【核心Buff】加入随机池，其他进阶的核心Buff永久移除 |
| **通用Buff** | 流派通用Buff + 全局通用Buff 始终在随机池中 |
| **不可反悔** | 进阶选择不可更改，一局一条路走到底 |

---

## 一、速射流：基础流派定位

### 1.1 流派特征

| 维度 | 描述 |
|------|------|
| **核心玩法** | 高频射箭，用密度换伤害。一秒射5箭，每箭不痛但加起来要命 |
| **手感定位** | "缝纫机"——停不下来的输出节奏，屏幕上永远有箭在飞 |
| **优势** | 触发型效果（吸血/元素/on-hit）收益极高；容错率高（miss一箭无所谓） |
| **劣势** | 单箭伤害低，面对高防敌人效率骤降；弹道密集导致性能压力 |
| **成长曲线** | 前期平稳（攻速提升感知明显），中期爆发（多重射击+元素），后期滚雪球（密度×on-hit=清屏） |

### 1.2 核心属性依赖

```
主属性：AttackSpeed（攻速）    —— 一切的根基
副属性：ExtraProjectiles（额外弹道）—— 密度倍增器
辅属性：LifestealRate / on-hit效果  —— 高频触发收益
```

---

## 二、技能设计

### 2.1 主动技能（开局自带2个）

#### 主动技能 1：箭雨倾泻（Arrow Storm）

| 字段 | 内容 |
|------|------|
| **类型** | 主动，需手动触发 |
| **冷却** | 12 秒 |
| **效果** | 在目标区域降下一阵箭雨：1.5秒内降落 12 支箭，每支造成 ATK×40% 伤害，覆盖半径 = attackRange×0.4 |
| **特殊** | 箭雨中的每支箭继承当前所有弹道Buff效果（穿透、元素等） |
| **阶段** | 全程可用，后期配合Buff极强 |

**与Buff联动：**
- 拥有"烈焰箭"→ 箭雨点燃区域，离开区域仍灼烧
- 拥有"多重射击"→ 每支箭雨变成 3 支小箭雨
- 拥有"急速连射"核心Buff → 冷却 -30%

#### 主动技能 2：闪身射击（Dash Shot）

| 字段 | 内容 |
|------|------|
| **类型** | 主动，需手动触发 |
| **冷却** | 6 秒 |
| **效果** | 向移动方向闪身一段距离（无敌帧 0.3 秒），闪身过程中向最近敌人连射 3 箭（每箭 ATK×60%） |
| **特殊** | 闪身距离 = MoveSpeed × 0.5；连射数随攻速被动加成 |
| **阶段** | 前期保命，后期输出+位移双重价值 |

**与Buff联动：**
- 拥有"弹幕射手"核心Buff → 闪身连射变 6 箭
- 拥有"寒冰箭"→ 闪身箭附带减速，创造安全距离
- 拥有"影分身"→ 分身也执行闪身射击

### 2.2 被动技能（开局自带1个）

#### 被动技能：自动速射（Auto Rapid Fire）

| 字段 | 内容 |
|------|------|
| **类型** | 被动，全程自动运作 |
| **效果** | 玩家静止时自动朝最近敌人射箭，射速 = AttackSpeed 属性值。移动时停止自动射击 |
| **升级路线** | Lv1：静止自动射击 → Lv2：移动中也能射击（射速-30%）→ Lv3：移动中满速射击 |
| **特殊** | 自动射击的箭继承所有Buff效果，与手动攻击共享冷却 |

**与Buff联动：**
- "连射模式"核心Buff直接解锁 Lv2 效果
- "急速连射"叠满后解锁 Lv3 效果
- 所有on-hit Buff在自动射击中同样触发

---

## 三、Buff 设计

### Buff 分类总览

```
┌─────────────────────────────────────────────────────┐
│                    Buff 随机池                        │
│                                                     │
│  ┌──────────────────┐  选择进阶后锁定一组            │
│  │ 流派核心Buff (5+) │  其他进阶的核心Buff移除       │
│  │ "改变玩法"       │                               │
│  └──────────────────┘                               │
│                                                     │
│  ┌──────────────────┐  始终可出现                    │
│  │ 流派通用Buff (6+) │  服务速射流整体               │
│  │ "强化核心"       │                               │
│  └──────────────────┘                               │
│                                                     │
│  ┌──────────────────┐  始终可出现                    │
│  │ 全局通用Buff (6+) │  任何流派都有用               │
│  │ "基础面板"       │                               │
│  └──────────────────┘                               │
└─────────────────────────────────────────────────────┘
```

---

### 3.1 流派核心Buff（选定进阶方向后，仅该方向的核心Buff入池）

#### ── 弹幕流 核心Buff（5个） ──

> 设计哲学：用密度碾压一切。屏幕上的箭越多越好。

| # | Buff名称 | 稀有度 | 效果 | 阶段 | 实现类型 |
|---|----------|--------|------|------|----------|
| C1 | **弹幕射手** | Epic | 每次攻击额外发射 +2 支箭（扇形15°散开），单箭伤害 -10%。与 multi_shot 叠加 | 中期 | B类：`extraProjectiles` ADD +2 |
| C2 | **扫射模式** | Rare | 多重射击的扇形角度从 15° 扩大到 60°，覆盖整个前方。箭矢数 ≥3 时自动触发 | 中期 | B类：新属性 `spreadAngle` OVERRIDE 60 |
| C3 | **弹幕狂热** | Legendary | 每连续射击 1 秒不中断，攻速 +5%（最多叠 10 层 = +50%）。停止射击 2 秒后清零 | 中期 | C类：触发型计时器 + `atkSpeed` MUL |
| C4 | **散弹箭** | Epic | 将每支箭替换为 3 支短程箭（扇形 45°），每支 35% 伤害，射程 -40%。近距离DPS极高 | 后期 | B类：`projectileType` OVERRIDE 'shotgun' |
| C5 | **无尽弹仓** | Legendary | 每射出第 10 支箭，触发一次免费的"箭雨倾泻"（不触发冷却）。攻速越快触发越频繁 | 后期 | C类：射击计数器 + 技能调用 |

**弹幕流进化：暴风雪** —— 需要 `弹幕射手` + `寒冰箭`（全局通用Buff）
> 所有箭矢附带冰冻效果，多箭同时命中同一目标直接冰冻 1.5 秒。弹道变为蓝白色冰锥。

---

#### ── 爆发流 核心Buff（5个） ──

> 设计哲学：不鸣则已，一鸣惊人。蓄力→释放→毁天灭地。

| # | Buff名称 | 稀有度 | 效果 | 阶段 | 实现类型 |
|---|----------|--------|------|------|----------|
| C6 | **蓄力引擎** | Epic | 静止不攻击时每秒积累 1 层"蓄力"（最多 5 层）。下次攻击消耗所有层，每层 +50% 伤害 | 中期 | C类：新属性 `chargeLevel`，触发型计时器 |
| C7 | **满弦一射** | Rare | 蓄力满 5 层时，箭矢体积 ×3，穿透 +3，并造成小范围 AOE（ATK×30% 溅射） | 中期 | B类：条件检查 `chargeLevel >= 5` → 修改弹道参数 |
| C8 | **暴击风暴** | Epic | 暴击时下一箭必定暴击（连锁暴击），最多连锁 3 次。第3次暴击伤害额外 +100% | 后期 | C类：触发型状态机 |
| C9 | **处刑之箭** | Legendary | 对生命值低于 30% 的敌人，伤害 ×3。配合高单发伤害 = Boss终结者 | 中期 | A类：条件伤害乘数（在 `attack()` 中检查目标HP比例） |
| C10 | **时间凝缩** | Legendary | 蓄力期间时间减缓 50%（敌人移速/攻速减半），自己不受影响。蓄力变成战术选择 | 后期 | C类：全局时间缩放修饰 |

**爆发流进化：陨星箭** —— 需要 `蓄力引擎` + `烈焰箭`（全局通用Buff）
> 蓄力满层射出一支巨型燃烧箭，命中造成 ATK×500% 范围爆炸，点燃区域 3 秒。

---

#### ── 持续流 核心Buff（5个） ──

> 设计哲学：一箭射出，伤害不止。弹道在敌群中反复穿梭，毒素持续扩散。

| # | Buff名称 | 稀有度 | 效果 | 阶段 | 实现类型 |
|---|----------|--------|------|------|----------|
| C11 | **无限穿透** | Epic | 箭矢穿透次数 +5，且穿透不再衰减伤害（原本每穿一次 -20%） | 中期 | A类：`pierceCount` ADD +5 + 新flag `pierceNoDamageDecay` |
| C12 | **连锁弹射** | Epic | 箭矢命中后弹射到最近敌人，最多弹射 4 次。弹射伤害 80%（不衰减） | 中期 | B类：`bounceCount` ADD +4 |
| C13 | **瘟疫扩散** | Legendary | 中毒的敌人死亡时，毒素扩散到周围 3 个敌人（继承剩余层数）。可无限链式扩散 | 后期 | C类：敌人死亡事件监听 + Buff复制 |
| C14 | **侵蚀箭** | Rare | 箭矢命中使目标防御 -15%（可叠加 5 次 = -75%）。持续 5 秒，速射下轻松叠满 | 中期 | A类：对敌施加 `def` MUL 减益Buff |
| C15 | **追猎本能** | Epic | 箭矢获得强追踪（转向速率×3）。屏幕内无论敌人在哪，箭一定能拐弯命中 | 后期 | B类：`homingStrength` OVERRIDE 3.0 |

**持续流进化：雷神之怒** —— 需要 `连锁弹射` + `雷电箭`（全局通用Buff）
> 弹射变为无限次（直到没有新目标），每次弹射触发闪电链。

---

### 3.2 流派通用Buff（6个，始终在池中）

> 与速射流主题相关，但不锁定于任何进阶方向。所有进阶都能用。

| # | Buff名称 | 稀有度 | 效果 | 阶段 | 实现类型 | 联动说明 |
|---|----------|--------|------|------|----------|----------|
| G1 | **急速连射** | Common | AttackSpeed +20%。速射流的面包黄油，拿多少都不嫌多。可叠 3 层（共 +60%） | 前期 | A类：`atkSpeed` MUL +0.2 | 弹幕流：更多箭/秒；爆发流：蓄力间隙更短；持续流：叠毒更快 |
| G2 | **箭矢轻量化** | Common | arrowSpeed +40%，弹道飞行更快，命中率实质提升 | 前期 | A类：`arrowSpeed` MUL +0.4 | 追踪箭拐弯更灵活；远距离箭不再被走位躲开 |
| G3 | **多重射击** | Rare | extraProjectiles +1。每次攻击多射 1 箭。可叠 3 层 | 中期 | B类：`extraProjectiles` ADD +1 | 弹幕流核心叠加物；爆发流多箭齐蓄也有收益 |
| G4 | **穿透射击** | Rare | pierceCount +2。箭矢穿过 2 个额外目标，每穿一次伤害 -20% | 中期 | B类：`pierceCount` ADD +2 | 持续流核心叠加物；弹幕+穿透=子弹地狱 |
| G5 | **命中回馈** | Epic | 每命中一个敌人，当前攻击冷却 -5%（同一次攻击的多次命中均计算）。多箭+穿透+弹射 → 几乎无冷却 | 中期 | C类：on-hit → `atkCooldown` 减少 | 弹幕流神器（5箭穿3个 = 15 hit = -75%冷却）|
| G6 | **战斗专注** | Rare | 连续命中不同敌人时，每命中 1 个不同敌人 ATK +3%（最多 +30%），3 秒未命中新敌人则重置 | 中期 | C类：命中记录 + `atk` MUL 动态叠加 | 弹幕/持续流天然多目标，轻松叠满；爆发流需要穿透才能吃到 |

---

### 3.3 全局通用Buff（8个，任何流派都能用）

> 基础面板强化 + 元素效果 + 生存。不跟任何流派绑定。

| # | Buff名称 | 稀有度 | 效果 | 阶段 | 实现类型 | 联动说明 |
|---|----------|--------|------|------|----------|----------|
| U1 | **锐利箭头** | Common | ATK +30%。简单直接的伤害底座 | 前期 | A类：`atk` MUL +0.3 | 乘算一切伤害来源 |
| U2 | **生命汲取** | Common | LifestealRate +8%。每次命中回血 | 前期 | A类：`lifestealRate` ADD +0.08 | 速射流高频命中 → 极高吸血频率 |
| U3 | **烈焰箭** | Rare | 命中施加"灼烧"：3秒内 ATK×60% 火焰DOT | 前期 | C类：on-hit → 对敌施加灼烧Buff | 速射叠灼烧；弹幕流群体着火；触发蒸发反应 |
| U4 | **寒冰箭** | Rare | 命中施加"冻伤"：减速30%持续2秒，叠3层冰冻1.5秒 | 前期 | C类：on-hit → 对敌施加冻伤Buff | 速射极速叠冻；控制价值高；触发蒸发反应 |
| U5 | **雷电箭** | Epic | 命中25%概率触发闪电链，对周围3敌各造成50% ATK伤害 | 中期 | C类：on-hit概率 → AOE伤害 | 速射触发频率高；弹幕流每箭都可能电 |
| U6 | **击退之力** | Common | 箭矢命中击退敌人（距离与伤害成正比） | 前期 | C类：on-hit → 敌人位移 | 速射 = 持续击退 = 敌人根本靠不过来 |
| U7 | **护盾箭** | Rare | 击杀敌人获得其 maxHp 5% 的临时护盾（上限自身 maxHp 30%，5秒衰减） | 中期 | C类：击杀事件 → 自身施加护盾Buff | 速射清小怪快 → 叠盾效率高 |
| U8 | **献祭射击** | Epic | 每次射击消耗当前HP 3%，但该箭伤害 +80%。濒死时更危险也更强 | 后期 | C类：射击事件 → 扣血 + `atk` 临时MUL | 配合吸血 = 可持续献祭；爆发流单发超高收益 |

---

## 四、联动矩阵

### 4.1 核心Buff × 通用Buff 组合效果

> 这些不是独立Buff，而是当两个Buff共存时自动生效的 **隐藏协同**。

| 组合 | 效果 | 强度评价 |
|------|------|----------|
| **弹幕射手** + **急速连射×3** | 解锁"弹幕狂潮"：攻速上限突破为 200%（原上限 150%） | ★★★★★ 超模 |
| **弹幕射手** + **烈焰箭** | "火力覆盖"：多箭同时点燃同一目标时，灼烧伤害叠加而非刷新 | ★★★★ |
| **蓄力引擎** + **锐利箭头** | "致命蓄力"：蓄力满层的箭若暴击，额外造成 ATK×100% 真实伤害（无视防御） | ★★★★★ 超模 |
| **蓄力引擎** + **献祭射击** | "以血为弓"：蓄力期间每秒额外消耗 5% HP，但每层蓄力伤害加成从 +50% 提升到 +80% | ★★★★ |
| **无限穿透** + **雷电箭** | "雷电走廊"：穿透路径上的每个敌人都独立触发闪电链（而非整箭只触发一次） | ★★★★★ 超模 |
| **连锁弹射** + **侵蚀箭** | "层层剥皮"：弹射命中的每个敌人都叠加一层防御削减，4次弹射 = -60% 防御 | ★★★★ |
| **命中回馈** + **多重射击×3** | "永动机"：5箭全命中 = -25% 冷却，穿透2目标 = -50% 冷却，实质无限射击 | ★★★★★ 超模 |
| **散弹箭** + **击退之力** | "霰弹枪"：近距离 3 箭同时命中的击退力叠加，小怪直接飞出屏幕 | ★★★ 有趣 |
| **瘟疫扩散** + **寒冰箭** | "冰疫"：毒素扩散时附带 1 层冻伤，链式扩散可能冰冻整群 | ★★★★ |

### 4.2 Buff × 技能联动

| Buff | 与"箭雨倾泻"的联动 | 与"闪身射击"的联动 | 与"自动速射"的联动 |
|------|---------------------|---------------------|---------------------|
| **弹幕射手** | 箭雨每支箭变成 3 支 → 36 支箭雨 | 闪身连射从 3 箭变 6 箭 | 自动射击也享受额外弹道 |
| **蓄力引擎** | 箭雨不消耗蓄力层（独立于普攻） | 闪身后立即射出消耗蓄力加成箭 | 自动射击不触发蓄力消耗（仅手动攻击消耗） |
| **急速连射** | 箭雨冷却 -15%（每层） | 闪身连射数 +1（每层） | 直接提升自动射击频率 |
| **烈焰箭** | 箭雨区域变成"火海"持续灼烧 | 闪身箭全部附火，逃跑路径变火墙 | 自动射击附火 = 全自动点燃 |
| **无限穿透** | 箭雨的箭落地后继续水平穿透 | 闪身箭穿透群敌 | 自动射击的箭穿透更多目标 |
| **无尽弹仓** | 箭雨中的箭也计入射击计数 | 闪身箭计入射击计数 | 自动射击计入 → 高频触发免费箭雨 |

---

## 五、进阶方向详细设计

### 5.1 弹幕流进阶

```
定位：密度制霸，以量取胜
标签：#多箭 #攻速 #覆盖 #on-hit频率

强：小怪清理、on-hit效果触发、持续AOE输出
弱：单体Boss效率低（单箭太弱）、高防怪克制、性能瓶颈

理想 Build 路线：
  前期  → 急速连射 + 多重射击 + 锐利箭头
  中期  → 弹幕射手(核心) + 命中回馈 + 烈焰箭
  后期  → 弹幕狂热(核心) + 无尽弹仓(核心) + 暴风雪(进化)
```

### 5.2 爆发流进阶

```
定位：一箭定乾坤
标签：#蓄力 #暴击 #单发 #Boss杀手

强：Boss战、精英怪、高防目标（单发穿防）
弱：被群怪包围时手忙脚乱、蓄力被打断风险

理想 Build 路线：
  前期  → 锐利箭头 + 急速连射（缩短蓄力间隙）
  中期  → 蓄力引擎(核心) + 暴击风暴(核心) + 处刑之箭(核心)
  后期  → 时间凝缩(核心) + 陨星箭(进化) + 献祭射击
```

### 5.3 持续流进阶

```
定位：一箭入魂，余波不断
标签：#穿透 #弹射 #DOT #追踪

强：密集敌群（一箭穿十个）、持久战（DOT叠加）、走位要求低（追踪命中）
弱：稀疏敌人分布时效率差、DOT面对回血怪无效

理想 Build 路线：
  前期  → 穿透射击 + 急速连射 + 生命汲取
  中期  → 无限穿透(核心) + 连锁弹射(核心) + 侵蚀箭(核心)
  后期  → 瘟疫扩散(核心) + 追猎本能(核心) + 雷神之怒(进化)
```

---

## 六、Buff 池管理：数据结构

> 与现有 `SkillDef` / `SkillSelector` / `BuffFactory` 对齐。

### 6.1 Buff分类标签

```typescript
enum EBuffTier {
    ArchetypeCore = 'archetype_core',
    ArchetypeGeneral = 'archetype_general',
    GlobalGeneral = 'global_general',
}

enum EArchetype {
    RapidFire = 'rapid_fire',
    Barrage = 'barrage',
    Burst = 'burst',
    Sustain = 'sustain',
}

interface BuffPoolEntry {
    buffId: number;
    name: string;
    tier: EBuffTier;
    archetype?: EArchetype;    // 仅 archetype_core 有值
    rarity: SkillRarity;
    maxStack: number;
    effectClass: string;
    description: string;
}
```

### 6.2 选择进阶时的池切换逻辑

```typescript
class ArchetypeManager {
    private _baseArchetype: EArchetype = EArchetype.RapidFire;
    private _advancedArchetype: EArchetype | null = null;

    selectAdvancedArchetype(archetype: EArchetype): void {
        this._advancedArchetype = archetype;
    }

    /**
     * 根据当前流派，过滤可用Buff池
     * 核心规则：
     *   1. 全局通用 → 始终可出现
     *   2. 流派通用 → 始终可出现
     *   3. 流派核心 → 仅已选进阶的核心Buff入池
     */
    filterBuffPool(allBuffs: BuffPoolEntry[]): BuffPoolEntry[] {
        return allBuffs.filter(b => {
            if (b.tier === EBuffTier.GlobalGeneral) return true;
            if (b.tier === EBuffTier.ArchetypeGeneral) return true;
            if (b.tier === EBuffTier.ArchetypeCore) {
                return b.archetype === this._advancedArchetype;
            }
            return false;
        });
    }
}
```

### 6.3 Buff 配置示例（JSON）

```json
[
    {
        "buffId": 2001,
        "name": "弹幕射手",
        "tier": "archetype_core",
        "archetype": "barrage",
        "rarity": 2,
        "maxStack": 1,
        "effectClass": "BarrageShotEffect",
        "description": "每次攻击额外+2支箭，单箭伤害-10%"
    },
    {
        "buffId": 2101,
        "name": "急速连射",
        "tier": "archetype_general",
        "rarity": 0,
        "maxStack": 3,
        "effectClass": "RapidFireEffect",
        "description": "攻速+20%，可叠加"
    },
    {
        "buffId": 2201,
        "name": "锐利箭头",
        "tier": "global_general",
        "rarity": 0,
        "maxStack": 3,
        "effectClass": "SharpArrowEffect",
        "description": "ATK+30%"
    }
]
```

### 6.4 Buff ID 段分配

| 段 | 范围 | 用途 |
|----|------|------|
| 2000-2099 | 弹幕流核心 | C1-C5 |
| 2100-2199 | 速射流流派通用 | G1-G6 |
| 2200-2299 | 全局通用 | U1-U8 |
| 2300-2399 | 爆发流核心 | C6-C10 |
| 2400-2499 | 持续流核心 | C11-C15 |
| 2500-2599 | 进化Buff | 暴风雪/陨星箭/雷神之怒 |

---

## 七、进化检测系统

```typescript
interface EvolutionRecipe {
    id: string;
    name: string;
    requires: number[];      // 需要同时拥有的 buffId 列表
    result: number;          // 进化产物 buffId
    consumeInputs: boolean;  // 是否消耗输入Buff（true=替换，false=保留原Buff+额外获得）
}

const EVOLUTION_RECIPES: EvolutionRecipe[] = [
    {
        id: 'blizzard',
        name: '暴风雪',
        requires: [2001, 2204],   // 弹幕射手 + 寒冰箭
        result: 2500,
        consumeInputs: true,
    },
    {
        id: 'meteor_arrow',
        name: '陨星箭',
        requires: [2300, 2203],   // 蓄力引擎 + 烈焰箭
        result: 2501,
        consumeInputs: true,
    },
    {
        id: 'thunder_wrath',
        name: '雷神之怒',
        requires: [2401, 2205],   // 连锁弹射 + 雷电箭
        result: 2502,
        consumeInputs: true,
    },
];
```

在 `SkillManager.applySkill()` 末尾加入进化检测：

```typescript
applySkill(skillId: string, entity: Entity, buffMgr: EntityBuffMgr): void {
    // ... 原有添加Buff逻辑 ...

    // 进化检测：每次获得新Buff后遍历配方
    for (const recipe of EVOLUTION_RECIPES) {
        const hasAll = recipe.requires.every(id => buffMgr.hasBuff(id));
        if (hasAll && !buffMgr.hasBuff(recipe.result)) {
            if (recipe.consumeInputs) {
                recipe.requires.forEach(id => buffMgr.removeBuff(id));
            }
            const evolved = this._loadBuffData(recipe.result);
            buffMgr.addBuff(evolved);
            // TODO: 播放进化特效 + 通知UI
        }
    }
}
```

---

## 八、已实现 Buff 清单（JSON/Excel 已就绪）

> 配置文件：`config/upgradeConfig/upgrades.json` + `config/excel/upgrades.xlsx`
> 进化配置：`config/upgradeConfig/evolutions.json`（当前为空，buff 组合暂不实现）

### 8.1 Tier 1（前期，9 个）

| 升级 ID | Buff ID | 名称 | 稀有度 | 效果 | 脚本 | targetAttr |
|---------|---------|------|--------|------|------|-----------|
| `rapid-fire` | 2101 | 急速连射 | Common | 攻速+20% | `SimpleAttrBuffEffect` | `AttackSpeed-Mul-Buff` |
| `arrow-speed` | 2102 | 箭矢轻量化 | Common | 箭速+40% | `SimpleAttrBuffEffect` | `ArrowSpeed-Mul-Buff` |
| `sharp-arrow` | 2201 | 锐利箭头 | Common | 攻击+30% | `SimpleAttrBuffEffect` | `Attack-Mul-Buff` |
| `lifesteal` | 2202 | 生命汲取 | Common | 吸血率+8% | `SimpleAttrBuffEffect` | `LifestealRate-Value-Buff` |
| `knockback` | — | 击退之力 | Common | 命中击退敌人 | `KnockbackEffect` | —（hit_effect） |
| `fire-arrow` | — | 烈焰箭 | Rare | 灼烧DOT(ATK×20%/3s) | `BurnOnHitEffect` | —（hit_effect） |
| `frost-arrow` | — | 寒冰箭 | Rare | 减速30%/2s，叠3层冰冻 | `FrostOnHitEffect` | —（hit_effect） |
| `crit-instinct` | 2601 | 暴击直觉 | Common | 暴击率+10% | `SimpleAttrBuffEffect` | `CritRate-Value-Buff` |
| `swift-step` | 2602 | 疾风步 | Common | 移速+20% | `SimpleAttrBuffEffect` | `MoveSpeed-Mul-Buff` |

### 8.2 Tier 2（中期，9 个）

| 升级 ID | Buff ID | 名称 | 稀有度 | 效果 | 脚本 | targetAttr |
|---------|---------|------|--------|------|------|-----------|
| `multi-shot` | 2103 | 多重射击 | Rare | 额外弹道+1 | `SimpleAttrBuffEffect` | `ExtraProjectiles-Value-Buff` |
| `pierce-shot` | 2104 | 穿透射击 | Rare | 穿透+2 | `SimpleAttrBuffEffect` | `PierceCount-Value-Buff` |
| `lightning-arrow` | — | 雷电箭 | Epic | 100%闪电链(3跳) | `ChainLightningEffect` | —（hit_effect） |
| `barrage-shot` | 2001 | 弹幕射手 | Epic | 额外弹道+2 | `SimpleAttrBuffEffect` | `ExtraProjectiles-Value-Buff` |
| `spread-mode` | 2002 | 扫射模式 | Rare | 扇形角度+45° | `SimpleAttrBuffEffect` | `SpreadAngle-Value-Buff` |
| `chain-bounce` | 2401 | 连锁弹射 | Epic | 弹射+4次 | `SimpleAttrBuffEffect` | `BounceCount-Value-Buff` |
| `long-range` | 2603 | 远程瞄准 | Common | 射程+50% | `SimpleAttrBuffEffect` | `AttackRange-Mul-Buff` |
| `rapid-fire-2` | 2111 | 急速连射 II | Rare | 攻速+30% | `SimpleAttrBuffEffect` | `AttackSpeed-Mul-Buff` |
| `sharp-arrow-2` | 2211 | 锐利箭头 II | Rare | 攻击+50% | `SimpleAttrBuffEffect` | `Attack-Mul-Buff` |

### 8.3 Tier 3（后期，9 个）

| 升级 ID | Buff ID | 名称 | 稀有度 | 效果 | 脚本 | targetAttr |
|---------|---------|------|--------|------|------|-----------|
| `infinite-pierce` | 2400 | 无限穿透 | Epic | 穿透+5(不衰减) | `SimpleAttrBuffEffect` | `PierceCount-Value-Buff` |
| `homing-instinct` | 2404 | 追猎本能 | Epic | 强追踪(×3) | `SimpleAttrBuffEffect` | `HomingStrength-Value-Buff` |
| `barrage-shot-2` | 2011 | 弹幕射手 II | Epic | 额外弹道+3 | `SimpleAttrBuffEffect` | `ExtraProjectiles-Value-Buff` |
| `chain-bounce-2` | 2411 | 连锁弹射 II | Epic | 弹射+6次 | `SimpleAttrBuffEffect` | `BounceCount-Value-Buff` |
| `crit-storm` | 2302+2312 | 暴击风暴 | Epic | 暴击率+25%，暴击伤害+50% | `SimpleAttrBuffEffect` ×2 | `CritRate/CritDmg-Value-Buff` |
| `executioner` | 2303 | 处刑之箭 | Legendary | 攻击+80% | `SimpleAttrBuffEffect` | `Attack-Mul-Buff` |
| `rapid-fire-3` | 2121 | 急速连射 III | Epic | 攻速+50% | `SimpleAttrBuffEffect` | `AttackSpeed-Mul-Buff` |
| `sharp-arrow-3` | 2221 | 锐利箭头 III | Epic | 攻击+80% | `SimpleAttrBuffEffect` | `Attack-Mul-Buff` |
| `lifesteal-2` | 2212 | 生命汲取 II | Rare | 吸血率+15% | `SimpleAttrBuffEffect` | `LifestealRate-Value-Buff` |

### 8.4 Buff ID 段分配（已用 + 规划）

| 段 | 范围 | 用途 | 状态 |
|----|------|------|------|
| 2000-2099 | 弹幕流核心 | C1-C5（弹幕射手等） | ✅ 2001,2002,2011 已配置 |
| 2100-2199 | 速射流通用 | G1-G6（急速连射等） | ✅ 2101-2104,2111,2121 已配置 |
| 2200-2299 | 全局通用 | U1-U8（锐利箭头等） | ✅ 2201,2202,2211,2212,2221 已配置 |
| 2300-2399 | 爆发流核心 | C6-C10（蓄力引擎等） | ✅ 2302,2303,2312 已配置 |
| 2400-2499 | 持续流核心 | C11-C15（无限穿透等） | ✅ 2400,2401,2404,2411 已配置 |
| 2500-2599 | 进化 Buff | 暴风雪/陨星箭/雷神之怒 | ⏳ 待实现 |
| 2600-2699 | 补充通用 | 暴击直觉/疾风步/远程瞄准 | ✅ 2601,2602,2603 已配置 |

### 8.5 未实现的设计 Buff（需新脚本）

| 设计ID | 名称 | 需要的新机制 | 优先级 |
|--------|------|-------------|--------|
| 2003 | 弹幕狂热 | 连射计时器 + 动态攻速叠加 | P3 |
| 2004 | 散弹箭 | 新弹道类型 shotgun | P4 |
| 2005 | 无尽弹仓 | 射击计数器 + 技能调用 | P4 |
| 2105 | 命中回馈 | on-hit 冷却回复 | P3 |
| 2106 | 战斗专注 | 命中不同敌人记录 + 动态 ATK | P3 |
| 2207 | 护盾箭 | 击杀事件 → 护盾 Buff | P4 |
| 2208 | 献祭射击 | 射击事件 → 扣血 + 临时伤害加成 | P4 |
| 2300 | 蓄力引擎 | 全新蓄力系统 | P5 |
| 2301 | 满弦一射 | 蓄力 + 弹道参数联动 | P5 |
| 2304 | 时间凝缩 | 全局时间缩放 | P6 |
| 2402 | 瘟疫扩散 | 敌人死亡事件 + Buff 复制 | P5 |
| 2403 | 侵蚀箭 | 命中施加防御削减（需 DefReduceOnHitEffect） | P3 |

---

## 九、测试面板（BattleTestPanel）

### 当前测试流程

```
┌─────────────────────────────────┐
│ HP:500/1000  ATK:100  SPD:1.0   │  ← 实时属性
│ 箭:1  穿:0  弹:0                │
├─────────────────────────────────┤
│ --- 主动技能 ---                 │
│ 箭雨倾泻  CD:12  [装备] [释放]   │
│ 闪身射击  CD:6   [装备] [释放]   │
├─────────────────────────────────┤
│ --- 进化选择 ---                 │
│ 第1层 (0/6)  剩余:9             │
│ ┌ 急速连射     攻速+20%   [选择]│
│ ├ 锐利箭头     攻击+30%   [选择]│
│ └ 击退之力     命中击退   [选择]│
│ [🔄 刷新选择]                    │
├─────────────────────────────────┤
│ --- 已选升级 ---                 │
│ 1. 急速连射 (攻速+20%)          │
│ 2. 烈焰箭 (灼烧DOT)            │
│ ...                             │
├─────────────────────────────────┤
│ [敌人满血] [玩家满血] [重置全部] │
└─────────────────────────────────┘
```

### 选择规则

| 规则 | 说明 |
|------|------|
| 每层选择 | 从当前层池中随机3个，玩家选1个 |
| 层推进 | 选满6个 → 自动进入下一层 |
| 总层数 | 3层 × 6选 = 18个升级 |
| 刷新 | 点击刷新重新随机3个（不消耗次数） |
| 重置 | "重置全部" 移除所有已选升级，回到第1层 |
| 稀有度颜色 | Common白/Rare蓝/Epic紫/Legendary金 |

---

## 十、文件清单与脚本映射

### 配置文件

| 文件 | 路径 | 说明 |
|------|------|------|
| `upgrades.json` | `game/config/upgradeConfig/` | 27个升级配置 (9/tier × 3 tiers) |
| `evolutions.json` | `game/config/upgradeConfig/` | 进化配置（当前为空） |
| `upgrades.xlsx` | `config/excel/` | Excel 版配置（与 JSON 双向同步） |
| `player.json` | `game/player/config/` | 玩家属性定义 |

### Buff 效果脚本

| 脚本 | 路径 | 用途 |
|------|------|------|
| `SimpleAttrBuffEffect` | `game/skill/effects/` | A/B 类属性 Buff（占 80%+ 配置） |
| `BurnDotEffect` | `game/skill/effects/` | 灼烧 DOT Buff |
| `FrostSlowEffect` | `game/skill/effects/` | 冻伤减速 Buff |
| `AttackBoostEffect` | `game/skill/effects/` | 攻击提升 Buff |
| `CritBoostEffect` | `game/skill/effects/` | 暴击提升 Buff |
| `DefenseReduceEffect` | `game/skill/effects/` | 防御削减 Buff |
| `LifestealEffect` | `game/skill/effects/` | 吸血率 Buff |
| `RegenEffect` | `game/skill/effects/` | 回血 Buff |

### 命中效果脚本

| 脚本 | 路径 | 用途 |
|------|------|------|
| `DamageHitEffect` | `game/hitEffects/` | 基础伤害计算 |
| `BurnOnHitEffect` | `game/hitEffects/` | 命中施加灼烧 |
| `FrostOnHitEffect` | `game/hitEffects/` | 命中施加冻伤 |
| `ChainLightningEffect` | `game/hitEffects/` | 闪电链 AOE |
| `KnockbackEffect` | `game/hitEffects/` | 命中击退 |
| `LifestealHitEffect` | `game/hitEffects/` | 命中吸血 |
| `CritBonusDamageEffect` | `game/hitEffects/` | 暴击额外伤害 |
| `LifeOnHitEffect` | `game/hitEffects/` | 命中回血 |

### 系统脚本

| 脚本 | 路径 | 用途 |
|------|------|------|
| `UpgradeManager` | `game/upgrade/` | 升级应用/移除/进化检测 |
| `UpgradeValidator` | `game/upgrade/` | JSON 配置校验 |
| `upgradeConfigs` | `game/upgrade/` | 加载并导出 ALL_UPGRADES |
| `upgrade-excel.js` | `tools/auto/` | JSON ↔ Excel 双向转换工具 |
| `BattleTestPanel` | `game/test/` | 肉鸽选择 UI + 技能测试 |

---

## 十一、实现优先级

| 阶段 | 内容 | 状态 |
|------|------|------|
| **P0** | AttackSpeed 接入射击冷却 + SkillSystem 基础框架 | ✅ 已完成 |
| **P1** | A 类 Buff（属性：锐利箭头、急速连射、吸血等） | ✅ 已完成 |
| **P1.5** | JSON/Excel 数据驱动配置 + 肉鸽测试面板 | ✅ 已完成 |
| **P2** | B 类 Buff：多重射击 + 穿透 + 弹射（弹道系统） | ✅ 已完成 |
| **P2.5** | 元素命中效果：灼烧 + 冻伤 + 闪电链 + 击退 | ✅ 已完成 |
| **P3** | C 类触发 Buff：命中回馈 + 战斗专注 + 侵蚀箭 | ⏳ 待实现 |
| **P4** | 弹幕流专属：散弹箭 + 弹幕狂热 + 无尽弹仓 | ⏳ 待实现 |
| **P5** | 爆发流蓄力系统 + 持续流瘟疫扩散 | ⏳ 待实现 |
| **P6** | ArchetypeManager + 进阶选择 + 进化系统 | ⏳ 待实现 |
| **P7** | 主动技能 Buff 联动（箭雨×弹幕、闪身×寒冰等） | ⏳ 待实现 |
