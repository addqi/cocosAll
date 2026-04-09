# AI 像素画生成提示词模板

配合 `img2puzzle.py` 使用，批量生产 pxielArt 关卡素材。

---

## 使用流程

```
1. 选平台（豆包 / Midjourney）
2. 选档位（S / M / L / XL）
3. 选主题或自定义 subject
4. 复制对应模板，替换占位符，生成图片
5. 运行 img2puzzle.py 转换为 PuzzleData JSON
6. 放入 assets/resources/puzzles/，在 LevelManifest.ts 添加条目
```

## 档位预设

| 档位 | 网格 | 建议颜色数 | img2puzzle 参数 | 适合场景 |
|------|------|-----------|-----------------|----------|
| **S** | 16×16 | 4-8 | `--size 16 --colors 8` | 新手入门、图标级小图 |
| **M** | 32×32 | 8-15 | `--size 32 --colors 15` | 简单图案、动物食物 |
| **L** | 64×64 | 15-30 | `--size 64 --colors 30` | 中等复杂度、场景角色 |
| **XL** | 100×100 | 30-50 | `--size 100 --colors 50` | 高细节大图、风景建筑 |

## 主题库

默认主题：**动物**

| 分类 | 示例 subject | 推荐档位 |
|------|-------------|----------|
| 动物 | 猫 cat、兔子 rabbit、恐龙 dinosaur、金鱼 goldfish、猫头鹰 owl | S / M |
| 食物 | 蛋糕 cake、寿司 sushi、冰淇淋 ice cream、披萨 pizza、西瓜 watermelon | S / M |
| 自然 | 树 tree、向日葵 sunflower、蘑菇 mushroom、仙人掌 cactus | M / L |
| 角色 | 骑士 knight、公主 princess、宇航员 astronaut、海盗 pirate、忍者 ninja | M / L |
| 建筑 | 城堡 castle、灯塔 lighthouse、小木屋 cabin、风车 windmill | L / XL |
| 交通 | 火箭 rocket、帆船 sailboat、复古汽车 vintage car、热气球 hot air balloon | M / L |
| 节日 | 圣诞树 Christmas tree、南瓜灯 jack-o-lantern、灯笼 lantern、彩蛋 Easter egg | S / M |
| 物品 | 钻石 diamond、宝箱 treasure chest、皇冠 crown、魔法药水 potion | S / M |

---

## 提示词模板

### 关键出图约束（两个平台通用）

AI 生图工具产出的"像素画"通常是高分辨率模拟像素风，经过 `img2puzzle.py` 缩放 + 量化后能否保持清晰，取决于以下约束：

- **1:1 正方形**——`img2puzzle.py` 输出 N×N 网格，非正方形会被拉伸变形
- **纯色色块，禁止渐变**——median-cut 量化会把渐变打散成碎片，毁掉涂色体验
- **有限调色板**——颜色越少区块越大，涂色越爽；S 档 4-8 色，XL 档最多 50 色
- **白色背景**——配合 `--bg 240` 自动去白底，主体必须与背景有明确分离
- **无抗锯齿**——像素边缘必须锐利，不要模糊过渡
- **主体居中，留白适当**——缩放到小网格后不丢细节

---

### 豆包（字节）

#### 通用模板

```
像素画风格，{subject}，{N}x{N}像素网格，
仅使用{M}种纯色，无渐变无抗锯齿，
白色背景，主体居中，色块边界清晰锐利，
复古8-bit游戏美术风格，正方形画面
```

#### 各档位即用提示词

**S 档 (16×16)**
```
像素画风格，一只可爱的猫，16x16像素网格，
仅使用6种纯色，无渐变无抗锯齿，
白色背景，主体居中，色块边界清晰锐利，
复古8-bit游戏美术风格，正方形画面
```

**M 档 (32×32)**
```
像素画风格，一只可爱的兔子，32x32像素网格，
仅使用12种纯色，无渐变无抗锯齿，
白色背景，主体居中，色块边界清晰锐利，
复古8-bit游戏美术风格，正方形画面
```

**L 档 (64×64)**
```
像素画风格，一个穿铠甲的骑士角色，64x64像素网格，
仅使用25种纯色，无渐变无抗锯齿，
白色背景，主体居中，色块边界清晰锐利，
复古8-bit游戏美术风格，正方形画面
```

**XL 档 (100×100)**
```
像素画风格，一座日落时分的灯塔海边风景，100x100像素网格，
仅使用40种纯色，无渐变无抗锯齿，
白色背景，主体居中，色块边界清晰锐利，
复古8-bit游戏美术风格，正方形画面
```

---

### Midjourney

#### 通用模板

```
/imagine prompt: pixel art, {subject}, {N}x{N} pixel grid,
flat colors only with {M} distinct colors, no gradients,
no anti-aliasing, white background, centered composition,
crisp pixel edges, retro 8-bit game art style
--ar 1:1 --s 50 --no gradient smooth blur anti-aliasing
```

#### 各档位即用提示词

