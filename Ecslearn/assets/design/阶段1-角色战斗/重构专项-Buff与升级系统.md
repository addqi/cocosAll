# 重构专项 - Buff 与升级系统

> 目标：把当前 `Buff / HitEffect / Upgrade` 三套系统的职责切干净，让它们可以稳定支撑多职业、主动技能、进化组合和后续策划配表。
>
> 当前约束：
> - 运行时只读 JSON
> - Excel 不接运行时
> - 允许程序直接改 JSON 快速验证

---

## 一、核心问题

当前项目最大的问题不是“没有系统”，而是**系统之间边界不干净**。

### 1. Buff 系统里有重复脚本

当前很多 BuffEffect 只是换了字段名或空壳继承：

- `SimpleAttrBuffEffect`
- `AddHpBuffEffect`
- `FrostSlowEffect`
- `AttackBoostEffect`
- `CritBoostEffect`
- `DefenseReduceEffect`
- `LifestealEffect`

这些东西本质上大多都是：

**对某个属性做加减乘。**

### 2. 命中效果里有重复脚本

比如灼烧、冻伤、中毒这类效果，本质都是：

1. 命中
2. 构造一个 `BuffData`
3. 挂到目标身上

如果每来一个 debuff 都写一个 TS 文件，项目会越来越脏。

### 3. 升级系统理解了太多具体实现

当前升级系统不只是“分发效果”，还理解：

- `shoot_policy`
- 具体 effect type
- 某些职业私货

这是耦合源头。

### 4. `game/entity/` 目录名错误

当前和 Buff / 命中效果 / 升级强相关的运行时服务放在：

- `EntityBuffMgr`
- `HitEffectMgr`
- `AttributeChangeResolver`
- `EntityPropertyMgr`

它们本质上不是“实体”，而是**战斗运行时服务层**。

如果继续沿着 `entity/` 这个名字堆逻辑，后面目录只会越来越误导。

### 5. 配置层还不够纯

当前 `config/` 与 `game/config/` 双根并存，而且部分纯数据入口反向依赖 `game` 实现类型。

这意味着：

- 配置层不纯
- 后续 `buffs.json` / `hitEffects.json` / `upgrades.json` / `skills.json` 会越来越乱
- 程序与策划分离会被这种反向依赖拖垮

---

## 二、正确的职责边界

### Buff 负责什么

- 持续时间
- 叠层
- 属性修改
- 周期行为
- 生命周期钩子

### HitEffect 负责什么

- 命中当下追加的行为
- 给目标挂 Buff
- 附加伤害
- 击退 / 拉扯
- 命中点生成其他效果

### Upgrade 负责什么

- 读取升级定义
- 把 effect 分发给对应系统
- 移除 effect
- 检查进化配方

### Upgrade 不该负责什么

- 不该直接创建职业私有对象
- 不该直接理解弓箭手实现
- 不该变成技能执行器

### 战斗运行时服务层负责什么

- Buff 运行时管理
- 命中效果运行时管理
- 属性变化应用
- 为升级 / 技能 / 命中效果提供公共运行时服务

这层逻辑上应视为 `combat/runtime`，只是当前物理目录还没迁过去。

---

## 三、Buff 系统重构目标

## 目标 1：把大量重复 BuffEffect 压缩成少量原语

建议保留下面 3 个基础脚本作为第一阶段核心：

### 1. `AttrModifierEffect`

负责：

- 加攻击
- 加攻速
- 减防御
- 减移速
- 加暴击
- 加吸血

也就是绝大多数普通 buff / debuff。

建议支持两种配置格式：

```json
{
  "effectClass": "AttrModifierEffect",
  "targetAttr": "Attack-Mul-Buff",
  "valuePerStack": 0.2
}
```

以及：

```json
{
  "effectClass": "AttrModifierEffect",
  "changes": [
    { "attrId": "Attack-Mul-Buff", "type": "ADD", "valuePerStack": 0.2 },
    { "attrId": "CritRate-Value-Buff", "type": "ADD", "valuePerStack": 0.1 }
  ]
}
```

第二种格式可以支持一个 buff 同时改多个属性。

### 2. `PeriodicDamageEffect`

负责：

- 灼烧
- 中毒
- 流血
- 感电持续伤害

