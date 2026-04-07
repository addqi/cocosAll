# Buff 系统从零到一教程

> 基于 cocos_rpg 项目 `Game/Buff` 模块梳理的完整教程，适用于 Cocos Creator 3.x + TypeScript。

---

## 一、概述

### 1.1 什么是 Buff 系统？

Buff 系统用于管理游戏中**临时/持续性的属性变化效果**，例如：
- 加速（移动速度 +20）
- 攻击强化（攻击力 ×1.2）
- 持续掉血（DOT：每秒 -10 血）
- 持续回血（HoT：每秒 +5 血）
- 永久被动（装备带来的属性加成）

### 1.2 设计理念

| 原则 | 说明 |
|------|------|
| **声明式** | Buff 只「声明」要改变什么（AttributeChange），不直接操作属性 |
| **配置驱动** | BuffData 来自 JSON/表格，策划可配置 id、duration、maxStack 等 |
| **工厂创建** | 通过 effectClass 字符串由 BuffFactory 创建具体效果实例 |
| **桥接层** | AttributeChangeResolver 将声明式变化转化为属性系统的 modifier |

### 1.3 整体架构图

```
BuffData（配置：id、duration、effectClass、addValue...）
        ↓
BuffFactory.createRuntime(data, owner)
        ↓
BuffRuntimeInfo（运行时：stack、remainTime、tickTimer）
        ↓
BuffEffect.getChanges() → AttributeChange[]
        ↓
AttributeChangeResolver.applyChanges(runtime)
        ↓
createModifier(change) → PropertyAddModifier 等
        ↓
prop.addModifier(mod)  // 属性系统
        ↓
owner.refreshPropertyDirty(attrIds)
```

---

## 二、前置条件：属性系统

Buff 系统依赖**属性系统**，属性系统需具备：

1. **PropertyManager**：有 `getProperty(id)` 方法，返回属性对象
2. **IProperty**：有 `addModifier(mod)`、`removeModifier(mod)` 方法
3. **Modifier 类型**：`PropertyAddModifier`、`PropertyMulModifier`、`PropertyOverrideModifier`、`PropertyClampModifier`
4. **Dirty 机制**：属性修改后需调用 `markDirty(attrIds)` 触发重新计算

属性配置通常采用：
- **valueNodes**：Config、Buff、Other、Mul-Buff、Mul-Other 等节点
- **computeNodes**：通过 `{{id}}` 表达式组合得到最终属性

例如移动速度：
```
MoveSpeed-Value = Config + Buff + Other
MoveSpeed = MoveSpeed-Value × (1 + Mul-Buff + Mul-Other)
```

Buff 通过修改 `MoveSpeed-Value-Buff`（加法）或 `MoveSpeed-Mul-Buff`（乘区）来影响最终速度。

---

## 三、核心概念与数据结构

### 3.1 BuffData（配置数据）

来自配置表（JSON/Excel）的静态数据：

```typescript
interface BuffData {
    id: number;           // Buff 唯一 id，用于 addBuff/removeBuff/hasBuff
    name: string;         // 名称（可显示在 UI）
    duration: number;     // 持续时间（秒），0 表示永久
    maxStack?: number;    // 最大叠加层数，默认 1
    tickInterval?: number;// tick 间隔（秒），0 表示不 tick
    effectClass?: string; // 效果类名，对应 BuffFactory.register 的类名
    [key: string]: any;   // 额外配置（如 addValue、mulFactor、targetAttr）
}
```

### 3.2 BuffRuntimeInfo（运行时实例）

每个生效中的 Buff 对应一个 BuffRuntimeInfo：

| 字段 | 类型 | 说明 |
|------|------|------|
| data | BuffData | 配置数据 |
| owner | IBuffOwner | 挂载目标（角色、怪物等） |
| effect | BuffEffectBase | 效果逻辑实例 |
| stack | number | 当前叠加层数 |
| remainTime | number | 剩余持续时间（秒） |
| tickTimer | number | tick 计时器 |
| expired | getter | 是否过期（duration>0 且 remainTime<=0） |

### 3.3 AttributeChange（声明式变化）

