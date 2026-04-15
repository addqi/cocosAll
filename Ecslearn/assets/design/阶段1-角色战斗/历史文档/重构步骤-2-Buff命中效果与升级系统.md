# 重构步骤 2 - Buff、命中效果与升级系统

> 目标：把 `Buff / HitEffect / Upgrade` 三套系统的职责切干净，并把大量重复效果收敛成少量行为原语。
>
> 当前约束：
> - 运行时只读 JSON
> - Excel 不接运行时
> - 先保证现有战斗功能不坏，再逐步消灭重复脚本和硬编码分发

---

## 一、这一步到底在解决什么问题

当前项目在这一层有三个明显脏点：

1. 很多 BuffEffect 只是换字段名或空壳继承
2. 很多命中效果只是“命中后挂 Buff”，却一个效果一个 TS 文件
3. `UpgradeManager` 还在理解具体业务，并写死 effect 分支

这三件事不解决，后续职业、技能、进化都会不停往里打补丁。

所以第二阶段的任务非常明确：

**把“持续状态”“命中副作用”“升级分发”三层彻底切开。**

---

## 二、阶段目标

完成本大步骤后，项目应该满足：

1. 常规属性 Buff 统一走少量基础脚本
2. 常规 debuff / DOT 统一走少量基础脚本
3. 命中挂 Buff 的效果不再一类一个脚本
4. `UpgradeManager` 只负责分发，不再直接理解职业私货
5. 新增普通 Buff / debuff / 升级效果，优先只改 JSON
6. `game/entity/` 这层语义被收口为“战斗运行时服务”，不再继续长歪
7. 配置目录朝单根纯数据结构演进，不再让配置层反向依赖玩法实现

---

## 三、总实施顺序

本大步骤拆成 9 个小步骤：

1. 先冻结职责边界
2. 再收口 combat runtime 服务目录
3. 再归并 Buff 原语
4. 再归并命中挂 Buff 原语
5. 再建立升级效果注册表
6. 再移除升级系统里的职业私货
7. 再统一 JSON 组织方式
8. 再统一配置目录与纯数据类型
9. 最后做全链路回归和验收

注意顺序不能反。  
先改 `UpgradeManager` 而不先收拢效果原语，只会把垃圾逻辑换个壳继续存在。

---

## 四、Step 2.1 - 冻结职责边界

### 目标

先统一口径，明确谁负责什么。

### 明确规则

- `Buff`：持续状态
- `HitEffect`：命中当下追加行为
- `Upgrade`：读配置并分发 effect

### 这一步不写复杂代码，只统一设计原则

判断规则如下：

#### 走 `Buff`

- 持续时间
- 叠层
- 周期扣血 / 回血
- 属性加减乘

#### 走 `HitEffect`

- 命中触发额外伤害
- 命中给目标挂状态
- 击退 / 拉扯
- 命中点爆炸 / 衍生效果

#### 走 `Upgrade`

- 三选一获取长期收益
- 装备技能
- 给当前构筑添加命中副作用
- 给职业行为发命令

### 完成定义

- 后续所有效果设计都能归到这三层之一
- 不再出现“技能升级 = 特殊 Buff = 半命中效果”的混乱说法

### 验证手段

- 审核现有效果列表，逐个分类
- 不能归类的项，说明设计还不够清晰

### 测试用例

#### 用例 1：灼烧归类

- 结论：命中时通过 `HitEffect` 挂 `PeriodicDamage` Buff

#### 用例 2：攻速提升归类

- 结论：直接走 `Buff`

#### 用例 3：击退归类

- 结论：走 `HitEffect`，不走 `Buff`

---

## 五、Step 2.2 - 收口 combat runtime 服务目录

### 目标

把当前命名错误、职责发散的 `game/entity/` 收口为明确的战斗运行时服务层。

### 当前脏点

现在这层放着：

- `EntityBuffMgr`
- `HitEffectMgr`
- `EntityPropertyMgr`
- `AttributeChangeResolver`

这些东西本质上都不是“实体”，而是：

**战斗运行时服务。**

### 正确做法

逻辑上把它们视为：

- `combat/runtime/EntityBuffMgr`
- `combat/runtime/HitEffectMgr`
- `combat/runtime/AttributeChangeResolver`
- `combat/runtime/EntityPropertyMgr`