核心输入只是：

- `damagePerStack`
- `tickInterval`
- `stackDecayOnTick`

### 3. `PeriodicHealEffect`

负责：

- 再生
- 每秒回血
- 按最大生命百分比回血

建议支持：

- `healPerStack`
- `healPercent`

---

## 四、Buff 第二阶段预留原语

第一阶段别贪多。等前 3 个稳定后，再加：

### 4. `ShieldEffect`

职责：

- 吸收伤害
- 维护剩余护盾值
- 护盾破碎时清理状态

### 5. `StateControlEffect`

职责：

- 眩晕
- 冰冻
- 沉默
- 定身

这种效果不是单纯改属性，通常要和行为/FSM 协作。

### 6. `StackTriggerEffect`

职责：

- 满层触发额外事件
- 例如“点燃 5 层爆炸”“感电 3 层麻痹”

### 7. `AuraEmitterEffect`

职责：

- 周期扫描周围单位
- 给附近目标上 Buff

---

## 五、HitEffect 系统重构目标

## 目标 2：把“命中后给 Buff”统一成一个通用类

建议增加：

### `ApplyBuffOnHitEffect`

职责：

- 命中后读取 JSON
- 构造 `BuffData`
- `ctx.targetBuffMgr.addBuff(...)`

它应该覆盖：

- 灼烧
- 中毒
- 流血
- 减速
- 易伤
- 破甲

如果某个效果只是“命中时挂一个 Buff”，那就不该再新建独立脚本。

### 配置示意

```json
{
  "id": "burn-on-hit",
  "effectClass": "ApplyBuffOnHitEffect",
  "scaleWithBaseDamage": 0.2,
  "buff": {
    "id": 8001,
    "name": "灼烧",
    "duration": 5,
    "maxStack": 99,
    "tickInterval": 0.1,
    "effectClass": "PeriodicDamageEffect"
  }
}
```

### 仍然保留独立脚本的效果

这些别瞎抽象：

- `DamageHitEffect`
- `ChainLightningEffect`
- `KnockbackEffect`
- 未来的 `SpawnAreaOnHitEffect`
- 未来的 `SpawnProjectileOnHitEffect`

因为这些效果有真正的行为差异，不只是换参数。

---

## 六、Upgrade 系统重构目标

## 目标 3：让 UpgradeManager 只做分发，不做业务

正确方向是：

```text
UpgradeManager
    ↓
UpgradeEffectRegistry
    ↓
handler(effect, ctx)
```

而不是：

```text
UpgradeManager
    ├─ if buff
    ├─ if hit_effect
    ├─ if shoot_policy
    ├─ if active_skill
    └─ if ...
```

### 第一阶段最少注册的 handler

- `buff`
- `hit_effect`
- `grant_skill`
- `modify_skill`
- `behavior_command`

### 各 handler 的职责

#### `buff`

- `buffMgr.addBuff`
- `buffMgr.removeBuff`

#### `hit_effect`

- `hitEffectMgr.add`
- `hitEffectMgr.remove`

#### `grant_skill`

- 给 `SkillSystem` 装备技能

#### `modify_skill`

- 修改已有技能的等级或参数补丁

#### `behavior_command`

- 调职业 `behavior` 的命令接口
- 例如切换 `shoot_policy`
- 这就把弓箭手私货移出通用升级系统了

---

## 七、升级配置建议拆分

当前把所有东西堆在 `upgrades.json` 里还能跑，但扩展后会越来越乱。

建议最终拆成：

- `upgrades.json`
- `evolutions.json`
- `buffs.json`
- `hitEffects.json`
- `skills.json`
- `payloads.json`（后续）

### 升级配置只保留“引用关系”

不要每条升级都内联一大坨重复 Buff 数据。推荐后续改成：

```json
{
  "id": "rapid-fire",
  "name": "急速连射",
  "classTag": "all",
  "effects": [
    { "type": "buff", "ref": "buff.attack_speed_20" }
  ]
}
```

以及：

```json
{
  "id": "fire-arrow",
  "name": "烈焰箭",
  "classTag": "archer",
  "effects": [
    { "type": "hit_effect", "ref": "hit.burn_on_hit" }
  ]
}
```

这样有三个好处：

