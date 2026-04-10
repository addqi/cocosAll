# Sprite Sheet 动画系统

基于未裁切的序列帧图（Sprite Strip）实现运行时动画播放，无需预先切图。

## 架构

```
SpriteAnimMgr (Component 单例, 挂场景根节点)
│   统一驱动所有动画实例的 tick
│
├── SpriteAnimator (纯类, 每实体一个)
│   播放控制: play / pause / resume / stop / speed
│
└── SpriteSheetUtil (静态工具)
    切帧 + 缓存: Texture2D → SpriteFrame[]
```

| 文件 | 类型 | 职责 |
|------|------|------|
| `SpriteSheetUtil.ts` | 静态工具类 | 纹理 → 帧数组，带缓存 |
| `SpriteAnimator.ts` | 纯类（非 Component） | 单个实体的帧播放逻辑 |
| `SpriteAnimMgr.ts` | Component 单例 | 场景级管理器，统一驱动 tick |

## 前置准备

### 1. 场景挂载 SpriteAnimMgr

在场景根节点（或任意常驻节点）上添加 `SpriteAnimMgr` 组件。
**整个场景只需要挂一个。**

### 2. 实体节点

需要播放动画的节点上必须有 `Sprite` 组件（用于显示帧画面）。

## 使用方式

### 方式 A：编辑器拖拽纹理（推荐）

适用于资源在 `assets/res/` 下、通过编辑器 `@property` 引用的场景。

```typescript
import { _decorator, Component, Sprite, Texture2D } from 'cc';
import { SpriteSheetUtil, SpriteAnimator, SpriteAnimMgr } from '../baseSystem/animation';
const { ccclass, property } = _decorator;

@ccclass('ArcherController')
export class ArcherController extends Component {
    @property(Texture2D) idleSheet:  Texture2D = null!;
    @property(Texture2D) runSheet:   Texture2D = null!;
    @property(Texture2D) shootSheet: Texture2D = null!;

    private anim: SpriteAnimator = null!;

    onLoad() {
        const sprite = this.getComponent(Sprite)!;
        this.anim = new SpriteAnimator(sprite);

        // 注册动画：key, 帧数组, fps, 是否循环
        this.anim.addAnim('idle',  SpriteSheetUtil.createFrames(this.idleSheet,  192, 192), 10, true);
        this.anim.addAnim('run',   SpriteSheetUtil.createFrames(this.runSheet,   192, 192), 12, true);
        this.anim.addAnim('shoot', SpriteSheetUtil.createFrames(this.shootSheet, 192, 192), 15, false);

        // 注册到管理器
        SpriteAnimMgr.inst.register(this.anim);

        this.anim.play('idle');
    }

    onDestroy() {
        SpriteAnimMgr.inst.unregister(this.anim);
    }
}
```

### 方式 B：动态路径加载

适用于资源在 `resources/` 目录下、通过路径字符串动态加载的场景。

```typescript
import { _decorator, Component, Sprite } from 'cc';
import { SpriteSheetUtil, SpriteAnimator, SpriteAnimMgr } from '../baseSystem/animation';
const { ccclass } = _decorator;

@ccclass('EnemySkeleton')
export class EnemySkeleton extends Component {
    private anim: SpriteAnimator = null!;

    async onLoad() {
        const sprite = this.getComponent(Sprite)!;
        this.anim = new SpriteAnimator(sprite);

        // 异步加载（路径相对于 resources 目录，不带后缀）
        const idleFrames = await SpriteSheetUtil.loadFrames('enemies/skeleton_idle', 128, 128);
        const walkFrames = await SpriteSheetUtil.loadFrames('enemies/skeleton_walk', 128, 128);

        this.anim.addAnim('idle', idleFrames, 8, true);
        this.anim.addAnim('walk', walkFrames, 10, true);

        SpriteAnimMgr.inst.register(this.anim);
        this.anim.play('idle');
    }

    onDestroy() {
        SpriteAnimMgr.inst.unregister(this.anim);
    }
}
```