Buff 不直接改属性，而是返回「要产生什么变化」：

```typescript
interface AttributeChange {
    attrId: string;   // 属性节点 id，必须与 valueNodes 中的 id 一致
    type: Changetype; // ADD | MUL | OVERRIDE | CLAMP | EVENT
    value?: number;   // 数值
    meta?: any;       // 元数据（如 priority、min、max）
}

type Changetype = 'ADD' | 'MUL' | 'OVERRIDE' | 'CLAMP' | 'EVENT';
```

### 3.4 IBuffOwner（挂载目标接口）

可挂 Buff 的对象必须实现：

```typescript
interface IBuffOwner {
    getPropertyManager(): any;  // 无参返回属性管理器（有 getProperty 方法）
    uid?: string | number;     // 可选，用于日志/调试
}
```

---

## 四、从零搭建 Buff 系统

### Step 1：定义类型 `types.ts`

创建 `types.ts`，定义 BuffData、AttributeChange、IBuffOwner、BuffEffectCtor：

```typescript
import { BuffEffectBase } from "./BuffEffectBase";
import { BuffRuntimeInfo } from "./BuffRuntimeInfo";

export type Changetype = 'ADD' | 'MUL' | 'OVERRIDE' | 'CLAMP' | 'EVENT';

export interface AttributeChange {
    attrId: string;
    type: Changetype;
    value?: number;
    meta?: any;
}

export interface BuffData {
    id: number;
    name: string;
    duration: number;
    maxStack?: number;
    tickInterval?: number;
    effectClass?: string;
    [key: string]: any;
}

export type BuffEffectCtor = new (runtime: BuffRuntimeInfo) => BuffEffectBase;

export interface IBuffOwner {
    getPropertyManager(): any;
    uid?: string | number;
}
```

### Step 2：实现 BuffRuntimeInfo

创建 `BuffRuntimeInfo.ts`：

```typescript
export class BuffRuntimeInfo {
    public data: BuffData;
    public owner: IBuffOwner;
    public effect!: BuffEffectBase;
    public stack: number = 1;
    public remainTime: number;
    public tickTimer: number;

    constructor(data: BuffData, owner: IBuffOwner) {
        this.data = data;
        this.owner = owner;
        this.remainTime = data.duration || 0;
        this.tickTimer = data.tickInterval || 0;
    }

    addStack() {
        const max = this.data.maxStack ?? 1;
        if (this.stack < max) {
            this.stack++;
            if (this.data.duration > 0) this.remainTime = this.data.duration;
        }
    }

    get expired(): boolean {
        if (this.data.duration <= 0) return false;
        return this.remainTime <= 0;
    }
}
```

### Step 3：实现 BuffEffectBase

创建 `BuffEffectBase.ts`，所有 Buff 效果继承此类：

```typescript
export abstract class BuffEffectBase {
    public runtime: BuffRuntimeInfo;
    public data: BuffData;

    constructor(runtime: BuffRuntimeInfo) {
        this.runtime = runtime;
        this.data = runtime.data;
    }

    abstract getChanges(): AttributeChange[];
    onAdd?(): void;
    onRemove?(): void;
    onTick?(dt?: number): void;
}
```

### Step 4：实现 BuffFactory

创建 `BuffFactory.ts`，按 effectClass 创建 effect 实例：

```typescript
export class BuffFactory {
    private static registry: Map<string, BuffEffectCtor> = new Map();

    static register(name: string, ctor: BuffEffectCtor) {
        this.registry.set(name, ctor);
    }

    static createRuntime(data: BuffData, owner: any): BuffRuntimeInfo {
        const runtime = new BuffRuntimeInfo(data, owner);
        if (data.effectClass) {
            const ctor = this.registry.get(data.effectClass);
            if (ctor) runtime.effect = new ctor(runtime);
            else console.warn(`[BuffFactory] effectClass ${data.effectClass} 未注册`);
        }
        return runtime;
    }
}
```

### Step 5：实现 AttributeChangeResolver

创建 `AttributeChangeResolver.ts`，将 AttributeChange 转为 Modifier 并应用/移除：

