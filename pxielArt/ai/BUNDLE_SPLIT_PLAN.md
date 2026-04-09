# 双场景 + Asset Bundle 分包 + 远程加载 实施方案

方案 A + 懒加载：`@property` 资源留包体，关卡 JSON 进 `game-bundle`，按需加载。

## 资源分包策略

```
留包体（launch + game 场景直接可用）:
├── res/effect/digit.effect + digit.mtl   ← AppRoot.@property 引用
├── paletteItemSprite (SpriteFrame)       ← AppRoot.@property 引用
└── src/                                  ← 脚本（引擎自动打包）

进 game-bundle（运行时按需加载）:
└── puzzles/*.json                        ← 所有关卡数据
    （未来扩展：缩略图、音效、特效等大资源）
```

## 目标架构

```
assets/
├── scene_launch.scene         # 启动场景（极轻，初始场景）
├── scene_game.scene           # 游戏场景（原 scene.scene 改名）
├── resources/                 # 保留（清空或仅保留非关卡资源）
├── game-bundle/               # 新 Asset Bundle
│   └── puzzles/
│       ├── test_simple.json
│       ├── apple.json
│       └── mountain.json
├── res/                       # 留包体：effect、材质
├── prefab/                    # 留包体
└── src/                       # 脚本
    ├── LaunchRoot.ts          # 启动场景入口
    ├── AppRoot.ts             # 游戏场景入口（几乎不改）
    └── config/
        └── BundleManager.ts   # Bundle 统一访问层
```

### 场景流程

```
App 启动 → scene_launch（秒开，零外部资源依赖）
  ↓ 用户点击 "开始游戏"
  ↓ BundleManager.load('game-bundle') + 进度条
  ↓ 加载完成
  ↓ director.loadScene('scene_game')
  → AppRoot.start() → showHome()
    → 用户点关卡 → BundleManager.loadPuzzle(path) 懒加载单个 JSON
```

---

## Phase 1：创建 game-bundle 目录

**操作**：在 Cocos Creator 编辑器中执行

1. `assets/` 下新建文件夹 `game-bundle/puzzles/`
2. 把 `assets/resources/puzzles/*.json` 移入 `assets/game-bundle/puzzles/`
3. 选中 `assets/game-bundle/` → 属性检查器：
   - 勾选 `Is Bundle`
   - Bundle Name: `game-bundle`
   - Priority: `7`
   - Compression Type: `None`

**验证**：编辑器生成 `game-bundle.meta`，`userData.isBundle` 为 `true`。

---

## Phase 2：新建 BundleManager

**新文件**：`assets/src/config/BundleManager.ts`

```typescript
import { assetManager, AssetManager, JsonAsset } from 'cc';

const GAME_BUNDLE_NAME = 'game-bundle';

export class BundleManager {

    private static _game: AssetManager.Bundle | null = null;

    static get game(): AssetManager.Bundle {
        if (!this._game) throw new Error('game-bundle not loaded yet');
        return this._game;
    }

    static get isLoaded(): boolean {
        return this._game !== null;
    }

    static load(
        onProgress?: (finished: number, total: number) => void,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const url = this._resolveBundlePath();
            assetManager.loadBundle(url, (err, bundle) => {
                if (err) return reject(err);
                this._game = bundle;

                if (onProgress) {
                    bundle.preloadDir('/', (finished, total) => {
                        onProgress(finished, total);
                    }, () => resolve());
                } else {
                    resolve();
                }
            });
        });
    }

    static loadPuzzle(jsonPath: string): Promise<JsonAsset> {
        return new Promise((resolve, reject) => {
            this.game.load(jsonPath, JsonAsset, (err, asset) => {
                if (err || !asset) return reject(err ?? new Error('load failed'));
                resolve(asset);
            });
        });
    }

    private static _resolveBundlePath(): string {
        // 编辑器预览 / 构建后均可用 bundle 名称
        // 远程 CDN 场景替换为: 'https://cdn.example.com/v1/game-bundle'
        return GAME_BUNDLE_NAME;
    }
}
```

---

## Phase 3：迁移 resources.load → BundleManager

受影响文件（3 个）：

### 3.1 GamePage.ts（第 60-66 行）

```typescript
// 之前
import { resources } from 'cc';
resources.load(entry.jsonPath, JsonAsset, (err, jsonAsset) => {
    if (err || !jsonAsset) return;
    this._buildGame(jsonAsset.json as PuzzleData, entry.id);
});

// 之后
import { BundleManager } from '../../config/BundleManager';
BundleManager.loadPuzzle(entry.jsonPath).then(jsonAsset => {
    this._buildGame(jsonAsset.json as PuzzleData, entry.id);
}).catch(() => {});
```

### 3.2 HomePage.ts（第 197 行）

```typescript
// 之前
resources.load(entry.jsonPath, JsonAsset, (err, jsonAsset) => { ... });

// 之后
BundleManager.loadPuzzle(entry.jsonPath).then(jsonAsset => {
    const puzzle = jsonAsset.json as PuzzleData;
    // ... 创建卡片逻辑不变
}).catch(() => {});
```

### 3.3 MyWorksPage.ts（第 247 行）

