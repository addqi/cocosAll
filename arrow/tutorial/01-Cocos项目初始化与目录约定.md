# 01 · Cocos 项目初始化与目录约定

## 本节目标

**打开 Cocos Creator 3.8，在已有的 `arrow` 工程里完成三件事**：

1. 建立好全教程要用的脚本目录结构。
2. 新建一个空的 `Game` 场景，运行预览，浏览器 Console 能看到一行日志：
   ```
   [Arrow] Game scene loaded. I am alive.
   ```
3. 学会以后每一章启动工程、查看日志的标准流程。

一句话：**搭好地基，让"脚本能跑、日志能看"**。

---

## 需求分析

为什么要单独开一章讲"目录"和"日志"？

- **目录一开始定错，后面每加一个文件都别扭**。真实项目里改目录的成本远大于想象（场景引用丢失、import 路径一大堆报错）。先定一次，之后 20 章都不用改。
- **第一步必须有"能跑起来"的反馈**。空项目最容易遇到的事情是：照着教程敲了 30 分钟，结果编辑器报错，根本不知道是第几步错的。我们要的是："做完这 5 分钟，看到日志 = 成功；看不到 = 回来排查这 5 分钟内的操作"。
- **对照参考项目 `G3_FBase` 的 `README.md`**，它开篇就规定了目录结构 `src/logics/ src/chains/ ...` 14 个子文件夹。我们不需要那么多，但**"有约定的目录"这个习惯要建立**。

---

## 实现思路

### 对应 G3_FBase 里的什么

| G3_FBase | 我们这里 |
|----------|----------|
| `core/features/G3/G3_FBase/src/` 下分 14 个子目录，每种原子一个目录 | `assets/scripts/` 下分 5 个子目录，按"职责"不是"原子类型"划分 |
| Feature 以 `G3_FBase_` 前缀命名所有类 | 我们不加前缀，Cocos 工程不存在命名冲突问题，简洁优先 |
| 每个 Feature 自带 `res/` 资源目录 | 我们用 Cocos 标准的 `assets/resources/` 统一管理可动态加载资源 |

### 我们的目录分层逻辑

```
scripts/
├── core/       # 纯 TS 逻辑，不依赖 cc.*（状态机、碰撞检测、关卡数据类型）
├── game/       # 战斗场景的组件脚本（挂在节点上的 cc.Component）
├── home/       # 首页场景的组件脚本
├── data/       # 数据层（单例、存档）
└── common/     # 公共（事件、配置常量）
```

**为什么 core/ 要和 game/ 分开**？

- `core/` 里的东西是**"不用 Cocos 也能跑"的纯函数和纯数据**。状态机就是 switch-case，碰撞检测就是数组遍历，这些东西放在独立目录里：
  - 以后想写单元测试容易（用 vitest 直接测）。
  - 逻辑错了能在浏览器 Console 里直接 `import()` 调用验证。
  - 如果哪天换引擎，这些代码不用改一行。
- `game/` 里的东西是**和 Cocos 强绑定的组件**，`@ccclass`、`@property`、`node.on(...)` 这些全在这里。

**这是 G3_FBase 里 `FunctionAtom` 和 `LogicAtom`/`RenderAtom` 分离的思路**，我们把这个理念提取成了"目录分层"。

---

## 代码实现

### 步骤 1：打开工程，确认版本

打开 Cocos Creator 3.8，**File → Open Project**，选择：

```
/Users/admin/cocos/mywork/cocosAll/arrow
```

顶部标题栏应当显示 `arrow - Cocos Creator 3.8.x`。**必须是 3.8.x，不能是 2.x，否则后面 API 对不上**。

### 步骤 2：建立脚本目录结构

在 Cocos 编辑器 **Assets 面板** 里，右键 `assets` 文件夹，依次创建如下目录（只创建目录，不创建文件）：

```
assets/
├── resources/
│   └── levels/
├── scenes/
├── prefabs/
├── textures/
└── scripts/
    ├── core/
    ├── game/
    ├── home/
    ├── data/
    └── common/
```

> ⚠️ **易错点**：`resources/` 这个名字是 Cocos 约定的特殊目录名，**只有放在这里的资源才能用 `resources.load('路径')` 动态加载**。不要改名。

创建完后，Assets 面板看起来应该是这样：

```
assets
 ├─ resources
 │   └─ levels
 ├─ scenes
 ├─ prefabs
 ├─ textures
 └─ scripts
     ├─ core
     ├─ game
     ├─ home
     ├─ data
     └─ common
```

### 步骤 3：写第一个脚本 `GameController.ts`

在 `assets/scripts/game/` 里右键 → **Create → TypeScript → NewComponent**，命名为 `GameController`。

编辑器会自动生成一份模板。**把内容整个替换成下面这段**：

```typescript
import { _decorator, Component } from 'cc';
const { ccclass } = _decorator;

@ccclass('GameController')
export class GameController extends Component {
    onLoad() {
        console.log('[Arrow] Game scene loaded. I am alive.');
    }
}
```

**逐行解释**：

| 行 | 作用 |
|----|------|
| `import { _decorator, Component } from 'cc';` | 从 Cocos 引擎导入装饰器系统和组件基类。 |
| `const { ccclass } = _decorator;` | 解构出 `@ccclass` 装饰器。这是 Cocos 3.x 的标准写法。 |
| `@ccclass('GameController')` | 告诉编辑器："这是一个可以挂在节点上的组件，名字叫 `GameController`"。 |
| `export class GameController extends Component` | 所有"挂在节点上"的脚本必须继承 `Component`。 |
| `onLoad()` | Cocos 的生命周期钩子，**节点被加载时调用一次**。这是我们这章最先触发的地方。 |
| `console.log(...)` | 打印日志到浏览器 Console。 |

