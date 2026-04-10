# 05 - Buff 与技能系统

> 前置阅读：[02-角色与战斗系统](./02-角色与战斗系统.md)、[04-肉鸽核心机制](../阶段3-游戏整体/04-肉鸽核心机制.md) | [项目总览](../项目概述/00-项目总览.md)

## 本章目标

把已有的 **Buff 系统**和**属性系统**接入游戏，让技能选择真正产生效果。这不是从零写，而是**胶水层**设计 —— 把基础设施和游戏逻辑连起来。

### 实现状态：⏳ 基础完成，上层胶水未做

| 子模块 | 状态 | 说明 |
|--------|------|------|
| 属性系统 | ✅ | GeneralPropertyMgr + 8 属性 JSON（含 LifestealRate） |
| Buff 框架 | ✅ | BuffFactory + BuffEffectBase + 装饰器注册 |
| EntityBuffMgr | ✅ | Buff 运行时管理 + tick + 叠层 |
| AttributeChangeResolver | ✅ | Buff→Property 桥接 |
| SimpleAttrBuffEffect | ✅ | 属性修改 Buff 基类 |
| 类型 A：纯属性 Buff | ✅ | AttackBoost / CritBoost / DefenseReduce / Lifesteal（4 个） |
| RegenEffect | ✅ | onTick 回血（stackDecayOnTick 模式） |
| AddHpBuffEffect | ✅ | 瞬时加血 |
| 类型 B：行为修改（MultiShot 等） | ❌ | 需在 CombatSystem 中读取属性 |
| 类型 C：触发型（Thorns/Dodge/Shield） | ❌ | 需事件监听 + 概率触发 |
| SkillManager 胶水层 | ❌ | 技能→Buff 映射未实现 |
| registerAllBuffEffects 集中注册 | ⏳ | 用 @buffEffect 装饰器自动注册，但仅 6 个效果类 |

---

## 1. 已有系统回顾

### 属性系统（`baseSystem/properties/`）

已有的完整修饰器链：

```
BaseValueProperty（基础值）
    ↓
PropertyAddModifier（+5 攻击力）
    ↓
PropertyMulModifier（×1.2 攻速）
    ↓
PropertyClampModifier（限制 0~999）
    ↓
最终值 = getFinalValue()
```

关键类：
- `GeneralPropertyMgr`：管理一个实体的所有属性
- `BaseValueProperty`：基础数值属性（有 base 值 + modifier 链）
- `ComputeValueProperty`：计算属性（依赖其他属性，自动重算）
- `PropertyAddModifier / PropertyMulModifier`：加法/乘法修饰器

### Buff 系统（`baseSystem/buff/`）

已有的声明式 Buff 框架：

```
BuffData（配置）→ BuffRuntimeInfo（运行时）→ BuffEffectBase（效果声明）
                                                    ↓
                                            getChanges(): AttributeChange[]
                                                    ↓
                                        AttributeChangeResolver（应用到属性系统）
```

关键类：
- `BuffData`：配置数据（id, duration, maxStack, tickInterval, effectClass）
- `BuffRuntimeInfo`：运行时状态（当前层数、剩余时间）
- `BuffEffectBase`：效果基类，子类实现 `getChanges()` 声明属性变化
- `BuffFactory`：按 `effectClass` 名称创建效果实例
- `EChangeType`：ADD / MUL / OVERRIDE / CLAMP / EVENT

---

## 2. 技能 → Buff → 属性：数据流

这是整个系统的核心管线：

```
玩家选择技能 "急速射击"
        │
        ▼
SkillManager.applySkill('atk_speed_up', level=1)
        │
        ▼
创建一个永久 Buff（duration=0）
BuffData: { id: 1001, duration: 0, effectClass: 'AtkSpeedBuff' }
        │
        ▼
EntityBuffMgr.addBuff(buffData)
        │
        ▼
BuffFactory.create('AtkSpeedBuff') → AtkSpeedBuffEffect
        │
        ▼
AtkSpeedBuffEffect.getChanges() 返回:
  [{ attrId: 'atkSpeed', type: EChangeType.MUL, value: 0.15 }]
        │
        ▼
AttributeChangeResolver 将 change 转为 PropertyMulModifier
        │
        ▼
PropertyManager.getProperty('atkSpeed').addModifier(...)
        │
        ▼
CombatSystem 读取 getFinalValue('atkSpeed') → 1.15 (原来1.0 × 1.15)
        │
        ▼
攻速提升了 15%
```

