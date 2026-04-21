# Stage 07 — 实战接入：在 pxielArt 项目里加关卡红点

> **这一阶段结束，你会得到**：项目真实运行——关卡选择页里"没通关的关卡"右上角出现红点；进关卡通关后返回，该关卡红点自动消失；首页"关卡"按钮（汇总）的红点跟着下游变化联动。
> **前置**：Stage 01~06。
> **代码量**：项目内增改约 80 行，**不碰前 6 章的基建文件**。

---

## 1. 需求拆解

要加的东西：

```
HomePage
├── HomeLevelGroupRed         ← 汇总红点：下面任意关卡没通关就亮
│   ├── LevelDoneRed("test_1px")
│   ├── LevelDoneRed("test_simple")
│   ├── LevelDoneRed("apple")
│   └── LevelDoneRed("mountain")
```

两层组合、N 个参数化叶子。正好把前 6 章的能力全用上。

---

## 2. Linus 式三连问

### 🟢 数据结构（再次强调）

**事实 = "玩家通关了哪些关卡"**，存在 `StorageService._loadDoneList()` 返回的 `string[]` 里。

**派生 = "某关卡要不要红"** = `!StorageService.isLevelDone(id)`，现算。

**派生 = "关卡组要不要红"** = 任意叶子红，`RedGroup.calcRed()` 自动。

事实层不存红点状态——只存原始数据 + 一个 Signal 告知"数据变了"。派生层是 `IRed.calcRed()` 的一行现算。**好品味的标志**：你永远不会出现"红点状态和数据不一致"的 bug，因为根本就没独立存过红点状态。

### 🟡 特殊情况

| 场景 | 措施 |
|------|-----|
| 用户重复 `markLevelDone(id)` | `isLevelDone` 里已去重；信号派发用 "**实际变化了才 dispatch**" 防多余刷新 |
| 关卡清单后续增改 | `LevelManifest` 加一条，启动脚本的循环自动覆盖，红点代码不改 |
| 业务直接读 `isLevelDone` 用于别的 UI（比如徽章） | 零冲突——他继续读事实，我们只是多挂了红点 |

### 🔴 复杂度

**所有改动就 5 个文件**：
1. `StorageService.ts` 加一个 Signal + 在 `markLevelDone` 里 dispatch
2. `reds/LevelDoneRed.ts` 新建（叶子红点）
3. `reds/HomeLevelGroupRed.ts` 新建（汇总 Group）
4. `RedAllReds.ts` 加一行 import
5. `LaunchRoot.ts` / 游戏启动处加工厂注册和 `RedAllReds` 触发 import
6. `LevelCard` 挂 `RedCom`、`HomePage` 给关卡按钮挂 `RedCom`

---

## 3. 分步实现

### 3.1 需求：`StorageService` 暴露"关卡完成状态变了"的信号

**文件**：`assets/src/storage/StorageService.ts`（修改）

在 class 顶部加一个静态字段：

```typescript
import { Signal } from '../core/signal/Signal';

export class StorageService {
    static readonly levelDoneChanged = new Signal<string>();

    // ... 原有字段 ...
}
```

**为什么**：
- **信号跟着数据走**：关卡完成数据的管家是 `StorageService`，那"数据变了"的信号就是它的字段。这是 Stage 01 讲过的核心原则，实战验证。
- **`Signal<string>` 的 payload 是 levelId**：订阅方收到通知时知道是**哪一关**变了。即便当前系统不用（所有 `LevelDoneRed` 共用一个信号，不 care payload），留着也零成本，未来有需要时就用上。

---

### 3.2 需求：完成一关时派发信号

**文件**：同上，修改 `markLevelDone`

```typescript
static markLevelDone(levelId: string): void {
    const list = this._loadDoneList();
    if (list.includes(levelId)) return;           // ← 已有幂等保护
    list.push(levelId);
    sys.localStorage.setItem(DONE_KEY, JSON.stringify(list));
    this.levelDoneChanged.dispatch(levelId);      // ← 新增这一行
}
```

**为什么**：
- **早退检查在前**：已经完成过了直接 return，**连 dispatch 都不触发**。避免"重复通关" 导致无意义的红点重算。
- **dispatch 在 setItem 之后**：确保订阅方回调里读数据已经是新状态。

---

### 3.3 需求：叶子红点——"这一关没通关就亮"

**文件**：`assets/src/reds/LevelDoneRed.ts`（新建）

```typescript
import { IRed } from '../core/reddot/IRed';
import { Signal } from '../core/signal/Signal';
import { StorageService } from '../storage/StorageService';

export class LevelDoneRed implements IRed {

    constructor(private readonly levelId: string) { }

    calcRed(): boolean {
        return !StorageService.isLevelDone(this.levelId);
    }

    getSignals(out: Signal<any>[]): void {
        out.push(StorageService.levelDoneChanged);
    }
}
```