短期可以先不急着物理迁移文件，但必须先完成：

1. 命名统一
2. 文档统一
3. import 方向统一

### 设计要求

- 后续不再往 `entity/` 里塞新的业务逻辑
- Buff / Hit / Upgrade / Skill 只把它当作战斗运行时服务层
- 后续迁目录时优先通过 re-export 兼容旧路径

### 完成定义

- 项目内部已经明确：`entity/` 不是领域对象层，而是 combat runtime
- 后续目录迁移不会改一半停一半

### 验证手段

- 全局列出 `game/entity/*` 的引用点
- 检查新增文档和后续新代码是否继续把这层当“战斗运行时服务”使用

### 测试用例

#### 用例 1：Buff 运行时服务引用正常

- 场景：Buff 系统继续通过该层管理运行时实例
- 预期：逻辑不变，语义更清楚

#### 用例 2：HitEffect 运行时服务引用正常

- 场景：命中效果继续通过该层执行和管理
- 预期：逻辑不变，目录语义更准确

---

## 六、Step 2.3 - 归并 Buff 原语脚本

### 目标

把大量重复 BuffEffect 压缩成少量基础原语。

### 第一阶段建议保留的 3 个核心原语

#### 1. `AttrModifierEffect`

负责：

- 攻击提升
- 攻速提升
- 暴击提升
- 移速提升 / 降低
- 防御削减
- 吸血增加

#### 2. `PeriodicDamageEffect`

负责：

- 灼烧
- 中毒
- 流血
- 感电持续伤害

#### 3. `PeriodicHealEffect`

负责：

- 再生
- 固定值回血
- 最大生命百分比回血

### 应被逐步淘汰的重复脚本

- `AddHpBuffEffect` 的简单属性修改部分
- `FrostSlowEffect` 这类硬编码属性减益
- `AttackBoostEffect`
- `CritBoostEffect`
- `DefenseReduceEffect`
- `LifestealEffect`

### 设计要求

`AttrModifierEffect` 至少要支持：

- 单属性写法
- 多属性数组写法
- `ADD / MUL / OVERRIDE / CLAMP`

### 完成定义

- 绝大多数普通 buff / debuff 都可以只用一个 effectClass + JSON 配出来

### 验证手段

- 用 3-5 个现有效果迁移到新原语验证
- 对比迁移前后属性结果是否一致

### 测试用例

#### 用例 1：攻击提升 Buff

- 输入：`Attack-Mul-Buff +0.2`
- 预期：最终攻击提升 20%

#### 用例 2：减速 Debuff

- 输入：`MoveSpeed-Mul-Buff -0.3`
- 预期：目标移速下降 30%

#### 用例 3：双属性 Buff

- 输入：同时增加攻击和暴击率
- 预期：两个属性都正确生效

#### 用例 4：DOT Buff

- 输入：每秒 10 点伤害，3 秒
- 预期：总共触发 3 次 tick，正确扣血

#### 用例 5：HOT Buff

- 输入：每秒回复 5% 最大生命
- 预期：按最大生命计算回血，不是当前生命

---

## 七、Step 2.4 - 归并“命中挂 Buff”效果

### 目标

把灼烧 / 冻伤 / 中毒 / 破甲这类效果收敛成一个通用命中效果。

### 建议新增原语

- `ApplyBuffOnHitEffect`

### 这个原语负责什么

1. 读取命中效果 JSON
2. 组装 `BuffData`
3. 挂到目标 `buffMgr`

### 应被逐步收口的效果

- `BurnOnHitEffect`
- `FrostOnHitEffect`
- 未来的 `PoisonOnHitEffect`
- 未来的 `BleedOnHitEffect`

### 不要强行收口的效果

这些保留独立脚本：

- `DamageHitEffect`
- `ChainLightningEffect`
- `KnockbackEffect`
- 未来 `SpawnAreaOnHitEffect`
- 未来 `SpawnProjectileOnHitEffect`

### 设计要求

`ApplyBuffOnHitEffect` 需要支持：

- 静态 Buff 参数
- 可选的运行时缩放参数，比如 `scaleWithBaseDamage`

### 完成定义