**这就是数据流。没有 if-else，没有特殊情况。** 所有技能都走同一条管线。

---

## 3. 技能效果分类

根据效果实现方式，技能分为三大类：

### 类型 A：纯属性修改

最简单，只需要 Buff + Modifier。

```typescript
class AtkPowerBuff extends BuffEffectBase {
    getChanges(): AttributeChange[] {
        const level = this.runtime.stack;
        const values = [3, 5, 8]; // 每级加多少
        return [{
            attrId: 'atk',
            type: EChangeType.ADD,
            value: values[level - 1] ?? values[values.length - 1],
        }];
    }
}
```

**属于此类型的技能**：
- 力量强化（+ATK）
- 急速射击（+ATK_SPEED）
- 生命强化（+MAX_HP）
- 铁壁（+DEF）
- 锐利之眼（+CRIT_RATE）
- 致命打击（+CRIT_DMG）
- 轻功（+MOVE_SPEED）

### 类型 B：行为修改

需要在 System 中检查标记来改变行为。

```typescript
class MultiShotBuff extends BuffEffectBase {
    getChanges(): AttributeChange[] {
        const level = this.runtime.stack;
        return [{
            attrId: 'extraProjectiles',
            type: EChangeType.ADD,
            value: level, // 1/2/3 额外弹道
        }];
    }
}
```

在 CombatSystem 中：

```typescript
private _performAttack(attacker: Entity, combat: CombatComp): void {
    const extraProjectiles = PropertyManager
        .getFinalValue(attacker, 'extraProjectiles');

    const baseDir = this._getDirectionTo(attacker, combat.autoTarget);
    const totalShots = 1 + (extraProjectiles ?? 0);

    if (totalShots === 1) {
        this._spawnProjectile(attacker, baseDir, combat.atk);
    } else {
        // 扇形展开
        const spreadAngle = 15; // 度
        const startAngle = -(totalShots - 1) * spreadAngle / 2;
        for (let i = 0; i < totalShots; i++) {
            const angle = startAngle + i * spreadAngle;
            const dir = this._rotateDir(baseDir, angle);
            this._spawnProjectile(attacker, dir, combat.atk);
        }
    }
}
```

**属于此类型的技能**：
- 多重射击（额外弹道数）
- 穿透箭（弹道穿透次数）
- 弹射箭（弹道弹射次数）
- 斜射 / 背射（额外方向弹道）
- 追踪箭（弹道追踪系数）

### 类型 C：触发型效果

需要事件监听 + 概率触发。

```typescript
class ThornsBuff extends BuffEffectBase {
    getChanges(): AttributeChange[] {
        return [{
            attrId: 'thornsRate',
            type: EChangeType.ADD,
            value: 0.15 * this.runtime.stack,
        }];
    }

    onAdd(): void {
        EventBus.on('entity:damaged', this._onOwnerDamaged, this);
    }

    onRemove(): void {
        EventBus.off('entity:damaged', this._onOwnerDamaged, this);
    }

    private _onOwnerDamaged(event: DamageEvent): void {
        if (event.target !== this.runtime.owner) return;
        const thornsRate = 0.15 * this.runtime.stack;
        const thornsDmg = Math.round(event.damage * thornsRate);
        if (thornsDmg > 0 && event.attacker) {
            EventBus.emit('entity:applyDamage', {
                target: event.attacker,
                damage: thornsDmg,
                source: 'thorns',
            });
        }
    }
}
```

**属于此类型的技能**：
- 荆棘（受击反伤）
- 闪避（概率免伤）
- 护盾（层开始时添加临时 Buff）

---

## 4. SkillManager：胶水层

连接肉鸽技能选择和 Buff 系统的桥梁：