```typescript
// 同上模式，resources.load → BundleManager.loadPuzzle
```

**import 变更**：三个文件均移除 `resources` 导入，新增 `BundleManager` 导入。

**LevelManifest.ts 不需要改**：`jsonPath`（如 `'puzzles/test_simple'`）仍然是相对于 bundle 根的路径。

---

## Phase 4：创建启动场景

### 4.1 编辑器操作

1. `File → New Scene` → 保存为 `assets/scene_launch.scene`
2. 场景结构：`Canvas → LaunchRoot`（挂 `LaunchRoot` 组件）

### 4.2 新建 LaunchRoot.ts

**文件**：`assets/src/LaunchRoot.ts`

```typescript
import {
    _decorator, Button, Color, Component, director,
    Label, Node, Sprite, UITransform, view, Widget,
} from 'cc';
import { BundleManager } from './config/BundleManager';
import { getWhitePixelSF } from './util/WhitePixel';

const { ccclass } = _decorator;

@ccclass('LaunchRoot')
export class LaunchRoot extends Component {

    private _progressFill: UITransform | null = null;
    private _progressLabel: Label | null = null;
    private _barWidth = 0;

    start(): void {
        const vs = view.getVisibleSize();
        const ut = this.node.getComponent(UITransform);
        if (ut) ut.setContentSize(vs.width, vs.height);
        this._buildUI(vs.width, vs.height);
    }

    private _buildUI(vw: number, vh: number): void {
        const sf = getWhitePixelSF();

        // 全屏白色背景
        const bg = new Node('Bg');
        this.node.addChild(bg);
        bg.addComponent(UITransform).setContentSize(vw, vh);
        const bgSp = bg.addComponent(Sprite);
        bgSp.sizeMode = Sprite.SizeMode.CUSTOM;
        bgSp.spriteFrame = sf;
        bgSp.color = Color.WHITE;
        const w = bg.addComponent(Widget);
        w.isAlignTop = true; w.top = 0;
        w.isAlignBottom = true; w.bottom = 0;
        w.isAlignLeft = true; w.left = 0;
        w.isAlignRight = true; w.right = 0;
        w.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

        // 标题
        const title = new Node('Title');
        this.node.addChild(title);
        title.setPosition(0, 100, 0);
        title.addComponent(UITransform).setContentSize(400, 80);
        const titleLab = title.addComponent(Label);
        titleLab.string = '像素涂色';
        titleLab.fontSize = 56;
        titleLab.horizontalAlign = Label.HorizontalAlign.CENTER;
        titleLab.verticalAlign = Label.VerticalAlign.CENTER;
        titleLab.color = new Color(60, 60, 60, 255);

        // 开始按钮
        const btnNode = new Node('StartBtn');
        this.node.addChild(btnNode);
        btnNode.setPosition(0, -40, 0);
        btnNode.addComponent(UITransform).setContentSize(240, 64);
        const btnSp = btnNode.addComponent(Sprite);
        btnSp.sizeMode = Sprite.SizeMode.CUSTOM;
        btnSp.spriteFrame = sf;
        btnSp.color = new Color(76, 175, 80, 255);

        const btnLab = new Node('Label');
        btnNode.addChild(btnLab);
        btnLab.addComponent(UITransform).setContentSize(240, 64);
        const bl = btnLab.addComponent(Label);
        bl.string = '开始游戏';
        bl.fontSize = 32;
        bl.horizontalAlign = Label.HorizontalAlign.CENTER;
        bl.verticalAlign = Label.VerticalAlign.CENTER;
        bl.color = Color.WHITE;

        const btn = btnNode.addComponent(Button);
        btn.target = btnNode;
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale = 0.9;
        btn.node.on(Button.EventType.CLICK, () => this._onStartClick(btnNode));

        // 进度条（初始隐藏）
        this._buildProgressBar(vw);
    }

    private _buildProgressBar(vw: number): void {
        const barW = vw * 0.6;
        this._barWidth = barW;

        const root = new Node('LoadingBar');
        this.node.addChild(root);
        root.setPosition(0, -140, 0);
        root.active = false;

        const bgBar = new Node('Bg');
        root.addChild(bgBar);
        bgBar.addComponent(UITransform).setContentSize(barW, 12);
        const bgSp = bgBar.addComponent(Sprite);
        bgSp.sizeMode = Sprite.SizeMode.CUSTOM;
        bgSp.color = new Color(220, 220, 220, 255);

        const fill = new Node('Fill');
        bgBar.addChild(fill);
        const fillUt = fill.addComponent(UITransform);
        fillUt.setContentSize(0, 12);
        fillUt.setAnchorPoint(0, 0.5);
        fill.setPosition(-barW / 2, 0, 0);
        const fillSp = fill.addComponent(Sprite);
        fillSp.sizeMode = Sprite.SizeMode.CUSTOM;
        fillSp.color = new Color(76, 175, 80, 255);
        this._progressFill = fillUt;

        const labNode = new Node('Percent');
        root.addChild(labNode);
        labNode.setPosition(0, -24, 0);
        labNode.addComponent(UITransform).setContentSize(200, 30);
        const lab = labNode.addComponent(Label);
        lab.string = '加载中...';
        lab.fontSize = 22;
        lab.horizontalAlign = Label.HorizontalAlign.CENTER;
        lab.verticalAlign = Label.VerticalAlign.CENTER;
        lab.color = new Color(120, 120, 120, 255);
        this._progressLabel = lab;
    }

    private async _onStartClick(btnNode: Node): Promise<void> {
        btnNode.active = false;
        const bar = this.node.getChildByName('LoadingBar');
        if (bar) bar.active = true;

        try {
            await BundleManager.load((finished, total) => {
                const ratio = total > 0 ? finished / total : 0;
                if (this._progressFill) {
                    this._progressFill.setContentSize(this._barWidth * ratio, 12);
                }
                if (this._progressLabel) {
                    this._progressLabel.string = `加载中... ${Math.round(ratio * 100)}%`;
                }
            });
            director.loadScene('scene_game');
        } catch (e) {
            if (this._progressLabel) {
                this._progressLabel.string = '加载失败，请重试';
            }
            btnNode.active = true;
            if (bar) bar.active = false;
        }
    }
}
```