```typescript
export class AttributeChangeResolver {
    static applyChanges(runtime: BuffRuntimeInfo) {
        const owner = runtime.owner as any;
        const pm = owner.getPropertyManager?.();
        if (!pm) return;

        const changes = runtime.effect.getChanges();
        runtime['_appliedModifiers'] = runtime['_appliedModifiers'] || [];
        const dirtyAttrIds = new Set<string>();

        for (const ch of changes) {
            const prop = pm.getProperty(ch.attrId);
            if (!prop) continue;
            const mod = this.createModifier(ch);
            if (!mod) continue;

            prop.addModifier(mod);
            runtime['_appliedModifiers'].push({ prop, mod });
            dirtyAttrIds.add(ch.attrId);
        }

        owner?.refreshPropertyDirty?.(Array.from(dirtyAttrIds));
    }

    static removeChanges(runtime: BuffRuntimeInfo) {
        const list = runtime['_appliedModifiers'] as Array<{ prop: any; mod: any }>;
        if (!list?.length) return;
        const dirtyAttrIds = new Set<string>();
        for (const item of list) {
            item.prop.removeModifier(item.mod);
            dirtyAttrIds.add(item.prop.propertyId);
        }
        const owner = runtime.owner as any;
        owner?.refreshPropertyDirty?.(Array.from(dirtyAttrIds));
    }

    private static createModifier(change: AttributeChange) {
        const priority = change.meta?.priority ?? 0;
        switch (change.type) {
            case 'ADD': return new PropertyAddModifier(change.value ?? 0, priority);
            case 'MUL': return new PropertyMulModifier(change.value ?? 1, priority);
            case 'OVERRIDE': return new PropertyOverrideModifier(change.value ?? 0, priority);
            case 'CLAMP': {
                const min = change.meta?.min ?? Number.NEGATIVE_INFINITY;
                const max = change.meta?.max ?? Number.POSITIVE_INFINITY;
                return new PropertyClampModifier(min, max, priority);
            }
            default: return null;
        }
    }
}
```

### Step 6：实现 BuffMgr

创建 `BuffMgr.ts`，管理 Buff 的添加、移除、更新：

```typescript
export class BuffMgr {
    private owner: any;
    private buffMap: Map<number, BuffRuntimeInfo> = new Map();

    constructor(owner: any) {
        this.owner = owner;
    }

    addBuff(data: BuffData): BuffRuntimeInfo {
        const id = data.id;
        let runtime = this.buffMap.get(id);
        if (runtime) {
            runtime.addStack();
            AttributeChangeResolver.removeChanges(runtime);
            AttributeChangeResolver.applyChanges(runtime);
            runtime.effect?.onAdd?.();
            return runtime;
        }
        runtime = BuffFactory.createRuntime(data, this.owner);
        if (runtime.effect) {
            AttributeChangeResolver.applyChanges(runtime);
            runtime.effect.onAdd?.();
        }
        this.buffMap.set(id, runtime);
        return runtime;
    }

    removeBuff(buffId: number) {
        const runtime = this.buffMap.get(buffId);
        if (!runtime) return;
        runtime.effect?.onRemove?.();
        AttributeChangeResolver.removeChanges(runtime);
        this.buffMap.delete(buffId);
    }

    hasBuff(buffId: number): boolean {
        return this.buffMap.has(buffId);
    }

    get(buffId: number): BuffRuntimeInfo | undefined {
        return this.buffMap.get(buffId);
    }

    update(dt: number) {
        const removeList: number[] = [];
        this.buffMap.forEach((runtime, id) => {
            if (runtime.data.duration > 0) runtime.remainTime -= dt;
            if (runtime.data.tickInterval > 0) {
                runtime.tickTimer -= dt;
                if (runtime.tickTimer <= 0) {
                    runtime.tickTimer = runtime.data.tickInterval;
                    runtime.effect?.onTick?.(dt);
                }
            }
            if (runtime.expired) removeList.push(id);
        });
        removeList.forEach(id => this.removeBuff(id));
    }
}
```

### Step 7：创建第一个 Buff 效果（SpeedUpEffect）