> **对照 G3_FBase**：那里的"入口"是 `CombatInitLogic`（响应 `InitSignal`），它也是在"场景启动时执行一次"。我们这里的 `onLoad` 就是 Cocos 原生的同类概念。**不要试图造一个 "InitSignal"，Cocos 已经给了。**

### 步骤 4：新建 `Game` 场景并挂脚本

1. 在 Assets 面板，双击 `scenes/` 目录进去，右键空白处 → **Create → Scene**，命名为 `Game`。
2. 双击打开 `Game.scene`，**Hierarchy 面板**会显示一个默认的 `Canvas` 节点。
3. 选中 `Canvas` 节点，**Inspector 面板**右下角点击 **Add Component → 脚本组件 → GameController**。
4. 保存场景（Ctrl+S / Cmd+S）。

### 步骤 5：设置启动场景

1. 菜单 **Project → Project Settings**。
2. 左侧选 **Project Data**，右侧 **Start Scene** 下拉框选 `scenes/Game`。
3. 保存。

### 步骤 6：预览

点击编辑器右上角的 **▶ 预览按钮**（或 `Ctrl+P` / `Cmd+P`）。

浏览器会自动打开一个页面。按 **F12** 打开开发者工具 → **Console 面板**，能看到：

```
[Arrow] Game scene loaded. I am alive.
```

---

## 运行效果

**预期效果**：

- 浏览器打开一个空白页面（灰色背景是 Cocos 默认的空 Canvas）。
- Console 中出现我们打印的那行日志。

**看不到 ? 排查顺序**：

1. Console 里有没有红色报错？有 → 看下一节"易错点"。
2. 场景是不是没保存？回编辑器按 `Ctrl+S`，再点预览。
3. 启动场景是不是没设对？看 Project Settings → Start Scene。
4. 脚本是不是没挂到 Canvas？回编辑器 Hierarchy 选 Canvas，看 Inspector 底部有没有 `GameController` 组件。

---

## 易错点

> 这些坑 80% 的新手都会踩，单独列出来。

### 易错 1：目录名大小写写错

- `Resources` ❌ 错
- `resources` ✅ 对

Cocos 对 `resources` 这个特殊目录名**大小写敏感**。写错的结果是后面 `resources.load()` 全部失败，而且报错信息迷惑不清。

### 易错 2：`@ccclass('GameController')` 里的名字和类名不一致

```typescript
@ccclass('gameController')   // ❌ 小写
export class GameController extends Component {}
```

Cocos 2.x 里这个参数可选，3.x 里**虽然运行时不强制，但编辑器序列化依赖这个名字**。场景保存后如果名字和类名对不上，**下次打开场景脚本组件会丢**。

**规则**：`@ccclass('XxxYyy')` 的参数 = 类名，完全一致。

### 易错 3：把脚本放错目录

新手常见错误：在 `scripts/game/` 里创建脚本，但拖到了 `scripts/core/` 下。后面写 `import` 路径就会找不到。

**现在就养成习惯**：新建脚本后立刻确认它在 Assets 面板的哪个子目录，不对就拖过去。

### 易错 4：预览空白，Console 什么都没有

九成是场景根本没加载。可能原因：

- Start Scene 没设。
- 场景文件名叫 `game.scene`（小写）和 Start Scene 里配的 `Game` 不匹配。Cocos 编辑器显示不区分大小写，但底层路径**可能敏感**。
- 场景保存时有 .scene 以外的后缀。检查 `scenes/Game.scene` 确实存在。

### 易错 5：日志里没看到自己写的内容，只有一堆 Cocos 框架日志

这是因为 Console 日志太多。在 Console 顶部的 **Filter** 输入框里打 `Arrow`，只看我们自己的日志。这个习惯后面每一章都要用。

---

## 扩展练习

以下练习**自己动手做一遍**，加深理解：

1. **加一个 `HomeController.ts`**：在 `scripts/home/` 下新建同类型的脚本，打印 `[Arrow] Home scene loaded.`。新建一个 `Home` 场景，挂上这个组件。切换 Start Scene 到 `Home`，预览，验证日志输出变化。
   > 做完后**把 Start Scene 切回 `Game`**，第 02 章从 Game 场景继续。

2. **故意破坏一次**：把 `@ccclass('GameController')` 的参数改成 `@ccclass('GameCtrl')`，保存脚本，**不改场景**，预览。观察 Console 报什么错。然后改回来。这一步让你记住第 4 章讲的"易错 2"长什么样。

3. **想一想**：如果我们不分 `core/ game/ home/ data/ common/` 5 个目录，全堆在 `scripts/` 下，半年后项目有 80 个脚本文件时会遇到什么问题？列 3 条。

---

**本章结束时的工程状态**：

```
arrow/assets/
├── resources/levels/       (空)
├── scenes/Game.scene       (挂了 GameController)
├── prefabs/                (空)
├── textures/               (空)
└── scripts/
    ├── core/               (空)
    ├── game/GameController.ts   ← 唯一的脚本
    ├── home/               (空)
    ├── data/               (空)
    └── common/             (空)
```

下一章：**02 · 关卡数据结构与 JSON 加载** —— 我们要让这个空场景知道"它是第几关"。