1. 复用定义，减少重复
2. 统一调数值，不用全局搜
3. 程序和策划对数据边界更清楚

短期为了降低改动风险，也可以先保留内联格式，但要把目标文档写清楚，别让垃圾结构永久化。

---

## 八、建议的分步实施

## Step 1：先重构 Buff 原语

做的事：

- 新增 `AttrModifierEffect`
- 新增 `PeriodicDamageEffect`
- 新增 `PeriodicHealEffect`
- 保留旧脚本兼容

不要做的事：

- 不要立刻删所有旧脚本
- 不要一次性改全部配置

验收：

- 旧功能不坏
- 新 Buff 可以直接走新原语

## Step 2：新增 `ApplyBuffOnHitEffect`

做的事：

- 把灼烧、冻伤、中毒这类效果收口
- 命中挂 Buff 全走一个 effectClass

验收：

- 新 debuff 只写 JSON

## Step 3：建立 `UpgradeEffectRegistry`

做的事：

- `UpgradeManager` 改为 registry 分发
- `buff` / `hit_effect` 先接入

验收：

- `UpgradeManager` 不再写死具体业务

## Step 3.5：收口 `game/entity/` 目录语义

做的事：

- 明确 `EntityBuffMgr` / `HitEffectMgr` / `AttributeChangeResolver` 属于战斗运行时服务
- 后续文档、代码、命名统一按 `combat/runtime` 语义理解
- 如果短期不迁文件，至少通过 re-export 和注释把边界写清楚

验收：

- 团队内不会再把 `entity/` 当成领域对象目录继续加业务类

## Step 4：把职业私货移出升级系统

做的事：

- `shoot_policy` 改成 `behavior_command`
- 由 `ArcherBehavior` 注册自己的处理器

验收：

- 升级系统不依赖 `IShootPolicy`

## Step 5：引入 `grant_skill / modify_skill`

做的事：

- 升级系统可以授予技能
- 升级系统可以强化技能

验收：

- 主动技能获取不再靠硬编码

## Step 6：后续再拆定义文件

做的事：

- `buffs.json`
- `hitEffects.json`
- `skills.json`

验收：

- 复用定义，不再全是内联数据

## Step 6.5：统一配置入口

做的事：

- 逐步合并 `config/` 与 `game/config/`
- 抽纯类型定义
- 禁止配置层反向依赖玩法实现层

验收：

- 配置层只依赖纯数据和纯类型
- 运行时只认单根配置入口

---

## 九、哪些东西现在不要做

### 1. 不要接 Excel 运行时

这是纯粹的麻烦制造机。当前只读 JSON 是正确决定。

### 2. 不要做万能表达式引擎

什么：

- `formula: "baseDamage * 0.2 + stack"`
- `condition: "isCrit && hp < 0.3"`

这种东西短期看起来灵活，长期就是灾难。

### 3. 不要把所有效果都 JSON 化

复杂行为仍然应该保留独立脚本：

- 连锁闪电
- 击退
- 爆炸生成
- 召唤
- 护盾吸收

正确方式是：

**少量原语脚本 + 大量普通配置**

不是：

**一个万能脚本 + 一堆难以维护的表达式**

---

## 十、验收标准

完成这轮重构后，应该达到：

| 操作 | 是否需要改核心代码 |
|------|------------------|
| 新增普通属性 Buff | 不需要 |
| 新增 DOT/HoT Buff | 不需要 |
| 新增命中挂 debuff | 不需要 |
| 新增一个升级授予 Buff | 不需要 |
| 新增一个升级授予命中效果 | 不需要 |
| 新增一个升级授予技能 | 不需要 |
| 战斗运行时服务目录语义 | 清晰，不再误导 |
| 新增一个职业私有行为升级 | 不需要改 `UpgradeManager` |

如果做完以后，新增一个中毒效果还要再写 1 个新脚本，那说明这次重构做得还不够。

---

## 十一、结论

Buff、命中效果、升级系统三者的正确关系应该是：

```text
升级负责分发
命中效果负责瞬时追加行为
Buff 负责持续状态
```

把这三层切干净，后面的技能、职业、进化、元素体系才有地基。

不然你每加一个新效果，都会在三个系统里各打一块补丁，最后项目会烂成一锅粥。
