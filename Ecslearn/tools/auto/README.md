# 自动化工具

## create:property-config

属性配置文件生成 / 同步工具。配置迁移至 `assets/script/game/player/config/`，支持玩家自定义属性。

### 同步模式

根据 `assets/script/game/player/config/*.json` 自动生成：

- `attributeConfigs.ts`：玩家属性配置列表
- `propConfigMap.ts`：PROP_CONFIG_MAP（属性 + 配置部分 → 节点 ID）
- `enum.ts`：如有新属性则追加到 EPropertyId

```bash
npm run create:property-config
```

### 新建模式

新建属性配置 JSON，并自动同步上述产物。

```bash
npm run create:property-config -- --name=Attack
npm run create:property-config -- --name=Defense
```

新建的 JSON 会放在 `game/player/config/` 目录下，文件名为属性名的 snake_case（如 `Attack` → `attack.json`）。