- 新增常规 debuff 效果只改 JSON
- 不再为每个 debuff 新建一个 TS 文件

### 验证手段

- 用灼烧和冻伤两种模式验证
- 一种带运行时伤害缩放，一种纯静态参数

### 测试用例

#### 用例 1：灼烧迁移

- 操作：命中后施加 DOT
- 预期：buff 正常叠层，tick 正常扣血

#### 用例 2：冻伤迁移

- 操作：命中后施加减速
- 预期：目标移速下降，层数与时长正确

#### 用例 3：中毒新增

- 操作：只增加 1 条 JSON，不写新脚本
- 预期：命中后正常上毒并持续掉血

---

## 八、Step 2.5 - 建立 `UpgradeEffectRegistry`

### 目标

让升级系统只知道“分发效果”，不知道具体业务。

### 需要新增的文件

- `upgrade/UpgradeEffectRegistry.ts`
- `upgrade/baseEffects.ts`

### 改动内容

建立：

- `register(type, handler)`
- `apply(effect, ctx)`
- `remove(effect, ctx)`

### 第一批必须注册的 handler

- `buff`
- `hit_effect`

第二批再加：

- `grant_skill`
- `modify_skill`
- `behavior_command`

### 完成定义

- `UpgradeManager` 不再对每种 effect 写 `switch`
- 新增 effect type 靠注册，不改 manager 主体

### 验证手段

- 用现有 `buff` 和 `hit_effect` 配置接到 registry 上
- 对比改造前后行为是否一致

### 测试用例

#### 用例 1：属性升级应用

- 输入：`type=buff`
- 预期：Buff 被正常添加

#### 用例 2：命中效果升级应用

- 输入：`type=hit_effect`
- 预期：HitEffect 被正常注册到 `HitEffectMgr`

#### 用例 3：移除升级

- 操作：remove 升级
- 预期：对应 Buff / HitEffect 被正确撤销

---

## 九、Step 2.6 - 把职业私货移出升级系统

### 目标

让升级系统不再理解弓箭手专属概念。

### 当前脏点

- `shoot_policy`
- `IShootPolicy`
- `AutoShoot` / `HoldToShoot` 这些弓箭手策略直接出现在升级层

### 正确做法

把这类效果改为：

- `behavior_command`

由职业 behavior 自己注册 handler。

例如：

- 弓箭手注册 `set_shoot_policy`
- 战士未来可以注册 `switch_stance`
- 召唤师未来可以注册 `upgrade_summon_slot`

### 完成定义

- `upgrade/` 模块不再 import `shoot/*`
- 职业专属命令进入各自 behavior 层

### 验证手段

- 全局搜索 `upgrade/` 目录，确认不再依赖弓箭手私有实现

### 测试用例

#### 用例 1：弓箭手切射击策略

- 输入：行为命令型升级
- 预期：弓箭手攻击策略正确切换

#### 用例 2：通用升级不受影响

- 输入：普通 buff / hit_effect 升级
- 预期：逻辑保持不变

---

## 十、Step 2.7 - 统一 JSON 组织方式

### 目标

减少重复定义，给后续策划接手留好入口。

### 运行时当前建议

短期可以继续保留 `upgrades.json` 中的内联 `data`，因为改动最小。

但中期目标必须写清楚：

- `upgrades.json`
- `evolutions.json`
- `buffs.json`
- `hitEffects.json`

### 推荐结构

#### 升级只做引用

```json
{
  "id": "rapid-fire",
  "effects": [
    { "type": "buff", "ref": "buff.attack_speed_20" }
  ]
}
```

#### Buff / 命中效果独立定义

```json
{
  "id": "buff.attack_speed_20",
  "effectClass": "AttrModifierEffect",
  "targetAttr": "AttackSpeed-Mul-Buff",
  "valuePerStack": 0.2
}
```

### 完成定义

- 配置复用能力明确
- 后续可以平滑从内联格式迁到引用格式

### 验证手段

- 选 1-2 个升级项试点改成引用式结构
- 确认加载和运行结果一致

### 测试用例

#### 用例 1：两个升级共用同一个 Buff 定义

- 场景：不同升级引用同一个基础 Buff
- 预期：运行正确，无重复配置污染

#### 用例 2：命中效果定义独立复用

