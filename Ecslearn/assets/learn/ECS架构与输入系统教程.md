# ECS 架构与输入系统教程

> 基于 Ecslearn 项目 `game/core` + `game/system` + `game/component` 模块，适用于 Cocos Creator 3.x + TypeScript。

---

## 一、概述

### 1.1 项目 ECS 定位

本项目采用 **轻量 ECS + Cocos 组件** 的混合架构：

| 层面 | 方案 | 典型模块 |
|------|------|----------|
| 输入 → 移动 | ECS（Entity + Component + System） | `RawInputSystem` → `MoveSyncSystem` |
| 战斗 / 弹道 / Buff / 技能 | Cocos Component + 服务类 | `PlayerControl`、`SkillSystem`、`EntityBuffMgr` |

ECS 管的是**每帧必须按固定顺序跑的数据管线**；战斗和技能逻辑挂在 Cocos 组件上，通过服务类交互。

### 1.2 为什么选混合方案

- **纯 ECS** 适合大量同质实体（弹幕、RTS 单位），但在 Cocos 里与编辑器节点树、动画系统对接成本高
- **纯 Cocos Component** 随功能膨胀容易变成「胖组件」，输入/移动逻辑散落各处
- **混合方案**：把数据流最明确的部分（输入 → 动作 → 速度 → 位移）抽成 ECS，其余保持 Cocos 习惯

### 1.3 整体数据流

```
cc.input 事件
    ↓
RawInputSystem   → 写 RawInputComp（键盘/鼠标原始状态）
    ↓
ActionMapSystem  → 读 RawInputComp → 写 ActionComp（语义动作 + 方向）
    ↓
PlayerControlSystem → 读 ActionComp → 写 VelocityComp（速度）
    ↓
MoveSyncSystem   → 读 VelocityComp → 写 NodeRefComp.node.position（位移）
```

四层 System **按固定顺序**在 `GameLoop.update` 中执行，**零耦合**：每层只读上一层的输出、写自己的输出。

---

## 二、核心概念

### 2.1 Entity（实体）

来自 `baseSystem/ecs`，本质是**组件容器**：

```typescript
class Entity {
    addComponent<T extends IComponent>(comp: T): T;
    getComponent<T extends IComponent>(ctor: new (...args: any[]) => T): T | null;
    removeComponent<T extends IComponent>(ctor: new (...args: any[]) => T): void;
}
```

Entity **不是** Cocos 的 `Node`，也**不拥有**任何逻辑——逻辑全在 System 里。

### 2.2 IComponent（组件）

纯数据接口，不含任何方法（顶多 getter/setter）：

```typescript
interface IComponent {}
```

项目中四个 ECS 组件：

| 组件 | 数据 | 职责 |
|------|------|------|
| `RawInputComp` | `keys` `down` `up` `mouseDown` `mouseHeld` `mouseScreenX/Y` | 原始键鼠状态 |
| `ActionComp` | `active` `justPressed` `moveDir` | 语义动作 + 归一化方向 |
| `VelocityComp` | `vx` `vy` | 速度分量 |
| `NodeRefComp` | `node: Node` | Cocos 节点引用，桥接 ECS ↔ 场景树 |

### 2.3 ISystem（系统）

每帧处理所有实体的纯逻辑：

```typescript
interface ISystem {
    update(entities: Entity[], dt?: number): void;
}
```

System **不持有状态**（除了 `RawInputSystem` 需要缓存帧间按键事件），只读写 Component。

### 2.4 World（注册表）

```typescript
export class World {
    private static _inst: World;
    static get inst(): World { return this._inst; }

    private _entities: Entity[] = [];

    add(entity: Entity): void;
    remove(entity: Entity): void;
    all(): Entity[];
}
```

- 全局单例，`GameLoop.onLoad` 中 `new World()` 自动设置
- 无 Archetype / Query，直接遍历全量实体——当前只有玩家一个实体，足够简单

---

## 三、GameLoop —— 驱动一切

### 3.1 初始化流程

```
GameLoop.onLoad()
    ├── new World()                          // 创建实体注册表
    ├── new RawInputSystem()                 // 构造时订阅 cc.input
    ├── new ActionMapSystem()
    ├── new PlayerControlSystem()
    ├── new MoveSyncSystem()
    ├── ProjectilePool.init(this.node)       // 弹道对象池
    └── _preloadResources()                  // 异步加载纹理
         └── GameLoop._isReady = true        // 触发所有 onReady 回调
```

### 3.2 每帧更新

```typescript
update(dt: number) {
    if (!this._ready) return;
    const entities = this._world.all();
    this._rawInput.update(entities);       // ① 采集输入
    this._actionMap.update(entities);      // ② 翻译动作
    this._playerControl.update(entities);  // ③ 计算速度
    this._moveSync.update(entities, dt);   // ④ 同步位置
}
```