**S 档 (16×16)**
```
/imagine prompt: pixel art, a cute cat, 16x16 pixel grid,
flat colors only with 6 distinct colors, no gradients,
no anti-aliasing, white background, centered composition,
crisp pixel edges, retro 8-bit game art style, simple icon
--ar 1:1 --s 50 --no gradient smooth blur anti-aliasing
```

**M 档 (32×32)**
```
/imagine prompt: pixel art, a cute rabbit, 32x32 pixel grid,
flat colors only with 12 distinct colors, no gradients,
no anti-aliasing, white background, centered composition,
crisp pixel edges, retro 8-bit game art style
--ar 1:1 --s 50 --no gradient smooth blur anti-aliasing
```

**L 档 (64×64)**
```
/imagine prompt: pixel art, a knight character in armor, 64x64 pixel grid,
flat colors only with 25 distinct colors, no gradients,
no anti-aliasing, white background, centered composition,
crisp pixel edges, retro 16-bit game art style, detailed sprite
--ar 1:1 --s 50 --no gradient smooth blur anti-aliasing
```

**XL 档 (100×100)**
```
/imagine prompt: pixel art, a lighthouse by the sea at sunset, 100x100 pixel grid,
flat colors only with 40 distinct colors, no gradients,
no anti-aliasing, white background, centered composition,
crisp pixel edges, retro game art style, detailed scene
--ar 1:1 --s 50 --no gradient smooth blur anti-aliasing
```

---

## 批量生图建议

一次生成多张同主题不同 subject 时，按以下模式批量替换：

```
# 动物系列 M 档，一次 5 张
subject 列表: cat, rabbit, dinosaur, goldfish, owl
颜色数: 12
网格: 32

# 依次替换模板中的 {subject} 即可
```

需要一次性大量产出时，建议：
- 同一档位同一主题分类批量跑，保证风格一致
- 每个 subject 生成 2-4 张挑选最佳
- 优先挑选**色块最大、颜色最少、轮廓最清晰**的图

---

## 完整工作流示例

以"M 档 / 动物 / 猫"为例，端到端流程：

### 1. 生图

用豆包输入：
```
像素画风格，一只可爱的橘猫，32x32像素网格，
仅使用10种纯色，无渐变无抗锯齿，
白色背景，主体居中，色块边界清晰锐利，
复古8-bit游戏美术风格，正方形画面
```

下载生成的 PNG，命名为 `cat.png`。

### 2. 转换

```bash
cd pxielArt
PYTHONPATH=.pylib python3 ai/img2puzzle.py cat.png assets/resources/puzzles/cat.json --size 32 --colors 10 --bg 240
```

### 3. 注册关卡

在 `assets/src/config/LevelManifest.ts` 添加：
```typescript
{ id: 'cat', name: '橘猫', jsonPath: 'puzzles/cat' },
```

### 4. 验证

启动 Cocos Creator 预览，在首页看到新关卡卡片，点击进入涂色。

---

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 转换后颜色太多、色块太碎 | AI 生成了渐变或抗锯齿 | 提示词强调 "no gradients, flat colors"；降低 `--colors` 参数 |
| 白底去不干净 | 白色阈值不够 | 改用 `--bg 235` 或 `--bg 230`，更激进地去白 |
| 主体太小，周围大片空白 | AI 没有填满画面 | 提示词加 "fill the frame"、"close-up"；或手动裁剪再转换 |
| 缩放后细节糊了 | 原图复杂度超出网格承载力 | 降低档位（L→M），或简化 subject（"simple cat" 而非 "detailed cat"） |
| 颜色数不够、多色被合并 | `--colors` 设太低 | 适当提高 `--colors`，但不建议超过档位建议值 |

---

## 自定义指南

### 可替换字段

| 占位符 | 含义 | 替换规则 |
|--------|------|----------|
| `{subject}` | 画面主体 | 任意主题描述，中/英文均可 |
| `{N}` | 网格边长 | 对应档位：16 / 32 / 64 / 100 |
| `{M}` | 颜色数 | 参考档位建议范围，不超过上限 |

### 风格关键词扩展

可以在模板末尾追加风格修饰词来调整画风：

| 风格 | 豆包关键词 | Midjourney 关键词 |
|------|-----------|-------------------|
| 可爱卡通 | 可爱Q版、大眼睛、圆润 | chibi, kawaii, rounded shapes |
| 复古红白机 | 红白机风格、FC游戏 | NES style, Famicom, 8-bit |
| 超任16位 | 超级任天堂风格、16位色 | SNES style, 16-bit, Super Nintendo |
| 暗黑哥特 | 暗色调、哥特风、阴森 | dark palette, gothic, moody |
| 明亮清新 | 明亮色调、清新、柔和配色 | bright palette, pastel colors, cheerful |

### 添加新主题

在上方主题库表格中追加即可，格式：

```
| 你的分类 | subject_1, subject_2, subject_3 | 推荐档位 |
```

---

*本文档配合 `ai/img2puzzle.py` 使用。转换参数详见 `ai/PROJECT_CONTEXT.md` 的 AI 工具链章节。*