创建 `effexts/SpeedUpEffect.ts`：

```typescript
import { BuffEffectBase } from '../BuffEffectBase';
import { AttributeChange } from '../types';
import { BuffFactory } from '../BuffFactory';

// 假设属性 ID 枚举中有 speedBuffValue、speedMulBuffValue
export class SpeedUpEffect extends BuffEffectBase {
    getChanges(): AttributeChange[] {
        const changes: AttributeChange[] = [];
        const add = this.data.addValue ?? 0;
        const mul = this.data.mulFactor ?? 0;
        const addTarget = this.data.targetAttr ?? 'MoveSpeed-Value-Buff';
        const mulTarget = this.data.mulTargetAttr ?? 'MoveSpeed-Mul-Buff';
        const stack = this.runtime.stack || 1;

        if (add !== 0) {
            changes.push({ attrId: addTarget, type: 'ADD', value: add * stack });
        }
        if (mul !== 0) {
            const extraMul = mul > 1 ? (mul - 1) : mul;
            if (extraMul !== 0) {
                changes.push({ attrId: mulTarget, type: 'ADD', value: extraMul * stack });
            }
        }
        return changes;
    }

    onAdd(): void { console.log('添加速度buff'); }
    onRemove(): void { console.log('移除速度buff'); }
}

BuffFactory.register('SpeedUpEffect', SpeedUpEffect);
```

注意：乘区公式为 `Value × (1 + MulBuff + MulOther)`，若策划填 1.2 倍，需转为 `+0.2` 写入 Mul 节点。

### Step 8：对接角色（IBuffOwner + RoleMgr）

**RolePropertyMgr** 实现 IBuffOwner：

```typescript
export class RolePropertyMgr extends Component {
    public propertyManager: GeneralPropertyMgr = new GeneralPropertyMgr();

    getPropertyManager() {
        return this.propertyManager;  // 必须返回管理器本身，不能返回单个属性
    }

    refreshPropertyDirty(attrIds?: string[]) {
        this.propertyManager.markDirty(attrIds);
    }
}
```

**RoleMgr** 在 onLoad 中创建 BuffMgr，并在 update 中调用 update：

```typescript
export class RoleMgr extends Component {
    private roleProMgr: RolePropertyMgr;
    private rolebuffMgr: BuffMgr;

    protected onLoad(): void {
        this.roleProMgr = this.node.getComponent(RolePropertyMgr);
        this.rolebuffMgr = new BuffMgr(this.roleProMgr);  // owner 是 RolePropertyMgr
    }

    update(deltaTime: number) {
        this.rolebuffMgr?.update(deltaTime);
    }

    getBuffMgr(): BuffMgr {
        return this.rolebuffMgr;
    }
}
```

---

## 五、使用流程

### 5.1 添加 Buff

```typescript
const buffData: BuffData = {
    id: 1001,
    name: '加速',
    duration: 10,
    maxStack: 3,
    effectClass: 'SpeedUpEffect',
    addValue: 20,
    mulFactor: 1.2
};

roleMgr.getBuffMgr().addBuff(buffData);
```

### 5.2 移除 Buff

```typescript
roleMgr.getBuffMgr().removeBuff(1001);
```

### 5.3 检查 Buff

```typescript
if (roleMgr.getBuffMgr().hasBuff(1001)) {
    const runtime = roleMgr.getBuffMgr().get(1001);
    console.log('层数:', runtime.stack, '剩余:', runtime.remainTime);
}
```

---

## 六、新建 Buff 完整指南

### 6.1 步骤清单

1. 在 `effexts/` 下新建 `XxxEffect.ts`
2. 继承 `BuffEffectBase`，实现 `getChanges()`
3. 文件末尾调用 `BuffFactory.register('XxxEffect', XxxEffect)`
4. 配置 BuffData 时设置 `effectClass: 'XxxEffect'`
5. 确保 `attrId` 与属性配置中 valueNodes 的 id 一致

### 6.2 attrId 与属性配置对应表