**顺序不可调换**——每层依赖上一层的写入结果。

### 3.3 资源就绪机制

```typescript
static onReady(fn: () => void) {
    if (this._isReady) { fn(); return; }
    this._readyFns.push(fn);
}
```

其他组件（如 `PlayerControl`）在 `start` 里调 `GameLoop.onReady(...)` 延迟初始化，确保纹理等资源已加载。

---

## 四、四层 System 详解

### 4.1 第①层：RawInputSystem

**唯一接触 `cc.input` 的地方**。在构造函数中订阅键盘/鼠标事件，缓存到私有字段；`update` 时批量写入每个实体的 `RawInputComp`。

```typescript
export class RawInputSystem implements ISystem {
    private held      = new Map<number, boolean>();
    private frameDown = new Set<number>();
    private frameUp   = new Set<number>();
    private frameMouseDown = false;
    private mouseLeftHeld  = false;
    private mouseX = 0;
    private mouseY = 0;

    constructor() {
        input.on(Input.EventType.KEY_DOWN, (e) => {
            this.held.set(e.keyCode, true);
            this.frameDown.add(e.keyCode);
        });
        // ... KEY_UP、MOUSE_DOWN、MOUSE_UP、MOUSE_MOVE
    }

    update(entities: Entity[]) {
        for (const e of entities) {
            const raw = e.getComponent(RawInputComp);
            if (!raw) continue;
            raw.keys = new Map(this.held);
            raw.down = new Set(this.frameDown);
            raw.up   = new Set(this.frameUp);
            raw.mouseDown = this.frameMouseDown;
            raw.mouseHeld = this.mouseLeftHeld;
            raw.mouseScreenX = this.mouseX;
            raw.mouseScreenY = this.mouseY;
        }
        this.frameDown.clear();
        this.frameUp.clear();
        this.frameMouseDown = false;
    }
}
```

**关键设计**：
- `frameDown` / `frameUp` 在 update 末尾清空 → 保证只在一帧有效
- `mouseHeld` 持续为 true → 供 `HoldToShoot` 策略读取
- 所有实体共享同一份输入 → 未来多玩家需按 `owner` 区分

### 4.2 第②层：ActionMapSystem

将物理按键翻译成**语义动作**，改键位只改一张表：

```typescript
const KEYMAP: ReadonlyMap<number, EAction> = new Map([
    [KeyCode.KEY_W, EAction.MoveUp],
    [KeyCode.KEY_S, EAction.MoveDown],
    [KeyCode.KEY_A, EAction.MoveLeft],
    [KeyCode.KEY_D, EAction.MoveRight],
    [KeyCode.KEY_J, EAction.Attack],
    [KeyCode.SPACE, EAction.Dodge],
]);
```

```typescript
update(entities: Entity[]) {
    for (const e of entities) {
        const raw = e.getComponent(RawInputComp);
        const act = e.getComponent(ActionComp);
        if (!raw || !act) continue;

        act.active.clear();
        act.justPressed.clear();

        for (const [key, action] of KEYMAP) {
            if (raw.keys.get(key)) act.active.add(action);
            if (raw.down.has(key)) act.justPressed.add(action);
        }

        // 鼠标映射为 Attack
        if (raw.mouseDown) act.justPressed.add(EAction.Attack);
        if (raw.mouseHeld) act.active.add(EAction.Attack);

        // 归一化移动方向（斜向 ≈ 0.707）
        const dx = (act.active.has(EAction.MoveRight) ? 1 : 0)
                  - (act.active.has(EAction.MoveLeft)  ? 1 : 0);
        const dy = (act.active.has(EAction.MoveUp)     ? 1 : 0)
                  - (act.active.has(EAction.MoveDown)  ? 1 : 0);
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        act.moveDir.x = dx / len;
        act.moveDir.y = dy / len;
    }
}
```

**关键设计**：
- `active`（持续按住）vs `justPressed`（单帧脉冲）——射击策略根据需要选用
- 鼠标左键同时写入两者：按下瞬间 = `justPressed`，持续 = `active`

### 4.3 第③层：PlayerControlSystem

```typescript
export class PlayerControlSystem implements ISystem {
    update(entities: Entity[]) {
        for (const e of entities) {
            const act = e.getComponent(ActionComp);
            const vel = e.getComponent(VelocityComp);
            if (!act || !vel) continue;
            const speed = 200;
            vel.vx = act.moveDir.x * speed;
            vel.vy = act.moveDir.y * speed;
        }
    }
}
```

> 当前速度写死 200，后续应读 `PlayerProperty.getValue(EPropertyId.MoveSpeed)`。

### 4.4 第④层：MoveSyncSystem