**为什么**：
- **没有 `@regRed`**：带参数构造，走 `regRedFactory`（见 3.6）。
- **`calcRed` 直接读存储**：不缓存、不存中间状态。每次调现读一次 localStorage——代价只有几微秒，但换来零状态一致性问题。

---

### 3.4 需求：汇总红点——"任意关卡没通关我就亮"

**文件**：`assets/src/reds/HomeLevelGroupRed.ts`（新建）

```typescript
import { regRed } from '../core/reddot/RedRegister';
import { RedGroup } from '../core/reddot/RedGroup';
import { IRed } from '../core/reddot/IRed';
import { LevelDoneRed } from './LevelDoneRed';
import { LevelManifest } from '../config/LevelManifest';

@regRed("HomeLevelGroupRed")
export class HomeLevelGroupRed extends RedGroup {
    protected children: IRed[] = LevelManifest.map(e => new LevelDoneRed(e.id));
}
```

**为什么**：
- **一句 `.map` 表达"所有关卡的红点汇总"**。关卡清单变了自动跟上，零代码改动。
- **它自己有 `@regRed`**：HomeLevelGroupRed 无参数，直接装饰器注册，UI 里填 `redKey = "HomeLevelGroupRed"` 就能用。

---

### 3.5 需求：索引文件追加这个新红点类

**文件**：`assets/src/core/reddot/RedAllReds.ts`（修改）

```typescript
import '../../reds/HomeLevelGroupRed';
// LevelDoneRed 不加——它不走装饰器，没有副作用要触发

export { };
```

**为什么**：
- `HomeLevelGroupRed.ts` 里 `import { LevelDoneRed }` 已经间接让 `LevelDoneRed.ts` 被加载了，但它没有装饰器所以不需要注册——这里**只列会触发 `@regRed` 副作用的类**。
- 列表代表"开发者心智里哪些红点是独立入口"，LevelDoneRed 不是入口（它是被 Group 组合的原材料），**不列才对**。

---

### 3.6 需求：启动时注册参数化工厂

**文件**：`assets/src/LaunchRoot.ts`（修改 `start` 方法开头）

```typescript
import './core/reddot/RedAllReds';                         // 触发 @regRed
import { regRedFactory } from './core/reddot/RedRegister';
import { LevelDoneRed } from './reds/LevelDoneRed';
import { LevelManifest } from './config/LevelManifest';

start(): void {
    for (const entry of LevelManifest) {
        regRedFactory(`LevelDone_${entry.id}`, () => new LevelDoneRed(entry.id));
    }
    // ... 原有 _buildUI 等 ...
}
```

**为什么**：
- **`import './core/reddot/RedAllReds'`** 在文件顶部——**纯 side-effect import**，不需要用到里面的任何符号，只为了触发 `@regRed` 执行。
- **工厂注册在 `start()` 里**：`LaunchRoot` 是 Cocos 场景启动的早期点，此时 `LevelManifest` 已经可用，红点注册完正好给接下来的 HomePage 使用。
- **循环的 key 格式 `LevelDone_{id}`** 要和 UI 层填的 key 严格一致——这是字符串约定，下一步在 LevelCard 里会用到同一格式。建议把它抽成常量或 util 函数（超出本教程范围，先用字符串模板）。

---

### 3.7 需求：关卡卡片挂红点组件

**文件**：`assets/src/ui/home/LevelCard.ts`（修改 `create` 方法末尾，在 `return root` 之前）

```typescript
import { RedCom } from '../../core/reddot/RedCom';

// ... create 方法内部，return root 之前 ...

const rc = root.addComponent(RedCom);
rc.redKey = `LevelDone_${name}`;   // ← 假设 name 就是 levelId；若不同，改成 entry.id
```

> ⚠️ 当前 `LevelCard.create` 的第一个参数是 `name`（关卡显示名），不是 levelId。如果项目里 `name` 和 `id` 不同，要把 `create` 签名改成接 `entry: LevelEntry`，或多传一个 `id` 参数。**本教程假设调用方已经在改造接口**，具体改动点看 HomePage 里对 `LevelCard.create` 的调用。

**为什么**：
- **挂在 `root` 节点上**：`root` 已有 `UITransform`，红点会定位到卡片的**右上角**。
- **`redKey` 必须和工厂注册的 key 完全一致**——`LevelDone_apple` / `LevelDone_mountain`。拼错了 `RedCom.onLoad` 会打 error，日志里看得清。

---

### 3.8 需求：首页"关卡"按钮挂汇总红点

**文件**：`assets/src/ui/home/HomePage.ts`（在创建关卡按钮的地方追加）

```typescript
import { RedCom } from '../../core/reddot/RedCom';

// ... 找到关卡按钮创建完毕的位置 ...
const rc = levelBtnNode.addComponent(RedCom);
rc.redKey = "HomeLevelGroupRed";
```