## API 参考

### SpriteSheetUtil

| 方法 | 说明 |
|------|------|
| `createFrames(texture, frameW, frameH, totalFrames?)` | 同步切帧，传入已加载的 Texture2D。支持单行/多行。`totalFrames` 不传则自动按满格计算 |
| `loadFrames(path, frameW, frameH, totalFrames?)` | 异步切帧，从 `resources/` 路径加载纹理。返回 `Promise<SpriteFrame[]>` |
| `clearCache()` | 清空帧缓存（场景切换时可选调用） |

### SpriteAnimator

#### 构造

```typescript
const anim = new SpriteAnimator(sprite: Sprite);
```

#### 注册动画

| 方法 | 说明 |
|------|------|
| `addAnim(key, frames, fps?, loop?)` | 注册一个动画。`fps` 默认 10，`loop` 默认 true |
| `removeAnim(key)` | 移除动画，若正在播放则停止 |
| `hasAnim(key)` | 查询是否已注册 |

#### 播放控制

| 方法 | 说明 |
|------|------|
| `play(key, onComplete?)` | 播放动画。循环动画重复调用不重启；非循环动画重复调用会重启。`onComplete` 仅非循环动画播完时触发 |
| `pause()` | 暂停当前动画 |
| `resume()` | 恢复播放 |
| `stop()` | 停止，停在当前帧 |

#### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `speed` | number (读写) | 播放倍速，默认 1。设 0.5 = 半速，2 = 两倍速 |
| `currentClip` | string (只读) | 当前动画 key |
| `isPlaying` | boolean (只读) | 是否正在播放（不含暂停） |
| `isPaused` | boolean (只读) | 是否暂停中 |
| `frameIndex` | number (只读) | 当前帧索引 |
| `frameCount` | number (只读) | 当前动画总帧数 |

### SpriteAnimMgr

场景单例，通过 `SpriteAnimMgr.inst` 访问。

| 方法/属性 | 说明 |
|-----------|------|
| `register(animator)` | 注册动画实例，加入驱动列表 |
| `unregister(animator)` | 注销，移出驱动列表 |
| `pauseAll()` | 全局暂停所有动画（打开菜单等） |
| `resumeAll()` | 恢复全局播放 |
| `globalSpeed` | 全局倍速（读写），影响所有实例。设 0.5 = 全局慢动作 |
| `globalPaused` | 是否全局暂停（只读） |

## 常见用法

### 非循环动画 + 回调

```typescript
// 射击动画播完自动回到待机
this.anim.play('shoot', () => {
    this.anim.play('idle');
});
```

### 倍速控制

```typescript
// 单个实体加速
this.anim.speed = 1.5;

// 全局慢动作
SpriteAnimMgr.inst.globalSpeed = 0.3;
```

### 全局暂停（菜单/对话框）

```typescript
SpriteAnimMgr.inst.pauseAll();   // 暂停
SpriteAnimMgr.inst.resumeAll();  // 恢复
```

### 多行 Sprite Sheet

如果序列帧不是单行而是网格排列（如 4 列 3 行），`createFrames` 自动处理：

```typescript
// 纹理 512x384，每帧 128x128 → 4列 × 3行 = 12帧
const frames = SpriteSheetUtil.createFrames(texture, 128, 128);

// 如果最后一行没填满（比如实际只有 10 帧），手动指定总帧数
const frames = SpriteSheetUtil.createFrames(texture, 128, 128, 10);
```

## 生命周期注意事项

1. **场景必须先挂 SpriteAnimMgr**，否则 `SpriteAnimMgr.inst` 为 null
2. **实体 `onLoad` 时 `register`，`onDestroy` 时 `unregister`**，防止管理器持有已销毁的引用
3. **`SpriteSheetUtil.clearCache()`** 可在场景切换时调用，释放缓存的 SpriteFrame