---

## Phase 5：场景重命名 + 项目设置

1. `assets/scene.scene` → 重命名为 `assets/scene_game.scene`
2. `项目设置 → 项目数据 → 初始场景` → 选择 `scene_launch`
3. `AppRoot.ts` **无需修改** — `@property` 引用的资源留在包体，场景加载时引擎自动解析

---

## Phase 6：构建配置 + 本地远程测试

### 构建面板配置

```
平台:            web-mobile
初始场景:         scene_launch

Bundles:
  main          → 自动（含两个场景 + 脚本）
  game-bundle   → 配置为远程包 ✅
```

### 构建输出

```
build/web-mobile/
├── index.html
├── assets/main/           ← 主包
├── src/
└── remote/
    └── game-bundle/       ← 远程包（被分离）
        ├── config.json
        ├── import/
        └── native/
```

### 本地测试（无需真实服务器）

```bash
# 方法 1: 单服务器（remote/ 不移走，相对路径自动生效）
cd build/web-mobile
python3 -m http.server 8080
# 浏览器 → http://localhost:8080

# 方法 2: 模拟 CDN（双服务器）
# 终端 1 — 主游戏
cd build/web-mobile && python3 -m http.server 8080
# 终端 2 — 远程资源
cd build/web-mobile/remote && python3 -m http.server 9090
# BundleManager._resolveBundlePath 返回 'http://localhost:9090/game-bundle'
```

**编辑器预览阶段**：`assetManager.loadBundle('game-bundle')` 按名称加载，编辑器自动解析本地路径，**无需 HTTP 服务器**。

### 环境切换

```typescript
// BundleManager._resolveBundlePath
private static _resolveBundlePath(): string {
    return GAME_BUNDLE_NAME;
    // 远程 CDN: return 'https://cdn.example.com/v1/game-bundle';
}
```

构建面板设了远程包后，引擎内部自动拼接路径。代码中只写 bundle 名称即可。

---

## Phase 7：懒加载优化（100+ 关卡时）

### 7.1 去掉 preloadDir

关卡多了之后 `BundleManager.load` 中的 `preloadDir('/')` 应移除，改为纯索引加载：

```typescript
static load(): Promise<void> {
    return new Promise((resolve, reject) => {
        assetManager.loadBundle(this._resolveBundlePath(), (err, bundle) => {
            if (err) return reject(err);
            this._game = bundle;
            resolve();  // 不预加载资源，按需拉取
        });
    });
}
```

### 7.2 首页缩略图优化

当前 `HomePage._loadAllLevels` 逐个加载完整关卡 JSON 生成缩略图。优化方向：

- **缩略图 JSON 合集**：`img2puzzle.py` 生成时同步导出 16×16 缩略数据，合并为一个 `thumbnails.json` 一次加载
- **虚拟滚动**：只加载可视区域卡片，滚出销毁，滚入创建
- **关卡清单远程化**：`LevelManifest` 从硬编码改为 JSON 放进 bundle，支持热更新

---

## 实施顺序与风险

| Phase | 做什么 | 改动 | 风险 |
|-------|--------|------|------|
| 1 | 创建 game-bundle，移动 puzzles | 编辑器操作 | 低 |
| 2 | 新建 BundleManager.ts | +1 文件 | 零 |
| 3 | 迁移 resources.load | 改 3 文件 | **中** |
| 4 | 新建 scene_launch + LaunchRoot.ts | +1 场景 +1 文件 | 低 |
| 5 | 场景改名 + 初始场景配置 | 编辑器设置 | 低 |
| 6 | 构建 + 本地远程测试 | 构建面板 | 低 |
| 7 | 懒加载优化 | 可选 | 低 |

**推荐**：Phase 1→3 先跑通 bundle 加载 → Phase 4→5 拆场景 → Phase 6 验证远程。每步保持可运行。

---

*文档生成时间：2026-04-09 | 基于当前代码状态，与 PROJECT_CONTEXT.md、ARCHITECTURE.md 配合使用。*