```typescript
class SkillManager {
    private _skillToBuff: Map<string, number> = new Map();

    /**
     * 技能配置：每个技能ID对应哪个BuffData ID
     * 这是唯一需要手动维护的映射
     */
    private static readonly SKILL_BUFF_MAP: Record<string, number> = {
        'atk_power_up':  1001,
        'atk_speed_up':  1002,
        'multi_shot':    1003,
        'piercing':      1004,
        'bounce':        1005,
        'crit_rate_up':  1006,
        'crit_dmg_up':   1007,
        'max_hp_up':     1008,
        'def_up':        1009,
        'dodge':         1010,
        'hp_regen':      1011,
        'shield':        1012,
        'thorns':        1013,
        'move_speed_up': 1014,
        'diagonal_arrow': 1015,
        'rear_arrow':    1016,
        'homing':        1017,
        'gold_bonus':    1018,
        'magnet':        1019,
        'exp_bonus':     1020,
    };

    applySkill(
        skillId: string,
        entity: Entity,
        buffMgr: EntityBuffMgr
    ): void {
        const buffId = SkillManager.SKILL_BUFF_MAP[skillId];
        if (buffId === undefined) {
            console.warn(`Unknown skill: ${skillId}`);
            return;
        }

        if (buffMgr.hasBuff(buffId)) {
            // 已有此技能 → 叠加层数（升级）
            buffMgr.addStack(buffId);
        } else {
            // 新技能 → 添加 Buff
            const buffData = this._loadBuffData(buffId);
            buffMgr.addBuff(buffData);
        }
    }

    removeAllRunSkills(entity: Entity, buffMgr: EntityBuffMgr): void {
        for (const buffId of this._skillToBuff.values()) {
            buffMgr.removeBuff(buffId);
        }
        this._skillToBuff.clear();
    }
}
```

---

## 5. Buff 配置示例

```json
{
    "buffs": [
        {
            "id": 1001,
            "name": "力量强化",
            "duration": 0,
            "maxStack": 3,
            "effectClass": "AtkPowerBuff"
        },
        {
            "id": 1002,
            "name": "急速射击",
            "duration": 0,
            "maxStack": 3,
            "effectClass": "AtkSpeedBuff"
        },
        {
            "id": 1003,
            "name": "多重射击",
            "duration": 0,
            "maxStack": 3,
            "effectClass": "MultiShotBuff"
        },
        {
            "id": 1011,
            "name": "再生",
            "duration": 0,
            "maxStack": 3,
            "tickInterval": 1.0,
            "effectClass": "HpRegenBuff"
        },
        {
            "id": 1012,
            "name": "护盾",
            "duration": 0,
            "maxStack": 3,
            "effectClass": "ShieldBuff",
            "shieldPercent": [0.10, 0.15, 0.20]
        }
    ]
}
```

---

## 6. 玩家属性清单

需要注册到 `GeneralPropertyMgr` 的所有属性：

| 属性 ID | 基础值 | 说明 | 被哪些技能影响 |
|---------|--------|------|---------------|
| `hp` | 100 | 当前生命 | —（直接修改，不走 Modifier）|
| `maxHp` | 100 | 最大生命 | max_hp_up, shield |
| `atk` | 10 | 攻击力 | atk_power_up |
| `def` | 3 | 防御力 | def_up |
| `atkSpeed` | 1.0 | 攻速（次/秒）| atk_speed_up |
| `moveSpeed` | 200 | 移速（像素/秒）| move_speed_up |
| `critRate` | 0.05 | 暴击率 | crit_rate_up |
| `critDmg` | 1.5 | 暴击倍率 | crit_dmg_up |
| `extraProjectiles` | 0 | 额外弹道数 | multi_shot |
| `pierceCount` | 0 | 穿透次数 | piercing |
| `bounceCount` | 0 | 弹射次数 | bounce |
| `dodgeRate` | 0 | 闪避率 | dodge |
| `thornsRate` | 0 | 反伤比例 | thorns |
| `goldMultiplier` | 1.0 | 金币倍率 | gold_bonus |
| `expMultiplier` | 1.0 | 经验倍率 | exp_bonus |
| `pickupRange` | 50 | 拾取范围 | magnet |

---

## 7. 注册 BuffEffect 到工厂

在游戏启动时注册所有效果类：