```typescript
export class MoveSyncSystem implements ISystem {
    update(entities: Entity[], dt: number) {
        for (const e of entities) {
            const vel = e.getComponent(VelocityComp);
            const ref = e.getComponent(NodeRefComp);
            if (!vel || !ref) continue;
            const pos = ref.node.position;
            ref.node.setPosition(
                pos.x + vel.vx * dt,
                pos.y + vel.vy * dt,
                pos.z,
            );
        }
    }
}
```

**ECS → Cocos 的桥梁**：通过 `NodeRefComp` 持有的 `Node` 引用，把 ECS 世界的速度积分到场景节点位置。

---

## 五、Proxy Entity —— 连接 Cocos 与 ECS

玩家并非纯 ECS 实体，而是 Cocos 组件 `PlayerControl` 在 `start` 中创建的 **Proxy Entity**：

```typescript
// PlayerControl._initProxy() 伪代码
private _initProxy() {
    this._entity = new Entity();
    this._entity.addComponent(new RawInputComp());
    this._entity.addComponent(new ActionComp());
    this._entity.addComponent(new VelocityComp());
    this._entity.addComponent(new NodeRefComp(this.node));  // 关键：绑定自身节点
    World.inst.add(this._entity);
}
```

```
PlayerControl (Cocos Component)
    │
    ├── Entity (ECS)
    │   ├── RawInputComp
    │   ├── ActionComp
    │   ├── VelocityComp
    │   └── NodeRefComp → this.node
    │
    ├── PlayerCombat      (战斗)
    ├── PlayerProperty    (属性)
    ├── EntityBuffMgr     (Buff)
    ├── HitEffectMgr      (命中效果)
    ├── UpgradeManager    (升级)
    ├── SkillSystem       (主动技能)
    └── FSM               (Idle / Run / Shoot)
```

**ECS 管输入和移动，Cocos Component 管战斗和表现**——两者通过 `NodeRefComp` 共享同一个 `Node`。

---

## 六、扩展指南

### 6.1 新增按键绑定

只需修改 `ActionMapSystem` 的 `KEYMAP`：

```typescript
[KeyCode.KEY_E, EAction.Interact],  // 新增交互动作
```

并在 `EAction` 枚举中添加对应项。

### 6.2 新增 ECS 组件

1. 在 `component/` 下新建 `XxxComp.ts`，实现 `IComponent`
2. 在 `component/index.ts` 中导出
3. 在 `PlayerControl._initProxy()` 中 `addComponent`
4. 在需要读写的 System 中 `getComponent`

### 6.3 新增 System

1. 在 `system/` 下新建 `XxxSystem.ts`，实现 `ISystem`
2. 在 `system/index.ts` 中导出
3. 在 `GameLoop` 中按正确顺序插入 `update` 调用

### 6.4 支持手柄 / 触屏

- `RawInputComp` 已能容纳任何来源的键值 → 在 `RawInputSystem` 构造中增加手柄/触屏事件监听即可
- 下游 `ActionMapSystem` 无需修改

---

## 七、文件清单

| 文件 | 路径 | 说明 |
|------|------|------|
| World | `game/core/World.ts` | 实体注册表，全局单例 |
| GameLoop | `game/core/GameLoop.ts` | 每帧驱动四个 System + 资源预加载 |
| RawInputComp | `game/component/RawInputComp.ts` | 原始键鼠状态 |
| ActionComp | `game/component/ActionComp.ts` | 语义动作 + 移动方向 |
| VelocityComp | `game/component/VelocityComp.ts` | 速度分量 |
| NodeRefComp | `game/component/NodeRefComp.ts` | Cocos 节点引用 |
| RawInputSystem | `game/system/RawInputSystem.ts` | 采集输入 |
| ActionMapSystem | `game/system/ActionMapSystem.ts` | 键位翻译 |
| PlayerControlSystem | `game/system/PlayerControlSystem.ts` | 动作→速度 |
| MoveSyncSystem | `game/system/MoveSyncSystem.ts` | 速度→节点位移 |

---

## 八、常见问题

### Q1：为什么不把战斗也做成 ECS？

ECS 擅长处理 **大量同质实体的批量逻辑**。当前玩家只有一个，战斗/技能逻辑差异大，用 OOP + 服务类更直观。如果未来小怪数量暴增（如弹幕 300+），可以把小怪 AI/移动迁入 ECS。

### Q2：World 里只有一个实体，ECS 有意义吗？

ECS 的价值不在实体数量，而在于**强制数据流单向、系统解耦**。四层 System 各自可独立测试、替换，不会出现「在 PlayerControl 的 update 里改了输入又改了位置」的混乱。

### Q3：多个实体共享输入会出问题吗？

当前所有实体拿到的是同一份 `RawInputComp` 快照。如果要区分本地 vs 远程玩家，在 `RawInputSystem` 中按 Entity 的 `owner` 标记过滤即可。

---

*教程完成。建议配合 `属性系统教程-修饰器版.md` 和 `Buff系统从零到一教程.md` 一起阅读。*