- 场景：同一命中效果可被升级和技能同时引用
- 预期：行为一致

---

## 十一、Step 2.8 - 统一配置目录与纯数据类型

### 目标

把当前 `config/` 与 `game/config/` 的双根问题纳入明确重构步骤。

### 当前脏点

目前已经出现两类坏味道：

1. 同时存在 `config/` 和 `game/config/`
2. 纯数据层反向依赖 `game` 里的实现类型

这意味着配置层并不纯，后续配表会越来越乱。

### 正确做法

中期目标明确为：

- 运行时只保留一个配置根
- 配置层只依赖纯类型定义
- 不允许 `config/*` 反向 import `game/*` 行为实现

### 当前阶段建议

短期先不做全量目录搬迁，但必须先做：

- 抽公共配置类型
- 消除配置层对玩家/敌人具体实现类型的依赖
- 给后续 `buffs.json` / `hitEffects.json` / `skills.json` / `upgrades.json` 统一入口

### 完成定义

- 配置层是纯数据层，不再反向依赖玩法实现
- 后续单根配置迁移路线清晰

### 验证手段

- 全局搜索 `config/` 下对 `game/*` 的类型依赖
- 建立待迁移列表并逐步清空

### 测试用例

#### 用例 1：配置解析不依赖玩法实现

- 场景：读取 enemy / upgrade / buff 配置
- 预期：只依赖纯类型，不依赖具体业务类

#### 用例 2：配置入口统一预留

- 场景：新增 `buffs.json` / `hitEffects.json`
- 预期：目录组织和加载路径清晰，不再双根乱长

---

## 十二、Step 2.9 - 全链路验收

### 目标

确认三层系统切干净之后，现有战斗内容没有回归。

### 需要重点回归的内容

#### Buff 层

- 属性 Buff
- DOT / HOT
- 叠层
- 持续时间
- tick

#### HitEffect 层

- 基础伤害
- 命中挂 Buff
- 击退
- 闪电链

#### Upgrade 层

- apply
- remove
- evolution check
- 组合升级

### 统一手工测试用例

#### 用例 1：属性升级回归

- 选中攻速 + 攻击升级
- 预期：DPS 明显提升，数值正确

#### 用例 2：命中 debuff 回归

- 选中灼烧 / 冻伤
- 预期：敌人被正确上状态

#### 用例 3：复合升级回归

- 一个升级同时加 Buff 和 HitEffect
- 预期：两类效果同时生效

#### 用例 4：升级移除回归

- remove 某升级
- 预期：所有副作用都被撤销

#### 用例 5：进化检测回归

- 收集满足条件的前置升级
- 预期：进化项能正确解锁

---

## 十三、本大步骤完成后的统一验收

完成 `重构步骤 2` 后，应该达到下面这些标准：

| 验收项 | 预期结果 |
|------|---------|
| 常规 Buff 是否还需要大量空壳脚本 | 否 |
| 常规命中挂 debuff 是否还要一类一个脚本 | 否 |
| `UpgradeManager` 是否仍是业务分发大杂烩 | 否 |
| 升级系统是否还理解弓箭手私货 | 否 |
| 新增普通 Buff / debuff / 升级是否能优先只改 JSON | 是 |
| `game/entity/` 是否仍继续承担模糊职责 | 否 |
| 配置层是否仍反向依赖玩法实现 | 否 |

---

## 十四、建议的手工回归清单

每次完成一个小步骤，建议固定跑这 10 条：

1. 属性 Buff 生效
2. 属性 Buff 移除
3. DOT 生效
4. HOT 生效
5. 命中挂 Buff 生效
6. 击退仍然正常
7. 闪电链仍然正常
8. 升级 apply 正常
9. 升级 remove 正常
10. 进化检查正常
11. `game/entity/` 相关 import 不继续新增脏依赖
12. 配置读取不报路径 / 类型错误

---

## 十五、这一阶段不要做什么

不要在这一步里顺手做：

- 主动技能工厂化
- 统一攻击载荷
- 投射物体系重写
- Excel 导出链路接入运行时
- 万能表达式引擎
- 一次性全量物理迁移所有配置文件

这些都是后面的事。

这一步只做一件事：

**把 Buff、命中效果、升级系统从一团互相污染的逻辑，切成三个干净层。**