**为什么**：
- 填的是**装饰器注册的那个 key**（`"HomeLevelGroupRed"`），不是工厂 key。
- 当任何一个 `LevelDoneRed.getSignals` 把 `levelDoneChanged` push 进去，`HomeLevelGroupRed.getSignals` 会把所有叶子的 signal 汇到一起——结果是这**同一个** `levelDoneChanged` 被 push N 次。`RedCom.onEnable` 给它 `add(markDirty, this)` N 次，那 dispatch 一次就触发 markDirty N 次——**没关系**，因为 `_markDirty` 里有 `if (_scheduled) return`，后 N-1 次都直接早退，最终**只调度一次 refresh**。

**这就是设计上消灭特殊情况的回报**。Stage 03 写 RedGroup 时我们选择"**不去重聚合信号**"，在这里体现为"不写去重代码，因为脏标记兜底了"。

---

## 4. 跑起来：完整验证流程

1. 启动 `LaunchRoot` → 点开始按钮 → 进 game 场景（HomePage）
2. **首次打开**：4 个关卡都没通关
   - 每张卡片右上角 → 红点
   - 关卡按钮（`HomeLevelGroupRed`）→ 红点
3. 进入 `apple` 关卡，画完 → `PaintSaveManager.markLevelDone("apple")` 触发 `levelDoneChanged.dispatch("apple")`
4. 返回首页：
   - `apple` 卡片红点**消失**
   - 其他 3 张仍有红点
   - 关卡按钮汇总红点仍在（只要还有没通关的）
5. 4 关全部完成：
   - 所有卡片红点消失
   - 关卡按钮汇总红点消失

---

## 5. 调试清单

当现象不对时，按顺序排查：

- [ ] 控制台有 `[RedCom] redKey 'xxx' not found` → 有 key 没注册
- [ ] 所有红点都不亮 → 检查 `LaunchRoot` 有没有 `import './core/reddot/RedAllReds'`
- [ ] 关卡按钮不亮但卡片亮 → `HomePage` 里没挂 RedCom，或者 redKey 拼写错
- [ ] 通关后红点不消失 → `PaintSaveManager.markLevelDone` 之后有没有走 `levelDoneChanged.dispatch`
- [ ] 一秒内页面闪多次 → `RedCom` 的 `_scheduled` 防抖失效（检查是不是 reload 导致双实例）
- [ ] Inspector 有红点但定位不对 → 父节点 anchor 非标准（公式依赖 anchor 正确）

---

## 6. 量化：这次加功能花了多少代码

| 文件 | 新增 / 修改 | 代码量 |
|------|------------|-------|
| `StorageService.ts` | 加 Signal + 1 行 dispatch | +5 行 |
| `LevelDoneRed.ts` | 新建（叶子） | ~15 行 |
| `HomeLevelGroupRed.ts` | 新建（汇总） | ~10 行 |
| `RedAllReds.ts` | +1 行 import | +1 行 |
| `LaunchRoot.ts` | +3 行 工厂批量注册 | +3 行 |
| `LevelCard.ts` | +2 行 挂组件 | +2 行 |
| `HomePage.ts` | +2 行 挂组件 | +2 行 |
| **总计** | | **~38 行** |

**零行代码改了 `RedCom` / `RedGroup` / `RedRegister` / `RedDisplay` / `Signal`**。基建完全没动。

下一个需求加"邮件汇总红点"——你只需要：
1. 给 MailService 加一个 Signal（数据侧 3 行）
2. 写一个 `MailAnyRed extends RedGroup`（10 行）
3. 在索引加一行 import
4. 挂组件

**这才是"不强迫你做多少事"的架构**。

---

## 7. 你已经毕业了

走完 Stage 01~07，你掌握的是一套**通用的结构化派生状态框架**：

- 红点
- 任务进度聚合
- 成就系统解锁条件
- 资源/货币汇总显示
- 战力计算
- 功能开放判定

这些问题的共同结构都是：**事实数据 + 多源变化通知 + 派生状态 + 多处 UI 订阅**。今天你用红点吃透了这个模式，以后遇到类似需求，**就是换个名字、换个 Display 组件的事**。

---

## 8. 还可以怎么更好？（留给你的延伸思考）

本系统刻意保持最小。下面 3 个方向可以自己动手：

1. **`calcRed` 升级为 number**——支持未读计数（5 封未读邮件），`RedDisplay` 相应升级为显示数字胶囊。
2. **`RedGroup.children` 用 string[] 替代 `IRed[]`**——子用 key 引用而非实例，解耦模块依赖、支持热插拔。
3. **`RED_REFRESH_DEBOUNCE` 变成 `RedCom` 的 `@property`**——战斗页 0.1s、列表页 1s，编辑器可调。

这些不难，但做了之后你会对"接口该开多大"有更深的感觉。

---

> **"好的架构不是你能用它做多少事，而是它不强迫你做多少事。"**

回到索引：[`00-overview.md`](./00-overview.md)。