```typescript
function registerAllBuffEffects(): void {
    BuffFactory.register('AtkPowerBuff', AtkPowerBuff);
    BuffFactory.register('AtkSpeedBuff', AtkSpeedBuff);
    BuffFactory.register('MultiShotBuff', MultiShotBuff);
    BuffFactory.register('PiercingBuff', PiercingBuff);
    BuffFactory.register('BounceBuff', BounceBuff);
    BuffFactory.register('CritRateBuff', CritRateBuff);
    BuffFactory.register('CritDmgBuff', CritDmgBuff);
    BuffFactory.register('MaxHpBuff', MaxHpBuff);
    BuffFactory.register('DefBuff', DefBuff);
    BuffFactory.register('DodgeBuff', DodgeBuff);
    BuffFactory.register('HpRegenBuff', HpRegenBuff);
    BuffFactory.register('ShieldBuff', ShieldBuff);
    BuffFactory.register('ThornsBuff', ThornsBuff);
    BuffFactory.register('MoveSpeedBuff', MoveSpeedBuff);
    BuffFactory.register('GoldBonusBuff', GoldBonusBuff);
    BuffFactory.register('ExpBonusBuff', ExpBonusBuff);
    BuffFactory.register('MagnetBuff', MagnetBuff);
}
```

---

## 8. 敌人的 Buff

敌人也能有 Buff，特别是 Monk（僧侣）型敌人和 Boss：

| Buff | 效果 | 来源 |
|------|------|------|
| 鼓舞 | 周围友军 +20% ATK | Monk 光环 |
| 狂暴 | ATK +50%, 受伤 +30% | Boss 低血量阶段 |
| 护甲碎裂 | DEF -50%，持续 3 秒 | 玩家某些技能附带 |
| 减速 | 移速 -40%，持续 2 秒 | 玩家某些技能附带 |
| 中毒 | 每秒 5 点伤害，持续 5 秒 | 玩家某些技能附带 |

---

## 9. 新手实现步骤

### Step 1：属性注册 ✅
- [x] 为玩家/敌人创建 `EntityPropertyMgr`（继承 GeneralPropertyMgr）
- [x] 注册 8 个属性（Hp/Attack/Defense/CritRate/CritDmg/AttackSpeed/MoveSpeed/LifestealRate）
- [x] PlayerCombat / EnemyCombat 从属性管理器读取最终值
- **验收**：`getValue(EPropertyId.Attack)` 返回正确基础值 ✅

### Step 2：第一批 Buff ✅
- [x] SimpleAttrBuffEffect 基类 + 4 个子类（AttackBoost/CritBoost/DefenseReduce/Lifesteal）
- [x] RegenEffect（onTick 回血，stackDecayOnTick 模式）
- [x] AddHpBuffEffect（瞬时加血）
- [x] @buffEffect 装饰器自动注册到 BuffFactory
- **验收**：addBuff 后属性变化 + BattleTestPanel 全流程测试 ✅

### Step 3：SkillManager 连接（预计 1 小时）
- [ ] 实现 `SkillManager.applySkill()`
- [ ] 技能选择面板选中后调用 `applySkill`
- [ ] 验证选择"力量强化"后攻击力真的提升了
- **验收**：选技能 → Buff 生效 → 战斗伤害变高

### Step 4：行为类技能（预计 2 小时）
- [ ] 实现 `MultiShotBuff`
- [ ] 在 CombatSystem 中读取 `extraProjectiles` 属性
- [ ] 根据值生成多支箭
- **验收**：选"多重射击"后同时射出多支箭

### Step 5：触发类技能（预计 2 小时）
- [ ] 实现 `ThornsBuff` 或 `DodgeBuff`
- [ ] 接入事件系统（`entity:damaged`）
- [ ] 验证触发效果
- **验收**：受击时触发反伤/闪避

---

## 关键设计决策

| 决策 | 理由 |
|------|------|
| 技能 = 永久 Buff（duration=0）| 局内技能不应该过期，用 Buff 系统统一管理，死亡时整体清除 |
| 技能升级 = Buff 叠层 | maxStack 机制天然支持，不需要额外升级逻辑 |
| 声明式 getChanges() | 效果和应用分离，加新技能只需写一个 Effect 类和一条配置 |
| 所有属性走 PropertyManager | 伤害公式不需要知道加成来源，只读最终值，干净 |

---

> 下一章：[06-UI与数据驱动](../阶段3-游戏整体/06-UI与数据驱动.md) —— 让玩家看到发生了什么。
>
> 返回 [项目总览](../项目概述/00-项目总览.md)