| 效果类型 | attrId | 说明 |
|----------|--------|------|
| 速度加法 | MoveSpeed-Value-Buff | 固定加成 |
| 速度乘法 | MoveSpeed-Mul-Buff | 倍率（0.2 = +20%） |
| 攻击加法 | Attack-Value-Buff | 固定加成 |
| 攻击乘法 | Attack-Mul-Buff | 倍率 |
| 生命加法 | Hp-Value-Buff | 固定加成 |

### 6.3 变化类型与 Modifier 对应

| Change.type | Modifier | 说明 |
|-------------|----------|------|
| ADD | PropertyAddModifier | 加法 |
| MUL | PropertyMulModifier | 乘法 |
| OVERRIDE | PropertyOverrideModifier | 覆盖，取最高优先级 |
| CLAMP | PropertyClampModifier | 限制范围，meta 需提供 min、max |

### 6.4 乘区注意事项

乘区公式为 `Value × (1 + MulBuff + MulOther)`，Mul 节点存储的是**加法项**：
- 策划填 1.2 倍 → effect 中转为 `value: 0.2`
- 策划填 0.4 → 可直接用 `value: 0.4`（表示 +40%）

---

## 七、DOT/HoT 与 Tick

### 7.1 配置 tickInterval

```typescript
const dotBuff: BuffData = {
    id: 2001,
    name: '中毒',
    duration: 5,
    tickInterval: 1,  // 每秒触发一次
    effectClass: 'PoisonEffect'
};
```

### 7.2 实现 onTick

```typescript
export class PoisonEffect extends BuffEffectBase {
    getChanges(): AttributeChange[] {
        return [];  // 不直接改属性，在 onTick 中处理
    }

    onTick(dt?: number): void {
        const pm = this.runtime.owner.getPropertyManager();
        const hpProp = pm.getProperty('Hp-Value-Config');  // 或其他血量节点
        // 通过修改或下发伤害逻辑实现每秒掉血
    }
}
```

---

## 八、常见问题与排错

### Q1：Buff 添加后属性没变化？

- 检查 `getPropertyManager()` 是否**无参**返回属性管理器本身
- 检查 `attrId` 是否在属性配置的 valueNodes 中存在
- 检查 `effectClass` 是否已通过 `BuffFactory.register` 注册

### Q2：叠加时 modifier 重复？

叠加时会先 `removeChanges` 再 `applyChanges`，会按当前 `stack` 重新计算，不会重复。

### Q3：永久 Buff 如何实现？

配置 `duration: 0`，`BuffRuntimeInfo.expired` 会始终返回 false。

### Q4：如何为怪物/建筑挂 Buff？

1. 让该对象持有或实现兼容的属性管理器
2. 实现 `getPropertyManager()` 和 `refreshPropertyDirty()`
3. 创建 `BuffMgr` 时传入该对象作为 owner
4. 在 update 中调用 `buffMgr.update(dt)`

---

## 九、文件清单

| 文件 | 路径 | 说明 |
|------|------|------|
| 类型定义 | Buff/types.ts | BuffData、AttributeChange、IBuffOwner |
| 运行时 | Buff/BuffRuntimeInfo.ts | stack、remainTime、expired |
| 效果基类 | Buff/BuffEffectBase.ts | getChanges、onAdd、onRemove、onTick |
| 工厂 | Buff/BuffFactory.ts | register、createRuntime |
| 管理器 | Buff/BuffMgr.ts | addBuff、removeBuff、update |
| 解析器 | Buff/AttributeChangeResolver.ts | applyChanges、removeChanges |
| 效果实现 | Buff/effexts/*.ts | SpeedUpEffect 等 |

---

## 十、扩展与进阶

- **Buff 组**：可为 BuffData 增加 `groupId`，实现 `removeByGroup(groupId)`
- **驱散优先级**：可为 BuffData 增加 `dispelsPriority`，驱散时按优先级移除
- **Buff 事件**：可扩展 `Changetype.EVENT`，用于触发技能、播放特效等
- **配置表**：将 BuffData 存入 JSON/Excel，通过 id 加载

---

*教程完成。建议按 Step 1～8 顺序搭建，再通过 SpeedUpEffect 验证流程。*
